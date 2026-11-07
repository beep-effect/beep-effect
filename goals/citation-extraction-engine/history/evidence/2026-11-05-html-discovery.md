# Original HTML placeholder and emphasis discovery

This is source observation for the next HTML preparation stage, not target
parity or engine completion. The owned default diff worker remains a separate
proof obligation, with full hosted replay pending. PR #2737 contains the worker
and this continuation under the standing linked-follow-up decision.

`ops/probe-html-discovery.py` calls the pinned original `placeholder_markup` and
`Document.identify_emphasis_tags` directly. An uninitialized Document isolates
the latter method from unrelated cleaning/diff construction while preserving
its actual implementation. No matching or replacement algorithm is substituted.
The probe checks the exact clean oracle commit/tree and CPython 3.11.15.
The fixture seals both source modules and the producer. Native width/bytes keep
scalar emoji, literal surrogate pairs, unpaired surrogates and NUL distinct;
all positions are original Python source-point coordinates.

The 250 cases produce 162 emphasis tuples. They include opening/closing spelling
cross-products, malformed and nested tags, adjacent matches, quoted angle
brackets, multiline bodies, empty bodies and individual stripping points.
Every placeholder preserves source-point length. Running again with
PYTHONHASHSEED=373 produces byte-identical output.

- Fixture: `packages/law-practice/use-cases/test/fixtures/eyecite/html-discovery.json`
- Fixture SHA-256: 300ebdae40b70009428549807c2c6bf44692d7fef645c32ba8ad10223ad8ee2e
- Producer SHA-256: 4fe89ec688bd763d406cd90d658f8807e468ffa371c475baad348c39d352a01e

## Constraints for implementation

The placeholder pattern is case sensitive, and its `[^>]+` requires an
additional character after the first slash/lowercase letter. Consequently
`<i>` stays `<i>` while `</i>` becomes `</X>`. Uppercase opening tags stay
unchanged even when their closing tags are masked. A quoted `>` ends the
regex match; the pattern does not parse HTML attributes.

The emphasis pattern uses IGNORECASE and DOTALL with a backreference to the
captured opening spelling. It accepts `<important>... </i>` and
`<emphasis>... </em>` because there is no name boundary after the opening
capture. Both dotted and dotless I spellings participate in CPython case
matching, including the closing backreference. Nested same-name tags end at
the first compatible closing tag, and quoted `>` can become inner text.
The tuple stores stripped inner markup, not the element name or cleaned text.
CPython stripping points include controls that differ from JavaScript trim.

The current compiler source flag domain excludes DOTALL. Its source-point
alphabet deliberately cannot represent arbitrary identity-sensitive
backreferences. Do not widen the flags alone or project native source into
JavaScript text to bypass that restriction. Next work must qualify the original
patterns through existing owned execution, or prove a finite-pattern lowering
that preserves every observable tuple and source-point boundary. Effect owns
execution, timing, admission, transport and retirement; source matching semantics
remain an explicit compatibility obligation.

No target execution, complete regex-family qualification, scaling result or
whole-engine acceptance is claimed by these observations. All existing open
representation/fidelity obligations remain open.
