# Built-in full rendering and Id./supra formatting

Rendering.ts ports the actual corrected_citation_full overrides for full case,
short case, law and journal citations, the inherited matched-only method, and
the distinct IdCitation.formatted and SupraCitation.formatted operations.
These are schema-discriminated private server operations over native strings.
No function-valued request fields, client API or redundant semantic wire model
are introduced. Public Citation/Bluebook transform laws remain separate work.

## Exact source dispatch

CitationBase.corrected_citation_full returns matched_text directly. Resource,
FullCitation, CaseCitation, Id., supra, reference and unknown classes inherit
that implementation. It does not call ResourceCitation.corrected_citation.
Only the four overriding resource families apply reporter/page correction and
metadata assembly. Id./supra formatted are separate methods and use fixed
literal text independently of the matched text.

Law pin text has no added comma. Case/journal pin text adds comma-space. Law
publisher/month/day/year and case court/year join only truthy values with one
separator. Plaintiff and defendant are independently truth-tested. Case extra
text has no added separator. Whitespace strings remain truthy and untrimmed.
The source failure for a missing/None reporter with an edition guess retains
the existing closed invalid-reporter-replacement failure through composition.

## Existing Effect composition

The factory captures the existing frozen edition owner and Clock and returns
R = never. One fresh or installed invocation budget covers resource correction,
receiving native metadata, fixed punctuation and final concatenation. Caller
contexts cannot replace captured owners or the installed budget. Named modes
are schema data, and source variants contain only their read fields.

The existing ResourceCorrection factory supplies literal resource substitution.
The existing PythonUnicode owner copies/validates receiving words, and its
native range concatenator measures and reserves final output before allocation.
MutableList holds a small bounded number of assembly ranges. Native points stay
separate from display text, including adjacent surrogate points assembled from
different metadata/source pieces. Existing Effect timeout and schema-owned
allocation failures prevent partial publication. No worker or transport is added.

## Original source corpus

probe-citation-rendering.py verifies a clean oracle at commit
04d82c032ad5fd0f9ab72a61c87110c46ee8f52e, tree
a35a58fac03400f71a93a93485b77f1d56f2b02f, under CPython 3.11.15. It invokes
the original methods on actual source classes and authenticates the selected
canonical edition through the existing source normalizer. No source rendering
or correction method is replaced by a stub.

Each read metadata field takes None, empty and a distinct nonempty string.
The complete products contain 2977 metadata states across seven operations,
crossed with five source/group/edition bases: 14885 method observations. The
bases cover ordinary and corrected resources, literal-surrogate/scalar text,
source TypeError and empty-reporter insertion. Forty further observations
exercise the eight inheriting source classes. Nine native controls cover
adjacent surrogates across joined pieces, metadata surrogate pairs, literal
dollar/backslash text, scalar metadata and truthy whitespace. Total: 14934
original observations, compared locally without native child processes.

The corpus interns 774 exact native outputs in 212579 formatted bytes. Ternary
state ordinals encode only inputs; expected outputs are independently captured
source references. Replay verifies mode order, table lengths, each complete
product, index bounds and the complete file digest.

Producer SHA-256:
`252d72b85f6166b95e32563c071c494601b2eeb6afa470a38b0cfb66d1c6f335`.
Fixture SHA-256:
`1618224896d9db90bd057093169ebb18afa49c64627b445c580e2b7a7661dd20`.
Regeneration under PYTHONHASHSEED values 157 and 163 compares byte-identically.

## Boundary proof and remaining acceptance

The four new tests pass, including all source observations and a twenty-run
schema-derived matched-only identity property. The Id. control reserves exactly
fourteen units; thirteen refuses before final publication. Repeated calls get
fresh budgets and caller mutation of returned bytes does not affect later
results. An enclosing sixteen-unit budget primed with three units refuses with
ten units used, while a replacement caller budget stays uncharged.

Edition ownership remains captured under caller replacement. Id. formatting
bypasses deliberately invalid unread matched/resource fields even when the
captured edition source never completes. Journal rendering against that source
is interrupted by the captured 997ms deadline under a disabled caller Clock.
No partial rendered text is returned.

The complete focused regression wave passes twenty tests in four files across
rendering, resource correction, native Unicode and context assembly. Scoped
server lint/type checks, Oxlint, Effect-test/schema-first policy checks and
new-only Fallow pass with zero introduced findings. Normal commit/push hooks
remain enabled. The source replay split changes only test organization; all
14885 product rows, forty inherited observations and nine native controls run.

The adapter covers built-in native-string state, not arbitrary Python objects,
custom source protocols or public service lifetime integration. Complete case
metadata, document mapping, references/filtering, custom protocols, fresh-process
hashing, whole-engine accounting, public schemas/service/Layer, dispositions,
110 regex family safety/scaling reviews and exhaustive acceptance remain open.
Latest-head hosted validation remains independent proof. Broad local aggregate
verification and head-install preflight remain deferred under the operator's
hosted-CI publication instruction; normal hooks remain enabled.
