# P2 recorded browser QA — round ledger (2026-08-25)

Surface: Professional Desktop `editor-proof` shell panel over
`https://professional-desktop.beep.localhost:1355/` (browser mode, fixture
sidecar, `VITE_REACT_GRAB=0`). Lane: `beep qa record --lane playwright`
with the harness at `apps/professional-desktop/.beep/qa-capture.mjs` (a copy
lives beside this ledger as `qa-capture.mjs`). Ten scenarios: open through
the dock, minimal toolbar/help/readability, minimal disabled paths, profile
switch remount, every command by mouse and keyboard, slash menu + markdown
shortcut, keyboard focus order + accessible names, canonical JSON import
lifecycle, 480 px + touch, network egress.

| Round | Capture | Findings surfaced | Fixed at the source |
| --- | --- | --- | --- |
| 0 (standalone dry runs) | red → 80/81 | blank first frame (dev-mode boot slower than `networkidle`); `react-grab` overlay intercepting clicks after `Ctrl+Shift+C`; slash items showing help text instead of labels; editor region collapsing to zero height when the JSON drawer opened in the short dock box; 480 px editor starved by drawer + alert + wrapped controls | harness waits for the shell nav; `react-grab` gated behind `VITE_REACT_GRAB`; `projectSlashItems` keeps help text as keywords, not `hint`; `CapabilityComposer` is a box-filling column (toolbar/help pinned, editable scrolls) and falls back to `EditorWireViewer` for undecodable initial state; panel scrolls as a whole with a `min-h-64` editor floor, capped drawer, stale alert cleared on edit |
| 1 (recorded) | 81/82 | collector CORS console noise from the https origin (events still complete: 777 lines, 58 markers); `Ctrl+B` under `minimal` landed on a collapsed selection | recorder noise ledgered separately in the manifest; receipt in `research/OPPORTUNITIES.md` |
| 2 (recorded) | 81/82 | same `Ctrl+B` cadence failure; noise now surfaced as `Failed to load resource` | noise filter widened to the console source URL; selection settles added after `Shift+Home`/`Shift+End` (Lexical syncs selection asynchronously — the P0 harness lesson) |
| 3 (recorded, judged) | **CAPTURE-GREEN** 82/82, 0 app console errors, 723 events; extract clock `beacon` high (10.1 ms residual), 74 artifacts; judge `gpt-5.6-sol` high → **3 required** (`R3-01` P1 three fixed ontology panes clip their gate text at 480 px; `R3-02` P1 no visible focus indication when Tab enters the editor; `R3-03` P1 focus-driven scroll leaves the mode/import controls half-hidden under the dock tab strip) | `R3-02`: inset `focus-within` ring on the editable's scroll container; `R3-03`: the mode/import control row is sticky and opaque above the panel scroller; `R3-01`: the session-notice text now wraps inside narrow panes (`[overflow-wrap:anywhere]`) — the three-column upper dock itself is pre-existing shell layout outside this goal (a responsive single-pane dock is a shell redesign), so the narrow scenario now exercises the panel with its group maximized, the dock's own overflow alternative |
| 4 (recorded) | pending | | |

Exit gate: a round with `CAPTURE-GREEN` and a judge inventory with
`requiredCount: 0`. The final round's `inventory.json`, `inventory.md`,
`session.json`, and `manifest.json` are copied beside this ledger.
