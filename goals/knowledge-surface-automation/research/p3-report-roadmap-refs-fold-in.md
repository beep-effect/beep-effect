# P3 report — `lint roadmap-refs` fold-in (ratified decision A7)

Closes the last open P3 item. Ratified text (`research/p1-t2-mini-grill-decisions.md`, A7,
sealed): "the `lint roadmap-refs` command keeps its name and CI step; only its implementation
folds into the shared link parser during P3. `docs/ROADMAP.md` additionally joins the census
corpus." Both halves are delivered; this report is the evidence.

## Half 1 — the implementation fold

The census's Markdown link-destination extraction, previously module-private inside
`repoPathCandidatesOn`, is now the exported reader `knowledgeLinkDestinations`
(`packages/tooling/tool/cli/src/commands/Knowledge/Knowledge.refs.ts`), mirroring the
`knowledgeInlineSpans` idiom: a raw grammar reader with filtering left to callers. Both
consumers go through it — the census link bus (refactored in place, behavior-preserving:
the golden-fixture matrix and the frozen-baseline agreement test passed unchanged) and
`lint roadmap-refs` (`packages/tooling/tool/cli/src/commands/Lint/RoadmapRefs.ts`), whose
two whole-document regexes are deleted. The lint reads prose lines through the fence-aware
`knowledgeDocumentLines`, so a link inside a code fence is no longer linted — the shared
semantic, now pinned by a fenced-dead-link fixture case.

Kept local to the lint, per the ratified wording (the *implementation* folds in, not every
concern): the `goals/`/`explorations/` domain filter, trailing phase snapshots, and
reference-style link definitions — the census deliberately parses none of these. Command
name, CI step id (`lint:roadmap-refs`), finding schemas, output lines, and exit semantics
are byte-compatible; the pre-existing test pins all of them and passed with only the two
new-behavior assertions added.

One implicit contract surfaced during design and is now explicit: the live roadmap wraps
one entry so its `(1/6)` phase snapshot opens the line *after* the link, which previously
worked only because the old regex's `\s*` spanned newlines without bound. That is now a
deliberate one-line lookahead (`phaseSnapshotNear`), covered by a wrapped-snapshot fixture
case that must produce a drift advisory. Differential proof: the rewritten lint against the
live `docs/ROADMAP.md` reports `blocking_findings=0 advisory_findings=0`, identical to the
old implementation on the same tree.

## Half 2 — the corpus join, verified rather than implemented

`docs/ROADMAP.md` was already census corpus when the fold-in landed: `docs` is a scanned
root in `KNOWLEDGE_SCANNER_SCOPE` and only `docs/generated/` + `docs/_internal/` are
excluded. Receipt from the live census on this tree: **61 observations from
`docs/ROADMAP.md`, all surface `live`, all classification `verified`.** Its relative
`../goals/...` links cannot redden `beep knowledge refs --check`, which gates only the
host-path classes (`actionable-host-path`, `external-mirror-reference`) on live surface.
No scope edit was needed; the A7 corpus-join clause was satisfied by the census as shipped.

## Gate trips during the fold-in (the packet's own gates, working)

- `fallow:audit` blocked the first publish: the rewritten parse packed nested loops into
  one function and tripped the introduced-complexity budget. Fixed by the packet's own
  precedent — extracted into four sibling helpers (`definitionReference`, `linkReference`,
  `lineReferences`, `parseRoadmapReferences`); `introduced: 0` after.
- The schema-first inventory gate blocked the exported `KnowledgeLinkDestination` type
  alias. Recorded the justified exception in `standards/schema-first.inventory.jsonc`
  matching its sealed siblings (`KnowledgeInlineSpan`, `KnowledgeDocumentLine`): an
  in-process parse intermediate, never decoded or persisted.

Ledger receipts for both are in `research/OPPORTUNITIES.md`.

With this item closed, P3's scope (Workstream A rewrite pass, hermetic byte gates, C
Stage-1 gate, A7 fold-in) is complete; the manifest phase flip rides the same PR as this
report per the packet's same-change rule.

## PR-review addendum: soft-wrapped link labels (Greptile P1, fixed in-PR)

Greptile's review of PR #753 found a genuine coverage regression the equivalence proof
could not see: the retired parser matched `\[[^\]]*\]\(...\)` document-globally, so a
link label wrapped across lines (live instance: `docs/ROADMAP.md:195-196`, the
`oip-web-production-hardening` launch-runbook link) still matched across the newline.
The folded per-line parse skipped it. Outcome-level equivalence (0 findings vs
0 findings) was blind to this because a valid-but-uninventoried link produces no
finding either way — only deleting the target would have exposed the gap.

Fix: `RoadmapRefs` now merges soft-wrapped prose lines before link extraction — a line
ending in an unclosed `[label` absorbs following prose lines until the label closes,
with consumed-line tracking so a complete link sitting on a continuation line is
matched exactly once. The shared census parser is untouched (its per-line semantics
stay pinned by golden fixtures). The fixture pins both wrapped-label cases: dead
target → blocking finding; resolving target with trailing `(2/2)` snapshot → drift
advisory.

Lesson recorded in the ledger: equivalence proofs for scanner rewrites must compare
the parsed *inventory*, not just the emitted findings, when the corpus is currently
all-green.
