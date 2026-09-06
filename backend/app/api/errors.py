"""
Translates service-layer exceptions into structured HTTP responses.

Register handlers on the FastAPI app so service errors map to clean
JSON bodies + appropriate status codes:

    NotFoundError       -> 404
    ConflictError       -> 409
    ValidationFailure   -> 422
    ServiceError        -> 400 (fallback)
    StorageError        -> 500  (Phase 4: storage backend failure)

Phase 5 also normalises auth errors:

    HTTPException 401   -> {detail, code: "not_authenticated" | "invalid_token" | ...}
    HTTPException 403   -> {detail, code: "insufficient_role"}
"""

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.services.errors import (
    ConflictError,
    NotFoundError,
    ServiceError,
    ValidationFailure,
)
from app.services.storage import StorageError


def _payload(exc: ServiceError) -> dict:
    out = {
        "detail": exc.message,
        "code": exc.code,
        "field": getattr(exc, "field", None),
    }
    details = getattr(exc, "details", None)
    if details:
        out["details"] = details
    return out


def _storage_payload(exc: StorageError) -> dict:
    return {
        "detail": (
            "The storage backend is unavailable. "
            "Please try again in a moment."
        ),
        "code": "storage_unavailable",
        "field": None,
    }


def _http_exception_payload(exc: HTTPException) -> dict:
    """Render a FastAPI HTTPException as a structured envelope.

    Status 401 and 403 are the Phase-5 auth/role responses and get
    specific codes so the React CMS can branch on them without
    parsing strings. Everything else keeps the existing FastAPI shape.
    """
    code = "http_error"
    if exc.status_code == status.HTTP_401_UNAUTHORIZED:
        code = "not_authenticated"
    elif exc.status_code == status.HTTP_403_FORBIDDEN:
        code = "insufficient_role"
    elif exc.status_code == status.HTTP_404_NOT_FOUND:
        code = "not_found"
    elif exc.status_code == status.HTTP_405_METHOD_NOT_ALLOWED:
        code = "method_not_allowed"

    return {"detail": exc.detail, "code": code, "field": None}


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(NotFoundError)
    async def _not_found(request: Request, exc: NotFoundError):
        return JSONResponse(status_code=exc.status_code, content=_payload(exc))

    @app.exception_handler(ConflictError)
    async def _conflict(request: Request, exc: ConflictError):
        return JSONResponse(status_code=exc.status_code, content=_payload(exc))

    @app.exception_handler(ValidationFailure)
    async def _validation(request: Request, exc: ValidationFailure):
        return JSONResponse(status_code=exc.status_code, content=_payload(exc))

    @app.exception_handler(StorageError)
    async def _storage(request: Request, exc: StorageError):
        return JSONResponse(status_code=500, content=_storage_payload(exc))

    @app.exception_handler(ServiceError)
    async def _service(request: Request, exc: ServiceError):
        return JSONResponse(status_code=exc.status_code, content=_payload(exc))

    @app.exception_handler(HTTPException)
    async def _http_exception(request: Request, exc: HTTPException):
        headers = getattr(exc, "headers", None)
        return JSONResponse(
            status_code=exc.status_code,
            content=_http_exception_payload(exc),
            headers=headers,
        )

    @app.exception_handler(RequestValidationError)
    async def _request_validation(
        request: Request, exc: RequestValidationError
    ):
        # Pydantic / FastAPI body-level validation errors. The raw
        # errors() list can contain non-JSON-serialisable objects
        # (e.g. an `Exception` instance attached to ctx); we coerce
        # the safe fields explicitly to guarantee the response body
        # can be serialised.
        safe_errors: list[dict] = []
        for err in exc.errors():
            safe: dict = {
                "loc": list(err.get("loc", [])),
                "msg": err.get("msg"),
                "type": err.get("type"),
            }
            # `input` may be a complex object; drop it from the
            # response body to keep the envelope JSON-clean.
            safe_errors.append(safe)

        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "detail": "Request validation failed.",
                "code": "request_validation",
                "field": None,
                "errors": safe_errors,
            },
        )


__all__ = ["register_error_handlers"]