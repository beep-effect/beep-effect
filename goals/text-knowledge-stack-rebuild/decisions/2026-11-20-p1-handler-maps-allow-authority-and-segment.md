---
title: "P1: handler maps allow the registry-free Authority and Segment"
date: 2026-11-20
lane: "goals/text-knowledge-stack-rebuild-p1b-registry"
reversal: "Remove the two entries from ALLOWED_IDENTITY_SOURCES and move the definitions back to Id.ts"
---

PR B widens `ALLOWED_IDENTITY_SOURCES` in `packages/tooling/infra/ci-runners/test/HandlerBundles.test.ts` by two entries, `Authority.ts` and `internal/Segment.ts`. Design section 14, commit 6 splits `Id.ts`: `IdentityAuthority` moves to the import-free `@beep/identity/Authority` and the segment grammar schemas move to `internal/Segment.ts`. `Root.ts` loads `Authority.ts` and `Id.ts` loads `internal/Segment.ts`, so every CiRunners Lambda handler source map now embeds both files. Neither file loads the package registry or the declared-term registry, so registering a package or a term still leaves every function's code hash unchanged.

Evidence, measured on the lane head bdcd36259dc (the allowlist entries from bb0acdcb4f4, the per-file comment from bdcd36259dc):

- (a) Exact paths. The test strips each map source up to the last `foundation/modeling/identity/src/` and compares the remainder with `A.contains(ALLOWED_IDENTITY_SOURCES, source)`, which is equality. It does not match by directory, glob, prefix, `endsWith` or `includes`.
- (b) The allowlist comment gives each file's reason. `Authority.ts` has no imports and holds one constant. `internal/Segment.ts` holds the segment grammar schemas and imports only `effect/Function`, `effect/Schema`, `effect/String` and an erased `import type { TString } from "@beep/types"`.
- (c) No `@beep/types` source appears in any of the eight handler maps (job-retry, runner-binaries-syncer, scale-down, scale-up, ssm-housekeeper, termination-watcher, webhook and reaper). The only foundation sources in the maps are under `modeling/identity` and `modeling/schema`. Each map's identity sources are exactly `Authority.ts`, `Id.ts`, `Root.ts`, `internal/Segment.ts` and `internal/schemaStatics.ts`.
- (d) Mutation proof. A temporary `import * as RegistryProbe from "@beep/identity/packages"` was added to `webhook.ts` and used in a `console.log`. The test then failed on that row alone: `webhook.ts` reported `outsideAllowed: ["packages.ts"]` and the other seven rows held `outsideAllowed: []`. The mutation was reverted with `git checkout -- <path>` and the tree was clean afterwards.
- (f) Bundle attribution against PR A's head 7a7b87f0328. All eight handler maps were built on each side with the test's Alchemy bundler options and compared. All eight differ. Each map gains exactly `identity/src/Authority.ts` and `identity/src/internal/Segment.ts` and loses nothing. Among the sources both sides share, only `Id.ts` and `Root.ts` changed content, which is the split itself. The stack deploys eight handler entries (seven library, one stack), not eleven.
