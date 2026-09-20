import time
from datetime import datetime, timezone

import requests
from sqlalchemy import func

from models import CheckResult, Incident, Monitor, db


DEGRADED_THRESHOLD_MS = 1500


def utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def determine_status(status_code, expected_status, response_time_ms):
    if status_code != expected_status:
        return "DOWN"

    if response_time_ms >= DEGRADED_THRESHOLD_MS:
        return "DEGRADED"

    return "UP"


def perform_check(monitor):
    started = time.perf_counter()

    status_code = None
    response_time_ms = None
    error_message = None

    try:
        response = requests.request(
            method=monitor.method,
            url=monitor.url,
            timeout=monitor.timeout_seconds,
            allow_redirects=True,
            headers={
                "User-Agent": "Relviqo-Monitor/1.0",
            },
        )

        response_time_ms = round(
            (time.perf_counter() - started) * 1000,
            2,
        )

        status_code = response.status_code

        status = determine_status(
            status_code,
            monitor.expected_status,
            response_time_ms,
        )

        if status_code != monitor.expected_status:
            error_message = (
                f"Expected HTTP {monitor.expected_status}, "
                f"received HTTP {status_code}."
            )

    except requests.RequestException as error:
        response_time_ms = round(
            (time.perf_counter() - started) * 1000,
            2,
        )

        status = "DOWN"
        error_message = str(error)[:1000]

    previous_status = monitor.current_status

    check = CheckResult(
        monitor_id=monitor.id,
        status=status,
        status_code=status_code,
        response_time_ms=response_time_ms,
        error_message=error_message,
        checked_at=utc_now(),
    )

    db.session.add(check)

    monitor.current_status = status
    monitor.last_status_code = status_code
    monitor.last_response_time_ms = response_time_ms
    monitor.last_checked_at = check.checked_at

    handle_incident_transition(
        monitor=monitor,
        previous_status=previous_status,
        new_status=status,
        error_message=error_message,
    )

    db.session.commit()

    return check


def handle_incident_transition(
    monitor,
    previous_status,
    new_status,
    error_message=None,
):
    active_incident = (
        Incident.query.filter_by(
            monitor_id=monitor.id,
            resolved_at=None,
        )
        .order_by(Incident.started_at.desc())
        .first()
    )

    if new_status == "DOWN" and not active_incident:
        incident = Incident(
            monitor_id=monitor.id,
            started_at=utc_now(),
            cause=error_message or "Endpoint became unavailable.",
        )

        db.session.add(incident)

    elif new_status in {"UP", "DEGRADED"} and active_incident:
        active_incident.resolved_at = utc_now()


def check_all_monitors():
    monitors = Monitor.query.filter_by(is_active=True).all()

    results = []

    for monitor in monitors:
        try:
            result = perform_check(monitor)

            results.append(
                {
                    "monitorId": monitor.id,
                    "status": result.status,
                    "responseTimeMs": result.response_time_ms,
                }
            )

        except Exception as error:
            db.session.rollback()

            results.append(
                {
                    "monitorId": monitor.id,
                    "status": "ERROR",
                    "error": str(error),
                }
            )

    return results


def calculate_monitor_metrics(monitor_id):
    total_checks = (
        db.session.query(func.count(CheckResult.id))
        .filter(CheckResult.monitor_id == monitor_id)
        .scalar()
        or 0
    )

    successful_checks = (
        db.session.query(func.count(CheckResult.id))
        .filter(
            CheckResult.monitor_id == monitor_id,
            CheckResult.status.in_(["UP", "DEGRADED"]),
        )
        .scalar()
        or 0
    )

    failed_checks = (
        db.session.query(func.count(CheckResult.id))
        .filter(
            CheckResult.monitor_id == monitor_id,
            CheckResult.status == "DOWN",
        )
        .scalar()
        or 0
    )

    average_latency = (
        db.session.query(func.avg(CheckResult.response_time_ms))
        .filter(
            CheckResult.monitor_id == monitor_id,
            CheckResult.response_time_ms.isnot(None),
        )
        .scalar()
    )

    uptime_percentage = (
        round((successful_checks / total_checks) * 100, 2)
        if total_checks
        else None
    )

    return {
        "totalChecks": total_checks,
        "successfulChecks": successful_checks,
        "failedChecks": failed_checks,
        "uptimePercentage": uptime_percentage,
        "averageResponseTimeMs": (
            round(float(average_latency), 2)
            if average_latency is not None
            else None
        ),
    }