---
title: "Layer 1: root package.json replaced by a catalog-free projection; root-dependency bumps stay global"
date: 2026-11-07
lane: "feat/verification-route-slice-2"
reversal: "Restore package.json in turbo.json global.inputs and drop the projection section from tsconfig-sync"
---

tsconfig-sync writes standards/root-package.projection.generated.json (every top-level field but catalog, scripts included) and config-sync:check drift-checks it; turbo.json global.inputs carries the projection instead of package.json, in one commit. Measured under turbo 2.11.10: a catalog bump of a dependency the root does not itself depend on invalidates only its dependents (fixture: verification-layer1-turbo.test.ts, gated by BEEP_LAYER1_DRYRUN). A bump of a root dependency (the Biome case in SPEC's acceptance row) still invalidates every task because turbo hashes the root's external dependencies into each task; moving Biome out of the root manifest is outside this goal. SPEC's row is met as written, since every lane's footprint still names pkg:catalog. The 25 package-local turbo.json files were swept and none re-adds the root manifest.
