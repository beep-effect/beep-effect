# Original final filtering and parallel inheritance

The extraction path now projects actual full/reference constructor results into
borrowed selection facts: original local model id, built-in family, Python-point
span/full span, matched text, parenthetical and edition presence. The projection
is internal and grants neither persisted CitationId nor verified mention authority.
Both existing constructor replays compare these projected spans to the original
source spans on actual Bun and Node.

ExtractionSelection reuses Effect operation admission, captured timing, Unicode
ownership and parent text reservations. Effect HashMap retains the last model for
each equal span while an explicit first-occurrence ordinal preserves Python dict
slot order. Effect Array sorting and Order.Tuple preserve stable lexicographic
full-span ordering. Original reference replacement, reference suppression,
short-before-supra suppression, parenthetical containment, full-case overlap and
unknown-overlap warning branches are retained. Disambiguation removes resource
citations without edition guesses while keeping non-resource citations.

The result contains retained original model ids and source-free warning id pairs.
It does not serialize a second citation model or render source-containing warning
messages. Input candidate count, aggregate copied text and substring comparison
work are bounded before publication. Python-point substring comparison preserves
literal surrogate pairs separately from non-BMP characters; a JavaScript text
projection would collapse that distinction. Comparison loops yield, charge the
captured resolutionIterations ceiling and return no partial selection on refusal.

FullExtraction now applies parallel inheritance to newly constructed full-case
state. Equal full_span_start values, including two None values, copy plaintiff,
defendant, textual year and numeric year from the preceding full case. Other
metadata, token and edition references remain unchanged. This functional update
preserves immutable internal constructor values; general reflected mutable-model
and alias behavior remains an acceptance requirement.

## Original source observations

The producer invokes unchanged helpers.filter_citations, disambiguate_reporters
and FullCaseCitation.is_parallel_citation on real built-in original model objects.
Seeds come from actual get_citations. Controlled original model fields exercise
all 64 ordered family pairs for overlap and another 64 for duplicate spans,
empty input, stable ties, first-slot/last-value behavior, reference chains, edition
presence, empty/inverted/negative spans and Unicode/empty parenthetical cases.
There are 148 selection cases and 56 observed unknown-overlap warnings. The
producer retains original object ids and confirms filtering does not mutate the
input models. Empty-input list identity is recorded as source evidence; the
private target returns selected ids rather than a model list.

Sixteen original parallel transitions cover equal/different None, zero, positive
and negative full-span starts. The complete prior state is unchanged and return
is None in every original call. Target assertions apply these transitions to
connected full-case constructor results without another native child.

Source is clean eyecite 2.7.6 at 04d82c032ad5fd0f9ab72a61c87110c46ee8f52e,
tree a35a58fac03400f71a93a93485b77f1d56f2b02f, CPython 3.11.15. Source files,
license, lock and dependency identities are sealed. Two hash-seed captures match;
nine structural corruption controls and exact pinned-source replay pass.

- Producer SHA-256: b5ed0e1b3f65abc1e926d4c5e04c9c81ea791125e59ff4b59c1fa3ae4a5a3512
- Corpus SHA-256: 0b3f8384253f42427484e0ce7c92b9c659a69d2c18ab0cbaddac4ed4d6a85df4

## Target verification and limits

All 148 original selection cases match retained ids, order, disambiguation and
warning pairs. Duplicate ids, candidate exhaustion and comparison-work exhaustion
refuse with closed source-free errors and release operation admission. Existing
full/reference replays verify that selection facts come from actual constructor
outputs. Package lint/type checks pass. Scoped package law checks report no
blocking findings; codec compilation lint passes. Isolated cognitive checks find
no new function over eight. Estimated CRAP output lacks the full coverage graph
and is not hosted qualification.

An initial parallel replay caught schema construction copying the existing token
object. The functional update now spreads validated internal state and preserves
the exact existing token reference; source-derived state and non-mutation checks
remain. Final replay results are recorded below after verification.

The whole get_citations loop, generated named/markup references, complete Document
integration, general host/subclass/alias behavior, public service/Layer, semantic
and Bluebook codecs, exhaustive source/donor accounting, whole-engine safety and
scaling, reflection and lifecycle adoption remain open. No canonical completion
row or representation/fidelity proof is promoted by this focused evidence.

Final selection/full/reference regression passes all five tests across three files
in 12.33 seconds. Complete constructor replays still acknowledge exactly 91 full
and 94 reference children per runtime; projection and parallel assertions require
no additional child. Package lint/type checks pass in 0.4 and 1.9 seconds. Hosted
proof remains pending because workstation GitHub SSH and HTTPS connections time
out; this evidence does not claim publication or CI success.
