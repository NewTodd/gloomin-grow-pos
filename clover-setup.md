# Clover Setup For Gloomin Grow POS

This POS now sends card checkout requests to a local Clover bridge at:

```text
http://localhost:8787
```

The browser app should never store the Clover access token or full card number. Clover handles the card on the device and sends back safe receipt fields such as payment ID, card type, cardholder name when available, and last 4.

## What You Need From Clover

1. Create or use a Clover semi-integrated app.
2. Get an OAuth access token for the merchant.
3. Install and open the Pay Display app on the Clover device.
4. Find the Clover device serial number in the device Setup app or Clover dashboard.
5. Pick the correct base URL:

```text
Local device connection example:
https://YOUR-CLOVER-DEVICE-IP:12346/connect

Cloud connection example:
https://api.clover.com/connect

Sandbox cloud example:
https://apisandbox.dev.clover.com/connect
```

## Start The Clover Bridge

Run this from the `NailSalon POS` folder after replacing the values:

```powershell
$env:CLOVER_BASE_URL="https://YOUR-CLOVER-DEVICE-IP:12346/connect"
$env:CLOVER_ACCESS_TOKEN="YOUR_CLOVER_ACCESS_TOKEN"
$env:CLOVER_DEVICE_ID="YOUR_CLOVER_DEVICE_SERIAL_NUMBER"
$env:POS_ID="GloominGrowPOS-Station1"
node clover-bridge.js
```

Then open `index.html` and use:

```text
Pay > Card / Clover
```

The POS will send the service total to Clover, wait for approval, ask the employee for the tip amount, submit the tip adjustment, and save the safe Clover receipt details on the closed ticket.
