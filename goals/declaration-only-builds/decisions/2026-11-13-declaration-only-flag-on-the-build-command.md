---
title: "Declaration-only is set on the generated build command, not in the base tsconfig"
date: 2026-11-13
lane: "feat/declaration-only-build"
reversal: "Move the flag into the base config and add an explicit opt-out to every no-emit overlay through the overlay generators."
---

The plan was to make `tsconfig.base.json` emit declarations only. `emitDeclarationOnly` needs `declaration` or `composite`, and 404 tracked overlays turn both off (200 `tsconfig.check.json`, 177 `tsconfig.test.json`, 12 `tsconfig.scripts.json`, 5 `tsconfig.stories.json` and ten others). Each would fail with TS5069 the moment the base set the option. Measured: `tsrs -p tsconfig.check.json --emitDeclarationOnly` in `@beep/types` prints TS5069.

So the generated `beep:build` for the four emitting kinds becomes `tsrs -p tsconfig.json --emitDeclarationOnly` and the base config stays as it is. The blast radius is the four policy rows and the manifests they generate. One exported constant in `@beep/repo-cli-kit` carries the command, and the census build-equivalence mode reads it, so nothing else invokes the build program with different emit flags.

Consequence for the plan: PR 2 no longer changes a global Turbo input. It still invalidates every build cache entry once, because every manifest and the `build` task outputs change.
