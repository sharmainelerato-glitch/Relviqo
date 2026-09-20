from datetime import datetime, timezone

from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


def utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Monitor(db.Model):
    __tablename__ = "monitors"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    url = db.Column(db.String(1000), nullable=False)
    method = db.Column(db.String(10), nullable=False, default="GET")
    expected_status = db.Column(db.Integer, nullable=False, default=200)
    timeout_seconds = db.Column(db.Integer, nullable=False, default=10)
    is_active = db.Column(db.Boolean, nullable=False, default=True)

    current_status = db.Column(db.String(20), nullable=False, default="PENDING")
    last_status_code = db.Column(db.Integer, nullable=True)
    last_response_time_ms = db.Column(db.Float, nullable=True)
    last_checked_at = db.Column(db.DateTime, nullable=True)

    created_at = db.Column(db.DateTime, nullable=False, default=utc_now)

    checks = db.relationship(
        "CheckResult",
        backref="monitor",
        lazy=True,
        cascade="all, delete-orphan",
    )

    incidents = db.relationship(
        "Incident",
        backref="monitor",
        lazy=True,
        cascade="all, delete-orphan",
    )

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "url": self.url,
            "method": self.method,
            "expectedStatus": self.expected_status,
            "timeoutSeconds": self.timeout_seconds,
            "isActive": self.is_active,
            "currentStatus": self.current_status,
            "lastStatusCode": self.last_status_code,
            "lastResponseTimeMs": self.last_response_time_ms,
            "lastCheckedAt": (
                self.last_checked_at.isoformat() + "Z"
                if self.last_checked_at
                else None
            ),
            "createdAt": self.created_at.isoformat() + "Z",
        }


class CheckResult(db.Model):
    __tablename__ = "check_results"

    id = db.Column(db.Integer, primary_key=True)
    monitor_id = db.Column(
        db.Integer,
        db.ForeignKey("monitors.id"),
        nullable=False,
    )

    status = db.Column(db.String(20), nullable=False)
    status_code = db.Column(db.Integer, nullable=True)
    response_time_ms = db.Column(db.Float, nullable=True)
    error_message = db.Column(db.String(1000), nullable=True)
    checked_at = db.Column(db.DateTime, nullable=False, default=utc_now)

    def to_dict(self):
        return {
            "id": self.id,
            "monitorId": self.monitor_id,
            "status": self.status,
            "statusCode": self.status_code,
            "responseTimeMs": self.response_time_ms,
            "errorMessage": self.error_message,
            "checkedAt": self.checked_at.isoformat() + "Z",
        }


class Incident(db.Model):
    __tablename__ = "incidents"

    id = db.Column(db.Integer, primary_key=True)
    monitor_id = db.Column(
        db.Integer,
        db.ForeignKey("monitors.id"),
        nullable=False,
    )

    started_at = db.Column(db.DateTime, nullable=False, default=utc_now)
    resolved_at = db.Column(db.DateTime, nullable=True)
    cause = db.Column(db.String(1000), nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "monitorId": self.monitor_id,
            "monitorName": self.monitor.name if self.monitor else None,
            "startedAt": self.started_at.isoformat() + "Z",
            "resolvedAt": (
                self.resolved_at.isoformat() + "Z"
                if self.resolved_at
                else None
            ),
            "cause": self.cause,
            "status": "RESOLVED" if self.resolved_at else "ONGOING",
        }