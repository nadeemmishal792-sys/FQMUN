const REGISTRATION_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwnUSLioKlBZrLepPmkrQh9Qgnwb1LfzgyQGNR-MutuyUgeo8jn8plXd_3B81sgRULN/exec';

const form = document.getElementById('registrationForm');
const fileInput = document.getElementById('paymentProof');
const dropzone = document.getElementById('dropzone');
const fileName = document.getElementById('fileName');
const message = document.getElementById('formMessage');
const committeeSelect = document.getElementById('committeeSelect');
const personalityField = document.getElementById('personalityField');
const personalityPreference = document.getElementById('personalityPreference');

const typeAnchor = committeeSelect?.parentElement;

if (typeAnchor && form && !document.getElementById('registrationType')) {
  const wrap = document.createElement('label');
  wrap.innerHTML = `Registration type
    <select name="registrationType" id="registrationType" required>
      <option value="Individual Delegate" selected>Individual Delegate</option>
      <option value="Delegation">Delegation — 5 delegates, PKR 500 total</option>
      <option value="Observer">Observer</option>
    </select>`;
  typeAnchor.parentNode.insertBefore(wrap, typeAnchor);
}

const registrationType = document.getElementById('registrationType');

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

if (typeAnchor) typeAnchor.parentNode.insertBefore(extraFields, typeAnchor);

function setRequired(name, required) {
  const el = form?.elements[name];
  if (el) el.required = required;
}

function updateRegistrationUI() {
  const type = registrationType?.value || 'Individual Delegate';
  const delegation = type === 'Delegation';
  const observer = type === 'Observer';
  const individual = type === 'Individual Delegate';

  document.getElementById('delegationFields').style.display = delegation ? 'block' : 'none';
  document.getElementById('observerFields').style.display = observer ? 'block' : 'none';

  ['fullName','email','phone'].forEach(name => setRequired(name, !delegation));
  setRequired('committee', !observer);
  setRequired('countryPreference', individual);
  setRequired('personalityPreference', individual && committeeSelect.value === 'PNA — Pakistan National Assembly');

  for (let n = 1; n <= 5; n++) {
    setRequired(`delegate${n}Name`, delegation);
    setRequired(`delegate${n}Email`, delegation);
    setRequired(`delegate${n}Phone`, delegation);
  }

  const paymentText = document.querySelector('#payment .payment-box p:not(.eyebrow)');
  if (paymentText) {
    paymentText.textContent = delegation
      ? 'Delegation registration: PKR 500 total for the complete 5-member delegation. Upload the payment screenshot below.'
      : 'Registration fee: PKR 500. Send the fee through Easypaisa, then upload your payment screenshot below.';
  }
}

registrationType?.addEventListener('change', updateRegistrationUI);

function showFile() {
  const f = fileInput.files[0];
  fileName.textContent = f ? `Selected: ${f.name}` : '';
}

fileInput.addEventListener('change', showFile);

committeeSelect.addEventListener('change', () => {
  const isPNA = committeeSelect.value === 'PNA — Pakistan National Assembly';
  personalityField.style.display = isPNA ? 'block' : 'none';
  personalityPreference.required = isPNA && registrationType.value === 'Individual Delegate';
  if (!isPNA) personalityPreference.value = '';
});

['dragenter','dragover'].forEach(e => dropzone.addEventListener(e, x => x.preventDefault()));
['dragleave','drop'].forEach(e => dropzone.addEventListener(e, x => x.preventDefault()));
dropzone.addEventListener('drop', e => {
  const f = e.dataTransfer.files;
  if (f.length) { fileInput.files = f; showFile(); }
});

function toDataURL(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

function field(name) {
  const el = form.elements[name];
  return el ? el.value.trim() : '';
}

async function buildPayload(file) {
  const type = field('registrationType') || 'Individual Delegate';
  const payload = {
    registrationType: type,
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

form.addEventListener('submit', async e => {
  e.preventDefault();
  message.className = 'form-message';
  message.textContent = '';

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const f = fileInput.files[0];
  if (!f || f.size > 4 * 1024 * 1024) {
    message.className = 'form-message error';
    message.textContent = 'Please upload a payment screenshot smaller than 4 MB.';
    return;
  }

  const b = form.querySelector('.submit');
  b.disabled = true;
  b.textContent = 'Submitting…';

  try {
    const payload = await buildPayload(f);
    const r = await fetch(REGISTRATION_ENDPOINT, {
      method: 'POST',
      headers: {'Content-Type': 'text/plain;charset=utf-8'},
      body: JSON.stringify(payload)
    });
    const d = await r.json();
    if (!d.ok) throw Error(d.error || 'Registration could not be submitted.');

    message.className = 'form-message success';
    message.textContent = `Registration successful! Your ID is ${d.registrationId}. Keep your payment receipt.`;
    form.reset();
    fileName.textContent = '';
    personalityField.style.display = 'none';
    personalityPreference.required = false;
    registrationType.value = 'Individual Delegate';
    updateRegistrationUI();
  } catch (err) {
    message.className = 'form-message error';
    message.textContent = err.message || 'Registration could not be submitted. Please try again.';
  } finally {
    b.disabled = false;
    b.innerHTML = 'Submit registration <span>↗</span>';
  }
});

updateRegistrationUI();

const countdown = document.getElementById('countdown');
function updateCountdown() {
  if (!countdown) return;
  const target = new Date('2026-08-26T00:00:00+05:00').getTime();
  const now = Date.now();
  const diff = target - now;
  if (diff <= 0) { countdown.textContent = 'FQMUN IS LIVE'; return; }
  const d = Math.floor(diff / 86400000);
  const h = Math.floor(diff % 86400000 / 3600000);
  const m = Math.floor(diff % 3600000 / 60000);
  const s = Math.floor(diff % 60000 / 1000);
  countdown.textContent = `${d}d ${h}h ${m}m ${s}s`;
}
updateCountdown();
setInterval(updateCountdown, 1000);

document.querySelectorAll('[data-copy]').forEach(btn => btn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(btn.dataset.copy);
    const old = btn.textContent;
    btn.textContent = 'Copied ✓';
    setTimeout(() => btn.textContent = old, 1500);
  } catch (e) {}
}));
