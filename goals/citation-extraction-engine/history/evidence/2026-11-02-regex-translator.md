# Tokenizer regex translation and frozen character facts

The pinned tokenizer's `TokenExtractor.compiled_regex` uses CPython's standard
`re` module, not the separate `regex` package also installed in the oracle.
The source remains clean at eyecite commit
`04d82c032ad5fd0f9ab72a61c87110c46ee8f52e`, tree
`a35a58fac03400f71a93a93485b77f1d56f2b02f`. The producer requires Python
3.11.15 and Unicode 14.0.0 and records model/tokenizer/license/lock hashes.

`probe-regex-characters.py` observes each code point from zero through
0x10ffff, including the surrogate range, against the oracle's digit, whitespace
and word classes. It independently reconstructs maximal intervals and verifies
each generated class against the source engine over that entire domain. It
also observes the ASCII ignore-case class across the entire domain.

| Class | Members | Intervals | Class body UTF-16 units |
| --- | ---: | ---: | ---: |
| Digit | 660 | 62 | 236 |
| Whitespace | 29 | 10 | 27 |
| Word | 133,548 | 734 | 2,525 |

The ASCII ignore-case class contains 56 code points: ASCII letters plus dotted
I, dotless i, long s and the Kelvin sign. The fixture also records 28 controlled
BMP-text cases with 23 actual matches, including group values, named groups and
every capture span. These cover missing groups, newline/end-anchor behavior,
Unicode whitespace and the unusual literal-bracket/wildcard source pattern.
The original compile-survey note now distinguishes its literal brackets/comma
from its wildcard dot; its controls check both `ch[.,]` and `ch[X,]`.

The generated `PythonRegexData.ts` contains observed class facts, not Python
implementation source or a runtime Python dependency. The retained fixture is
`regex-character-facts.json`, SHA-256
`9dec7f6a29162fd6b479cf083546bf07655c23437a362f034d4ff72a1adb59c0`.
A focused test binds that exact fixture, its producer digest, interval totals,
class-body hashes and the production data module.

`makeCitationRegexTranslator` captures the explicit validated policy and returns
an environment-free data translation operation. It translates named groups,
source literal escapes, omitted quantifier minima and class membership. It
preserves Python's dot exclusion of LF only and its end anchor's optional final
LF. ASCII ignore-case patterns retain the source's dotted/dotless-I behavior
both for literals and positive/negative ranges. Group names and capture counts
are preserved; inserted groups are noncapturing assertions.

Effective source and expanded-output pattern budgets are checked. Each derived
fragment is charged before it is constructed or appended, and its resulting
length must match the charge. Oversize source/expansion fails with
`CitationSafetyLimitExceeded(extract, patternUtf16)` rather than partial output.
Private invalid-policy/input/unsupported-syntax failures retain no pattern or
source-bearing cause. The translated data is explicitly not an execution
approval or a general Python regex implementation. Unsupported flag/syntax
extensions fail explicitly. No native regex compilation/evaluation occurs in
this production parent module.

A local data-only replay translated all 13,610 captured instances across both
6,805-extractor configurations, with no failures and a largest output of 3,183
UTF-16 units, below the default 4,096 ceiling. The portable fixed qualification
subject exposes `--translate-only` for this survey; that branch never compiles
or evaluates a native pattern. All nine focused suites passed
46 tests in 15.13 seconds. The fact/translator pair then passed all seven tests
again in 3.20 seconds, including the final over-ceiling-input control. The six
compile-survey controls also pass. Test typecheck, focused lint and the
native-runtime law check are separate from native qualification.

## Hosted qualification prepared, not yet passed

The fixed `qualify-regex-translator.child.mjs` subject loads authenticated
source observations and the real production translator. The hosted integration
test requires:

- Compilation of all 13,610 translated extractors, with the exact largest size.
- 4,456,448 native class checks over all code points for digit, whitespace,
  word and ASCII ignore-case membership, using the independent interval facts.
- Exact values, names and spans for all 28 BMP capture cases and 23 matches.
- A bounded source-free reply and independently confirmed OS exit for its one
  child. Only ESRCH confirms absence; the parent's 90-second qualification guard
  force-stops its exact scoped child on expiry.

The native qualification branch runs only in hosted integration; it has not run
locally. Its
90-second qualification guard does not prove the engine's per-evaluation regex
deadline or production regex-worker protocol. Astral capture-span conversion,
Python empty-match iteration, source-family literal routing, pattern execution
budgets, all-family safety/scaling and the actual owned production regex worker
remain separate obligations. No family is approved, no accounting proof row is
made terminal, and no semantic waiver or oracle fixture/producer is changed.
Extraction, annotation/mapping, transforms, public engine composition and full
goal proof/reflection/lifecycle closure also remain incomplete.

The worker's input preparation must also preserve the existing native Python
Unicode carrier. A direct observation in the pinned Python environment gives:

| Source value | Python length | UTF-16-LE bytes | Full decimal match |
| --- | ---: | --- | --- |
| Two literal surrogate code points U+D835 U+DFCE | 2 | `35d8cedf` | false |
| One mathematical bold digit U+1D7CE | 1 | `35d8cedf` | true |

Thus the same projected JavaScript string can correspond to distinct source
matching behavior. The native worker must retain storage/width and prepare an
unambiguous matching representation with exact boundary mapping. The scalar
qualification alone does not prove that input contract. This remains required
implementation/proof work, without an approved fidelity divergence.
