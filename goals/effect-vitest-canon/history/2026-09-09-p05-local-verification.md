# P0.5 local verification and remaining gates

P0.5 is in progress. The first full Yeet run passed current-base install, all
15 collected cheap gates, the 140-task build and desktop IPC before failing on
four introduced JSDoc root imports. Those comment-only findings are repaired;
all six repair-validation steps, including the fresh JSDoc inventory/ratchet,
now pass. A new full Yeet attempt is live and queued on main 3bb59f37c0 plus the
20-path staged intent. No goal commit, push or PR has been made. Committed-range
checks still require the future goal commit. The tables below retain the original
implementation evidence; the final section qualifies the repaired comment bytes.

## Reviewed input

The separate filesystem branch is based on main commit
ace139cf4e162ecda8c88bea3bc0478478329553. Its reviewed index contains 20 paths;
the staged tree is 34608cb1045bcd6d21a7e2ab618687bfc8061812. Source remained
unchanged throughout the combined verification and final independent review.

| Input | SHA-256 |
| --- | --- |
| Final Memory core | 48548936e9a8c9ef35ba48aedad318ae3458818c6d8653ea9a08608ef4ccfe63 |
| Final conformance helper | 30fbdb2a4f344aa8bc62c9c9577dd2b68a23b51374b9a5a60a8d059aeecdb552 |
| Accepted R1 core preimage | c2bf1cfe1e5e082123800f45791fed8ea008ef405f98d22c7dc98422e083eccd |
| Frozen lockfile | 165f353565e3e516b62458f288aa6fbd449a6bb436d3c8e70a1cff173862d271 |

Runtime pins: Node 24.20.0, Bun 1.4.2, Vitest 4.1.11, and Effect/platforms/
@effect/vitest 4.0.0-rc.112. The reference suite is pinned to commit
2600f62f4532026928454dcea8d1c48557b3f942; upstream checkout HEAD is not the anchor.

## Evidence by requirement

| Requirement | Current evidence | Limit |
| --- | --- | --- |
| Preserve the pinned conformance suite | Independent comparison retains 21 ordered cases, 46 assertions, 23 scopes, 21 direct subject provisions and the 27-byte fixture. | The documented fixture adaptation and authorized source-path correction remain explicit. |
| Node platform conformance | Final helper on NodeFileSystem under actual Node: 21/21, exit 0, helper hashes unchanged. | This focused run selects the Node platform suite. |
| Bun platform conformance | Final helper on BunFileSystem under actual Bun: 21/21, exit 0, helper hashes unchanged. | This focused run selects the Bun platform suite. |
| Memory behavior | Combined final suite: 50/50 under Node and 50/50 under Bun; zero failed or pending cases. | Comprises 21 conformance cases, 17 regressions and 12 characterizations. |
| Preserve core semantics | Independent final review finds no introduced regression against accepted R1; all 25 primitive bindings, schema guards, public make/layer and resource lifetimes retained. | Read-only review and bounded probes do not establish equivalence for every interleaving. |
| Preserve lookup repair | Hoisted schema-derived tag guards remain; ordinary lookup does not revalidate complete directory maps. Equivalent directory-width comparison passes. | Timing samples are supporting evidence, with no SLA. The earlier direct-Bun harness failure remains recorded. |
| Preserve glob behavior | Writer compares 2,400 patterns, six exclusions and one recursive ordering case against immutable R1; results and selected error fields match. | This is a bounded corpus, not every possible pattern or error field. |
| Meet existing source-health gates | Canonical Fallow audit: zero introduced findings, two nonblocking inherited CLI findings. Canonical health: zero findings. | Earlier failures and the writer's source-only health failure remain retained; no thresholds, baselines or suppression were weakened. |
| Package handoff | Full package verification passes for test-utils and repo-cli, including audit and docgen. Repo-cli takes 391.608 seconds. | Package checks do not replace the full Yeet gate. |
| Consumer contract | Source and built/publish consumers execute on Node and Bun; strict type checks pass. Public facade resolves; private subpaths are rejected; eight fresh build artifacts match hashes. | Existing workspace wildcard aliases can bypass package export maps. New consumers use the public facade. |
| Post-integration consistency | Frozen install leaves the lock unchanged; test compiler passes; the goals-index check matches the local projection. | Committed-head install proof still must cover the future goal commit. |

## Evidence locations and acceptance

The detailed implementation and independent review reports are retained in
history/lanes/p05-core-promotion.md, history/lanes/p05-conformance-port.md and
history/lanes/p05-core-preservation-review.md. Earlier failures and their
attribution remain in those reports and the opportunities ledger.

The existing private cache under ~/.cache/beep/effect-vitest-canon contains:

- p05-fallow-conformance-astra-evidence: final Node/Bun platform command receipts,
  raw logs and before/after helper hashes.
- p05-fallow-preservation-review-astra-iim9f2ls: final independent core review,
  immutable preimages, AST comparisons and terminal integrity evidence.
- p05-fallow-combined-proof-l_3x81pn: all 15 successful combined proof steps,
  runtime JSON reports, retained canonical Fallow output and consumer artifacts.
- p05-fallow-core-root-acceptance.json: Root's acceptance after verifying the
  review report, 43 retained artifacts, nine primary inputs and 48 protected
  files against their terminal review hashes.

Against the earlier pre-repair protected manifest, 47/48 files are identical.
The sole difference is the independently reproduced upstream scheduler default
in Quality.command.ts. All 48 stayed unchanged during the final review and still
match its terminal snapshot. This qualification is retained in the acceptance.

## Next gate

Complete the attributed JSDoc import repair and its focused proof before
starting a new full Yeet attempt. The original process is terminal with exit 1. Its supervisor state and log remain p05-full-yeet-verify-status.json and
p05-full-yeet-verify.log in the private cache. A live queue wait is not a failure
and does not justify restarting the proof or clearing another task's lease.

After full verification, refresh the base before canonical publication and prove
the resulting committed HEAD. P0.5 still requires a published, merge-ready PR.
Scratchpad deletion and merges remain reserved for Benjamin. P0f's three Grok
rounds, P0g ratification, P1 acknowledgement and all migration/closeout gates are
unchanged.

## Full-run cheap-gate milestone

All 15 collected lanes report passed with exit 0. The broad test-TypeScript gate
checks 1,030 files across 139 packages and finishes in 450.344 seconds; all 139
package result artifacts have exit 0 and empty diagnostic output. The source
staged tree still matches the reviewed tree above, with no unstaged changes.

The immutable prefix log, lane receipt and copied package results are retained
in p05-full-cheap-gates-evidence under the existing private cache. The remaining
full proof and committed-head publication checks are not accepted by this receipt.

## Comment-only repair accepted

The final repair changes exactly four JSDoc import lines across the conformance
helper, Memory core and Quality predicate. Source statements/types and example
assertions are unchanged. Current hashes are recorded in
p05-jsdoc-repair-root-acceptance.json under the private cache. The new staged tree
is 851501dc09056c1965e6f88fe146ac9029d1c60d on base 3bb59f37c0.

All six steps in p05-jsdoc-validation-evidence pass: full test-utils package
verification (11.757 seconds), repo-cli quick lint/type verification (10.276),
explicit repo-cli docgen (22.016), doctest metadata (1.935), fresh whole-repository
JSDoc inventory (271.401), and fresh ratchet (2.108). Every source hash stayed
unchanged during validation. The fresh no-root-package-import total is 3,737;
its finding membership exactly matches the committed inventory. The touched
Quality fence has no doctest finding; 34 inherited unmarked fences remain untouched.

The active retry uses p05-jsdoc-full-yeet-verify-status.json and
p05-jsdoc-full-yeet-verify.log. The original p05-full-yeet-verify process is
terminal with exit 1 and must not be mistaken for the new live attempt.
