# Graphnosis survey — territory: corrections, confidence, contradiction & forgetting

Repo: `/home/elpresidank/YeeBois/dev/Graphnosis` (Apache-2.0, TypeScript, `@nehloo/graphnosis`, v0.11.0, 2026-08-04).
Surveyed: `src/core/corrections/{correction-engine,confidence}.ts`, `src/core/optimization/{reflection,pruner,deduplicator,compressor}.ts`,
`src/core/audit/audit-exporter.ts`, plus the modules those depend on that decide the same facts
(`src/core/graph/retirement.ts`, `src/core/graph/incremental.ts`, `src/core/errors.ts`, the SDK facade
`src/sdk/index.ts`, `src/mcp/*`), the README "what you get that a vector store does not" sections,
`ROADMAP.md`, `SPEC.md §8.1`, `CHANGELOG.md`, and the unit tests that pin this behaviour.

Everything below was read in full. Two live probes were run against the checkout with `bun` (files
created inside the repo and deleted immediately; `git status` clean afterwards) — those are marked
MEASURED and the numbers are mine, not the repo's.

---

## 0. What this territory actually is

This is not "a knowledge graph with a `deleted` flag". It is a small, unusually well-argued
**epistemic state machine** over nodes, in which four independent axes are deliberately held apart:

| axis | field(s) | who moves it | what it means |
|---|---|---|---|
| **existence** | node in `graph.nodes` | nothing, in the canonical layer | the memory exists |
| **liveness** | `metadata.retiredBy`, `validUntil` | owner acts: delete / supersede / forget | *never serve this again* |
| **currency** | `validUntil` with NO administrative marker | content semantics | *this is no longer current* (still served, damped) |
| **weight** | `confidence` | `setConfidence`, decay, retirement | ranking multiplier only |

The central claim of the module is that these four are routinely conflated by memory systems, that
each conflation produces a specific silent data-loss bug, and that the fix is to give each axis its
own field, its own write path, and its own refusal rules. The source comments are essentially a
defect log proving that claim — every guard is annotated with the incident that motivated it.

The five stated requirements the library is built to (README.md:179-204) are Provenance,
Indelibility, Determinism, Capped authority, Co-location. This territory implements #2 and #4.

---

## 1. `edit()` IS `supersede()` — the same mechanism, differing only in caller intent

`src/core/corrections/correction-engine.ts:107-136`:

```ts
function applyEdit(graph, tfidfIndex, correction) {
  if (!correction.nodeId || !correction.content) { ... }
  const target = graph.nodes.get(correction.nodeId);
  if (target && isRetired(target, Date.now(), collectSupersededIds(graph))) {
    return { success: false,
      error: `Node ${correction.nodeId} is retired; re-ingest its source before correcting it` };
  }
  return applySupersede(graph, tfidfIndex, correction);   // <- literally the same call
}
```

The comment above it (lines 77-106) is the whole argument, and it is worth reproducing in essence:

> An edit and a supersede are the same operation on the graph: the prior belief is retired and
> readable, the corrected one is a new node, and a `supersedes` edge records the relationship. The
> only difference is the caller's intent, so **the reason carries that and the mechanism is shared.**

Before 0.10.0, `edit()` overwrote `node.content` in place. The comment names two consequences that
the "conformance audit" found, both of which are non-obvious:

1. **A re-ingest silently UNDID a correction.** `appendMarkdown` re-reads the whole source file,
   which still carries the original text. An in-place edit left no marker, so nothing suppressed the
   re-import, and the erased text came back as *live content*. (`supersede` was already excluded by
   its retirement reason — see §2.)
2. **Node identity became ambiguous.** One node answered to either the original or the corrected
   fact depending on when a reader looked, which made "which facts were live at time T"
   unanswerable.

Two API consequences they chose to eat rather than paper over:

- `affectedNodeId` after an `edit` is now the **NEW** node, and node count grows by one per edit.
- `CorrectionResult.affectedNodeIds: NodeId[]` became a **required** field (correction-engine.ts:34-54).
  The JSDoc on that field is unusually candid — it says the consuming app had been recovering the id
  by watching `graph.nodes.size` across the call and taking the first entry past the old size, and
  calls that "exactly the kind of workaround a published API should make unnecessary". It also
  states the invariant "Always present, never undefined: a field that is sometimes absent is a field
  every caller has to defend against."

`edit()` **refuses a retired target** (correction-engine.ts:116-133). The reasoning is the kind
that only shows up after you ship: because a correction now *mints a live node*, editing a forgotten
memory would bring its content back as live content — "correcting a forgotten memory must not
un-forget it." The old in-place edit could not do that, so the case never arose; making the
operation indelible *created* the hazard.

---

## 2. The single sharpest idea: the retirement **reason** is a re-ingest policy

`src/core/graph/retirement.ts:110-125`:

```ts
export type RetirementReason = 'delete' | 'supersede';
```

- `delete` — the user asked to forget this content. **Re-adding the source SHOULD restore it**:
  forgetting is not a permanent ban on a string.
- `supersede` — the user asserted the stored fact was WRONG and replaced it. **Re-syncing the
  unchanged source must NOT resurrect it**; the file still carrying the old text is precisely why
  the correction existed.

And the function that consumes it, `retirement.ts:236-243`:

```ts
export function blocksReingest(node, now, supersededIds?): boolean {
  if (!isRetired(node, now, supersededIds)) return true;
  return retirementReasonOf(node, supersededIds) === 'supersede';
}
```

Four states, three answers: live → blocks (ordinary dedup); expired-not-retired → blocks (expiry is
not a retract, it is still the stored content for that source); retired-by-supersede → blocks
(that's the point); retired-by-delete → does **not** block.

The call site is the ingest dedup index, `src/core/graph/incremental.ts:96-105`:

```ts
const supersededIds = collectSupersededIds(graph);
const existingByHash = new Map<string, GraphNode[]>();
for (const node of graph.nodes.values()) {
  if (blocksReingest(node, ingestNow, supersededIds)) { ...bucket by contentHash... }
}
```

The comment at incremental.ts:72-88 records what it replaced: the previous test was
`confidence > 0.1`, which **could not tell the two reasons apart**, so re-appending an unchanged
source re-created a corrected-away fact "as a live 0.9-confidence node, unmarked, outranking its own
retired original." And it notes the second failure of the confidence test: `reflect({decay:true})`
drives *live* memories to the same 0.1 floor, so the old test also duplicated any sufficiently old
live node on re-append.

**Why this is the finding to steal.** Nearly every memory system models deletion as one thing. This
says deletion has (at least) two meanings that differ only in what a later sync should do, that the
difference is invisible in any confidence/score representation, and that it must therefore be stored
as a first-class enum on the tombstone and consulted by the ingest path.

---

## 3. Retirement hardens, it never softens

Two asymmetric merge rules, both in `applySupersede` / `applyDelete`.

`correction-engine.ts:296-313`:

```ts
const retired = retireNode(oldNode, { retiredBy: 'supersede', reason, now,
                                      supersededIds: priorSupersededIds });
oldNode.metadata.retiredBy = 'supersede';   // UNCONDITIONAL
if (retired) {                              // instant-bearing markers: only if WE retired it
  oldNode.metadata.deletedAt = now;
  oldNode.metadata.deleteReason = correction.reason;
}
```

- The **reason** hardens unconditionally to `supersede`, because it is the stricter of the two
  (`delete` permits re-ingest; after a correction that is exactly what must not happen).
- The **instant** does not move — "lineage is history".
- `applyDelete` (correction-engine.ts:221-236) is the mirror: it only stamps `deletedAt` /
  `deleteReason` when `retireNode` actually returned true, because "stamping them over an existing
  retirement records a delete that never happened", and on a legacy supersede tomb it would add a
  delete-shaped marker to a node the owner superseded.

`retireNode` returning a boolean (`retirement.ts:156-172`) is what makes the "did I actually retire
it" question answerable at every call site, and every bulk caller uses it for accurate counting.

A subtle ordering bug they document rather than hide, `correction-engine.ts:259-263`:

```ts
// Captured BEFORE this correction's own `supersedes` edge exists. Collecting it
// afterwards would put `oldNode` in its own set, `retireNode` would short-circuit,
// and the node would end up with a reason but no retirement instant — retired at
// every point in history, including the audit hatch.
const priorSupersededIds = collectSupersededIds(graph);
```

---

## 4. Liveness comes from markers; confidence is a ranking weight, in both directions

`retirement.ts:3-45` splits two facts that were previously one predicate
(`validUntil != null && validUntil <= now`):

```ts
export function isRetired(node, now, supersededIds?): boolean {
  if (!isAdministrativelyRetired(node, supersededIds)) return false;
  if (node.validUntil == null) return true;
  return node.validUntil <= now;
}
export function isExpired(node, now, supersededIds?): boolean {
  if (node.validUntil == null) return false;
  if (node.validUntil > now) return false;
  return !isAdministrativelyRetired(node, supersededIds);
}
```

The motivating bug, quoted: *"my parking permit expires 30 June" vanished from prompts as though the
owner had retracted it.* Expired-but-not-retired nodes stay eligible and are **damped ×0.3 in
traversal** (retirement.ts:47-55) — "damp over exclude / label" is recorded as a *measured* choice
("see M4-FINDINGS for the measurement").

And the invariant that ties this territory together (retirement.ts:26-28):

> Confidence is NOT a liveness signal in either direction. It is a ranking weight, and time-decay
> drives live memories to the same floor a correction used to write.

The numeric encoding of that, `retirement.ts:127-135` and `confidence.ts:61-86`:

```ts
export const RETIRED_CONFIDENCE = 0;     // tombstone marker
export const CONFIDENCE_MIN = 0.01;      // lowest a LIVE node may be given
export const CONFIDENCE_MAX = 1;
```

Zero is reserved and the gap is load-bearing: 0.1 (the decay floor) cannot distinguish "retired"
from "old"; zero can. A live node is forbidden from reaching zero because that would (a) forge the
audit marker and (b) zero the ranking product — "suppression with no tombstone", the one outcome the
whole discipline exists to prevent. The refusal message names the alternative:

```
Zero is reserved for retirement (RETIRED_CONFIDENCE); to stop serving this memory call
deleteNode(), which leaves a tombstone and stays auditable.
```

The test pins that the floor is still usable as suppression:
`tests/unit/confidence-primitive.test.ts:336-342` — "a node damped to the floor is still
retrievable — damped, not disappeared", and "and it is still not retired".

---

## 5. `setConfidence` — a write that neither mints nor retires

`src/core/corrections/confidence.ts` is the best-argued file in the repo. Its preamble (lines 1-55)
opens by enumerating the *entire* pre-existing confidence surface:

```
applyAdd        → 1.0 on a NEW node
applyEdit       → supersede: retires the target, mints a new node at 1.0
applySupersede  → retires the target, mints a new node at 1.0
retireNode      → 0 (delete / supersede / forgetBefore / forgetTopic / cascadeSoftDelete)
decayConfidence → the one in-place write, and it is not addressable
```

…and then names the emergent defect: a host that wanted "this memory just proved useful" had no call
to make, so it emulated `reinforceNode` as `edit(id, node.content, 'reinforce')`. After 0.10.0 made
edit a supersede, that no-op **minted a duplicate node and retired the original on every recall**,
and because the re-supplied content came from a truncated read it also *silently shortened the
memory each time*. The lesson, stated as a general law:

> A primitive that does not exist gets emulated, and the emulation is worse than the gap.

Mechanism, precisely:

```ts
export interface ConfidenceChange {
  nodeId: NodeId; previous: number; applied: number; changed: boolean;
  reason: string; at: number;
}
export function setNodeConfidence(graph, nodeId, value, reason, now = Date.now()): ConfidenceChange
export function setNodeConfidences(graph, entries: readonly ConfidenceEntry[], reason?, now?): ConfidenceChange[]
export function clampConfidence(value: number): number
```

Five design decisions inside it, each with an explicit rejected alternative:

1. **The receipt is read back from the graph, not echoed** (confidence.ts:231-262). `applied` is
   assigned from `node.confidence` *after* the assignment, so "a caller that logs this object is
   logging what the graph actually holds". Motivation: the consuming app has "a permanent
   graph-vs-audit-log split because it logged an increment while the graph received something else."

2. **The audit stamp lives ON THE NODE, not in an op-log** (confidence.ts:241-249). The reasoning is
   the good part: "a log that records confidence writes and is blind to the four correction paths is
   a second source of truth that is authoritative for one operation and wrong about the rest. The
   record and the state are therefore the same artifact — they cannot disagree, and they round-trip
   together through `.gai` and SQLite." Fields: `confidenceSetAt`, `confidenceSetFrom`,
   `confidenceSetTo`, `confidenceSetReason`, `confidenceWrites` (a counter).

3. **No silent clamp** (confidence.ts:88-114). Clamping is a *separate exported function*, because
   an accumulating caller (`confidence + step`) will overshoot in normal operation, and a silent
   clamp lets it keep believing "+0.03 applied" while the stored value never moves. `clampConfidence`
   deliberately returns `NaN`/`Infinity` unchanged so the write refuses them: "turning a caller's
   arithmetic bug into a valid-looking 0.01 is the silent failure this module is built to avoid."

4. **A no-op write is still an event.** `changed: false` is returned and the stamp/counter still
   move, because "reviewed, unchanged" is a real judgement for a review deck (confidence.ts:44-46,
   132-134). Test: confidence-primitive.test.ts:186-191.

5. **It is refused on a retired node — for a reason different from why `edit()` is refused**
   (confidence.ts:195-226). The comment explicitly rejects cargo-culting the neighbouring guard:
   "Copying the refusal because the neighbouring method has one would be cargo cult. The argument has
   to stand on its own, and it does, on two independent grounds" — (a) confidence is a ranking
   weight and retired nodes are never ranked, so success would confirm a misunderstanding; (b) it
   would overwrite the zero that distinguishes a tomb from a decayed memory. The *concrete* trigger:
   the reinforcement caller holds a stale id, "which is the normal state of affairs, since
   `edit()`/`supersede()` retire the id the caller had."

**Enforced by a source scan, not just behaviour** (confidence-primitive.test.ts:256-274): the test
reads every `.ts` under `src/core/query/` and fails if any of them mentions
`corrections/confidence|setNodeConfidence|setNodeConfidences`. The rationale is that the behavioural
check proves today's query path is clean; the source scan stops a future one from starting — "which
is how `recordAccess` became a problem in the first place."

---

## 6. Throw vs return is chosen per-operation by *ignorability*

Corrections return `{ applied: 0, errors: [...] }` and never throw. Confidence writes throw. Both
choices are argued in the same terms (confidence.ts:264-289, sdk/index.ts:1188-1228, :1287-1292):

- The non-throwing shape is *defensible for corrections* because they are applied in batches and one
  bad id should not abort the rest — but it "produced a whole class of defects in the consuming
  application, where a refusal was reported to the user as a success because nobody read `.errors`.
  **A returned error is ignorable by doing nothing, and doing nothing is what callers do.**"
- None of that transfers to a single-node caller-initiated write, so refusal is raised "in the one
  shape a caller cannot ignore by doing nothing: an unhandled throw stops the program."
- `setNodeConfidences` covers the batch case **atomically**, so it does not reintroduce the ignorable
  shape. All entries are validated before anything is written; the throw names *every* failing entry.

The `edit()` JSDoc even documents the anti-pattern it observed downstream verbatim: a consumer wrote
`try { g.edit(...) } catch { /* ignore */ }`, "which caught an exception that is never thrown while
silently discarding the errors that are always returned, and reported a correction that never
happened as a success" (sdk/index.ts:1192-1199).

Batch specifics worth stealing (confidence.ts:327-375):

- `collectSupersededIds` is hoisted out of the loop — "per entry it is O(edges) each time, and on an
  18k-node graph a decay pass would rescan every edge for every node."
- **A repeated node id in one batch is REFUSED, not last-write-wins**: "a receipt for the losing
  write would report a value the graph does not hold." Error code `CONFIDENCE_DUPLICATE_ENTRY`.
- The batch bumps `metadata.version` exactly once "so a host that persists on version change writes
  one snapshot rather than N."

Error taxonomy (`src/core/errors.ts:77-133`) is worth noting because the *class*, not the code, is
the branch axis: `'corruption' | 'version-skew' | 'caller' | 'config'` with the comment "the question
a consumer actually asks is not 'which error' but 'what do I do about it'". `GraphnosisError` is a
single class with a `code` field rather than a subclass tree, because `instanceof` "does not survive
duplicated module instances… or an esbuild bundle that inlines it" and does not survive
`JSON.stringify` across an IPC boundary. The `ERROR_CLASS` map is `Object.freeze`d and described as
"deliberately the only place this relationship is written down — a second copy is how the app ended
up with two divergent classifiers that disagreed with each other."

---

## 7. Preview before forget, and a measured blast radius

`correction-engine.ts:392-447`. The comment carries real numbers from an 18,968-node graph:

- `forgetTopic('aster')` retired **2,151** nodes, **127** of them only because an unrelated word was
  `Pilaster`.
- `forgetTopic('data')` retired **1,546**, most via the entity path, because vendor names contain it.

The fix is two-part:

```ts
const escaped = topicLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const topicRe = new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, 'u');
...
if (opts.dryRun) continue;   // report the scope, retire nothing
```

Note the shape: **the dry run is the same code path**, not a parallel estimator, so the preview
cannot drift from the operation. `previewForgetTopic` (sdk/index.ts:1392-1402) is a thin wrapper:

```ts
const r = forgetByTopic(this.graph, topic, 'preview', { dryRun: true });
return { nodeIds: r.nodeIds, count: r.nodeIds.length };
```

The justification is framed as a *governance* requirement, not a UX nicety: "That is an unbounded
authority over a user's memories, which Article #7's capped-authority requirement forbids."

Also worth noting: the JSDoc on the *old* function claimed it "uses the same entity + content
matching as the query engine" (which tokenizes) while the implementation was a raw substring test.
The comment calls that out explicitly — a doc that lies about the matching rule is how the blast
radius stayed invisible. (The stale claim still survives on the SDK wrapper, sdk/index.ts:1381.)

`forgetByTimeWindow`, `forgetByTopic`, and `cascadeSoftDelete` all retire with
`retiredBy: 'delete'`, with an inline comment at each site saying why ("re-supplying the source
restores it"). `cascadeSoftDelete` hoists `collectSupersededIds` out of the BFS with the comment
"Once, not per node: the cascade reaches every node sharing the source file, and any of them may be a
legacy supersede tomb the delete must not overwrite" (correction-engine.ts:460-462).

---

## 8. Contradictions are reported, never resolved

README.md:217-242 is the contract:

> **Nothing is resolved for you.** The new passage is ingested like any other, and the old node is
> left exactly as it was — not retired, not rewritten, not merged away. You are told there is a
> conflict and you decide: supersede, keep both, or reject. A vector store has no place to put that
> decision, so it silently keeps both and lets ranking pick a winner per query.

and the calibration rule:

> Detection is deliberately conservative … **A false contradiction is worse than a missed one.**

The append-time detector (`src/sdk/index.ts:173-280`) is the one that implements the README example.
Gate: ≥2 shared *strong* entities, both passages ≥60 chars, and at least one side carrying a strong
correction marker. Two details worth stealing:

- `WEAK_CONTRADICTION_ENTITY_RE` (sdk/index.ts:180-186) strips bare years, ISO/slash dates, money,
  percentages, and <4-char tokens, "deliberately STRUCTURAL only: corpus-specific stopword lists are
  the consuming app's concern, not a general-purpose library's." That line is a good scoping
  principle for any library-vs-app boundary.
- The index is built in **one pass restricted to entities the new batch touches**
  (sdk/index.ts:210-227), replacing an `O(entities_new × N)` scan that re-lowercased every entity of
  every node per comparison — "billions of transient strings on a large ingest, which grew the heap
  into multi-GB reserved pages (the ingest memory spike)."
- Weak discourse markers ("however", "in fact", "but actually") were **removed** from the pattern
  list: "they fire on ordinary prose and are the dominant ingest false-positive source"
  (sdk/index.ts:229-235).

`AppendResult.contradictions` is documented as decision-forcing: "The graph is NOT automatically
modified — you decide how to resolve each one via `g.supersede()`, `g.deleteNode()`, or `g.edit()`"
(sdk/index.ts:157-163).

**The other detector is a different algorithm and it does not work for this case.** See antipattern
A1 below — this is the biggest weakness in the territory.

---

## 9. Reason-prefix namespacing as the audit filter

`src/core/audit/audit-exporter.ts:97-136`. Soft-delete reasons follow a namespaced-prefix convention:

```
(no prefix)   real lifecycle event — load-bearing for audit
user:         explicit human action (corrections, GDPR deletions)
system:       automated platform action (cascade-delete, retention, decay) — visible, filterable
preview:      speculative / rolled-back UX — HIDDEN by default
```

```ts
export function shouldHideReason(reason: string | undefined, opts: AuditFilterOptions = {}): boolean {
  if (opts.includeAll) return false;
  if (!reason) return false;
  const prefixes = opts.hideReasonPrefixes ?? ['preview:'];
  return prefixes.some(p => reason.startsWith(p));
}
```

Two things done right: (a) it is stated as a **convention only — not enforced**, with the fallback
behaviour named ("Consumers who don't follow it get v0.1 behavior"); (b) the predicate is exported
"so consumers can use the same filter against their own audit pipelines" — one filter, two
consumers, no divergence. The defaults elsewhere follow it: `'system:retention-policy'`,
`'system:topic-forget:<topic>'`, `'system:cascade-delete'`, `'user:topic-deletion'`.

Minor wart: `previewForgetTopic` passes `'preview'` (no colon), so it would not be hidden by the
default filter — harmless only because a dry run writes no reason at all.

---

## 10. Decay is opt-in, because the field it keys on is never written

`src/core/optimization/reflection.ts:25-47` — `ReflectOptions.decay`, **off by default**. The comment
is a complete incident report:

- `decayConfidence` keys on `lastAccessedAt`.
- Nothing refreshes that field in normal operation: it is written at node creation and on correction,
  and only updated by retrieval when the caller opts into `recordAccess` — "which the desktop host
  never does, because a write is not a side effect of a read."
- So the field is effectively creation time, and **decay measured age, not disuse**.
- Traversal multiplies by `node.confidence`, decay compounds per pass, and the shipped host reached
  `reflect()` every six hours through its contradiction scan → "a node older than a couple of months
  fell to the 0.1 floor within a day and was suppressed in retrieval."
- `generateAuditReport` reached it too, "which made producing an audit mutate the data it audits."

`reflect()` line 69: `result.decayed = opts.decay === true ? decayConfidence(graph) : 0;` —
strict `=== true`, so a truthy-ish value cannot enable it.

The test `tests/unit/reflect-no-decay.test.ts` pins four properties by name: D1 no decay by default at
any age (3/30/90/365 days), D2 twenty passes ("5 days at the host cadence") cannot compound, D3
`generateAuditReport` leaves confidence untouched, D4 explicit `{decay:true}` still works. Note D3's
scope — see antipattern A2.

The generalisable lesson: **an access-decay policy is only meaningful if something actually records
access, and recording access on a read is itself a design decision with a blast radius.** They
resolved it by making both halves opt-in and by refusing to let retrieval write.

---

## 11. Legacy tombstone recovery: corroborating evidence, never a switch

This is unusually mature backward-compat work for a 0.x library.

`retirement.ts:66-108` — `isAdministrativelyRetired` recovers retirement from graphs written before
`metadata.retiredBy` existed, by enumerating what each historical producer actually wrote:

```
applyDelete                                     → metadata.deletedAt
forgetByTimeWindow / forgetByTopic / cascade    → metadata.forgottenAt (never deletedAt)
applySupersede                                  → confidence + validUntil + a `supersedes` edge only
```

```ts
const by = node.metadata?.retiredBy;
if (by === 'delete' || by === 'supersede') return true;
if (typeof node.metadata?.deletedAt === 'number') return true;
if (typeof node.metadata?.forgottenAt === 'number') return true;
if (supersededIds?.has(node.id) && typeof node.validUntil === 'number') return true;   // <- the rule
return false;
```

**The rule that matters** is the last line's conjunction. The `supersedes` edge is *corroborating
evidence*, and only counts when the node also carries a retirement stamp. The reason (retirement.ts:
86-96, and pinned by `tests/unit/supersedes-edge-liveness.test.ts:1-26`): `supersedes` is a
first-class member of the public `DirectedEdge['type']` union with **no direction validation
anywhere**, and the desktop sidecar's `node.linkDirected` IPC accepts caller-supplied `from`/`to`.
An unconditional gate therefore lets any caller retire a live node at full confidence, and the
resulting disappearance is the worst possible kind:

> markerless (nothing on the node says it was retired); clock-free (with no `validUntil` it reads as
> retired at EVERY as-of instant, including the `retiredAt: 0` audit hatch, so no historical view can
> show it); persisted (survives the `.gai` round-trip); irreversible by the owner (`blocksReingest`
> classifies it as a supersede tomb, so re-adding the source, the one recovery anyone would try,
> no-ops).

`retiredAtOf` (retirement.ts:194-213) is a four-step fallback chain — `metadata.retiredAt` →
`validUntil` → `deletedAt` → `forgottenAt` → `0` — with a stated reason: `retired()` declares
`retiredAt: number` and sorts on it, "and a single `undefined` turns every comparison in that sort
into NaN, leaving the documented audit ordering undefined."

`retireNode`'s doc (retirement.ts:137-155) contains the most useful sentence in the file:

> `supersededIds` is not optional in spirit — pass it whenever a graph is in hand. **This is the only
> site that DECIDES retirement and then MUTATES**, so a legacy tomb it fails to recognise is not
> merely served, it is rewritten … A v0.8.0-era graph stays repairable by a later release; one this
> function has downgraded does not.

The test craft around it is exemplary:

- `tests/fixtures/legacy-v080-four-producers.gai` — a **golden binary fixture** containing one tomb
  from each of the four historical producers.
- `tests/unit/legacy-retirement-v080.test.ts` proves the **read** path.
- `tests/unit/legacy-tomb-write-path.test.ts` proves the **write** path, and its header explains why
  the read-path suite "structurally cannot catch" the defect: `retireNode` was the single `isRetired`
  call site that did not receive `supersededIds`, and the only one that mutates. It runs the same
  battery under three mutations (`none` / `deleteNode` / `cascade`) and asserts the recovery the user
  would actually attempt: `g.appendMarkdown(UNCHANGED_SOURCE, tomb.source.file)` then "resync creates
  no live copy of the corrected-away fact" (legacy-tomb-write-path.test.ts:159-163).

---

## 12. Every destructive path is fenced, and the fences are measured

Three separate places, one doctrine: **never destroy on weak evidence, and prefer a redundant node
to a lost one.**

**(a) Content is verified before any hash-keyed drop.** `src/core/optimization/deduplicator.ts:40-68`:

> `contentHash` is 32-bit DJB2. At 50k nodes the probability of at least one collision is ~25%, and
> this function HARD-DELETES the loser … A collision leaves both nodes standing, which is the correct
> failure direction: **a redundant node costs space, a destroyed one costs a memory.**

Implementation: group by hash, then **sub-group by exact content string**, and only merge within a
content bucket. The same reasoning appears at incremental.ts:89-95 with the birthday numbers
("roughly 5% by 20k nodes and 25% by 50k") and a sharper consequence — on the ingest path a collision
"does not surface as an error. It silently SKIPS the incoming chunk as a duplicate, so a genuinely
new memory is never stored and nothing reports that it was dropped."

**(b) Retired nodes are excluded from dedup on both sides** (deduplicator.ts:5-16, :27):

> Forgetting a source and re-adding it deliberately produces two nodes with the same content hash:
> one retired audit record and one live restoration. Merging them destroys one of the pair, and "keep
> the first" is insertion order, so it could destroy either — the audit record, or the live memory in
> favour of a tombstone.

That is the general hazard of "keep the first" tie-breaks: **insertion order silently decides which
of two semantically different things survives.** Pinned by `tests/unit/retirement.test.ts:305-327`
("Nothing in this SDK hard-deletes a retired node"), which deliberately constructs the trigger
(forget → re-append → dedup).

**(c) Orphan hard-delete was removed from the build path, with measurements.**
`src/core/graph/graph-builder.ts:131-156`:

> It used to be true, which hard-deleted every node left without an edge —
> `graph.nodes.delete(nodeId)`, with no owner action, no tombstone, no op-log entry, and no way to
> tell afterwards. Measured on the LongMemEval corpus that silently discarded **80 of 3,747 nodes at
> q=1 (2.1%) and 467 of 19,416 at q=5 (2.4%)** … An unconnected node is still a memory. It simply has
> no neighbours yet … Deleting it is a retrieval-tuning decision destroying user content.

The pruner keeps the capability but **scopes the guarantee explicitly** rather than pretending the
exception does not exist (`src/core/optimization/pruner.ts:3-16`):

> This is outside the indelibility guarantee. Theorem 1 scopes "every write is either an append or a
> soft-delete" to the canonical-layer write semantics; `pruneGraph` is an opt-in maintenance
> operation the owner invokes by name.

Also recorded: edge pruning removed **0 edges at both corpus scales**, i.e. the retained half is a
no-op in practice. Keeping a measurement that says "this does nothing" is good discipline.

---

## 13. `SPEC.md §8.1` — one slot per id cannot represent a conflict

The v2 proposal (unimplemented; the roadmap says everything in v2 lands together or not at all,
ROADMAP.md:47) contains the cleanest statement of the structural limit that this whole territory is
working around. `SPEC.md:379-400`:

> Merging two copies of an engram that both edited node `n1` must produce a graph containing *both*
> revisions, marked as in conflict, for the owner to adjudicate … With one slot per id the
> implementation has three choices and all are wrong: **overwrite one** (silent loss, contradicting
> the indelibility guarantee), **mint a fresh id for the loser** (losing the fact that these are two
> revisions of the *same* thing), or **emit the conflict edge as the self-loop `n1 → n1`**, which
> asserts that a fact conflicts with itself. The `contradicts` edge type already exists; it has
> nowhere meaningful to point.

The fix proposed is `(id, rev)` node identity, with `id` stable across content changes — "and it is
why content-derived ids are the wrong answer here."

Note the honest tension: **today's `supersede` is option two.** It mints a new nanoid for the
replacement and links `old → new` with a `supersedes` edge; the edge is the only thing carrying "same
memory, two revisions". That works for a single-writer append-only history and does not work for
merge, which is exactly why merge is not in v1.

---

## 14. Process craft worth copying

**Defect-archaeology comments.** Nearly every guard in this territory carries four things: the
incident that motivated it, the measurement, what breaks if you remove it, and the alternative that
was rejected and why. Examples: correction-engine.ts:77-106 (edit), confidence.ts:1-55 (why the
module exists), confidence.ts:195-226 (a refusal that explicitly refuses to cargo-cult its
neighbour), reflection.ts:25-47 (decay), retirement.ts:137-155 (retireNode's mutation hazard),
graph-builder.ts:131-147 (orphan measurements). The consistent voice suggests a house rule.

**Guard-neutralisation testing.** `tests/unit/confidence-primitive.test.ts:19-21`:

> Every guard below is written so that removing the guard makes a named check go red — see the
> neutralisation log in the milestone report.

That is hand-rolled mutation testing with an audit trail, and it produces tests whose check names
read as specifications ("a repeated node id is refused, not last-write-wins"; "one bad entry refuses
the whole batch"; "and NOTHING was written — not even the entries that were valid"). The suites are
plain `tsx` scripts with a local `check(name, cond, detail)` and `process.exit(failures === 0 ? 0 : 1)`
— no framework. Section headers are numbered claims, e.g. "1. It neither mints nor retires."

**Changelog as consumer-impact analysis, not a commit list.** `CHANGELOG.md:3-63` leads with "Three
changes are visible to callers even though none of them removes or renames a public export", and
distinguishes the *reader's* view from the *constructor's* view of a type change:

> This is listed here rather than under Added because "additive" describes the reader's view only,
> and the constructor's view is the one that breaks a build.

**An `### Errata (added after release)` section** (CHANGELOG.md:367-384) that admits an omission
rather than quietly fixing it: 0.10.0 introduced two new error message strings and the changelog did
not say so, breaking a downstream substring classifier in silence. It names both strings, explains
which prefix each collides with, and records "these strings are now frozen: they are load-bearing for
at least one downstream classifier. Stable `code`s are planned for 0.11.0 so that no consumer has to
match prose again." The errors.ts header (errors.ts:42-76) then carries the same incident, plus two
named traps for future authors: *do not introduce the word `signature` into any message* (the shipped
classifier matches it) and *do not change the `Invalid .gai` / `Invalid graph` prefixes*.

**A ROADMAP that is a triage policy.** ROADMAP.md exists to say what is *out* of scope: "The default
for borderline cases is **build it as a separate package that depends on Graphnosis**", with a
three-question issue template for "I think this might be in scope but I'm not sure".

**Ship-cadence rules in CLAUDE.md** (CLAUDE.md:3-48): an explicit list of phrases that constitute a
ship signal ("ship", "release", "publish", "push it", "tag v0.x") and an explicit statement that
"looks good" / "great" / "fixed it" are **not** — because every tag push triggers an OIDC npm publish
and they "already burned version numbers (v0.2.4, v0.2.5) on transient CI failures because tags
landed before intent was clear."

---

## ANTIPATTERNS

### A1. Two contradiction detectors with incompatible heuristics; the reflection one cannot fire on a real correction

There are two entirely separate implementations:

| | `detectNewContradictions` (sdk/index.ts:188-280) | `detectContradictions` (reflection.ts:80-158) |
|---|---|---|
| scope | new nodes vs existing graph | all pairs, per shared entity |
| gate | ≥2 strong shared entities, both ≥60 chars, conflict marker | jaccard(entities) **> 0.6** AND cosine(tfidf) **< 0.15** AND conflict marker AND both ≥60/80 chars |
| marker list | 15 alternatives, one regex | 10 different regexes |
| side effect | none | **writes a `contradicts` edge into the graph** |

The reflection gate requires **high entity overlap AND low lexical similarity**. A genuine textual
correction is, almost by construction, lexically *similar* to what it corrects — same subject, same
numbers, one negation. So the gate excludes the canonical case.

MEASURED, on the README's own advertised example (README.md:219-231), run against this checkout:

```
pair len=135/141  jaccard(entities)=0.833  cosine(tfidf)=0.729   gate needs jac>0.6 AND cos<0.15
append-time contradictions: 1
reflect() contradictions:   0   (over 4 consecutive calls)
```

Two further hand-built pairs designed to trip the reflection gate also returned 0. I could not make
`reflect().contradictions` fire at all. `ROADMAP.md:31` nonetheless advertises "**Reflection.**
`reflect()` — contradictions, decayed nodes, surprising connections" as an in-scope core feature, and
`generateAuditReport` sources the audit's "Contradictions Detected" section exclusively from it
(audit-exporter.ts:256-273, :413-421). Net effect: the audit report's contradiction section is
plausibly always empty, while the append path knows about the conflict.

Also note `GENERIC_TERMS` (reflection.ts:359-369) is a hard-coded 50-word English list including
`gaussian`, `linear`, `binary`, `parallel` — corpus-specific stopwords baked into a general-purpose
library, which is exactly the thing sdk/index.ts:176-179 declares out of scope for the *other*
detector.

### A2. "Detection" mutates the graph, and the audit still mutates the data it audits

`reflect()` is presented as an analysis pass but performs three writes:

- `detectContradictions` inserts a `contradicts` `DirectedEdge` per detection (reflection.ts:141-150).
- `inferEdges` inserts up to 100 transitive edges per call (reflection.ts:329-351).
- `decayConfidence` (now opt-in).

`generateAuditReport` calls `reflect(graph, tfidfIndex)` unconditionally (audit-exporter.ts:260), so
generating an audit still mutates the graph's edge set. The fix for the decay incident
(reflection.ts:25-47) addressed only the confidence axis, and `tests/unit/reflect-no-decay.test.ts:102-113`
("D3 an audit report does not mutate confidence") asserts only confidences — it does not snapshot
`directedEdges.size`, so the remaining mutation is unpinned.

Worse, the contradiction write has **no existence check**. Compare:

- `inferEdges` maintains `existingPairs` and skips `if (existingPairs.has(...))` (reflection.ts:299-324).
- `discoverConnections` checks `alreadyConnected` before reporting (reflection.ts:237-242).
- `detectContradictions` checks nothing — it `graph.directedEdges.set(nanoid(), edge)` every pass
  (reflection.ts:141-150).

On a host that calls `reflect()` on a schedule (the decay comment says the shipped host did so every
six hours), each detected pair accretes a fresh duplicate `contradicts` edge forever. I could not
observe this empirically because I could not make the detector fire (A1) — which is the only reason
it is not a shipping bug.

### A3. Adjudication has nowhere to live; retirement is invisible to reflection

`Contradiction.resolved: boolean` (src/core/types.ts:373) is set to `false` at both construction
sites (reflection.ts:137, sdk/index.ts:273) and is **read nowhere in the repo**. Contradictions are
ephemeral values, never persisted into the graph, so there is no representation of "the owner looked
at this and chose to keep both". The README promises "You are told there is a conflict and you decide:
supersede, keep both, or reject" (README.md:233-237) — but only the *supersede* branch leaves a trace
in the graph. "Keep both" and "reject" are unrepresentable, so the same conflict is re-reported on
every scan.

Compounding it: **`reflection.ts` never imports `retirement.ts`** — no `isRetired`, no
`collectSupersededIds`. Both `detectContradictions` (reflection.ts:88-101) and `discoverConnections`
(reflection.ts:201-208) filter only on `node.type` and content length. So a superseded tomb keeps
participating in contradiction detection against its own replacement (which by construction shares
its entities and carries a correction marker), and in "surprising cross-domain discoveries". Every
other consumer of the graph in this repo — dedup, ingest, traversal, serialization, giki, enrichment
— consults retirement; reflection is the hole.

### A4. Health metrics and entity reports conflate tombs with weak live memories

`generateHealthReport` walks all nodes once (audit-exporter.ts:319-336) and, in the same loop:

```ts
totalConfidence += node.confidence;                 // :321  — tombs contribute 0
if (node.confidence < 0.5) lowConfidenceNodes++;    // :325  — every tomb counts as low-confidence
if (isRetired(node, now, supersededIds)) { expiredNodes++; retiredByReason[...]++; }   // :326-329
```

`avgConfidence` (audit-exporter.ts:357) is therefore dragged down proportionally to how much the
owner has forgotten, and `lowConfidenceNodes` is `weak_live + retired`. This is precisely the
conflation `retirement.ts:26-28` forbids ("Confidence is NOT a liveness signal in either direction"),
reintroduced in the surface whose job is to report on retirement. The markdown export prints both as
top-line health metrics next to the retired counts (audit-exporter.ts:376-382), so a reader sees
"Avg Confidence 41%" and "Low Confidence (<50%): 8,000" with no indication that most of it is tombs.

Related: `EntityReport.facts` (audit-exporter.ts:33-40) has no retired flag, and
`generateEntityReports` includes retired nodes (it filters only on reason-prefix,
audit-exporter.ts:170-171). So "Top Entities" in the audit markdown interleaves retired and live
facts, distinguishable only by a `0%` confidence badge (audit-exporter.ts:405-408). The one surface
that is supposed to make "invisible, not erased" legible does not label which is which. Contrast
`Graphnosis.retired()` (sdk/index.ts:1351-1368), which does this properly — node, reason, instant,
deterministically sorted with an id tie-break.

### A5. None of this reaches the AI-facing surface

The MCP server registers exactly five tools — `load_graph`, `ingest_files`, `update_graph`, `query`,
`export` (src/mcp/server.ts:38, 56, 74, 92, 110). There is no `supersede`, no `deleteNode`, no
`setConfidence`, no `retired`, no `forgetTopic`/`previewForgetTopic`, and no audit tool. For a library
whose pitch is memory for AI harnesses, the agent can write memories and read them but can never
correct, weight, forget, or audit them — the entire territory surveyed here is SDK-only.

Worse, `update_graph` bypasses the SDK facade and calls `addDocumentsToGraph(session, documents)`
directly (src/mcp/tools/update_graph.ts:60), returning `{newNodes, newDirectedEdges,
newUndirectedEdges, totalNodes, savedTo}` (update_graph.ts:74-80). `detectNewContradictions` lives in
the SDK wrapper (`appendWithOptions`, sdk/index.ts:448-455), so **contradictions are silently dropped
on the MCP ingest path** — the one path where an agent is most likely to be writing conflicting
information.

### A6. The correction write path is the least-polished part of the module

Three concrete things, all in `applyAdd` (correction-engine.ts:139-195), which is the shared node
minter for `add`, `edit`, and `supersede`:

- **Provenance is discarded.** Every correction node gets
  `source: { file: 'human-correction', offset: 0 }` (correction-engine.ts:155). The replacement for a
  superseded fact therefore no longer belongs to the document it corrects. Consequences: per-source
  ingest dedup keys on `chunkKey` (file + type + order), so a correction can never be matched or
  updated by a later sync of that file; and `cascadeSoftDelete`'s same-source sweep
  (correction-engine.ts:487-495) will not reach corrections when the source is forgotten. Against
  §1 Provenance ("Every fact traces back to where it came from", README.md:179-181), the only lineage
  a correction carries is the `supersedes` edge.
- **IDF is recomputed per node.** `addDocument(...); computeIdf(tfidfIndex);` runs inside `applyAdd`
  (correction-engine.ts:171-173), and `importCorrections` calls `applyAdd` once per chunk in a loop
  (correction-engine.ts:341-359). Bulk import is therefore O(chunks × vocabulary).
- **No similarity/association edges are built.** A correction node gets at most one directed edge
  (`supports` for a bare `add` with a `nodeId`, or `supersedes`). It joins the undirected
  association graph not at all, so the corrected fact is reachable in traversal essentially only as a
  seed. Given the dual-graph thesis, the highest-confidence content in the store is the least
  connected.

(Also stale-doc risk: `AGENTS.md:41,43,55` and `CLAUDE.md:68,135,140,142` still describe soft-delete as
"validUntil + confidence 0.1", decay as always-on "~1%/day", auto-pruning as removing orphan nodes,
and the format as `.aikg`. All four are false in the current code. The accurate rationale lives only
in source comments, so the agent-facing summaries are the least reliable documents in the repo.)
