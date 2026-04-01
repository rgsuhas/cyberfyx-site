export {};

const STATIC_INTEREST_OPTIONS = [
  { slug: 'cybersecurity-services', label: 'Cybersecurity' },
  { slug: 'it-security-and-continuity', label: 'IT Security' },
  { slug: 'endpoint-management-services', label: 'Endpoint Management' },
  { slug: 'core-industry-services', label: 'Core Industry Services' },
  { slug: 'training', label: 'Training' },
  { slug: 'general-inquiry', label: 'General Inquiry' },
];

const FIELD_MESSAGES: Record<string, { required: string; invalid?: string }> = {
  name: {
    required: 'Please fill out this field.',
  },
  email: {
    required: 'Please fill out this field.',
    invalid: 'Please enter a valid email address.',
  },
  subject: {
    required: 'Please select an item in the list.',
  },
  message: {
    required: 'Please fill out this field.',
  },
};

function populateSelect(select: HTMLSelectElement, options: Array<{ slug: string; label: string }>) {
  const currentValue = select.value;
  select.innerHTML = '<option value="" disabled selected></option>';
  options.forEach(opt => {
    const el = document.createElement('option');
    el.value = opt.slug;
    el.textContent = opt.label;
    if (currentValue && currentValue === opt.slug) {
      el.selected = true;
    }
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

function getTrackingFields() {
  const params = new URLSearchParams(window.location.search);
  return {
    source_page: window.location.pathname,
    referrer_url: document.referrer || undefined,
    utm_source: params.get('utm_source') || undefined,
    utm_medium: params.get('utm_medium') || undefined,
    utm_campaign: params.get('utm_campaign') || undefined,
    utm_content: params.get('utm_content') || undefined,
    utm_term: params.get('utm_term') || undefined,
  };
}

function ensureStatusElement(form: HTMLFormElement) {
  let statusDiv = form.querySelector('#form-status, [data-form-status]') as HTMLDivElement | null;
  if (statusDiv) return statusDiv;

  statusDiv = document.createElement('div');
  statusDiv.className = 'cf-status';
  statusDiv.dataset.formStatus = 'public';
  statusDiv.style.display = 'none';
  statusDiv.style.marginTop = '1rem';
  const submitBtn = form.querySelector('#submit-btn, button[type="submit"]');
  if (submitBtn?.parentElement === form) {
    form.insertBefore(statusDiv, submitBtn);
  } else {
    form.appendChild(statusDiv);
  }

  return statusDiv;
}

function getFieldContainer(field: HTMLElement) {
  return field.closest('.cf-field, .form-group') as HTMLElement | null;
}

function getFieldWarning(field: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) {
  const container = getFieldContainer(field) ?? field.parentElement;
  if (!container) return null;

  return container.querySelector('[data-field-warning]') as HTMLDivElement | null;
}

function setFieldError(
  field: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  message?: string,
) {
  const container = getFieldContainer(field);

  field.classList.add('field-invalid');
  field.setAttribute('aria-invalid', 'true');
  container?.classList.add('field-has-error');
  if (message) {
    field.setCustomValidity(message);
  }
}

function clearFieldError(field: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) {
  const warning = getFieldWarning(field);
  const container = getFieldContainer(field);

  field.classList.remove('field-invalid');
  field.removeAttribute('aria-invalid');
  field.setCustomValidity('');
  container?.classList.remove('field-has-error');

  if (warning) {
    warning.textContent = '';
    warning.style.display = 'none';
  }
}

function getValidationMessage(field: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) {
  const config = FIELD_MESSAGES[field.name] ?? {
    required: 'Required field.',
    invalid: 'Invalid value.',
  };

  if (field.validity.valueMissing) return config.required;
  if (field.validity.typeMismatch || field.validity.patternMismatch) {
    return config.invalid ?? 'Please enter a valid value.';
  }

  return 'Check this field.';
}

function syncNativeValidation(field: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) {
  clearFieldError(field);

  if (field.validity.valueMissing) {
    setFieldError(field, getValidationMessage(field));
    return false;
  }

  if (field.validity.typeMismatch || field.validity.patternMismatch) {
    setFieldError(field, getValidationMessage(field));
    return false;
  }

  return true;
}

function validateField(field: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement) {
  return syncNativeValidation(field);
}

function validateForm(form: HTMLFormElement): {
  valid: boolean;
  firstInvalidField: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
} {
  const fields = Array.from(
    form.querySelectorAll('input, select, textarea')
  ) as Array<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>;

  let firstInvalidField: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null = null;

  fields.forEach(field => {
    if (!validateField(field) && !firstInvalidField) {
      firstInvalidField = field;
    }
  });

  return { valid: firstInvalidField === null, firstInvalidField };
}

function initContactForm(form: HTMLFormElement) {
  if (form.dataset.cfInit) return;
  form.dataset.cfInit = '1';

  const statusDiv = ensureStatusElement(form);
  const submitBtn = form.querySelector('#submit-btn, button[type="submit"]') as HTMLButtonElement | null;
  const subjectSel = form.querySelector('#subject, select[name="subject"]') as HTMLSelectElement | null;
  if (!submitBtn) return;

  const submitText = submitBtn.querySelector('.cf-submit-text') as HTMLElement | null;
  const defaultSubmitText = (submitText?.textContent ?? submitBtn.textContent ?? 'Send Message').trim();

  const metaTag = document.querySelector('meta[name="cyberfyx-api-base"]');
  const apiBase = metaTag?.getAttribute('content') ?? '';

  if (subjectSel) {
    void loadInterestOptions(apiBase, subjectSel);
  }

  const fields = Array.from(
    form.querySelectorAll('input, select, textarea')
  ) as Array<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>;

  fields.forEach(field => {
    const eventName = field.tagName === 'SELECT' ? 'change' : 'input';
    field.addEventListener(eventName, () => {
      validateField(field);
    });
    field.addEventListener('blur', () => {
      validateField(field);
    });
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const { valid, firstInvalidField } = validateForm(form);
    if (!valid) {
      statusDiv.style.display = 'none';
      if (firstInvalidField) {
        firstInvalidField.reportValidity();
      }
      return;
    }

    submitBtn.disabled = true;
    if (submitText) {
      submitText.textContent = 'Submitting...';
    } else {
      submitBtn.textContent = 'Submitting...';
    }
    statusDiv.style.display = 'none';

    try {
      const fd = new FormData(form);
      const payload = {
        name: fd.get('name'),
        email: fd.get('email'),
        interest_slug: fd.get('subject'),
        message: fd.get('message'),
        ...getTrackingFields(),
      };

      const response = await fetch(`${apiBase}/api/v1/public/inquiries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      form.reset();
      fields.forEach(field => clearFieldError(field));
      if (subjectSel) {
        void loadInterestOptions(apiBase, subjectSel);
      }
      statusDiv.textContent = 'Your inquiry has been received. The Cyberfyx team will review it shortly.';
      statusDiv.style.backgroundColor = 'rgba(236, 240, 238, 0.95)';
      statusDiv.style.color = '#1f2933';
      statusDiv.style.border = '1px solid rgba(31, 41, 51, 0.05)';
      statusDiv.style.display = 'block';
    } catch (err) {
      console.error('Submission error:', err);
      statusDiv.innerHTML =
        'There was an error submitting your request. ' +
        'Please try again or <a href="mailto:sales@cyberfyx.net">email us directly</a>.';
      statusDiv.style.backgroundColor = 'rgba(255, 107, 53, 0.1)';
      statusDiv.style.color = 'var(--accent-tertiary)';
      statusDiv.style.border = '1px solid rgba(255, 107, 53, 0.18)';
      statusDiv.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
      if (submitText) {
        submitText.textContent = defaultSubmitText;
      } else {
        submitBtn.textContent = defaultSubmitText;
      }
    }
  });
}

function initContactForms() {
  const forms = Array.from(
    document.querySelectorAll('form[data-inquiry-form="public"], form#contact-form')
  ) as HTMLFormElement[];

  forms.forEach(form => initContactForm(form));
}

document.addEventListener('DOMContentLoaded', initContactForms);
document.addEventListener('astro:page-load', initContactForms);
