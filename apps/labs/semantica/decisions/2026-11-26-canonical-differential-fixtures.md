---
title: Retain historical refusal fixtures beside the app encoder
date: 2026-11-26
reversal: Restore a byte-equality test comparing the owner with its delegating wrapper or import app code from a tooling package.
governs:
  - test/CanonicalDifferential.test.ts#exported
enforcedBy: []
---

The app encoder now delegates to the RFC 8785 canonical owner, so compare owner refusals with recorded legacy behavior and replay the pre-migration W1 corpus digest through both public paths.
Reason: a wrapper-versus-owner byte-equality property would compare the owner with itself; legacy strings are historical fixtures, not claims about removed code.
Rejected: restore that tautological comparison or centralize this app test in a package that cannot import an app. Keep app-owned differential coverage beside its export.
