# OIP Web Launch Runbook

The production-hardening implementation is complete. Use this checklist for the
remaining provider-owned launch operations; do not treat it as open code scope.

## 1. Apply Cloudflare DNS

- Apply the modeled CNAME records for `staging.oip.law` and `www.oip.law` to
  `cname.vercel-dns.com`.
- Apply the modeled legacy redirects for `staging.opip.law`, `opip.law`, and
  `www.opip.law` to their OIP destinations.
- Confirm public DNS answers and redirect targets before removing any historical
  staging route.

## 2. Activate Vercel TLS and re-prove staging

- Attach and verify the `staging.oip.law` custom domain in Vercel after DNS
  resolves; wait for the managed TLS certificate to become active.
- Deploy the current hardening build, then repeat public HTTPS/header, browser,
  contact-path, PWA, and Lighthouse checks against `https://staging.oip.law`.
- Preserve the fresh proof under this packet's `history/outputs/` convention.

## 3. Provision Sanity

- Create or select the OIP Sanity project and dataset, provision the least-
  privilege runtime token, and inject project, dataset, and token configuration
  through the approved secret environment.
- Publish reviewed content and verify the CMS-backed render on staging.
- Until provisioning is complete or Sanity is unavailable, the app's checked-in
  reviewed fallback content remains the supported launch-safe behavior.

## 4. Keep the accepted CSP posture

- Accept the current static CSP posture at MDN Observatory B+/80 for launch.
- Treat A+ as future work: move to a request-bound nonce/proxy CSP or equivalent
  generated script/style hashes, then re-run browser and Observatory proof.

## 5. Gate production DNS cutover

- Obtain explicit production DNS cutover approval before applying canonical
  `oip.law`/`www.oip.law` records or enabling the legacy production redirects.
- After approval, preview the production stack, review the exact DNS and redirect
  changes, apply, confirm Vercel TLS, and run the staging proof set against
  production.
- Without explicit approval, stop after staging proof and leave
  `launchCutoverApproved: false` unchanged.
