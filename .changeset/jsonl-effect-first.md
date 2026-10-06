---
"@beep/scratchpad": patch
"@beep/repo-configs": patch
---

Add an Effect-first JSONL journal lab adapted from `@effected/jsonl`, preserving
its upstream MIT notice. Keep registry-specific payload types and the caller's
service identity without assertions, and expose value-first and pipeable codecs.

Derive data and error types from schemas, use Effect collection and text helpers,
and cover encoding, selection, replay, lifecycle transitions and safe patches.
Journal configuration uses optional keys and Effect Duration values.

Record the four native-runtime exceptions needed for weak registry ownership,
registry immutability, Context.Service augmentation and class-payload patches.
