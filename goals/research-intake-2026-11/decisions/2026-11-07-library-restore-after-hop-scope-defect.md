---
title: "Restore the library from the pre-intake backup after the hop-scope defect, then re-run hop 0"
date: 2026-11-07
lane: "feat/research-intake-2026-11"
reversal: "The tainted library is kept at ~/.cache/beep/library-tainted-hop0-2026-11-07; swap it back into place to undo the restore"
---

The first hop-0 inventory wrote hop-1 and hop-2 derivations against the four October intake ids (0 before, about 90k each after), which the SPEC forbids as an edit to October accounting. A reflink backup of the library was taken before the intake's first write, and only this goal's Box acquisition and inventory had written since, so the library was restored from that backup rather than pruned edge by edge. Box acquisition, staging and inventory were then re-run on code that derives hops only for the recorded intake. Rejected: deleting the October-keyed edges in place (no tested prune path, and the catalog history would still carry them).
