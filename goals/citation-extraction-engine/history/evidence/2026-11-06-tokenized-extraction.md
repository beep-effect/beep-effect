# Native Document text through the complete tokenizer and extraction loop

TokenizedExtraction connects existing default tokenization to the prepared
get_citations loop from eyecite 2.7.6 at
04d82c032ad5fd0f9ab72a61c87110c46ee8f52e (Free Law Project,
BSD-2-Clause). Callers supply native Document plain/markup text and optional
prepared geometry. They do not supply words, citation tokens or model results.
Cleaning, raw JavaScript input adaptation and the import-time joke shortcut
remain upstream entry duties.

The existing tokenizer supplies ordered mixed items, citation indices and token
snapshots. Text words materialize through the existing owned source slicer;
special words reuse the snapshot class, data, source start and capture groups.
Missing token identities fail closed. The resulting words/tokens enter the
existing loop, which constructs full/reference/generated models and applies
source filtering and ambiguity removal.

## Ownership and reuse

One existing metadata operation owns admission, Scope, captured deadline and
cumulative text budget across tokenizer installation, actual matching, word
materialization, constructors, reference generation and final selection. The
private child Context reuses the already-held operation permit and captures the
source timezone and edition owner. Native process admission is never replaced.
Child services remain inside the invocation and cannot escape it. The same
Context helper is shared with ExtractionLoop, without a new scheduler, worker,
lock, framing implementation or parser.

Upstream Schema owns configuration byte representation and detachment. Its
canonical codec roundtrip is shared by both compositions, with codecs hoisted
at module scope. Existing installers continue authenticating source programs.
Output structural validation preserves the loop's established returned-entry
identity relation. Methods retain R=never.

## Evidence

The smoke installs the complete authenticated catalog: 6,805 original extractors
and 2,533 edition records, including original captured hash/equality facts and
native compiler descriptors. Only documents differ between smoke and full
replay; no extractor or edition is removed to make the smoke pass.

Eight original get_citations documents replay on actual Bun and Node, covering
empty discovery, full/short/Id./supra/unknown/law/journal citations, generated
references and markup. Both runtimes match complete original pre-filter model
state, native token fields, metadata, spans, years, edition guesses, final ids,
warning pairs and returned-entry identity. Local numeric edition ids translate
through the same immutable edition references before comparison; no expected
behavior or source fixture changes. Physical exits are independently confirmed,
with zero active, queued, regex or quarantined work after completion.

Both runtime smoke tests pass in 63.06 seconds after shared-helper consolidation.
The complete 36-document replay is registered
under integration tests for hosted execution and remains pending. The original
source fixture, producer, seals and verifier remain unchanged. Shared loop setup,
model comparison and selection/identity assertions retain every prior assertion.

The first smoke installation correctly hit its deadline when catalog setup
accidentally used the real caller clock with the metadata fixture's 997ms policy.
It now uses the existing fixture's captured controlled clock, consistently with
the actual worker/stage setup; no production deadline or safety rule is changed.

Package lint/type checks, declaration emission, blocking package laws and
codec-compilation lint pass. Scoped clone/complexity scans are component evidence;
hosted verification of this wave remains pending.

## Hosted declaration repair

Fallow passes on preceding head b57ce2dece7710bd86f72ff04696f66b5747aa3f.
Its unit shards stopped during package build with TS2527: the loop's inferred
structural return exposed an inaccessible unique-symbol brand. The restored
result now has an explicit CitationExtractionLoopResult annotation. The new
composition likewise returns its named branded result type. Package declaration
emission passes; hosted confirmation remains required. This changes inferred
API emission rather than citation behavior or assertions.

Raw input cleaning/Document-to-native adaptation, the joke shortcut, public
service/Layer and semantic codecs remain open. So do general host/subclass/model/
alias behavior, complete canonical/donor accounting, whole-engine safety/scaling,
reflection and lifecycle adoption. All eleven representation laws, four fidelity
questions and fifteen unfinished proof rows remain open, without semantic waiver
or full-goal completion claim.
