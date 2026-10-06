# Accepted closeout and evidence recovery — 2026-10-06

PR [#1389](https://github.com/beep-effect/beep-effect/pull/1389) completed the
implementation and was accepted on October 2. The October 6 recovery audit found
surviving native evidence and reproduced the adoption handoff. Some original
private evidence remains unavailable. This addendum records that distinction;
it neither renews qualification nor changes the scope of the completed goal.

## Accepted chronology

| Identity | Value |
| --- | --- |
| Final PR head | `a532dffc6536796b3b9dea6460f68540f358c9c2` |
| Actual merge commit | `28b28fa551a4aa30c3cfd5b5a3a899a739328aa2` |
| Immutable pre-merge base | `0237172e96abb7b1cbcec4b6ce44f8e95c1c3692` |
| Actual merged tree | `bc8cac938ff9b7155f9d9e47c021133ea7841771` |
| Native frozen source | `93a19425da0f28d262cfb4b5e9190f137fbbaf58` |

The PR merged externally at 18:58:02 UTC on October 2, before final strict
readiness completed. Direct tool output in the retained conversation records a
subsequent pinned-base Yeet proof from 19:26:49.991 to 20:22:03.345 UTC:
`outcome: success`, all 36 recorded lanes passed. Its preview tree exactly
matched the actual merged tree. The Git object still confirms that tree.
The recorded proof includes 5,262 CLI tests in 269 files, integration and
property tests, documentation, doctests, ten coverage shards, Fallow and Nix.

The earlier final publication run recorded 78 passing lanes, but some preview
lanes selected zero tasks after `origin/main` advanced. The later pinned-base
proof repaired that scope gap. Neither run should be confused with the older
[`466ecff` quality receipt](quality-closeout-466ec.json).

The operator then explicitly answered **“Accept”** to the documented exception
that verification finished after merge. The original conversation records both
the question and the answer. This was an exception to ordering for PR #1389,
not a claim that pre-merge readiness occurred and not a waiver of future gates.
The implementation worktree and branch were retired before that acceptance
answer; the retained retirement command output records their removal.

## October 6 verification

| Requirement | Evidence checked and result |
| --- | --- |
| Reproducible complete census | All eleven [adoption artifact/recipe hashes](adoption/manifest.json) match. A fixed-input rebuild using 358 files from the actual merge and the retained census reproduces all eight generated artifacts byte-for-byte. It retains 145 workspaces, 3,498 graph nodes, 1,984 executable computations and 1,514 graph-only nodes. This is not a fresh census of later main. |
| Tuple/lifecycle, authenticated promotion and drift enforcement | Source inspection confirms the curated policy facade, revision and legal-transition checks, scope/profile/epoch checks, missing-script refusal, authenticated acceptance checks and configuration/source drift auditing. The recovered operational ledger matches its published hash at revision 8. Missing private authority stores limit fresh authentication as described below. |
| Synthetic success and mandatory negative cases | Both synthetic receipts match the [mandatory-case coverage index](synthetic-mandatory-case-coverage.json), which maps twenty checks per channel. Their original source and client identities remain unchanged. |
| Real signed pilot | Both native observations and all twelve operational artifacts match the hashes in the [signed qualification receipt](current-signed-qualification.json). Each channel retains three fresh/fresh pairs, three signed remote pairs, ten shadows, seven mutations, four capture controls, four non-execution controls, missing-child refusal, nine protocol roots and three transport failures. Each transport failure exits 42 and restores zero outputs. This verifies retained bytes, not a new native execution. |
| Honest legacy classification | The reproduced ordinary-profile population remains 1,980 unassessed and four excluded, including 1,259 legacy cache-enabled computations. Earlier portability/concurrency receipts retain their earlier source/client boundaries. No ordinary or broad task-family activation is inferred. |
| Adoption handoff | The [handoff](adoption-handoff.md) retains sixteen semantic families, decomposition obligations, shell/special terminal sites, reviewed Cache/CI/Quality/Yeet dispatch, policy API and invalidation/rollback instructions. The rebuild checks source bindings and exact reviewed command inventory. |
| Package/protocol and final-head quality | Live REST results for the final PR head show 35 successful check runs, one skipped check run and three successful commit statuses: 38 successful, one skipped, zero failed or pending. Published receipts and direct historical tool output support the original proof; missing original private files prevent a new check of their bytes and per-lane digests. |
| Readiness and reviews | The operator's accepted exception governs the missed pre-merge ordering. The historical October 2 result and a successful October 6 publication-time GraphQL refresh both show eight resolved threads with complete pagination. Comment timestamps show no later human follow-up; the latest thread update remains October 2 at 14:38:17 UTC. The initial recovery audit was rate limited; that observation limit was cleared before this addendum was finalized. |
| Same-PR closeout and retirement | The actual merge contains the acceptance audit, signed qualification, adoption bundle, quality receipt, reflection and completed-retained lifecycle. The former implementation worktree and branch remain absent. The residue archive recorded by the retirement command is now missing. |

The pilot remains `@beep/identity#lint` × `turbo-task-result` ×
`local-linux-x64-bun1.4.2-private-loopback-signed-v1` × `qualification-v2`.
Stable is 2.11.6; exact canary is 2.11.5-canary.5. The workflow and both frozen
source worktrees remain clean at `93a19425da`. The public record reports 103
accepted fragments and zero acceptance/audit blockers. Later source changes and
this recovery do not renew those observations or qualify another tuple.

## Recovered material and remaining limits

The audit preserved 46 surviving files (7,147,855 bytes) from the frozen workflow
and operational worktrees. Each copy was checked against its source SHA-256;
originals were not edited. The two native observation hashes and twelve
operational hashes all match the public receipt. A private recovery inventory
also retains the fixed-input rebuild, fresh GitHub responses, normative public
documents and explicitly labelled historical transcript extracts.

The private recovery inventory SHA-256 is
`461a4bb2443ad7e75d770abb25af34b33c89752586ca45cab69a1a235be8266e`.
It identifies the October 6 audit files, not the missing original retention
manifest. Raw observations, transcript contents, issuer locations and credentials
are not included in this public addendum.

The following evidence could not be located:

1. **Original 2,105-file archive and residue archive.** The recorded locations
   are absent. Targeted cache/state/Trash searches, exact-name searches in
   accessible home directories and candidate mounts, and inspection of 117
   likely proof files found no matching originals. The cause is unknown.
   Restore the original archive and its hash manifest from a backup to recheck
   the final Yeet records, completion audit, acceptance file and retained bytes.
   Historical tool output records what commands reported; it is not a replacement
   for those original files.
2. **Accepted-fragment store and both independent issuer trust directories.**
   The recovered acceptance configuration points to three absent locations.
   Observation envelopes, ledger hashes and the acceptance reference cannot
   replace verification against the original trusted store. Restoring those
   original records and issuer authority from a protected backup would permit
   revalidation of the authenticated 103-fragment import. A new execution would
   create new evidence with a new identity, not authenticate missing originals.

The search did not inspect offline/external backups or inaccessible snapshot
storage. Permission-denied paths and skipped dependency/Git-object directories
are recorded privately. The evidence is unrecovered, not proven destroyed.

## Validation and disposition

The recovery audit passed `beep goals doctor`, `beep explore --check` and
`beep lint reflection-artifacts`. Goals doctor reported three unrelated
nonfatal advisories and no blocking findings. The launcher remained 2,757
characters and all 230 inspected local Markdown links resolved. Synthetic
hashes passed 2/2; adoption hashes 11/11; reproduced artifacts 8/8.

No implementation defect was demonstrated. Expensive native experiments and
full proofs were not repeated merely because their archive is missing. The
accepted lifecycle remains `completed-retained`; broad adoption remains separate.
The publication-time review refresh closes the initial API observation gap.
This documentation follow-up publishes the chronology and recovery limits while
preserving all historical receipts under their original identities.
