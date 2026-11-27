---
title: The bundle-size probe builds with pinned esbuild, keeps peers external and imports the artifact
date: 2026-11-26
reversal: Bundle the probe consumer with Bun.build, or bundle effect and drizzle-orm into the artifact.
governs:
  - test/bundle-build.ts#externalPeers
  - test/bundle-build.ts#makeBundleImportDirectory
  - test/bundle-build.ts#importBundleConsumer
  - test/bundle-size.ts#minimumBundleRawBytes
enforcedBy: []
---

The probe bundles `test/bundle-pg-integer.consumer.ts` with esbuild and keeps `effect` and `drizzle-orm` external, so it measures only what this package adds to a consumer bundle. esbuild is a pinned devDependency whose version the committed baseline records, so the byte count moves only with this package's source or a deliberate esbuild bump.
Because peers are external, the artifact is imported from a scoped directory under the package's git-ignored `.beep/`, where `effect` and `drizzle-orm` resolve. Importing it is the authoritative check: an over-shaken artifact that exports a dropped binding is a link-time SyntaxError at any size.
`minimumBundleRawBytes` (4096, about half the initial 7864-byte baseline) is only a coarse stub guard; move it deliberately with the baselines.
Rejected: Bun.build, whose shaker has emitted vacuous stubs (the failure mode the import-boundary test guards).
Rejected: bundling the peers, which would measure effect and drizzle-orm instead of this package.
