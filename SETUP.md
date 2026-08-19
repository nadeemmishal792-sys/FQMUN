# FQMUN REAL REGISTRATION SETUP

The website is prepared to send real registrations to Google Apps Script. The backend is in `apps-script/Code.gs`.

## One-time setup

1. Sign in to the Google account **fqmun790@gmail.com**.
2. Open Google Apps Script and create a new project.
3. Copy everything from `apps-script/Code.gs` in this repository into the Apps Script editor.
4. Save the project.
5. Deploy it as **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Authorize the requested Google permissions for Sheets, Drive and Mail.
7. Copy the generated Web app URL ending in `/exec`.
8. Open `script.js` in this repository and replace:
   `PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE`
   with the Web app URL.
9. Commit the change.

## What happens after setup

A delegate submits:
- Full name
- Email
- WhatsApp / phone
- City / country
- Committee (PNA / UNSC / UNHRC)
- Payment screenshot

The Apps Script backend will automatically:
- create a Google Sheet called **FQMUN 2026 — Delegate Registrations**;
- create a Drive folder called **FQMUN Payment Proofs**;
- assign an ID such as **FQMUN-001**;
- store the registration details and payment-proof link;
- set the status to **Pending Review**;
- email **fqmun790@gmail.com** with the registration details and links.

Do not put passwords, OTPs, Easypaisa PINs, or private banking credentials in this repository.
