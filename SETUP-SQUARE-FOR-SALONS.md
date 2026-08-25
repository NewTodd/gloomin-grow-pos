# Square Terminal Setup Guide For Salon POS

Use this guide when setting up Gloomin Grow POS, or a future salon POS bundle, with a Square Terminal.

This setup connects the browser POS to Square Terminal through a small local bridge:

```text
POS checkout screen -> local Square bridge -> Square API -> Square Terminal
```

The POS never stores full card numbers, CVV, or raw card data. It only stores safe receipt details returned by Square, such as payment ID, receipt URL, card brand, and last 4.

## What The Salon Needs

- A Square account for the salon.
- A Square Terminal connected to Wi-Fi.
- A Square Developer application.
- A Square production access token.
- A paired Terminal API device ID.
- A Windows computer running the POS.

## Step 1: Create A Square Developer App

1. Go to:

```text
https://developer.squareup.com/apps
```

2. Sign in with the salon's Square account.

3. Click **Create Application**.

4. Suggested app name:

```text
Salon POS Terminal
```

or:

```text
Gloomin Grow POS
```

5. Open the app after it is created.

## Step 2: Confirm App Permissions

In the Square Developer app, make sure the access token/app has permission for:

```text
DEVICE_CREDENTIAL_MANAGEMENT
PAYMENTS_READ
PAYMENTS_WRITE
```

If permissions are changed after copying a token, copy/generate the production access token again.

## Step 3: Copy The Production Access Token

1. In the Square Developer app, open **Credentials**.
2. Select **Production**, not Sandbox.
3. Copy the **Production Access Token**.

Do not send this token in text messages or chat. Treat it like a password.

## Step 4: Start The Square Bridge

Open PowerShell and go to the POS folder:

```powershell
cd "C:\Users\toddv\Desktop\NailSalon POS"
```

Set the Square token:

```powershell
$env:SQUARE_ENVIRONMENT="production"
$env:SQUARE_ACCESS_TOKEN="PASTE_PRODUCTION_ACCESS_TOKEN_HERE"
```

Start the bridge:

```powershell
node square-bridge.js
```

Leave this PowerShell window open.

The bridge should say:

```text
Square bridge running at http://localhost:8788
```

## Step 5: Confirm The Bridge Is Running

Open this in Chrome:

```text
http://localhost:8788/api/payments/square/status
```

Expected result:

```json
{
  "ok": true,
  "environment": "production",
  "tokenConfigured": true
}
```

## Step 6: Create A Terminal API Device Code

Open this in Chrome:

```text
http://localhost:8788/api/payments/square/device-code/create
```

The response will include:

```text
code
id
status
location_id
```

Example:

```json
{
  "deviceCode": {
    "id": "0GKY...",
    "code": "DDRZMX",
    "product_type": "TERMINAL_API",
    "status": "UNPAIRED"
  }
}
```

The `code` is what you enter on the Square Terminal.

Important:

- The code expires quickly, usually about 5 minutes.
- If it expires, create a fresh code using the same URL.
- Use only the code created by the local bridge or Square Devices API.
- Do not use a Square Dashboard device code for Terminal API pairing.

## Step 7: Pair The Square Terminal

On the Square Terminal:

1. Connect the Terminal to Wi-Fi.
2. Sign out completely if it is already signed in.
3. Restart the Terminal if needed.
4. Choose the sign-in option for:

```text
Device code
Pair with POS
Connected mode
Use a device code
```

5. Enter the 6-character code from Step 6.

The Terminal must be paired in Terminal API / Connected Mode, not regular employee passcode mode.

## Step 8: Check Pairing Status

Open this in Chrome:

```text
http://localhost:8788/api/payments/square/device-code/status
```

Refresh until it shows:

```text
"status": "PAIRED"
```

When paired, copy the:

```text
device_id
```

or the value shown as:

```text
useThisDeviceIdWhenPaired
```

This paired `device_id` is used for payments.

## Step 9: Restart The Bridge With The Paired Device ID

In PowerShell, stop the bridge:

```powershell
Ctrl + C
```

Set the paired device ID:

```powershell
$env:SQUARE_DEVICE_ID="PASTE_PAIRED_DEVICE_ID_HERE"
```

Start the bridge again:

```powershell
node square-bridge.js
```

## Step 10: Test A POS Checkout

Open the POS:

```text
C:\Users\toddv\Desktop\NailSalon POS\index.html
```

Then:

1. Click an employee.
2. Add one service.
3. Click **Pay**.
4. Tap **Square**.
5. Tap **Send to Square**.
6. Let the customer choose a tip on the Square Terminal.
7. Complete payment on the Square Terminal.

The POS should close the ticket and save safe Square payment details.
The POS tip box is for cash, gift, and loyalty checkouts. For Square card payments, the tip comes from the Square Terminal so the customer can choose it directly.

If the customer or employee cancels from the POS checkout screen, the POS sends a cancel request to the active Square Terminal checkout so the Terminal returns to the idle screen.

Square receipt detail:

- The POS sends a short service summary to Square on every checkout.
- For a fully itemized Square receipt, set `SQUARE_LOCATION_ID` before starting `square-bridge.js`.
- Without `SQUARE_LOCATION_ID`, Square may show the payment as a custom amount, but the POS itemized receipt still shows services, technician, tip, discount, card fee, and total.

## Common Errors

### `Merchant not authorized for device_id`

The value in `SQUARE_DEVICE_ID` is wrong or not paired to this app/token.

Fix:

- Do not use the Terminal serial number.
- Create a fresh device code.
- Pair the Terminal.
- Use the paired `device_id`.

### `Login failed` or `Incorrect code` on Terminal

Likely causes:

- The code expired.
- The Terminal is on the wrong sign-in screen.
- The Terminal is still in normal Square POS mode.
- The token is missing `DEVICE_CREDENTIAL_MANAGEMENT`.
- The Terminal is tied to a different Square account/location.

Fix:

- Sign out completely.
- Restart the Terminal.
- Create a fresh code.
- Enter the code on the **Device code / Connected mode / Pair with POS** screen.

### `tokenConfigured: false`

The bridge does not have `SQUARE_ACCESS_TOKEN`.

Fix:

```powershell
$env:SQUARE_ACCESS_TOKEN="PASTE_PRODUCTION_ACCESS_TOKEN_HERE"
node square-bridge.js
```

### Terminal Does Not Show Payment

Check:

- `square-bridge.js` is running.
- `SQUARE_DEVICE_ID` is the paired Terminal API device ID.
- Terminal is online.
- POS uses **Pay > Square > Send to Square**.
- PowerShell does not show an API error.

## Future Multi-Processor Design

The POS should keep payment processors as adapters:

```text
POS Checkout
Payment Adapter
Square / Clover / Stripe / Cash / Manual
```

Each processor should return the same safe payment result shape:

```text
approved
processor
payment ID
receipt URL
card brand
last 4
tip amount
```

This keeps the salon POS flexible for future clients who prefer Square, Clover, Stripe, or another processor.
