# P0 Endpoint-Validation Spike — FreshBooks dev app

Date: 2026-09-03. Operator app: "Oppold IP Law Development" (Private App, dev,
all scopes). Credentials: the recorded 1Password references
(`op://BEEP_SECRETS/BEEP_SECRETS/PAYMENTS_DEV_FRESHBOOKS_CLIENT_ID` /
`..._CLIENT_SECRET`); refs stay references.

This spike has two halves. The **documentation half** (below) is complete and
already decides most driver design inputs. The **live half** requires a
one-time interactive auth-code grant against the dev app (FreshBooks supports
no client-credentials grant), so its results land in the addendum section at
the bottom once the grant is completed.

## Verdict summary

| Question | Verdict | Basis |
| --- | --- | --- |
| Invoice-PDF endpoint exists | **PENDING LIVE VALIDATION** | Undocumented on freshbooks.com/api and absent from the official Node SDK; multiple independent integrations use `GET …/invoices/invoices/{invoiceid}/pdf` with `Accept: application/pdf`. Live verdict lands in the addendum below once the one-time grant completes |
| Documented request-limit numbers | **NONE PUBLISHED** | [Request Limits](https://www.freshbooks.com/api/limits): no daily cap; rate-limited "if too many calls are made within a short period of time"; no numeric ceiling anywhere on the page |
| List page-size cap | **100** | Same page: max 100 results per list call regardless of `per_page` |
| Webhook retry schedule | **NONE PUBLISHED (qualitative only)** | [Webhook Callbacks](https://www.freshbooks.com/api/webhooks): failures "retried periodically"; message dropped "after several failures" |
| Webhook disable behavior | **QUALITATIVE** | Same page: webhook "may be disabled" if the URL "returns only failures over a long period"; re-enabled by resending the verification token |

## Documentation findings (accessed 2026-09-03)

### OAuth mechanics — [Authentication](https://www.freshbooks.com/api/authentication)

- Authorize URL: `https://auth.freshbooks.com/oauth/authorize/?response_type=code&redirect_uri=<REDIRECT>&client_id=<CLIENT_ID>`.
- Token endpoint: `POST https://api.freshbooks.com/auth/oauth/token` with a
  JSON body (`grant_type` of `authorization_code` or `refresh_token`, plus
  `client_id`, `client_secret`, `redirect_uri`, and `code` /
  `refresh_token`). The docs state explicitly: client_credentials is **not**
  supported — a browser grant is unavoidable, once.
- Revoke endpoint: `POST https://api.freshbooks.com/auth/oauth/revoke`.
- Refresh tokens "live forever, but are **one-time-use**, and **only one
  refresh token can be alive at any time per user per application**. A new
  refresh token is generated every time a bearer token is issued … all old
  refresh tokens immediately become invalid." This is the strongest possible
  confirmation of the single-refresh-owner requirement (SPEC constraint,
  r7 §F9): losing the rotated token means a manual re-authorization.
- Bearer tokens are short-lived ("ensure you check the expiry in the token");
  several bearers may coexist; only refresh tokens are single-flight.
- Redirect URIs must be HTTPS, may not carry query parameters, support a
  `state` passthrough parameter, and multiple URIs are allowed (one per
  line). For development the docs bless a manual workaround: register HTTPS
  and hand-edit the redirect to HTTP in the browser — or serve a self-signed
  HTTPS localhost callback, which is what the spike harness does.

### Identity namespaces — [Identity Model](https://www.freshbooks.com/api/identity_model)

- `/me` (scope `user:profile:read`) returns `business_memberships[]`; each
  membership has its own `id` (do not confuse with the business id), a
  `role`, and a `business` object carrying `id` (**business_id**, integer),
  `account_id` (**string**, e.g. `ABC123`), and `business_uuid`.
- `/accounting/...` endpoints take `account_id`; `/timetracking/...` and
  `/projects/...` take `business_id`. Some identities (pure clients) have
  **no** account at all — `account_id` is nullable in the model.
- Driver consequence: `FreshbooksAccountId` (branded string) and
  `FreshbooksBusinessId` (integer) are distinct schema types; nothing accepts
  a bare "freshbooks id".

### Rate limits — [Request Limits](https://www.freshbooks.com/api/limits)

The page publishes, in full: no limit on requests per day; rate limiting
applies "if too many calls are made within a short period of time"; and a
hard cap of 100 results per list response regardless of `per_page`. No
numeric requests-per-minute/second ceiling is documented. The live half
records observed rate-limit headers (or their absence) from real calls.
Driver consequence: handle 429 + `Retry-After` defensively, bound
concurrency, never hard-code a folklore numeric limit.

### Webhooks — [Webhook Callbacks](https://www.freshbooks.com/api/webhooks)

Recorded for the later webhook goal (webhooks stay out of this driver):

- Delivery latency: unguaranteed, "a few seconds to several minutes".
- Failure definition: any non-2xx response **including 3xx redirects**, or a
  **10-second** timeout.
- Retry: "Failed requests will be retried periodically. After several
  failures, the message will be dropped and no further delivery attempts
  will be made." No numeric schedule (count, spacing, backoff) is published.
- Disable: "If the webhook URL registered returns only failures over a long
  period, FreshBooks may disable the webhook. It can be easily re-enabled
  later by resending the verification token."
- Verification: registering a callback POSTs a verification code + callback
  id; echo them back via PUT. The verification code doubles as the HMAC
  secret for the `X-FreshBooks-Hmac-SHA256` signature (base64 HMAC-SHA256
  over a JSON string with spaces after `:` and `,`, all values cast to
  string).
- Consequence (matches r7 §D3): webhook handlers must be idempotent and
  paired with reconciliation polling; a webhook-only event log is rejected.

### Invoice-PDF endpoint — the P0 question

- The official docs pages contain **no** "download invoice as PDF" contract:
  the [Invoices](https://www.freshbooks.com/api/invoices) page has zero
  mentions of PDF, and [Invoice Presentation and Attachments](https://www.freshbooks.com/api/invoice_presentation_attachments)
  only covers uploading images/PDFs **onto** invoices.
- The official Node SDK (`freshbooks/freshbooks-nodejs-sdk`) implements no
  PDF download either — its only PDF surface is the `email_include_pdf`
  invoice flag.
- Multiple independent production integrations use an undocumented but
  stable-looking route: `GET https://api.freshbooks.com/accounting/account/{account_id}/invoices/invoices/{invoiceid}/pdf`
  with `Accept: application/pdf` (e.g. `sabinks/freshbooks-client-php`,
  `withoneai/one-agent-plugin` connector catalog "Download an Invoice PDF
  for an Account", `adbertram/cli-tools` which asserts
  `Content-Type: application/pdf` on the response).
- Live validation (below) is decisive; the docs half alone would leave the
  verb out.

## Unauthenticated live probes (2026-09-03)

- `POST https://api.freshbooks.com/auth/oauth/token` with `{}` →
  `400 {"error":"invalid_request","error_description":"Missing required parameter: grant_type."}`
  — token endpoint confirmed alive at the documented URL.
- `GET /accounting/account/TESTX/invoices/invoices/12345/pdf` (no auth) →
  `404 {"response": {"errors": [{"message": "Account not found", "errno": 404}]}}`
  — account resolution happens before route discrimination, so route
  existence cannot be pre-validated without credentials. It also confirms
  the accounting error envelope shape (`response.errors[]` with `errno`).

## Live half — protocol

Executed with the dev app once the operator completes the one-time grant
(see `research/live-spike-harness.md` for the exact steps and harness):

1. Exchange the code at `auth/oauth/token`; record token response **shape**
   (field names, `expires_in`, token TTL) — never token values.
2. `GET /auth/api/v1/users/me` → record account_id/business_id namespaces of
   the dev business (ids themselves stay out of this public repo).
3. Read-only list probes: clients, invoices, payments (per_page=2) — record
   envelope shapes and any `x-ratelimit-*` / `retry-after` headers observed.
4. The PDF verdict: `GET /accounting/account/{account_id}/invoices/invoices/{invoiceid}/pdf`
   with `Accept: application/pdf` against an existing invoice; record
   status, `content-type`, and first bytes (`%PDF` magic). Also probe the
   documented-detail-endpoint variant with an `Accept: application/pdf`
   header for completeness.
5. One refresh-token rotation: confirm the old refresh token is rejected
   after use (single-use confirmed live) and the new one is persisted by the
   harness before any further call.

## Live results (addendum)

**PENDING.** The live half has not run: FreshBooks supports no
client-credentials grant, 1Password holds only the client id/secret (no
stored token), and the dev app's registered redirect URIs still point at the
`https://www.oip.law` placeholders — so the one-time interactive grant (a
redirect-URI addition in the developer portal plus one Authorize click) is
operator input this session cannot perform on its own. The harness and the
exact operator steps are prepared in `research/live-spike-harness.md`.

Until this addendum records the live run, the retrieval-verb decision is
**undecided** and `getInvoicePdf` stays out of the shipped driver surface.
