# Instance

- id: `scheduler-protocol-eviction-mode`
- file:line: `packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts:3411`
- symbol: `schedulerProtocolCommand`
- members: `enableEvictions`, `disableEvictions`
- evidence: E2/E1 at `Quality.command.ts:3421-3432` — combined true is
  rejected, then the command exclusively inspects, enables, or disables.

Audited at checkout `3330f9881a50c96d3f2ec0fcad76f0f7a09027e4`
against main corpus `52fcc8d1353db9481ef9edb6cc9619500f95568d`.
Replacement P3 review remains pending.

# Current shape and cardinality

Two `Flag.boolean` values accept four raw parser results. The command rejects
combined true with the exact message and command metadata at lines 3421-3426,
then a nested ternary chooses status read, enable write, or disable write.
Four raw pairs are accepted by the flag parser and three resolved intents are
legal: `inspect`, `enable`, and `disable`.

# Cardinality gap

The raw pair has cardinality four. The resolved intent has cardinality three
because combined enable and disable is rejected before protocol I/O.

# Target schema

Reuse the file's existing `$I` and `LiteralKit` imports:

```ts
const SchedulerProtocolEvictionMode = LiteralKit(["inspect", "enable", "disable"]).pipe(
  $I.annoteSchema("SchedulerProtocolEvictionMode", {
    description: "Inspection or mutation requested for the scheduler eviction protocol.",
  })
);
type SchedulerProtocolEvictionMode = typeof SchedulerProtocolEvictionMode.Type;
```

Keep both raw command flags. Inside the handler, retain the combined-true
error before any protocol read or write. After that gate, derive one mode and
match it: inspect calls `admissionProtocolStatus`, enable calls
`setAdmissionEvictionProtocol("on")`, and disable calls
`setAdmissionEvictionProtocol("off")`. Preserve the two printed lines exactly.

# Migration inventory

- `Quality.command.ts:3408-3420` — retain both flags, names, defaults, and
  descriptions; add the private mode kit nearby.
- `Quality.command.ts:3421-3432` — keep the conflict error byte-for-byte and
  before I/O, derive a mode only after it, and replace the nested ternary with
  the kit match.
- `quality-scheduler.test.ts:2211-2245` — retain inspect/enable/disable command
  coverage and add exact conflict-message plus unchanged-protocol assertions.
- No other source reads these command flags. The protocol service and its
  persisted `on | off` format are separate and unchanged.

# Guard-deletion accounting

Delete the nested enable/disable ternary and the implicit call-site obligation
to interpret the valid pairs. The raw combined-true validation remains because
it preserves an accepted parser input and its deliberate CLI error.

# Encoded-side impact

None. The new literal is an in-process post-validation command intent. CLI flag
names/defaults, protocol state files, `on | off` values, messages, exit code,
and printed output remain exact.

# Test impact

Table all four raw pairs. Assert inspect performs only a status read, enable
writes on, disable writes off, and combined true fails with the current message,
command, and exit code before state changes or output. Retain the existing
service lock/concurrency tests unchanged.

# Risk and sequencing

Tier 1 CLI-local migration. Do not replace the raw flag object with the literal
at the parser boundary; doing so would lose the custom conflict diagnostic.
