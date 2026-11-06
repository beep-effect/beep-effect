# Source positional and scoped case flags

The existing structural compiler now handles inline ignore-case enable/disable
directives and scoped case groups through its existing frozen point sets. Raw
native pattern bytes and sourceFlags remain unchanged for descriptor identity;
the renderer adds no native ignore-case mode or capture. No worker, transport,
admission mechanism or matcher is added. Other inline flags and previously
unqualified Unicode literal folds remain open.

The pinned regex 2023.12.25 V0 engine applies positional case flags to subsequent
atoms, with restoration on leaving the enclosing group. The source pattern
`a(?i)b` matches aB but not AB. In `(a(?i)b)c`, b is folded and c is not. Scoped
`(?i:a)b` folds a only; `(?-i:a)b` under outer flag 2 restores case folding for b.
Alternative branches inherit the parser's current state in source order.

CPython 3.11 accepts an unscoped enable directive only at the pattern beginning
(with allowed verbose whitespace/comments and preceding directives). Nested or
post-atom positional directives and unscoped disables remain errors; scoped
enable/disable groups are supported. V0 accepts positional disables as well.
Both reject conflicting on/off flags and malformed delimiters. Escaped directive
text, character-class contents and verbose comments do not change case state.

V0 permits a directive between an atom and its quantifier: in `a(?i)*b`, the
repeat applies to the original case-sensitive a atom. The sequence parser consumes
directives before reading the repeat without refolding emitted atoms. Internal
verbose-token skipping remains separate, so inline directives cannot be consumed
inside escape digits or capture names. Flag runs yield cooperatively every 256
source points under the existing captured timing and pattern ceilings.

## Original-source evidence

The producer requires clean eyecite commit
04d82c032ad5fd0f9ab72a61c87110c46ee8f52e, tree
a35a58fac03400f71a93a93485b77f1d56f2b02f, CPython 3.11.15 and regex
2023.12.25 V0. It captures 35 patterns, 70 original parse/profile outcomes and
3,474 matching-mode observations. PYTHONHASHSEED 313/317 produce identical bytes.

Profiles come from each engine's actual parser tree. The CPython profile reader
distinguishes capturing SUBPATTERN nodes from scoped-flag SUBPATTERN nodes whose
group number is None. Thus `(?i:a)+b` does not falsely claim repeated captures.
Every profile is compared to the target, including source syntax failures.

| Artifact | SHA-256 |
| --- | --- |
| Producer | f5d4d41a50a4fe89040687d726d153de0572bd758d7acb06bf09ea6e8c0118c1 |
| regex-case-flags.json | 717cb46cac6ebef29949a59998fd873275b8c3dc9094843a58c9fdc4aa94fd6d |

Local smoke replay uses the existing actual Bun/Node process supervisors and
shared source-capture assertions. Each runtime executes 17 CPython and 35 V0
requests, with all 52 child exits independently acknowledged and zero active or
quarantined permits. Thirteen focused tests across case flags and the existing
regex-program suite pass. Scoped package lint/type verification and Oxlint pass.
The final cooperative-yield refactor preserves the tested state transitions.
Normal commit hooks also apply. The complete hosted integration requires 1,234
CPython and 2,115 V0 requests per runtime; it is registered and not locally run.

The full repository effect-vitest policy scan reports two findings in
technical-drawing/test/Generate.check.test.ts and codegen-kit/test/CodegenKit.test.ts.
Both files match origin/main exactly; neither is changed in this PR. This is an
inherited failing policy receipt, not a whole-repository pass. The post-commit
divergence audit passes after regenerating the seal from formatted plan bytes:
11 representation laws, four fidelity questions and 15 unfinished proof rows.

Nullable finditer advancement remains unqualified and is excluded by the existing
shared replay rule. Parser/capture success does not establish raw-pattern safety,
family scaling, complete inline-flag grammar or whole-engine parity. Candidate
processing, stop-word substitution and public engine composition still need
their source-backed target implementation and resource proof.
