# OIP Web Production Hardening Plan

## Implementation Status

Status: **completed as shipped**. The remaining provider operations are
operational launch steps, consolidated in
[`history/outputs/launch-runbook.md`](./history/outputs/launch-runbook.md).

- [x] Create the production-hardening initiative packet.
- [x] Scaffold `@beep/sanity` and `@beep/hubspot` driver workspaces.
- [x] Fill research reports and synthesis.
- [x] Implement driver services, typed errors, tests, and type tests.
- [x] Wire CMS-backed content with fallback in `@beep/oip-web`.
- [x] Add native HubSpot-backed contact form.
- [x] Add security, PWA, SEO/AEO, robots, sitemap, JSON-LD, and `llms.txt`
  hardening.
- [x] Add OIP Pulumi/IaC for S3 backend, Vercel, and Cloudflare.
- [x] Run local quality, browser QA, Lighthouse, and closure evidence updates.
- [x] Prove the `next.config.ts` CSP/security headers locally through portless
  HTTPS.
- [x] Migrate the temporary Pulumi S3 backend from `opip-law-pulumi-state` to
  `oip-law-pulumi-state`, then delete the legacy versioned bucket after proof.
- [x] Rename empty OIP asset buckets to `assets.oip.law` and
  `staging-assets.oip.law` through Pulumi.
- [x] Record Cloudflare DNS, Vercel TLS/staging re-proof, Sanity provisioning,
  accepted B+/80 CSP posture, future nonce/A+ path, and the production cutover
  approval gate in the launch runbook.

## Retained Proof Commands

These commands document the shipped proof surface; provider launch operations
follow the runbook and do not reopen implementation.

```sh
bun run --cwd packages/drivers/sanity build
bun run --cwd packages/drivers/sanity check
bun run --cwd packages/drivers/sanity test
bun run --cwd packages/drivers/sanity lint

bun run --cwd packages/drivers/hubspot build
bun run --cwd packages/drivers/hubspot check
bun run --cwd packages/drivers/hubspot test
bun run --cwd packages/drivers/hubspot lint

bun run --cwd apps/oip-web build
bun run --cwd apps/oip-web build:pwa
bun run --cwd apps/oip-web check
bun run --cwd apps/oip-web test
bun run --cwd apps/oip-web lint
bun run --cwd apps/oip-web type-test

bun run --cwd infra check
bun run --cwd infra test
bun run --cwd infra lint
```

Browser and deployment proof:

```sh
bun run --cwd apps/oip-web start
aws-vault exec codedank-elpresidank --duration=12h -- aws sts get-caller-identity
bun run goals/oip-web-production-hardening/ops/migrate-oip-state-bucket.ts --dry-run
bun run goals/oip-web-production-hardening/ops/migrate-oip-state-bucket.ts --yes
pulumi login s3://oip-law-pulumi-state
pulumi preview -s staging --non-interactive --diff
pulumi up -s staging --yes --non-interactive
pulumi preview -s production --non-interactive --diff
pulumi up -s production --yes --non-interactive
bun run goals/oip-web-production-hardening/ops/migrate-oip-state-bucket.ts --delete-source --yes
bun run goals/oip-web-production-hardening/ops/migrate-oip-state-bucket.ts --dry-run
curl -sI -H "Host: oip-web.beep.localhost:1355" http://localhost:1355
```

## Closure Rules

- Keep screenshots and raw Lighthouse output in `history/outputs/` only when
  they are intentionally recorded.
- Do not commit generated browser screenshots by accident.
- Do not resolve legal/content launch review gates.
- Do not cut over production DNS without explicit approval.
- Execute remaining provider operations from `history/outputs/launch-runbook.md`;
  they do not reopen this implementation packet.
