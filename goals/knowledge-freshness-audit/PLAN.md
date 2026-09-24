# Repository freshness audit execution plan

## State

The campaign is paused. P0 is the authorized packet delivery; P1-P5 require
explicit audit activation. [SPEC.md](./SPEC.md) is normative.

| Phase | Status | Work | Exit |
| --- | --- | --- | --- |
| P0 | in-progress | Research, author, review, and publish the planning packet | Docs-only PR reaches mergeable and remains open; audit stays paused |
| P1 | pending | Freeze census; build/reuse read-only extraction and evidence reports | All surface families accounted for; initial report and extraction-quality review recorded |
| P2 | pending | Verify claims and evaluate optional Jev pilot | Typed determinations and reviewed evidence; Jev admitted or explicit fallback |
| P3 | pending | Reconcile skills and repair confirmed discrepancies | Approved report scope, preserved customization, before/after proof |
| P4 | pending | Recheck final tree, complete coverage, and land precise gates | No unresolved required obligations; repairs and regressions verified |
| P5 | pending | Final audit PR closeout and reflection | Exact-head mergeable proof; lifecycle closeout lands with final work |

## P0: packet delivery

1. Create the isolated feature lane and refresh the baseline revision.
2. Read the standard template and use the bootstrap plan compiler only as a
   consistency reference. Manually author this packet; do not build a writer.
3. Persist census, source ledger, existing-tool analysis, ADHD results, agreed
   decisions, record specimens, benchmark design, acceptance, and friction.
4. Review inherited doctrine, completeness, feasibility, source claims, and
   pause/activation semantics. Correct only this packet and its minimal parent link.
5. Run packet checks and the canonical Yeet repair, verify, publish, monitor flow.
   After repair, inspect the complete diff before verification: retain a local
   receipt of unrelated repair-produced changes and restore only those changes
   after confirming they were produced by this run. Preserve pre-existing work.
   Require every staged path to be Markdown or this goal manifest; otherwise
   stop publication and separate the repair into its owning implementation PR.
6. Leave the PR open at mergeable. Record the delivery receipt without activating
   the audit or declaring the campaign completed.

Only Markdown and the goal manifest belong in P0. A local bootstrap-plan JSON
receipt is disposable diagnostic output, not a public artifact. Omit template
.gitkeep files. Actual ledgers and executable fixtures belong to implementation.

## P1: inventory and report-first tooling

On explicit activation, record the new base/tree and refresh parent capabilities.
Search existing source/barrels before defining Effect schemas, contracts, or
services. Reuse Knowledge and Skills interfaces where their semantics fit.

Enumerate the entire tracked tree and classify every entry. Preserve alias edges,
generator ownership, historical scope, and explicit exclusion reasons. Create
the compact ledgers specified by the evidence contract. Extract deterministic
references and bounded prose claims, with explicit empty/error receipts.

Start with fixtures for active guidance, history, generators, aliases, and
claim-free files. Validate extraction with reviewed adversarial examples and
risk-weighted samples spanning every surface family. Report omissions as work.
Present a concrete read-only report for the required false-positive review
before mutating audited content. Implementing read-only tooling is distinct
from applying its proposed content repairs.

## P2: evidence and Jev

Batch verification by evidence demand, retaining context such as package,
command arguments, runtime version, authority, and as-of time. Do exact work
in code and retain insufficient/conflicting evidence explicitly.

Build the six reviewed Jev seeds and the 60-case benchmark. Freeze family-level
development/held-out assignments before tuning. Use the approved secret-reference
route and $5 request-admission ledger only after audit activation. Follow the
advisory admission criteria; use deterministic/agent review if they fail.

Track all surface families and unresolved ancestry throughout scheduling.
Prioritization changes order, not coverage. Do not let popular README checks
consume the entire campaign while less-connected files remain unreviewed.

## P3: reconciliation and repair

For each approved report scope, repair the owning source in small batches.
For skills, establish ancestry, review concrete local adaptations, and reconcile
upstream/base/local trees with the inherited patch model. Revalidate aliases,
licenses, harness metadata, and effective-tree hashes.

Use later corrections for immutable history and dedicated chore PRs for full
generated standards refreshes. Any targeted implementation repair receives its
normal package-quality and architecture checks. Record repaired findings and
all dependent rechecks; do not interpret a successful edit as proof.

## P4-P5: completion

Reconcile the final-tree census against the starting inventory and all intervening
adds/deletes/renames. A deleted document retains its history and disposition;
new entries create new obligations. Verify extraction quality, evidence freshness,
repair status, and coverage accounting separately.

Apply the evidence contract's finite self-audit boundary: audit authored guidance
normally and validate known generated evidence without recursive claim extraction.
Name the immutable source snapshot in the certificate, then compare it to the
publication tree so evidence-only additions cannot conceal unaudited source edits.

Land permanent deterministic protection for demonstrated finding classes using
the parent initiative's existing gates. Keep new semantic model judgments
advisory. Close each delivery PR through Yeet and confirm the final aggregate
acceptance matrix. Write the final reflection and lifecycle change in the same
PR as final audit work. The operator authorizes merging separately.

## Packet verification commands

```sh
test "$(wc -m < goals/knowledge-freshness-audit/GOAL.md)" -le 4000
jq . goals/knowledge-freshness-audit/ops/manifest.json
git diff --check -- goals/knowledge-freshness-audit goals/knowledge-surface-automation/README.md
bun run beep goals doctor
bun run beep goals index --check
bun run beep explore --check
bun run beep lint reflection-artifacts
```

Run `bun run beep yeet repair` once with the P0 post-repair scope check above.
It is a mutating operation, not a repeatable packet validator. After the reviewed
diff is docs-only, run:

```sh
bun run beep yeet verify
```

Stage only reviewed packet files and the parent link, then publish with
`bun run beep yeet publish --pr --message "docs(goals): plan repository freshness audit"`.
Submit `bun run beep yeet monitor --until-ready --detach`, then wait for its
reported job through `bun run beep yeet job wait <jobId>`. If the user manager
is unreachable, use attached monitoring. Address actionable review threads with
the Yeet reply flow. Stop delivery at mergeable, not at local green or structural
GitHub mergeability.

## Ongoing records

Record friction immediately in [OPPORTUNITIES.md](./research/OPPORTUNITIES.md).
Keep this phase table aligned with the manifest. Store validation and review
receipts under history; do not embed machine identifiers, secrets, or absolute
home paths in the public packet.
