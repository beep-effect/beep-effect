# SPEC — Boolean-Creep Eradication

Normative contract for the boolean-creep campaign. Ratified decisions live in
[`DECISIONS.md`](./DECISIONS.md); this spec operationalizes them. Where this
file and `DECISIONS.md` disagree, `DECISIONS.md` wins.

## The smell

"Boolean creep": AI-generated code introduces parallel booleans where the
domain has ONE state variable. `n` correlated booleans represent `2^n` states;
when the domain has `k < 2^n` legal states the type lies, and every reader must
re-derive the exclusivity invariant from write sites.

```ts
// creep — 16 representable states, 5 legal:
type SidebarActive = {
  readonly autocut: boolean
  readonly luts: boolean
  readonly broll: boolean
  readonly settings: boolean
}

// fix — payload-free exclusive variants are a LiteralKit literal, NOT a tagged union:
const SidebarTab = LiteralKit(["autocut", "luts", "broll", "settings"])
type Sidebar = { readonly activeTab: O.Option<typeof SidebarTab.Type> } // Option ⇔ "none active" is legal
```

## Scope

- **Corpus**: `packages/**/src` + `apps/**/src`. Exclude test files, generated
  surfaces (`_generated`, codegen headers), `apps/labs`, `scratchpad/`,
  `.repos/`. Tests are updated by refactors, not scanned as sources of truth.
- **Net** (scanner recall): any set of ≥2 boolean-typed members in one scope —
  a type/interface literal, `S.Struct`, props type, or sibling boolean
  atoms/state fields in one module.
- **Gate** (judge precision): CONFIRMED requires at least one cited evidence
  class E1–E4 with file:line proof (see `DECISIONS.md`). Count alone never
  qualifies. D1/D2 suspects are recorded as `disqualified` for the census.
- **Out of scope**: function flag parameters; driver wire shapes beyond a D2
  census record; uniform target shapes.

## Inventory contract

`data/inventory.jsonl` is the single source of truth for campaign state. One
JSON record per line, validated by
`bun goals/boolean-creep/ops/validate-inventory.ts` against
`boolean-creep-inventory/v1`:

- Common: `schemaVersion`, `id` (unique slug), `file`, `line`, `symbol`,
  `kind` (`schema-struct | type-literal | interface | props | sibling-state |
  class-fields`), `members` (non-empty), optional `notes`.
- Qualified (`status: confirmed | designed | reviewed | applied`): non-empty
  `evidence` (`class` E1–E4 + `cite {file,line}` + `note`), `cardinality`
  (`representable` vs `legal`, gap enforced), `storage` (`stored | derived`),
  `exposure` (`internal | persisted | wire`), `targetShape`
  (`literalkit | tagged-union | option-literal`), `tier` (1 | 2).
- Disqualified (`status: disqualified`): `disqualifier` (`class` D1/D2 +
  `note`). The union makes "disqualified but designed against"
  unrepresentable.

Sweep-lane outputs land under `data/sweeps/round<N>/<lane>.jsonl` in the same
schema and are merged into `data/inventory.jsonl` after orchestrator review
(dedup by file+symbol).

## Pipeline and gates

- **P0 bootstrap** — this packet, seeded inventory (10 confirmed exemplars +
  4 disqualified calibration records, line numbers re-verified), seeded
  `DECISIONS.md`.
- **P1 inventory** — area-scoped headless grok lanes sweep the corpus with the
  net, confirm/disqualify per the gate, write lane JSONL. Loop until dry: keep
  launching rounds until two consecutive rounds surface nothing new. The
  orchestrator spot-checks ~20% of confirmed entries against their cited
  evidence.
- **GATE 1 — Benjamin ratifies the confirmed inventory (and skims the
  disqualified census) before any design work launches.**
- **P2 design** — one codex job (Sol, `--effort medium`) per confirmed
  instance, batched by package/app, writing `designs/<id>.md`: current shape,
  cardinality gap, target schema (schema-first-development doctrine: LiteralKit
  for literal domains, class schemas, derived `S.is` guards), migration of
  every write/read site, guard-deletion accounting, encoded-side impact, test
  impact.
- **P3 review** — orchestrator reviews every design against: taxonomy fit;
  LiteralKit law (no hand-rolled literal unions); derived-vs-stored fidelity;
  encoded-side stability for persisted/wire shapes; guard-deletion accounting
  completeness; blast-radius honesty. Findings per design; codex fixes;
  iterate to zero findings.
- **GATE 2 — Benjamin ratifies the reviewed designs before any refactor is
  applied.**
- **P4 apply** — codex applies by landing tier; `bun run beep yeet`
  repair/verify per batch; each instance's `status` advances as it lands.

## Landing

- **Tier 1** — internal/derived view state (no encoded exposure): batched by
  package/app into a handful of PRs; lands first.
- **Tier 2** — persisted or wire-adjacent shapes (e.g. Yeet `Verdict.ts`,
  whose JSON lives in `.beep/yeet/`): one PR each, with an encoded-compat or
  migration proof (that file's legacy normalizer is the precedent).
- All PRs through yeet; commit messages cite the `boolean-creep` slug;
  **never merge — Benjamin merges.**

## Acceptance

- Inventory validates (`ops/validate-inventory.ts` exit 0) and every confirmed
  entry carries cited, spot-checkable evidence.
- Both user gates were held: no design before GATE 1, no apply before GATE 2.
- Every applied instance's design shows non-empty guard-deletion accounting.
- Tier 2 landings carry an encoded-compat or migration proof.

## Stop conditions

- A sweep lane cannot honor the evidence gate (flooding the inventory with
  ungated suspects) after one prompt correction — stop the lane and report.
- A design requires changing persisted/wire encoded shapes without a viable
  compat proof — park the instance as `confirmed` with a note; report at the
  next gate.
- Verification failures that attribution shows are inherited/unrelated —
  report, do not chase.
