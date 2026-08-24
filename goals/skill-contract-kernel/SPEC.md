# Skill Contract Kernel Spec

## Objective

A new schemas-only foundation package, `@beep/skill-contract` (to be created under
`packages/foundation/modeling/`), defines the typed agent-work contract kernel — `SkillContract` root,
fail-closed `Gate` registry with audit-record verdict values, the four-rung evidence-ladder
ADT with its terminal union, and in-toto-aligned unsigned receipts — and two proofs make it
real: the `qa-inventory/v1` judge gate runs as a `SkillContract` instance with behavior
parity, and that contract's SKILL.md projection is rendered via `@beep/md`
(`render`/`renderUnsafe`; the legacy `DocumentToMarkdown` schema is deprecated in their favor
— drift corrected 2026-08-24) and gated by re-extraction. Markdown rendering is deliberately
one-way (the deprecated schema's reverse direction is `encodeUnsupported`; its successors are
plain one-way functions), so the re-extraction gate is scoped to
what is honestly available: (a) deterministic re-render byte-equality — re-render the
projection from the contract and prove it byte-equals the committed artifact — and (b) an
embedded machine-readable frontmatter block that schema-decodes back to the contract's
projection model and proves equality. A full Markdown→AST inverse parser is a non-goal.

## Non-Goals

Seeded from the exploration brief's no-gos
([`explorations/typed-agent-skill-contracts/BRIEF.md`](../../explorations/typed-agent-skill-contracts/BRIEF.md)):

- No porting OpenLink implementations (regex validators, shell harnesses, secret handling) —
  contract shapes only, with attribution.
- No new envelope/attestation format competing with in-toto; no DSSE signing or key handling.
- No protocol clients (A2A/ActivityPub) or credential-chain work.
- No SLSA build-provenance claims where no build occurred — packet-specific predicates only.
- No regex/substring gate evaluators — every gate decodes typed evidence or fails closed.
- No bounded-recovery service implementation (its budget/attempt/receipt schemas ship; the
  engine waits for its first real consumer in a later wave).
- No second retrofit consumer (yeet lanes are the ops wave); no `.claude/skills` migration.
- No Markdown→AST inverse parser: `@beep/md` rendering (`render`/`renderUnsafe`, and the
  deprecated `DocumentToMarkdown` schema) is one-way by design, and this goal does not add a
  parser to invert it. The projection's re-extraction gate uses byte-stable re-render plus
  frontmatter decode (see Objective and Acceptance).

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards — notably `standards/ARCHITECTURE.md`,
   `standards/architecture/07-non-slice-families.md` (family/kind dependency ceilings),
   `09-errors-across-boundaries.md`.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- The new `@beep/skill-contract` package directory under `packages/foundation/modeling/`
  (schemas, opaque constructors, projection, tests, README with consumer list).
- `packages/tooling/tool/cli/src/commands/Qa/**` — judge-gate retrofit (JudgeCheck rules as
  typed gates; behavior parity required).
- `goals/skill-contract-kernel/**` — packet upkeep.

## Constraints

Seeded from the brief's rabbit holes and the grill round
([`explorations/typed-agent-skill-contracts/DECISIONS.md`](../../explorations/typed-agent-skill-contracts/DECISIONS.md)):

- **Family ceiling:** modeling may depend only on `foundation/primitive` +
  `foundation/modeling`; permitted deps are `@beep/schema`, `@beep/identity`,
  `@beep/provenance`, `@beep/md`. No capability, driver, tooling, slice, or shared imports.
- **Verdicts are values:** fail-closed outcomes are `Denied`-style verdict values carrying
  audit records. `S.TaggedError` classes only for real boundary failures (evidence decode
  failure, invariant violation) — the repo retired its `TaggedErrorClass` helper (commit
  `ec3bc91e63`); qa's `QaCommandError` is the local precedent. No new error kind crosses any
  boundary.
- **Precedents are read-only:** `TierGateVerdict` (`@beep/mcp-kit`, foundation/capability)
  and `ClaimGateResult` (`@beep/epistemic-domain`; the use-cases `ClaimGate` service returns
  it) are shape precedents only, never dependencies — modeling may not import capability or
  slice packages.
- **Digest seam:** receipt subjects bind to digests using today's digest/hash types. If
  `explorations/protocol-as-value` lands its proposed canonical-encoding/versioned-digest
  substrate, receipts migrate at an explicit seam (the subject digest field family); this
  goal must not mint a competing canonical encoding (exploration DECISIONS 2026-08-24).
- **Substrate freshness:** exploration research validated Effect AI `Tool`/`Toolkit` on
  Effect `4.0.0-rc.108`; the repo is on `rc.111`. P0 revalidates those shapes against
  `.repos/effect` (provision via `scripts/setup-agent-memory.sh` if the symlink is missing).
- **Opaque constructors:** "verified"/"passed" values are constructible only through the
  evaluator (the `VerifiedTextAnchor` pattern). Completion states are unreachable without
  blocking-gate evidence by construction.
- **Ladder discipline:** transitions are monotonic; each rung demands its evidence type;
  transport-level "completed" maps to a low rung, never the top.
- **Receipt shape:** in-toto Statement-aligned (digest-bound subject, versioned
  `predicateType`, typed predicate), SLSA-VSA-shaped gate summary; unsigned; export is a
  projection, not a migration.
- **ACS attribution:** fail-closed evaluation semantics and audit-record field discipline are
  ported from Microsoft's Agent Control Specification (MIT) with attribution in the package
  README and `research/SOURCES.md`.
- **Retrofit parity:** the retrofitted judge gate must preserve existing observable behavior;
  parity is proven by tests, not asserted.
- **Repo laws:** schema-first design order; `LiteralKit` for literal domains; effect helper
  modules; `Effect.fn`/`Effect.fnUntraced` for effect generators; JSDoc house grammar.
- **No statechart engine:** phase typing is schemas/services; XState vocabulary only.

## Acceptance Criteria

- [ ] `@beep/skill-contract` exists as a new package under `packages/foundation/modeling/`
      with the four schema families (`SkillContract`, `Gate`+verdicts, ladder ADT, receipts),
      package README naming consumers, and passing package tests.
- [ ] The `qa-inventory/v1` judge gate is expressed as a `SkillContract` instance; existing
      judge behavior is preserved (parity tests green; `beep qa judge-lint` semantics
      unchanged — including missing-event-ID detection, canonical-root/path-escape refusal,
      file-only evidence refs, declared-round coherence, nonempty evidence per finding, and
      P0/P1 `requiredCount` coherence).
- [ ] The contract's SKILL.md projection renders through `@beep/md` (`render`/`renderUnsafe`;
      not the deprecated `DocumentToMarkdown`), and
      the re-extraction gate proves BOTH (a) re-render byte-equality against the committed
      artifact and (b) frontmatter-block schema decode equality against the contract's
      projection model, in tests. (No Markdown→AST inverse parser — see Non-Goals.)
- [ ] Completion-unrepresentability is demonstrated: a test shows a contract with an
      applicable blocking gate lacking evidence cannot construct a completed/terminal value.
- [ ] Architecture gates pass (family metadata, import boundaries, docgen, lint, typecheck).
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/skill-contract-kernel/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/skill-contract-kernel/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/skill-contract-kernel` | Passes |
| Repo quality | `bun run beep yeet verify` | Green |
| Package tests | package-level `test` lane for `@beep/skill-contract` + Qa command tests | Green |

## Decision Log

Locked in the source exploration; back-links, not copies
([`DECISIONS.md`](../../explorations/typed-agent-skill-contracts/DECISIONS.md)):

- 2026-08-13 §spine track — kernel is the spine; five waves retained.
- 2026-08-13 §ACS posture — vocabulary now, adapter later.
- 2026-08-13 §receipt shape — in-toto-aligned, unsigned first.
- 2026-08-13 §kernel home — foundation/modeling, schemas-only (capability gate analysis).
- 2026-08-13 §kernel name — `@beep/skill-contract`.
- 2026-08-13 §bounded-recovery — service dropped from wave 1; schemas ship.
- 2026-08-13 §first retrofit — qa judge gate.
- 2026-08-13 §verdicts are values / kernel deps — derived from doctrine.
- 2026-08-13 §SKILL.md projection — in wave 1, via `@beep/md` (operator override).
- 2026-08-13 §graduation shape — this packet only; exploration stays active.
- 2026-08-24 §status flip — exploration flipped to `graduated` per the graduation contract.
- 2026-08-24 §drift corrections + digest seam — `S.TaggedError` replaces retired
  `TaggedErrorClass`; `render`/`renderUnsafe` replace deprecated `DocumentToMarkdown`;
  `ClaimGateResult` cited at `@beep/epistemic-domain`; parity matrix enumerated; receipts use
  today's digest types with an explicit protocol-as-value migration seam; P0 revalidates
  Effect AI shapes on rc.111.

## Stop Conditions

- Required source files are missing or materially contradictory.
- The implementation would exceed named scope.
- Retrofit parity cannot be reached without changing observable judge behavior — stop and
  report; do not ship behavior drift as "parity".
- Verification requires credentials, cost, destructive side effects, or policy approval not
  named in this spec.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
