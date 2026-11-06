# Native stop-word cleanup through the existing worker

The private StopWords stage now executes the pinned strip_stop_words ordering:
case-sensitive stop-word substitution to a space; leading In substitution;
Python whitespace trim; opening-only and closing-only parenthesis trim; selection
of the second semicolon component; comma/space trim; case-insensitive stop-word
substitution to empty; comma/space trim and final Python whitespace trim. Empty
output remains a native empty string, not None.

All three substitutions use the existing isolated regex-V0 worker and complete
nonempty finditer captures. Native ranges are concatenated by the existing
Unicode owner after reserving their exact receiving size. Captures must be
ordered and nonempty; failures return no partial text. Match quotas, frame limits,
process deadlines, independent retirement and quarantine remain the existing
worker's responsibility. No alternate regex matcher, transport or scheduler is
introduced. Native scalar/surrogate storage remains distinct throughout.

The existing native metadata boundary walk and frozen Python whitespace predicate
are shared with MetadataStrings rather than copied. Fixed-pattern ownership and
authentication are now shared through copyCitationMetadataPatterns in the
existing MetadataComposition module; CaseNameScan uses the same helper with its
unchanged five-pattern configuration and invalid-configuration boundary.

Installation snapshots and authenticates both raw native patterns plus the three
independent descriptors. Runtime, Clock, operation admission and process services
are captured; methods require no caller services. Each call receives a fresh
Scope and fresh or captured cumulative CitationTextBudget. Every receiving source
copy, native trim slice and concatenation charges that owner before allocation.
No default or absolute policy ceiling is changed. Tests explicitly use the
existing 8,192-unit pattern policy, as do the neighboring source-worker families.

## Source profile and replay evidence

The new producer runs against clean commit
04d82c032ad5fd0f9ab72a61c87110c46ee8f52e, tree
a35a58fac03400f71a93a93485b77f1d56f2b02f, CPython 3.11.15 and regex
2023.12.25 V0. Original parser trees independently establish the exact source
groups, names, minimum width, repeated-capture and nullable-repeat observations:
STOP_WORD_REGEX at flags 0/2 has two groups, stop_word group 2 and minimum width 1;
the leading-In pattern has no groups and minimum width 3. All are nonnullable
without repeated captures. Hash seeds 331/337 produce identical bytes.

| Artifact | SHA-256 |
| --- | --- |
| Pattern producer | 1de3bcee927496802de42a41449d2f03ca9f3c993d3387c963bc3f0824108c80 |
| stop-word-patterns.json | 98bdf393eb38077254b0a241767ef935ee4adaf04184c0d29b08565b1c5fa1ae |
| Existing processing corpus | 027c7f42d55d4fe9ee6f000c98c6427d4931f45bf82675277f60864762b51505 |

The existing independently sealed source processing corpus supplies all 178
cleanup outputs. Local smoke replays 14 selected cases per actual Bun/Node
runtime, including empty text, Unicode case, every semicolon shape, punctuation,
adjacent stop words and scalar/literal-pair/unpaired-surrogate controls. Each
runtime confirms all 42 worker exits and leaves zero active or quarantined
permits. Hosted integration is registered for all 178 inputs / 534 exits per
runtime; that full replay is not locally run.

The In Smith control reserves exactly 81 cumulative UTF-16 units, with the
expected native Smith output. Ceiling 81 succeeds, ceiling 80 refuses, and
ceiling 81 primed with one enclosing unit refuses at counter 77. Both refusals
occur after all three launched children are independently acknowledged. Caller
mutation of both installed pattern buffers does not change subsequent results.
Closed parent lifetime, captured 997-ms extraction deadline with a disabled
caller clock, and invalid null input all refuse before native child creation.

Nine focused tests across StopWords and CaseNameScan pass after sharing pattern
ownership. Four existing MetadataStrings tests also pass. Scoped package
lint/type verification and Oxlint pass, including the new fixtures and private
modules. Normal commit hooks apply. Hosted aggregate quality, full source replay,
raw-pattern family scaling, whole-engine resources and complete candidate-name
processing remain open. This is an internal helper, not public CitationEngine
composition or exhaustive engine parity.
