# Friction receipts

- 2026-10-13, #1537: the first `beep-heavy` fixture run could not connect to
  the user bus because `DBUS_SESSION_BUS_ADDRESS` and `XDG_RUNTIME_DIR` were
  absent. Passing the workstation user-runtime environment to `beep-heavy`
  restored the admitted command path. Lane launchers should set those two
  variables before starting workers so qualification reaches the shared
  heavy-work budget on its first attempt.
- 2026-10-13, #1537: wrapping the source-scan `ci lane jsdoc-ratchet` gate
  in `beep-heavy` unnecessarily queued it behind five heavy jobs after the
  package, compiler, and docgen proofs had passed. Cancelled the owned queued
  unit and ran the scan directly. Qualification instructions should
  distinguish scan gates from heavy compiler, test, and docgen commands.
