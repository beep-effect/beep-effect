# Recording lane selection

| Criterion | Lane A — playwright | Lane B — OBS + real Chrome |
|---|---|---|
| Driver | Harness code (`.beep/qa-capture.mjs`) | codex Chrome extension or human |
| Video source | `recordVideo` webm (page compositor) | OBS window capture (real pixels) |
| OS cursor visible | No — witness fake-cursor dot compensates | Yes |
| Native drag/selection semantics | Synthetic pointer stream — cannot produce native selection-drag escalation or OS drag ghosts | Real — the only lane that can show them |
| Determinism / repeatability | High (scripted, seeded) | Low (agent- or human-driven) |
| Headless / CI-able | Yes | No (needs session + portal) |
| Clock anchor | Sync beacon (least-squares fit) | OBS RecordStateChanged epoch |
| Cost per round | Minutes, unattended | Tens of minutes, attended-ish |

**Default**: every loop round is Lane A. Add ONE Lane B round per milestone
when the fixes under test involve native drag semantics, cursor affordances,
or OS-level selection (the dock-react `preventDefault`/`pointercancel` class),
or as the final polish round before closeout.

**Failure modes**: Lane A misses native-only artifacts (it cannot create
them); Lane B misses nothing visually but is unrepeatable — never use it as
the only evidence for a regression gate.
