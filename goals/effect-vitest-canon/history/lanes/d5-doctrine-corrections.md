# D5 doctrine corrections

## Status and ownership

- 2026-09-08: active, bounded documentation preparation for the initial P0g PR; no phase completion or publication.
- Requested model/effort: gpt-6-astra / xhigh. Live runtime identifies this assistant as GPT-6; exact backend identifier/effort is not independently exposed. Permissions: danger-full-access, approval policy never.
- Exclusive authored surface: `standards/architecture/08-testing.md`, `.patterns/testing-patterns.md`, testing guidance in `.claude/skills/effect-first-development/SKILL.md`, and this report.
- Private proof artifacts use the `d5-doctrine-astra` cache prefix and `.beep/d5-doctrine-review/`. Concurrent root/core-readiness work remains outside this lane.
- Apply the existing Effect-first skill for canonical module imports/assertion guidance. D5 permits plain-value `expect`; public `@effect/vitest/utils` owns Option/Result/Exit assertions.

## Before hashes (SHA-256)

| Document | Hash |
| --- | --- |
| `standards/architecture/08-testing.md` | `d8dbf5959ff567b7334046e2958663c9c66eb1185b27da5cad6c98d047096218` |
| `.patterns/testing-patterns.md` | `2f5bea34ef181fd4694bd9e38444473079a60b0f2eb462f1cf3f79f24ce2a302` |
| `.claude/skills/effect-first-development/SKILL.md` | `aa6fa5c0132725a66683e2df1563f8ab535a33829927c75f191b26345743ca3e` |

## Progress

- Read the locked D5 decision: helper assertions apply to Option/Result/Exit values; plain-value `expect` remains legal. Reading the original P0g delivery boundary and the three known documents before editing.
- P0g explicitly includes these three doctrine corrections in the initial PR. P0.5 remains active; P0f/P0g completion, P1/P2, publication, and aggregate proofs remain root-owned.
- Installed and pinned `packages/vitest/src/utils.ts` are byte-identical: `8f06a466264a64a6ccb3e8e37aab8ade003d627e21c9589d2b622d2a3a43f6c3`, matching root's tag receipt for `@effect/vitest@4.0.0-rc.112`, SHA `2600f62f4532026928454dcea8d1c48557b3f942`.
- Source anchors: `utils.ts` lines 217 (`assertNone`), 257 (`assertSome`), 275/289 (Result), 307/321 (Exit); all payload helpers use deep strict equality and assertion signatures. `assertExitFailure` requires `Cause.Cause<E>`, not a bare error or asymmetric matcher.
- Assertion edits: removed the blanket ban and comments calling plain `expect` wrong; replaced container predicates/conditional checks with public helpers; retained class, payload, and cleanup checks. Standalone examples now cover Some/None, Result success/failure, Exit success/failure, and legal plain-value `expect` with dedicated module imports.
- Focused proof: two standalone fences extracted verbatim plus 11 contract tests passed under Bun 1.4.1 and Node v24.20.0, Vitest 4.1.11 (3 files / 18 tests each). Strict direct Effect compiler check passed for all three private modules, including six narrowing signatures and payload access.

## Friction and inherited limits for root

- `@beep/iam-domain` / `@beep/iam-use-cases` Membership models and `MyModule`/`ResourceModule`/`ServiceModule` examples are conceptual in this checkout. Their package imports were not claimed to compile. Private proof substitutes real rc.112 error types only for assertion validation, preserving the extraction, class, full-cause, and payload checks.
- The inherited Membership missing-row example shares its success stub, and the repository unknown-id example reuses the fixture id; actual domain fixtures must establish those states. This lane did not redesign their service setup.
- Existing timing/concurrency prose still contains old `Effect.fork` / `Effect.join` / `TestClock.advance` forms, and other conceptual snippets contain legacy service/resource scaffolding. These are outside the D5 correction. The exact new timeout-Cause assertion passed with real rc.112 `Effect.forkChild` / `Fiber.join` / `TestClock.adjust` in private proof; the whole inherited timing section is not presented as compile-verified.
- No gate/inbox or environment failure occurred. Root owns any broader documentation repair and `research/OPPORTUNITIES.md` receipt.

## Edited example coverage

| Edited surface | Proof |
| --- | --- |
| Legal plain `expect` inside `it.effect`, after `assertSome` | Verbatim standalone fence compiles and executes (1 test). |
| Specialized Some/None, Result success/failure, Exit success/failure | Verbatim complete section compiles and executes (6 tests). |
| Every helper's narrowing | Private typed union parameters narrow to `O.Some`, `O.None`, `Result.Success`/`Failure`, `Exit.Success`/`Failure`; payload access typechecks. |
| Every helper's negative behavior | Wrong variant and each applicable wrong payload throw; typed-error and defect Causes are not interchangeable. |
| Both Membership class checks / conceptual validation predicate | Real rc.112 class surrogate proves throwing extraction plus full-Cause assertion and class validation; success, defect-only, wrong class, and composite extra defects are rejected. Actual conceptual imports remain unvalidated. |
| Repository Some/None contract | Expected fixture payload is checked; absent/wrong payload/unexpected Some are rejected. |
| Timeout failure | Actual TestClock run produces `Cause.fail(new Cause.TimeoutError())`. |
| Resource/network/service failures | Failure payloads retained, resource release asserted, wrong failure payload rejected. |
| Plain-value assertion catalog and skill | Static review preserves legal `expect`/`assert`; no blanket replacement rule or container tag-predicate assertions remain. |

## Exact verification commands and receipts

All commands ran in the primary worktree. Bun commands used command-scoped `PATH=~/.local/share/mise/installs/bun/1.4.1/bin:$PATH`. Node executable: `~/.nvm/versions/node/v24.20.0/bin/node`, `v24.20.0`; Bun `1.4.1`; Vitest `4.1.11`.

```sh
bun .beep/d5-doctrine-review/extract-examples.mjs
bunx --bun vitest run --root .beep/d5-doctrine-review --config vitest.config.mjs
node node_modules/vitest/vitest.mjs run --root .beep/d5-doctrine-review --config vitest.config.mjs
node_modules/@effect/tsgo-linux-x64/artifacts/typescript/7.0.2/tsc --ignoreConfig --noEmit --strict --skipLibCheck --target ES2022 --module NodeNext --moduleResolution NodeNext .beep/d5-doctrine-review/assertion-contracts.test.ts .beep/d5-doctrine-review/plain-value-example.test.ts .beep/d5-doctrine-review/specialized-example.test.ts
bun .beep/d5-doctrine-review/audit-docs.mjs
```

- Extractor: exit 0, two verbatim markdown fences; no package-source compilation claim.
- Bun Vitest: exit 0, 3 files / 18 tests passed, reported 305ms; log `~/.cache/beep/effect-vitest-canon/d5-doctrine-astra-bun-1.log`.
- Node Vitest: exit 0, 3 files / 18 tests passed, reported 451ms; log `~/.cache/beep/effect-vitest-canon/d5-doctrine-astra-node-1.log`.
- Strict Effect compiler: exit 0, no diagnostics; log `~/.cache/beep/effect-vitest-canon/d5-doctrine-astra-compile-1.log`.
- Document audit: exit 0, balanced fences, valid skill link/heading, no blanket ban, no container predicate/tag assertions; log `~/.cache/beep/effect-vitest-canon/d5-doctrine-astra-doc-audit-1.log`.
- Private artifacts are retained under `.beep/d5-doctrine-review/`; no previous evidence was removed. Local proof config selects only these private files and sets no timeout or property-run override.

## After hashes (SHA-256)

| Document | Hash |
| --- | --- |
| `standards/architecture/08-testing.md` | `eb4909791d103b3769000cafa61967836700c5c704777c13b4e8b5e601c70159` |
| `.patterns/testing-patterns.md` | `7b9c8dadc546a70645a1dad160c54e5dbdee27e9b037ee4aa4f18eb05790c48b` |
| `.claude/skills/effect-first-development/SKILL.md` | `1952a171d9f53b0ee0a3f0d32f7d5ba05c852ad4cbcc919ca2b0cbe96d99733e` |

## Handoff

- Status: ready for root's combined documentation review. No unresolved D5 contradictions remain in the three owned documents; the inherited non-D5 limitations above are explicitly excluded from the proof claim.
- Changed authored paths: the three documents listed in the hash tables and this report. Skill edits are limited to testing guidance, its local cross-reference, and the immediately necessary list-introduction wording.
- No workspace package, separate filesystem worktree, manifest/lockfile, phase/decision state, public API, runtime, detector/baseline, shared config, or git state was changed. No agents, external/secret calls, inbox actions, or aggregate proofs were invoked.
- Root owns goal doctor/index, combined documentation checks, full proofs, and eventual initial-PR delivery. This lane does not complete P0f/P0g or authorize P1/P2/publication.
- Source discovery began with graft in the indexed package tree (1 call, estimated 17,369 tokens saved); the three known markdown files were read directly because standards are not indexed.
