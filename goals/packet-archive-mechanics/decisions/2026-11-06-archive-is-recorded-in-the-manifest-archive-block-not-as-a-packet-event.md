---
title: "Archive is recorded in the manifest archive block, not as a packet event"
date: 2026-11-06
reversal: "Add an archived event type to the packet event vocabulary (body, fold branch, SetStatus switch, transition writer) in its own reviewed PR and have TombstoneWriter append it; existing archive blocks stay valid"
---

`beep goals archive --write` records the operation only in `ops/manifest.json`
(`archive: ArchiveRecord`). Adding an `archived` packet event is more than a new
literal: it needs an event body, a fold branch, a SetStatus body switch case, a
transition-writer request type and a decision on derived state and trace. That is
a change to the packet event vocabulary and gets its own reviewed PR; the 65
packets with event streams are untouched by the sweep. Doctor, INDEX and the
capability graph read the manifest, so nothing observable depends on the event.
