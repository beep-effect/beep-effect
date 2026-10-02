---
"@beep/xstate": minor
"@beep/professional-desktop": minor
"@beep/identity": patch
---

Add the `@beep/xstate` driver for XState v6 and `@xstate/effect`: a Stately
inspector service, machine JSON export, and model-based test bridges built on
`effect/Arbitrary`. Document intake in the professional desktop app now runs as
a statechart (`documentIntakeMachine` with a spawned `intakeBatchMachine`)
instead of hand-rolled state mutators. A failed vault configuration read is now
visible and retried with backoff, the saving card no longer flickers back to
idle before the configuration is confirmed, and manual path submission no
longer races its own read.
