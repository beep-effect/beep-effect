# Independent corpus label protocol

Version: semantic-reference/v2, 2026-10-28. P2 labelling remains incomplete.
No attorney agreement or accuracy result is claimed.

## Purpose and source eligibility

The reference measures the structure recovered by the deterministic system
from real claims. It must not reproduce the system's shortcuts. The schemas
define representable reference structure; P2-DESIGN defines implementation
rules, not gold answers. Earlier heuristic-conformance drafts are preserved
under `history/label-conformance-drafts/` and excluded from semantic scoring.

`positive-sampling.json` freezes 60 source proposals selected without
predictions, by CPC quotas and stable source ordering. It is not a statement
that all 60 qualify. Each family requires verified publication/application
identity, native XML digests, a real numbered §112(b) or second-paragraph
rejection, and the claim text in force at its mail date. Compare examiner
phrases to the same numbered native claims and investigate every material
original/native wording or dependency conflict. Complete inventory chronology
alone is insufficient. Original OCR is corroboration only; never repair OCR
into a reference. An unresolved version, merged-number claim or invalid root
does not become an accepted positive. Preserve the evidence and replace an
ineligible source in the same stratum without inspecting predictions.

## Independence and bounds

- Extractor and critic use separate GPT-6.1-Sol medium sessions. They receive
  exact source claims, context, provenance, this protocol and the schemas.
  They must not inspect implementation rules, predictions or synthetic rule
  fixtures when deriving semantic references. Prior conformance drafts are
  not starting gold; derive fresh annotations from source.
- Helpers may locate manually selected quotes, validate schema/span coherence
  and compute digests. They must not call, copy or reimplement a decomposer.
- At most three extractor/critic rounds per family. Acceptance requires both
  confidences at least 0.95, no remaining actionable critic finding and valid
  schema/source spans. Genuine source or annotation ambiguity stays explicitly
  unresolved for attorney review. Confidence is not attorney agreement.
- An unsupported input transition or parser failure is implementation
  coverage, not automatically reference uncertainty. Label a clear source
  directly as a ClaimElementTree without fabricating PatentClaim fields.

## Annotation conventions

Use canonical `claims.json` text exactly: XML entity decoding, claim-text
boundary spacing, printed-number removal and whitespace normalization only.
All anchors are half-open JavaScript UTF-16 offsets into that exact text.
Do not change wording, dependency alternatives or spelling to improve a match.

1. Identify the claimed subject and substantive limitations from the source's
   grammar and explicit enumeration. The root is the preamble subject before
   the main transition; do not choose an incidental earlier `comprising` or
   `having`. Dependent preambles retain their actual subject and dependency
   wording. Trim boundary whitespace and delimiting punctuation consistently.
   Preserve meaningful internal punctuation. Use paths `<n>`, `<n>.a`, etc.,
   in source order; nested explicit lists use `.i`, `.ii`, etc. Semicolons and
   colons are evidence of grouping, not automatic semantic boundaries.
2. Annotate determiner-bearing noun phrases with complete lexical heads and
   exact surface anchors. Heads are lowercase, trimmed and single-spaced;
   preserve meaningful hyphens, possessives, numerals and quoted compound
   names. Do not impose a token cap or stop-word/participle list. For example,
   `a through hole` is a term and `a “end of process” signal` must not become
   `a “end`. Exclude trailing predicates, relative clauses and parenthetical
   reference numerals from a term unless they are part of its lexical name.
   Separate nested determiner phrases into nonoverlapping terms (for example
   `a portion` and `the housing` in `a portion of the housing`). Resolve an
   uncertain lexical boundary through the critic, then the attorney if needed.
3. Use the schema's determiner surfaces; retain explicit possessive/bare
   referential phrases when they identify a claimed entity. Do not invent
   implied words. A missing introduction is not an invented antecedent edge.
4. Add `part-of` for nesting and `depends-on-element` from the actual natural
   dependency wording, including alternatives/ranges. XML idrefs are a source
   proposal and cannot override the claim. Add `antecedent` only where the
   referring phrase has an unambiguous introduction in this claim or its
   dependency ancestors. Preserve cross-claim references allowed by the schema;
   do not restrict gold to the implementation's same-claim exact-head rule.
   Record unresolved or genuinely ambiguous references separately.
5. Explicit functional relationships may use the schema's functional-relation
   element and ordered, anchored functional parts when their boundaries and
   term ownership are clear. Do not infer unstated function, construe claims,
   or perform §112(f) analysis. Deferred implementation support remains visible
   as unrecovered reference structure; it does not justify removing clear
   source structure from gold. Chemical/Markush analysis remains out of scope.

### Entity mentions and functional connecting language

Granularity clarification, 2026-10-28 (`entity-mentions/v1`). This convention
is independent of production rules and applies uniformly to all references.

- Keep determiner-bearing noun phrases as terms even when abstract or used
  adverbially. For example, `a manner` in `in such a manner as to` is retained;
  do not infer an antecedent between repeated manners without source evidence.
- A relative pronoun introducing a modifying clause (`which`, `that`, `who`)
  remains anchored functional connecting text when its governing entity is
  already an explicit participating noun phrase. It does not require a second
  term merely because the clause refers to that entity.
- Reciprocal language (`one another`, `each other`) expressing a mutual
  relationship among explicit participants remains anchored functional text.
  Preserve the participants and complete reciprocal relationship; do not turn
  the relation operator into an additional claimed entity or invent members.
- Lexical bare noun phrases, possessive phrases and standalone entity-reference
  proforms such as `thereof` remain eligible terms under rule 3. Analyze their
  actual referent; their spelling alone does not establish a unique antecedent.
  If a pronoun supplies the only explicit entity mention needed by a relation,
  rather than linking already represented participants, record and adjudicate
  that source-specific case instead of applying a blanket pronoun rule.

The schemas permit multiple representations, so representability alone does
not make a missing extra pronoun node an error. This fixes the reference
convention; it does not omit substantive source structure or change the
strict primary metric. A targeted consistency audit records affected prior
references and keeps all previous review receipts.

### Head normalization

Head clarification, 2026-10-28 (`lexical-head/v1`). The schema describes the
head noun phrase without its outer grammatical determiner. The `bare` tag is
also used for unsupported determiner surfaces; it does not mean that every
word of its quote must become a head word.

- Remove outer pronominal determiners in the normalized head, while retaining
  the complete source anchor: `its circumference` has head `circumference`;
  `their respective first ends` has head `respective first ends`. The same
  grammatical rule applies to demonstrative determiners such as `this` in
  `this process`. Do not remove substantive modifiers such as `own`.
- Preserve explicit lexical genitives: `rover unit’s virtual rotation` retains
  that owner phrase in its head. A standalone reference proform such as
  `thereof` keeps its own lexical surface; it is not an outer determiner.
- Preserve meaningful cardinal counts, minimum bounds, ordinals and partitive
  selectors not encoded by the supported determiner tag. Thus bare
  `at least two pins` has head `at least two pins`, and bare `one pair of sides`
  retains `one`. The supported `at-least-one` tag already encodes its opening
  `at least one`/`one or more` surface, so that opening is absent from the head.
- These are grammatical/lexical conventions, not a token cap or generic
  stop-word rule. They never license shortening anchors, inferring an owner,
  selecting a member, or fabricating an antecedent. Genuine lexical boundary
  uncertainty remains a source-specific review concern.

Prior disagreements solely about retaining a pronominal determiner in a
`bare` head are underspecified under the earlier wording, rather than
retroactive proof of a semantic error. Keep their receipts and apply this
clarification consistently; no production behavior is used to select it.

Set `producer` to `llm` for agent-proposed reference trees. Producer metadata
and ordinal path spelling are not semantic accuracy; evaluation compares one
consistent node mapping, element kinds, exact spans, terms and typed edges.

## Artifacts and review

Each family retains `claims.json`, `source.claims.xml`, `provenance.json` and
`source-audit.json`. The extractor writes `expected.json` (resolved trees in
claim order) and `extractor.json`: protocolVersion, familyId, role, model,
effort, round, confidence, resolvedClaimNumbers, unresolved items with exact
quotes/reasons, source/family concerns and annotation rationale. Each selected
claim must appear exactly once as resolved or unresolved; context is not
silently added to the score scope.

The critic writes `critic.json`: protocolVersion, familyId, role/model/effort,
round, confidence, verdict (`accepted`, `changes-required`, `unresolved`),
reviewedClaimNumbers and concrete findings with exact evidence/corrections.
Audit every element/term, full lexical head, anchor, typed edge, dependency,
family membership and source/rejection association. Preserve previous-round
receipts. Valid schema shape alone does not establish a correct annotation.

After independent references stabilize, select about 10% of families without
predictions for actual attorney review. Supply source text, provenance, trees
and unresolved points. Record actual agreement and revisions; agents cannot
supply the human verdict. Adjudicate allowed-claim hits on a separate
probability sample before estimating false positives and their interval.

Report source exclusions, unresolved gold, normalization failures and
decomposition abstentions separately. Keep implementation failures in the
frozen end-to-end denominator. Primary strict structural equality is reported
overall and per rule; typed-edge F1 is diagnostic only. Poor recovery is a
result to report, not permission to simplify gold or expand implementation.

## Operator authority amendment — 2026-10-31

For current completion, mandatory attorney escalation above is superseded by AUTONOMOUS-ACCEPTANCE-v1.md. Use separate independent automated reviewer sessions, preserve frozen reference labels, retain bounded unresolved outcomes and distinguish automated authority from actual attorney agreement. The original reference-derivation receipts and all prior review requirements remain historical evidence.
