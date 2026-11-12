---
title: "P0: render runs under the repo's Vitest on Bun and Node"
date: 2026-11-10
kind: checkpoint
lane: "claude/lane-cockpit-spike-e015b2"
reversal: "None needed: a measurement, not a choice."
---

The first-hour question is settled. A Text.js frame rendered with render from @textjs/react/testing, inside an @effect/vitest it.effect, passed under both bunx --bun vitest run (837 ms for the file) and bunx vitest run on Node (1.31 s). The circuit breaker did not fire.

One finding: the repo's shared Vitest config runs tests concurrently, and Text.js keeps process-wide renderer and input state, so concurrent renders in one file interleave and draw empty frames. The frame suite declares { concurrent: false }; each test then renders on its own and all pass.
