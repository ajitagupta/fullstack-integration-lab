import json
import logging
import re
import time
import uuid

from flask import g, request

logger = logging.getLogger("workouts")
VALID_ID = re.compile(r"^[A-Za-z0-9-]{1,64}$")
QUIET_PATHS = {"/health", "/ready"}

class JsonFormatter(logging.Formatter):
    """One JSON object per line: easy to search and to feed into log tools."""

    def format(self, record):
        entry = {
            "time": self.formatTime(record, "%Y-%m-%dT%H:%M:%S"),
            "level": record.levelname,
            "message": record.getMessage(),
        }
        entry.update(getattr(record, "fields", {}))          # extra fields passed by the caller
        if record.exc_info:
            entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(entry)


def setup(app):
    handler = logging.StreamHandler()                        # writes to stdout, where Docker and Render collect it
    handler.setFormatter(JsonFormatter())
    logger.handlers = [handler]
    logger.setLevel(logging.INFO)
    logger.propagate = False

    @app.before_request
    def start_request():
        incoming = request.headers.get("X-Request-ID", "")
        # Reuse the caller's ID only if it looks safe; otherwise make a new one
        g.request_id = incoming if VALID_ID.match(incoming) else uuid.uuid4().hex[:12]
        g.started = time.perf_counter()

    @app.after_request
    def finish_request(response):
        response.headers["X-Request-ID"] = g.request_id
        if request.path in QUIET_PATHS and response.status_code < 400:
            return response
        logger.info("request", extra={"fields": {
            "request_id": g.request_id,
            "method": request.method,
            "path": request.full_path.rstrip("?"),
            "status": response.status_code,
            "duration_ms": round((time.perf_counter() - g.started) * 1000, 1),     # seconds → milliseconds
        }})
        return response