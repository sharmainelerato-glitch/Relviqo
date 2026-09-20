import os

from apscheduler.schedulers.background import BackgroundScheduler
from flask import Flask, jsonify, request
from flask_cors import CORS

from models import CheckResult, Incident, Monitor, db
from monitor import (
    calculate_monitor_metrics,
    check_all_monitors,
    perform_check,
)


app = Flask(__name__)

app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get(
    "DATABASE_URL",
    "sqlite:///relviqo.db",
)

app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db.init_app(app)
CORS(app)


with app.app_context():
    db.create_all()


@app.get("/")
def home():
    return jsonify(
        {
            "name": "Relviqo API",
            "tagline": "Reliability, measured.",
            "status": "running",
        }
    )


@app.get("/api/health")
def health():
    return jsonify(
        {
            "status": "healthy",
            "service": "Relviqo API",
        }
    )


@app.get("/api/monitors")
def get_monitors():
    monitors = Monitor.query.order_by(Monitor.created_at.desc()).all()

    response = []

    for monitor in monitors:
        data = monitor.to_dict()
        data["metrics"] = calculate_monitor_metrics(monitor.id)

        recent_checks = (
            CheckResult.query
            .filter_by(monitor_id=monitor.id)
            .order_by(CheckResult.checked_at.desc())
            .limit(30)
            .all()
        )

        # Reverse so the oldest check appears on the left
        # and the newest check appears on the right.
        data["recentChecks"] = [
            check.to_dict()
            for check in reversed(recent_checks)
        ]

        response.append(data)

    return jsonify(response)
@app.post("/api/monitors")
def create_monitor():
    data = request.get_json(silent=True) or {}

    name = str(data.get("name", "")).strip()
    url = str(data.get("url", "")).strip()
    method = str(data.get("method", "GET")).upper().strip()

    if not name:
        return jsonify({"error": "Monitor name is required."}), 400

    if not url:
        return jsonify({"error": "Endpoint URL is required."}), 400

    if not url.startswith(("http://", "https://")):
        return jsonify(
            {"error": "URL must begin with http:// or https://."}
        ), 400

    if method not in {"GET", "HEAD"}:
        return jsonify(
            {"error": "Relviqo currently supports GET and HEAD monitoring."}
        ), 400

    try:
        expected_status = int(data.get("expectedStatus", 200))
        timeout_seconds = int(data.get("timeoutSeconds", 10))
    except (TypeError, ValueError):
        return jsonify(
            {"error": "Expected status and timeout must be numbers."}
        ), 400

    if expected_status < 100 or expected_status > 599:
        return jsonify(
            {"error": "Expected HTTP status must be between 100 and 599."}
        ), 400

    if timeout_seconds < 1 or timeout_seconds > 60:
        return jsonify(
            {"error": "Timeout must be between 1 and 60 seconds."}
        ), 400

    monitor = Monitor(
        name=name,
        url=url,
        method=method,
        expected_status=expected_status,
        timeout_seconds=timeout_seconds,
    )

    db.session.add(monitor)
    db.session.commit()

    check = perform_check(monitor)

    result = monitor.to_dict()
    result["metrics"] = calculate_monitor_metrics(monitor.id)
    result["initialCheck"] = check.to_dict()

    return jsonify(result), 201


@app.get("/api/monitors/<int:monitor_id>")
def get_monitor(monitor_id):
    monitor = db.get_or_404(Monitor, monitor_id)

    data = monitor.to_dict()
    data["metrics"] = calculate_monitor_metrics(monitor.id)

    return jsonify(data)


@app.delete("/api/monitors/<int:monitor_id>")
def delete_monitor(monitor_id):
    monitor = db.get_or_404(Monitor, monitor_id)

    db.session.delete(monitor)
    db.session.commit()

    return jsonify({"message": "Monitor deleted."})


@app.patch("/api/monitors/<int:monitor_id>")
def update_monitor(monitor_id):
    monitor = db.get_or_404(Monitor, monitor_id)
    data = request.get_json(silent=True) or {}

    if "name" in data:
        name = str(data["name"]).strip()

        if not name:
            return jsonify({"error": "Monitor name cannot be empty."}), 400

        monitor.name = name

    if "url" in data:
        url = str(data["url"]).strip()

        if not url.startswith(("http://", "https://")):
            return jsonify(
                {"error": "URL must begin with http:// or https://."}
            ), 400

        monitor.url = url

    if "method" in data:
        method = str(data["method"]).upper().strip()

        if method not in {"GET", "HEAD"}:
            return jsonify(
                {"error": "Relviqo currently supports GET and HEAD monitoring."}
            ), 400

        monitor.method = method

    if "expectedStatus" in data:
        try:
            expected_status = int(data["expectedStatus"])
        except (TypeError, ValueError):
            return jsonify(
                {"error": "Expected status must be a number."}
            ), 400

        if expected_status < 100 or expected_status > 599:
            return jsonify(
                {"error": "Expected HTTP status must be between 100 and 599."}
            ), 400

        monitor.expected_status = expected_status

    if "timeoutSeconds" in data:
        try:
            timeout_seconds = int(data["timeoutSeconds"])
        except (TypeError, ValueError):
            return jsonify(
                {"error": "Timeout must be a number."}
            ), 400

        if timeout_seconds < 1 or timeout_seconds > 60:
            return jsonify(
                {"error": "Timeout must be between 1 and 60 seconds."}
            ), 400

        monitor.timeout_seconds = timeout_seconds

    if "isActive" in data:
        monitor.is_active = bool(data["isActive"])

    db.session.commit()

    data = monitor.to_dict()
    data["metrics"] = calculate_monitor_metrics(monitor.id)

    return jsonify(data)


@app.post("/api/monitors/<int:monitor_id>/check")
def run_monitor_check(monitor_id):
    monitor = db.get_or_404(Monitor, monitor_id)

    check = perform_check(monitor)

    return jsonify(
        {
            "monitor": monitor.to_dict(),
            "check": check.to_dict(),
            "metrics": calculate_monitor_metrics(monitor.id),
        }
    )


@app.post("/api/check-all")
def run_all_checks():
    results = check_all_monitors()

    return jsonify(
        {
            "checked": len(results),
            "results": results,
        }
    )


@app.get("/api/monitors/<int:monitor_id>/history")
def monitor_history(monitor_id):
    db.get_or_404(Monitor, monitor_id)

    try:
        limit = min(int(request.args.get("limit", 50)), 500)
    except ValueError:
        limit = 50

    checks = (
        CheckResult.query.filter_by(monitor_id=monitor_id)
        .order_by(CheckResult.checked_at.desc())
        .limit(limit)
        .all()
    )

    return jsonify([check.to_dict() for check in checks])


@app.get("/api/incidents")
def get_incidents():
    incidents = Incident.query.order_by(
        Incident.started_at.desc()
    ).all()

    return jsonify([incident.to_dict() for incident in incidents])


@app.get("/api/dashboard")
def dashboard():
    monitors = Monitor.query.all()

    total = len(monitors)
    up = sum(m.current_status == "UP" for m in monitors)
    degraded = sum(m.current_status == "DEGRADED" for m in monitors)
    down = sum(m.current_status == "DOWN" for m in monitors)
    pending = sum(m.current_status == "PENDING" for m in monitors)

    latencies = [
        m.last_response_time_ms
        for m in monitors
        if m.last_response_time_ms is not None
    ]

    average_latency = (
        round(sum(latencies) / len(latencies), 2)
        if latencies
        else None
    )

    open_incidents = Incident.query.filter_by(
        resolved_at=None
    ).count()

    recent_incidents = (
        Incident.query.order_by(Incident.started_at.desc())
        .limit(5)
        .all()
    )

    return jsonify(
        {
            "totalMonitors": total,
            "up": up,
            "degraded": degraded,
            "down": down,
            "pending": pending,
            "averageResponseTimeMs": average_latency,
            "openIncidents": open_incidents,
            "recentIncidents": [
                incident.to_dict()
                for incident in recent_incidents
            ],
        }
    )


def scheduled_checks():
    with app.app_context():
        check_all_monitors()


scheduler = BackgroundScheduler(daemon=True)
scheduler.add_job(
    scheduled_checks,
    trigger="interval",
    seconds=60,
    id="relviqo-monitoring",
    replace_existing=True,
)
scheduler.start()


if __name__ == "__main__":
    app.run(debug=True, use_reloader=False)