---
title: "The history read deadline belongs to the caller"
date: 2026-11-19
lane: "feat/gate-report-services"
reversal: "Put the deadline back on the history service shape and record a schema-first exception."
---

The history contract answers labels and a delta for a report; it carries no deadline of its own. The gate run request names how long to wait (250 ms by default) and the run entry enforces it, because a service shape holds operations, not data. A history that fails or misses the deadline costs one omission line and nothing else.
