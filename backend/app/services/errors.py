"""
Custom exception types raised by the service layer.

Routes translate these into HTTP responses with appropriate status codes:

- NotFoundError       -> 404
- ConflictError       -> 409  (uniqueness / duplicate)
- ValidationFailure   -> 422  (business-rule violation)
"""

from typing import Any


class ServiceError(Exception):
    """Base for service-layer errors that map to non-2xx HTTP responses."""

    code: str = "service_error"
    status_code: int = 400

    def __init__(
        self,
        message: str,
        *,
        code: str | None = None,
        field: str | None = None,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        if code is not None:
            self.code = code
        self.field = field
        self.details = details or {}


class NotFoundError(ServiceError):
    code = "not_found"
    status_code = 404


class ConflictError(ServiceError):
    """Raised when a uniqueness constraint would be violated."""

    code = "conflict"
    status_code = 409


class ValidationFailure(ServiceError):
    """Raised when a business rule (not pure input validation) is violated."""

    code = "validation_failed"
    status_code = 422


__all__ = [
    "ConflictError",
    "NotFoundError",
    "ServiceError",
    "ValidationFailure",
]