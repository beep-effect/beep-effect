## YouTube embed probe

**Answer: No.** Removing the iframe sandbox does not make the video play, and switching from
`youtube-nocookie.com` to `youtube.com` does not make it play. After approximately five seconds,
all three sibling frames showed **“Video unavailable”**:

- A: sandbox + `youtube-nocookie.com` — unavailable
- B: no sandbox + `youtube-nocookie.com` — unavailable
- C: no sandbox + `youtube.com` — unavailable

Therefore, the app's sandbox and nocookie attributes are not the cause of this playback failure;
YouTube refuses playback from this origin/environment regardless.

Screenshot: [probe-youtube-sandbox.png](screenshots/probe-youtube-sandbox.png)

| id | severity | summary | repro | location | recommended fix | screenshot |
| --- | --- | --- | --- | --- | --- | --- |
| F-01 | P1 | At a 793 px-wide Chrome viewport, the ontology's fixed three-column workbench collapses into severe overlap: source, inspector fields, SPARQL, and validation paint over one another and controls become unreachable. | Open Ontology at `http://127.0.0.1:1421`; open the pizza fixture; use the normal narrow Chrome window and capture the full page. | `packages/ontology/ui/src/aggregates/Session/Session.workbench.tsx:749` hard-codes `300px + minmax(360px,1fr) + 340px` with no responsive breakpoint. | Add responsive breakpoints: collapse the tree and inspector into drawers/tabs below the minimum desktop width, and ensure each pane scrolls independently without overlay. | [lane-f-01-ontology-narrow-overlap.png](screenshots/lane-f-01-ontology-narrow-overlap.png) |
| F-02 | P2 | Theme switching is available only inside Chat; Home, Ontology, and Vault sync have no light/dark/system control, so theme behavior cannot be exercised consistently across all four surfaces. | Open Chat and observe **Switch to light mode**; switch to Ontology or Vault sync and observe that the control disappears. | `apps/professional-desktop/src/chat/ui/ChatApp.tsx:101` owns the only `ThemeToggle`; surface composition in `apps/professional-desktop/src/App.tsx:215` provides no shell-level theme control. | Move a three-state light/dark/system selector into the shared desktop navigation/header so every surface exposes the same control and persisted mode. | [lane-f-02-theme-control-missing.png](screenshots/lane-f-02-theme-control-missing.png) |
| F-03 | P2 | Ontology undo/redo expose the accessible names “U” and “R”; the explanatory text exists only in hover tooltips, making keyboard and screen-reader navigation cryptic. | Open the pizza fixture; add a triple; Tab through the toolbar or inspect the accessibility tree; the buttons are announced as **U** and **R**. | `packages/ontology/ui/src/aggregates/Session/Session.workbench.tsx:672` and `:688` render single-letter buttons without `aria-label`. | Add `aria-label="Undo ontology change"` / `aria-label="Redo ontology change"`; keep tooltips supplemental and retain visible focus rings. | [lane-f-03-undo-redo-accessible-names.png](screenshots/lane-f-03-undo-redo-accessible-names.png) |

Transport-degraded behavior is explicit in source and presents a titled “Desktop transport
unavailable” state with a redacted message and diagnostic ID
(`apps/professional-desktop/src/App.tsx:260`). A destructive live sidecar outage was not induced.
Console/network inspection was interrupted by the Chrome control session resetting, so no
console/network finding is claimed without evidence.
