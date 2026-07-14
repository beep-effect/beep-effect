# OIP Web Production Hardening

## Status

Lifecycle: `completed-retained`

**Completed as shipped.** The implementation, OIP rename, IaC intent, state and
asset migration, quality proof, browser QA, and completion audit are done.
Remaining provider operations are launch-time work in
[`history/outputs/launch-runbook.md`](./history/outputs/launch-runbook.md), not
open implementation phases.

- Sanity live content remains unconfigured because no OIP Sanity project/token
  is present in `OIP_SECRETS`; the app renders checked-in reviewed fallback
  content until that is provisioned.
- Vercel TLS activation for `https://staging.oip.law` is pending provider
  apply. `staging.opip.law` remains the verified historical staging endpoint
  until redirect cutover completes.
- The B+ / 80 static CSP posture is accepted for now. MDN HTTP Observatory
  reports that score because the
  `next.config.ts` CSP must keep `unsafe-inline` for Next App Router runtime
  scripts and Next/Image inline styles. A+ requires a request-bound nonce CSP
  path or equivalent script/style hashes.

## Overview

This initiative hardens `@beep/oip-web` after the first OIP website migration.
It keeps the launch review gates from `oip-web-launch`, then adds production
security, search/AEO assets, PWA support, CMS-backed editable content, native
CRM intake, and deployable infrastructure for staging and gated production.

The first production path is managed-first and lean:

- Sanity owns reviewed editable content.
- HubSpot receives native intake through the service key. The app uses a
  HubSpot Form when a form GUID is configured and otherwise falls back to CRM
  contact upsert, which matches the currently granted scopes.
- Vercel hosts staging and production.
- Cloudflare owns DNS for `oip.law` and `opip.law`; Pulumi now models OIP
  canonical records plus OPIP legacy redirects.
- Pulumi is configured for a temporary private S3 state bucket in codedank until
  a dedicated OIP AWS organization exists. The backend has migrated from the
  historical `opip-law-pulumi-state` bucket to `oip-law-pulumi-state` while
  retaining the Pulumi project namespace for state continuity.

## Read This First

- [SPEC.md](./SPEC.md) - authoritative initiative contract
- [PLAN.md](./PLAN.md) - implementation plan and proof loop
- [research/synthesis-and-decisions.md](./research/synthesis-and-decisions.md)
  - chosen production posture
- [ops/manifest.json](./ops/manifest.json) - machine-readable routing surface

## Closure Goal

```text
/goal Complete goals/oip-web-production-hardening end to end without stopping until the canonical initiative packet is created and filled, the temporary encrypted S3 Pulumi backend exists in codedank us-east-1, Sanity and HubSpot drivers are implemented with tests, @beep/oip-web renders Sanity-backed reviewed content with repo fallbacks, the native contact form submits to HubSpot through the driver, security/PWA/SEO/AEO/llms.txt hardening is implemented, staging infrastructure is applied for Vercel, Cloudflare DNS automation is either applied or blocked with exact provider evidence, production infrastructure has a clean preview, all repo quality gates pass, browser QA and Lighthouse proof are recorded, and the working tree is ready for focused commits. Do not expose raw secrets, do not use HubSpot Personal Access Key at runtime, do not add Resend in v1, do not add HubSpot tracking scripts, do not use AWS MCP for bootstrap, do not mark legal/content review gates approved, and do not cut over oip.law production DNS without explicit user approval.
```

## Deferred Decisions

- A dedicated OIP AWS organization remains deferred until the preferred OIP
  business email, root account, billing, and MFA are ready.
- Resend or another transactional email service remains deferred until HubSpot
  notifications are insufficient or branded acknowledgment emails are approved.
- HubSpot tracking scripts remain deferred until the privacy and performance
  tradeoff is explicitly accepted.

## Closure Notes

- Local app, driver, infra, repo quality, browser QA, PWA build, and Lighthouse
  proof are recorded in [history/outputs/local-closure-evidence.md](./history/outputs/local-closure-evidence.md).
- The OIP rename/provider preflight is recorded in
  [history/outputs/oip-rename-cutover-addendum.md](./history/outputs/oip-rename-cutover-addendum.md).
- The completed OIP state and asset bucket rename is recorded in
  [history/outputs/oip-state-bucket-rename-evidence.md](./history/outputs/oip-state-bucket-rename-evidence.md).
- Provider operations, staging re-proof, and the production DNS approval gate
  are recorded in [history/outputs/launch-runbook.md](./history/outputs/launch-runbook.md).
- The encrypted S3 backend, staging Vercel project/domain/env, disabled Vercel
  Authentication posture, and staging asset bucket are managed from
  `infra/oip-web`.
- The production stack has been updated for the OIP state backend and asset
  bucket rename; production DNS cutover still requires explicit approval.
- Cloudflare staging DNS is applied for `staging.opip.law`. OIP DNS records are
  represented in IaC and pending apply.
- Staging Lighthouse proof is 100 across performance, accessibility, best
  practices, SEO, and agentic-browsing after adding Markdown links to
  `llms.txt`.
- Production DNS records are modeled; cutover remains gated on explicit approval
  and follows the launch runbook.
