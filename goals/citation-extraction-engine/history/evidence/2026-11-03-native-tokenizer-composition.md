# Owned native tokenizer composition

`Tokenizer.ts` now connects existing source ordering, constructor recipes, native
regex worker, raw capture binding, token objects, literal-space gaps and mixed
assembly in one admitted tokenizer invocation. It captures the existing operation
admission service; native supervision continues to use the existing Effect RPC,
ChildProcessSpawner, Scope and independently acknowledged retirement owner.
No replacement transport, concurrency manager or worker lifecycle is introduced.

Schema-owned configuration requires consistent extractor ordinal, flags and
pattern identity across ordering, recipe and descriptor metadata. Installation
owns native pattern/selector buffers, recipe arrays, profile names and edition
facts. Duplicate ids and conflicting profiles fail. Pattern hashes and compiler
profiles are still independently checked by the existing worker descriptor owner.
The result is a schema-first private native source/assembly/token-snapshot plan,
not a public CitationEngine result or verified mention evidence.

An outer captured operation/extraction deadline spans the entire invocation.
A single TxRef transaction counter reserves produced UTF-16 units for every
captured token field and every plain-text gap before materialization/planning.
The token store retains its existing candidate guard. Remaining raw-match and
candidate capacity is passed to each worker, including zero-capacity complete
no-match evaluation; overflow fails instead of silently truncating. Assembly
retains the combined text/special-token ceiling. All state is new per invocation;
failure returns no partial plan and operation admission is released after cleanup.
The prepared source's new measure method uses the same validated bounds and
captured timing as slicing and projection, without allocating substring payloads.

## Independent source observations

Pinned eyecite 2.7.6 commit `04d82c032ad5fd0f9ab72a61c87110c46ee8f52e`, tree
`a35a58fac03400f71a93a93485b77f1d56f2b02f`, executes under CPython 3.11.15 with
PYTHONHASHSEED=0. The producer runs actual AhocorasickTokenizer selection,
TokenExtractor.get_token, built-in construction, merge/overlap handling and
Tokenizer.tokenize. The controlled source EXTRACTORS global is temporarily
installed while building the source selector, then restored: this source class
reads the global rather than the constructor's supplied list when building its
filters. This is explicit controlled-source setup, not a claim about default
canonical or custom-constructor behavior.

Twenty cases produce 44 candidates across seven controlled built-in extractors:
IdToken, SupraToken, ParagraphToken, SectionToken, StopWordToken,
PlaceholderCitationToken and generic Token. Two distinct classes share an Id.
pattern, exercising source set ordering and stable overlap behavior. Cases cover
empty/no-match text, repeated and adjacent tokens, spaces, tabs/newlines,
case-insensitive selection, scalars and literal surrogate words. Source native
words, token identities and mixed output order remain distinct from JS projection.
This corpus deliberately contains no CitationToken edition merge scene; that
stage's earlier independent merge/assembly controls remain separate proof.

Producer SHA-256:
`a80fb747b64ec2b4835e61742c82e2323dd51524acf8620ff0382e236bc417d1`.
Fixture SHA-256:
`35cdbf03cfccfd839f2119d658ac42c237f9cf720a02961ade8a2fb27c1163bf`.
Repeat capture is byte-identical after canonical formatting.

## Focused and hosted proof

Eleven focused tests in four files pass, including existing native slicing,
raw capture and mixed assembly controls. Real isolated matching now exercises
three source cases and a metadata-ownership replay under both Bun and actual
Node, with seven independently confirmed child exits per runtime. Separate
controls exhaust aggregate raw matches, aggregate candidates, produced text only
when plain gaps follow retained token fields, and mixed-output tokens. They check
failure cleanup, independent child exit, fresh invocation state and rejection of
incoherent/duplicate configuration. Server lint/type checks and scoped Oxlint pass.
The staged new-only Fallow audit passes with zero introduced findings after moving
metadata coherence into its executable schema and sharing native range validation.
No coverage floor, production exclusion or diagnostic suppression changes.

Functional native matching uses the existing controlled 997ms regex Clock and a
separate real cleanup window, within the unchanged absolute deadline ceilings.
It does not claim cold-start timing. Existing entered-child deadline/cancellation/
quarantine tests remain the independent lifecycle proof.

Hosted integration requires all twenty source cases under both runtimes and all
35 independently confirmed process exits per runtime. It has not run locally.
The narrower native tests above are not substituted for that hosted obligation.
Final policy rechecks and hosted results belong to the newly pushed head.

Full canonical CitationToken/edition composition, the second source configuration,
shared cleaner-to-extraction accounting, complete native-work accounting,
custom object/constructor/mutation protocols, source-family safety/scaling,
public tokenizer projection, CitationEngine Layer and exhaustive goal accounting
remain open. This checkpoint closes a private composition gap without promoting
those unfinished obligations or introducing a semantic waiver.
