export {}; // Ensure this is treated as a module

function forceLightTheme() {
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.style.colorScheme = 'light';

  try {
    localStorage.setItem('cyberfyx-theme', 'light');
  } catch (_) {
    // Ignore storage failures and keep the UI in light mode.
  }
}

document.addEventListener('DOMContentLoaded', forceLightTheme);
document.addEventListener('astro:page-load', forceLightTheme);
