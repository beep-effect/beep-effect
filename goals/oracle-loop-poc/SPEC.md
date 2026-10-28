# Oracle Loop POC Spec

## Objective

Prove, in a lab app, that an agent's work product can get compiler-grade backpressure: the
agent writes in the notation it thinks in (Markdown, HTML, or a Word .docx), the text is
admitted into the typed `Doc` hub through a lossless positioned codec, deterministic
findings come back addressed by model path with a derived notation span, the agent repairs
by edit applied through a deterministic splicer, and the loop converges under
pre-registered kill criteria. A generic profile proves the loop; a stacked patent profile
proves that domain rules can be enforced over a primitive document model without the core
learning the domain. The outcome is a go/no-go on promoting the core shapes, not a product.

Graduated from [`explorations/doc-hub-spokes`](../../explorations/doc-hub-spokes/README.md)
on 2026-10-28. Its [`BRIEF.md`](../../explorations/doc-hub-spokes/BRIEF.md),
[`MAP.md`](../../explorations/doc-hub-spokes/MAP.md) and
[`DECISIONS.md`](../../explorations/doc-hub-spokes/DECISIONS.md) (D-01..D-12) are the
provenance; they are linked, not copied.

## Non-Goals

- Merging `@beep/markdown` into `@beep/md`, or any single-AST design
  (effected-promotion D-02 holds).
- POC code in a product app; any change to `apps/professional-desktop` for the POC.
- Re-implementing antecedent-basis or claim-dependency rules;
  `goals/claim-element-antecedent-check` owns them and the POC consumes its findings.
- Vendoring or hardening parse5 (gated goal `html-spoke-parser`).
- The declarative rule DSL and its OWL 2 / SHACL projections (gated goal
  `rule-dsl-projections`).
- Any tier 3 content judgment (novelty, obviousness); the POC gates process only, and only
  to red-team it.
- Full bitemporality; the POC carries a rule version id on every finding and nothing more.
- Streaming validation of partial output; CSS and script spokes; training on the ledger.
- The hub inversion itself (`goals/doc-hub-spokes-inversion`); this POC imports `@beep/md`
  until the rename lands and then rewires imports in one commit.

## Source Hierarchy

1. The operator rulings in `explorations/doc-hub-spokes/DECISIONS.md` (D-01..D-12).
2. `AGENTS.md`, `CLAUDE.md`, and required skills (`effect-first-development`,
   `schema-first-development`, `yeet`, `closeout`, `reflect`).
3. `standards/ARCHITECTURE.md`, `standards/architecture/07-non-slice-families.md`,
   `apps/labs/README.md`.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. `research/SOURCES.md`, the exploration's `research/` (panel reviews, notes, prior-art
   report), `ops/`, `history/`.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `apps/labs/oracle-loop` (new, via `bun run beep create-package oracle-loop --type app --lab`
  only). Third-party dependencies are allowed in this app and any lab-local package it owns
  (D-02): parse5 at minimum; Pandoc is invoked through `@beep/pandoc-ast`.
- Read-only reuse of `@beep/md`, `@beep/markdown`, `@beep/html`, `@beep/pandoc-ast`,
  `@beep/provenance`, `@beep/epistemics`, `@beep/law-practice-domain` and
  `@beep/law-practice-use-cases` (the `ClaimSelfCheck` finding stream),
  `packages/agents/server/src/AssistantTurn/BlockRepair.ts` (as the JSON Patch baseline),
  and the `@beep/shacl`, `@beep/n3`, `@beep/oxigraph` drivers if obligations are reached.
- `explorations/doc-hub-spokes/research/OPPORTUNITIES.md` for friction receipts.
- This packet's `history/` for run evidence, and `SPEC.md` Decision Log.

## Constraints

- **Core stays domain-free (D-01).** The patent profile may not add node kinds, fields or
  vocabulary to the hub model. Domain structure is a separate graph keyed to `Doc` nodes by
  model path (D-09).
- **Finding address is a model path; the span is derived per codec (D-08).** Codecs with
  offsets (`@beep/markdown`, parse5) project through their source map; the Pandoc spoke
  projects to block/inline coordinates. A finding without a location is a defect.
- **Every judge emits one `Finding` shape**: location, rule id with version, severity,
  message, evidence, judge identity, confidence (deterministic judges report 1), repair
  applicability (safe / suggestion / none), and optional fix edits. Routing, display and
  ledgering never branch on judge kind; an `Obligation` declares which judge classes may
  discharge it.
- **Coverage is emitted beside findings**: which paths which rules examined, which are
  known-unchecked. `pattern-not-covered` from the antecedent checker maps to coverage.
- **Witnesses are runtime-minted** (receipt-shaped like `TextAnchorVerificationReceipt`);
  an agent never writes its own provenance. Judge attempts per obligation are capped.
- **Precision bar before a rule enters the loop**: hand-labelled sample; under 10%
  effective false positives for advisory findings, essentially zero for blocking ones;
  scored at location level. A rule below the bar stays out, recorded in the Decision Log.
- **Repair order**: deterministic fix first where the rule provides one; otherwise the agent
  proposes edits and a deterministic splicer applies them (`MarkdownEdit` for Markdown,
  path-addressed replacement for Pandoc); regeneration is the fallback arm, never the
  default. Findings are mapped through the agent's own edits before fingerprint staleness.
- **At least one repair carries a frame condition**: protected commitments (named spans or
  paths the agent may not delete) survive, or the repair is rejected as a finding.
- **Vacuity test**: oracle-driven output must not be measurably narrower or shorter than the
  no-oracle arm; a narrowing that clears findings is recorded as a failure, not a success.
- **`SafeDocument` keeps hub-native rules only (D-10)**; the html spoke proves heading order
  and other conformance at projection time.
- **Public material only**: granted claims, published applications, PEDANTIC, USPTO Office
  Action datasets. Nothing from the out-of-repo corpus. Confirm PEDANTIC's license before
  use; if unavailable, the mutation corpus from public claim sets stands alone.
- **Routing doctrine**: Opus 5.5 children; Codex `gpt-6.1-sol` medium as the fallback; the
  Cursor seat is unavailable until 2026-11-11; no new paid endpoints.
- Effect v4, schema-first, `effect/*` leaf imports, `LiteralKit` for literal domains, no
  native `Set`/`Map`, JSDoc per `.patterns/jsdoc-documentation.md`.

## Acceptance Criteria

- [ ] `apps/labs/oracle-loop` exists via `create-package --lab` and passes
      `bun run beep quality package-verify` for every package it owns.
- [ ] First vertical slice (MAP "days 1 to 5"): Markdown in, generic profile, findings with
      model path and derived span, splice repair, incremental re-validation, coverage map,
      one frame condition, harness metrics recorded; compared against the regenerate arm.
- [ ] HTML codec via parse5 with `sourceCodeLocationInfo` and `onParseError`, folded into
      the `@beep/html` model and the hub, with a loss ledger row per unsupported construct.
- [ ] .docx codec via Pandoc and `@beep/pandoc-ast`, with path-addressed findings.
- [ ] Patent profile stacked on the same documents (including a .docx claim set),
      consuming `claim-element-antecedent-check` findings; the `Finding` shape unchanged by
      stacking, or the change recorded in the ledger as a core finding.
- [ ] Four repair arms measured on held-out documents with the pre-registered kill
      criteria: convergence in three rounds at or above 60%, precision at or above the bar,
      vacuity test passed, stale-finding rate reported.
- [ ] Red-team: an agent told only a process gate cannot clear it with garbage in an
      afternoon, or the failure is recorded and `process-admissibility-gate` stays gated.
- [ ] A go/no-go verdict with evidence in `history/`, and the gated MAP rows updated in the
      exploration (`html-spoke-parser`, `doc-core-promotion`).
- [ ] Thread-style page rendering findings inline on spans with live repair (after the
      harness converges; may ship in a follow-up PR of this goal).
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/oracle-loop-poc/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/oracle-loop-poc/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/oracle-loop-poc` | Passes |
| Lab package verify | `bun run beep quality package-verify @beep/oracle-loop` (name per scaffold) | Passes |
| Harness run | `history/<date>-harness-run.md` with the four-arm metrics table | Present, numbers stated |
| Precision sample | `history/<date>-precision-sample.md` with hand labels | At or above the bar, or the rule excluded |
| Red-team | `history/<date>-redteam.md` | Verdict recorded |
| Reflection | `bun run beep lint reflection-artifacts` | Passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each in the Decision Log.

## Decision Log

| Date | Decision | Reason | How to reverse |
| --- | --- | --- | --- |
| 2026-10-28 | Inherits exploration D-01..D-12 (agent output is the center; lab app POC with third-party deps; harness loop first; `@beep/doc`; parse5 in the lab; profile 2 consumes the antecedent checker; .docx is in scope; model-path-first findings; separate domain graph; spokes prove their projections; Pandoc intake; lab named `oracle-loop`). | Graduation seeds the contract from the exploration's rulings. | Reopen the exploration at decompose and amend. |

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| Third-party runtime dependencies in a lab app (parse5 at minimum) | `apps/labs/oracle-loop` and lab-local packages | this goal | Operator ruling D-02: a POC validates by building from available pieces | `html-spoke-parser` graduates and vendors the parser |
