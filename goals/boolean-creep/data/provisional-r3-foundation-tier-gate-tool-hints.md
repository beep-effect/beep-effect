# Provisional design: policy tier-gate decision

- Stable ID: `r3-foundation-tier-gate-tool-hints`
- Source: `93217d998f851e2e93d9864e2b5315552eaa58a7`
- Corpus main: `d1b4d769fbaffddd55717f3b1ba461897dd545c5`
- Owner: `packages/foundation/capability/mcp-kit/src/TierGate.ts:464`
- Symbol: `fromApprovedToolsPolicy.evaluate`
- Kind: sibling-state; actual locals `destructive`, `readOnly`, `approved`
- Evidence: E4 at `TierGate.ts:415-416,464-466`
- Source cardinality: 8 representable / 7 legal
- Storage/exposure: derived/internal; Tier 1; target LiteralKit

This is native P2 design material under `data/`, pending parent integration and
independent P3 review. It does not change canonical inventory, design or status.
The independently completed R28 foundation-capability report confirms the
corrected value owner; its historical predicate-name seed is not the owner.
The companion source audit is `design-refresh-2026-09-09-r28-tier-gate-values.md`.

# Current shape

`fromApprovedToolsPolicy`, `TierGate.ts:461-480`, returns a service shape with
an evaluate function and a no-op settlement function. Each evaluation reads
`DateTime.now`, derives the three actual Boolean locals from the requested
tool and captured policy, constructs a complete `TierGateAuditRecord`, and
returns the existing approved/refused `TierGateVerdict`.

`isDestructive` at `:408-409` defaults an absent annotation to true;
`isReadOnly` at `:413` defaults to false. Explicit false is meaningful.
`isPolicyApproved` at `:415-416` is
`(readOnly && !destructive) || exact allowlist membership`. Both annotations
may be true: destructive wins over the read-only hint for automatic approval.
A non-destructive hint by itself does not authorize a write.

The owner is neither the annotation schema nor the three predicate functions.
It is the same-scope values at `:464-466`, used together by `auditReason` and
the audit/verdict writers. The required `approvedTools` string array is policy
payload, not a fourth stored Boolean or an Option-presence axis. Its exact
membership observation supplies both approved and refused outcomes where
automatic approval does not apply. No empty-array default is declared by
`TierGatePolicy` at `:391-400`; existing callers explicitly pass an array.

`auditReason` at `:418-430` is a private function returning `string`, containing
five exact string literals. There is currently no named audit-reason LiteralKit.
The public `TierGateAuditRecord.reason` remains `S.NonEmptyString`, because
other gate implementations legitimately supply different reasons.

# Cardinality gap

| Destructive | Read-only | Approved | Supported witness | Existing reason class |
| --- | --- | --- | --- | --- |
| false | false | false | Both annotations false; name absent from allowlist | Refused unmarked write |
| false | false | true | Both false; name present in allowlist | Approved policy write |
| false | true | true | Safe read-only annotation; allowlist may contain or omit the name | Automatic read-only approval |
| true | false | false | Destructive or unannotated tool; name absent | Refused destructive |
| true | false | true | Destructive tool; name present | Approved destructive |
| true | true | false | Both annotations true; name absent | Refused destructive |
| true | true | true | Both annotations true; name present | Approved destructive |

Only false/true/false is impossible, because safe read-only automatically
implies approval. This is the source owner's 8/7 cardinality. The annotation
API and the actual gate logic support all seven rows; do not discard dual-true
metadata or require destructive and read-only to be complements.

There are **five observable policy decisions**, not seven distinct audit
results. Read-only true/false on a destructive tool produces identical
verdict, audit reason and audit destructive flag when approval is held fixed.
Neither `readOnly` nor allowlist membership is emitted by this evaluator.
The original tool object and all annotations remain available unchanged,
including for tools/list; reducing the transient decision does not erase them.

Thus a five-case canonical decision preserves all seven admitted inputs. It
does not change the inventory's legal count to five: seven is the old carrier's
legal bit tuples, while five is the sufficient replacement observation.

# Target schema

Formalize the five existing reason strings as one **private** annotated
LiteralKit beside the current `auditReason` helper. Suggested symbol:
`PolicyAuditReason`, with its same-name derived type and existing `$I`.
The literal values are exactly the current emitted reason strings:

| Literal value | Audit outcome | Audit destructive | Verdict |
| --- | --- | --- | --- |
| `Tool is destructive and not present in the approved-tools policy.` | refused | true | refused |
| `Tool is not marked read-only; approval required.` | refused | false | refused |
| `Destructive tool explicitly approved by policy.` | approved | true | approved |
| `Tool is read-only and non-destructive; no approval required.` | approved | false | approved |
| `Tool explicitly approved by policy.` | approved | false | approved |

These are a private finite domain for this policy implementation, not a
restriction on the public audit schema. Do not add new encoded discriminator
keys, seven wrapper classes, a separate three-bit schema or a second reason
translation layer. Reuse the existing reason strings directly as the decision.

Change the existing private `auditReason` function to classify `(policy, tool)`
into one `PolicyAuditReason`. Keep `isPolicyApproved` as the shared predicate
used by the list-visibility helper. The classifier may call the existing
primitive predicates at its boundary; it must not bind or return a new
`{ destructive, readOnly, approved }` state bag. Preserve the existing rule:
unapproved selects the destructive/unmarked refusal reason; approved
destructive selects its explicit reason; an approved non-destructive tool
selects the read-only reason when read-only, otherwise the policy-write reason.

In evaluate, derive **one reason** after the existing clock read. Use the
LiteralKit's exhaustive match to supply the table's fixed outcome/destructive
projection, then construct the same audit and the matching existing verdict.
Use the existing schema verdict cases/match rather than reconstructing an
approved Boolean. Preserve the exact tool name, request Option and formatted
timestamp. Do not cache a decision at gate construction or tool annotation:
evaluate remains lazy and consults the tool/policy for each invocation.

This uses the file's existing LiteralKit import and annotation convention; no
new package, file role, service or public export is needed. The existing
`TierGateOutcome` cannot replace the reason because two outcomes alone lose
required reason/destructive output. `TierGateSettlement` is post-execution
state and is also the wrong domain.

# Migration inventory

| Source / consumer | Required migration or preserved contract |
| --- | --- |
| `mcp-kit/src/TierGate.ts:36-38,408-430` | Add the private five-reason kit beside the existing classifier. Keep annotation defaults and the shared policy predicate; change the classifier's three Boolean parameters to actual policy/tool inputs. |
| `TierGate.ts:461-478` | Delete three locals, derive one reason, exhaustively project outcome/destructive and create the unchanged complete audit/verdict. Keep DateTime evaluation and formatting timing. |
| `TierGate.ts:479` | Keep `recordOutcome` a no-op. The policy gate does not promise durable audit insertion or a settlement ledger. |
| `TierGate.ts:155-184,215-222,275-278,325-328` | Preserve public audit fields/codec, verdict union, tool-call request and service signatures. Do not narrow the public reason string or delete its single encoded destructive Boolean. |
| `TierGate.ts:554-610` | Preserve wrapper dispatch: refused returns a value and never executes; approved runs once, records bounded completed/failed/interrupted settlement via onExit and preserves the wrapped error channel. No failure payload reaches settlement. |
| `TierGate.ts:635-644` | Preserve both curried/data-first annotation overloads, caller tool type, existing annotations and lazy predicate. It continues calling `isPolicyApproved`; no separate approval formula or predicate-to-reason synchronization adapter. |
| `mcp-kit/src/ToolAnnotations.ts:42-73,120-134` | Preserve independent hints, convenience defaults, both annotation overloads and exact tool type. The gate refactor does not normalize contradictory hints or rewrite their MCP encoding. |
| `mcp-kit/src/index.ts:65` and package wildcard exports | Existing public symbols remain. The new private kit is not exported through the barrel or a compatibility alias. |
| `mcp-kit/test/TierGate.test.ts:29-34,50-145,149-227,232-260` | Existing annotation fixtures, dispatch/settlement behavior and schema parity remain. Extend the real gate fixture to cover the missing allowed and dual-annotation rows. |
| `packages/epistemic/server/src/GovernedTierGate/GovernedTierGate.gate.ts:314-339,412-420` | This is a separate gate implementation constructing the shared audit/verdict with other reasons. Preserve its public schema compatibility, ledger enforcement and caller authorization; it does not call fromApprovedToolsPolicy. |
| `packages/ontology/server/src/tools/OntologyToolHandlers.ts:95-110` | The generic wrapper's refused audit reason becomes user-visible guidance. Preserve exact reason strings and wrapper result shape. This production consumer does not prove it is wired to the simple allowlist gate. |
| `packages/epistemic/server/test/GovernedTierGate.test.ts`, `test/integration/GovernedTierGate.pglite.test.ts`, `packages/ontology/server/test/OntologyPublishTools.test.ts:152` | Transitive consumers of unchanged shared public APIs. Keep their arbitrary/custom audit reasons valid; do not rewrite them to this policy kit. |

Graft callers found the direct test consumer of `fromApprovedToolsPolicy`;
exhaustive package search additionally found the shared-schema/wrapper
consumers above. No production caller of that particular policy factory was
found in the inspected package/apps corpus. Public construction examples
remain part of its API contract. No local application consumer was found.
Missing graph edges were not interpreted as absence of consumers.

# Guard-deletion accounting

Delete the three parallel Boolean locals at `TierGate.ts:464-466`, the
three-Boolean helper signature at `:418`, the output ternary at `:469` and the
repeated approved/refused verdict ternary at `:475-477`. The five-reason match
absorbs their correlation and fixed output projection. Delete no policy
authorization rule: classification must still evaluate the original formula.

Keep `isDestructive`, `isReadOnly` and `isPolicyApproved` as callable boundary
observations, including the last predicate's real visibility consumer at
`:639`. They were never the eligible Boolean carrier and are not counted as
three removed Boolean values. Keep the audit's one descriptive Boolean as an
encoded output projection. No new sibling `approved`, `destructive` or
`readOnly` aliases may accompany the canonical reason downstream.

The current source has no coherence filter or impossible-state exception to
delete. Do not invent deletion credit for one. The actual reduction is the
three-value product and its repeated output interpretation.

# Encoded-side impact

No schema migration or new wire codec is needed: only private transient
computation changes. Exact old and new evaluator outputs must match for all
seven tuples at a fixed clock/tool/request. Preserve audit key order and values
`tool`, `outcome`, `reason`, `destructive`, `toolCallId`, `occurredAt`; preserve
verdict key/discriminator and complete nested audit. Preserve arbitrary
nonempty public reasons supplied by other gates, not just these five.

`toolCallId` at `TierGate.ts:169-174` uses `S.OptionFromNullOr` plus
`SchemaUtils.withNoneDefault`. Constructor omission supplies None; encoding
None yields null, while Some(nonempty string) yields that string. This is not
an optional-key codec: do not start omitting the encoded key or treating an
empty string as absence. The local helper is a constructor default only
(`schema/src/SchemaUtils/withConstructorDefaults.ts:49-54`); preserve the
existing decoder's missing-key behavior too. The exact v4 codec definition is
`.repos/effect/packages/effect/src/Schema.ts:12829-12885`.

The record is shaped for consumer-owned JSON/jsonb storage, but this factory
does not write a database or an audit log. No new persistence wiring belongs
to this change. Keep the complete original tool object, metadata and MCP hint
keys unchanged. `withEnabledWhenApprovedTool` remains a visibility annotation
and does not replace dispatch authorization. The old module's comments cite
historical Effect line numbers; preserve the local public contract without
treating those stale line numbers as fresh transport enforcement evidence.

# Test impact

Use existing package aliases and actual Tool annotations, policy factory and
dispatch wrapper. At implementation, enumerate all eight input combinations
of destructive/read-only/allowlist membership. Assert seven unique derived
tuples and the table's five observable classes, including both dual-true
cases and safe read-only both with and without allowlisting. Pin exact reason,
verdict, destructive output, clock, tool name and present/absent call ID.

Cover absent annotations, explicit false destructive, explicit false read-only,
and read-only true with destructive absent: the last remains destructive by
default and requires allowlisting. Confirm exact-name membership (including
empty list, duplicates and nonmatching names); do not add wildcard, case-fold,
fuzzy matching or a new policy default.

Use a side-effect counter to prove refusal never evaluates the wrapped effect
and approval executes once. Retain successful, failed and interrupted
settlement assertions and no settlement for refusal. Pin error identity and
policy recordOutcome's no-op. The existing tests mostly assert the refusal
reason for the unmarked write; add exact-message checks for the other four
classes rather than assuming they already exist.

Add parity checks between each table row's evaluator approval and the predicate
carried by both data-first and curried `withEnabledWhenApprovedTool` results.
Read that annotation directly through its Context key; no MCP server or
transport needs launching. Assert other annotations and tool name/schema
remain unchanged. Add fixed-input codec comparisons for audit and verdict
with None/null and Some/string; retain the existing schema-derived arbitrary
round trips and custom public reason acceptance.

Required implementation verification: focused `TierGate.test.ts`, the mcp-kit
package's test typecheck, and canonical
`bun run beep quality package-verify @beep/mcp-kit`, followed by the applicable
Tier 1 Yeet checks. Broaden to governed/ontology tests if public schema or
wrapper code changes; the proposed implementation leaves those APIs intact.
This P2 task ran none of these product or package commands.

# Risk

Tier 1 internal derivation with authorization-sensitive behavior. The main
risks are allowing read-only to override destructive, treating explicit
non-destructive as automatic approval, changing allowlist/clock timing,
rewriting public reasons, or turning list visibility into dispatch permission.
Five output cases are sufficient only because the original tool annotations
remain intact and the two destructive read-only pairs have identical current
evaluator outputs. Keep the 8/7 source proof separate from this five-case
replacement proof. Land only after parent admission and independent P3 review;
this provisional file grants no source or status mutation.
