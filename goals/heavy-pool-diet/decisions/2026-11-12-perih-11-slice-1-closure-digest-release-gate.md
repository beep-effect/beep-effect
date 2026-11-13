---
title: "PERIH-11 slice 1: binary releases gated on a closure digest"
date: 2026-11-12
kind: checkpoint
lane: "claude/jolly-hopper-9a2206"
reversal: "Revert the slice's squash commit; beep-ci-binary.yml then releases on its path list again and the closure command disappears."
---

PLAN slice 2 lands PERIH-11 slice 1 (absorbing PERIH-08). `bun run beep ci binary-closure` computes the static runtime import closure of `packages/tooling/tool/cli/src/bin-ci.ts` with the policy-fingerprint graph reader (a new follow-all `moduleClosure` beside the shell and command walks), adds the manifest of every workspace it reaches, the whole `src` of any reached workspace with a non-literal dynamic import, and the build inputs `bun.lock`, `.bun-version`, `bunfig.toml`, `CiCompileBinary.ts` and `.github/workflows/beep-ci-binary.yml`, and digests the sorted listing with sha256. At 25452087e73 the closure is 341 files.

`beep-ci-binary.yml` computes that digest before compiling, compares it with the digest recorded in the `beep-linux-x64.closure.json` asset of the latest `beep-ci-*` release, and skips compile, smoke and publish on a match. Every release now carries the digest in its notes and that asset. The path list stays as a coarse prefilter and gains `bunfig.toml`. A `workflow_dispatch` input `verify_reproducible` recompiles an unchanged closure and fails unless the sha256 equals the latest release's; that run is the hosted proof that an unchanged closure compiles to the same bytes.

Scope calls:
- `CiOperational.patterns.json` stays outside the closure. The binary reads the checkout's copy at run time (`changeProfilePatterns` in `CiOperational.service.ts`), and the file is a projection of the compiled-in `ciOperationalPatterns`, whose TypeScript source the closure already covers. The SPEC acceptance text does not name the file, so this is a recorded scope call, not a deviation.
- The root `package.json` and `patches/` are outside the closure: `bun.lock` records resolved versions and patched dependencies, and none of the patched packages is reachable from `bin-ci.ts`. Including the root manifest would release on every script edit.
- The policy-fingerprint walker was generalized in place (one `moduleClosure` method, plus exported `livePolicySourceTree` and `readPolicyWorkspaces`). `bun run beep lint policy-fingerprint` reports `current`: no policy command's import closure changed, so `standards/policy-tools.fingerprint.json` needed no reseal.

The mutation fixtures are `packages/tooling/tool/cli/test/ci-binary-closure.test.ts`: edits to `CiBinary.ts`, a reached `@beep/utils` module, `bun.lock`, `.bun-version` and the workflow move the digest; a new import edge pulls its module in; edits to a `goals/` file, `@beep/git`, an unreached repo-cli command and `CiOperational.patterns.json` leave it unchanged; the digest is independent of workspace order. The first main push after merge publishes once (no earlier release records a digest); the closure-skip reading of the next push and the reproducibility dispatch are recorded after merge.
