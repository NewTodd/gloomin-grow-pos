# Square Terminal Setup For Gloomin Grow POS

This POS now has a Square payment bridge at:

```text
http://localhost:8788
```

When you choose **Credit** in checkout, the POS sends the amount due to Square Terminal, waits for approval, then saves safe receipt details such as Square payment ID, receipt URL, card brand, and last 4.

The POS should never store full card numbers, CVV, or raw card data.

## What You Need From Square

1. A Square developer application.
2. A production access token from that Square app.
3. Your Square Terminal paired to your Square account.
4. The Square Terminal device ID.

## Pair / Find The Terminal Device ID

In Square Developer Dashboard:

1. Open your Square application.
2. Go to **Terminal** or use the Terminal API to create a device code.
3. Enter the device code on the Square Terminal to pair it.
4. Copy the resulting `device_id`.

## Start The Square Bridge

Open PowerShell in:

```text
C:\Users\toddv\Desktop\NailSalon POS
```

Then run:

```powershell
$env:SQUARE_ENVIRONMENT="production"
$env:SQUARE_ACCESS_TOKEN="PASTE_YOUR_SQUARE_ACCESS_TOKEN_HERE"
$env:SQUARE_DEVICE_ID="PASTE_YOUR_SQUARE_TERMINAL_DEVICE_ID_HERE"
node square-bridge.js
```

Leave that PowerShell window open. It should say:

```text
Square bridge running at http://localhost:8788
```

## Test The Bridge

Open:

```text
http://localhost:8788/api/payments/square/status
```

You should see:

```json
{"ok":true}
```

Then use the POS:

```text
Employee > add services > Pay > Credit > Close Ticket
```

The Square Terminal should show the checkout amount.
