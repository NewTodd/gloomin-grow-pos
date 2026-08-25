const http = require("http");
const fs = require("fs");
const path = require("path");

function loadLocalEnvFile() {
  const envPath = path.join(__dirname, ".env");

  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;

    const equalIndex = trimmed.indexOf("=");
    if (equalIndex === -1) return;

    const key = trimmed.slice(0, equalIndex).trim();
    let value = trimmed.slice(equalIndex + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (key && !process.env[key]) {
      process.env[key] = value;
    }
  });
}

loadLocalEnvFile();

function saveLocalEnvValue(key, value) {
  const envPath = path.join(__dirname, ".env");
  let lines = [];

  if (fs.existsSync(envPath)) {
    lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/).filter(Boolean);
  }

  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const keyPattern = new RegExp("^\\s*" + escapedKey + "=");
  const nextLines = lines.filter(line => !keyPattern.test(line));
  nextLines.push(key + "=" + value);
  fs.writeFileSync(envPath, nextLines.join("\n") + "\n", "utf8");
}

const PORT = Number(process.env.PORT || 8788);
const SQUARE_ACCESS_TOKEN = process.env.SQUARE_ACCESS_TOKEN || "";
let SQUARE_DEVICE_ID = process.env.SQUARE_DEVICE_ID || "";
const SQUARE_ENVIRONMENT = (process.env.SQUARE_ENVIRONMENT || "production").toLowerCase();
const SQUARE_VERSION = process.env.SQUARE_VERSION || "2026-01-22";
const SQUARE_CURRENCY = process.env.SQUARE_CURRENCY || "USD";
let SQUARE_LOCATION_ID = process.env.SQUARE_LOCATION_ID || "";
const SQUARE_BASE_URL = SQUARE_ENVIRONMENT === "sandbox"
  ? "https://connect.squareupsandbox.com"
  : "https://connect.squareup.com";
let lastDeviceCodeId = "";
let activeCheckoutId = "";

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  response.end(JSON.stringify(data));
}

function sendHtml(response, statusCode, html) {
  response.writeHead(statusCode, {
    "Content-Type": "text/html; charset=utf-8",
    "Access-Control-Allow-Origin": "*"
  });
  response.end(html);
}

function requireSquareToken() {
  if (!SQUARE_ACCESS_TOKEN) {
    throw new Error("Missing Square settings: SQUARE_ACCESS_TOKEN");
  }
}

function requireSquareConfig() {
  const missing = [];

  if (!SQUARE_ACCESS_TOKEN) missing.push("SQUARE_ACCESS_TOKEN");
  if (!SQUARE_DEVICE_ID) missing.push("SQUARE_DEVICE_ID");

  if (missing.length) {
    throw new Error("Missing Square settings: " + missing.join(", "));
  }
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", chunk => {
      body += chunk;
    });

    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

function getSquareHeaders() {
  return {
    "Authorization": "Bearer " + SQUARE_ACCESS_TOKEN,
    "Square-Version": SQUARE_VERSION,
    "Content-Type": "application/json",
    "Accept": "application/json"
  };
}

async function callSquare(path, options = {}) {
  requireSquareConfig();

  const url = SQUARE_BASE_URL + path;
  const method = options.method || "GET";

  console.log("Sending Square request:", {
    method,
    url,
    deviceId: SQUARE_DEVICE_ID,
    amount: options.body?.checkout?.amount_money?.amount
  });

  const response = await fetch(url, {
    method,
    headers: getSquareHeaders(),
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const text = await response.text();
  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch (error) {
    data = { raw: text };
  }

  console.log("Square response:", {
    status: response.status,
    statusText: response.statusText,
    body: JSON.stringify(data, null, 2)
  });

  if (!response.ok) {
    const message = data.errors?.map(error => error.detail || error.code).join("; ") ||
      data.message ||
      data.raw ||
      "Square request failed";
    const error = new Error("Square " + response.status + ": " + message);
    error.statusCode = response.status;
    error.squareBody = data;
    console.error("Square error details:", JSON.stringify(data, null, 2));
    throw error;
  }

  return data;
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function createIdempotencyKey() {
  return "gg-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10);
}

function formatCents(amount) {
  return "$" + (Number(amount || 0) / 100).toFixed(2);
}

function buildCheckoutNote(body) {
  const items = Array.isArray(body.items) ? body.items : [];
  const itemSummary = items
    .slice(0, 4)
    .map(item => item.name + " " + formatCents(item.amount))
    .join("; ");
  const extraCount = Math.max(0, items.length - 4);
  const adjustments = [];

  if (Number(body.discountAmount || 0) > 0) {
    adjustments.push("Discount -" + formatCents(body.discountAmount));
  }

  if (Number(body.cardFeeAmount || 0) > 0) {
    adjustments.push("Card Fee " + formatCents(body.cardFeeAmount));
  }

  return [
    itemSummary || body.note || "Gloomin Grow POS checkout",
    extraCount ? "+" + extraCount + " more" : "",
    adjustments.join("; ")
  ].filter(Boolean).join("; ").slice(0, 500);
}

async function createSquareOrder(body) {
  const items = Array.isArray(body.items) ? body.items : [];

  if (!SQUARE_LOCATION_ID || items.length === 0) {
    return "";
  }

  const order = {
    location_id: SQUARE_LOCATION_ID,
    line_items: items.map((item, index) => ({
      name: String(item.name || "Service").slice(0, 255),
      note: item.technician ? "Provided by " + String(item.technician).slice(0, 120) : undefined,
      quantity: "1",
      base_price_money: {
        amount: Number(item.amount || 0),
        currency: SQUARE_CURRENCY
      },
      uid: "service_" + index
    }))
  };

  if (Number(body.discountAmount || 0) > 0) {
    order.discounts = [{
      uid: "pos_discount",
      name: "POS Discount",
      type: "FIXED_AMOUNT",
      amount_money: {
        amount: Number(body.discountAmount || 0),
        currency: SQUARE_CURRENCY
      },
      scope: "ORDER"
    }];
  }

  if (Number(body.cardFeeAmount || 0) > 0) {
    order.service_charges = [{
      uid: "card_fee",
      name: "Card Fee",
      amount_money: {
        amount: Number(body.cardFeeAmount || 0),
        currency: SQUARE_CURRENCY
      },
      calculation_phase: "TOTAL_PHASE",
      taxable: false
    }];
  }

  const squareResponse = await callSquare("/v2/orders", {
    method: "POST",
    body: {
      idempotency_key: body.orderIdempotencyKey || createIdempotencyKey(),
      order
    }
  });

  return squareResponse.order?.id || "";
}

async function getPaymentDetails(paymentId) {
  if (!paymentId) return null;

  const paymentResponse = await callSquare("/v2/payments/" + encodeURIComponent(paymentId));
  const payment = paymentResponse.payment || {};
  const card = payment.card_details?.card || {};

  return {
    paymentId: payment.id || paymentId,
    status: payment.status || "",
    receiptNumber: payment.receipt_number || "",
    receiptUrl: payment.receipt_url || "",
    cardBrand: card.card_brand || "",
    last4: card.last_4 || "",
    cardholderName: card.cardholder_name || "",
    amountMoney: payment.amount_money || null,
    tipMoney: payment.tip_money || null,
    totalMoney: payment.total_money || null,
    raw: payment
  };
}

async function waitForCheckout(checkoutId) {
  const startedAt = Date.now();
  const timeoutMs = 5 * 60 * 1000;

  while (Date.now() - startedAt < timeoutMs) {
    const response = await callSquare("/v2/terminals/checkouts/" + encodeURIComponent(checkoutId));
    const checkout = response.checkout || {};

    if (["COMPLETED", "CANCELED", "CANCEL_REQUESTED"].includes(checkout.status)) {
      return checkout;
    }

    await wait(2000);
  }

  throw new Error("Square checkout timed out waiting for the Terminal.");
}

function normalizeSquareResult(checkout, paymentDetails) {
  return {
    result: checkout.status === "COMPLETED" ? "SUCCESS" : checkout.status,
    processor: "Square",
    checkoutId: checkout.id,
    referenceId: checkout.reference_id || "",
    paymentId: paymentDetails?.paymentId || checkout.payment_ids?.[0] || "",
    receiptNumber: paymentDetails?.receiptNumber || "",
    receiptUrl: paymentDetails?.receiptUrl || "",
    cardType: paymentDetails?.cardBrand || "",
    last4: paymentDetails?.last4 || "",
    cardholderName: paymentDetails?.cardholderName || "",
    amount: checkout.amount_money?.amount || paymentDetails?.amountMoney?.amount || 0,
    tipAmount: paymentDetails?.tipMoney?.amount || 0,
    total: paymentDetails?.totalMoney?.amount || checkout.amount_money?.amount || 0,
    raw: {
      checkout,
      payment: paymentDetails?.raw || null
    }
  };
}

async function handleSquareCheckout(request, response) {
  const body = await readRequestBody(request);
  const amount = Number(body.amount || 0);

  if (!amount || amount < 1) {
    sendJson(response, 400, { error: "Payment amount is required." });
    return;
  }

  const referenceId = String(body.referenceId || createIdempotencyKey()).slice(0, 40);
  const note = buildCheckoutNote(body);
  let orderId = "";

  try {
    orderId = await createSquareOrder(body);
  } catch (error) {
    console.error("Could not create Square order, continuing with amount checkout:", error.message);
  }

  const checkoutResponse = await callSquare("/v2/terminals/checkouts", {
    method: "POST",
    body: {
      idempotency_key: body.idempotencyKey || createIdempotencyKey(),
      checkout: {
        amount_money: {
          amount,
          currency: SQUARE_CURRENCY
        },
        reference_id: referenceId,
        note,
        ...(orderId ? { order_id: orderId } : {}),
        device_options: {
          device_id: SQUARE_DEVICE_ID,
          tip_settings: {
            allow_tipping: true,
            separate_tip_screen: true,
            custom_tip_field: true,
            tip_percentages: [15, 18, 20]
          },
          skip_receipt_screen: false
        }
      }
    }
  });

  const createdCheckout = checkoutResponse.checkout;
  activeCheckoutId = createdCheckout.id;

  try {
    const completedCheckout = await waitForCheckout(createdCheckout.id);
    const paymentDetails = await getPaymentDetails(completedCheckout.payment_ids?.[0]);

    sendJson(response, 200, normalizeSquareResult(completedCheckout, paymentDetails));
  } finally {
    if (activeCheckoutId === createdCheckout.id) {
      activeCheckoutId = "";
    }
  }
}

async function handleCancelSquareCheckout(request, response) {
  if (!activeCheckoutId) {
    sendJson(response, 200, {
      ok: true,
      canceled: false,
      message: "No active Square checkout."
    });
    return;
  }

  const checkoutId = activeCheckoutId;
  const squareResponse = await callSquare(
    "/v2/terminals/checkouts/" + encodeURIComponent(checkoutId) + "/cancel",
    {
      method: "POST",
      body: {}
    }
  );

  sendJson(response, 200, {
    ok: true,
    canceled: true,
    checkout: squareResponse.checkout || null
  });
}

async function handleSquareStatus(request, response) {
  sendJson(response, 200, {
    ok: true,
    environment: SQUARE_ENVIRONMENT,
    baseUrl: SQUARE_BASE_URL,
    deviceConfigured: Boolean(SQUARE_DEVICE_ID),
    deviceId: SQUARE_DEVICE_ID ? SQUARE_DEVICE_ID.slice(0, 4) + "..." + SQUARE_DEVICE_ID.slice(-4) : "",
    locationConfigured: Boolean(SQUARE_LOCATION_ID),
    locationId: SQUARE_LOCATION_ID,
    tokenConfigured: Boolean(SQUARE_ACCESS_TOKEN)
  });
}

async function getSquareLocations() {
  const squareResponse = await callSquare("/v2/locations", { requireDevice: false });
  return (squareResponse.locations || []).filter(location => location.status !== "INACTIVE");
}

async function handleSquareLocations(request, response) {
  const locations = await getSquareLocations();

  sendJson(response, 200, {
    ok: true,
    locations: locations.map(location => ({
      id: location.id,
      name: location.name,
      status: location.status,
      address: location.address || null
    }))
  });
}

async function createDeviceCodeForPairing(requestedLocationId = "") {
  const locations = await getSquareLocations();
  const locationId = requestedLocationId || SQUARE_LOCATION_ID || locations[0]?.id || "";
  const deviceCode = {
    name: "Gloomin Grow Terminal 1",
    product_type: "TERMINAL_API"
  };

  if (locationId) {
    SQUARE_LOCATION_ID = locationId;
    saveLocalEnvValue("SQUARE_LOCATION_ID", locationId);
    deviceCode.location_id = locationId;
  }

  const squareResponse = await callSquare("/v2/devices/codes", {
    method: "POST",
    requireDevice: false,
    body: {
      idempotency_key: createIdempotencyKey(),
      device_code: deviceCode
    }
  });

  return { ...squareResponse, locationUsed: locationId, availableLocations: locations };
}

async function handleCreateDeviceCode(request, response) {
  const requestUrl = new URL(request.url, "http://localhost:" + PORT);
  const requestedLocationId = requestUrl.searchParams.get("locationId") || "";
  const pairResult = await createDeviceCodeForPairing(requestedLocationId);
  const squareResponse = pairResult;
  const locationId = pairResult.locationUsed;
  const locations = pairResult.availableLocations;

  lastDeviceCodeId = squareResponse.device_code?.id || "";

  sendJson(response, 200, {
    ok: true,
    instructions: [
      "On the Square Terminal, sign out if needed.",
      "Choose Device Code / Pair with POS / Connected mode.",
      "Enter the code shown below before it expires.",
      "Then refresh /api/payments/square/device-code/status until status is PAIRED."
    ],
    locationUsed: locationId,
    availableLocations: locations.map(location => ({ id: location.id, name: location.name })),
    deviceCode: squareResponse.device_code
  });
}

async function handleDeviceCodeStatus(request, response) {
  const requestUrl = new URL(request.url, "http://localhost:" + PORT);
  const deviceCodeId = requestUrl.searchParams.get("id") || lastDeviceCodeId;

  if (!deviceCodeId) {
    sendJson(response, 400, {
      error: "No device code id. Open /api/payments/square/device-code/create first."
    });
    return;
  }

  const squareResponse = await callSquare("/v2/devices/codes/" + encodeURIComponent(deviceCodeId), { requireDevice: false });
  const deviceCode = squareResponse.device_code || {};
  const pairedDeviceId = deviceCode.status === "PAIRED" ? deviceCode.device_id : "";

  if (pairedDeviceId) {
    SQUARE_DEVICE_ID = pairedDeviceId;
    saveLocalEnvValue("SQUARE_DEVICE_ID", pairedDeviceId);
  }

  sendJson(response, 200, {
    ok: true,
    deviceCode,
    savedDeviceId: Boolean(pairedDeviceId),
    useThisDeviceIdWhenPaired: pairedDeviceId
  });
}

async function handleSquarePairPage(request, response) {
  const squareResponse = await createDeviceCodeForPairing();
  const deviceCode = squareResponse.device_code || {};
  lastDeviceCodeId = deviceCode.id || "";
  const pairBy = deviceCode.pair_by ? new Date(deviceCode.pair_by).toLocaleTimeString() : "";
  const code = deviceCode.code || "No code";
  const statusUrl = "/api/payments/square/device-code/status?id=" + encodeURIComponent(deviceCode.id || "");

  sendHtml(response, 200, `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Pair Square Terminal</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: Arial, sans-serif; background: #111827; color: white; }
    main { width: min(760px, calc(100vw - 32px)); background: #1f2a44; border: 1px solid #415178; border-radius: 18px; padding: 32px; box-shadow: 0 24px 60px rgba(0,0,0,.35); }
    h1 { margin: 0 0 12px; font-size: 34px; }
    .code { margin: 24px 0; padding: 28px; border-radius: 16px; background: #f8fafc; color: #111827; font-size: clamp(52px, 12vw, 104px); font-weight: 900; text-align: center; letter-spacing: .12em; }
    .steps { display: grid; gap: 10px; color: #d7def5; font-size: 19px; line-height: 1.45; }
    .status { margin-top: 22px; padding: 16px; border-radius: 12px; background: #111827; color: #38f2c2; font-size: 20px; font-weight: 800; }
    .small { color: #aeb9db; margin-top: 12px; font-size: 15px; }
    button { margin-top: 18px; border: 0; border-radius: 12px; padding: 14px 18px; font-size: 18px; font-weight: 800; cursor: pointer; background: #38f2c2; color: #111827; }
  </style>
</head>
<body>
  <main>
    <h1>Pair Square Terminal</h1>
    <div class="steps">
      <div>1. On the Square Terminal, open the Device Code / Pair with POS screen.</div>
      <div>2. Type this code before it expires${pairBy ? " at " + pairBy : ""}.</div>
      <div>3. Leave this page open. It will save the device automatically after pairing.</div>
    </div>
    <div class="code">${code}</div>
    <div id="status" class="status">Waiting for Terminal to pair...</div>
    <button onclick="location.reload()">Get New Code</button>
    <div class="small">If Terminal says incorrect, use Get New Code and make sure the Terminal is on the Terminal API / Pair with POS screen.</div>
  </main>
  <script>
    async function checkStatus() {
      try {
        const response = await fetch("${statusUrl}");
        const data = await response.json();
        const status = data.deviceCode && data.deviceCode.status ? data.deviceCode.status : "UNKNOWN";
        const statusBox = document.getElementById("status");
        if (status === "PAIRED") {
          statusBox.textContent = "PAIRED. Device saved. You can take payments now.";
          statusBox.style.color = "#38f2c2";
          return;
        }
        statusBox.textContent = "Status: " + status + ". Waiting...";
        setTimeout(checkStatus, 2500);
      } catch (error) {
        document.getElementById("status").textContent = "Could not check status. Is the bridge still running?";
        setTimeout(checkStatus, 4000);
      }
    }
    checkStatus();
  </script>
</body>
</html>`);
}

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }

  try {
    if (request.method === "GET" && request.url === "/api/payments/square/status") {
      await handleSquareStatus(request, response);
      return;
    }

    if (request.method === "GET" && request.url === "/api/payments/square/locations") {
      await handleSquareLocations(request, response);
      return;
    }

    if (request.method === "GET" && request.url === "/api/payments/square/pair") {
      await handleSquarePairPage(request, response);
      return;
    }

    if (request.method === "GET" && request.url === "/api/payments/square/device-code/create") {
      await handleCreateDeviceCode(request, response);
      return;
    }

    if (request.method === "GET" && request.url.startsWith("/api/payments/square/device-code/status")) {
      await handleDeviceCodeStatus(request, response);
      return;
    }

    if (request.method === "POST" && request.url === "/api/payments/square/checkout") {
      await handleSquareCheckout(request, response);
      return;
    }

    if (request.method === "POST" && request.url === "/api/payments/square/cancel") {
      await handleCancelSquareCheckout(request, response);
      return;
    }

    sendJson(response, 404, { error: "Not found" });
  } catch (error) {
    console.error(error);
    sendJson(response, error.statusCode || 500, {
      error: error.message,
      squareBody: error.squareBody || null
    });
  }
});

server.listen(PORT, () => {
  console.log("Square bridge running at http://localhost:" + PORT);
});






