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

function setStatus(
  statusDiv: HTMLDivElement,
  kind: 'success' | 'error',
  message: string,
  allowHtml = false,
) {
  if (allowHtml) {
    statusDiv.innerHTML = message;
  } else {
    statusDiv.textContent = message;
  }

  statusDiv.style.backgroundColor =
    kind === 'success' ? 'rgba(98, 151, 132, 0.1)' : 'rgba(255, 107, 53, 0.1)';
  statusDiv.style.color = kind === 'success' ? 'var(--accent-soft)' : 'var(--accent-tertiary)';
  statusDiv.style.display = 'block';
}

function getStringField(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

async function getErrorMessage(response: Response) {
  try {
    const payload = await response.json();
    const detailMessages = Array.isArray(payload?.error?.details)
      ? payload.error.details
          .map((detail: { message?: unknown }) => (typeof detail?.message === 'string' ? detail.message : ''))
          .filter(Boolean)
      : [];

    if (typeof payload?.error?.message === 'string' && payload.error.message) {
      return detailMessages.length > 0
        ? `${payload.error.message} ${detailMessages.join(' ')}`
        : payload.error.message;
    }
  } catch {
    // Ignore non-JSON error bodies and fall through to the generic message.
  }

  return `There was an error submitting your request (${response.status}).`;
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
    statusDiv.style.display = 'none';

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const fd = new FormData(form);
    const payload = {
      name: getStringField(fd, 'name'),
      email: getStringField(fd, 'email'),
      interest_slug: getStringField(fd, 'subject'),
      message: getStringField(fd, 'message'),
      ...getTrackingFields(),
    };

    if (!payload.name || !payload.email || !payload.interest_slug || !payload.message) {
      setStatus(statusDiv, 'error', 'Please complete all required fields before submitting.');
      return;
    }

    submitBtn.disabled = true;
    if (submitText) submitText.textContent = 'Submitting...';

    try {
      const response = await fetch(`${apiBase}/api/v1/public/inquiries`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const responseBody = await response.json().catch(() => null);
        form.reset();
        if (subjectSel) loadInterestOptions(apiBase, subjectSel);
        setStatus(
          statusDiv,
          'success',
          typeof responseBody?.message === 'string' && responseBody.message
            ? responseBody.message
            : 'Thank you! Your inquiry has been submitted successfully.',
        );
      } else {
        throw new Error(await getErrorMessage(response));
      }
    } catch (err) {
      console.error('Submission error:', err);
      const message =
        err instanceof Error && err.message
          ? `${err.message} If the issue continues, <a href="mailto:sales@cyberfyx.net">email us directly</a>.`
          : 'There was an error submitting your request. Please try again or <a href="mailto:sales@cyberfyx.net">email us directly</a>.';
      setStatus(statusDiv, 'error', message, true);
    } finally {
      submitBtn.disabled = false;
      if (submitText) submitText.textContent = 'Send Message';
    }
  });
}

document.addEventListener('DOMContentLoaded', initContactForm);
document.addEventListener('astro:page-load', initContactForm);
