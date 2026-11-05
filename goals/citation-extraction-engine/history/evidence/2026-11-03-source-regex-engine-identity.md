# Explicit source regex engine identity

Source baseline: clean eyecite commit
`04d82c032ad5fd0f9ab72a61c87110c46ee8f52e`, tree
`a35a58fac03400f71a93a93485b77f1d56f2b02f`, CPython 3.11.15 and regex
2023.12.25 with DEFAULT_VERSION=V0. The producer verifies these identities and
records the actual installed _regex_core.py SHA-256. No regex implementation
source or binary is copied into the target.

`RegexEngine.ts` names python-re and python-regex-v0 independently of Bun/Node.
The selected engine is captured by the point-set factory, compiler, descriptor
registry and worker. Existing callers retain the CPython default. Each child
startup now requires an explicit known engine; missing and unknown values fail
closed. The parent and child compile and bind using the same captured engine.
The typed Effect RPC job, shared admission, process owner and retirement
machinery are reused. No raw request receives an engine-selection field.

The producer surveys all 1,114,112 Unicode points for each regex V0 category,
and checks the projected class body against the source engine over that same
universe. Observed memberships are 680 digit points (64 intervals), 25 space
points (10 intervals), and 140,234 word points (772 intervals). A separate
all-point Source.get survey captures 29 verbose-ignored whitespace points;
these must not be replaced by the 25 matching-space points. CPython retains
its prior category tables and six ASCII verbose whitespace characters.

The all-point ASCII-insensitive predicate survey finds 132 candidates. All
128 ASCII literal folding rows are captured. Every one of 8,256 inclusive
ASCII ranges is checked against the source engine over those candidates:
1,089,792 range membership observations. The target compares the complete
bit matrix and cardinality, rejecting target points outside the candidate set.
The source's lowercase i and uppercase I rows remain distinct. Literal rows
are stored as bounded JSON and decoded through Effect Schema, preserving their
actual observations without inferring equivalence from similar numeric rows.
No duplicate-code suppression or analysis threshold changes are introduced.

Local proof: 38 tests across five files pass. The tests compare every source
category interval and all ASCII range observations, exercise every source-engine
startup identity and reject missing/unknown child identities. Actual Bun and
Node children distinguish combining marks, U+001C whitespace, U+11F50 digits
and dotted/dotless I. Each runtime confirms five independent exits per engine,
with admission at zero and no quarantine. Existing nullable, worker lifecycle,
protocol and compiler tests remain passing. Quick server lint/type checks and
scoped Oxlint pass. Staged new-only Fallow has zero introduced findings.

Producer SHA-256:
`718ee492ff49aad339482d3c370f22c7dcca1371596cd1dacd0fd1f8223b997e`.
Formatted corpus SHA-256:
`277930887d3a604f8befe7f1e19c26d69aaca1459a648b5a48b187c941fcec1f`.
Formatted data module SHA-256:
`40336619649b52c97c7ff40950c81f8fae2a88fc666e75923b33c68d580fab4a`.
The test authenticates corpus bytes before decoding. Repeat production under
PYTHONHASHSEED=137 produces both formatted files byte-identically.

Policy review: the schema-heavy consumer test uses fixed source observations
and checks both engine literals exhaustively, including malformed startup.
Randomly generating the same two values adds no codec coverage. Its
SFV4-arbitrary-tests exception is owned by @beep/law-practice-server and exits
when the detector recognizes finite exhaustive consumer laws or the startup
codec gains a larger generated input domain. No resource exception is added;
tests reuse the existing narrow filesystem/path/spawner/digest layer.

Proof limits: the source category survey and target interval comparison are
exhaustive within their stated domains; actual native worker comparisons here
are discriminating controls, not a full compiled V0 matching corpus. Non-ASCII
ignore-case literals, repeated captures, other flags/versions and unsupported
grammar remain unfinished. Verbose flag 64 is still rejected by the current
compiler. The engines differ in verbose grammar as well as character facts:
regex V0 accepts spacing in constructs that CPython rejects or treats as
literal text. Its parser must be implemented from independent observations,
not by relabeling CPython behavior. Metadata/pincites, tokenizer/context
composition, family safety/scaling and public engine integration remain open.
No canonical full-parity row or semantic waiver advances.
