# Ingestion Secret Scrub Spec

## Objective

Deliver the pre-LLM secret scrub as a narrow `@beep/file-processing` transform:
authorized extracted text becomes sanitized text plus counts/category metadata,
`safeForPrompt`, non-secret retention-bounded audit evidence, and explicit
coverage/residue status. Start with credential/private-tag detection and one
canonical, versioned pattern bank that consolidates the counted-proof precedent
in `packages/tooling/library/ai-metrics/src/privacy.ts`
(`AiMetricsRedactionResult`) with the broader observability bank in
`packages/foundation/capability/observability/src/CauseRedaction.ts`.

Matched secrets never persist. In particular, a raw match must never enter
`TextAnchor.quote`; persisted evidence is limited to masked evidence or a keyed
digest, category/count, pattern-bank version, and non-secret location,
coverage, and residue metadata.

## Non-Goals

- Injection findings; they are the next increment and remain gated behind this
  scrub result envelope.
- PII or OOXML expansion; both require their policy gates before implementation.
- HTML sanitization or a trusted sanitizer carrier.
- Guarded remote fetch, DNS rebinding proof, or consumer migration.
- A provider-neutral secret resolver or 1Password driver changes.
- A per-user credential vault, encryption/key custody, or credential lifecycle.
- Raw-secret fixtures, persisted raw matches, or changes to `goals/INDEX.md`.

## Source Hierarchy

1. The user-approved graduation objective and
   [`BRIEF.md`](../../explorations/ingestion-security-secret-governance/BRIEF.md).
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. `standards/ARCHITECTURE.md` and governing package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. The exploration [`DECISIONS.md`](../../explorations/ingestion-security-secret-governance/DECISIONS.md),
   [`MAP.md`](../../explorations/ingestion-security-secret-governance/MAP.md),
   and supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/foundation/capability/file-processing/src/` for the scrub transform,
  schema-first result/proof envelope, coverage/residue contract, and evidence
  projection.
- The two existing pattern/count precedents at
  `packages/tooling/library/ai-metrics/src/privacy.ts` and
  `packages/foundation/capability/observability/src/CauseRedaction.ts`,
  consolidated without leaving divergent banks.
- One real prompt-producing consumer boundary selected during P0 for
  `safeForPrompt` enforcement.
- Synthetic fixture corpus, focused tests, logs/persistence proof, and packet
  evidence.

## Constraints

1. The ratified program appetite is six weeks in independently stoppable bets;
   this first scrub/proof vertical receives two weeks. Cut breadth before
   weakening the confidentiality boundary or growing into a gated increment.
2. Detection, replacement, proof, audit projection, and the real prompt gate
   consume one canonical, versioned credential/private-tag pattern bank. P0
   audits both existing banks, deduplicates overlaps, records coverage, and
   freezes fixture expectations before P1.
3. A matched secret may exist only transiently during replacement. No raw match
   may survive in sanitized output, `TextAnchor.quote`, findings, audit rows,
   errors, logs, telemetry, snapshots, support artifacts, or persisted fixtures.
   Evidence uses only a mask or keyed digest, category, count, bank/rule version,
   and non-secret location/coverage/residue metadata.
4. **Ratified block 4, audit-data sensitivity (verbatim):** secret findings retain no raw
   match, including in `TextAnchor.quote`; retain category, masked evidence or
   keyed digest, counts, rule/pattern-bank version, non-secret offsets, coverage,
   and residue status. PII quotes are disabled by default. Enabling a PII quote
   requires a named purpose, explicit access policy, retention clock, and
   deletion path; logs and telemetry receive counts/categories only.
5. **Ratified block 6, retention and deletion clocks (verbatim):** align with the
   ratified time-tracking tiers in `docs/product/ip-attorney-time-tracking.md`:
   transient authorized raw text and unredacted PII excerpts delete on
   successful transformation/purpose resolution or by 7 days; non-secret scrub
   proof and explicitly consented, redacted evidence delete by 30 days unless
   pinned to an unresolved review; approval/baseline/deletion/rotation audit
   records delete by 12 months. Credential ciphertext lives until user deletion,
   credential deletion, or revocation policy requires earlier removal; deleting
   it also deletes its wrapped data key.
6. **Ratified block 8, failure posture (verbatim where it binds this slice):** unresolved
   secret matches, unknown coverage, or secret-shaped residue block
   `safeForPrompt` and therefore block the prompt leg, while retaining
   sanitized/non-secret diagnostic proof.
7. Tests and examples use synthetic canaries/placeholders only. Proof must scan
   serialized results, errors, logs, snapshots, and persistence surfaces for
   exact canary absence, not merely inspect the returned sanitized string.
8. `safeForPrompt` is an enforced capability at one real prompt boundary, not
   advisory metadata. The boundary must reject false/blocked/unknown status and
   never reconstruct prompt text from audit evidence.

## Decision Log

The exploration retains rationale and rejected options. These are back-links,
not replacement doctrine.

### Eight alignment decisions

| Date | Locked decision | Source |
| --- | --- | --- |
| 2026-07-14 | Keep one exploration as a two-track program with independently shippable goals. | [`Q1`](../../explorations/ingestion-security-secret-governance/DECISIONS.md#2026-07-14--q1-program-scope) |
| 2026-07-14 | Start with the pre-LLM scrub and one canonical bank; matched secrets never persist. | [`Q2`](../../explorations/ingestion-security-secret-governance/DECISIONS.md#2026-07-14--q2-first-slice) |
| 2026-07-14 | Incubate the resolver until multi-consumer proof; keep the vault product-owned. | [`Q3`](../../explorations/ingestion-security-secret-governance/DECISIONS.md#2026-07-14--q3-secret-homes) |
| 2026-07-14 | File-processing owns findings/proof; provenance stays neutral; HTML owns pure policy only. | [`Q4`](../../explorations/ingestion-security-secret-governance/DECISIONS.md#2026-07-14--q4-content-security-homes) |
| 2026-07-14 | Adapt permissive sources with attribution; clean-room copyleft; keep detection local/advisory. | [`Q5`](../../explorations/ingestion-security-secret-governance/DECISIONS.md#2026-07-14--q5-build-buy-licenses-and-patent-posture) |
| 2026-07-14 | Resolve explicitly with typed continue/stop semantics and redacted results. | [`Q6`](../../explorations/ingestion-security-secret-governance/DECISIONS.md#2026-07-14--q6-resolution-semantics) |
| 2026-07-14 | Keep the credential envelope provisional behind threat modeling and lifecycle ownership. | [`Q7`](../../explorations/ingestion-security-secret-governance/DECISIONS.md#2026-07-14--q7-vault-cryptography) |
| 2026-07-14 | Split pure host classification from pinned connect-time SSRF enforcement. | [`Q8`](../../explorations/ingestion-security-secret-governance/DECISIONS.md#2026-07-14--q8-ssrf-boundary) |

### Nine shape blocks ratified as drafted

| Block | Ratified subject | Source |
| --- | --- | --- |
| 1 | Six-week appetite with two weeks for the scrub/proof vertical | [`Appetite`](../../explorations/ingestion-security-secret-governance/BRIEF.md#appetite) |
| 2 | Credential ownership: user owns; workspace is the storage/administration boundary | [`Credential ownership`](../../explorations/ingestion-security-secret-governance/BRIEF.md#1-credential-ownership-and-tenancy-model) |
| 3 | Resolution precedence | [`Resolution precedence`](../../explorations/ingestion-security-secret-governance/BRIEF.md#2-resolution-precedence) |
| 4 | Audit-data sensitivity | [`Audit-data sensitivity`](../../explorations/ingestion-security-secret-governance/BRIEF.md#3-audit-data-sensitivity) |
| 5 | Key lifecycle ownership | [`Key lifecycle`](../../explorations/ingestion-security-secret-governance/BRIEF.md#4-key-lifecycle-ownership) |
| 6 | Retention and deletion clocks | [`Retention tiers`](../../explorations/ingestion-security-secret-governance/BRIEF.md#5-retention-and-deletion-clocks) |
| 7 | Sanitizer trust/output contract | [`Sanitizer contract`](../../explorations/ingestion-security-secret-governance/BRIEF.md#6-sanitizer-output-contract) |
| 8 | Failure posture | [`Failure posture`](../../explorations/ingestion-security-secret-governance/BRIEF.md#7-failure-posture) |
| 9 | Operational egress default-deny | [`Egress policy`](../../explorations/ingestion-security-secret-governance/BRIEF.md#9-operational-egress-policy) |

## Acceptance Criteria

- [ ] P0 inventories both existing banks rule-by-rule, records overlap and
      deduplication, establishes one owner/version identifier, and prevents a
      third divergent bank.
- [ ] A synthetic fixture corpus covers supported hits, near-misses,
      placeholders, overlapping/partial forms, coverage gaps, and
      secret-shaped residue; every case has explicit sanitized, metadata,
      coverage/residue, and `safeForPrompt` expectations.
- [ ] Supported hits produce sanitized text and correct categories/counts
      without retaining raw matches in any returned or serialized evidence.
- [ ] Exact synthetic canary scans prove no raw secret survives into persisted
      artifacts, `TextAnchor.quote`, errors, logs, telemetry, snapshots, or
      support evidence.
- [ ] Unknown coverage, unresolved matches, and residue cases each make
      `safeForPrompt` false, block one real prompt leg, and preserve only
      sanitized/non-secret diagnostics.
- [ ] A clean fixture with known coverage demonstrates `safeForPrompt: true`
      and reaches that same prompt boundary using sanitized text only.
- [ ] Retention proof enforces transient raw deletion on success or within 7
      days, scrub proof deletion within 30 days unless pinned, and audit-record
      deletion within 12 months.
- [ ] Focused tests, repo gates, reflection lint, and Yeet PR-to-mergeable proof
      pass with no unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Launcher size | `test "$(wc -m < goals/ingestion-secret-scrub/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/ingestion-secret-scrub/ops/manifest.json` | Passes |
| Packet references | `rg -n "ingestion-secret-scrub|GOAL.md|agentLaunchers|packetAnchorDocument" goals/ingestion-secret-scrub` | Expected references present |
| Packet whitespace | `git diff --check -- goals/ingestion-secret-scrub explorations/ingestion-security-secret-governance explorations/ATLAS.md` | Passes |
| Bank consolidation | P0 rule inventory plus focused bank tests | One versioned bank; duplicates resolved; both former consumers accounted for |
| Fixture contract | Focused scrub fixtures | Hits/near-misses/placeholders/gaps/residue have exact expected outcomes |
| No-secret persistence | Exact synthetic-canary scan across serialized artifacts and captured logs | Zero raw canary occurrences |
| Prompt gating | Focused integration test at one real prompt boundary | Only known-clean sanitized text reaches prompt construction |
| Retention | Clock/persistence tests or archived proof | 7-day/30-day/12-month tiers enforced |
| Repo quality | `bun run beep yeet verify` | Green |
| Reflection | `bun run beep lint reflection-artifacts` | Green at close |

## Stop Conditions

- P0 cannot consolidate both live banks without leaving contradictory ownership,
  rule semantics, or versioning.
- A raw match reaches any persisted/observable surface or a blocked/unknown
  result can reach prompt construction.
- The implementation requires injection, PII/OOXML, sanitizer, fetch, resolver,
  vault, or another named non-goal.
- Required source files or a real prompt boundary are unavailable or materially
  contradictory.
- Verification requires unnamed credentials, cost, destructive effects, or
  policy approval.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
