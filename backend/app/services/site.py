from html import unescape
from pathlib import Path
import re

from sqlalchemy import Select, select
from sqlalchemy.orm import Session, selectinload

from app.core.config import BACKEND_ROOT
from app.core.errors import AppError
from app.models.site import ContactProfile


def _published_contact_profile_query() -> Select[tuple[ContactProfile]]:
    return (
        select(ContactProfile)
        .where(ContactProfile.profile_key == "primary", ContactProfile.published.is_(True))
        .options(
            selectinload(ContactProfile.office_regions),
            selectinload(ContactProfile.interest_options),
        )
    )


def get_public_contact_profile(session: Session) -> ContactProfile:
    profile = session.scalar(_published_contact_profile_query())
    if profile is None:
        raise AppError(
            code="contact_profile_not_configured",
            message="The public contact profile is not configured.",
            status_code=503,
        )
    return profile


def resolve_frontend_root() -> Path | None:
    candidates = (
        BACKEND_ROOT.parent / "frontend-astro" / "dist",
        BACKEND_ROOT / "frontend",
        BACKEND_ROOT.parent / "frontend",
    )
    for candidate in candidates:
        if candidate.is_dir() and (candidate / "index.html").is_file():
            return candidate
    return None


def _extract_title(raw_html: str, *, fallback: str) -> str:
    title_match = re.search(r"<title>(.*?)</title>", raw_html, flags=re.IGNORECASE | re.DOTALL)
    if title_match:
        return " ".join(unescape(title_match.group(1)).split())
    return fallback


def _extract_page_text(raw_html: str) -> str:
    without_comments = re.sub(r"<!--.*?-->", " ", raw_html, flags=re.DOTALL)
    without_scripts = re.sub(r"<script\b[^>]*>.*?</script>", " ", without_comments, flags=re.IGNORECASE | re.DOTALL)
    without_styles = re.sub(r"<style\b[^>]*>.*?</style>", " ", without_scripts, flags=re.IGNORECASE | re.DOTALL)
    without_tags = re.sub(r"<[^>]+>", " ", without_styles)
    return " ".join(unescape(without_tags).split())


def _iter_search_documents(frontend_root: Path) -> list[Path]:
    documents: list[Path] = []
    root_index = frontend_root / "index.html"
    if root_index.is_file():
        documents.append(root_index)

    for document in sorted(frontend_root.rglob("index.html"), key=lambda path: path.as_posix().lower()):
        if document == root_index:
            continue
        relative_parts = document.relative_to(frontend_root).parts
        if any(part.startswith("_") for part in relative_parts):
            continue
        documents.append(document)

    return documents


def _document_href(frontend_root: Path, document: Path) -> str:
    relative_path = document.relative_to(frontend_root).as_posix()
    if relative_path == "index.html":
        return "/"

    if relative_path.endswith("/index.html"):
        return f"/{relative_path[:-11].strip('/')}"

    return f"/{relative_path}"


def _document_section(document: Path, href: str) -> str:
    if href == "/":
        return "Home"

    if document.name == "index.html" and len(document.parts) >= 2:
        return document.parent.name.replace("-", " ").title()

    return document.stem.replace("-", " ").title()


def list_public_search_entries() -> list[dict[str, str]]:
    frontend_root = resolve_frontend_root()
    if frontend_root is None:
        raise AppError(
            code="site_search_not_available",
            message="The site search index is not available because the frontend files could not be found.",
            status_code=503,
        )

    documents = _iter_search_documents(frontend_root)

    entries: list[dict[str, str]] = []
    for document in documents:
        if not document.is_file():
            continue

        raw_html = document.read_text(encoding="utf-8", errors="ignore")
        href = _document_href(frontend_root, document)
        fallback_title = "Cyberfyx" if href == "/" else _document_section(document, href)
        section = _document_section(document, href)

        entries.append(
            {
                "href": href,
                "title": _extract_title(raw_html, fallback=fallback_title),
                "section": section,
                "text": _extract_page_text(raw_html),
            }
        )

    return entries
