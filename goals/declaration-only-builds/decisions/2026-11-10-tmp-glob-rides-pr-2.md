---
title: "The stale tsbuildinfo glob is removed in PR 2, not PR 1"
date: 2026-11-10
lane: "chore/declaration-only-builds-baseline"
reversal: "Remove the glob in a PR of its own and re-record the cache qualification baseline there."
---

Turbo hashes a task's `outputs`, so removing the `node_modules/.tmp` tsbuildinfo glob from `turbo.json` `build.outputs` changes the hash of every generic `build` task. Measured on `@beep/api-transport#build`: `88125a686fd34b63` with the glob, `1d0ce7463b38978d` without; `bun run beep cache audit` reports 188 `#build` subjects as configuration drift. PR 1 is meant to change no behaviour and PR 2 already invalidates every build cache entry through `tsconfig.base.json`, so the removal moves to PR 2 and the repo rebuilds from cold once, not twice. The glob is confirmed stale: no package build writes there, and it restores three compiler-0.51.1 tsbuildinfo files into every fresh checkout. This amends "Three stale findings land in the first PR" for the glob only; the two effect-drizzle findings stay in PR 1.

Evidence: `goals/declaration-only-builds/research/2026-11-10-build-check-equivalence.md`.
