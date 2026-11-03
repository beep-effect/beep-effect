# Codex Security Findings (2026-10-14) Spec

## Objective

Remediate every open Codex Cloud security finding visible at
`https://chatgpt.com/mcp-app/connector_openai_defense_factory/open_defense_factory#/findings` for
`kriegcloud/beep-effect` in the 52-finding batch captured on 2026-10-14. Publish
the work through Yeet, reach mergeable hosted state, merge, then resolve the
exact captured findings until no packet-applicable finding remains open.

## Non-Goals

- No accepted-risk or `Won't fix` disposition.
- No raw report bodies, signed artifact URLs, auth headers, cookie values,
  email addresses, secret material, or developer-local absolute paths in tracked
  files.
- No Codex Create PR or patch-apply actions.
- No unrelated refactors, dependency churn, or broad formatting.
- No weakening of quality, security, CI, or review gates.

## Source Hierarchy

1. The user objective that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture and package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, `findings/`, and `history/` files.

## Target Surfaces

- `goals/codex-security-findings-2026-10-14/**`.
- Gitignored raw evidence under `goals/codex-security-findings-2026-10-14/raw/**`.
- Maintained repo paths named by `findings/INDEX.md` after current-HEAD validation.

## Constraints

- Default disposition is `remediate`. `already-fixed` or `false-positive`
  requires strict current-HEAD proof recorded in the finding and triage ledger.
- Minimal root-cause fixes plus one focused regression check per executable-code
  finding. Reuse canonical path-safety, schema, and bounds helpers after live
  source/barrel discovery.
- Schema-first and Effect-first laws govern all production changes.
- Security controls may not be simplified away for diff size.
- Captured summaries stay in ignored `raw/`; tracked records contain only sanitized
  metadata, summaries, validation, decisions, changed files, and proof.
- Browser closure happens after merge, against the exact 52-ID allowlist.
- Preserve unrelated work and stage only reviewed packet intent.

## Acceptance Criteria

- [x] All 52 findings have sanitized tracked CSF records with Codex ID, severity,
      title, source commit, and public summary.
- [x] Every finding has a current-HEAD verdict, disposition, lane, rationale,
      remediation state, changed-file set, and verification evidence.
- [x] Every real finding is fixed at the shared root cause with a focused
      regression check where executable behavior changes.
- [x] Packet counts, manifest, triage ledger, launcher size, sanitation, and
      whitespace checks pass.
- [x] Focused and package proof is recorded; Yeet cheap gates passed, and the
      remaining optional hosted reds have S11 attributions and a main-line owner.
- [x] The branch was published, all review threads closed, and PR #1728 merged
      under the repository's S11 exception with a final 5/5 reviewer summary.
- [x] All 52 captured Codex findings are resolved after merge and the live view
      shows zero packet-applicable open findings.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Launcher size | `test "$(wc -m < goals/codex-security-findings-2026-10-14/GOAL.md)" -le 4000` | Pass |
| JSON shape | `jq .` over both files in `ops/` | Pass |
| Finding count | CSF file count equals 52 | Pass |
| Severity count | 5 Medium, 15 Low, 32 Informational | Pass |
| Raw ignored | `git status --short -- .../raw` | Only `.gitignore` tracked |
| Sanitization | tracked packet secret/path pattern scan | No matches |
| Per-finding proof | command recorded in finding and triage ledger | Pass |
| Repo proof | focused tests, package checks and Yeet cheap gates | Pass; exceptions attributed under S11 |
| Hosted proof | Yeet monitor and review closeout | Threads resolved; optional reds attributed; PR merged |
| Final closure | supported connector or signed-in in-app findings view | Zero packet-open |

## Stop Conditions

- The signed-in CSV export cannot be produced from the findings page.
- Tracked evidence contains a secret, signed URL, auth value, email address, or
  raw local path.
- A fix requires a product or architecture decision outside this packet.
- A proposed security control would rely on a platform-specific fail-open path.
- The same blocking condition repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |

## Decision Log

| Decision | Reason | Reversal path |
| --- | --- | --- |
| Disable automatic publisher PDF discovery and HTTP redirects (CSF-016). | HTML PDF locators are attacker-controlled destinations, and request-after-discovery bypassed the original source classification. Direct PDF acquisition remains available. | Restore discovery only through an egress guard that validates and binds each resolved destination and redirect, with internal-address regressions. |
| Limit drawing models to 256 parts (CSF-022). | It bounds synchronous overlap comparisons at 32,640 and avoids unbounded local resource use; ordinary figure sets are much smaller. | Replace the quadratic comparison with a measured spatial index and worker budget, then raise the schema cap with performance proof. |
| Anchor Claude hook executables to the launch project (CSF-012). | A current checkout can contain attacker-controlled code even when its settings were never trusted; directory presence cannot authenticate a hook. | Add an explicit trusted-checkout approval mechanism with a binding to hook contents, then permit controlled root switching with a regression. |
| Disable automated M365 draft sending (CSF-003). | Graph's send-draft action accepts a mutable draft id without a documented version precondition; the checked bytes can change before send. Draft preparation and manual Outlook send remain available. | Implement an immutable message send or documented version-bound action with a concurrent-edit regression, then restore the tool under review. |
| Remove the two raw Beep log/status Bash grants (CSF-033). | Their prefix patterns allow extra unit selectors and do not enforce the documented Beep-only boundary. Existing Beep CLI and timer-list commands remain available. | Add a separate argument-validating, read-only Beep unit wrapper with tests, then grant only that wrapper. |
| Update the installed Graft 0.21.1 matcher along with its recorded patch (CSF-019). | The local CLI executes the installed dist file, so changing only the repo patch would leave this workstation exposed during the goal. | Restore the saved pre-security dist file or reinstall the pinned package and reapply the prior patch; the saved bytes are outside the repository. |
| Use the shared no-follow contained writer for reviewed goal adoption (CSF-020). | It rejects stable symlink ancestors and retains exclusive creation while reusing repository path policy. | Revert the helper call and regression together after a replacement directory-handle implementation is proven. |
| Cap one knowledge-doctor report at four distinct historical commits (CSF-035). | This bounds archive materialization before any historical tree is extracted; the compressed archive is released after extraction. | Replace the cap with a measured streaming or eviction design, then raise it with a resource-bound regression. |
| Require a matching hash to adopt a pending Box upload (CSF-043). | Matching byte length alone cannot establish that the conflicting file contains the intended attachment. | Restore a size-only path only after an authenticated provider ownership proof and a regression covering same-size foreign bytes exist. |
| Bind review and provenance writes to checked directory descriptors (CSF-046, CSF-047). | A final-component symlink or swapped output directory must not redirect operator writes outside the corpus. | Replace the descriptor operations only with a tested equivalent that preserves no-follow opens and atomic replacement. |
| Require a fresh Graph change key for docket undo deletion (CSF-031). | A planning read cannot protect a calendar entry from later attorney edits, and a second read without a version condition still races. | Restore the old request only after another atomic provider operation can enforce the provisional-category rule; keep the concurrent-edit regression. |
| Recheck every initially exempted terminal shell before retirement deletion (CSF-042). | A shell can leave the attachment scan after writing, so an empty final holder set does not prove the archive is complete. | Replace PID/count tracking with a stronger filesystem change journal and retain a departing-shell regression. |
| Stage and verify chunked Box upload bytes before opening a remote session (CSF-045). | Provider SHA-1 arrives after storage, so a mutable source pathname cannot serve as approved content identity. | Replace private staging only with a precommit digest path or immutable source handle proven against same-size swaps; preserve scoped cleanup tests. |
| Bound skill patch review at 100,000 combined lines and four million LCS cells (CSF-048). | Repository-controlled text could allocate gigabytes before a read-only command returned. Ordinary reviews retain exact hunks; large changed regions receive a valid replacement hunk, while extreme inputs fail with a typed error. | Replace the limits with a measured streaming diff that preserves Git patch validity and a fixed memory budget, then raise them with a resource regression. |
| Restrict skill installation to the repository's two physical skills directories (CSF-049). | An allowed textual target can traverse an install-parent symlink to an external or unrelated in-repository directory; publishing and cleanup would then mutate that directory. The normal in-repository mirror symlink remains supported. | Permit another skill store only through an explicit trusted root, with containment, cleanup, and rollback tests for that root. |
| Close duplicate inherited-gate PR #1723 after #1721 merged the same correction. | The independently merged correction on `main` superseded our docs-only unblocker and made its branch conflict. | Reopen #1723 only if #1721 is reverted and the retired-path check becomes red again; otherwise keep the single merged fix. |
| Refresh the canonical packet from the complete 52-row export (CSF-050–052). | The signed-in open findings view gained three rows after the 49-row capture. The canonical refresh preserved the original 49 IDs and appended the three new IDs. | Refresh again from a complete later export if the open set changes; retain the prior captured identities and decisions. |
| Return practice verdict JSONL in command output rather than writing a fixed workspace file (CSF-050). | The mod host exposes only an opaque file write without a documented no-follow or atomic replacement guarantee. Returning the rows removes the filesystem write boundary while retaining export access. | Restore automatic file export only when the engine provides a tested no-follow, atomic write API; preserve the current explicit-save path until then. |
| Accept only current-head GitHub Actions replay comments in the skills batch issue (CSF-051). | PR comments are untrusted issue content; author identity and head binding are needed before publishing a verdict from them. | Replace the comment channel with an authenticated artifact or check-run lookup that preserves both bindings. |
| Reject future-issued knowledge leases with a dedicated governance kind (CSF-052). | A future 29-day term otherwise suppresses a current finding long before the nominal lease begins. | Introduce a pending status only if it remains ineffective until its start instant and has gate regressions. |
| Reconcile the merged practice hook test and CSF-051 documentation in this PR. | The new `main` test asserted the removed file write, and the latest review scored the merged head 3/5. The operator requested a 5/5 review, including the carried GraphQL author example, so both are addressed in one review wave. | Revert the test assertions only if a reviewed export contract restores the file write; update the author example if GitHub changes the GraphQL login. |
| Close the 52-finding packet under S11 after PR #1728 merged. | The final 5/5 review and closed threads covered the security changes. Optional Heavy / Lint Policy was inherited from the separately merged agent-message code (tsgo directive and Oxlint findings; follow-up PR #1767 owned it; that code and its sibling packet `retired:codex-security-findings-2026-10-14-agent-message` ([last tree](https://github.com/beep-effect/beep-effect/tree/6bb8584b6dbc9aee927a200901c9eebc0abd63b1/goals/codex-security-findings-2026-10-14-agent-message)) were retired by `goals/t3-native-orchestration` on 2026-11-02). Optional Coverage Regression lost its self-hosted Spot runner before a coverage verdict. Vercel failures were deployment rate limits. All 52 captured Cloud IDs were subsequently Fixed. | Reopen a finding if a merged-revision regression demonstrates its repair failed; route inherited lint work through its named main-line owner rather than altering this historical packet. |
