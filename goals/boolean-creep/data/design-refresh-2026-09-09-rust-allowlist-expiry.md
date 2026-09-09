# Rust, allowlist, and OSV expiry design audit

## Source boundary

- Checkout: `7440cb8c4302ce64b87860069a464bafbf65f576`
- Corpus: `origin/main@9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- A newer `origin/main@52fcc8d1353db9481ef9edb6cc9619500f95568d`
  appeared after this source-frozen round began. Refresh citations and source
  metadata after the parent merges it and before independent P3 review.

## Qualified owners

### `r26-apps-sidecar-ipc-ready-latch`

`lib.rs:1426-1539` proves HTTP starts ready and IPC starts buffering;
`sidecar_ipc_ready` at lines 1277-1297 supplies the only false-to-true write.
The full domain is HTTP-ready, IPC-buffering, and IPC-ready: 4 representable,
3 legal, E1/E4, stored/internal, finite literal taxonomy, Tier 1. The native
Rust target is a private enum under a shared Mutex. It preserves cross-thread
buffering, frame replay, pending-close replay, and the existing Tauri transport
and token contracts. It does not introduce TypeScript schema machinery into
Rust.

### `r26-cli-commands-l-q-allowlist-check-ok`

All live writers and readers are in `AllowlistCheck.ts:294-374` and
`Laws.command.ts:607-623`. Tests prove success-empty and failure-nonempty. The
explicit constructor and decoding defaults at `AllowlistCheck.ts:148-152`
separately establish failure-empty as supported; generic array permissiveness
does not establish success-nonempty. The complete domain is therefore 4/3,
E3, derived/internal, tagged union, Tier 1. The failed case retains an ordinary
array so empty failure preserves the existing default and zero-issue failure
output.

### `r26-cli-commands-l-q-osv-ignore-expiry`

`Quality.osv-ignore.ts:50-64` derives absent, valid-with-DateTime, or malformed
from one raw optional field. That is 4/3, E3/E4, derived/internal, tagged union,
Tier 1. The design preserves omitted expiry, inclusive future comparison,
fail-closed malformed/expired behavior, config syntax, selected ID order,
dropped-ID logging, and Bun arguments. Only synthetic test strings are needed.

## Disqualified owner

Do not admit `r26-apps-sidecar-lifecycle-queries`. `SidecarLifecycle` already
stores exactly one `SidecarLifecycleState` enum behind a Mutex
(`lib.rs:468-518`). `accepts_writes` and `has_exited` are separately called
query methods over that enum, while wait predicates directly match the enum
(`lib.rs:520-547`). There is no parallel boolean field, tuple, schema, props
object, or sibling state carrier to migrate. The raw E1/E4 reasoning describes
the enum's existing semantics rather than boolean creep.

## Verification

- `mise exec bun@1.4.2 -- bun goals/boolean-creep/ops/validate-designs.ts` —
  passed: `design coverage OK: 163 qualified ids`.
- `git diff --check` over the owned design/handoff files and the requested
  Observability correction — passed.
- This lane changed packet design/handoff files only. Product source, tests,
  inventory, status, dependencies, generated files, and git refs remain
  untouched.

## Remaining work

- Parent owns inventory admission and the lifecycle non-admission decision.
- Refresh against merged `origin/main@52fcc8d...` before formal P3.
- Formal independent P3 review remains pending.

## R27 eligibility supersession

The AllowlistCheckSummary behavior documented above remains accurate, including
the supported false/empty default. The R27 CLI seed source audit establishes
that its diagnostics field is a required array, not an optional payload or
Boolean member. Its qualification and design are therefore archived on
eligibility grounds by `data/r27-cli-seed-drift-integration.json`. The real
OsvIgnoreEntry Option<DateTime> qualification remains active and retains the
full-payload behavior proof above.
