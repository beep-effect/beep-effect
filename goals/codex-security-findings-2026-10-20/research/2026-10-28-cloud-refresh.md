# Cloud inventory reconciliation — 2026-10-28

The authenticated Open findings view showed seven findings, all New: one Low
and six Informational, with one page (1–7 of 7). Exact identities and titles
matched the supplied signed-in CSV. No additional open identity was absent
from that file. No finding status was changed during capture.

The session exposes no supported Security Cloud connector list/get/export
action, and the authenticated document advertised no WebMCP tools. The in-app
browser supplied the inventory and all seven complete reports, including
Validation, Evidence, and Attack-path analysis. The CSV alone is Summary-only.

The canonical importer captured all seven in the linked supplemental packet
`../codex-security-findings-2026-10-28/`. The October 20 catalog remains eight
historical identities; none overlaps this batch. The new export omits the
original IDs, so it cannot pass the importer's full-snapshot refresh contract.
No synthetic combined CSV, force replacement, or identity migration was used.

PR #1930 is confirmed merged on 2026-10-21 at
`60b2c052fb72cf19403a43c79ea3a3c9b0b68a89`, final head
`e82c0ca7ff30df14e4abd2fc9e9fdecfa8dae422`. Its historical closure receipts
still need the requirement-by-requirement audit. New work needs its own PR
because #1930 is already merged. The original acceptance criteria remain in
scope alongside the supplemental remediation and exact-ID closure.

## Supplemental identities

| Supplemental record | Full Cloud identity | Title |
| --- | --- | --- |
| [CSF-001](../../codex-security-findings-2026-10-28/findings/CSF-001.md) | `commit:59dd726af40c8191ba736e49b5e42496` | Named-pipe replacement can expose the hub bearer token |
| [CSF-002](../../codex-security-findings-2026-10-28/findings/CSF-002.md) | `commit:143ddd3db8048191b031587694523375` | Skill recovery follows symlinked parents outside the repository |
| [CSF-003](../../codex-security-findings-2026-10-28/findings/CSF-003.md) | `commit:1730861e29908191a3fbef8477f9fb8f` | Abandoned recovery journals bypass backup path containment |
| [CSF-004](../../codex-security-findings-2026-10-28/findings/CSF-004.md) | `commit:450278cb94088191b04bd55569f7db6c` | Quadratic link-fragment scan enables repository-content DoS |
| [CSF-005](../../codex-security-findings-2026-10-28/findings/CSF-005.md) | `commit:8f3863d64f848191896127654ffb856c` | Post-capture settling can delete unarchived worktree changes |
| [CSF-006](../../codex-security-findings-2026-10-28/findings/CSF-006.md) | `commit:e2b089fb69188191b8b5a8eb96c19fca` | Underscore-containing keys bypass new stderr redaction |
| [CSF-007](../../codex-security-findings-2026-10-28/findings/CSF-007.md) | `commit:e5e09e9134588191b573324f5328d292` | Bridge clients send bearer tokens over non-loopback plaintext |

CSV SHA-256: `6406a84ffb7ec54979847c76c6dca63fb4c998ae5c09b1b40efd379f48e06ece`.

## Historical closeout revalidation

All eight original Cloud identities were opened individually on 2026-10-28.
Every status was Fixed; no status was changed. Recorded executable remediation
paths match between accepted head and merge commit. The runbook differs only
by the independently merged interim-device-identity note, which retains the
8787 cleanup and application bearer requirements.

The owning clone retains the genuine verdict, canonical status and successful
monitor job. Completion refresh there with the explicit readiness-job provider
returned verified on 2026-10-28, including 17 required checks and the merge-time
rule suite. Copying the job alone to another clone does not satisfy containment.

GitHub REST returned 448 alerts across all pages. Exact-ID reconciliation found
122 of the 123 captured alerts fixed. Alert #431 (GHSA-6q48-6c7w-9gw2, certifi)
returns HTTP 410: "Alert number 431 has been withdrawn". It is withdrawn rather
than fixed. No captured alert remains open; none was dismissed or mutated.
The existing lane reports retain source-backed remediation and runtime limits.
Closure fields now record these current observations.

Historical completion does not complete the expanded user goal. The seven
supplemental identities still require qualification, merge and Cloud closure.
