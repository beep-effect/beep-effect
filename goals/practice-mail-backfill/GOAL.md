# GOAL: Import the historical mail estate into Outlook search

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: the attorney's archive mailbox holds the historical PST estate under
`/Historical-PST`, imported via Purview network upload in reconciled ≤100 GB
tranches on a properly licensed seat, with Outlook search over the history
verified and every step recorded so a future assistant could repeat it.

This is a compact `/goal` launcher — for a documentation-and-operations
goal: deliverables are the runbook instance, the operator-attended
execution, and the evidence trail, not product code. Treat the packet files
as the detailed contract:

- `goals/practice-mail-backfill/README.md`
- `goals/practice-mail-backfill/SPEC.md`
- `goals/practice-mail-backfill/PLAN.md`
- `goals/practice-mail-backfill/ops/manifest.json`

Read those first, then `AGENTS.md`, `CLAUDE.md`, the source exploration's
decision log (`explorations/practice-office-provisioning/DECISIONS.md` —
binding), and the mechanics reference
`explorations/practice-office-provisioning/research/r2-purview-pst-import.md`.

Scope:

- In: this packet's `research/` + `history/`; operator-attended tenant
  operations (EOP2 seat, archive enablement, Purview import jobs).
- Out: any Graph mail write; retention-policy design or releasing retention
  hold; curated per-matter filing into Box; PST content processing;
  SKU changes beyond the one seat.

Workflow:

1. P0: CSP quote (term + cancellation) and dry-run license assignment
   beside Business Premium; open the >100 GB support case; census source
   PSTs (counts/sizes/nesting only — no client-identifying names in the
   repo).
2. Tranche uploads are hard-gated: P2 runs only after the preservation
   gate of `goals/oppold-corpus-salvage-restoration` passes for the mail
   media, with the staging manifest derived from the preserved estate's
   verified census. P0/P1 preflight runs in parallel, ungated.
3. Choose the staging form from the nesting census: flat directory + blank
   `FilePath`, or `--recursive=true` + `FilePath` prefixes. The flat form
   uploads only top-level files — flatten first or go recursive.
4. Import with `IsArchive=TRUE`, `TargetRootFolder=/Historical-PST` — never
   root `/`.
5. Reconcile each tranche against the staged manifest before the next; gate
   tranches 2/3 on the support-case verdict.
6. Verify Outlook search with the attorney; record evidence.
7. Leave `RetentionHoldEnabled` ON.
8. At P4 Close, write the reflection via `/reflect`;
   `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied (license evidence,
      complete runbook, reconciled tranche 1, support-case verdict before
      2/3, verified search).
- [ ] Required verification commands pass, or unrelated failures are
      reproduced and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/practice-mail-backfill/GOAL.md)" -le 4000
jq . goals/practice-mail-backfill/ops/manifest.json
git diff --check -- goals/practice-mail-backfill
```

Stop and report on a service-plan conflict in the license dry-run, a
contradicting support-case verdict, or an unexplained reconciliation loss.
Every tenant mutation is operator-attended — never run one from an
unattended session.

Done only when acceptance passes and verification is complete, or when a
blocker is reported with file/command evidence.
