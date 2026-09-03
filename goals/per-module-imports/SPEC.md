# Per-Module Imports Spec

## Objective

Every in-scope import of the `effect` package barrel and the live `@beep`
foundation barrels is rewritten to per-module form and the convention is
enforced by the incumbent toolchain:

```text
import { Effect, pipe } from "effect";      // before
import * as Effect from "effect/Effect";    // after
import { pipe } from "effect/Function";     // after

import { P } from "@beep/utils";                 // before
import * as P from "@beep/utils/Predicate";      // after
```

Namespace re-exports become namespace imports; flat exports (`pipe`, `flow`,
`identity`, `cast`, `dual`, the `thunk*` family, flat schema bindings) become
named imports from their owning module. Barrels remain the public/docgen
surface — the rule bans importing **through** them, not their existence. Mass
migration is gated on a measured pilot.

## Decision Log (grilled 2026-08-23)

| # | Decision | Chosen | Rejected | Rationale |
| --- | --- | --- | --- | --- |
| 1 | Scope | `effect` barrel + live `@beep` foundation barrels; apps, packages, infra, tests | effect-only; every barrel repo-wide | Foundation barrels carry the same module-graph cost; wider scope unbounded |
| 2 | Core-combinator law | Full migration; `pipe`/`flow`/`identity` → named from `effect/Function`; AGENTS.md law rewritten | Keep combinator exception; decide after research | One convention, no allowlist in the rule |
| 3 | Proof | Pilot measured before mass migration (gate below) | Take win as settled; measure after | Proof over assertion; research predicts bundle-neutral outcome |
| 4 | Tool bias | Incumbents first | Best tool wins; hard no-new-tools | Biome/GritQL + scoped ESLint + oxlint already in tree |
| 5 | Barrel fate | Keep barrels, stop importing through them | Deprecate barrels | Public/docgen surface; `export *` codegen continues |
| 6 | Type-only imports | Migrate them too | Runtime-only (upstream `@effect/eslint-plugin` allows type-only barrels) | TS still loads the barrel's type graph; single convention keeps the rule simple |
| 7 | Delivery | Phased package-family batch PRs, warn→error ratchet | Big-bang PR | 17-check merge treadmill; attributable batches |
| 8 | Pilot slice | Research proposes, operator approves at P2 entry | Operator names now | Ranked evidence in `research/pilot-and-measurement.md` |
| 9 | Enforcement (research-settled) | Biome `style/noRestrictedImports`: root `warn`, per-family `error` overrides, final root `error` | New ESLint profile; oxlint native; tsgo fork; ast-grep | Executed proof in `research/tooling-autofix-eval.md`; zero new tools/parses |
| 10 | Migration vehicle (research-settled) | ts-morph command by inverting/generalizing `laws effect-imports` | jscodeshift; ast-grep; `@effect/eslint-plugin` fixer as-is; unbarrel-class tools | Incumbent command owns discovery/check/write/tests and must flip anyway; upstream tools emit the wrong target form |

### P2 Gate Rulings (grilled 2026-09-03)

#### D11 — P2 pilot workspace approval

- **Question:** Which single workspace, if any, may enter the measured P2
  pilot at its complete live migration scope?
- **Answer:** The operator approved `apps/professional-desktop` as the sole P2
  pilot workspace/application. Approval covers every in-scope executable,
  type-only, and JSDoc root import in that workspace, along with the prescribed
  untouched before samples, complete pilot rewrite, equivalent after samples,
  correctness gates, and tracked evidence.
- **Rejected:** Use `apps/oip-web`; pair the pilot with `@beep/schema` or a
  second workspace; stop at P2 without running the experiment; approve only a
  subset of the live Professional Desktop inventory.
- **Rationale:** Professional Desktop is the only ranked candidate that exposes
  compiler, cold Vite-route, cold Vitest-startup, total production-byte, and
  named `effect-vendor` measurements in one bounded executable workspace. The
  live P1 vehicle scan remains fully mechanical: 106 executable files with
  213 root declarations mapped to 505 per-module declarations, plus 25
  JSDoc-bearing files with 41 root declarations mapped to 42 per-module
  declarations, with zero manual reviews or parser warnings. Dependencies,
  measurement conditions, Biome enforcement, architecture doctrine, and every
  outside workspace remain unchanged during the measurement pair.
- **Authority boundary:** This ruling authorizes P2 only. Whether a strictly
  qualifying P2 verdict also constitutes operator sign-off to begin P3 remains
  the next decision in the grilling frontier.

#### D12 — Strict-pass continuation authority

- **Question:** If P2 produces a decisive stable win, all prescribed
  correctness gates pass, and no material regression is present, must the goal
  pause for another operator approval before beginning P3?
- **Answer:** No. The operator pre-authorized a strict pass: a P2 result that
  satisfies every normative qualifying condition is itself the operator
  sign-off to begin P3 without another approval pause.
- **Rejected:** Require a separate post-verdict approval before P3; run and
  record the pilot but never begin P3 from its result.
- **Rationale:** The qualifying conditions and stop rules are objective and
  already fixed by the normative measurement protocol. Conditional authority
  preserves those controls while allowing the persistent goal to continue
  without an avoidable pause.
- **Authority boundary:** A no-win, material regression, correctness failure,
  or unresolved result after the permitted symmetric extension still stops the
  migration. A strict pass authorizes P3 implementation and Yeet publication
  to merge-ready; it does not authorize merging any pull request.
- **Confirmation:** On 2026-09-03 the operator confirmed that D11 and D12,
  together with the unchanged normative P2 protocol and stop rules, are the
  complete shared understanding. The P2 execution gate is open.

#### D13 — Scheduler-lane execution override

- **Question:** May healthy or queued work in other checkouts block P2
  execution and publication?
- **Answer:** No. On 2026-09-03 the operator directed this goal to ignore other
  clones' scheduler lanes, use affected-package filters for checks, and publish
  through Yeet's `--start-pr-early --monitor --pr` path.
- **Rejected:** Continue waiting for a machine-wide empty scheduler before
  collecting P2 evidence or starting publication.
- **Rationale:** The operator prioritized completion and early hosted feedback
  over exclusive local-lane availability. Healthy work remains untouched and
  no lease is killed, reaped, or displaced. The measurement harness still
  records every sample and applies the normative stability, variance,
  regression, and stop rules; scheduler occupancy is not hidden or used to
  relax a verdict threshold.
- **Authority boundary:** The override narrows local verification to affected
  package filters and authorizes early PR creation. It does not authorize a PR
  merge or permit a noisy/inconclusive result to be reclassified as a win.

#### D14 — P2 verdict and required stop

- **Question:** Did the complete Professional Desktop pilot produce the strict
  qualifying pass required to begin P3?
- **Answer:** No. The final valid 15-sample comparison produced no stable
  qualifying improvement and no stable material regression. Nominal source
  check and Vitest movements remained outside the strict no-win band but below
  their required MAD stability floors after the one permitted extension, so
  the normative verdict is **inconclusive — stop**.
- **Evidence:** `history/p2-pilot-verdict.md` records the complete threshold
  math and correctness results; `history/measurements/` contains every valid
  raw sample and stats summary.
- **Authority boundary:** P2 is complete with a recorded stop. D12 did not
  activate, P3 is not authorized, and no mass migration or global enforcement
  flip may proceed. D13 still permits publishing the bounded pilot and evidence
  to merge-ready, but never merging the pull request.

## Non-Goals

- Removing, slimming, or deprecating any barrel (`export *` codegen stays).
- Selling the migration as a production-bundle-size win. Compressed bytes are
  a regression guard; the predicted wins are module-graph time (unbundled
  bun/Node servers, tests), tsserver/tsc, and dev tooling
  (`research/effect-community-guidance.md` §6).
- Adding a permanent lint tool (ast-grep, new native oxlint rules, tsgo fork).
- `@beep/invariant` — no such workspace package exists; the foundation set is
  derived from live `packages/foundation/**` manifests, never hard-coded.
- Changing `standards/architecture/14-ecosystem-packages.md`'s published
  consumer exception.
- Rewriting non-shipping corpus: `scratchpad/`, `explorations/` assets, and
  `goals/*/ops` assets are explicitly excluded from the codemod and the rule.

## Source Hierarchy

1. The grilled decisions above (operator, 2026-08-23).
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`, then `GOAL.md`.
6. `research/` reports (evidence, not law).

## Target Surfaces

- Executable imports: 2,089 `effect`-root + 2,820 foundation-root statements
  at census (`research/import-census.md` §1). These are **gross repository
  totals**: they include excluded corpus (`scratchpad/` 603 statements,
  `explorations/` assets 14, `goals/*/ops` assets 18 — census §4). P1
  publishes the in-scope census baseline (gross and in-scope, with the
  reproduction commands) and acceptance's "zero forbidden specifiers in
  scope" measures against the in-scope baseline. Tests and ecosystem members
  are in scope — the current law's exclusions do not carry over.
- Documentation imports: 3,449 statements in JSDoc `**Example**` fences and
  Markdown/skills fences (docgen compiles the JSDoc ones).
- The mechanical mapping table (`research/import-census.md` §3) — 84/84 effect
  bindings, 33/33 `@beep/utils`, 60 `@beep/schema` — is the codemod's data
  spec. It is **not yet complete for the pilot**: `apps/professional-desktop`
  also imports `@beep/lexical-schema`, `@beep/identity`, `@beep/dock`,
  `@beep/dock-react`, `@beep/observability`, and `@beep/mcp-kit` roots. P1
  extends the table to every in-scope foundation barrel a target family
  imports, generated from each barrel's root-export→leaf graph (census §2
  readiness data) and validated against package export maps; the pilot
  dry-run requires zero unmapped bindings. Preserve local aliases; never
  normalize them.
- Foundation export surfaces needing new public leaves before their consumers
  migrate: `@beep/schema` (`SafeRemoteHost`, `FileDiff`), `@beep/observability`
  (8 modules + `VERSION`), `@beep/dock` (17 modules), `@beep/dock-react` (2),
  `@beep/html` (`Html`, `VERSION`), `@beep/ui` (`VERSION`), plus the `VERSION`
  leaf extractions listed in `research/import-census.md` §2. Every new leaf
  lands in **both** the workspace and `publishConfig` export maps, then
  tsconfig-sync runs.
- Enforcement/laws: `packages/tooling/tool/cli/src/commands/Laws/EffectImports.ts`
  (+ tests, Lint Policy wiring, Yeet repair), `biome.jsonc`, the JSDoc example
  import detector, generator templates (`CreatePackage/templates/*.hbs`,
  `Architecture/internal/PackageShell.ts`, `IdentityExportBlock.ts`), and the
  written-law corpus in the law-flip checklist
  (`research/enforcement-census.md` §B).

## Constraints

- **The existing `laws effect-imports` law actively enforces the opposite
  convention** (rewrites per-module → barrel) and runs in Lint Policy and Yeet
  repair. It must be inverted before the pilot writes a single import — as a
  family-scoped interim mode (promoted-family list, initially empty) so the
  repo-wide Yeet repair `--write` cannot mass-migrate ahead of the P2 gate and
  `--check` stays green on unmigrated families until their batch lands.
- Enforcement config is held identical between pilot before/after states; the
  Biome warn rule lands once, frozen, only after the gate passes.
- Batch ordering (research-settled): pilot → warn rule frozen once → the
  foundation kernel (`@beep/identity` + `@beep/utils` + `@beep/schema` +
  in-scope siblings) as **one** batch (each alone busts a ~230-task graph) →
  vertical families as units → standalone tools/tests/apps, composition roots
  last → single error flip. Record `turbo --dry-run=json` task counts per
  batch before opening its PR.
- Written laws, skills, and generators flip with (not after) enforcement so
  agents are never instructed to reintroduce violations.
- Codemod invariants (`research/import-census.md` §5): AST-based; separate
  code/JSDoc/Markdown modes; merge with existing destination imports; carry
  type-only syntax; default barrel imports map to their named leaves
  (`@beep/chalk` defaults → `@beep/chalk/Chalk`, `@beep/colors` defaults →
  `@beep/colors/Colors`) or join the manual-review queue; manual-review queue
  for dynamic imports, root-surface
  tests, stale doc APIs, deliberate lint fixtures, and missing leaves; fix
  generators before generated files; lockfile stability per batch; idempotence
  proven.
- Never target `effect/internal/*`, any `/index` spelling, or `@beep/*/src/*`;
  every emitted specifier must exist in the target package's export map.

## Pilot Gate (P2)

Research proposes **`apps/professional-desktop`** (rank 1: bundle with a named
`effect-vendor` chunk, cold Vite route readiness, two tsgo programs, Vitest
startup, 103 target files; `research/pilot-and-measurement.md`). Operator
approves the slice at gate entry; `apps/oip-web` is the smaller fallback.

Protocol: the paste-ready gate in `research/pilot-and-measurement.md` §
"Paste-ready measurement gate" is normative — 7-run medians with MAD/IQR for
compiler, cold dev route, and Vitest startup; 5-run production build bytes
(gzip/Brotli, total and `effect-vendor`); raw logs under
`.beep/research/per-module-imports/measurements/{before,after}`; its win /
material-regression / no-win / inconclusive rules decide continuation
verbatim. Watch specifically for Vite `optimizeDeps` fragmentation — deep
imports can regress cold start; a material regression stops the migration.

## Acceptance Criteria

- [x] `laws effect-imports` enforces per-module form (tests, type-only,
      ecosystem included); the reverse conversion and its fixtures are gone;
      Yeet repair and Lint Policy run the new semantics.
- [x] Pilot measured under the protocol; verdict + raw stats recorded in the
      packet; operator sign-off on continuation (or a recorded stop).
- [ ] Post-gate: zero forbidden root specifiers in scope (executable and doc
      fences); Biome rule at root `error` with family overrides removed.
- [x] Foundation leaf exports shipped in both export maps; docgen green.
- [ ] Law-flip checklist (`research/enforcement-census.md` §B) fully applied.
- [ ] Every batch shipped as a PR driven to mergeable via `/yeet`.
- [ ] Closeout reflection passes `bun run beep lint reflection-artifacts`.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/per-module-imports/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/per-module-imports/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/per-module-imports` | Passes |
| Inverted law | `bun run beep laws effect-imports --check` on migrated families | Zero violations |
| Forbidden specifiers | census reproduction commands, `research/import-census.md` | Zero in migrated scope |
| Codemod idempotence | second `--write` run | Zero edits, stable hashes |
| Quality | `bun run beep yeet verify` per batch | Green |
| Docs | `bun run docgen:local` per batch | Green |
| Pilot stats | `stats-*.json` under measurements | Recorded, rules applied |

## Stop Conditions

- Pilot gate returns no-win, unresolved variance, or a material regression.
- A foundation batch's measured CI wave materially exceeds the recorded
  dry-run budget and cannot be attributed.
- Leaf bypass exposes cycles that need design work, not import edits.
- Required source files are missing or materially contradictory.
- Verification requires unnamed credentials, cost, or destructive effects.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| Namespace surface tests importing package roots | `@beep/identity`, `@beep/rdf`, `@beep/semantic-web` test files | P1 | Tests assert `Object.keys(rootNamespace)`; a per-module rewrite cannot preserve the assertion | Redesigned against export contracts, or documented waiver in the enforcement rule |
| Deliberate forbidden-syntax lint fixtures | `packages/tooling/policy-pack/lint-rules/test/**` | standing | Negative fixtures must keep the banned form | Never (they test the rule) |
