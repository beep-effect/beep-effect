---
title: A notification that fails to decode is logged and dropped, never fatal, and an idle survives unstable fields
date: 2026-11-26
reversal: Fail the connection from dropUndecodableNotification and decode the idle state_update strictly, without IdleStateUpdateEnvelope.
governs:
  - src/AcpProtocol.service.ts#ACP_PROTOCOL_DECODE_WARNING_KINDS
  - src/AcpProtocol.service.ts#IdleStateUpdateEnvelope
  - src/AcpProtocol.service.ts#makeAcpPatchedProtocol
enforcedBy: []
---

A notification has no reply to fail, so one the schema rejects is logged and dropped. An agent repeats a bad shape on every update, so each distinct failure is warned about once per connection, up to 64 kinds; array indices are folded out of the dedupe key, so one defect at new indices stays one kind.
An idle `state_update` is what ends a generation-2 prompt. `usage` and `error` are unstable in the v2 draft and agents report partial or newer shapes, so an idle that fails strict decoding is re-decoded without those two fields.
Reason: ending the connection would kill a working session because one update, possibly from a newer spec, did not parse; dropping the idle would hang the prompt.
Rejected: failing the connection on a notification decode failure, and dropping an idle whose optional fields fail.
