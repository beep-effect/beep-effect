---
"@beep/repo-cli": patch
---

Harden the packet control-plane core before close: digest verification
recomputes sha-256 over the raw parsed JSON's canonical encoding so injected
unknown keys are detectable, `readEventFile` refuses an event whose
packet/root disagrees with its locator, `explore --check` reports advisory
`packet-status-drift` against the root-specific manifest status field,
`set-status` to the current derived status skips instead of appending a
self-transition, writer requests decode actor and timestamp through the
event schemas, and fork verdicts sort by a seq-then-digest total order with
findings keyed by parent digest.
