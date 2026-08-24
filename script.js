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

/* FQMUN WHATSAPP COMMUNITY + COMMITTEE QR HUB */
(function addWhatsAppCommunityHub() {
  const hub = document.querySelector('#hub');
  const grid = hub?.querySelector('.announcement-grid');
  if (!hub || !grid || hub.querySelector('.whatsapp-community-panel')) return;

  const groups = [
    {
      name: 'Official FQMUN Community',
      tag: 'MAIN COMMUNITY',
      url: 'https://chat.whatsapp.com/Fig9CTzId9GDIOcQ0ZSc8Z'
    },
    {
      name: 'UNSC',
      tag: 'COMMITTEE GROUP',
      url: 'https://chat.whatsapp.com/JYpRCVMajkQEbmNosdQkRD?s=qt&p=a&mlu=4'
    },
    {
      name: 'UNHRC',
      tag: 'COMMITTEE GROUP',
      url: 'https://chat.whatsapp.com/H688YczVwyKBYvnvNbOSNG?s=qt&p=a&mlu=4'
    },
    {
      name: 'PNA',
      tag: 'COMMITTEE GROUP',
      url: 'https://chat.whatsapp.com/H3YI6v12bZn7uxkKqxeHE8?s=qt&p=a&mlu=4'
    }
  ];

  const panel = document.createElement('div');
  panel.className = 'whatsapp-community-panel';
  panel.style.cssText = [
    'margin-top:28px',
    'padding:34px',
    'border:1px solid rgba(255,191,25,.24)',
    'background:linear-gradient(145deg,rgba(141,6,16,.28),rgba(7,3,4,.98))',
    'box-shadow:0 18px 50px rgba(0,0,0,.28)'
  ].join(';');

  const title = document.createElement('div');
  title.innerHTML = `
    <div style="font-size:9px;letter-spacing:2px;font-weight:700;color:#ffbf19;margin-bottom:10px">OFFICIAL WHATSAPP ACCESS</div>
    <h3 style="font:700 clamp(28px,4vw,44px) 'Playfair Display';color:#ffe27a;margin:0 0 10px">Join the FQMUN <em style="color:#ffbf19">community.</em></h3>
    <p style="color:#cfc09d;margin:0 0 24px;max-width:760px;font-size:14px">Join the official FQMUN WhatsApp Community first, then enter the WhatsApp group for your allocated committee. Scan the QR code or use the button below.</p>
  `;
  panel.appendChild(title);

  const cards = document.createElement('div');
  cards.style.cssText = 'display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;';

  groups.forEach((group, index) => {
    const card = document.createElement('div');
    card.style.cssText = 'background:rgba(255,255,255,.97);color:#101010;border:1px solid rgba(255,191,25,.35);padding:16px;display:flex;flex-direction:column;align-items:center;text-align:center;min-height:300px;';

    const qr = document.createElement('img');
    qr.alt = `${group.name} WhatsApp QR code`;
    qr.loading = 'lazy';
    qr.width = 210;
    qr.height = 210;
    qr.style.cssText = 'width:min(100%,210px);height:auto;aspect-ratio:1/1;object-fit:contain;background:#fff;margin:4px auto 14px;';
    qr.src = 'https://api.qrserver.com/v1/create-qr-code/?size=420x420&margin=12&data=' + encodeURIComponent(group.url);
    card.appendChild(qr);

    const tag = document.createElement('div');
    tag.textContent = group.tag;
    tag.style.cssText = 'font-size:8px;letter-spacing:1.5px;font-weight:800;color:#8d0610;margin-bottom:5px;';
    card.appendChild(tag);

    const name = document.createElement('div');
    name.textContent = group.name;
    name.style.cssText = 'font:700 20px "Playfair Display",serif;color:#111;margin-bottom:12px;';
    card.appendChild(name);

    const link = document.createElement('a');
    link.href = group.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = index === 0 ? 'Join Community ↗' : `Join ${group.name} ↗`;
    link.style.cssText = 'margin-top:auto;display:inline-flex;align-items:center;justify-content:center;width:100%;padding:10px 12px;background:linear-gradient(135deg,#ffe27a,#ffbf19);color:#230305;text-decoration:none;font-size:11px;font-weight:800;';
    card.appendChild(link);

    cards.appendChild(card);
  });

  panel.appendChild(cards);

  const note = document.createElement('p');
  note.innerHTML = '<strong style="color:#ffe27a">Important:</strong> Only join the committee group that matches your final allocation. The main FQMUN Community is for official conference-wide updates.';
  note.style.cssText = 'margin:18px 0 0;color:#bcae8a;font-size:11px;';
  panel.appendChild(note);

  grid.insertAdjacentElement('afterend', panel);

  const responsive = document.createElement('style');
  responsive.textContent = '@media (max-width:900px){.whatsapp-community-panel>div:nth-child(2){grid-template-columns:repeat(2,minmax(0,1fr))!important}}@media (max-width:560px){.whatsapp-community-panel{padding:20px!important}.whatsapp-community-panel>div:nth-child(2){grid-template-columns:1fr!important}}';
  document.head.appendChild(responsive);
})();
