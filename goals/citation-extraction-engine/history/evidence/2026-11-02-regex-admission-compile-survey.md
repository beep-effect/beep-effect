# Regex concurrency and complete extractor compilation survey

The shared native owner now exposes `acquireRegex`. A regex reservation consumes
both the `concurrentOperations` total ceiling and the
`concurrentRegexProcesses` ceiling. One atomic state transition checks both; a
queued regex call cannot hold unused total capacity while awaiting its narrower
limit. All calls share one bounded queue and one queue deadline. Capacity
notifications never restart that deadline. Quarantined regex children retain
both reservations and block new HTML/regex reservations until retirement.

The admission implementation uses a generation notification captured before the
capacity check. Release, quarantine and closure wake existing waiters without a
lost notification. The ownership transfer after an interruptible wait stays
masked, and cancellation releases an acquired reservation before returning.

Eight focused admission tests pass, including independent total/regex ceilings,
HTML use of spare capacity while regex waits, quarantine across kinds, a queue
deadline spanning unrelated capacity notifications, and 32 cancellation races
for each reservation kind. Lease flags and aggregate counts are serialized,
including 64 concurrent quarantine/release controls for the same exact lease.
The seven focused engine component suites pass all
39 tests (17.31 seconds), including all ten real HTML supervisor tests. Test
typecheck, focused lint and the native-runtime law check pass. Hosted corpus
qualification remains pending for this implementation head.

The maintainer compile-only survey reconstructs all captured extractor
descriptors from the authenticated operation artifacts, then reconciles every
instance ID, pattern hash, flag set and constructor against regex-inventory.json.
There are 13,610 instances and 13,258 distinct pattern bodies. It runs a fixed
owned compile-only child on Bun 1.4.4 and Node 24.22.1 with a 30-second process
watchdog, no inherited child environment and no pattern evaluation. The report
records source/producer/child/candidate/order hashes, runtime versions and the
complete indexed result vectors. `C` means compilation succeeded only; `S`
means SyntaxError. No native error messages or source pattern bodies are copied
into the report.

Both runtimes produce the same counts:

| Candidate | Compiles | Syntax rejection |
| --- | ---: | ---: |
| Rename Python named groups only | 2,684 | 10,926 |
| Also escape ASCII literals, expand omitted minima and escape literal unmatched closing brackets | 13,610 | 0 |

The last two syntax failures before handling literal unmatched brackets are
instances 5087 and 5088 of artifact
`271d15c99e8dfb1c974a648393ce8d1fde8029c05813ac97c6e5e696f6aeb435`.
The source contains `ch\[.,]`: the brackets and comma are literals, while the
dot remains a wildcard outside a character class. It matches `ch[.,]` and
`ch[X,]`, for example. The survey preserves that unusual behavior; it does not
correct the source into `ch.`. This corrects the earlier description of the
whole example as literal text. The retained candidate already preserves the dot
as a wildcard; the controls now explicitly check both examples.
Six controls pass for class/group/quantifier/escape handling, this literal
behavior, complete authenticated source coverage and retained report/vector
bindings.

The lexical candidate is maintainer exploration, not the production pattern
translator or a public tokenizer. Its class scanner is scoped to these captured
patterns and is not a general Python regex parser. Compilation does not prove
matching, capture spans, iteration order, literal routing, safety scaling or
Unicode behavior. In particular, 13,598 instances use `\d`, 6,656 use `\s`, two
use `\S`, twelve use `\w`, and eight use ignore-case flags. Those semantics,
all 110 source families outside/within extraction and the required family
benchmarks remain unqualified. No source workflow/proof row is made terminal,
no source fixture/producer changes, and no semantic waiver is introduced.

Reproduce the survey with `probe-regex-compatibility.py --runtime bun --runtime
node --output <report>` and its controls with `test_regex_compatibility.py`.
The remaining production work includes the reviewed pattern translator and
force-stoppable regex worker/protocol, extraction/tokenization, mapping,
annotation, transforms, public engine composition and exhaustive goal closure.
