# Amendments to OPEN work — reasoning, files opened, rejected candidates

Lane: amendments to `active` goal packets and mid-stage explorations.
Target repo: `/home/elpresidank/YeeBois/projects/beep-effect15` @ `d1dfc4b3c1` (main, clean).
Input: `SYNTHESIS.md` (read §1–§8 in full), plus live verification of every claim I carried.

## Method

The synthesis is credible but it is a *report*, and the standing repo rule is
"verify @beep/* paths and APIs with ls/rg before claiming a gap." So for every
item I intended to turn into an amendment I did two things:

1. Opened the amendment's **target** file and quoted what is there now.
2. Independently re-ran the synthesis's beep-side proof command, because the
   synthesis itself documents one case (`ingestion:gai-10`, PDF glyph joining)
   where a mined finding was a layer-attribution error that would have been a
   net regression.

Two of my re-verifications changed the amendment. Both are noted below.

## Files opened (all absolute under the repo root)

Packets / explorations:
- `goals/INDEX.md` (lines 1–50; 33 active packets, phase counts)
- `goals/hybrid-retrieval-fusion-core/SPEC.md` (full, 168 lines)
- `goals/ingestion-secret-scrub/SPEC.md` (full, 191 lines)
- `goals/practice-kg-mcp/SPEC.md` (full, 97 lines)
- `goals/practice-kg-mcp/research/bundle-contract.md` (§4 lines 121–168, §8 lines 202–240, headings)
- `goals/epistemic-contradiction-triage/SPEC.md` (full, 149 lines)
- `goals/citation-verified-span-substrate/SPEC.md` (full, 175 lines)
- `goals/law-doc-structure-oa-slice/SPEC.md` (full)
- `goals/legal-document-intake/SPEC.md` (lines 1–140)
- `goals/agentic-professional-runtime/SPEC.md` (full)
- `goals/semantic-foundation/SPEC.md` (lines 1–100)
- `goals/knowledge-surface-automation/SPEC.md` (full)
- `goals/coding-agent-effectiveness-evidence-loop/SPEC.md` (lines 1–120)
- `goals/coding-agent-effectiveness-evidence-loop/PLAN.md` (lines 291–325, grep for ablation)
- `explorations/rag-retrieval-projection/MAP.md` (full) + `ops/manifest.json`
- `explorations/epistemic-belief-view-revision/CAPTURE.md` (full) + `ops/manifest.json`
- `explorations/agent-governance-control-plane/CAPTURE.md` (full)

Source:
- `packages/foundation/modeling/provenance/src/` (ls: 4 files) + `SourceTextIdentity.ts:110–145`
- `packages/drivers/wink/src/WinkCorpus.service.ts:590–605, 770–795`
- `packages/agents/domain/src/entities/Skill/Skill.model.ts` (all 47 lines)
- `packages/tooling/library/ai-sync/src/schemas.ts:120–145` (`AgentSkillFrontmatter`)
- `packages/foundation/capability/mcp-kit/src/TierGate.ts:1–30, 600–626`
- `packages/drivers/doc-text/src/DocText.service.ts:100–145`
- `packages/law-practice/server/src/PracticeKg.tool-handlers.ts:40–110`
- `packages/law-practice/use-cases/src/PracticeKg.tools.ts:73–82`
- `packages/law-practice/domain/src/values/KgNodeKind/KgNodeKind.model.ts:37–46`
- `packages/law-practice/domain/src/values/KgEdgePredicate/KgEdgePredicate.model.ts:36–46`
- `packages/tooling/library/ai-metrics/src/models.ts:650–670` (`BenchmarkRun`)
- `.claude/skills/quality-review-fix-loop/SKILL.md:20–35`
- `.claude/skills/browser-qa-loop/SKILL.md:14–20, 70–82`

Commands re-run (exact):
```
grep -rn "Order" packages/foundation/modeling/provenance/src/     # only isWellOrdered, a predicate
rg -n 'safeForPrompt' packages --glob '*.ts'                      # 0 hits
grep -rl -i 'encrypt' goals/practice-kg-mcp/                      # exit 1, no output
rg -n -i 'confidential|privilege|at rest|threat' goals/practice-kg-mcp/   # only history/ + PLAN, never SPEC or bundle-contract
rg -n 'loopCap|maxIterations|maxRounds|stopReason' packages --glob '*.ts' # only provider stopReason on AssistantTurn — unrelated
rg -n 'timeout|Timeout' packages/drivers/doc-text/src/ packages/foundation/capability/file-processing/src/  # NO OUTPUT
rg -n 'maxMaterializedBytes' packages --glob '*.ts'               # byte cap only, DocText.service.ts:113
rg -n 'PracticeKgEpistemicStatus' packages --glob '*.ts'          # a row field, not a partition
```

## Corrections I made to the synthesis before proposing

**C1 — the extraction path has NO time bound at all, not "a timeout that fails to interrupt."**
SYNTHESIS §3 (`goals/legal-document-intake` row) says "`Effect.timeoutOrElse` does
**not interrupt the parse**. `DocText.service.ts:124-133` passes no `AbortSignal`."
I re-ran `rg -n 'timeout|Timeout' packages/drivers/doc-text/src/
packages/foundation/capability/file-processing/src/` and it returns **no output**.
There is no `Effect.timeoutOrElse` anywhere on that path. What exists is a *byte*
cap at `DocText.service.ts:108-117` (`maxMaterializedBytes`, optional, threaded
from `Files.command.ts:129`). So the finding is stronger and differently shaped
than reported: input size is bounded, wall time is not, and byte size does not
bound parse time for a pathological-structure PDF. I wrote the amendment against
the state I verified, not the state the synthesis described. Anyone implementing
it should not go looking for a `timeoutOrElse` to fix.

**C2 — `TierGate.ts` already carries the security half of `agent-surface:gai-07`.**
The synthesis calls the partial-tool-surface issue "a current defect, not a future
one." The *enforcement* half is not a defect: `TierGate.ts:1-21` states verbatim
that `EnabledWhen` "filters `tools/list` only — `tools/call` dispatch never
re-checks it," cites the upstream line numbers, and says the list helper "must
never be relied upon as the enforcement point." What is genuinely absent is the
*disclosure* half — nothing tells the calling model its surface was narrowed. That
is a smaller, contract-shaped item than mapped, its effort is L, and it needs a
product decision about what a narrowed surface says about itself. **I dropped it
from the amendment set** rather than propose a change to a file whose author
already reasoned about the adjacent hazard correctly. Route it to an align
question, not an edit.

## Amendment set — why each one, and what I turned down

### The fusion core gets three amendments and they are not redundant

`goals/hybrid-retrieval-fusion-core` is 0/4 and its SPEC is the single highest-
leverage surface in the corpus, because every rule written into it now is one
sentence and the same rule after a ranked channel publishes evidence is a
migration. The three are separately decidable:

- **Constraint 5's comparator (A1)** is about *which* total order. SPEC:85 requires
  "one documented stable comparator independent of map iteration order" and never
  says on what. That is not an oversight the implementer will notice — a competent
  implementer will reach for the candidate id, which is exactly the bug Graphnosis
  shipped, measured, and reverted. beep owns a strictly better brick than the
  donor's `{file,offset,hash}`: `SourceTextIdentity` has seven required fields
  including `extractor{name,version}` and `normalizationVersion`, so two ingests
  under different extractors are distinguishable rather than silently equal.
- **RetrievalIntent + source floor (A4)** is about *what enters and survives*, an
  orthogonal axis. It is the one amendment that touches a stated Non-Goal (SPEC:39
  excludes MMR and source-authority policy) and I want that flagged loudly in the
  proposal, because a membership floor is not a reranker and the SPEC should say
  so explicitly rather than leave the distinction to be discovered.
- **Clock/purity (A5)** is about *what ranking is allowed to read*. Constraint 5
  ratifies determinism of *ordering* only. Nothing in the repo violates purity
  today (`rg -in "saturat|reinforce|decay" packages/{epistemic,ontology,law-practice}`
  → zero per the synthesis; I did not re-run this one, it is a negative on
  unstarted code and the amendment is safe either way), which is precisely why it
  costs one sentence now.

### Ownership call I had to make: where does the anchor `Order` live?

The comparator's implementation home is `@beep/provenance`. That package is
**`citation-verified-span-substrate`'s** declared target surface
(`SPEC.md:44-46`), not the fusion core's — the fusion core lists it as a
"reuse/proof surface, not new storage or admission implementations"
(`SPEC.md:63-64`). So a fusion-core implementer who adds `Order.Order` to
`@beep/provenance` is writing into another active packet's owned surface. I split
this into three amendments deliberately (A1 spec-delta on the consumer, A2
code-change in the package, A17 spec-delta on the *owner*) rather than pretend it
is one edit. If A17 is rejected the code has no legitimate home and A1 has to name
a different landing site.

### `blocksReadmission` is the amendment with a live failure available today

Everything else on this list prevents a future defect. This one is reachable now:
attorney rejects an extracted claim → corpus refresh re-reads the unchanged office
action → the rejected claim returns as a fresh candidate. The vocabulary is
already typed and already append-only; nothing reads it on the way in. I routed it
to `explorations/epistemic-belief-view-revision` (capture stage, CAPTURE.md is
append-only so the amendment is a new dated heading) rather than to
`goals/epistemic-contradiction-triage`, because Q4's recommended answer — a
belief-view policy that the ingest path *consults* — keeps the authority boundary
where `epistemic-bitemporal-edge-core` put it, and putting it in the ingest path
would make ingestion depend on adjudication state.

### The practice-kg confidentiality gap is the only one with an external duty

`goals/practice-kg-mcp` is active, 5/9, and Lane 1's live front. It ships a
portable bundle of an IP practice's corpus to a foreign machine.
`grep -rl -i 'encrypt' goals/practice-kg-mcp/` exits 1. The only nearby sentence,
`SPEC.md:69` ("Corpus/PII stays outside the repo; gitleaks stays clean"), is a
statement about **the repo** — it does not describe the artifact a reader is
deciding whether to copy, sync, back up, or hand to co-counsel. Under the standing
OIP confidentiality rule this is not documentation hygiene. I put the normative
text in `bundle-contract.md` §4 (where the layout is defined, and where
`README.txt` is specified as "one page, non-technical") because a disclaimer
belongs in the document a reader consults *while deciding*.

## Rejected candidates (mined, considered, not proposed)

| candidate | routed to | why I did not propose it |
|---|---|---|
| `ingestion:gai-10` PDF position-relative glyph joining | `goals/legal-document-intake` | The synthesis itself refutes it (§6): layer-attribution error reading unpdf's outer wrapper. Adopting it replaces a working path *and* forces a `DOC_TEXT_ENGINE_VERSION` bump that fails `verifyTextAnchor` with `stale-source` on every already-anchored document. Explicitly do-not-do. |
| T1-13 deterministic contradiction detection | `goals/epistemic-contradiction-triage` | The packet's own SPEC:138-139 makes adding detection heuristics a **stop-and-re-scope** condition, and SPEC:23-26 is an explicit Non-Goal. Amending it in would be overruling a live stop condition from outside. I proposed the *pointer* instead (A16). |
| `agent-surface:gai-07` partial tool surface | `goals/agentic-professional-runtime` | See correction C2. The enforcement half is already reasoned about correctly in `TierGate.ts:1-21`; only the disclosure half is missing, effort is L, and it needs a product decision first. Align question, not an edit. |
| T1-7 ordered authority ceiling (L0<L1<L2<L3) | `explorations/agent-governance-control-plane` | The exploration is at capture stage and its `CAPTURE.md` is explicit that the old design corpus "is not automatically current" and "any revival must reconcile with the live Yeet operator, current skill contracts, and current repo law before becoming binding guidance." Writing a new ordered-ceiling design into it now is exactly the move that document warns against. It also depends on T1-2 being stated as law first, which is not my lane (repo-law bundle). |
| T1-2 minting process cannot raise its own ceiling | `AGENTS.md` / `standards/` | Repo law, not an open-packet amendment. Out of lane. |
| T1-8 non-vacuity on law scanners | `packages/tooling/policy-pack/**` | Same — repo law / lint infrastructure, no active packet owns it. Out of lane. |
| T1-4 skill-adherence measurement | `goals/coding-agent-effectiveness-evidence-loop` | Genuinely valuable, but the donor paper **excludes this case from its own empirical claims** ("a guiding anecdote, not measured evidence"). The packet already has ten locked decisions and five evidence-integrity laws; adding a hypothesis-shaped ninth workstream on anecdotal support is the kind of scope the packet's own Non-Goals section exists to refuse. Better as a P7 treatment candidate than a SPEC amendment. |
| ts-03 / ts-08 / ts-10 (total goal contract, tagged step union, walk-time recall) | `goals/agentic-professional-runtime` | All three presuppose a procedure model. `Skill.model.ts` is 47 lines carrying `{fixtureKey, name}` and `AgentSkillFrontmatter` is `{name, description}` — there is no `SkillExecutionPlan` to make total or to tag. Proposing three schema shapes for an entity that does not exist is speculative design. I proposed only **ts-04** (A12), the completion oracle, because it is three literals and it classifies work the packet *already* produces. |
| RAPTOR summary nodes / tree levels | `explorations/rag-retrieval-projection` | Structurally inadmissible: `TextChunk.span` is mandatory and a derived non-contiguous node cannot carry a `VerifiedTextAnchor`. The repo already rejected the graph analogue once. |
| Confidence reinforced by access; age-based decay | anywhere | Disqualifying for a legal product — two identical office actions must not rank differently because one was opened more often. The donor's decay was keyed on a field nothing refreshed. Keep the gap. |
| cc-03 confidence-as-ordinal | `goals/citation-verified-span-substrate` | Already covered one packet over: `law-doc-structure-oa-slice/SPEC.md:4` ("Hand-authored confidence values are non-calibrated priors") and constraint 7 (decode into branded `UnitInterval` at boundaries). `citation-verified-span-substrate` does not model confidence at all. Nothing to amend. |
| `ingestion:gai-01` length floor only for split text | `explorations/rag-retrieval-projection` | Real and cheap, but it is a rule for a chunker that does not exist and it is one clause inside the same satellite pre-commitment block as A10. Folding it in would dilute A10's three load-bearing rules. Note it in the satellite spec when it is written. |
| `craft:gcr-09` NOTICE coverage | repo hygiene | Real, but a chore on a public repo, not a packet amendment. |
| Chronocept anything quantitative | — | n=129, best R²=0.1298, linear regression worse than the mean predictor, no printed license ⇒ reference-only. Only cc-04/cc-05 (which are **Ning et al. 2018**, not Chronocept) and cc-13's ablation *design* survive, and cc-13 is A15. |

## Effort calibration used

S = hours to a day · M = days · L = a phase · XL = a packet of its own.
Where an amendment is a SPEC sentence on an unstarted packet I priced the
sentence, not the eventual implementation, and said so in the risk field.
