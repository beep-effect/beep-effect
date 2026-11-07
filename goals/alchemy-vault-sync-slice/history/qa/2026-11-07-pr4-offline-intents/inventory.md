# QA round 5 — vision judge inventory

- judge: `claude-opus-5-5` (effort `inherited`)
- session: `session.json`
- findings: 4 (0 required, 4 polish)

## Required findings

_none_

## Polish findings

### R5-01 — P2 — Mid-reconnect frame shows the 'Sidecar offline' notice and pill next to an enabled primary 'Sync now' button

- lens: `visual-hierarchy`
- repro: From the offline-reload state, restore the sidecar (reconnect-replay-and-revert, around t=60.4s after seq 97, the retry transition start). In transition-w17_00002 the pill still reads 'sidecar offline' and the amber notice reads 'Sidecar offline. Status and conflicts refresh when it reconnects.' with Retry greyed out. In the same frame the action has already become an enabled green 'Sync now', 'Mark reviewed' is back, and the red revert error is visible. The stats grid stays hidden until marker-w20, when the pill flips to 'connected'.
- fix: Derive the pill, the notice and the action button from one connection state so they change in the same render. While the replay is running, show a single 'Reconnecting…' or 'Replaying 2 actions…' state with the action disabled. Show 'Sync now', the revert error and the stats grid only after the status read confirms the sidecar is connected.
- evidence:
  - `frame` `frames/transition-w17_00001.png` frames 1–1 events 96, 97
  - `frame` `frames/transition-w17_00002.png` frames 2–2 events 96, 97
  - `frame` `frames/marker-w20_00000.png` events 98

### R5-02 — P2 — The composer pill still sits on the Vault sync card's bottom edge when the card has its full offline content (R4-01 not fully resolved)

- lens: `floating-chrome`
- repro: Go offline and click 'Sync now' (seq 49). The card grows by the offline notice and the 'Sync queued' chip. After the dock scroll (seq 59) and the review (seq 74), the card is scrolled to its end: its bottom border is at about y=707 and the dock ends at about y=714. The pill spans about y=688–708 and covers the remoteEdit box's bottom border and the card's bottom edge (cropped view marker-w12: the pill straddles the card bottom at y≈236). The bottom padding of the scroll area is about 8px, much less than the pill's height.
- fix: Make the dock scroll area's bottom padding at least the pill's height plus its bottom offset, for example padding-bottom: calc(var(--composer-pill-h) + var(--composer-pill-offset) + 8px), or use scroll-padding-bottom, so the card's last border can scroll clear of the pill.
- evidence:
  - `frame` `frames/click-w6_00000.png` events 49, 52, 55
  - `frame` `frames/hover-w8_00002.png` events 56, 57, 59
  - `frame` `frames/transition-w10_00002.png` events 72, 74, 76
  - `frame` `frames/click-w11_00000.png` events 74, 76, 78
  - `frame` `frames/marker-w12_00000.png` events 79

### R5-03 — P2 — After an offline reload the stats grid and the 'event event-c1' line disappear, so the card reflows and loses the queue counts

- lens: `proportions`
- repro: Queue a sync and a review while offline, then reload (offline-reload-keeps-queue, seq 79). Before the reload (marker-w12) the card shows Pending, Errors, Queued ops '0 (+2 waiting)', Open conflicts '1 (1 reviewed, waiting to sync)' and the 'event event-c1' line. After the reload (transition-w13, reloaded.png) the whole stats block and the event line are gone. The card shrinks by about 90px, while the conflict row and the queue still persist.
- fix: Persist the last known status snapshot together with the intent queue and render it after the reload, marked as stale (for example a 'last seen' caption or muted values). If that is not possible, keep the grid's rows with placeholder values so the layout and the queued-count row stay stable.
- evidence:
  - `frame` `frames/marker-w12_00000.png` events 79
  - `frame` `frames/transition-w13_00000.png` events 80, 81
  - `screenshot` `offline-reload-keeps-queue--reloaded.png` events 79

### R5-04 — P2 — Graph node labels still collide in the Graph panel (R4-06 persists, outside this change)

- lens: `legibility`
- repro: Open the pizza tutorial ontology with the Graph tab active and look at the labels near the central nodes. 'has topping' and 'has base' run together ('has toppinghas base' in transition-w17_00000). In hover-w8_00005, 'Mozzarella topping' and 'has topping' overlap and 'has base' sits on top of 'Pizza'.
- fix: Out of scope for the Vault sync change. Add label collision avoidance to the graph renderer (offset or hide overlapping labels, or render edge labels at the edge midpoint with background pills).
- evidence:
  - `frame` `frames/hover-w2_00002.png`
  - `frame` `frames/transition-w17_00000.png`
  - `frame` `frames/hover-w8_00005.png`

REQUIRED FINDINGS: 0
