---
title: "TURB-05 installed-tree digest is each package's locked closure"
date: 2026-11-14
lane: "perf/local-proof-force-reason"
reversal: "Replace packageInstalledTreeDigests with another digest; recorded digests are shadow evidence only and nothing reads them to decide."
---

Today an installed tree is identified two ways. `HeadInstallInputs` names what a frozen install reads at a commit (the `bun.lock` blob, the manifests, `patches/`, `bunfig.toml`, `.npmrc`, the Bun version and host), at repository grain. `Cache.dependencies.ts` takes a tar digest of the whole `node_modules` for cache experiments, which also covers the whole repository and takes minutes. The per-package digest refines the first without reading `node_modules`.

A package's installed tree is every instance its resolved edges reach in the parsed `bun.lock` (`@beep/lockfiles`), plus everything the root reaches. The root is added because the hoisted linker lets every package load the root's tools, and Turbo folds the root's external-dependency hash into every task in the same way. Each instance contributes one line: its `bun.lock` key (its install position under the hoisted linker), `name@version` and integrity. The digest is SHA-256 over the sorted lines (`Sha256HexFromBytes`). The root package is named `//`.

The digests are computed only when `bun.lock` changed, from `git show` of the lockfile at the decision's merge base and at HEAD, so the shadow records which packages a per-package narrowed force would force. Three things are left out on purpose: patch content (path-detected as `patches-changed`), drift between `node_modules` and `bun.lock` (the frozen head-install preflight checks that), and undeclared imports (the separate undeclared-import invariant in the SPEC gate).

Measured on this checkout in single runs on a shared host under load, for a range of three lockfile commits that also changed the root `package.json` (209 packages compared, 4 changed): the decision took 55 ms (the diff, the merge base and the two root manifest reads) and the shadow 0.62 s (the two lockfile reads, parses and digests). A cold separate runtime took up to 2.5 s for the shadow. With `bun.lock` unchanged the decision is one `git diff --name-only` (43 ms) and the shadow reads nothing more (17 ms).

Rejected: walking `node_modules`, because only the HEAD side is on disk, so there is nothing to compare against, and its cost grows with the install; and the full tar digest, which covers the whole repository and takes minutes.
