const ADMIN_EMAIL = 'fqmun790@gmail.com';
const SHEET_NAME = 'FQMUN Registrations';
const FOLDER_NAME = 'FQMUN Payment Proofs';

function doGet() {
  return json_({ ok: true, service: 'FQMUN registration', status: 'online' });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    if (!e || !e.postData || !e.postData.contents) throw new Error('Empty request');
    const data = JSON.parse(e.postData.contents);
    validate_(data);
    const ss = getSpreadsheet_();
    const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
    ensureHeaders_(sheet);
    const registrationId = nextRegistrationId_(sheet);
    const proof = savePaymentProof_(data.paymentScreenshot, registrationId);
    sheet.appendRow([registrationId,new Date(),data.fullName,data.email,data.phone,data.location,data.committee,'Pending Review',proof.url,data.paymentFileName || 'payment-screenshot.jpg']);
    sendAdminEmail_(data, registrationId, proof.url, ss.getUrl());
    return json_({ok:true,registrationId:registrationId,message:'Registration submitted successfully.'});
  } catch (err) {
    return json_({ok:false,error:String(err.message || err)});
  } finally {
    lock.releaseLock();
  }
}

function getSpreadsheet_() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty('SPREADSHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  const ss = SpreadsheetApp.create('FQMUN 2026 — Delegate Registrations');
  const sheet = ss.getSheets()[0];
  sheet.setName(SHEET_NAME);
  ensureHeaders_(sheet);
  props.setProperty('SPREADSHEET_ID', ss.getId());
  return ss;
}

function ensureHeaders_(sheet) {
  const headers = ['Registration ID','Submitted At','Full Name','Email','WhatsApp / Phone','City / Country','Committee','Status','Payment Proof','Original File Name'];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    sheet.getRange(1,1,1,headers.length).setFontWeight('bold');
  }
}

function nextRegistrationId_(sheet) {
  return 'FQMUN-' + String(Math.max(1,sheet.getLastRow())).padStart(3,'0');
}

function savePaymentProof_(dataUrl, registrationId) {
  const match = String(dataUrl || '').match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) throw new Error('Invalid payment screenshot.');
  const bytes = Utilities.base64Decode(match[2]);
  if (bytes.length > 4 * 1024 * 1024) throw new Error('Payment screenshot is too large.');
  const props = PropertiesService.getScriptProperties();
  let folderId = props.getProperty('FOLDER_ID');
  let folder = folderId ? DriveApp.getFolderById(folderId) : DriveApp.createFolder(FOLDER_NAME);
  if (!folderId) props.setProperty('FOLDER_ID', folder.getId());
  const blob = Utilities.newBlob(bytes, match[1], registrationId + '-payment.jpg');
  const file = folder.createFile(blob);
  return {id:file.getId(),url:file.getUrl()};
}

function sendAdminEmail_(data, registrationId, proofUrl, sheetUrl) {
  const subject = 'New FQMUN Registration — ' + registrationId;
  const body = ['A new FQMUN delegate registration has been received.','',
    'Registration ID: '+registrationId,'Name: '+data.fullName,'Email: '+data.email,
    'WhatsApp / Phone: '+data.phone,'City / Country: '+data.location,'Committee: '+data.committee,
    'Payment: PKR 500 — Easypaisa','','Payment proof: '+proofUrl,'Registration sheet: '+sheetUrl,
    '','Status: Pending Review'].join('\n');
  MailApp.sendEmail(ADMIN_EMAIL, subject, body);
}

function validate_(data) {
  ['fullName','email','phone','location','committee','paymentScreenshot'].forEach(function(k){if(!data[k]) throw new Error('Missing required field: '+k);});
  const committees=['PNA — Pakistan National Assembly','UNSC — United Nations Security Council','UNHRC — United Nations Human Rights Council'];
  if (committees.indexOf(data.committee) === -1) throw new Error('Invalid committee.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)) throw new Error('Invalid email address.');
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
