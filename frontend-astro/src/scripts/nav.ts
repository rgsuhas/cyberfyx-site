export {};

function initNav() {
  const header = document.getElementById('header');
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const navMenu = document.getElementById('nav-menu');
  const backToTop = document.getElementById('back-to-top');
  let lastScroll = 0;

  // Scroll hide/show + scrolled class logic
  window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;
    if (currentScroll > 50) {
      header?.classList.add('scrolled');
      if (currentScroll > lastScroll && currentScroll > 200) {
        header?.classList.add('hidden');
      } else {
        header?.classList.remove('hidden');
      }
    } else {
      header?.classList.remove('scrolled', 'hidden');
    }

    // Back to top visibility
    if (backToTop) {
      if (currentScroll > 400) {
        backToTop.classList.add('visible');
      } else {
        backToTop.classList.remove('visible');
      }
    }

    lastScroll = currentScroll;
  });

  // Mobile menu toggle
  mobileMenuBtn?.addEventListener('click', () => {
    navMenu?.classList.toggle('active');
    document.body.classList.toggle('menu-open');
    // Toggle icon
    const icon = mobileMenuBtn.querySelector<HTMLElement>('.mobile-menu-icon');
    if (icon) {
      icon.textContent = navMenu?.classList.contains('active') ? '✕' : '☰';
    }
  });

  // Close mobile menu when clicking a link
  navMenu?.querySelectorAll('.nav-link, .dropdown-item').forEach(link => {
    link.addEventListener('click', () => {
      navMenu.classList.remove('active');
      document.body.classList.remove('menu-open');
      const icon = mobileMenuBtn?.querySelector<HTMLElement>('.mobile-menu-icon');
      if (icon) {
        icon.textContent = '☰';
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', initNav);
document.addEventListener('astro:page-load', initNav);
