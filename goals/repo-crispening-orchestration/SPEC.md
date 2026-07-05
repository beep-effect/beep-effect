# SPEC — Repo Crispening Orchestration

This is the normative source of truth for the goal. Agents MUST obey it exactly.
When this document and a sub-agent prompt disagree, this document wins.
Authored 2026-07-05 from `research/decisions-locked.md` (decisions D1–D5, grill
outcomes G1–G7 — locked, do not reopen) and
`research/prompt-2026-07-05.md` (provenance).

## Objective

Run a repo-wide crispening, driven from this packet: push every invariant and
pure behavior into `effect/Schema` and onto the data — schema-as-truth,
defaults/normalization/Option in schemas, tagged-union discrimination,
colocated statics, precision + annotations — so business-logic modules read as
pure intent (per `.claude/skills/crispen/SKILL.md`).

The end state is durable and self-enforcing, not a one-time sweep:

- Four novel lint cards (`SFV4-fn-schema`, `SFV4-normalization`,
  `SFV4-null-return`, `SFV4-getsomes-struct`) live as real AST detectors in
  `bun run beep lint schema-first`.
- A per-owner blocking policy ratchet
  (`standards/schema-crispening.policy.jsonc`) flips each family to blocking
  after its remediation wave goes green, so regressions hard-fail lint and
  `bun run beep yeet verify` forever after.
- The Law 20/47 amendment and the consolidated
  `standards/architecture/DECISIONS.md` entry make the doctrine survivable
  without this packet.
- `standards/schema-catalog.generated.jsonc` catalogs the crispened schema
  surface.

Remediation runs in bounded, family-scoped waves gated by
`bun run beep yeet verify`, in the order foundation → drivers → tooling →
apps/slices (G2); the first foundation/modeling wave doubles as the pilot
(e.g. `@beep/md` or `@beep/lexical`).

## Non-Goals

The nine §6 fences, verbatim from `research/decisions-locked.md`. Violating any
fence is a review-blocking defect and a stop condition.

1. Service-contract/interface carve-out: service shapes and port interfaces stay
   interfaces; crispening does not schema-ify service contracts.
2. SQL absence encodes `null`: persisted-model columns keep `null` at the wire;
   Option lives at the domain boundary, not in the row codec.
3. No error-tag merging: distinct tagged errors stay distinct.
4. No trust-boundary weakening: escaping, sanitization, URL/injection guards
   stay explicit and property-tested.
5. No `declare namespace` recursion blocks touched: `Type`/`Encoded` namespace
   blocks required for `S.suspend` mutual recursion are load-bearing.
6. No `Graph`/`MutableHash*` schema-ification.
7. No native-collection migration — that is `effect-native-migration`'s seam.
8. Touch-scoped waves: each wave edits only its family's packages.
9. No public-form change without the same-PR consumer sweep (§5.4).

Fence 8 scopes **source edits**. Updating the orchestrator-owned artifacts —
`standards/schema-crispening.policy.jsonc` (family flip),
`standards/schema-first.inventory.jsonc` (exception ledger), and this
packet's own `ops/` files (`progress.json`, burndown) — from a wave PR is
required bookkeeping, not a fence violation.

## Source Hierarchy

1. User objective (the 2026-07-05 authoring prompt, archived in
   `research/prompt-2026-07-05.md`).
2. `AGENTS.md`, `CLAUDE.md`, and required skills (`crispen`,
   `effect-first-development`, `schema-first-development`, `yeet`).
3. Governing architecture/package standards and
   `research/decisions-locked.md` (locked decisions outrank everything below).
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- First-party source under `packages/**` and `apps/**` (plus `infra/**`,
  which is inside the schema-first lint scope — `INCLUDED_GLOBS` in
  `SchemaFirst.ts` includes `infra/**/*.ts`), minus generated code. Hard
  exclusions (never edit, never scan for findings): `.repos/**`,
  `**/dist/**`, `**/build/**`, `node_modules/**`, docgen output, and any
  generated files. The exclusion bars smell-scanning and edits only —
  **read-only API verification against `.repos/effect-v4` is required and
  explicitly allowed**; the two instructions are not in conflict.
- Enforcement surfaces (P0):
  `packages/tooling/tool/cli/src/commands/Lint/SchemaFirst.ts` (novel cards),
  `standards/schema-crispening.policy.jsonc` (new),
  `standards/schema-first.inventory.jsonc` (baseline + exceptions),
  `.claude/skills/effect-first-development/SKILL.md` and mirrors (Law 20/47
  amendment), `standards/architecture/DECISIONS.md` (consolidated sanction).
- Catalog output (P3): `standards/schema-catalog.generated.jsonc` — tracked in
  git; `docs/generated/` is gitignored, so the catalog cannot live there (G7).
- This packet's own files under `goals/repo-crispening-orchestration/`.

## Constraints

All decisions below are locked in `research/decisions-locked.md`; amendments
require a superseding entry in `standards/architecture/DECISIONS.md`.

### Pre-settled decisions (D1–D5)

| # | Constraint |
| --- | --- |
| D1 | Orchestrate + add novel. Reuse the existing SFV4-* rule cards; cross-link (never supersede) the sibling packets listed under Related Packets. |
| D2 | Specialists find / package-agents fix. Five read-only per-topic discovery specialists (S1–S5); exactly one writer agent per package during remediation waves. |
| D3 | Enforce-first, then bounded waves. P0 enforce → P1 baseline → P1.5 mechanize → P2 waves → P3 catalog → P4 close. No remediation before enforcement + baseline exist. |
| D4 | Five specialist domains S1–S5 (see Rule Cards). |
| D5 | Amend effect-first Law 20 & Law 47 (and mirrors) *before* the `R.getSomes` → `O.getSomesStruct` sweep runs. |

### Execution disciplines (§5, binding on all waves)

| § | Discipline |
| --- | --- |
| 5.1 | Definition of Done — see the section below. |
| 5.3 | Behavior-parity proof: encoded/wire snapshot byte-identical before vs after (SQL row shape for persisted models); at least one `S.toArbitrary` round-trip law per absorbed invariant. |
| 5.4 | Ripple protocol: any public-form change ships the consumer sweep in the same PR — no deferred call-site fixes. |
| 5.5 | Inventory record shape: every discovery finding is `{ ruleId, file, line, symbol, smell, proposedTarget, confidence (0–1), mechanization ("codemod"\|"assisted"\|"judgment"), roiRank, exception? }`. |

### Grill outcomes (G1–G7, summarized — full rulings in decisions-locked.md)

| # | Constraint |
| --- | --- |
| G1 | Slug is `repo-crispening-orchestration` (no collision among existing `goals/` slugs). |
| G2 | Wave order: foundation → drivers → tooling → apps/slices, ROI-front-loaded; pilot = one foundation/modeling exemplar package; first wave doubles as pilot. |
| G3 | All four novel lint cards ship as real AST detectors in P0. `SFV4-type-alias` is dropped — redundant with existing `detectInterfaceReason` / `detectTypeAliasReason` / `detectStructReason` (`packages/tooling/tool/cli/src/commands/Lint/SchemaFirst.ts:447/460/508`). |
| G4 | Ratchet = per-owner blocking policy, built in P0. Today advisory inventory entries hard-fail repo-wide (`schemaFirstLintHasFailures`, `SchemaFirst.ts:1464-1477`, counts `activeAdvisories`); no per-path severity exists. P0 adds `standards/schema-crispening.policy.jsonc` (owner/family → blocking flag) and extends `schemaFirstLintHasFailures` to consult it. New cards land non-blocking; each family flips to blocking after its wave goes green. |
| G5 | Codemod-vs-agent threshold: 0.9/0.6 two-tier. Confidence ≥ 0.9 → pure codemod; 0.6–0.9 → codemod proposes + agent reviews each diff; < 0.6 → judgment-only. Encoded in the §5.5 record and the codemod triage table (`ops/codemods/README.md`). |
| G6 | Doctrine sanction: one consolidated ADR entry in `standards/architecture/DECISIONS.md` (P0) sanctioning (a) family-scoped waves vs the cleanup-on-touch bucket rule, (b) the per-owner blocking policy, (c) the Law 20/47 amendment — prefer `O.getSomesStruct` for heterogeneous struct-spreads; keep `R.getSomes` for homogeneous dictionaries. |
| G7 | Catalog path: `standards/schema-catalog.generated.jsonc`, tracked in git. |

Additional binding constraints:

- The crispen doctrine governs how absorption happens: climb the crispening
  ladder, stop at the first rung that removes the noise, and honor its
  "when NOT to crispen" list (which the §6 fences codify).
- Training-data priors are Effect v3; this repo is Effect v4. `.repos/effect-v4`
  is the source of truth. Every discovery and remediation agent embeds the
  Verified API Corrections table below and re-verifies symbols with `rg`
  before citing them.
- Canonical machine family keys: `foundation` / `drivers` / `tooling` /
  `apps-slices` ("apps/slices" is display prose only). The policy file,
  `ops/progress.json`, and `ops/inventory/` use the machine keys everywhere.
  `packages/shared/**` and `infra/**` receive their wave-family assignment at
  P1 baseline, recorded in `ops/progress.json`; until assigned they are
  non-blocking, and no finding may end up outside the ratchet. Policy shape
  and the owner→family resolution rule live in `PLAN.md` "Policy Ratchet
  Shape (G4)".

## Rule Cards — Specialist Domains S1–S5

Each specialist is a read-only discovery agent (D2). Findings use the §5.5
record shape and land in `ops/inventory/<Sn>/<pkg>.json`. Existing rule ids
below are the nine defined in the `SchemaFirstPolicyRuleId` LiteralKit at
`packages/tooling/tool/cli/src/commands/Lint/SchemaFirst.ts:113-123`:
`schema-first-inventory`, `literal-kit-const-assertion`, `SFV4-defaults`,
`SFV4-static-api`, `SFV4-precision-audit`, `SFV4-arbitrary-tests`,
`SFV4-equivalence`, `SFV4-numeric-domain`, `SFV4-boundary-codec`. A fifth
novel card, `SFV4-type-alias`, was considered and DROPPED as redundant with
the existing interface/type-alias/struct detectors (G3).

### S1 — Schema-as-truth

- Scope: invariants that belong in schemas; decode/guard helper walls; function
  contracts not carried by schemas; hand-rolled validation.
- Smells: top-of-file `const isX = S.is(X)` / `const decodeX = ...` walls;
  exported functions whose parameter/return contracts duplicate a schema or
  should be one; imperative validation that a refinement, brand, or check
  already expresses; ad-hoc parsing where a schema codec is a direct fit.
- Reuses: `schema-first-inventory` (exported interface/type-alias/struct
  detectors), `SFV4-boundary-codec` (ad-hoc `JSON.parse` near schema-fit
  boundaries).
- Novel card: **`SFV4-fn-schema`** — exported functions in schema-modeled
  files whose contracts bypass an available (or plainly warranted) schema.

### S2 — Defaults, normalization, Option

- Scope: no `*Defaults` spreads; nullish → Option; normalization in codecs.
- Smells: `...somethingDefaults` spreads and `?? d` fallbacks where
  `S.withConstructorDefault` / decoding defaults /
  `SchemaUtils.withKeyDefaults` belong; `| null` / `| undefined` unions in
  domain code instead of `S.OptionFromNullOr` / `S.OptionFromOptionalKey`;
  trim/lowercase/clamp/coerce normalization living in business logic instead of
  schema transformations; helpers returning `null`/`undefined` instead of
  `Option`.
- Reuses: `SFV4-defaults`.
- Novel cards: **`SFV4-normalization`** (normalization logic outside codecs),
  **`SFV4-null-return`** (`null`/`undefined`-returning helpers in domain code).

### S3 — Discrimination & exhaustiveness

- Scope: tagged unions, `Match.tagsExhaustive`, literal kits.
- Smells: undiscriminated unions; `switch`/if-chains over `_tag`-like
  discriminators where derived `match`/`guards` exist; duplicate literal
  families (parallel literal arrays + enum objects + ad-hoc guards) that
  collapse into `LiteralKit` / `MappedLiteralKit`; heterogeneous Option-struct
  spreads using `R.getSomes` where `O.getSomesStruct` is the fit
  (`packages/foundation/modeling/utils/src/Option.ts:102`).
- Reuses: `SFV4-static-api` (manual discriminator branching),
  `literal-kit-const-assertion`.
- Novel card: **`SFV4-getsomes-struct`** — `R.getSomes` applied to
  heterogeneous Option-structs; sweep runs only after the Law 20/47 amendment
  merges (D5).

### S4 — Colocation & pipeability

- Scope: statics on the data, `SchemaUtils.withCodecStatics`, dual arity, flow.
- Smells: behavior separated from its data; branded/union consts missing
  `withCodecStatics`; statics lost by piping `S.Class`/`S.TaggedClass` (fix:
  in-body `static readonly is = S.is(Self)`); public 2–3-arg helpers that are
  not `dual`; passthrough `pipe` lambdas that should be `flow(...)`.
- Reuses: `SFV4-static-api` (duplicate decode/encode/guard/constructor helpers
  where schema-derived statics exist).
- Novel card: none — reuse only.

### S5 — Precision, testing, annotations

- Scope: brands, `S.toArbitrary` laws, `$I.annote*` annotations.
- Smells: unbranded broad primitives on domain fields; reusable schemas without
  `$I.annote` / `$I.annoteSchema` / `$I.annoteKey`; absorptions without a
  `S.toArbitrary` round-trip law; hand-written equality where
  `S.toEquivalence` applies; broad numeric fields without `S.Int` / `S.Finite`
  / range checks.
- Reuses: `SFV4-precision-audit`, `SFV4-arbitrary-tests`, `SFV4-equivalence`,
  `SFV4-numeric-domain`.
- Novel card: none — reuse only.

## Verified API Corrections

Copied from `research/decisions-locked.md` §2. Every drafting and discovery
agent embeds this table and re-verifies symbols with `rg` before citing them.

| Claim your training data makes | Verified v4 / repo reality |
|--------------------------------|----------------------------|
| `EffectSchema` is a value/schema | **`EffectSchema` is a FACTORY** — call it to build the schema. |
| `PromiseSchema` is a factory | **`PromiseSchema` is a VALUE.** |
| `.implement` returns a plain function | Use the split: **`.implementSync`** (sync fn), **`.implement`**, **`.implementEffect`** (Effect-returning) — check the signature at the definition, do not assume. |
| LiteralKit and MappedLiteralKit share an API | **API split:** `LiteralKit([...])` → `.Options`/`.Enum`/`.is`/`.$match`/`.toTaggedUnion`; `MappedLiteralKit` → `.From.Enum`/`.To.Enum` reversible code map. Numeric/boolean literal keys are stringified (`.Enum.number1`). |
| `Option.getSomes` exists on `effect/Option` | **It does not.** The struct form is repo-added: `O.getSomesStruct` at `packages/foundation/modeling/utils/src/Option.ts:102` (re-exported via `@beep/utils` aliases; already used in `drivers/acp` + `drivers/firecrawl`). `R.getSomes` (from `effect/Record`) is the homogeneous-dictionary form. |
| `S.TaggedUnion` / `S.toTaggedUnion` interchangeable | **Distinct:** `S.TaggedUnion` constructs; `.toTaggedUnion` derives from a kit. Verify per call site. |
| `annotations` always present on AST nodes | **`annotations` needs `?.`** — optional access. |
| v3 combinators (`Effect.catchAll`, `Schema.decode`, …) | v3 tells. Use v4 forms (`S.decodeUnknownEffect` / `S.decodeEffect`, current error-handling combinators). Any of these surviving in packet prose or prompts is a review-blocking defect. |

## Definition of Done (§5.1)

The goal is done when all of the following hold:

1. Zero actionable S1–S5 findings per family, or a documented exception per
   the Exception Ledger.
2. The four novel cards are live AST detectors and are **blocking** on every
   crispened family via `standards/schema-crispening.policy.jsonc`.
3. The Law 20/47 amendment (and mirrors) is merged, alongside the consolidated
   `standards/architecture/DECISIONS.md` entry.
4. `standards/schema-catalog.generated.jsonc` is generated and tracked.

## Acceptance Criteria

- [ ] `bun run beep lint schema-first` reports the four novel rule ids as
      recognized cards; a fixture violation for each produces a structured
      `[schema-first:issue]` finding routed through Yeet with the correct
      ruleId.
- [ ] `standards/schema-crispening.policy.jsonc` exists;
      `schemaFirstLintHasFailures` consults it; every crispened family's flag
      is `blocking`, with a regression fixture per flipped family.
- [ ] For each family: zero actionable S1–S5 findings, or a
      `status: "exception"` entry in `standards/schema-first.inventory.jsonc`
      with owner + reason.
- [ ] Every wave PR carries its §5.3 parity proof (byte-identical
      encoded/wire snapshot; SQL row shape for persisted models) and at least
      one `S.toArbitrary` round-trip law per absorbed invariant.
- [ ] Every public-form change shipped with its same-PR consumer sweep (§5.4).
- [ ] Law 20/47 amendment merged in
      `.claude/skills/effect-first-development/SKILL.md` and all mirrors;
      consolidated ADR entry present in `standards/architecture/DECISIONS.md`.
- [ ] `standards/schema-catalog.generated.jsonc` exists, is tracked, and
      regenerates cleanly from the P3 `beep` command.
- [ ] `bun run beep yeet verify` green at every wave gate and at close.
- [ ] No unrelated refactors or formatting churn; no fence (Non-Goals 1–9)
      violated anywhere in the diff history.

## Verification Matrix

| Claim class | Command or evidence | Required result |
| --- | --- | --- |
| Family findings burndown | `bun run beep lint schema-first` | Zero actionable findings per crispened family, or ledgered exception |
| Novel cards live | Fixture test per card + `bun run beep lint schema-first` on the fixture | Structured finding with the novel ruleId, category `schema-first-policy` |
| Policy ratchet | `jq` read of `standards/schema-crispening.policy.jsonc` + a deliberate regression fixture | Family flag `blocking`; regression hard-fails lint |
| Behavior parity (§5.3) | Encoded/wire snapshot diff in the wave PR (SQL row shape for persisted models) | Byte-identical before vs after |
| Absorption laws (§5.3) | `S.toArbitrary` round-trip property test per absorbed invariant (`@effect/vitest`) | Passing; fails if the absorbed invariant breaks |
| Crispening governance | `bun run beep laws terse-effect --check` · `bun run beep laws dual-arity --check` · `bun run beep laws effect-fn --check` · `bun run beep laws native-runtime --check` · `bun run beep laws effect-imports --check` | All pass |
| Schema topology | `bun run beep lint schema-topology` | Passes |
| Full quality proof | `bun run beep yeet verify` | Green at every wave gate |
| Catalog | Regenerate `standards/schema-catalog.generated.jsonc`; `git diff` | Clean regeneration, tracked file |
| Packet launcher size | `test "$(wc -m < goals/repo-crispening-orchestration/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/repo-crispening-orchestration/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/repo-crispening-orchestration` | Passes |

## Stop Conditions

Halt the current wave (do not advance to dependents) when any of the following
occurs; record the blocker in `ops/progress.json` and report:

- A §5.3 parity proof fails: the encoded/wire snapshot is not byte-identical,
  or a persisted model's SQL row shape drifts.
- The §5.4 ripple sweep would exceed the wave's family packages
  (fence 8): stop and re-scope the wave rather than widen the touch set.
- Any Non-Goals fence (1–9) would be violated by the proposed change.
- `bun run beep yeet verify` is red at the wave gate and repair does not
  restore green within the wave.
- The `SFV4-getsomes-struct` sweep is reached before the Law 20/47 amendment
  has merged (D5 ordering).
- Required source files are missing or materially contradictory, the work
  would exceed named scope, verification requires credentials/cost/destructive
  side effects not named here, or the same blocker repeats after reasonable
  investigation.

## Exception Ledger

Exceptions are recorded, not implied:

- Discovery-time: a specialist marks a finding non-actionable via the
  `exception?` field of the §5.5 inventory record, with a reason.
- Durable: accepted exceptions are promoted to
  `standards/schema-first.inventory.jsonc` as `status: "exception"` entries in
  the established shape
  `{ file, symbol, kind, status, ruleId?, line?, owner, reason }`
  (entry key `file::symbol::kind::ruleId::line`, per
  `packages/tooling/tool/cli/src/commands/Lint/SchemaFirst.ts:280`). `owner`
  is the owning package (e.g. `@beep/agents-domain`); `reason` states why the
  full exception is correct, not merely convenient.
- A family counts as done under §5.1 only when every remaining finding is
  either fixed or ledgered this way.

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None yet | N/A | N/A | Populated during P1 baseline and P2 waves | N/A |

## Related Packets

Cross-link, do NOT supersede (D1):

- `goals/schema-first-v4-capabilities` — owns the nine existing SFV4-* rule
  cards and the capability doctrine; this packet reuses those cards and adds
  four novel ones.
- `goals/schema-first-zero-actionables` — owns the baseline→zero +
  false-positive-audit method; this packet applies that method per family.
- `goals/effect-native-migration` — owns native-collection migration
  (`Map`/`Set`/`Date`/`JSON`/…); fence 7 keeps that seam entirely theirs.
- `goals/beep-schema-topology` — owns `@beep/schema` canonical topology;
  crispening respects `bun run beep lint schema-topology` and never
  restructures the schema package layout.
