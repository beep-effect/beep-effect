# Current-main integration into artifact and Effect-fn lane — 2026-10-06

The lane merged `origin/main` at `7cc77b528a` after PR #1460 landed. The
local artifact-IO and Effect-fn source commits remain reachable, so their
detector and lens fix SHAs need no rewriting. Conflict resolution retained
the packet's new decision and friction rows and the corrected session-ledger
EV004 exception rationale. The generated baseline was rebuilt from the merged
source, not from either side of the textual conflict.

The scanner now covers 1,240 files with 1,920 current findings. Relative to
the 1,919-finding pre-merge lane, the sole added candidate is #1463's
`yeet-scripted-process.test.ts` NodeServices import. Its EV010 row is open:
the test uses scoped scratch files and scripted subprocess replies, and a
Memory filesystem replacement requires a source-bound judgment after the
authorized existing backlog. The ledger keeps that exact ID and occurrence.

#1463 also inserted tests into `yeet-command-wiring.test.ts`, shifting eight
current detector line/ID projections by 57 lines. Their occurrence hashes
are unchanged, and the historical ledger IDs and dispositions were not
renumbered. A detector ratchet, strict inventory validation, and current-base
package proof are required before publication; those results are separate
from this merge receipt.
