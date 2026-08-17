---
"@beep/repo-cli": minor
---

Ship the full packet trace projection: `ops/trace.json` now carries the
event timeline of the unambiguous linear prefix (`PacketTraceEntry` with
each event's body embedded verbatim) alongside the derived state. First
`PACKET_PROJECTOR_VERSION` bump (1 → 2): committed v1 traces retire by
decode failure and regenerate from the stream — projections are disposable
derived copies, never upcast.
