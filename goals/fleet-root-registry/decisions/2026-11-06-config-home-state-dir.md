---
title: "Roots and registry live in the state dir under the session-ledger repo key"
date: 2026-11-06
lane: "@chore/deps-update-11-6-26 (grill session)"
reversal: "Move both files to ~/.config/beep/fleet/<repo-key>/ and update the FleetRoots and FleetRegistry stores' path resolution."
---

~/.local/state/beep/fleet/<repo-key>/roots.json and registry.json, where <repo-key> is the session ledger's key (github.com__beep-effect__beep-effect). beep-effect-private gets its own fleet by construction. BEEP_FLEET_ROOTS (path-list) overrides the file for tests and timer units. Rejected: XDG config dir (a second tree nothing else uses); an in-repo fleet.json (ties the public repo to one workstation's layout).
