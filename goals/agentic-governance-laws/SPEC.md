# Agentic Governance Laws Spec

## Objective

Give three repo-wide governance laws an owner, and give each one enforcement
that can fail. Laws without an owner stay prose; this packet is the owner.

1. **Rule 5 — a minting process cannot raise its own ceiling.** An authority
   ceiling is declarable on the minted artifact (`declaredCeiling`, optional)
   and effective authority is computed at use time as the minimum of the
   declared ceiling and the ambient session ceiling, with an absent
   declaration meaning most-restrictive. The law holds **by construction**:
   the clamp comes from the consuming context, so a generous declaration buys
   the minter nothing. The schema is the enforcement.
2. **Per-edge lifetime caps with recorded stop reasons.** Every capped walk
   declares per-**edge** lifetime caps and records why it stopped —
   `completed`, `cap-reached`, or `blocked` — where `cap-reached` is a normal
   outcome, not an error.
3. **Law-scanner non-vacuity.** Every law scanner asserts that its own scan
   matched non-zero coverage, so a glob that resolves to nothing fails loudly
   instead of reporting the repo law-clean forever.

Laws 2 and 3 land as **scanners with violating fixtures, never prose alone** —
a law whose violation is not demonstrable is a comment. Law 1 is different by
design: its enforcement is the schema plus the existing runtime clamp, and any
scan for schema-bypassing sites is belt-and-suspenders lint, not the mechanism.

## Decision Log (binding — from the graduated exploration)

Full grill log with rationale:
[`explorations/graphnosis-prior-art/DECISIONS.md`](../../explorations/graphnosis-prior-art/DECISIONS.md).
Links, not copies — the exploration's entries stay canonical. Normative here:

1. **2026-08-06 — packet shape (Q1).** The exploration dissolves into
   amendments with exactly two graduations; this packet is the second, the
   repo-law bundle. It exists because *no active packet owns any of the three
   laws*, and folding them into standards prose would leave nobody owning
   proof that the laws are enforced.
2. **2026-08-06 — authority ceiling placement (Q3).** Both artifact and
   session, and the artifact's declaration may only lower. Effective authority
   is `min(declared ceiling, ambient session ceiling)` under the ceiling
   order; absence means most-restrictive. Session-only was rejected because
   the restriction does not travel with a borrowed or exported artifact;
   artifact-only was rejected because it violates Rule 5 outright. TierGate
   already owns the enforcement half in-tree; this packet adds the
   declaration half and the min-composition.
3. **2026-08-06 — DeterminismTier timing (Q6).** A determinism-tier
   declaration lands only in the same PR as the golden vectors that can
   falsify it. Declaring a surface deterministic and shipping its
   golden-vector test are one change; a tier nothing can test is a comment,
   not a contract. **This packet's standards edit is Q6's only owner** — no
   amendment in the exploration's ledger carries it.
4. **2026-08-06 — loop caps before adherence (Q8).** Caps first, adherence
   second. The ordering is a data dependency, not prudence: the adherence
   instrument consumes the stop-reason records the caps produce, and without a
   declared cap there is no reference line to measure deviation against. The
   instrument is a Non-Goal here.
5. **Design order (standing repo law).** Schema → Effect `Context.Service`
   contract → implementation. The ceiling declaration schema and `StopReason`
   are written before any consumer of either.

## Non-Goals

- **No control-plane surface.**
  [`explorations/agent-governance-control-plane`](../../explorations/agent-governance-control-plane/README.md)
  is adjacent territory. This packet owns *laws and their scanners* — the
  ceiling declaration schema, the caps vocabulary, and non-vacuity. It does
  **not** own any control-plane surface, policy UI, or runtime beyond the
  TierGate clamp that already ships.
- **No adherence instrument** (Q8). Designing "what counts as deviation" now
  would stall a short safety law on an open metrics argument.
- **No Q10 envelope-contract work.** The versioned-artifact-envelope
  standards paragraph lands in the exploration's amendment-application pass,
  not here, and a packet-shaped envelope contract is explicitly rejected until
  a concrete format needs it.
- **No graded sensitivity taxonomy** (Q5 chose binary-at-egress). It is not
  part of this graduation and arrives only with evidence, on the
  ingestion-secret-scrub amendment.
- **No donor or Chronocept numbers in this SPEC or any artifact it produces.**
  The quantitative quarantine in the exploration's provenance ledger travels
  into this packet intact.
- **No verbatim ports — clean-room only.** If any port becomes verbatim,
  Apache-2.0 attribution attaches and must be recorded in
  [`research/SOURCES.md`](./research/SOURCES.md).
- **No re-litigation of the exploration's decisions.** Q1/Q3/Q6/Q8 are
  settled inputs; changing one is a new decision entry with its own rationale,
  not a silent drift.
- **No LawScan code fix in this packet's first slice.** The
  `LawScan.ts` non-vacuity fix lands earlier, in the exploration's
  amendment-application PR stage. This packet states the law, ships the
  violating fixture, and cites the landed fix as proof the law is enforceable.
  One landing, not two.

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

- **`standards/`** — the three law statements plus the Q6 determinism-tier
  sentence. This is the packet's only prose surface and its smallest slice.
- **The law-scanner surface**,
  `packages/tooling/tool/cli/src/commands/Laws/` — four scan paths, one
  non-vacuity assertion each (verified live 2026-08-06, see Constraints).
- **A ceiling declaration schema** in the slice that owns the first
  declaration site. **The site is chosen during this packet's own shaping.**
  The exploration's mining offers no verified candidate — its `EdgeAuthority`
  amendment concerns the valid-interval invariant, not ceilings — so naming a
  site here would be invention, and this SPEC deliberately does not.
- **A `StopReason` vocabulary** as a `LiteralKit`, sited with the walk
  contract it bounds. `packages/agents/domain/src/entities/Skill/Skill.model.ts`
  (47 lines, `{fixtureKey, name}`) is the stub that adopts this shape when it
  grows; it is a future consumer, not a surface this packet edits.
- **Violating fixtures** under `packages/tooling/tool/cli/test/` — the
  deliberately-vacuous scan fixture, and a cap fixture that stops for each
  declared reason.

## Constraints

- **Effect v4 only**, schema-first. `LiteralKit` from `@beep/schema` for every
  literal union — never a hand-rolled union of literals. `TierGateSettlement`
  (`packages/foundation/capability/mcp-kit/src/TierGate.ts:58`) is the shape
  precedent: a `LiteralKit` piped through `$I.annoteSchema`. `StopReason` is
  the same shape with a different alphabet:

  ```ts
  export const StopReason = LiteralKit(["completed", "cap-reached", "blocked"]).pipe(
    $I.annoteSchema("StopReason", {
      description: "Why a capped walk stopped. cap-reached is a normal outcome, not an error.",
    })
  );
  ```

  Fat-marker only — field names, homes, and the walk contract itself are the
  implementing session's calls.
- **Rule 5's clamp already exists and must not be weakened.** `TierGateShape`
  (`TierGate.ts`, 626 lines) declares `evaluate`/`recordOutcome`;
  `packages/epistemic/server/src/GovernedTierGate/GovernedTierGate.gate.ts`
  (507 lines, `makeGovernedTierGate` at `:238`, `evaluate` at `:342`)
  implements it write-ahead and fail-closed. This packet adds the declaration
  half; it does not restructure the gate.
- **Four scan paths, not one choke point.** Verified against the live tree on
  2026-08-06:

  | Scan path | Entry | Covers |
  | --- | --- | --- |
  | `internal/LawScan.ts` `runLawScan` (`:149-183`) | `EffectFn.ts:396`, `FrozenGrantSet.ts:331` | 2 laws |
  | `EffectImports.ts:137` | `project.getSourceFiles()` filtered directly | 1 law |
  | `TerseEffect.ts:592` | `project.getSourceFiles()` filtered directly | 1 law |
  | `NoNativeRuntime.ts:589` | its own accumulation loop, summary at `:689` | 1 law |

  `AllowlistCheck.ts` and `SchemaDiagnostics.ts` are **not** corpus scanners:
  AllowlistCheck resolves one file per allowlist entry
  (`AllowlistCheck.ts:218-234`, `addSourceFileAtPathIfExists`) and
  SchemaDiagnostics (98 lines) is diagnostic formatting. The mining originally
  claimed a single choke point for all seven modules; the corrected scope is
  disclosed in the exploration's
  [`RESEARCH.md`](../../explorations/graphnosis-prior-art/RESEARCH.md)
  2026-08-06 addendum.
- **The live counterexample is verified.** `LawScan.ts:175` returns
  `scannedFiles: A.length(scannedSourceFiles)` unguarded, and nothing asserts
  it is non-zero — `Laws.command.ts:364,415,464` only log
  `scanned_files=`. A typo in `LAW_SCAN_INCLUDED_GLOBS` (`LawScan.ts:27`) or a
  drifted `isExcludedLawScanPath` (`:44`) would report the repo law-clean
  forever.
- **Zero is legitimate in scoped mode, and a live test depends on it.**
  `packages/tooling/tool/cli/test/effect-fn.test.ts:258` asserts
  `scannedFiles === 0` for a run whose `excludePaths` covers the only fixture
  file. The non-vacuity assertion must therefore distinguish *the corpus
  resolved to nothing* (a bug) from *everything resolved was scoped out* (a
  legitimate zero), and must not be a blanket `> 0`. P0 decides that boundary
  before any assertion is written.
- **Appetite: medium, not small.** One short PR ladder. If the work sprawls
  past that, cut back to the first slice — the standards statements plus the
  vacuity fixture — rather than extending the appetite.
- **Q6 binds this packet's own standards edit.** If the edit declares a
  determinism tier for any surface, the golden vectors that can falsify it
  ship in the same PR or the declaration does not ship.

## Acceptance Criteria

- [ ] The three laws are stated in `standards/`, each naming its enforcement
      mechanism and its owner (this packet), with the Q6 determinism-tier
      sentence in the same edit.
- [ ] The ceiling declaration schema exists with `declaredCeiling` optional,
      an effective-authority computation that min-composes declared against
      ambient at use time, and absence resolving to most-restrictive — written
      schema-first, ahead of any consumer.
- [ ] The first declaration site is chosen **within this packet**, recorded as
      a dated decision-log entry with its evidence, and not assumed from the
      exploration.
- [ ] `StopReason` ships as a `LiteralKit` over `completed` / `cap-reached` /
      `blocked`, with `cap-reached` documented and tested as a normal outcome
      rather than an error path.
- [ ] Every capped-walk contract this packet touches declares per-**edge**
      lifetime caps — not a generic walk-level counter — and records a stop
      reason.
- [ ] Each of the four scan paths asserts non-zero coverage for its own scan,
      with the legitimate-zero boundary respected and
      `effect-fn.test.ts:258` still green (or deliberately re-scoped with a
      recorded rationale).
- [ ] A deliberately-vacuous fixture proves the non-vacuity law fails when
      violated — a scanner pointed at a glob that resolves to nothing reports
      failure, not a clean pass.
- [ ] Every capped-walk and non-vacuity law carries a violating fixture; no
      law in this packet ships as prose alone except Rule 5, whose enforcement
      is the schema plus the existing clamp.
- [ ] The landed `LawScan` non-vacuity fix from the amendment pass is cited as
      the enforceability proof for law 3, not re-implemented here.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/agentic-governance-laws/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/agentic-governance-laws/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/agentic-governance-laws` | Passes |
| Law scanners green | `bun run beep laws` over each touched law | Passes |
| Vacuity fixture fails as designed | The scanner test asserting a nothing-glob scan reports failure | Fails loudly, never clean |
| Cap fixtures | A capped walk stopping for each `StopReason` member | Each reason reachable and recorded |
| Repo quality | `bun run beep yeet repair` then `... verify` | Green |
| Reflection | `bun run beep lint reflection-artifacts` | Passes at P4 |

## Stop Conditions

- The first ceiling declaration site cannot be chosen from evidence in the
  live tree — stop and report rather than inventing one.
- The non-vacuity assertion cannot be written without breaking a legitimate
  zero-scan case that has no lawful re-scoping.
- The work would reach into control-plane surface, policy UI, or runtime
  beyond the TierGate clamp.
- Required source files are missing or materially contradictory.
- The implementation would exceed named scope.
- Verification requires credentials, cost, destructive side effects, or policy
  approval not named in this spec.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
