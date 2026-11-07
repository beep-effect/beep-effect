---
title: "Registry is a thin overlay beside the session ledger"
date: 2026-11-06
lane: "@chore/deps-update-11-6-26 (grill session)"
reversal: "Fold the four authored fields into the session-ledger row schema and delete registry.json, or restore the 2026-10-05 independent store with its own lane/packet/PR fields."
---

The session ledger (~/.local/state/beep/sessions/<repo-key>.jsonl, 4971 rows on 2026-11-06) already records clone, lane, branch, pr, state and summary per checkout; orchestrator/ and merge-reservations/ sit beside it. A fourth checkout-keyed store duplicating lane and PR was rejected. The registry is ~/.local/state/beep/fleet/<repo-key>/registry.json authoring only seatRole, owningSeat, drainStatus, retentionExempt; the joined view reads lane, pr and state from the ledger's latest row. Rejected: extending the ledger row (append-only session history is the wrong home for slowly changing checkout facts); the SPEC's independent store (two sources of truth for PR and lane, which the exploration already rejected).
