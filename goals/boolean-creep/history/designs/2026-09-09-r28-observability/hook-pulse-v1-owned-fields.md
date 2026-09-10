# HookPulse event-owned fields

Inventory id: `hook-pulse-v1-owned-fields`. P2 design only; stored, persisted,
tagged union, **Tier 2 singleton PR**.
Source: `8f266b878445ca8a7f751f9248da428a4dde39a1`; corpus main:
`663904610cce2a38c06b0619a8c414646b69361c`.

Evidence: the native
[`observability carrier audit`](../data/design-refresh-2026-09-09-r27-observability-carriers.md)
and completed independent
[`correction report`](../data/sweeps/refresh-2026-09-09-r27-main-663904/r27-observability-contract-correction1.jsonl)
with its sibling execution receipt. The correction establishes the complete
162/14 owner table and both raw codec directions. Its census judgment is not
independent P3 review of this design.

## Current shape

Unless another root is named, paths below are relative to
`packages/tooling/library/ai-metrics/`.

`HookPulseV1`, `src/hook-pulse.ts:882`, is one `S.Class` over a flat struct.
The selected actual members are `hookEvent` (`:888`), `notificationType`
(`:903`), `sessionEndReason` (`:905`), and `isInterrupt` (`:909`). Their
TypeScript product can represent fields on the wrong event. The custom
`HookPulseEventOwnedFieldInvariant` at `:913`–`:935` rejects such canonical
rows at runtime. This is a real E2 guard with E1 producer evidence, not a
cross-declaration snake-case/camel-case comparison.

`HookPulseEvent` has nine literals at `:257`. The notification Option's domain
at `:546` contains both `permission_prompt` and `idle_prompt`; reason is an
optional arbitrary string; interrupt is an Option of Boolean. None is legal
even on the owning event. Some(false) is a recorded tool error and differs
from both Some(true), an interrupt, and None, unavailable information.

The raw decoder at `:1124` accepts the whitelisted `HookPulseRawEvent` and
writer stamps, hashes private references, derives wait attribution, clamps
evidence, and drops foreign event fields before canonical decoding. The
reverse transformation at `:1185` also applies ownership filters. Direct
canonical decoding instead rejects a present foreign-owned field. These are
different supported boundary policies and must remain different.

The canonical ledger is `hook-pulse/v1` NDJSON. Its shell producer is
`.claude/hooks/hook-pulse.sh:310`–`:313`, followed by append at `:356`.
`HookPulseV1FromLegacyRecord` at `:1031` handles rows with older raw private
identifiers. Its legacy struct intentionally lacks `isInterrupt`: the field
and its owning event postdate identifier pseudonymization (`:972`).

## Cardinality gap

For this selected structural product, `9 × 3 × 2 × 3 = 162`. Its fourteen
legal states are listed exhaustively below. `N` means None; `r` preserves the
entire supported string domain, including the empty string accepted by the
TypeScript boundary. This finite count collapses only reason payload presence,
not its values. It does not claim that all 162 states pass the current filter.

| # | `hookEvent` | `notificationType` | `sessionEndReason` | `isInterrupt` |
| ---: | --- | --- | --- | --- |
| 1 | PreToolUse | N | N | N |
| 2 | PermissionRequest | N | N | N |
| 3 | PostToolUse | N | N | N |
| 4 | UserPromptSubmit | N | N | N |
| 5 | Stop | N | N | N |
| 6 | PermissionDenied | N | N | N |
| 7 | Notification | N | N | N |
| 8 | Notification | Some(permission_prompt) | N | N |
| 9 | Notification | Some(idle_prompt) | N | N |
| 10 | SessionEnd | N | N | N |
| 11 | SessionEnd | N | Some(r) | N |
| 12 | PostToolUseFailure | N | N | N |
| 13 | PostToolUseFailure | N | N | Some(false) |
| 14 | PostToolUseFailure | N | N | Some(true) |

The raw decoder's owner-gated assignments at `:1166`, `:1172`, and `:1177`
supply the optional-owner witnesses as well as present values. Test fixtures
at `test/hook-pulse.test.ts:551`–`:577` preserve both interrupt values and
absence; `:631`–`:660` preserves reason and idle notification. The shell's
unknown notification fixture at `test/hook-pulse-writer.test.ts:714` produces
Notification/None with `waitReason=unknown`. The original three-member
projection without event would be 18/6; neither 12/5 nor mandatory-owner
payloads describe this carrier.

## Target schema

Graft onto `src/hook-pulse.ts`. Reuse the existing `HookPulseEvent` LiteralKit,
field schemas, identity composer, raw schema and codec helpers. Define nine
annotated `S.Class` members, one per literal, assembled from the kit with
`.mapMembers(...)` and `S.toTaggedUnion("hookEvent")`. Export `HookPulseV1`
as the resulting schema and derive `type HookPulseV1 = typeof HookPulseV1.Type`.
There is no new event/state discriminator in the ledger.

Keep all three owned property names on each member, but give a foreign-owned
property the schema `S.OptionFromOptionalKey(S.Never)`. This means a decoded
foreign property is necessarily None (`Option<never>`), while the encoded key
must be absent. On the owning member use the current schema unchanged:

| Member | `notificationType` | `sessionEndReason` | `isInterrupt` |
| --- | --- | --- | --- |
| Notification | `S.OptionFromOptionalKey(HookPulseNotificationType)` | absent-only | absent-only |
| SessionEnd | absent-only | `S.OptionFromOptionalKey(S.String)` | absent-only |
| PostToolUseFailure | absent-only | absent-only | `S.OptionFromOptionalKey(S.Boolean)` |
| The other six events | absent-only | absent-only | absent-only |

Here absent-only is the named annotated optional-Never building block, not a
new Boolean or an extra payload variant. The union therefore retains exactly
fourteen legal selected states. Keeping None-valued properties also preserves
existing event-agnostic Option readers without making foreign Some values
representable. Prefer member constructors and schema-derived `.match`,
`.guards`, and `S.is(HookPulseV1)` over new manual event guards.

The complete shared fields remain in their original declaration order:
`schemaVersion`, `ts`, `sessionId`, `agentKind`, `hookEvent`, `cwd`,
`notifierRev`, `instrumentClass`, `evidenceTier`, `waitReason`, `toolName`,
`toolUseId`, `promptId`, `transcriptPath`, `permissionMode`, `notificationType`,
`durationMs`, `sessionEndReason`, `isInterrupt`. Reuse each existing schema;
do not append owner fields in a different order just because the source is
factored. In particular:

- `toolName` remains optional nonempty text on every event; `toolUseId`,
  `promptId`, and `permissionMode` remain optional strings on every event.
- `durationMs` remains optional `NonNegNum` on every event. No event ownership
  is inferred from a measured harness sample (`:785`, `:1194`).
- `sessionId` and `cwd` remain `Sha256Hex`; `transcriptPath` remains optional
  `Sha256Hex`; `ts` remains `S.DateTimeUtcFromString`.
- The existing schema-version, agent-kind, instrument-class and evidence-tier
  domains, constructor behavior, and key defaults remain unchanged.

Attach the current `HookPulseWaitReasonInvariant` to the member structs,
using one shared definition, before union assembly so helper statics remain
available. It still compares the declared waitReason to `deriveWaitReason`.
This design does not absorb or remove that independent guard. Annotate
forbidden fields with the existing owner/event diagnostic clause so failures
remain a `SchemaError` at the owned field and retain the asserted explanation,
for example `belongs to PostToolUseFailure, not hookEvent PostToolUse`.
This is schema failure metadata, not a reintroduced coherence predicate.

Declare forbidden keys explicitly. Merely leaving them out of the member
struct would let default excess-property stripping turn a previously rejected
canonical row into an accepted one. Conversely, do not globally enable
`onExcessProperty: "error"`, which would reject unrelated extra keys that the
current canonical schema strips. `null` and explicitly present `undefined`
remain invalid for these optional-key fields, as they are today.

Local Effect v4 source validates the API choice: `SCHEMA.md:738`–`:763` and
`Schema.ts:13280` define optional-key absence/Option encoding; `Schema.ts:2896`
defines Never; `Schema.ts:6105` derives tagged-union helpers. Local use of
optional Never at `packages/tooling/policy-pack/repo-configs/src/next/models/Routes.schema.ts:178`
supports the forbidden-known-key pattern. `Schema.ts:5366`–`:5390` and
`SchemaTransformation.ts:333` establish that the decode callback maps the
source Type to the target Encoded, and encode maps target Encoded to source
Type. Preserve those types in the existing raw and legacy transformations.
`Schema.ts:15045` documents node error-message annotations. These were source
reads, not an executed codec proof.

## Migration inventory

| Writer, reader, or export | Required work or compatibility obligation |
| --- | --- |
| `src/hook-pulse.ts:257`, `:546`, `:882` | Reuse literal kits, replace the flat class with nine schema-owned members, preserve field order/domains and all fourteen states. |
| `src/hook-pulse.ts:791`–`:828`, `:913`–`:956` | Delete the canonical owned-field filter and presence-accessor support; retain raw ownership normalization and the independent wait check as detailed below. |
| `src/hook-pulse.ts:962`–`:969` | Bind current public codec conveniences to the union. Preserve decode/encode Effect and Result methods, JSON Effect methods and the existing synchronous JSON compatibility methods used by test/replay helpers. |
| `src/hook-pulse.ts:1124`–`:1184` | Raw-to-canonical decode still hashes references, derives waitReason from the raw event, clamps evidence, drops foreign owned fields and unknown notification strings, and emits the same canonical encoded object. Retarget to the union without reversing the transformation. |
| `src/hook-pulse.ts:1185`–`:1257` | Canonical-to-raw encode still requires transcriptPath, copies snake-case fields and stamps, preserves false, owner-filters the three fields and checks derived waitReason. Preserve both failure messages and evidence clamping. |
| `src/hook-pulse.ts:982`–`:1061` | Retarget legacy codec to the union; retain the exact legacy field list, hash migration, canonical privacy-safe encode direction, failure mapping and public decode helper. Do not add legacy isInterrupt. |
| `src/hook-pulse.ts:648`, `:663`, `:687`, `:751`–`:783` | Keep permission wait derivation, event wait matching, tier clamp, salt resolution and private-reference hashing; the union is not permission to change their policy. |
| `src/index.ts:111`, package `./*` exports | Keep public schema/type and raw/legacy codec exports. The schema's generic `.make` remains available with the honest union input; case `.make` is the preferred construction API. |
| `test/hook-pulse.test.ts:267`, `:315`, `:327`, `:339`, `:714`, `:792`, `:1066` | Retain codec/equivalence/property helpers, migrate class-instance assertions to schema membership/case assertions, and migrate any constructor needing event narrowing. |
| `test/hook-pulse-writer.test.ts:87`, `:549`, `:592`, `:602` | Preserve JSON/equivalence helpers; migrate class-instance checks and the flat `.fields` assumption to union-member field inventory. Retain generated-row leak/round-trip proof. |
| `.claude/hooks/hook-pulse.sh:239`, `:310`, `:356`, `:367` | Preserve false-safe jq insertion, owner projection, append/sharding, and notifier handoff. No ledger rewrite or shell policy change is needed. |
| `.claude/hooks/sequence-break-notifier.sh:186`, `:202` | Preserve canonical fields used by bracket replay: session, agent, timestamp, event, tool name/id, terminal events, and SessionEnd tombstones. Keep PermissionRequest semantics. |
| `test/sequence-break.test.ts:76`–`:77` | Continue decoding and encoding canonical hook lines for shell replay fixtures; keep the established compatibility methods and all bracket outcomes. |

The public union no longer has one class constructor/prototype or a single
`.fields` struct. Remove `instanceof HookPulseV1` assertions atomically; use
`S.is(HookPulseV1)` and the member's schema-derived guard. For writer key
inventory, derive the union of keys from its nine `.cases` member schemas and
compare to `canonicalRowKeys`, then retain the arbitrary encoded-key test.
Do not keep an independently constructible flat class just to provide
`.fields`; that would preserve the invalid decoded product. No production
`.fields`, `new HookPulseV1`, or external subclass consumer was found by the
scoped repository search. This decoded API change is explicit under the
packet's atomic TypeScript-migration rider, not an encoded compatibility break.

`SchemaUtils.withCodecStatics` is available from the existing schema package,
but its registry at
`packages/foundation/modeling/schema/src/SchemaUtils/withCodecStatics.ts:48`
intentionally excludes JSON conveniences and legacy aliases. The current
`HookPulseV1.decodeEffect` means `S.decodeUnknownEffect`, and `decodeResult`
means `S.decodeUnknownResult`; do not silently replace them with narrower
same-spelled registry entries. Preserve the actually used public aliases as
boundary compatibility methods. Keep the existing synchronous conveniences
only for that contract; add no new throwing sync codec path.

## Guard-deletion accounting

| Current obligation | Disposition |
| --- | --- |
| `HookPulseEventOwnedFieldInvariant`, `:913`–`:935`, iterating all fields, testing Some, comparing owner/event and collecting issues | **Delete.** The member field schemas make a foreign Some value invalid structurally, before any cross-field check. |
| `HookPulseEventOwnedFieldValues` and `hookPulseEventOwnedFieldValue`, `:813`–`:828` | **Delete.** They exist solely to read heterogeneous Options through the canonical ownership filter. Delete their explanatory workaround comment too. |
| `HookPulseV1Invariants` group claiming both ownership and wait predicates, `:952` | Replace with the retained wait invariant. Update class/docs wording so it explains structural ownership rather than promising the deleted scan. |
| Ownership kit, owner lookup, ownership predicate and filter helper, `:791`–`:811` | Retain as raw-boundary normalization because foreign raw keys must be dropped in both directions. Their survival is not claimed as guard deletion. Reuse the same ownership relation when constructing member schemas; do not introduce a second manual owner table. |
| Three raw decode filters at `:1166`, `:1172`, `:1177` and reverse filters at `:1205`, `:1211`, `:1216` | Preserve semantics. They normalize a different, permissive input contract. A valid canonical union already satisfies ownership, but keeping the reverse projection preserves the current boundary policy. |
| `HookPulseWaitReasonInvariant`, `:937`; reverse wait check at `:1224`; transcriptPath guard at `:1186` | Keep. The selected ownership union does not make these conditions redundant. |

The mandatory runtime deletion is one complete canonical cross-field filter
and its type/accessor support. Simple member validation remains necessary.
Do not weaken canonical rejection or stop sanitizing raw input to increase
the deletion count. Remove imports only if unused after these exact changes.

## Encoded-side impact

No ledger or raw format change. Every accepted canonical row keeps its
`hook-pulse/v1` tag, event value, stamps, hashed references, optional keys,
payload values and original encoder property order. None still encodes as
omission. Notification may omit notificationType; SessionEnd may omit reason;
PostToolUseFailure may omit isInterrupt or encode either `false` or `true`.
Canonical owner fields retain their present value domains and invalid foreign
owner fields fail, with the same typed error and diagnostic clause.

Keep the three paths distinct:

1. **Canonical decode/encode:** validate the event member, including explicit
   forbidden-known keys, then the current wait invariant. A foreign canonical
   field is rejected; arbitrary unrelated excess keys follow the existing
   strip policy. Invalid unknown canonical encodes also fail, rather than
   silently dropping the offending known field.
2. **Raw decode:** `notification_type`, `reason`, and `is_interrupt` can arrive
   on any raw event. Retain the raw optional schemas and project only the
   owning field into the canonical row. Unknown notification strings become
   None, with Notification waitReason `unknown`. Preserve `false` exactly.
3. **Raw encode:** the transformation receives the target Encoded shape and
   produces `HookPulseRawEventInput` Type, then its source encoder writes raw
   snake-case keys. Retain ownership filtering, transcriptPath requirement,
   wait consistency check, stamps and weakest-tier clamp. Some(false) writes
   `is_interrupt:false`; None omits it. This is the reverse direction, not
   the `:1166` decode branch.

Legacy decode preserves supported legacy payloads while hashing raw private
identifiers. Legacy encode continues emitting privacy-safe data through its
existing legacy field set; it is not a claim of lossless raw-secret recovery
or of an interrupt-bearing historical corpus. Compare against pre-change
legacy behavior, including its intentional absence of isInterrupt, separately
from the canonical and raw-codec round-trip matrices.

Salt precedence remains `BEEP_HOOK_PULSE_HASH_SALT`, then
`BEEP_AI_METRICS_HASH_SALT`, then the existing insecure local fallback. A
whitespace first value wins precedence before fallback normalization; it does
not fall through to the second variable. Resolve once per decode, preserve
already-hashed references without hashing twice, preserve pinned-provider
replay, and retain the current hashing-failure issues. No secret values are
needed in the design or proof fixtures.

WaitReason stays `none` for non-wait events; PermissionRequest derives unknown,
tool-permission or plan-approval from the optional nonempty tool name;
Notification derives idle-input only for idle_prompt and unknown otherwise.
PostToolUseFailure still closes a bracket and is not itself a wait start.
The evidence clamp remains observed→derived, derived→derived, heuristic→heuristic,
unknown→unknown in both raw directions. Preserve shell duration sanitization,
privacy allowlists, append-only history, timestamp/day sharding and notifier
selection. The TypeScript string domains need not be narrowed to the shell's
measured subset.

## Test impact

Implementation proof must cover these axes; no product tests or shell writers
were run during P2.

1. Add fourteen explicit positive fixtures corresponding to the table. Use
   canonical encode/decode and raw decode→encode→decode for each, with required
   transcriptPath and stable stamps. Cover reason empty/nonempty strings,
   both notification literals and None, and both interrupt Booleans and None.
   Compare frozen pre/post canonical JSON and raw encoded objects, including
   omission and original property order, as well as decoded equivalence.
2. Add the foreign-owner rejection matrix: each present owned field on each
   of its eight nonowners, both notification literals and both interrupt
   values. Test canonical decode and unknown encode, including JSON decoding.
   Check the offending path and current diagnostic clause; retain the
   existing assertions at `test/hook-pulse.test.ts:513`, `:532`, and `:611`.
   Also assert unrelated excess-key stripping and null/explicit-undefined
   rejection to catch an overbroad excess-key option or a loose absent schema.
3. Apply the corresponding matrix to raw inputs: foreign fields are dropped,
   other payloads survive, and the row still decodes. Retain existing raw
   normalization cases at `:588` and both reverse projection branches. Unknown
   notification names on Notification produce None/unknown; an invalid raw
   non-Boolean interrupt still follows the existing raw schema rejection.
4. Retain schema-derived arbitrary canonical round-trips (`:327`) and the
   raw-codec encodable-subset property (`:339`): transcriptPath present and
   evidenceTier already at/below derived. That restriction is necessary;
   unqualified identity round-trips would incorrectly erase the tier clamp.
   Generate each member and prove the combined space includes all fourteen
   cases; do not accept a generator silently stuck on None alternatives.
5. Retain waitReason mismatch checks (`:664`), missing transcriptPath failure,
   both-direction tier tests (`:693`), all event wait classifications, and
   nonempty tool-name rejection. Exercise optional toolName/toolUseId/duration
   on every event with consistent waitReason so the new union cannot impose
   unproven event ownership on those fields.
6. Preserve legacy migration (`:296`), legacy privacy-safe encode parity,
   no-double-hashing, salt precedence/whitespace/provider fixtures and
   raw-reference exclusion. Distinguish legacy behavior from ordinary v1
   round-tripping; keep the historical omission of isInterrupt.
7. Run the existing isolated writer test suite, retaining the two literal-kit
   allowlist equalities (`test/hook-pulse-writer.test.ts:620`), all canonical
   key inventory/generative leak checks (`:592`, `:602`), false-preserving jq
   fixtures (`:845`), foreign-field drop tests, unknown notification (`:714`),
   duration sanitization (`:771`), and codec/writer salt parity (`:898`). Add
   missing optional-owner branches so shell coverage includes the full table
   where its accepted raw domain supplies them. Tests use their temporary
   evidence roots and stub transports, not a live telemetry writer.
8. Run `test/sequence-break.test.ts` with its migrated schema adapters to prove
   PermissionRequest starts, both post-tool endings, denial, and SessionEnd
   tombstones retain the shell replay behavior. Preserve notifier delivery
   behavior and avoid real notification/network side effects in tests.
9. Verify `@beep/repo-ai-metrics` through mandatory package verification and
   the prescribed Yeet gates. Export docs require the repository JSDoc pass.
   No dependency, generated-file, package manifest or ledger migration is
   required by this design.

## Risk

The highest-risk mistake is representing ownership by dropping fields from
union members: default excess-key stripping would weaken canonical rejection.
Explicit optional Never fields prevent that without rejecting unrelated
extras. Other material risks are losing None on owners, conflating false with
absence, narrowing tool/duration metadata, dropping payloads through legacy
encoding, changing hash precedence, changing wait evidence, and leaving old
class `.fields`/instance assumptions in tests. The two-direction, fourteen-case
matrix and writer/replay contracts address each separately.

This design changes a public decoded schema API and a canonical ledger
decoder, so it remains one Tier 2 PR with a full encoded-compatibility receipt.
No ledger rewriting is needed. A code rollback can read the same rows because
their encoded form is unchanged. The optional-Never member composition and
diagnostic annotations still require compilation and runtime proof in that
PR; source inspection alone does not establish those results. Independent
P3 review, the packet's GATE 2 evidence, and refreshed source anchors remain
required before implementation.
