// api/zendesk-request.js
// Vercel serverless function: relays a Shopify contact form submission to the
// Zendesk Create Request API, targeting a specific ticket form.
//
// Required environment variables (set in Vercel project settings, NOT in code):
//   ZENDESK_SUBDOMAIN     e.g. "ripvan"
//   ZENDESK_USER_EMAIL    email of the API token owner
//   ZENDESK_API_TOKEN     Zendesk API token (secret)
//   RECAPTCHA_SECRET_KEY  Google reCAPTCHA v2 secret (production)
//   ALLOWED_ORIGIN        your storefront origin, e.g. "https://www.ripvan.com"
//   TICKET_FORM_ID        e.g. "48536354155796"
// Optional for local testing only:
//   ALLOW_RECAPTCHA_BYPASS "true" to allow a fixed test token
//   RECAPTCHA_BYPASS_TOKEN token value accepted when bypass is enabled

const axios = require("axios");

module.exports = async (req, res) => {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || "https://www.ripvan.com";
  const bypassEnabled = process.env.ALLOW_RECAPTCHA_BYPASS === "true";
  const bypassToken = process.env.RECAPTCHA_BYPASS_TOKEN || "dev-bypass-token";

  // CORS: only allow the storefront origin
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Vercel parses JSON bodies automatically; guard just in case.
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (e) {
      body = {};
    }
  }

  const {
    name,
    email,
    subject,
    description,
    token, // reCAPTCHA token from the browser
    customFields, // optional: array of { id, value } for Zendesk custom fields
  } = body || {};

  // Basic validation
  if (!name || !email || !subject || !description) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  if (!token) {
    return res.status(400).json({ error: "Missing reCAPTCHA token" });
  }

  // 1) Verify reCAPTCHA
  if (!(bypassEnabled && token === bypassToken)) {
    try {
      const params = new URLSearchParams();
      params.append("secret", process.env.RECAPTCHA_SECRET_KEY);
      params.append("response", token);

      const verify = await axios.post(
        "https://www.google.com/recaptcha/api/siteverify",
        params.toString(),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );

      if (!verify.data || !verify.data.success) {
        return res.status(400).json({ error: "reCAPTCHA verification failed" });
      }
    } catch (e) {
      return res.status(500).json({ error: "reCAPTCHA check error" });
    }
  } else {
    console.warn("Using reCAPTCHA bypass token for local testing");
  }

  // 2) Build the Zendesk Create Request payload
  const requestPayload = {
    request: {
      subject: subject,
      comment: { body: description },
      requester: { name: name, email: email },
      ticket_form_id: Number(process.env.TICKET_FORM_ID),
    },
  };

  // Attach custom fields if the storefront form collected any.
  // Expected shape: [{ id: 123456, value: "abc" }, ...]
  if (Array.isArray(customFields) && customFields.length > 0) {
    requestPayload.request.custom_fields = customFields
      .filter(
        (f) =>
          f && f.id !== undefined && f.value !== undefined && f.value !== ""
      )
      .map((f) => ({ id: Number(f.id), value: f.value }));
  }

  // 3) Relay to Zendesk
  try {
    await axios({
      method: "post",
      url: `https://${process.env.ZENDESK_SUBDOMAIN}.zendesk.com/api/v2/requests.json`,
      headers: { "Content-Type": "application/json" },
      auth: {
        username: `${process.env.ZENDESK_USER_EMAIL}/token`,
        password: process.env.ZENDESK_API_TOKEN,
      },
      data: requestPayload,
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    // Surface Zendesk's status for easier debugging server-side, but keep the
    // client response generic.
    const status = error.response ? error.response.status : "no-response";
    console.error(
      "Zendesk Create Request failed:",
      status,
      error.response && error.response.data
    );
    return res.status(502).json({ error: "Failed to create request" });
  }
};
