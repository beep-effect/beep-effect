# R28 TierGate value-owner audit

Source: `93217d998f851e2e93d9864e2b5315552eaa58a7`.
Corpus main: `d1b4d769fbaffddd55717f3b1ba461897dd545c5`.
Scope: the corrected `r3-foundation-tier-gate-tool-hints` value owner and the
`r3-foundation-verified-span-attempt-coherence` footer withdrawal. This is a
native P2 audit and provisional design handoff; it changes no canonical row,
design or status and does not constitute P3 review.

The independent `r28-foundation-capability.execution.json` reports source SHA
above, exit 0, an end-turn event, valid one-record JSONL and no errors. Its
completed report contains one confirmed correction. Its completion footer
explicitly withdraws the VerifiedSpan predicate seed. Both files remain
immutable; the parent integrates their dispositions.

## Eligibility and exact corrected row

The prior D1 row named `auditReason.toolHints` at
`packages/foundation/capability/mcp-kit/src/TierGate.ts:408` with members
`isDestructive`, `isReadOnly`, `isPolicyApproved`. Those names are three
callable predicates, not co-carried Boolean values.

The correction finds a different, real footprint in the same policy flow:
`fromApprovedToolsPolicy.evaluate`, `TierGate.ts:464-466`, has the actual
Boolean locals `destructive`, `readOnly`, `approved`. The closure retains and
reads them together to derive audit reason, audit outcome/destructive and the
verdict at `:467-477`. This is eligible sibling-state derived data. Neither
function naming nor the count of predicate declarations supplies its proof.

Exact independently emitted corrected row, proposed for parent integration:

```json
{"schemaVersion":"boolean-creep-inventory/v1","id":"r3-foundation-tier-gate-tool-hints","file":"packages/foundation/capability/mcp-kit/src/TierGate.ts","line":464,"symbol":"fromApprovedToolsPolicy.evaluate","kind":"sibling-state","members":["destructive","readOnly","approved"],"status":"confirmed","evidence":[{"class":"E4","cite":{"file":"packages/foundation/capability/mcp-kit/src/TierGate.ts","line":415},"note":"isPolicyApproved is (readOnly && !destructive) || allowlist membership, so readOnly && !destructive implies approved across this producer."},{"class":"E4","cite":{"file":"packages/foundation/capability/mcp-kit/src/TierGate.ts","line":464},"note":"evaluate co-computes destructive, readOnly, and approved from one tool and policy, then passes that triple into auditReason; the auto-approve combination is never written with approved=false."}],"cardinality":{"representable":8,"legal":7},"storage":"derived","exposure":"internal","targetShape":"literalkit","tier":1,"notes":"Correction of seed r3-foundation-tier-gate-tool-hints: the eligible carrier is the evaluate locals, not the predicate helpers. Dual-annotated and allowlisted combinations remain legal; only auto-approve with approved=false is impossible. Target is the existing audit-reason literal."}
```

Native source review confirms that row's eligibility, E4 implication, member
names, 8/7 count and Tier 1 exposure. Clarify the note at integration if useful:
“existing audit-reason literal” means the five existing message literals in
the private `auditReason` function, not an already defined LiteralKit schema.
The provisional design formalizes that finite private domain; the public
audit's reason remains unrestricted beyond NonEmptyString.

## Seven tuples and five observable decisions

Let D be destructive, R read-only, L exact allowlist membership, and
A = `(R && !D) || L`. L is a boundary observation over the required policy
array, not another member of the corrected three-local carrier.

| D | R | L | A | Existing evaluator result |
| --- | --- | --- | --- | --- |
| false | false | false | false | Refused, destructive false, unmarked-write reason |
| false | false | true | true | Approved, destructive false, explicit-policy-write reason |
| false | true | false | true | Approved, destructive false, read-only automatic reason |
| false | true | true | true | Same automatic reason, even when allowlisted |
| true | false | false | false | Refused, destructive true, destructive refusal reason |
| true | false | true | true | Approved, destructive true, destructive approval reason |
| true | true | false | false | Same destructive refusal; read-only cannot override destructive |
| true | true | true | true | Same destructive approval; allowlist admits the dual annotation |

These eight policy/metadata inputs produce seven distinct D/R/A tuples and
five distinct `(outcome, destructive, reason)` outputs. Only D=false,
R=true, A=false is impossible. A short source-derived truth-table enumeration
confirmed these counts without importing or executing repository code; it is
not product-test evidence.

`ToolAnnotations.ts:42-73,120-134` permits independent hint fields and applies
them independently. `Tool.Any` is accepted directly by `ToolCallRequest` at
`TierGate.ts:275-278`, so the gate is not limited to the convenience safe-read
and destructive-write constants. Exact local Effect v4
`Tool.ts:1757-1759,1783-1785` supplies Readonly=false and Destructive=true
reference defaults, matching the explicit source fallbacks at `TierGate.ts:409/413`.
Explicit false annotations remain distinct from absence where those defaults
differ. Read-only true with destructive absent still requires allowlisting.

The five output classes justify a five-reason replacement, while the old
carrier's legal count remains seven. The original tool and its complete
annotations remain unchanged, including the externally visible hints. No
tool-call ID, tool name, timestamp, allowlist array, or unrelated idempotent/
open-world hint is dropped or converted into a fabricated presence axis.

## Complete consumer and compatibility findings

Graft's full caller trace found the direct test use of
`fromApprovedToolsPolicy`; exhaustive package and application searches found
the additional public-schema/wrapper consumers. The direct factory remains a
public API with examples even though no production factory call was found.
These findings do not imply the generic TierGate service is unused.

- `mcp-kit/src/TierGate.ts:408-430,461-480`: sole derived triple writer and
  readers. `DateTime.now` precedes classification; every invocation constructs
  an audit; the returned policy gate's recordOutcome remains a no-op.
- `TierGate.ts:635-644`: `withEnabledWhenApprovedTool` still uses the shared
  policy predicate lazily, in both curried and data-first forms, preserving
  tool type/annotations. It is not a second three-local owner.
- `TierGate.ts:155-184,215-222`: shared public audit/verdict codecs. Preserve
  all six audit fields, exact five policy messages, public arbitrary nonempty
  reasons, the single encoded destructive Boolean and nested verdict shape.
  `toolCallId` constructor omission defaults to None, encoded as null; a
  present ID stays a nonempty string. `SchemaUtils.withNoneDefault` at
  `schema/src/SchemaUtils/withConstructorDefaults.ts:49-54` is a constructor
  default, not an optional encoded key or a decoding-default rule.
- `TierGate.ts:554-610`: the wrapper preserves approved-only execution,
  refusal-as-value, bounded settlement on success/failure/interruption and
  the wrapped effect's exact error channel. Refusals do not settle.
- `mcp-kit/src/index.ts:65` and its package root/wildcard exports: retain
  every existing exported API. The private new reason kit needs no export.
- `epistemic/server/src/GovernedTierGate/GovernedTierGate.gate.ts:314-339,412-420`
  constructs the shared audit/verdict with other reasons and real governed
  policy/ledger behavior. Do not narrow its reason strings or replace its
  caller authorization with simple allowlist policy.
- `ontology/server/src/tools/OntologyToolHandlers.ts:95-110` uses generic
  dispatch; refusal reasons become user-visible guidance. Its gate wiring is
  distinct from proving a production call to this simple policy factory.
- Direct regression fixtures are `mcp-kit/test/TierGate.test.ts:29-34,50-145,
  149-227,232-260`. GovernedTierGate unit/integration tests and
  `ontology/server/test/OntologyPublishTools.test.ts:152` also consume shared
  API shapes. They require compatibility, not implementation edits for this
  private derivation.

The old TierGate comments cite historical McpServer line numbers. The current
local Effect reference registers EnabledWhen as visibility at
`McpServer.ts:348-361` and delegates calls through its core registry at
`:395-405`; this audit did not re-prove every core transport enforcement path.
The proposed change leaves the visibility helper and dispatch wrapper intact
and never treats visibility as authorization. No server was started.

## VerifiedSpan footer withdrawal

Exact ID: `r3-foundation-verified-span-attempt-coherence`.
Historical owner: `VerifiedSpanAttemptRecordStruct.coherence`, kind
`sibling-state`, members `[hasConsistentAttemptLink,
hasConsistentFailureCandidates, hasConsistentAttemptSource]`, in
`packages/foundation/capability/langextract/src/VerifiedSpan/VerifiedSpan.model.ts`.

The independent execution footer explicitly says this seed is withdrawn as
ineligible standalone callable predicates. Native source confirms:

- `:600-605` declares `hasConsistentAttemptLink(attempt): boolean`.
- `:614-628` declares `hasConsistentFailureCandidates(attempt, failure): boolean`.
- `:650-671` declares `hasConsistentAttemptSource(attempt): boolean`.
- `:673-689` calls the failure-candidate predicate from a separate outcome
  predicate; `:691-713` passes function values into schema checks. It never
  constructs or retains their three Boolean results as a group.
- The real field schema at `:569-598` contains attempt/time/candidate/engine/
  source/kind/matter/outcome/previous-attempt data. It has no three coherence
  Boolean members and no `.coherence` carrier.

Proposed parent action: archive and withdraw that exact row as OUT OF NET,
preserving the old record and footer provenance. Do not replace it with D1,
assign 8/8 cardinality to callable values, remove real validation predicates,
or extrapolate another cluster from required candidate arrays/source fields.
This withdrawal does not change any VerifiedSpan schema or validation rule.

## Provisional design and required verification

`provisional-r3-foundation-tier-gate-tool-hints.md` contains all eight required
design sections, the exact five-message projection, complete migration map,
concrete deletion accounting, encoded compatibility and authorization tests.
It removes the three-local product and repeated approval interpretation while
preserving the actual policy rule and encoded audit Boolean. It does not
recreate the product as a helper-return bag.

At implementation, the meaningful proof is the complete eight-input policy
matrix, exact seven-tuple/five-output mapping, default/explicit annotation
behavior, both list-annotation overloads and predicate parity, refused-effect
nonexecution, approved execution/settlement, fixed-clock audit bytes and
existing schema round trips. Follow with the focused mcp-kit suite and
canonical package verification. No product tests, package commands, services
or git operations were executed for this P2 audit.

## Scoped validation receipt

Only this audit and the provisional `data/` design were written. Required
section and canonical-row JSON checks were performed without running package
code. The source/report bytes below were captured before drafting and checked
again at handoff; they remained unchanged:

| File | SHA-256 |
| --- | --- |
| `mcp-kit/src/TierGate.ts` | `27d680e7aeee445e8d385f68cce127ca2e818c332e6e6b2eb59d7a41c0bef0bb` |
| `langextract/src/VerifiedSpan/VerifiedSpan.model.ts` | `97dcfcf5863156cae5169c4761396a6b16e504ddf03e692bcb45b22648e5886a` |
| `r28-foundation-capability.jsonl` | `32742e1152c0b1899397a7533a4b9047dfcadd02da74333a9586cc8b52f4a70c` |
| `r28-foundation-capability.execution.json` | `9babc5b23a914478acac971628f882108762e695e5ed0a06c0e6f1acff150856` |

Canonical status and final integration belong to the parent. The completed
quality/scheduler audit, current R28 report, R27 receipts and all archives were
not edited. This handoff is a native design, not independent P3 acceptance or
an applied implementation.
