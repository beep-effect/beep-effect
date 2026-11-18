---
title: "P3 unbuilt-dependency probe built"
date: 2026-11-18
kind: checkpoint
lane: "fix/gate-output-check-probe"
reversal: "Revert the probe commits on the lane, run the scripts writer and restore the previous per-package cache baselines."
---

Fix 6 is implemented with eight tests over a fixture with one unbuilt reference. AC8: on `@beep/schema` with two upstream declaration indexes missing, the compiler alone printed 134,905 characters in 711 lines; `beep-cli check` prints one line of 175 characters, and `bun run check` prints that line between Bun's command echo and exit line, 269 characters. No compiler starts. A built tree runs the check unchanged. P0 closed with it: both open choices have a decision file, and the spec's count of generated check scripts (186) is 208 at this head. Six package-keyed SHA-256 digests in the baseline request matched token detectors; a path and line allowlist for such requests landed on `main` first, because the hosted scan pins its configuration to the base. Numbers: `history/2026-11-18-p3-probe-and-verify.md` in this packet.
