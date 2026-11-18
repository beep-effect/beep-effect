# Model-First Standard Spec

## Objective

Amend the architecture standard to the model-first four-package slice, retarget beep architecture to it, and enforce the grammar with checkers under a ratchet.

The design is settled in the exploration packet: `explorations/model-first-slices/BRIEF.md` is the shaped pitch (confirmed,
D59), `explorations/model-first-slices/DECISIONS.md` is the decision log (D1 to D66) and `explorations/model-first-slices/MAP.md` is the decomposition. This goal
writes that shape into the standard and makes the repo's tooling generate and check it.

## Non-Goals

- Migrating any existing slice to the four-package shape. `documents-vault-sync-reshape` and `slice-migrations` are gated candidates in the exploration's `MAP.md`.
- Retiring `@beep/alchemy-postgres` (D5, D53).
- Building any context. `authority-context` is its own goal; `runs`, the first product slice and the D14 scope are gated candidates.
- Adopting Foldkit. Only its story testing pattern is borrowed (operator, `CAPTURE.md`).
- Changing the rules for non-slice families (foundation, drivers, tooling) beyond the places that cite the slice shape.

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `standards/ARCHITECTURE.md`, `standards/architecture/DECISIONS.md`, `standards/architecture/GLOSSARY.md` and the chapters that describe the slice (`01`, `10`, `13`).
- `packages/tooling/tool/cli/src/commands/Architecture/`: the role lists in `Architecture.schemas.ts`, `Architecture.plan.ts` and `internal/RoleTopology.ts`, and the package shells and templates.
- `packages/tooling/tool/cli/src/commands/Fallow/` doctrine rules and the generated `standards/fallow.boundaries.generated.jsonc`.
- New checkers and generators in `@beep/repo-cli` and the policy pack, with their baselines under `standards/`.
- `goals/slice-topology-audit` (status only: superseded by this goal, D65).
- `AGENTS.md` and skills, only where they name the scaffolder command or the slice shape.

## Constraints

- The standard states the decided shape and no other: a slice is a bounded context with one `Domain.Model` by default (D2); four packages `contract`, `model`, `host`, `web`, one per dependency closure (D3); the contract as a `Domain.Api` over an aggregate-free catalog with a parity test (D9 as amended); the file grammar and exact exports (D10); integration facts through a model-level projection into a published stream, with generations and the retirement rules (D11, D33, D34, D40, D43, D47, D50, D51); stored formats convert on read (D22, D35); the proof inventory (D8).
- Where the standard and the exploration's decision log differ, the log wins and the standard is corrected.
- Existing seven-package slices stay legal as the legacy shape until their own migration. New checkers start from a day-one baseline of today's violations and only ratchet down. No mass rewrite (D17).
- D17's hold becomes doctrine: no new slice migration to `@alchemy.run/domain` starts on the seven-package shape.
- The standard names Effect Cluster on Postgres as the first host and says `@beep/alchemy-postgres` remains until an Alchemy release carries the fixes (D5, D53).
- A syntactic check is a Biome GritQL rule. A check that needs the import graph, the file system or generation lives in the repo CLI.
- `bun run beep create-package` stays the only package bootstrap; the scaffolder goes through it.
- The prototype (`scratchpad/model-first-slices/`) is a porting source for the checkers and generators (`shared/tooling/`, `scripts/`), never a dependency.
- The contract declares views and queries a second time until upstream splits the Api from the model; the standard says so and names the upstream target.

## Acceptance Criteria

- [ ] `standards/ARCHITECTURE.md` defines the four-package slice, the file grammar, exact exports, the legal imports between packages and between contexts, integration facts and published streams, the stored-format law and the proof inventory, and marks the seven-package shape as legacy. `standards/architecture/DECISIONS.md` has the dated entry that records the change and cites the exploration.
- [ ] `bun run beep architecture` creates a four-package context that passes `check`, `lint` and every new checker with no baseline entry, and whose generated story test runs on `Domain.InMemory`.
- [ ] Checkers for role suffix and placement, exact exports and imports between contexts run in a required check. Each has a day-one baseline for existing slices, and a planted violation in a fixture fails each one.
- [ ] The handler-registry and proof-inventory generators exist with a `--check` drift mode, and the proof inventory reports executed command outcomes against declared ones.
- [ ] `goals/slice-topology-audit` is `superseded` with `supersededBy: model-first-standard`.
- [ ] `bun run beep quality package-verify` passes for every touched package.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/model-first-standard/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/model-first-standard/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/model-first-standard` | Passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each as a decision file.

## Decision log

Record each decision as its own file under `decisions/` (`bun run beep goals
decisions add model-first-standard --title "..." --reversal "..."`); the block below is
generated from that directory and never edited by hand.

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug model-first-standard`; add a `kind: decision` file there, never edit this block._

### Seven-package slices stay legal as the legacy shape under a baseline, 2026-11-17

Work under way on the seven-package shape finishes as planned and no new migration starts on it (explorations/model-first-slices/DECISIONS.md D17). New checkers therefore start from a day-one baseline and only ratchet down; each slice leaves the baseline with its own migration.

Lane explore/model-first-slices

Reverse: Drop the baselines and migrate every slice in one change

### Seeded from the model-first-slices exploration, 2026-11-17

The shape this goal writes into the standard was settled in explorations/model-first-slices/DECISIONS.md (D1 to D66) and confirmed by the operator in explorations/model-first-slices/BRIEF.md (D59). The entries that bind this goal most directly are D2, D3, D8, D9 as amended in phase 1, D10, D11, D12, D13, D17, D22, D33 to D35, D40, D43, D47, D50 and D51. They are linked, not copied.

Lane explore/model-first-slices

Reverse: Reopen explorations/model-first-slices at decompose and re-seed this spec from the changed brief

### This goal supersedes slice-topology-audit, 2026-11-17

The paused goal was to make the seven-package grammar mechanical. This goal covers the doctrine amendment, the scaffolder and checkers under a ratchet on the four-package shape, and provides the architecture/slice-audit capability in its place. Operator ruling: explorations/model-first-slices/DECISIONS.md D65.

Lane explore/model-first-slices

Reverse: Set goals/slice-topology-audit back to paused and remove its supersededBy

### Legacy sections stay in the standard behind banners, 2026-11-18

The seven-package sections of standards/ARCHITECTURE.md are kept and marked legacy rather than deleted, because existing slices stay legal on that shape until their own migration (D17) and edits to them still need the rules. The new "Model-First Slice Topology" section is the target doctrine; "Legacy Seven-Package Slice Topology" and the sections it lists carry a banner pointing to it. Chapters 01, 10 and 13 lead with the model-first shape and keep the legacy rules in a marked part. The anchors other files cite (package-dependency-graph, how-to-use-this-standard, enforcement-and-migration-posture) are unchanged.

Lane claude/model-first-standard-doctrine-b72d36

Reverse: Delete the legacy sections once the last seven-package slice migrates

### Package names follow @beep/<context>-<role>; web exists only with screens, 2026-11-18

The four packages are `@beep/<context>-contract`, `-model`, `-host` and `-web`, the same `@beep/<slice>-<role>` convention legacy slices use, so package metadata, identity composers and Fallow zones keep one naming rule. `contract`, `model` and `host` exist for every context; `web` exists when the context has screens, as in the prototype, where `authority` and `runs` have no web package (explorations/model-first-slices/DECISIONS.md D3). The smallest legal slice in chapter 13 is therefore three packages.

Lane claude/model-first-standard-doctrine-b72d36

Reverse: Rename the packages in the standard and the scaffolder plan, or require web for every context

### The v3-consistency-audit deferred rows are settled against the four-package shape, 2026-11-18

The nine rows explorations/v3-consistency-audit/DECISIONS.md deferred to the superseded slice-topology-audit P0 are settled in the 2026-11-18 entry of standards/architecture/DECISIONS.md: the create-package shell is the skeleton law; the source export map is the truth and exact; coverage ratio stays with the coverage ratchet; every package type-checks its test tree; concept-local server/worker shims are not admitted in a model-first context; `.ts` specifiers are codified; a root entry is a pure re-export; the lab client and view-model files are superseded by web bindings and machines and stay until the lab migrates. The 2026-08-30 member-vocabulary and contract sub-choices bind legacy slices only.

Lane claude/model-first-standard-doctrine-b72d36

Reverse: Reopen the rows in a new standards/architecture/DECISIONS.md entry and change the settled answers

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
