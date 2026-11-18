---
title: "Port vitest-agent into @beep packages, never import it"
date: 2026-11-18
lane: "explore/agent-verification-output"
reversal: "Add @vitest-agent/* as a dependency and delete the ported modules"
---

The upstream code moves into canonical `@beep/*` packages with its MIT license and attribution. Nothing from `@vitest-agent/*` or `@effected/*` enters a manifest. Attribution follows the effected precedent: an MIT `LICENSE` carrying both copyright lines and a README `Provenance` paragraph with an `Attribution` list. A file derived from the two Vitest files upstream vendors keeps the VoidZero and Vitest contributors notice too. Ruling: explorations/agent-verification-output/DECISIONS.md, entry `port-not-import`.
