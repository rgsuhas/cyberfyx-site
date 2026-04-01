import { searchIndex as staticIndex, type SearchEntry } from '../data/search-index';

interface SearchIndexEntry {
  href: string;
  title: string;
  section: string;
  searchText: string;
}

type BackendSearchEntry = {
  href?: string;
  section?: string;
  text?: string;
  title?: string;
  url?: string;
  excerpt?: string;
  keywords?: string[];
};

let resolvedIndex: SearchIndexEntry[] = normalizeStaticEntries(staticIndex);

async function initSearchIndex(apiBaseUrl: string) {
  try {
    const res = await fetch(`${apiBaseUrl}/api/v1/public/site/search-index`);
    if (!res.ok) return;

    const data = await res.json();
    const normalized = normalizeSearchEntries(data);
    if (normalized.length > 0) {
      resolvedIndex = normalized;
    }
  } catch {
    // Keep the bundled static index if the backend search API is unavailable.
  }
}

function bootSearch() {
  initSiteSearch();

  const metaTag = document.querySelector('meta[name="cyberfyx-api-base"]');
  const apiBaseUrl = metaTag ? (metaTag.getAttribute('content') ?? '') : '';
  void initSearchIndex(apiBaseUrl);
}

document.addEventListener('DOMContentLoaded', bootSearch);
document.addEventListener('astro:page-load', bootSearch);

function initSiteSearch() {
  const searchWrapperNode = document.querySelector('[data-site-search]') as HTMLDivElement | null;
  if (!searchWrapperNode || searchWrapperNode.dataset.searchInit === '1') return;

  const inputNode = searchWrapperNode.querySelector('.site-search-input') as HTMLInputElement | null;
  const resultsNode = searchWrapperNode.querySelector('.site-search-results') as HTMLDivElement | null;
  const closeButtonNode = searchWrapperNode.querySelector('.site-search-close') as HTMLButtonElement | null;

  if (!inputNode || !resultsNode || !closeButtonNode) return;

  const searchWrapper: HTMLDivElement = searchWrapperNode;
  const input: HTMLInputElement = inputNode;
  const results: HTMLDivElement = resultsNode;
  const closeButton: HTMLButtonElement = closeButtonNode;

  searchWrapper.dataset.searchInit = '1';

  function renderResults(query = '') {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      results.innerHTML = '<div class="site-search-empty">Start typing to search the website.</div>';
      return;
    }

    const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);
    const matches = resolvedIndex
      .filter(entry => queryTokens.every(token => entry.searchText.includes(token)))
      .slice(0, 10);

    if (!matches.length) {
      results.innerHTML = '<div class="site-search-empty">No matching pages found. Try contact, services, industries, or careers.</div>';
      return;
    }

    results.innerHTML = matches.map(entry => `
      <a class="site-search-result" href="${entry.href}">
        <strong>${entry.title}</strong>
        <small>${entry.section}</small>
      </a>
    `).join('');
  }

  function openSearch() {
    searchWrapper.classList.add('open');
    renderResults(input.value);
  }

  function closeSearch({ clear = false } = {}) {
    if (clear) {
      input.value = '';
    }
    searchWrapper.classList.remove('open');
  }

  input.addEventListener('focus', () => {
    openSearch();
  });

  input.addEventListener('input', () => {
    openSearch();
  });

  closeButton.addEventListener('click', () => {
    closeSearch({ clear: true });
    input.focus();
  });

  document.addEventListener('click', event => {
    if (searchWrapper.classList.contains('open') && !searchWrapper.contains(event.target as Node)) {
      closeSearch();
    }
  });

  results.addEventListener('click', event => {
    const resultLink = (event.target as HTMLElement).closest('.site-search-result');
    if (resultLink) {
      closeSearch();
    }
  });

  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      input.focus();
      openSearch();
    }

    if (event.key === 'Escape' && searchWrapper.classList.contains('open')) {
      closeSearch();
      input.blur();
    }
  });

  renderResults();
}

function normalizeText(...parts: Array<string | undefined>) {
  return parts
    .join(' ')
    .toLowerCase()
    .replace(/[^a-z0-9\s./+-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function deriveSection(href: string) {
  if (href === '/') return 'Home';

  return href
    .replace(/\//g, ' ')
    .trim()
    .replace(/-/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

function normalizeStaticEntries(entries: SearchEntry[]): SearchIndexEntry[] {
  return entries.map(entry => {
    const section = deriveSection(entry.url);
    return {
      href: entry.url,
      title: entry.title,
      section,
      searchText: normalizeText(entry.title, entry.text, section, entry.url, entry.keywords.join(' ')),
    };
  });
}

function normalizeBackendEntry(entry: BackendSearchEntry): SearchIndexEntry | null {
  const href = typeof entry.href === 'string'
    ? entry.href
    : typeof entry.url === 'string'
      ? entry.url
      : null;

  if (!href || typeof entry.title !== 'string') return null;

  const section = typeof entry.section === 'string' && entry.section.trim()
    ? entry.section.trim()
    : deriveSection(href);

  return {
    href,
    title: entry.title,
    section,
    searchText: normalizeText(
      entry.title,
      typeof entry.text === 'string' ? entry.text : undefined,
      typeof entry.excerpt === 'string' ? entry.excerpt : undefined,
      section,
      href,
      Array.isArray(entry.keywords) ? entry.keywords.join(' ') : undefined,
    ),
  };
}

function normalizeSearchEntries(data: unknown): SearchIndexEntry[] {
  if (!Array.isArray(data)) return [];

  return data
    .map(entry => normalizeBackendEntry((entry ?? {}) as BackendSearchEntry))
    .filter((entry): entry is SearchIndexEntry => entry !== null);
}
