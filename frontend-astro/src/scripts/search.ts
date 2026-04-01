import { searchIndex as staticIndex, type SearchEntry } from '../data/search-index';

interface ResolvedSearchEntry extends SearchEntry {
  searchText: string;
}

let resolvedIndex: ResolvedSearchEntry[] = staticIndex.map((entry) => normalizeStaticSearchEntry(entry));
let searchIndexPromise: Promise<void> | null = null;
let globalSearchListenersBound = false;

interface SearchApiEntry {
  href: string;
  title: string;
  section: string;
  text: string;
}

function uniq(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function buildSearchText(...parts: string[]) {
  return parts.join(' ').toLowerCase();
}

function normalizeHref(href: string) {
  const trimmed = href.trim();
  if (!trimmed || trimmed === '/' || trimmed === 'index.html') {
    return '/';
  }

  const withoutIndex = trimmed.replace(/\/?index\.html$/i, '');
  if (!withoutIndex) {
    return '/';
  }

  return withoutIndex.startsWith('/') ? withoutIndex : `/${withoutIndex}`;
}

function normalizeStaticSearchEntry(entry: SearchEntry): ResolvedSearchEntry {
  const url = normalizeHref(entry.url);
  const keywords = uniq(entry.keywords.map((keyword) => keyword.trim().toLowerCase()));

  return {
    ...entry,
    url,
    keywords,
    searchText: buildSearchText(entry.title, entry.excerpt, keywords.join(' ')),
  };
}

function normalizeApiSearchEntry(entry: SearchApiEntry): ResolvedSearchEntry {
  const excerptSource = entry.text.trim();
  const excerpt =
    excerptSource.length > 180
      ? `${excerptSource.slice(0, 177).trimEnd()}...`
      : excerptSource;
  const keywords = uniq(
    [
      `${entry.title} ${entry.section}`
        .toLowerCase()
        .split(/[^a-z0-9]+/i)
        .filter((value) => value.length > 2),
    ].flat(),
  );
  const url = normalizeHref(entry.href);

  return {
    title: entry.title,
    url,
    excerpt,
    keywords,
    searchText: buildSearchText(entry.title, entry.section, entry.text, keywords.join(' ')),
  };
}

function mergeSearchIndexes(entries: SearchApiEntry[]) {
  const staticByUrl = new Map(
    staticIndex.map((entry) => {
      const normalized = normalizeStaticSearchEntry(entry);
      return [normalized.url, normalized] as const;
    }),
  );

  const mergedEntries = entries.map((entry) => {
    const normalizedEntry = normalizeApiSearchEntry(entry);
    const staticEntry = staticByUrl.get(normalizedEntry.url);
    if (!staticEntry) {
      return normalizedEntry;
    }

    staticByUrl.delete(normalizedEntry.url);

    const keywords = uniq([...normalizedEntry.keywords, ...staticEntry.keywords]);
    return {
      ...normalizedEntry,
      keywords,
      searchText: buildSearchText(
        normalizedEntry.title,
        normalizedEntry.excerpt,
        normalizedEntry.searchText,
        staticEntry.excerpt,
        keywords.join(' '),
      ),
    };
  });

  return [...mergedEntries, ...staticByUrl.values()];
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function initSearchIndex(apiBaseUrl: string) {
  if (searchIndexPromise) {
    return searchIndexPromise;
  }

  searchIndexPromise = (async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/public/site/search-index`);
      if (!res.ok) return;

      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        resolvedIndex = mergeSearchIndexes(data as SearchApiEntry[]);
      }
    } catch {
      // Keep the static fallback index.
    }
  })();

  return searchIndexPromise;
}

function getMatches(query: string) {
  const normalized = query.trim().toLowerCase();
  if (normalized.length < 2) {
    return [];
  }

  return resolvedIndex
    .filter((entry) => entry.searchText.includes(normalized))
    .slice(0, 6);
}

function renderSearchResults(resultsDiv: HTMLDivElement, query: string) {
  const normalized = query.trim();
  if (normalized.length < 2) {
    resultsDiv.innerHTML = '<div class="site-search-empty">Type at least 2 letters to search.</div>';
    return false;
  }

  const matches = getMatches(normalized);
  if (matches.length === 0) {
    resultsDiv.innerHTML = `<div class="site-search-empty">No results found for "${escapeHtml(normalized)}".</div>`;
    return true;
  }

  resultsDiv.innerHTML = matches
    .map(
      (match) => `
        <a href="${escapeHtml(match.url)}" class="site-search-result">
          <strong>${escapeHtml(match.title)}</strong>
          <span>${escapeHtml(match.excerpt)}</span>
        </a>
      `,
    )
    .join('');

  return true;
}

function closeAllSearchDropdowns() {
  document.querySelectorAll<HTMLElement>('.site-search.open').forEach((searchRoot) => {
    searchRoot.classList.remove('open');
  });
}

function bindGlobalSearchListeners() {
  if (globalSearchListenersBound) {
    return;
  }

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Node)) {
      closeAllSearchDropdowns();
      return;
    }

    document.querySelectorAll<HTMLElement>('.site-search.open').forEach((searchRoot) => {
      if (!searchRoot.contains(target)) {
        searchRoot.classList.remove('open');
      }
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeAllSearchDropdowns();
    }
  });

  globalSearchListenersBound = true;
}

function initSearch() {
  const searchRoot = document.getElementById('site-search') as HTMLDivElement | null;
  const searchInput = document.getElementById('site-search-input') as HTMLInputElement | null;
  const resultsDiv = document.getElementById('site-search-results') as HTMLDivElement | null;

  if (!searchRoot || !searchInput || !resultsDiv) {
    return;
  }

  if (searchRoot.dataset.searchInit === '1') {
    return;
  }

  searchRoot.dataset.searchInit = '1';
  bindGlobalSearchListeners();

  const metaTag = document.querySelector('meta[name="cyberfyx-api-base"]');
  const apiBaseUrl = metaTag?.getAttribute('content') ?? '';
  void initSearchIndex(apiBaseUrl);

  const render = () => {
    const shouldOpen = renderSearchResults(resultsDiv, searchInput.value);
    searchRoot.classList.toggle('open', shouldOpen);
  };

  searchInput.addEventListener('focus', () => {
    render();
  });

  searchInput.addEventListener('input', () => {
    render();
  });

  searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      const firstResult = resultsDiv.querySelector<HTMLAnchorElement>('a.site-search-result');
      if (firstResult) {
        event.preventDefault();
        window.location.href = firstResult.href;
      }
    }
  });

  resultsDiv.addEventListener('click', (event) => {
    const target = event.target;
    if (target instanceof Element && target.closest('a.site-search-result')) {
      searchRoot.classList.remove('open');
    }
  });
}

document.addEventListener('DOMContentLoaded', initSearch);
document.addEventListener('astro:page-load', initSearch);
