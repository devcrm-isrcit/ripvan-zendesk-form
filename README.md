# Zendesk Contact Form for Shopify (Vercel relay)

A native Shopify contact form that creates a Zendesk request against ticket
form `48536354155796`. The browser never sees the Zendesk API token; a small
Vercel serverless function holds it and relays the submission.

## Architecture

Shopify page (Liquid form) -> POST JSON -> Vercel function (`/api/zendesk-request`)
-> Zendesk Create Request API -> ticket created on form 48536354155796.

## Files

- `api/zendesk-request.js` — the Vercel serverless relay.
- `package.json` — declares the `axios` dependency.
- `page.contact-zendesk.liquid` — the Shopify page template (form + JS).

## Values needed from Zendesk (provided by the account admin)

| Key | Value |
| --- | --- |
| ZENDESK_SUBDOMAIN | `ripvan` |
| ZENDESK_USER_EMAIL | email of the API token owner |
| ZENDESK_API_TOKEN | (secret — store in Vercel env vars only) |
| TICKET_FORM_ID | `48536354155796` |

Field list for form `48536354155796` (admin pulls via API and hands over):
for each field — id, type, title, required?, and for dropdowns the option
values (API tag values, not display labels).

## Zendesk prerequisite (must be set, or the relay is rejected)

Anonymous requests must be allowed. In Admin Center, the
**"Require authentication for request and uploads APIs"** option must be
UNCHECKED. Confirm before testing.

## reCAPTCHA

Uses Google reCAPTCHA v2 ("I'm not a robot"). Generate production keys for the
storefront domain at https://www.google.com/recaptcha/admin/create
- Site key -> goes in the Liquid template (`data-sitekey`).
- Secret key -> goes in Vercel env var `RECAPTCHA_SECRET_KEY`.

## Deploy the relay (Vercel)

1. Put `api/zendesk-request.js` and `package.json` in a repo (or a folder) and
   import it into Vercel, or use the Vercel CLI: `vercel` then `vercel --prod`.
2. In Vercel project Settings > Environment Variables, add:
   - `ZENDESK_SUBDOMAIN` = ripvan
   - `ZENDESK_USER_EMAIL` = (token owner email)
   - `ZENDESK_API_TOKEN` = (the token)
   - `RECAPTCHA_SECRET_KEY` = (production secret)
   - `ALLOWED_ORIGIN` = https://www.ripvan.com  (exact storefront origin, no trailing slash)
   - `TICKET_FORM_ID` = 48536354155796
3. Redeploy so the env vars take effect.
4. Note the deployed URL, e.g. `https://your-project.vercel.app`.

## Run locally

### Option 1: Plain Node

1. Install dependencies:
   `npm install`
2. Fill in the real Zendesk and reCAPTCHA values in `.env.local`.
3. Start the local dev server:
   `npm run dev`
4. The relay will be available at:
   `http://localhost:3000/api/zendesk-request`

For local testing, set `ALLOWED_ORIGIN=http://localhost:3000`.
If reCAPTCHA is enabled, make sure your reCAPTCHA keys allow `localhost`, or
test through the deployed storefront instead.

For Postman or local-only testing, you can enable a fixed bypass token in
`.env.local`:
- `ALLOW_RECAPTCHA_BYPASS=true`
- `RECAPTCHA_BYPASS_TOKEN=dev-bypass-token`

Then send `"token": "dev-bypass-token"` in the JSON body. Do not enable this
in production.

### Option 2: Vercel-compatible local dev

If you want to run it the same way Vercel does in production:

1. Install the Vercel CLI if you don't already have it:
   `npm install -g vercel`
2. Start the local Vercel dev server:
   `vercel dev`

## Wire up Shopify

1. In the theme, create `templates/page.contact-zendesk.liquid` and paste the
   contents of `page.contact-zendesk.liquid`.
2. In that file, replace:
   - `RELAY_ENDPOINT` -> `https://your-project.vercel.app/api/zendesk-request`
   - `RECAPTCHA_SITE_KEY` (the `data-sitekey` value) -> production site key
3. Add inputs for any Zendesk custom fields, marking each with
   `data-zd-field-id="<field_id>"` so the script picks them up.
4. Online Store > Pages > (your contact page) > Theme template ->
   `contact-zendesk`. Save.

## Test

1. Open the page, fill it out, complete reCAPTCHA, submit.
2. Confirm "Thanks, your message has been sent."
3. Check Zendesk Agent Workspace for the new ticket and that it landed on the
   correct form with custom fields populated.

### Quick relay smoke test (optional, before wiring Shopify)

```bash
curl -X POST https://your-project.vercel.app/api/zendesk-request \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@example.com","subject":"Test","description":"Hello","token":"TESTTOKEN"}'
```

(reCAPTCHA will reject `TESTTOKEN`; for an end-to-end test, temporarily allow a
bypass token in the function or test through the real form. Do not ship a
bypass.)

## Notes / hardening

- `ALLOWED_ORIGIN` should be the exact storefront origin, not `*`.
- Keep the API token only in Vercel env vars; never commit it.
- For production robustness, consider an OAuth access token instead of an API
  token (revocable, scoped): see Zendesk "Creating and using OAuth tokens".
- If attachments are needed later, that requires the uploads API and additional
  handling — out of scope for this version.
