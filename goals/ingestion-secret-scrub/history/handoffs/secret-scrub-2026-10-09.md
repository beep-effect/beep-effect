# secret-scrub handoff — 2026-10-09

## P0 audit and fixtures — proof pending

Phase reached: P0 in progress; P1 has not started. Branch: `feat/ingestion-secret-scrub`.
Base merged: `36027982f2`. No PR yet.

Prerequisites re-confirmed: all required sources and existing package edges are present,
no upstream packet dependency, no open PR overlap, no excluded reference links.
Adoption plan reports zero conflicts and preserves manifest bytes.

Decisions under the autonomy charter are recorded with reason and reversal in SPEC:
canonical `CredentialPatternBank` at `@beep/schema`, version `credential-pattern-bank/v1`;
R5 union match set and longest extent with each consumer's existing rendering and category
set; private tags implemented from description with attribution; inherited home paths
participate in clearance without a PII claim; mask-only evidence and offsets without
TextAnchor emission; branded prompt carrier at the named FilingDecisionLlm boundary;
retention schema/purge eligibility only; hosted CI and hosted parity implement R4.

Verification so far:

- Requested exhaustive consumer inventory: 122 matching source lines, deduplicated by file
  into `research/p0-bank-inventory.md`; match contents are not retained.
- Fixture contract: 25 cases with exact outputs, category/count, coverage/residue,
  prompt admission, evidence shape, log/persistence absence and independent action verdicts.
- Exact-canary scan rebuilds all three canaries from runtime fragments: fixture source,
  fixture test, P0 inventory, friction receipt and SPEC each have count 0; pass.
- Direct gitleaks directory scan of fixture source: no leaks; pass.
- `bun run beep ci lane secrets`: pass, but 0 commits scanned before commit;
  repeat after commit and before publication.
- Fixture integrity test and file-processing quick package-verify: queued through
  `beep-heavy`; no pass claimed. Quick verification is appropriate for this test-only wave.

Open items: finish P0 proof and signed first wave; P1-P3 implementation and all final
verification remain. No raw match or canary is included in this handoff.

## P0 completed — first publication

Fixture integrity: 2/2 pass under package-local single-file Vitest. The first runner
used the wrong working directory; corrected to the package directory. A curried
String helper misuse in the test was fixed against installed Effect declarations;
assertions logged booleans only. Seven baseline renderer comparisons: 0 mismatches.
All current source/evidence scan counts remain 0. The queued multi-file route was
unnecessary for a single-file test and was canceled before it ran. The quick package
proof remains queued; P1 will run required default package verification on final code.
P0 is complete; P1-P3 remain. No PR is yet claimed at this pre-publish append.

## P0 first publication gate repair

Post-commit gitleaks: 1 commit scanned, no leaks, pass. Yeet blocked before push on
one introduced `EV010` fixture-test filesystem finding; other 15 cheap gates pass.
Repair uses the existing Bun filesystem layer and canonical `it.layer` registration.
No inventory suppression or dependency change. A proof-row observed acknowledgement
was rejected because local-shard failures require a fix receipt; acknowledge with
the signed repair commit instead. No PR has been created by the failed publication.

## P0 canonical gate resolved

The detector also classifies canonical platform imports as new inventory candidates.
Final repair: fixture integrity is pure schema validation and scanner positive controls;
source absence is checked separately by the existing scanner CLI. This removes the
resource operation instead of hiding it or refreshing the shared baseline.
`lint:effect-vitest`: introduced=0, pass. Integrity tests: 2/2 pass. Fixture, integrity
test and scanner source bytes: exact-canary count 0 each, pass. Publication retry follows.

## P1 started — PR #1570

Wave 1 published at `4a17ab76fd9aba3f91b356f35ad7cecc09819ae1`; PR #1570 is draft
with ready-for-heavy. All 16 publication cheap gates and head-install preflight pass.
The obsolete queued P0 quick package proof was canceled before execution; no package
pass is claimed. Required default package verification will run on implemented code.

## P0 hosted Check repair during P1

PR #1570 Heavy / Check reported introduced `TS377094` at scanner support line 20:
schema errors must use `.make`, rather than `new`. The exact completed job log was
read immediately, before waiting for the workflow. Repair changes only the constructor;
no schema issue or raw input is attached to the error. This signed repair will travel
with the complete implementation wave. P1 remains in progress.

## P1 implementation and introduced proof repairs

The canonical bank, scrub service, mask-only proof, retention decisions and private
prompt capability are implemented locally. Focused proof covers 27 synthetic scrub
fixtures, bank version/union/private grammar, prompt admission, retention and both
legacy renderers. Exact-canary counts in serialized results/evidence and captured
prompts/logs/span attributes/failure causes are 0. No TextAnchor is emitted.

The full effect-vitest detector reports introduced=0 without a baseline refresh;
schema-first reports no introduced or advisory finding after a schema-derived
retention property. New JSDoc examples have canonical verified doctest markers.

Default package proof began after shared-slot queueing. Documents-domain passes
its audit and docgen; its test-tsgo and scoped coverage commands pass. Introduced
compile failures required a literal single-key branded schema with an explicit
export-safe type, typed `decodeOption`, and Effect-composed test encoders.

The metrics property test found an introduced header-overlap rendering leak:
normalizing an assignment-shaped header prefix could remove its colon and leave
later credential bytes. Repair: the canonical bank's pure assignment renderer
preserves complete header lines for the header renderer. Reason: keep the old
header output while retaining independent raw-input category counts. Reversal:
remove that renderer and restore the legacy metrics rule/order from the P0 base.
No rule copy, new category or dependency is introduced. All default proofs affected
by these repairs will be rerun before a pass is claimed or the implementation is
published. PR #1570 remains draft; P1 remains in progress.

Hosted P0 Lint Policy: inherited knowledge-reference gate in another goal's SPEC,
confirmed on origin/main. Hosted P0 Coverage Regression: two unchanged repo-cli
sources, outside lane ownership. Exact completed job logs were read; both rows
carry scope/evidence acknowledgements for the orchestrator's consolidated repair.

Release-safety decision: standalone FilingDecisionLlmLayer has a new explicit
SecretScrubService requirement, so documents-server receives a major changeset.
The composed LLM layer supplies the default scrubber and standalone tests supply
it explicitly. Reason: avoid a hidden fallback while keeping the service injectable.
Reversal: remove the gate/service wiring and additive reason as a single change.
Existing CauseRedaction/metrics export types stay unchanged; their changesets stay
minor. All eight consumer renderer cases compare with 0 mismatches. Signed
implementation and repair commit passes the commit-range secrets lane (no leaks).

Required schema/file-processing admission was requeued once after 30 minutes with
no command execution. The budget and two-owned-job limit are unchanged. This is
queue friction, not a package failure or a pass; the replacement remains required.

The header-overlap renderer now masks complete assignments before header redaction,
with separators retained until final formatting outside surviving header lines.
This also preserves quoted assignments containing header-like text and prevents
multiline values from escaping header precedence. Nine old/new renderer cases:
0 mismatches. Reason: confidentiality and legacy rendering must both survive
consolidation. Reversal: restore the prior metrics bank and remove this adapter.

### 2026-10-09 — current proof repair

P1 remains in progress. The file-processing audit typing repair is signed in
`da22cab2e1d60616a833331219155f62a1834224` and its inbox row is acknowledged.
Local docgen and the regenerated JSDoc ratchet passed. Fallow found one introduced
private-tag parser complexity issue; its equivalent flattened transitions are
being verified. Nested assignments now mask the union before consumer formatting,
deduplicating equal value offsets and counting distinct original extents. Reason
and reversal are recorded in SPEC. Updated schema/file-processing and consumer
default proofs are queued under the unchanged shared budget. PR #1570 remains
draft; no content-final or merge-readiness claim is made.
