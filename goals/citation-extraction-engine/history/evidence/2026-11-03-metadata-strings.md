# Native metadata string helpers — 2026-11-03

`MetadataStrings.ts` adapts clean_pin_cite and process_parenthetical from the
pinned helpers.py. It reuses native input preparation, slicing, the context
matcher and the existing Effect RPC worker. Methods accept only native text or
null and require no services. No host regex, host Unicode classification or
new process transport implements the year-prefix check.

## Source evidence

`ops/probe-metadata-strings.py` verifies the clean official commit
04d82c032ad5fd0f9ab72a61c87110c46ee8f52e and tree
a35a58fac03400f71a93a93485b77f1d56f2b02f, CPython 3.11.15 and regex
2023.12.25 V0. Both actual helpers execute unchanged. Its recording wrapper for
re.match delegates to the original function and retains whether the source
reached YEAR_REGEX. The exact pattern and wrapped descriptors are authenticated
against the previous independently captured context-matches.json SHA-256
4b91de078a8cd6fedcd2c01fb98f3ef525497d207340265f4ff1318b5cea564d;
the pattern is also compared directly with the imported source YEAR_REGEX.

The corpus has 997 cases, including 32 smoke cases. It covers null versus empty,
comma/ASCII-space trimming, all ASCII boundary characters, every Python
whitespace point, all 680 source regex decimal points, all 128 Python nondecimal
digit characters, balanced/nested/unclosed/extra closing parentheses, new
Unicode digits, scalar versus literal-surrogate words, and 299/300/301-point
boundaries. Original source search routing is retained: 989 year searches over
the full corpus, and 25 over smoke controls.

Producer SHA-256:
`078d4f0a68603358e7a1e33baa3c24a4508520935df90a5ed65f8dddf82723d5`.
Formatted metadata-strings.json SHA-256:
`56475991c824e6202938aa0ebde016f2e9682be9f5a0d37f3d9bb5b8eee138a1`.
Repeat capture under PYTHONHASHSEED=41 and formatting compare byte-identical.

## Observable behavior and ownership

Pincite cleanup strips commas and ASCII spaces only; it retains empty native
text rather than converting it to null. Parenthetical processing counts native
source points. Its first unbalanced closing parenthesis returns the preceding
text, or null for an empty prefix, before any year check. Thus `2020) extra`
returns `2020`, while a balanced string beginning with four source regex digits
returns null. Remaining empty text returns null. The existing worker checks the
exact YEAR_REGEX with its original verbose flags and source engine identity.
The standalone-prefix context route preserves inputs longer than 300 points.

Slicing preflights owned input plus output units. The year route preflights
owned input plus the context matcher's prefix, context and worker copies before
matching. Three units require twelve aggregate units; limit eleven rejects
without a child, while exactly twelve succeeds. Early-return slicing remains a
distinct route with its smaller allocation requirement. Returned buffers are
owned, and mutation does not affect subsequent calls. This is stage accounting;
whole-extraction composition must still carry allocations across stages.

Both operations retain captured extract deadlines under a caller Clock whose
sleep never completes. Long native input is interruptible and no child is
spawned by these deadline controls. Native errors do not become partial success.

## Validation and remaining proof

Seventeen focused tests pass in five files: MetadataStrings, MetadataYear,
ContextMatcher, RegexNullable and RegexVerbose. Every one of the 997 pincite
results compares locally. The 32 parenthetical smoke results compare under
both actual runtimes with exactly 25 spawned and independently acknowledged
exits each. Allocation, recovery, output ownership and both captured deadlines
are additionally checked. Shared test service provision now uses an upstream
Effect Context rather than duplicated Clock/admission/spawner setup. Server
quick lint/source-and-test checks pass.

Full hosted replay requires all 997 parenthetical outcomes and exactly 989
spawned/confirmed exits per runtime, with a bounded twenty-minute test timeout.
That new-head hosted result remains pending. This checkpoint does not claim
law metadata assignment, whole-engine allocation integration, document span
verification, remaining helper grammars, family safety/scaling or full parity.
Trusted YEAR_REGEX installation remains the final live Layer's obligation.

Scoped Oxlint, new-only Fallow (zero introduced dead code, duplication or
complexity findings), both policy checks, deterministic regeneration and the
portable divergence audit pass. No new Effect/Vitest or schema policy exception, reduced floor or semantic
waiver is introduced. A fixture-specific spelling rule ignores hexadecimal
bytes fields only: the checker otherwise mistook ed0ded0ded0ded0d for prose.
Source bytes and their hash remain unchanged; all fixture prose stays checked.
