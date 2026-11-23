---
title: JSONL error messages are readonly field initializers, not getters
date: 2026-11-22
reversal: Replace each `override readonly message = ...` field with a `get message()` getter that reads the schema fields.
governs:
  - src/JsonlError.ts#MalformedLine
  - src/JsonlError.ts#UnknownEvent
  - src/JsonlError.ts#InvalidData
  - src/JsonlError.ts#UnserializableData
  - src/JsonlError.ts#JournalResync
enforcedBy: []
---

Every error class derives its `message` in a class field initializer, which runs after the base constructor has assigned the schema fields.
Bun may inspect `Error.message` during base construction, before a derived getter can safely read those fields, so a getter would read fields that are not yet set.
Rejected: a `get message()` getter, the usual way to compute a message from fields lazily.
