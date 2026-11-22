---
title: "A lock wait while opening or reading is capped at the read deadline; only writes wait the busy timeout"
date: 2026-11-20
lane: "goals/gate-run-history-lane"
reversal: "Open every connection with the driver's 5 s busy timeout for reads and writes alike."
---

bun:sqlite waits on a lock synchronously, so an Effect deadline cannot interrupt a busy wait. The store therefore opens and reads with PRAGMA busy_timeout set to the read deadline (250 ms), raises it to the write timeout (5 s) only before a write transaction, which runs after the console was printed, and checks PRAGMA user_version before taking the migration's write lock, so an open of a current schema never waits on a writer. In WAL mode a reader is never blocked by an ordinary writer; an exclusive-mode holder makes a read fail open-busy. The 250 ms caps each SQLite lock wait, not a whole open and read: opening and migration retry open-busy with backoff. A gate run reads under its own deadline over the whole answer, so its console never waits longer; gate history and gate series have no such deadline and can take several lock waits under contention. A failed open is not remembered: the next use, such as the write after the console, opens again. A failed read is reported with reason open-failed, the closed domain having no read reason; read-deadline is left to the gate run's own deadline, which renders 'no answer within 250ms'.
