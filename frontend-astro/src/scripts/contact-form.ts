export {};

const STATIC_INTEREST_OPTIONS = [
  { slug: 'cybersecurity-services',       label: 'Cybersecurity' },
  { slug: 'it-security-and-continuity',   label: 'IT Security' },
  { slug: 'endpoint-management-services', label: 'Endpoint Management' },
  { slug: 'core-industry-services',       label: 'Core Industry Services' },
  { slug: 'training',                     label: 'Training' },
  { slug: 'general-inquiry',              label: 'General Inquiry' },
];

function populateSelect(select: HTMLSelectElement, options: Array<{ slug: string; label: string }>) {
  select.innerHTML = '<option value="" disabled selected></option>';
  options.forEach(opt => {
    const el = document.createElement('option');
    el.value = opt.slug;
    el.textContent = opt.label;
    select.appendChild(el);
  });
}

async function loadInterestOptions(apiBase: string, select: HTMLSelectElement) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(`${apiBase}/api/v1/public/site/contact-profile`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const profile = await res.json();
    const options: Array<{ slug: string; label: string }> = profile.interest_options ?? [];
    if (options.length === 0) throw new Error('empty');
    populateSelect(select, options);
  } catch {
    clearTimeout(timer);
    populateSelect(select, STATIC_INTEREST_OPTIONS);
  }
}

/** Reads UTM params and page context for attribution tracking. */
function getTrackingFields() {
  const params = new URLSearchParams(window.location.search);
  return {
    source_page: window.location.pathname,
    referrer_url: document.referrer || undefined,
    utm_source:   params.get('utm_source')   || undefined,
    utm_medium:   params.get('utm_medium')   || undefined,
    utm_campaign: params.get('utm_campaign') || undefined,
    utm_content:  params.get('utm_content')  || undefined,
    utm_term:     params.get('utm_term')     || undefined,
  };
}

function initContactForm() {
  const form        = document.getElementById('contact-form')  as HTMLFormElement | null;
  const statusDiv   = document.getElementById('form-status')   as HTMLDivElement | null;
  const submitBtn   = document.getElementById('submit-btn')    as HTMLButtonElement | null;
  const subjectSel  = document.getElementById('subject')       as HTMLSelectElement | null;

  if (!form || !statusDiv || !submitBtn) return;
  if (form.dataset.cfInit) return;
  form.dataset.cfInit = '1';

  const submitText = submitBtn.querySelector('.cf-submit-text') as HTMLElement | null;

  // API base: '' means same-origin (nginx proxy); a URL means dev/explicit backend.
  // The meta tag always exists (baked in by BaseLayout), so we always try the API.
  const metaTag  = document.querySelector('meta[name="cyberfyx-api-base"]');
  const apiBase  = metaTag?.getAttribute('content') ?? '';

  // Load interest options into the select (non-blocking)
  if (subjectSel) loadInterestOptions(apiBase, subjectSel);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    submitBtn.disabled = true;
    if (submitText) submitText.textContent = 'Submitting...';
    statusDiv.style.display = 'none';

    try {
      const fd = new FormData(form);
      const payload = {
        name:         fd.get('name'),
        email:        fd.get('email'),
        interest_slug: fd.get('subject'),
        message:      fd.get('message'),
        ...getTrackingFields(),
      };

      const response = await fetch(`${apiBase}/api/v1/public/inquiries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        form.reset();
        if (subjectSel) loadInterestOptions(apiBase, subjectSel);
        statusDiv.textContent = 'Thank you! Your inquiry has been submitted successfully.';
        statusDiv.style.backgroundColor = 'rgba(98, 151, 132, 0.1)';
        statusDiv.style.color = 'var(--accent-soft)';
        statusDiv.style.display = 'block';
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (err) {
      console.error('Submission error:', err);
      statusDiv.innerHTML =
        'There was an error submitting your request. ' +
        'Please try again or <a href="mailto:sales@cyberfyx.net">email us directly</a>.';
      statusDiv.style.backgroundColor = 'rgba(255, 107, 53, 0.1)';
      statusDiv.style.color = 'var(--accent-tertiary)';
      statusDiv.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
      if (submitText) submitText.textContent = 'Send Message';
    }
  });
}

document.addEventListener('DOMContentLoaded', initContactForm);
document.addEventListener('astro:page-load', initContactForm);
