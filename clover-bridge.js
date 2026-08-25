const http = require("http");

const PORT = Number(process.env.PORT || 8787);
const CLOVER_BASE_URL = process.env.CLOVER_BASE_URL || "";
let CLOVER_ACCESS_TOKEN = process.env.CLOVER_ACCESS_TOKEN || "";
const CLOVER_DEVICE_ID = process.env.CLOVER_DEVICE_ID || "";
const CLOVER_APP_ID = process.env.CLOVER_APP_ID || "";
const CLOVER_APP_SECRET = process.env.CLOVER_APP_SECRET || "";
const CLOVER_OAUTH_AUTHORIZE_URL = process.env.CLOVER_OAUTH_AUTHORIZE_URL || "https://www.clover.com/oauth/v2/authorize";
const CLOVER_OAUTH_TOKEN_URL = process.env.CLOVER_OAUTH_TOKEN_URL || "https://api.clover.com/oauth/v2/token";
const CLOVER_REDIRECT_URL = process.env.CLOVER_REDIRECT_URL || "http://localhost:8787/oauth/callback";
const POS_ID = process.env.POS_ID || "GloominGrowPOS-Station1";

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  response.end(JSON.stringify(data));
}

function requireCloverConfig() {
  const missing = [];

  if (!CLOVER_BASE_URL) missing.push("CLOVER_BASE_URL");
  if (!CLOVER_ACCESS_TOKEN) missing.push("CLOVER_ACCESS_TOKEN");
  if (!CLOVER_DEVICE_ID) missing.push("CLOVER_DEVICE_ID");

  if (missing.length) {
    throw new Error("Missing Clover settings: " + missing.join(", "));
  }
}

function requireOAuthConfig() {
  const missing = [];

  if (!CLOVER_APP_ID) missing.push("CLOVER_APP_ID");
  if (!CLOVER_APP_SECRET) missing.push("CLOVER_APP_SECRET");

  if (missing.length) {
    throw new Error("Missing Clover OAuth settings: " + missing.join(", "));
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

function getHeaders(idempotencyKey) {
  return {
    "User-Agent": "GloominGrowPOS/1.0",
    "Authorization": "Bearer " + CLOVER_ACCESS_TOKEN,
    "Accept": "application/json",
    "Content-Type": "application/json",
    "X-Clover-Device-Id": CLOVER_DEVICE_ID,
    "X-POS-Id": POS_ID,
    "X-Clover-Timeout": "180",
    "Idempotency-Key": idempotencyKey
  };
}

function getCloverBaseCandidates() {
  const cleanBase = CLOVER_BASE_URL.replace(/\/$/, "");
  const withoutConnect = cleanBase.replace(/\/connect$/i, "");
  const candidates = [cleanBase];

  if (withoutConnect !== cleanBase) {
    candidates.push(withoutConnect);
  } else {
    candidates.push(cleanBase + "/connect");
  }

  return [...new Set(candidates)];
}

function isInvalidUriResponse(status, data) {
  const message = String(data?.message || data?.error || data?.raw || "");
  return status === 404 && message.toLowerCase().includes("invalid uri");
}

async function callClover(path, payload, idempotencyKey, method = "POST") {
  requireCloverConfig();
  const baseCandidates = getCloverBaseCandidates();
  let lastError = null;

  for (const baseUrl of baseCandidates) {
    const url = baseUrl + path;

    console.log("Sending Clover request:", {
      method,
      url,
      deviceId: CLOVER_DEVICE_ID,
      posId: POS_ID,
      idempotencyKey,
      amount: payload?.amount,
      tipAmount: payload?.tipAmount
    });

    const response = await fetch(url, {
      method,
      headers: getHeaders(idempotencyKey),
      body: payload ? JSON.stringify(payload) : undefined
    });

    const text = await response.text();
    let data = {};

    try {
      data = text ? JSON.parse(text) : {};
    } catch (error) {
      data = { raw: text };
    }

    console.log("Clover response:", {
      status: response.status,
      statusText: response.statusText,
      body: data
    });

    if (response.ok) {
      return data;
    }

    const message = data.message || data.error || data.raw || "Clover request failed";
    lastError = new Error("Clover " + response.status + ": " + message);
    lastError.statusCode = response.status;
    lastError.cloverBody = data;

    if (!isInvalidUriResponse(response.status, data)) {
      throw lastError;
    }
  }

  throw lastError || new Error("Clover request failed");
}

async function handlePing(request, response) {
  const cloverResponse = await callClover(
    "/v1/device/ping",
    null,
    "gg-ping-" + Date.now(),
    "POST"
  );

  sendJson(response, 200, {
    ok: true,
    response: cloverResponse
  });
}

function handleOAuthStart(request, response) {
  requireOAuthConfig();

  const authorizeUrl = new URL(CLOVER_OAUTH_AUTHORIZE_URL);
  authorizeUrl.searchParams.set("client_id", CLOVER_APP_ID);
  authorizeUrl.searchParams.set("redirect_uri", CLOVER_REDIRECT_URL);
  authorizeUrl.searchParams.set("response_type", "code");

  response.writeHead(302, {
    Location: authorizeUrl.toString()
  });
  response.end();
}

async function handleOAuthCallback(request, response) {
  requireOAuthConfig();

  const requestUrl = new URL(request.url, "http://localhost:" + PORT);
  const code = requestUrl.searchParams.get("code");
  const merchantId = requestUrl.searchParams.get("merchant_id");

  if (!code) {
    sendJson(response, 400, { error: "Clover did not return an authorization code." });
    return;
  }

  const tokenResponse = await fetch(CLOVER_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify({
      client_id: CLOVER_APP_ID,
      client_secret: CLOVER_APP_SECRET,
      code
    })
  });

  const tokenBody = await tokenResponse.json().catch(() => ({}));

  if (!tokenResponse.ok || !tokenBody.access_token) {
    sendJson(response, tokenResponse.status || 500, {
      error: "Could not exchange Clover OAuth code for token.",
      cloverBody: tokenBody
    });
    return;
  }

  CLOVER_ACCESS_TOKEN = tokenBody.access_token;

  console.log("Clover OAuth connected:", {
    merchantId,
    accessTokenExpiration: tokenBody.access_token_expiration,
    refreshTokenExpiration: tokenBody.refresh_token_expiration
  });

  response.writeHead(200, {
    "Content-Type": "text/html"
  });
  response.end(`
    <html>
      <body style="font-family: Arial, sans-serif; max-width: 720px; margin: 60px auto; line-height: 1.5;">
        <h1>Clover connected</h1>
        <p>Your OAuth access token is loaded into the running Clover bridge.</p>
        <p>Keep the PowerShell bridge window open, then test <a href="/api/clover/ping">device ping</a>.</p>
        <p>Merchant: ${merchantId || "connected"}</p>
      </body>
    </html>
  `);
}

function normalizePayment(cloverResponse) {
  const payment = cloverResponse.payment || cloverResponse;
  const card = payment.cardTransaction || {};

  return {
    result: payment.result || "SUCCESS",
    paymentId: payment.id,
    amount: payment.amount,
    tipAmount: payment.tipAmount || 0,
    total: Number(payment.amount || 0) + Number(payment.tipAmount || 0),
    cardholderName: card.cardholderName || card.vaultedCard?.cardholderName || "",
    cardType: card.cardType || "",
    last4: card.last4 || card.vaultedCard?.last4 || "",
    authCode: card.authCode || "",
    raw: cloverResponse
  };
}

async function handlePayment(request, response) {
  const body = await readRequestBody(request);
  const amount = Number(body.amount || 0);

  if (!amount || amount < 1) {
    sendJson(response, 400, { error: "Payment amount is required." });
    return;
  }

  const externalPaymentId = body.externalPaymentId || "gg-" + Date.now();
  const cloverResponse = await callClover(
    "/v1/payments",
    {
      amount,
      capture: true,
      final: false,
      externalPaymentId
    },
    externalPaymentId
  );

  sendJson(response, 200, normalizePayment(cloverResponse));
}

async function handleTipAdjust(request, response) {
  const body = await readRequestBody(request);
  const paymentId = body.paymentId;
  const tipAmount = Number(body.tipAmount || 0);

  if (!paymentId) {
    sendJson(response, 400, { error: "paymentId is required." });
    return;
  }

  const idempotencyKey = (body.externalPaymentId || paymentId) + "-tip-" + tipAmount;
  const cloverResponse = await callClover(
    "/v1/payments/" + encodeURIComponent(paymentId) + "/tip-adjust",
    { tipAmount },
    idempotencyKey
  );

  sendJson(response, 200, normalizePayment(cloverResponse));
}

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }

  try {
    if (request.method === "POST" && request.url === "/api/clover/pay") {
      await handlePayment(request, response);
      return;
    }

    if (request.method === "GET" && request.url === "/oauth/start") {
      handleOAuthStart(request, response);
      return;
    }

    if (request.method === "GET" && request.url.startsWith("/oauth/callback")) {
      await handleOAuthCallback(request, response);
      return;
    }

    if (request.method === "GET" && request.url === "/api/clover/ping") {
      await handlePing(request, response);
      return;
    }

    if (request.method === "POST" && request.url === "/api/clover/tip-adjust") {
      await handleTipAdjust(request, response);
      return;
    }

    sendJson(response, 404, { error: "Not found" });
  } catch (error) {
    console.error(error);
    sendJson(response, error.statusCode || 500, {
      error: error.message,
      cloverBody: error.cloverBody || null
    });
  }
});

server.listen(PORT, () => {
  console.log("Clover bridge running at http://localhost:" + PORT);
});
