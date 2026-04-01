from html import unescape
from pathlib import Path
import re
from typing import Literal

from sqlalchemy import Select, select
from sqlalchemy.orm import Session, selectinload

from app.core.config import BACKEND_ROOT
from app.core.errors import AppError
from app.models.site import ContactProfile

TITLE_TAG_RE = re.compile(r"<title>(.*?)</title>", flags=re.IGNORECASE | re.DOTALL)
ASTRO_TITLE_PROP_RE = re.compile(
    r"<BaseLayout\b[^>]*\btitle\s*=\s*['\"]([^'\"]+)['\"]",
    flags=re.IGNORECASE | re.DOTALL,
)
HEADING_RE = re.compile(r"<h([1-2])\b[^>]*>(.*?)</h\1>", flags=re.IGNORECASE | re.DOTALL)


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


def resolve_search_root() -> tuple[Path, Literal["built", "source"]] | None:
    candidates: tuple[tuple[Path, Literal["built", "source"]], ...] = (
        (BACKEND_ROOT.parent / "frontend-astro" / "dist", "built"),
        (BACKEND_ROOT.parent / "frontend-astro" / "src" / "pages", "source"),
        (BACKEND_ROOT / "frontend", "built"),
        (BACKEND_ROOT.parent / "frontend", "built"),
    )

    for candidate, source_kind in candidates:
        if source_kind == "built" and candidate.is_dir() and (candidate / "index.html").is_file():
            return candidate, source_kind
        if source_kind == "source" and candidate.is_dir() and any(candidate.rglob("*.astro")):
            return candidate, source_kind

    return None


def _extract_title(raw_html: str, *, fallback: str) -> str:
    title_match = TITLE_TAG_RE.search(raw_html)
    if title_match:
        return " ".join(unescape(title_match.group(1)).split())
    return fallback


def _extract_source_title(raw_source: str, *, fallback: str) -> str:
    title_match = ASTRO_TITLE_PROP_RE.search(raw_source)
    if title_match:
        return " ".join(unescape(title_match.group(1)).split())
    return fallback


def _extract_page_text(raw_html: str) -> str:
    without_comments = re.sub(r"<!--.*?-->", " ", raw_html, flags=re.DOTALL)
    without_scripts = re.sub(r"<script\b[^>]*>.*?</script>", " ", without_comments, flags=re.IGNORECASE | re.DOTALL)
    without_styles = re.sub(r"<style\b[^>]*>.*?</style>", " ", without_scripts, flags=re.IGNORECASE | re.DOTALL)
    without_tags = re.sub(r"<[^>]+>", " ", without_styles)
    return " ".join(unescape(without_tags).split())


def _extract_source_heading_text(raw_source: str, *, title: str) -> str:
    parts = [title]
    for match in HEADING_RE.finditer(raw_source):
        heading_text = _extract_page_text(match.group(2))
        if heading_text and heading_text not in parts:
            parts.append(heading_text)
    return " ".join(part for part in parts if part)


def _iter_built_search_documents(frontend_root: Path) -> list[Path]:
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


def _iter_source_search_documents(frontend_root: Path) -> list[Path]:
    documents: list[Path] = []
    for document in sorted(frontend_root.rglob("*.astro"), key=lambda path: path.as_posix().lower()):
        relative_parts = document.relative_to(frontend_root).parts
        if any(part.startswith("_") or "[" in part or "]" in part for part in relative_parts):
            continue
        documents.append(document)

    return documents


def _iter_search_documents(frontend_root: Path, source_kind: Literal["built", "source"]) -> list[Path]:
    if source_kind == "source":
        return _iter_source_search_documents(frontend_root)
    return _iter_built_search_documents(frontend_root)


def _built_document_href(frontend_root: Path, document: Path) -> str:
    relative_path = document.relative_to(frontend_root).as_posix()
    if relative_path == "index.html":
        return "/"

    if relative_path.endswith("/index.html"):
        return f"/{relative_path[:-11].strip('/')}"

    return f"/{relative_path}"


def _source_document_href(frontend_root: Path, document: Path) -> str:
    relative = document.relative_to(frontend_root).with_suffix("")
    parts = list(relative.parts)

    if parts == ["index"]:
        return "/"
    if parts and parts[-1] == "index":
        parts = parts[:-1]

    return f"/{'/'.join(parts)}"


def _document_href(frontend_root: Path, document: Path, source_kind: Literal["built", "source"]) -> str:
    if source_kind == "source":
        return _source_document_href(frontend_root, document)
    return _built_document_href(frontend_root, document)


def _document_section(document: Path, href: str) -> str:
    if href == "/":
        return "Home"

    if document.name == "index.html" and len(document.parts) >= 2:
        return document.parent.name.replace("-", " ").title()

    if document.stem == "index" and document.parent != document.parent.parent:
        return document.parent.name.replace("-", " ").title()

    return document.stem.replace("-", " ").title()


def list_public_search_entries() -> list[dict[str, str]]:
    resolved_root = resolve_search_root()
    if resolved_root is None:
        raise AppError(
            code="site_search_not_available",
            message="The site search index is not available because the frontend files could not be found.",
            status_code=503,
        )

    frontend_root, source_kind = resolved_root
    documents = _iter_search_documents(frontend_root, source_kind)

    entries: list[dict[str, str]] = []
    for document in documents:
        if not document.is_file():
            continue

        raw_content = document.read_text(encoding="utf-8", errors="ignore")
        href = _document_href(frontend_root, document, source_kind)
        if href.startswith("/admin") or href == "/404":
            continue

        fallback_title = "Cyberfyx" if href == "/" else _document_section(document, href)
        section = _document_section(document, href)
        if source_kind == "source":
            title = _extract_source_title(raw_content, fallback=fallback_title)
            text = _extract_source_heading_text(raw_content, title=title)
        else:
            title = _extract_title(raw_content, fallback=fallback_title)
            text = _extract_page_text(raw_content)

        entries.append(
            {
                "href": href,
                "title": title,
                "section": section,
                "text": text,
            }
        )

    return entries
