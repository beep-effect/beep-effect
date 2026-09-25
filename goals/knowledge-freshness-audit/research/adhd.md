# Divergent audit design record

## Brief and provenance

Problem: exhaustively audit repository knowledge at reasonable cost while
preserving authority, history, and skill customization. Use existing Knowledge
and Skills tooling and persist accountable evidence.

This was an adapted three-frame run under three child slots and a total-thread
limit. Existing explorer contexts generated independently; branches did not see
each other's ideas before critique. Their prior research contexts were retained.
This is not the default five fresh branches. The operator approved the resulting
plan after the adaptation was disclosed.

## Wide set

Scores are comparative design judgments, not experimental measurements.
N = novelty, V = viability, F = fit. Weighted score = 0.35N + 0.40V + 0.25F.

| ID | Frame | Idea | N | V | F | Rationale |
| --- | --- | --- | ---: | ---: | ---: | --- |
| R1 | Regulator | Name the observation that would overturn every freshness determination | 8 | 8 | 9 | Falsifiable verdicts can be invalidated by explicit dependencies |
| R2 | Regulator | Issue a coverage certificate accounting for every inventory item | 8 | 10 | 10 | Exhaustiveness becomes a checkable conservation rule |
| R3 | Regulator | Resolve doctrine/implementation jurisdiction before choosing repair | 7 | 9 | 10 | A disagreement does not authorize rewriting whichever source is inconvenient |
| R4 | Regulator | Keep customized skills' chain of custody | 7 | 9 | 9 | Upstream changes and local exceptions retain separate identities |
| R5 | Regulator | Seal repairs with before/after evidence and neighboring obligations | 7 | 9 | 9 | A repair carries its proof and the rechecks it creates |
| R6 | Regulator | Let Jev propose typed dispositions with explicit refusal reasons | 7 | 9 | 9 | Missing or contradictory evidence cannot become a confident accepted verdict |
| L1 | Logistics | Share revision-pinned evidence across dependent claims | 9 | 9 | 10 | Verify a command contract or snapshot once within its valid context |
| L2 | Logistics | Balance each file's extracted, resolved, historical, and outstanding claims | 7 | 9 | 9 | Successful fixes cannot conceal abandoned obligations |
| L3 | Logistics | Route stale claims back to the owning generator, rule, code, or patch | 8 | 9 | 9 | Fix the source of repeated defects |
| L4 | Logistics | Reconcile upstream changes and local adaptations as separate arrivals | 7 | 9 | 10 | Reconstruct an effective bundle without treating customization as damage |
| L5 | Logistics | Recheck revision seals immediately before publication | 6 | 9 | 9 | Evidence may become obsolete while a repair waits for review |
| L6 | Logistics | Reserve audit capacity for neglected families and unresolved ancestry | 8 | 8 | 9 | Popular README checks cannot indefinitely crowd out obscure files |
| B1 | Biology | Bind each claim to its declared authority | 8 | 9 | 9 | Current code, doctrine, and historical snapshots answer different questions |
| B2 | Biology | Preserve the original purpose of each skill adaptation during reconciliation | 8 | 8 | 9 | Useful local variation survives upstream changes |
| B3 | Biology | Calibrate against deliberately stale, correct, historical, and conflicting claims | 9 | 9 | 9 | Expose verifiers that attack preserved history or valid customization |
| B4 | Biology | Expand inspection through bounded shared-evidence dependencies | 8 | 7 | 9 | One broken command can identify neighbors without another whole-corpus read |
| B5 | Biology | Require claim/source agreement and a discriminating counterexample where feasible | 8 | 7 | 8 | Tests should reject the old state rather than merely mirror the repair |
| B6 | Biology | Add living correction records above immutable historical layers | 7 | 9 | 9 | Current readers get corrections without falsifying the original record |

## Clusters and convergence

- Coverage and authority: R2, R3, L2, B1.
- Evidence reuse and targeted rechecks: L1, R1, L5, B4.
- Owning-source repair and adaptation: L3, R4, L4, B2, B6.
- Verifier challenge and neglected coverage: B3, R6, R5, B5, L6.

The top three are R2 (9.30), L1 (9.25), and B3 (9.00). L1 is the
non-obvious viable choice: retrieval sharing, rather than a cheaper model alone,
can remove repeated work. The architecture combines these ideas instead of
building three independent systems.

Rejected interpretations: unsupported means false; upstream movement means local
adaptation is obsolete; confidence proves accuracy; processed extracted claims
prove extraction completeness; every historical record needs rewriting.
Counterexample testing remains useful where a discriminating oracle exists,
but forcing every prose judgment into an executable oracle would create false
precision. Dependency expansion stays bounded and never replaces full accounting.

## Focus: coverage certificate

Freeze input at a Git tree and inventory-policy version. Give each entry an
extraction, alias, generated, historical, or explicitly excluded disposition.
Persist anchored claims and an extraction receipt even when the result is zero.
Require evidence or an explicit unresolved reason for every claim. Derive the
coverage certificate from these records and invalidate affected determinations
after repairs. Completion requires no unaccounted entries or unresolved required
obligations.

Load-bearing risk: perfect bookkeeping can conceal missed semantic assertions.
First builder step: fixture-backed census adaptation spanning active guidance,
history, generators, aliases, and claim-free files.

Child ideas: separate extraction quality from accounting; assign exclusion
owners; retain temporal applicability; derive changed-claim recheck reports;
use adversarial and risk-weighted extraction samples.

## Focus: shared evidence receipts

Represent evidence as file-backed receipts keyed by locator, revision/hash,
method, and method version. Include authority role and relevant execution scope.
Multiple claims can reference one command-contract or upstream-snapshot receipt.
Batch missing evidence before dispatching agents or classifiers. Maintain a
regenerable reverse index that invalidates dependent determinations when evidence
or methods change. Retain conflicts as paired doctrine and implementation
receipts, and refresh mutable dependencies before publication.

Load-bearing risk: evidence identity may omit options, runtime, package, or
authority context and permit invalid reuse. First builder step: prove a small
vertical slice where multiple claims share one receipt and only their dependent
determinations invalidate when it changes.

Child ideas: authority-paired contradictions; demand-based retrieval batching;
identical classifier replay inputs; separate identity from freshness; repair
impact previews.

## Focus: adversarial calibration

Start with six reviewed cases and expand to 60 balanced cases. Include correct,
stale, historical, conflicting, customized, and insufficient-evidence examples.
Keep extraction and retrieval outside Jev. Freeze family-level development and
held-out splits before tuning, with quoted adversarial content and evidence
removal cases. Log classification, permissible action, abstention, cost, and
latency under the $5 cap. Require the admission criteria in the evaluation
contract, then permit advisory use only.

Load-bearing risk: adjudicated labels can share the verifier's faulty authority
assumptions; a small held-out set cannot establish fleet-wide reliability.
First builder step: independently review six pinned evidence bundles and their
permissible-action rationales before paid requests.

Child ideas: authority swaps; evidence-removal abstention; full reviewed-finding
cost; provider-neutral fixtures; a non-destructive shadow pass.

## Provocation

What exact observation would invalidate each accepted determination? Keeping
that answer turns one campaign's receipts into useful future change checks.

## Tool receipt

Explorer retrievals reported approximately 514,695 estimated tokens saved by
Graft. This is the tool's estimate, not measured accounting or a benchmark of
the audit design.
