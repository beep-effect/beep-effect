# App composer and Vault r26 audit — 2026-09-09

## Scope and frozen source

This bounded audit covers only:

- `r26-apps-thread-composer-safety-gate`;
- `r26-apps-composer-send-gate-open-payload`;
- `r26-apps-vault-sync-status-success-connected`.

Source was read at checkout
`7440cb8c4302ce64b87860069a464bafbf65f576`, with packages/apps corpus
`9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`. Upstream subsequently advanced
to `52fcc8d1353db9481ef9edb6cc9619500f95568d`; implementation must refresh
source and line citations after that merge. This handoff does not claim the
later source was audited.

React props types are explicitly inside the campaign net. The co-carrier rule
still applies: a Boolean prop in one named record and a payload-bearing Option
in another record do not become sibling members merely because one is derived
from the other at a call expression. Function flag parameters remain excluded,
while a named props record is adjudicated from the members it actually owns.

## ThreadComposer safety gate

### Source and owner graph

- `apps/professional-desktop/src/chat/ui/Composer.atoms.ts:416-420` declares
  `ComposerSurfaceView` with `safetyGate: Option<ComposerSafetyRefusal>` and two
  callbacks. It has no `sendDisabled` member.
- `Composer.atoms.ts:438-445` is the sole surface writer and reads the existing
  safety-gate atom directly into that Option field.
- `apps/professional-desktop/src/chat/ui/Composer.tsx:191-203` reads the surface
  Option in `ThreadComposer`.
- `Composer.tsx:205-220` passes the inline presence projection as
  `ChatComposer.sendDisabled` and separately passes the Option to
  `ComposerSafetyGateNotice`.
- `packages/foundation/ui-system/editor/src/chat/chat-composer.tsx:159-188`
  declares the actual named `ChatComposerProps`. It owns the optional generic
  Boolean `sendDisabled` and independent `streaming`, but it does not own
  `safetyGate` or `ComposerSafetyRefusal`.
- `chat-composer.tsx:563-579` defaults `sendDisabled` to false and lines 606-614
  forward it through the generic surface. The button consumes it at line 283.

### Adjudication

**Exclude/archive the r26 raw ID; do not author a design.** The raw 4/2 table is
the truth table of one inline Option-presence projection, but there is no named
carrier with both members. `ComposerSurfaceView` owns the Option; the separate
foundation `ChatComposerProps` owns a generic disable Boolean. The JSX call is
a boundary adapter between those owners.

Promoting this finding would require either inventing an app-specific safety
payload in the reusable foundation props or replacing a generic disable input
that legitimately represents unrelated caller reasons. That would widen the
blast radius without deleting a same-carrier invariant. Keep
`r2-apps-thread-composer-send-gates` D1: its actual props observations
`streaming` and `sendDisabled` remain independent, including combined true
where Stop replaces Send while the safety notice remains visible.

Preserve the current behavior exactly: seed safety refusal disables Send,
renders message-only refusal copy, does not echo refused content, and may
coexist with streaming/Stop. Keep the shared prop's false default and generic
API. No new literal, tagged union, or app-specific foundation dependency is
warranted.

## ComposerSendInput gate

### Source and owner graph

- `apps/professional-desktop/src/chat/ui/ComposerPolicy.ts:333-338` declares the
  private named `ComposerSendInput` with `gateOpen`, `turnActive`, `seed`, and
  serialized `state`. It does not own a safety-gate Option.
- `ComposerPolicy.ts:401-417` consumes `gateOpen` first, then the independent
  `turnActive`, before document projection and the existing exhaustive
  `ComposerSendDecision`.
- `apps/professional-desktop/src/chat/ui/Composer.atoms.ts:305-317` constructs a
  stable registry-backed callback and captures `gateAtom`, which is an Atom
  handle rather than a payload field.
- `Composer.atoms.ts:318-323` is the sole production record construction. It
  reads the Option and immediately passes only `O.isSome(...)` as `gateOpen`;
  the Option value is not another member of the object.
- `Composer.atoms.ts:98-102` owns the actual per-thread/per-seed Option atom.
  Lines 129-149 may close an existing seed gate, retain the general draft while
  gated, and deliberately never open a new seed gate from edits.
- `apps/professional-desktop/test/composer-policy.test.ts:48-140` constructs the
  public policy input directly with Boolean `gateOpen` values and covers gated,
  streaming, decode, safety, size, and send decisions.

### Adjudication

**Exclude/archive the r26 raw ID; do not promote or design it.** The actual
named Boolean carrier remains `ComposerSendInput.gateOpen,turnActive`, whose
four combinations are supported and whose stable
`composer-send-input-gates` record correctly remains D1. The gate Atom handle
at the writer is not the Option payload and is not a Boolean member. The Option
read is flattened before record construction, so there is no current
`safetyGate,gateOpen` co-carrier.

Replacing `gateOpen` with the entire Option would be a possible local API
cleanup, but it would only substitute one representation for a lone Boolean;
it would not remove an illegal combination from a multi-member carrier. It
would also pass a refusal payload into a policy that intentionally needs only
the silent gate decision while UI copy reads the Option through
`ComposerSurfaceView`. That cleanup is outside this campaign instance.

Preserve all four `gateOpen × turnActive` inputs and exact priority. Combined
true stays legal and returns `gated` before the streaming notice. Preserve the
stable callback lifetime, latest registry reads, document/refusal schemas,
draft retention/restoration, decision tags, notice/refusal writes, and exact
Boolean callback result.

## VaultSyncPanel connected projection

### Source and owner graph

- `apps/professional-desktop/src/sync/VaultSyncPanel.tsx:299-307` reads the
  existing `AsyncResult<VaultSyncStatus, unknown>` and independent panel state.
- `VaultSyncPanel.tsx:309` declares one Boolean local, `connected`, from the
  inline callable predicate `AsyncResult.isSuccess(status)` and the successful
  status payload's current `connected` field.
- `VaultSyncPanel.tsx:326-339` separately reads success for provider fallback,
  badge state, and disconnected reason/probe-time UI.
- `VaultSyncPanel.tsx:340-363` combines the local with the independently
  existing `VaultSyncPanelState` for trigger and conflict-review behavior.
- `packages/documents/use-cases/src/aggregates/Sync/VaultSyncEngine.ts:65-116`
  is the existing wire owner for connected, optional disconnect reason, probe
  timestamp, provider, and counts.
- Stable design `vault-sync-status-connected.md` already specifies a
  byte-compatible decoded `VaultSyncConnection` while preserving the old wire
  keys, reasonless compatibility input, all five reasons, optional-key defaults,
  timestamps, and root-free Vault subset.

### Adjudication and subsumption

**Archive the r26 raw ID as subsumed/ineligible; do not create a panel literal
or second design.** Its 4/3 truth table describes the conditional expression:
connected true implies a successful AsyncResult. The proposed `status.success`
member is not a named Boolean field or local; it is an inline predicate call.
Only `connected` is materialized, so there is no two-Boolean panel carrier.

The three projected observations `not-ready | disconnected | connected` are
already represented without a new vocabulary by nesting existing owners:
AsyncResult retains Initial/Failure/Success plus waiting, and a Success payload
retains the designed `VaultSyncConnection`. A new UI LiteralKit would flatten
Initial versus Failure and duplicate the connection union while other readers
still require both original values.

The existing Tier 2 design was refreshed with this r26 subsumption. Its UI
migration deletes `connected`, narrows the existing AsyncResult, and consumes
the successful `status.value.connection` through schema-derived union guards
or matching. It preserves:

- connected, reasonless disconnected, and all five reasoned disconnected
  decoded cases;
- old encoded `connected` and `disconnectReason` keys;
- missing/null optional-key defaults and old-codec canonical re-encoding;
- `probedAt`, provider, counts, and retry waiting;
- Initial versus Failure status UI;
- independent syncing/reviewing command state and every mixed connection/busy
  row.

The stable Vault owner's canonical coarse cardinality remains 4/3 for
`connected × disconnectReason presence`, expanding to seven specific decoded
connection cases. The raw panel 4/3 does not add canonical cardinality or a new
owner.

## Required canonical actions

Parent-owned reconciliation should:

1. archive `r26-apps-thread-composer-safety-gate` as an isolated cross-owner
   inline projection and retain `r2-apps-thread-composer-send-gates` as D1;
2. archive `r26-apps-composer-send-gate-open-payload` because the source Option
   is not co-carried in `ComposerSendInput`, and retain
   `composer-send-input-gates` as D1;
3. archive `r26-apps-vault-sync-status-success-connected` as subsumed by
   `vault-sync-status-connected`, adding its lines 309/332 only as supporting UI
   guard-deletion evidence if desired;
4. leave the stable Vault Tier 2 metadata at coarse 4/3 and seven specific
   decoded cases.

No new qualified design ID survives this three-record audit. The existing
`vault-sync-status-connected.md` is the sole corrected design surface.

## Queued follow-on observation

The separate raw agents-workspace fallback-draft finding was not admitted or
designed in this audit. Live source at
`packages/agents/client/src/Chat.atoms.ts:1017-1031` shows
`currentDraftOccupied` is `Option<true>`, while `draftToRestore` starts None and
is written Some only inside the lazy fallback reached after
`currentDraftOccupied` and the prior `draftToRestore` are both None. Therefore
both Options cannot be Some in that synchronous block. The raw D1 independence
claim is suspect and should remain held for its separately requested bounded
correction.

## Change boundary and validation

This audit adds only this handoff and the authorized r26 subsumption/source-SHA
notes in `vault-sync-status-connected.md`. It does not alter source, tests,
canonical inventory, lifecycle status, dependencies, generated files, or git
state. Formal P3 remains pending for the stable Vault design. Run the pinned
design validator and scoped no-index whitespace checks before handoff.
