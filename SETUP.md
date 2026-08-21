# FQMUN 2026 — LIVE SYSTEM SETUP

The live FQMUN website uses Google Apps Script as its registration and admin API backend.

## Current live Apps Script endpoint

`https://script.google.com/macros/s/AKfycbwnUSLioKlBZrLepPmkrQh9Qgnwb1LfzgyQGNR-MutuyUgeo8jn8plXd_3B81sgRULN/exec`

The live frontend files are already connected to this exact `/exec` endpoint:

- `script.js` → delegate registration API
- `admin.html` → private admin login/dashboard API

## Important deployment settings

Deploy the Apps Script as a **Web app** with:

- Execute as: **Me**
- Who has access: **Anyone**

After changing `Code.gs`, create a new deployment version (or update the existing deployment) and make sure the `/exec` URL above is the deployment URL being used by the website.

## Admin authentication

The current admin system is designed to use the persistent session implementation in the latest Apps Script code. Do not restore the old `CacheService`-based admin-token implementation.

The admin portal stores the returned session token in the browser and sends it with every admin API request.

## Registration flow

A delegate submits the registration form on the GitHub Pages website. `script.js` sends the registration to the Apps Script endpoint. Apps Script then handles:

- Google Sheet registration storage
- Registration IDs
- Duplicate protection
- Payment proof upload to Google Drive
- Admin notification email
- Delegate confirmation email
- Registration status
- Admin verification/rejection
- Committee/country/personality allocation
- Allocation email
- Registration lookup

## Security

Do not commit admin passwords, Script Properties, private Google credentials, OTPs, payment PINs, or other secrets to this repository.

The Apps Script `Code.gs` should remain in the private Google Apps Script project rather than being published in this public repository.
