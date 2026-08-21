const REGISTRATION_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwnUSLioKlBZrLepPmkrQh9Qgnwb1LfzgyQGNR-MutuyUgeo8jn8plXd_3B81sgRULN/exec';

const form = document.getElementById('registrationForm');
const fileInput = document.getElementById('paymentProof');
const dropzone = document.getElementById('dropzone');
const fileName = document.getElementById('fileName');
const message = document.getElementById('formMessage');
const committeeSelect = document.getElementById('committeeSelect');
const personalityField = document.getElementById('personalityField');
const personalityPreference = document.getElementById('personalityPreference');
const registrationType = document.getElementById('registrationType');

const REGISTRATION_TYPE_MAP = {
  individual: 'Individual Delegate',
  delegation: 'Delegation',
  observer: 'Observer',
  'Individual Delegate': 'Individual Delegate',
  Delegation: 'Delegation',
  Observer: 'Observer'
};

const extraFields = document.createElement('div');
extraFields.id = 'registrationExtraFields';
extraFields.innerHTML = `
  <div id="delegationFields" style="display:none">
    <div class="field-grid">
      <label>Delegation name<input name="delegationName" type="text" placeholder="Your delegation name"></label>
    </div>
    <p><strong>Delegation fee: PKR 500 TOTAL for all 5 delegates.</strong></p>
    <div class="field-grid">
      ${[1,2,3,4,5].map(n => `
        <label>Delegate ${n} name<input name="delegate${n}Name" type="text" placeholder="Delegate ${n} full name"></label>
        <label>Delegate ${n} email<input name="delegate${n}Email" type="email" placeholder="Delegate ${n} email"></label>
        <label>Delegate ${n} phone<input name="delegate${n}Phone" type="tel" placeholder="03XXXXXXXXX"></label>
      `).join('')}
    </div>
  </div>
  <div id="observerFields" style="display:none">
    <p><strong>Observer registration</strong> — separate from delegate and delegation registration.</p>
  </div>
`;

if (committeeSelect && committeeSelect.parentNode) {
  committeeSelect.parentNode.insertBefore(extraFields, committeeSelect.parentNode.firstChild);
}

function setRequired(name, required) {
  const el = form?.elements[name];
  if (el) el.required = required;
}

function getUiRegistrationType() {
  return registrationType?.value || '';
}

function updateRegistrationUI() {
  const type = getUiRegistrationType();
  const delegation = type === 'delegation';
  const observer = type === 'observer';
  const individual = type === 'individual';

  const delegationFields = document.getElementById('delegationFields');
  const observerFields = document.getElementById('observerFields');
  if (delegationFields) delegationFields.style.display = delegation ? 'block' : 'none';
  if (observerFields) observerFields.style.display = observer ? 'block' : 'none';

  ['fullName', 'email', 'phone'].forEach(name => setRequired(name, !delegation));
  setRequired('committee', !observer);
  setRequired('countryPreference', individual);
  setRequired('personalityPreference', individual && committeeSelect?.value === 'PNA — Pakistan National Assembly');

  for (let n = 1; n <= 5; n++) {
    setRequired(`delegate${n}Name`, delegation);
    setRequired(`delegate${n}Email`, delegation);
    setRequired(`delegate${n}Phone`, delegation);
  }
}

registrationType?.addEventListener('change', updateRegistrationUI);

function showFile() {
  const f = fileInput?.files?.[0];
  if (fileName) fileName.textContent = f ? `Selected: ${f.name}` : '';
}

fileInput?.addEventListener('change', showFile);

committeeSelect?.addEventListener('change', () => {
  const isPNA = committeeSelect.value === 'PNA — Pakistan National Assembly';
  if (personalityField) personalityField.style.display = isPNA ? 'block' : 'none';
  if (personalityPreference) {
    personalityPreference.required = isPNA && getUiRegistrationType() === 'individual';
    if (!isPNA) personalityPreference.value = '';
  }
  updateRegistrationUI();
});

['dragenter', 'dragover'].forEach(eventName => {
  dropzone?.addEventListener(eventName, event => event.preventDefault());
});
['dragleave', 'drop'].forEach(eventName => {
  dropzone?.addEventListener(eventName, event => event.preventDefault());
});
dropzone?.addEventListener('drop', event => {
  const files = event.dataTransfer?.files;
  if (files?.length && fileInput) {
    fileInput.files = files;
    showFile();
  }
});

function toDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function field(name) {
  const el = form?.elements[name];
  return el ? String(el.value || '').trim() : '';
}

async function buildPayload(file) {
  const rawType = field('registrationType');
  const registrationTypeForBackend = REGISTRATION_TYPE_MAP[rawType];
  if (!registrationTypeForBackend) {
    throw new Error('Please select a valid registration type.');
  }

  const payload = {
    registrationType: registrationTypeForBackend,
    fullName: field('fullName'),
    email: field('email'),
    phone: field('phone'),
    location: field('location'),
    committee: field('committee'),
    countryPreference: field('countryPreference'),
    personalityPreference: field('personalityPreference'),
    delegationName: field('delegationName'),
    paymentFileName: file.name,
    paymentScreenshot: await toDataURL(file)
  };

  for (let n = 1; n <= 5; n++) {
    payload[`delegate${n}Name`] = field(`delegate${n}Name`);
    payload[`delegate${n}Email`] = field(`delegate${n}Email`);
    payload[`delegate${n}Phone`] = field(`delegate${n}Phone`);
  }
  return payload;
}

async function readRegistrationResponse(response) {
  const text = await response.text();
  const trimmed = text.trim();

  if (!trimmed) {
    throw new Error('The registration server returned an empty response. Please try again.');
  }

  if (/^<!doctype\s+html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)) {
    throw new Error('The registration server returned a Google HTML page instead of registration data. Please contact the FQMUN admin.');
  }

  let data;
  try {
    data = JSON.parse(trimmed);
  } catch (error) {
    throw new Error('The registration server returned an invalid response. Please try again.');
  }

  return data;
}

form?.addEventListener('submit', async event => {
  event.preventDefault();
  if (!message) return;
  message.className = 'form-message';
  message.textContent = '';

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const file = fileInput?.files?.[0];
  if (!file || file.size > 4 * 1024 * 1024) {
    message.className = 'form-message error';
    message.textContent = 'Please upload a payment screenshot smaller than 4 MB.';
    return;
  }

  const button = form.querySelector('.submit');
  if (button) {
    button.disabled = true;
    button.textContent = 'Submitting…';
  }

  try {
    const payload = await buildPayload(file);
    const response = await fetch(REGISTRATION_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });

    const data = await readRegistrationResponse(response);

    if (!data.ok) {
      throw new Error(data.error || 'Registration could not be submitted.');
    }

    const registrationId = data.registrationId || data.id || data.registrationID;

    if (!registrationId) {
      throw new Error('Registration was received, but no registration ID was returned. Please contact the FQMUN admin before submitting again.');
    }

    message.className = 'form-message success';
    message.textContent = `Registration successful! Your ID is ${registrationId}. Keep your payment receipt.`;
    form.reset();
    if (fileName) fileName.textContent = '';
    if (personalityField) personalityField.style.display = 'none';
    if (personalityPreference) personalityPreference.required = false;
    updateRegistrationUI();
  } catch (error) {
    message.className = 'form-message error';
    message.textContent = error.message || 'Registration could not be submitted. Please try again.';
  } finally {
    if (button) {
      button.disabled = false;
      button.innerHTML = 'Submit registration <span>↗</span>';
    }
  }
});

updateRegistrationUI();

const countdown = document.getElementById('countdown');
function updateCountdown() {
  if (!countdown) return;
  const target = new Date('2026-08-26T00:00:00+05:00').getTime();
  const diff = target - Date.now();
  if (diff <= 0) {
    countdown.textContent = 'FQMUN IS LIVE';
    return;
  }
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  countdown.textContent = `${d}d ${h}h ${m}m ${s}s`;
}
updateCountdown();
setInterval(updateCountdown, 1000);

document.querySelectorAll('[data-copy]').forEach(button => {
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(button.dataset.copy || '');
      const oldText = button.textContent;
      button.textContent = 'Copied ✓';
      setTimeout(() => button.textContent = oldText, 1500);
    } catch (error) {}
  });
});

/* FQMUN STUDY GUIDES + ANNOUNCEMENT HUB */
(function addStudyGuideFeature() {
  const guides = {
    PNA: 'FQMUN_2026_PNA_Study_Guide.pdf',
    UNSC: 'FQMUN_2026_UNSC_Study_Guide.pdf',
    UNHRC: 'FQMUN_2026_UNHRC_Study_Guide.pdf'
  };

  document.querySelectorAll('.committee').forEach(card => {
    const title = card.querySelector('h3');
    if (!title) return;
    const key = title.textContent.trim().toUpperCase();
    const pdf = guides[key];
    if (!pdf || card.querySelector('.study-guide-link')) return;

    const link = document.createElement('a');
    link.className = 'study-guide-link';
    link.href = pdf;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = 'Study Guide PDF ↗';
    link.style.cssText = 'display:inline-block;margin-top:10px;color:#ffbf19;text-decoration:none;font-size:11px;font-weight:700;letter-spacing:.4px;';
    const content = card.querySelector('div');
    if (content) content.appendChild(link);
  });

  const grid = document.querySelector('.announcement-grid');
  if (grid && !grid.querySelector('.study-guide-announcement')) {
    const announcement = document.createElement('article');
    announcement.className = 'announcement featured-announcement study-guide-announcement';
    announcement.innerHTML = `
      <div class="announcement-meta"><span>NEW · STUDY GUIDES</span><time>UPLOADED</time></div>
      <h3>FQMUN committee study guides are now available</h3>
      <p>Official preparation PDFs for PNA, UNSC and UNHRC have been uploaded. Each guide includes committee preparation, research guidance, sample speeches, POIs, rebuttals and drafting examples.</p>
      <a href="study-guides.html">Open the Study Guide Hub ↗</a>
    `;
    grid.insertBefore(announcement, grid.firstChild);
  }
})();
