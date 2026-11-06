# Complete resource citation substitution

ResourceCorrection now implements the original ResourceCitation.corrected_citation
sequence: obtain matched text, replace every literal original reporter when an
edition guess exists, compute corrected_page from the original groups, and
replace every original page only when the corrected page is nonempty and differs.
Missing/None reporter values with an edition guess map the source TypeError to
the closed invalid-reporter-replacement failure. Empty reporters retain Python's
boundary insertion behavior. Groups and matched input remain unchanged.

## Effect and native Unicode ownership

The stage extends existing ResourceCorrection ownership and returns a method
with R = never. It retains the captured frozen-edition owner, Clock and text
budget. Each standalone call gets a fresh budget; an installed enclosing budget
cannot be replaced by a caller. Reporter/page processing shares that same budget
through private preparation functions. No additional service, worker, transport
or scheduler is introduced.

Effect String.replaceAll operates on JavaScript strings and replacement syntax.
Native Python words distinguish supplementary scalars from adjacent literal
surrogate points, so that helper cannot preserve this operation's source domain.
The existing PythonUnicode owner now provides literal native replacement.
Two cooperative scans enumerate nonoverlapping matches without retaining a
match list: the first measures exact canonical output, then the caller reserves
receiving units before any output buffer allocation, and the second writes the
native ranges. Empty search strings insert at every source-point boundary.
No JavaScript replacement templates or UTF-16 projections participate. Existing
range concatenation shares the same output-allocation helper. The search is
cooperatively interruptible, including comparisons inside a long candidate.
This is functional parity evidence, not a new unbounded runtime allowance.

## Original source corpus

probe-resource-citation-correction.py verifies the clean eyecite commit
04d82c032ad5fd0f9ab72a61c87110c46ee8f52e and tree
a35a58fac03400f71a93a93485b77f1d56f2b02f under CPython 3.11.15. It calls the
actual ResourceCitation method, without replacing corrected_reporter,
corrected_page or str.replace. Every canonical edition is obtained from the
actual pinned extractor inventory and identified by the existing source codec.

There are 1584 controlled method calls across 132 missing/None/empty/native group
states, three edition states and four matched texts, plus 2533 calls covering
every canonical edition. A separate full product supplies 2592 original
str.replace observations across eighteen native words and eight replacements.
Controls include repeated and overlapping candidates, empty text/search/output,
literal dollar/backslash text, mixed widths, lone and adjacent surrogates and
their distinct supplementary scalars. Output interning retains all observations
in a 746507-byte formatted corpus below the unchanged formatter ceiling.

Producer SHA-256:
`6b249ecd8dbb5e7b5e3a9f56a01f294f24356a54205d1c89c0927dd8b3f57b74`.
Fixture SHA-256:
`7094220a5b2222038ea336fa20ffbad4971b3123f0f7e2cfc7b3fcd35b6a9e47`.
Regeneration with distinct PYTHONHASHSEED values 149 and 151 compares
byte-identically after formatting. Fixture codecs bound every interned index
and table size before lookup and authenticate the complete file digest.

## Verification and remaining work

All 4117 original resource renderings, 2592 native replacement cases and the
earlier 5858 reporter/page method calls compare. Sixteen focused tests in three
files pass, including a schema-derived replacement identity property with fifty
runs, native Unicode and context concatenation. Exact whole-correction allocation is
33 units; 32 refuses without publishing. With an enclosing 34-unit budget primed
with two units, refusal retains 28 used units and leaves a replacement caller
budget untouched. Repeated calls get fresh budgets and caller mutations of
returned output do not affect subsequent output or original inputs.

The amplified empty-search control measures seven Python points, eleven UTF-16
units and 28 bytes before a ten-unit refusal. An adversarial 64000-point source
and 32001-point search is interrupted by the existing captured 997ms Effect
deadline under a caller Clock that never expires. Both reporter and complete
correction retain the captured edition owner/deadline. No partial output escapes.

Scoped server lint/type checks, Oxlint and the Effect-test policy pass. New-only
Fallow reports zero introduced findings after shared allocation and replay
refactors. The schema-policy advisory prompted the meaningful identity property
above; the final schema-policy replay is recorded separately from hosted proof.

This completes the private built-in resource substitution stage, not complete
corrected_citation_full formatting or public engine integration. Remaining case
metadata, references/filtering, custom protocols, fresh-process hashing,
whole-engine accounting, public service/Layer, dispositions, family safety and
scaling reviews, hosted proof and exhaustive acceptance remain open. Broad local
aggregate proof and head-install preflight remain deferred under the operator's
hosted-CI publication instruction; normal hooks remain enabled.
