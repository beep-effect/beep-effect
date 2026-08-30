# OIP Web Launch

## Status

Lifecycle: completed-retained

Implementation complete. The package proof lane was re-run on 2026-07-14;
closure has the user-approved FINISH disposition and rides the
`portfolio-consolidation` pull request. Launch review remains pending.

The re-run is recorded in
[history/outputs/2026-07-14-proof-lane.md](./history/outputs/2026-07-14-proof-lane.md).
The restricted-sandbox build and test failures were environment artifacts; the
driver rerun passed every defined package lane, and the plan's `type-test` lane
was reconciled as never defined. Browser smoke evidence is recorded separately.

## Overview

This initiative migrated the prototype OIP law-firm website from
the machine-local OP_IP_LAW prototype site into the bootstrapped
`@beep/oip-web` app.

The first milestone was a faithful port-and-refactor: preserve the existing
brand story, public sections, assets, SEO posture, and launch copy direction
while making the implementation repo-native through `@beep/ui`, Tailwind v4,
Base UI/shadcn v4 conventions, app-local Effect Schema content contracts, and
repo quality gates.

## Read This First

- [SPEC.md](./SPEC.md) - authoritative initiative contract
- [PLAN.md](./PLAN.md) - implementation plan and proof loop
- [ops/manifest.json](./ops/manifest.json) - machine-readable routing surface

## Closure Goal

The implementation goal is complete. The remaining closure goal is merge-ready
repo state, not public launch approval or deployment:

```text
/goal Complete the OIP merge-ready closure for goals/oip-web-launch without stopping until the OIP app proof lane passes, the initiative packet says implementation complete with launch review pending, generated Playwright screenshots are kept out of the commit, and branch oip-web has one focused local commit with a clean working tree. Do not push, do not deploy, do not mark legal/content review gates approved, and do not create new shared/foundation packages.
```

## Launch Notes

- The source prototype is a reviewed draft candidate, not final legal copy.
- Client marks, named matters, credentials, and public claims remain
  review-gated before publishing.
- The v1 public site must not show fake AI widgets or unimplemented product
  features.
- Tailnet, standalone, static export, and production deployment remain
  follow-up decisions.

## External Public-Launch Follow-ups

These are `EXTERNAL` user follow-ups. Packet completion or a
`completed-retained` lifecycle does not approve public launch.

- **EXTERNAL — Client-logo permission:** confirm permission to publish every
  client logo or remove it.
- **EXTERNAL — Named-matter publication comfort:** confirm publication comfort
  for each named matter and associated client language.
- **EXTERNAL — Credentials:** confirm bar and USPTO credentials and the exact
  public wording.
- **EXTERNAL — Contact details:** confirm the public email, telephone, address,
  and contact-link destinations.
- **EXTERNAL — Legal-notice review:** obtain final review of disclaimers, legal
  notices, and footer-adjacent language.
