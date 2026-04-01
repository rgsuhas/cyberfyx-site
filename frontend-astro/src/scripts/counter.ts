// Counter Animation Script for Stats Section
export function initCounters() {
  const counters = document.querySelectorAll<HTMLElement>('.counter');
  
  const observerOptions = {
    threshold: 0.5,
    rootMargin: '0px'
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const counter = entry.target as HTMLElement;
        const target = parseInt(counter.getAttribute('data-target') || '0', 10);
        
        // Only animate if not already animated
        if (counter.getAttribute('data-animated') !== 'true') {
          animateCounter(counter, target);
          counter.setAttribute('data-animated', 'true');
        }
      }
    });
  }, observerOptions);

  counters.forEach(counter => observer.observe(counter));
}

function animateCounter(element: HTMLElement, target: number) {
  const duration = 2000; // 2 seconds
  const start = 0;
  const startTime = performance.now();

  const animate = (currentTime: number) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Easing function - ease-out effect
    const easeProgress = 1 - Math.pow(1 - progress, 3);
    
    const current = Math.floor(start + (target - start) * easeProgress);
    
    element.textContent = current.toString();

    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  };

  requestAnimationFrame(animate);
}

// Initialize when script loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCounters);
} else {
  initCounters();
}
