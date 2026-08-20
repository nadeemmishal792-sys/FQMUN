/*
 FQMUN 2026 — DELEGATE ALLOCATION BACKEND PATCH

 Add these functions to the SAME Google Apps Script project that contains
 your current Code.gs, then add the adminAssignDelegates case to
 handleAdminRequest_.

 This patch adds 15 allocation columns (5 delegates x committee/country/PNA
 personality), requires the registration to be Verified, prevents duplicate
 country+committee assignments across the whole registration sheet, and
 emails allocated delegates.
*/

function ensureAllocationHeaders_(sheet) {
  const headers = [];
  for (let i = 1; i <= 5; i++) {
    headers.push('Assigned Delegate ' + i + ' Committee');
    headers.push('Assigned Delegate ' + i + ' Country');
    headers.push('Assigned Delegate ' + i + ' PNA Personality');
  }

  const lastColumn = Math.max(1, sheet.getLastColumn());
  const existing = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];

  headers.forEach(function(header) {
    if (existing.indexOf(header) === -1) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header);
    }
  });
}

function allocationCommittees_() {
  return [
    'PNA — Pakistan National Assembly',
    'UNSC — United Nations Security Council',
    'UNHRC — United Nations Human Rights Council'
  ];
}

function allocationCountries_() {
  return [
    'Pakistan', 'United Kingdom', 'United States', 'China', 'Russia',
    'France', 'Germany', 'India', 'Saudi Arabia', 'United Arab Emirates',
    'Türkiye', 'Iran', 'Afghanistan', 'Australia', 'Canada', 'Japan',
    'South Korea', 'Brazil', 'Egypt', 'South Africa'
  ];
}

function allocationPersonalities_() {
  return [
    'Zulfikar Ali Bhutto', 'Benazir Bhutto', 'Nawaz Sharif', 'Imran Khan',
    'Muhammad Khan Junejo', 'Yousaf Raza Gillani', 'Raja Pervaiz Ashraf',
    'Shaukat Aziz', 'Zafarullah Khan Jamali', 'Chaudhry Shujaat Hussain',
    'Aitzaz Ahsan', 'Khurshid Mahmood Kasuri', 'Shah Mahmood Qureshi',
    'Hina Rabbani Khar', 'Sartaj Aziz', 'Khawaja Muhammad Asif', 'Ishaq Dar',
    'Maulana Fazlur Rehman', 'Asfandyar Wali Khan', 'Sheikh Rashid Ahmed'
  ];
}

function adminAssignDelegates_(data) {
  requireAdmin_(data.token);

  const registrationId = String(data.registrationId || '').trim();
  const delegates = Array.isArray(data.delegates) ? data.delegates : [];

  if (!registrationId) throw new Error('Registration ID is required.');
  if (!delegates.length || delegates.length > 5) throw new Error('Invalid delegate allocation.');

  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('Registration sheet not found.');

  ensureHeaders_(sheet);
  ensureAllocationHeaders_(sheet);

  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const idColumn = headers.indexOf('Registration ID');
  const typeColumn = headers.indexOf('Registration Type');
  const statusColumn = headers.indexOf('Status');

  if (idColumn === -1 || typeColumn === -1 || statusColumn === -1) {
    throw new Error('Required registration columns were not found.');
  }

  let targetRow = -1;
  let targetType = '';
  for (let row = 1; row < values.length; row++) {
    if (String(values[row][idColumn]).trim() === registrationId) {
      targetRow = row + 1;
      targetType = String(values[row][typeColumn] || '');
      if (!String(values[row][statusColumn] || '').toLowerCase().includes('verified')) {
        throw new Error('Only Verified registrations can be allocated.');
      }
      break;
    }
  }

  if (targetRow === -1) throw new Error('Registration ID not found.');
  if (targetType === 'Observer') throw new Error('Observers do not receive delegate allocations.');
  if (targetType === 'Individual Delegate' && delegates.length !== 1) {
    throw new Error('Individual Delegate registrations require exactly one allocation.');
  }
  if (targetType === 'Delegation' && delegates.length !== 5) {
    throw new Error('Delegation registrations require exactly five allocations.');
  }

  const committees = allocationCommittees_();
  const countries = allocationCountries_();
  const personalities = allocationPersonalities_();
  const localKeys = {};

  delegates.forEach(function(d, index) {
    const number = Number(d.delegateNumber);
    const committee = String(d.committee || '').trim();
    const country = String(d.country || '').trim();
    const personality = String(d.personality || '').trim();

    if (number !== index + 1) throw new Error('Delegate allocation order is invalid.');
    if (committee && committees.indexOf(committee) === -1) throw new Error('Invalid committee for Delegate ' + number + '.');
    if (countries.indexOf(country) === -1) throw new Error('Invalid country for Delegate ' + number + '.');
    if (committee === 'PNA — Pakistan National Assembly') {
      if (personalities.indexOf(personality) === -1) throw new Error('Invalid PNA personality for Delegate ' + number + '.');
    } else if (personality) {
      throw new Error('PNA personality must be empty for non-PNA delegates.');
    }

    const key = committee + '|' + country;
    if (localKeys[key]) throw new Error('The same country cannot be assigned twice in the same committee within this delegation.');
    localKeys[key] = true;
  });

  /* Prevent the same country from being assigned twice in the same committee
     anywhere else in the registration sheet. */
  for (let row = 1; row < values.length; row++) {
    const otherId = String(values[row][idColumn] || '').trim();
    if (otherId === registrationId) continue;

    for (let i = 1; i <= 5; i++) {
      const cCol = headers.indexOf('Assigned Delegate ' + i + ' Committee');
      const countryCol = headers.indexOf('Assigned Delegate ' + i + ' Country');
      if (cCol === -1 || countryCol === -1) continue;

      const existingCommittee = String(values[row][cCol] || '').trim();
      const existingCountry = String(values[row][countryCol] || '').trim();
      if (!existingCommittee || !existingCountry) continue;

      delegates.forEach(function(d) {
        if (existingCommittee === String(d.committee || '').trim() &&
            existingCountry === String(d.country || '').trim()) {
          throw new Error(existingCountry + ' is already assigned in ' + existingCommittee + '.');
        }
      });
    }
  }

  delegates.forEach(function(d) {
    const n = Number(d.delegateNumber);
    sheet.getRange(targetRow, headers.indexOf('Assigned Delegate ' + n + ' Committee') + 1).setValue(d.committee);
    sheet.getRange(targetRow, headers.indexOf('Assigned Delegate ' + n + ' Country') + 1).setValue(d.country);
    sheet.getRange(targetRow, headers.indexOf('Assigned Delegate ' + n + ' PNA Personality') + 1).setValue(d.personality || '');
  });

  sendAllocationEmail_(sheet, targetRow, headers, targetType, registrationId, delegates);

  return json_({
    ok: true,
    registrationId: registrationId,
    message: 'Delegate allocation saved successfully.'
  });
}

function sendAllocationEmail_(sheet, rowNumber, headers, registrationType, registrationId, delegates) {
  const row = sheet.getRange(rowNumber, 1, 1, sheet.getLastColumn()).getValues()[0];
  const emailColumn = headers.indexOf('Email');
  const recipients = [];

  if (registrationType === 'Individual Delegate' && emailColumn !== -1) {
    const email = String(row[emailColumn] || '').trim();
    if (email) recipients.push(email);
  }

  if (registrationType === 'Delegation') {
    for (let i = 1; i <= 5; i++) {
      const col = headers.indexOf('Delegate ' + i + ' Email');
      if (col !== -1) {
        const email = String(row[col] || '').trim();
        if (email && recipients.indexOf(email) === -1) recipients.push(email);
      }
    }
  }

  if (!recipients.length) return;

  const lines = [
    'FQMUN 2026 — DELEGATE ALLOCATION',
    '',
    'Registration ID: ' + registrationId,
    '',
    'Your FQMUN allocation has been confirmed:',
    ''
  ];

  delegates.forEach(function(d) {
    lines.push(
      'Delegate ' + d.delegateNumber + ': ' +
      d.committee + ' | ' + d.country +
      (d.personality ? ' | PNA Personality: ' + d.personality : '')
    );
  });

  lines.push('', 'Please keep this information for FQMUN 2026.');

  MailApp.sendEmail({
    to: recipients.join(','),
    subject: 'FQMUN 2026 — Allocation Confirmed — ' + registrationId,
    body: lines.join('\n')
  });
}

/* Add this case inside handleAdminRequest_ switch:

    case 'adminAssignDelegates':
      return adminAssignDelegates_(data);

*/

/* Also add this line near the beginning of adminGetData_, after obtaining the sheet:

  ensureAllocationHeaders_(sheet);

*/
