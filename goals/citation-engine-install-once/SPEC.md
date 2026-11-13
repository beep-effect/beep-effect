# Citation Engine Install Once Spec

## Objective

Each `engine.extract` call reinstalls 14 metadata operations, the tokenizer
and the extraction loop, constructs regex worker objects per token, and runs 8
configuration detach round trips. None of that depends on the request. This
goal moves it to engine construction.

The per-request install is how a request's text budget, Scope and admission
reach a stage today (each stage captures them when installed), so the goal
first replaces that mechanism with one request-scoped service,
`CitationInvocation`, then hoists the installs, then removes the nested
configuration copies behind an owned-configuration brand.

The contracts are in
[`explorations/citation-engine-install-and-worker-reuse/research/design-2026-11-12.md`](../../explorations/citation-engine-install-and-worker-reuse/research/design-2026-11-12.md) sections 1, 2.1, 2.2, 3.1, 3.4, 3.5, 5 and 6.
The shaped pitch is [`explorations/citation-engine-install-and-worker-reuse/BRIEF.md`](../../explorations/citation-engine-install-and-worker-reuse/BRIEF.md).
Protocol v3, the native lane and the regex session belong to
`goals/citation-regex-worker-v3`; in this goal `invocation.regex.evaluate`
runs on protocol v2, one process per job.

## Non-Goals

- Any change to extraction output, to the public `CitationEngine` service shape, or to a limit value.
- Regex worker protocol v3, the native lane, or any change to process ownership (`goals/citation-regex-worker-v3`).
- An identity-keyed memo, `WeakMap`, `WeakSet`, native `Map` or `Set`, or any module-level cache.
- Removing the four per-request report-limit snapshots (`captureCitationOperationPolicy`); they are a bug fix.
- A new regex engine or a change to the pattern translator.

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files, and the design in
   the source exploration.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/law-practice/server/src/internal/Citation/` (new `Invocation.ts`, `ConfigurationOwnership.ts`; reworked `MetadataComposition.ts`, `TextBudget.ts`, `Tokenizer.ts` and the stage modules)
- `packages/law-practice/server/src/CitationEngine/CitationEngine.layer.ts` and `CitationExtractor.layer.ts`
- `packages/law-practice/server/test/` (a span-recorder fixture, an invocation fixture helper, updated stage fixtures)
- One Biome GritQL rule forbidding optional budget and admission lookups under the Citation directory
- This packet's evidence under `history/`

## Constraints

- Effect v4 only. Check every API against the Effect reference checkout before writing it; the design cites file and line for each.
- Design order is schema, then `Context.Service` contract, then implementation. `CitationInvocationPolicy`, `CitationInvocationReceipt` and the `CitationOwned` brand land before the code that uses them.
- Slice A2 is behavior-neutral and lands alone: children are still installed per request, regex is still v2. If request values cannot be read at call time without changing results, stop and reshape.
- `Effect.serviceOption` adds nothing to the requirement channel, so a hoisted install-time budget lookup silently stops charging. Delete `captureCitationTextReservation` and every `serviceOption(CitationTextBudget)` listed in the design (eleven sites) in A2, not A3.
- Fourteen sites capture `CitationOperationAdmission` and call `run`. Remove each nested `run` in A2 and install the stage tree in a Context without the admission, so a missed capture fails at engine construction.
- Installs stay under the existing operation-label providers (`SourceDocument.ts:148`, `SourceAnnotation.ts:197`, `AnnotationEntry.ts:271`).
- `ownCitationConfiguration` detaches through the JSON codec. A type-side round trip keeps the caller's `Uint8Array` buffers.
- Counts gate each slice; wall time is recorded beside them. Take the wall-time record on a remote worker (`beep-worker` or `dankserver`, `remote-development-agents` skill). Do not run the large citation replays on the shared workstation above the load cap.
- At most three PRs of this packet open at once; the slices are serial.
- The repo is public: no secrets, no absolute home paths, no client documents in fixtures or evidence.

## Acceptance Criteria

- [ ] A1: a fixture runs the ten-call bun cohort of `CitationCanonicalFullSpan` under a span recorder and the observed spawner and reports child processes started, metadata-operation installs, configuration detaches, tokenizer builds and regex worker constructions, plus wall time and host load. The baseline is recorded in `history/evidence/` from two runs whose counts agree.
- [ ] A2: `CitationInvocation` and `openCitationInvocation` exist; no `serviceOption(CitationTextBudget)` or `serviceOption(CitationOperationAdmission)` remains under the Citation directory and the lint rule proves it; `captureCitationTextReservation` and `captureCitationOperationChildren` are deleted; all four engine methods and the extractor boundary keep `R = never`; the canonical replays produce identical results.
- [ ] A3: per-request metadata-operation installs are 0 and tokenizer builds are 1 per engine on the fixture; regex evaluators are constructed at engine construction only.
- [ ] A4: configuration detaches are 1 per engine on the fixture (report snapshots excluded); no installer below the boundary decodes or detaches configuration; the 2026-11-07 report-deadline mutation test still passes.
- [ ] Each slice's PR body carries the before and after count table from the same fixture.
- [ ] `bun run beep quality package-verify @beep/law-practice-server` passes for each slice.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Package verify | `bun run beep quality package-verify @beep/law-practice-server` | Passes |
| Count fixture | the A1 fixture's table, before and after, in each PR body | Counts match the acceptance criteria |
| Optional lookups | the Biome GritQL rule (from A2) | No finding |
| Citation replays | hosted CI, and a remote-worker run recorded in `history/evidence/` | Identical results |
| Model pins | `bun run beep models check` | Passes |
| Packet launcher size | `test "$(wc -m < goals/citation-engine-install-once/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/citation-engine-install-once/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/citation-engine-install-once` | Passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each as a decision file.

## Decision log

Record each decision as its own file under `decisions/` (`bun run beep goals
decisions add citation-engine-install-once --title "..." --reversal "..."`); the block below is
generated from that directory and never edited by hand.

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug citation-engine-install-once`; add a `kind: decision` file there, never edit this block._

### Bind request values through one CitationInvocation service, 2026-11-12

Installed stages keep `CitationInvocation` in their requirement channel and the public entry provides it once per request. Holding one proves admission, so the pass-through nested admission is removed. Operator answer, exploration align round 1. Rejected: an explicit parameter (about 36 factory sites and every helper, with no compiler help finding a missed capture) and a memoized tree re-bound through a mutable holder (shared mutable state across concurrent requests). Source: `explorations/citation-engine-install-and-worker-reuse/DECISIONS.md`, run-time binding.

Lane explore/citation-engine-install-and-worker-reuse

Reverse: Thread the invocation as an explicit parameter on every installed run and helper.

### Keep the per-request report-limit snapshots, 2026-11-12

They stop a caller mutating a returned report from altering the installed policy (the 2026-11-07 fix in `goals/citation-extraction-engine`). Owned values never leave the engine; what leaves is a fresh copy. They are excluded from the detach count. Source: `explorations/citation-engine-install-and-worker-reuse/research/design-review-2026-11-12.md`, finding 7.

Lane explore/citation-engine-install-and-worker-reuse

Reverse: Remove the four captureCitationOperationPolicy calls.

### Own configuration once at the engine boundary and carry ownership in the type, 2026-11-12

One detach through the JSON codec where configuration enters the engine mints `CitationOwned<Config>`; installers below accept it and never copy. Schema has no freeze or structural sharing, and an identity memo is ruled out by the repo's laws. Operator answer, exploration align round 1. Source: `explorations/citation-engine-install-and-worker-reuse/DECISIONS.md`, detach strategy.

Lane explore/citation-engine-install-and-worker-reuse

Reverse: Restore the nested detach calls in each installer.

### Read budget and admission at call time and delete the optional lookups, 2026-11-12

`Effect.serviceOption` adds no requirement, so hoisting an install-time lookup would silently disable text accounting or take a second permit. The design review listed eleven budget sites and fourteen admission sites; all change in slice A2 with a lint rule. Source: `explorations/citation-engine-install-and-worker-reuse/research/design-review-2026-11-12.md`, findings 3 and 4.

Lane explore/citation-engine-install-and-worker-reuse

Reverse: Reintroduce captureCitationTextReservation and the nested admission view.

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
