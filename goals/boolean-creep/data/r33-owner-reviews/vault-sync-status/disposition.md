# VaultSyncStatus — outside the Boolean recall net

Frozen HEAD32f111f3707a63168b68ed04516af800ecc3a66c/main339da1562a2ed52f73a0a693c176fc52cca9ccb6.
Recommend archiving/removing both existing rows from live inventory:
`vault-sync-status-connected` (designed) and
`r28-shared-documents-vault-sync-status-cursor-position` (disqualified D1).
Archive the connected design; no canonical mutation performed in this audit.

## Complete owner

VaultSyncEngine.ts65-116 declares a direct S.Class with twelve fields and no
base-class field extension or spread. Only connected70 is Boolean. Seven count
fields are NonNegativeInt. disconnectReason76 is Option of DmsMirrorDisconnectReason,
a five-string LiteralKit declared DmsMirror.ts516-522. cursorPosition84 is
Option<NonEmptyString>; probedAt101 is Option<DateTimeUtcFromString>; provider106
is DmsProvider, a single string-literal kit in Sync.values.ts35. No hidden
Boolean member exists in those payloads. Exact field list is in the JSON receipt.

An Option's presence can form a finite abstraction, but does not make the field
Boolean-typed. A literal/string/number field likewise does not meet the net.
Adjacent forceProbe235 is a field of a different input owner, VaultSyncStatusInput
230-244; it is not a sibling field or state atom of this status. A service return
copy1559-1572 does not combine unrelated input and output scopes into one owner.

SPEC33-35 requires at least two Boolean-typed members in one scope. With only
one, neither proposed cluster passes recall. E3 flag/payload evidence or a
12/7 reason abstraction cannot bypass this prerequisite. Existing connected
contract annotation79 and reasonless legacy defaults remain meaningful API
semantics, but are not sufficient to include a one-Boolean owner in this goal.

The cursor row's independence rationale may be semantically reasonable, but D1
belongs to suspects that meet the recall net; it does not justify retaining
an out-of-net owner. No new D1/D2 replacement row and no new public decision.

## Exposure and preservation

VaultSyncStatus is an exported read model: public.ts71 and Sync/index.ts28;
RPC success schemas use it at Sync.rpc.ts146/167. Server readStatus1559-1572
constructs the record, and desktop consumers/roundtrip tests use it. Exclusion
is solely recall-scope correction, not generated or wire-mirror classification.
No decoder narrowing, API rewrite or compatibility behavior change is proposed.
Preserve required encoded-null cursor, missing-key defaults for reason/probedAt,
all payloads, counts, server probe policy and desktop UI behavior exactly.

## Parent integration proposal

Use original-rows.jsonl and original-vault-sync-status-connected-design.md as
byte-preserved withdrawal evidence. Parent should first archive the current full
inventory and connected design, verify receipt-chain predecessor hash, remove
exactly these two rows and canonical connected design, and record scope-based
withdrawal with this frozen source audit. Reconcile the R33 footer's retained
seed claim against this correction rather than editing the raw lane transcript.
No claim is made that scope correction alone renders the round dry or complete.

No source/canonical packet edits, fetch, HEAD changes, proof launches, implementation
or runtime tests occurred. A complete schema declaration inspection suffices for
the recall count; no finite mixed-payload legality table is needed or asserted.
