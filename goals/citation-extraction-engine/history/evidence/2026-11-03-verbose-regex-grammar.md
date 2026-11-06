# Verbose grammar for both pinned source engines

The producer verifies clean eyecite commit
`04d82c032ad5fd0f9ab72a61c87110c46ee8f52e`, tree
`a35a58fac03400f71a93a93485b77f1d56f2b02f`, CPython 3.11.15 and regex
2023.12.25 V0. It executes both original compilers and all three matching
operations, retaining source error messages/positions and exact native spans.
CPython parser trees and regex V0's original parser trees supply independent
profile facts. No target parser is used to create expected results.

There are 47 patterns, 94 engine/pattern outcomes and 450 source matching
observations. The outcomes retain nineteen source errors, two parser-only
repeated-capture profiles, 71 single-match profiles and two unfinished fuzzy
profiles. Every parse/profile or closed rejection is compared locally.

The existing compiler and typed worker now share source flags 0, 2, 64 and 66.
Raw pattern bytes and fingerprints remain unchanged. Verbose skipping happens
at grammar-specific positions, not through whole-pattern whitespace removal.
CPython uses its six ASCII whitespace characters; V0 uses the separately
captured 29-character lexer predicate. Spaces/hash inside character classes
and escaped spaces/hash remain literal. V0 can skip inside numeric bounds,
capture names and outside-class hexadecimal escapes; CPython preserves its
stricter grammar there. Lazy-suffix and atomic group-header rules remain
engine-specific. A backslash/newline can extend a CPython comment, while V0
ends its comment at that newline. Escaped non-ASCII literal fallback is
preserved, including a directly observed escaped NBSP.

Source inspection also exposes fuzzy constraints in V0. Their reserved brace
prefixes now fail explicitly instead of being miscompiled as CPython literal
braces. They remain required unfinished grammar. A negative control supplies
CPython literal metadata for the same bytes and verifies V0 rejection before
spawning, followed by zero active admission and no quarantine. The canonical
tokenizer artifact decoder retains its independently captured 0/2 flag domain;
it is not widened merely because the shared worker supports verbose flags.

Local proof: 29 tests across five files pass, including the complete original
profile/error comparison, actual Bun/Node matching, raw ignored-pattern budget
refusal and recovery, existing compiler/protocol controls, source-engine
controls and a canonical tokenizer smoke. Each verbose runtime smoke confirms
fifteen CPython and twenty-three V0 independent child exits. Fixed counts
require all selected rows, not counts derived only from completed work.

Hosted integration requires every admitted source case and mode: 190 CPython
and 216 V0 independently confirmed exits per runtime (406 total). Positive
width profiles include finditer; nullable profiles retain only the qualified
single search/match operations. All original finditer source observations
remain in the corpus, including unfinished profiles. Full hosted replay is
pending and is not run locally.

Producer SHA-256:
`c86c958858149b6b74f8b8b594e72123e65da2b1a71eeaac1ab8a806452834a1`.
Formatted corpus SHA-256:
`58ca7328f4c5db3d1a2d237ea047f05afe457076d88333e79397bc5e24fa47b9`.
Repeat capture under PYTHONHASHSEED=137 is byte-identical after formatting.
The corpus is authenticated before decoding. Quick server lint/type checks,
scoped Oxlint, staged new-only Fallow and both policy checks pass, with zero
introduced findings and no new policy exceptions. No floor is reduced.

Attribution: verbose lexical adaptation follows CPython re (covered by the
retained PSF notice) and regex/_regex_core.py. The regex package's complete
LICENSE.txt is retained unchanged in this directory with SHA-256
`bff55ef4cdcc8c14ce259f8e8ab60e264418440d6335f4dc138273fbd506144d`.
It identifies Apache-2.0 additions and alterations and retains the Secret Labs
AB/CNRI Python 1.6 legacy notice. THIRD_PARTY_NOTICES.md identifies the scope.

A subsequent actual-helper admission probe under V0/flag 64 compiles
POST_LAW_CITATION_REGEX (six groups, minimum zero) and YEAR_REGEX (one group,
minimum four), with neither repeated captures nor nullable repeated bodies.
POST_FULL_CITATION_REGEX reaches the default raw-pattern ceiling; POST_SHORT,
PRE_FULL, POST_JOURNAL and SUPRA_ANTECEDENT still require additional grammar.
No resource ceiling is raised for this probe. Metadata execution/composition,
remaining grammar/folding, nullable iterator advancement, family safety/scaling
and public CitationEngine integration remain required. This checkpoint adds no
semantic waiver or canonical full-parity completion row.
