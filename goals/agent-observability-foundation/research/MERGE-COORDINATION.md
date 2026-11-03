# Final checkpoint merge coordination

PR2649 merged before its declared positive readiness checkpoint. Its canonical result remains **unknown**. All fifteen required checks and the normal review window were satisfied before merge; coverage finished eighty seconds later. The observer then observed a merged PR, which does not establish pre-merge readiness. See the [historical observation](../ops/history/pr2649-completion-unknown-20261103.json).

The operator directed a repair of coordination followed by a fresh final checkpoint merged by its owning chat. The original pre-merge rule and recovery hold remain in force.

## Maintained workstation merge routes

The shared GitHub wrapper and maintained app merger loops consult a private, exact-head PR reservation. The loops no longer issue a direct REST merge merely because an intermediate `GATE-MET` line appeared. Native Yeet merge paths consult the same reservation before a merge request, including the `yeet gh merge` route. On a host with activated reservation state, a missing helper or failed check holds the merge.

A reservation binds repository, PR, head and owner to a private capability. Through the guarded shared GitHub wrapper, Ready requires ownership; native Ready is not covered by this merge guard. Merge requires hash-bound original canonical readiness, terminal observer, OPEN-ready status and observer log evidence. Successful merged-state observation is refused. Advancing a reservation to a new head requires the owner and expected previous head; the old proof cannot authorize the new head.

This is a cooperative workstation boundary, not isolation from another unrestricted process running as the same user. Direct website/API access with independent credentials remains outside it. The operator must honor the reserved final merge there. The guard does not change GitHub rulesets, disable unrelated merge jobs or authorize any broader fleet takeover.

## Required final sequence

1. Publish the content-final head and reserve it to the owning chat. Preserve all superseded negative evidence.
2. Require every meaningful non-Vercel check to finish successfully, actual resolved review and the normal review window. Only explicit Vercel build-rate-limit failures are tolerated.
3. Start the single observer after the native Ready marker, with explicit `--head <full-sha>`, and let it terminate ready and finalize successfully while the PR is OPEN. Archive the originals.
4. Run a fresh classic monitor with explicit `--head <full-sha>`, archive its successful exact-head positive readiness verdict, and bind the private merge proof to the original files.
5. Run the strict merge gate without relaxed or forced-window options. The owning chat merges the same head, then obtains a genuinely verified canonical completion receipt.
6. Audit preservation and all thirteen criteria before retiring the final worktree. A later successful check never repairs missing pre-merge evidence retrospectively.

## Source applicability and operational limits

The [new selected-input comparison](../ops/history/merge-coordination-source-applicability-20261103.json) records 232/249 package, 80/84 preparation, 84/90 disposable and 83/89 live exact matches to historical executions. Seven selected paths differ from the preceding comparison; shell quoting now uses a shared repository utility. Two additional baseline identities preserve every existing value. New native coordination code requires its own proof.

Current exact-source root admission remains **false**. All seven real-harness populations remain **Unknown**. No production enrollment, historical backfill, Phoenix project deletion or recovery-hold release follows from this checkpoint. The forwarder service and timer remain masked/inactive.

## Installation and repeatable denial checks

The versioned [installer](../ops/install-merge-reservations.py) prints a plan by default; `--apply` installs the sibling helper and known shared-wrapper changes. It preserves originals and refuses unrecognized existing edits. It neither activates a reservation nor changes services. The [portable denial checks](../ops/test-merge-reservations.py) use isolated state and fake transport without network calls. Original private receipt compatibility checks run only when an explicit archive path is supplied; no private archives are required by the portable tests.
