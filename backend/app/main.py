from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi import _rate_limit_exceeded_handler

from app.api.router import api_router
from app.core.config import get_settings
from app.core.database import check_database_ready
from app.core.errors import AppError, register_error_handlers
from app.core.rate_limit import limiter
from app.services.site import resolve_frontend_root

settings = get_settings()
CSP_POLICY = (
    "default-src 'self'; "
    "script-src 'self'; "
    "style-src 'self' 'unsafe-inline'; "
    "img-src 'self' data: https:; "
    "font-src 'self' data:; "
    "connect-src 'self'; "
    "frame-ancestors 'none'; "
    "base-uri 'self'; "
    "form-action 'self'"
)


def _register_frontend(app: FastAPI) -> None:
    frontend_root = resolve_frontend_root()
    if frontend_root is None:
        return

    assets_dir = frontend_root / "assets"
    pages_dir = frontend_root / "pages"

    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="frontend-assets")
    if pages_dir.is_dir():
        app.mount("/pages", StaticFiles(directory=str(pages_dir)), name="frontend-pages")

    index_file = frontend_root / "index.html"

    @app.get("/", include_in_schema=False)
    def frontend_index() -> FileResponse:
        return FileResponse(index_file)

    @app.get("/index.html", include_in_schema=False)
    def frontend_index_html() -> FileResponse:
        return FileResponse(index_file)


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        docs_url="/docs" if settings.environment != "production" else None,
        redoc_url="/redoc" if settings.environment != "production" else None,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
        expose_headers=["X-Request-ID"],
        max_age=600,
    )
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)

    @app.middleware("http")
    async def add_request_context(request: Request, call_next):
        request_id = request.headers.get("X-Request-ID") or str(uuid4())
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Content-Security-Policy"] = CSP_POLICY
        if request.url.path.startswith("/api/v1/internal") or request.url.path == "/api/v1/public/inquiries":
            response.headers["Cache-Control"] = "no-store"
        return response

    register_error_handlers(app)
    app.include_router(api_router)

    @app.get("/health/live", tags=["health"])
    def health_live() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/health/ready", tags=["health"])
    def health_ready() -> dict[str, str]:
        try:
            check_database_ready()
        except Exception as exc:
            raise AppError(
                code="database_not_ready",
                message="Database connectivity is not available.",
                status_code=503,
            ) from exc
        return {"status": "ready"}

    _register_frontend(app)

    return app


app = create_app()
