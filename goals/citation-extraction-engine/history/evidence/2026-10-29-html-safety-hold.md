# HTML parser audit and required safety/fidelity ruling

Superseded on 2026-10-29 by the direct human approval recorded in
[html-safety-exception.json](../../ops/html-safety-exception.json). The historical
proposal and source evidence below are retained as originally recorded. See
[implementation evidence](./2026-10-29-html-safety-approval.md) for the bounded
completion guard; native parser qualification remains open.

Date: 2026-10-29. Historical status: awaiting the operator's scope ruling.
This is source evidence and a concrete proposed behavior change, not target
HTML implementation or approval of a divergence.

## Counterexample under the frozen oracle

The oracle is eyecite 2.7.6 at 04d82c032ad5fd0f9ab72a61c87110c46ee8f52e, Python
3.11.15, lxml 5.1.0, and compiled/runtime libxml2 2.12.3. Its public html
cleaner returns successful truncation when native parsing reaches its depth cap:

Each input nests the indicated number of div elements around VISIBLE.

| Depth | UTF-16 units | Source value | Depth diagnostic |
| ---: | ---: | --- | --- |
| 255 | 2,812 | VISIBLE | none |
| 256 | 2,823 | empty success | FATAL |
| 257 | 2,834 | empty success | FATAL |
| 300 | 3,307 | empty success | FATAL |

The native message is `Excessive depth in document: 256 use XML_PARSE_HUGE
option`. These inputs fit far below the existing 250,000-unit default source
ceiling. The upstream cleaner discards the parser error log and joins the
selected text from the recovered, truncated tree.

The [SPEC](../../SPEC.md) requires limit exhaustion to fail with
CitationSafetyLimitExceeded and says to never silently truncate a parity result.
The [GOAL](../../GOAL.md) directs stopping when safety/fidelity needs an
unrecorded divergence. Preserving this empty-success behavior and rejecting it
as a safety failure produce different observable results. No target change is
selected while that conflict awaits a ruling.

## Proposed scoped change for review

For native HTML parser resource exhaustion, return the closed
CitationSafetyLimitExceeded failure and release the parser operation without
returning a partial cleaned value. Preserve ordinary HTML results and source
parsing failures separately. Native diagnostics must be classified without
retaining source-bearing messages.

This changes the outcome of the depth-256 counterexample from successful empty
text to a closed failure. It requires an explicit recorded safety/fidelity
exception and the corresponding contract/accounting update before
implementation. Raising the native depth cap would change source behavior as
well and is not selected. Recording this proposal does not approve a semantic
waiver or complete a canonical capability row.

An asynchronous question has been presented with this proposal, a
contract-preserving hold, and a safety-rule revision as distinct choices. A
question being displayed or time passing is not authorization. The goal remains
active pending that ruling; the HTML target lane is held.

## Additional source semantics

The source probe captures 69 HTML cases with actual text nodes, logical parents,
selected-node positions, exact outputs or exception types, and diagnostic
classifications. It retains all strings in 115 verified content-addressed
artifacts. The corpus SHA-256 is
049bbadd90348588e2e7a1c62daf1f5dba0b6865df9f2001b9461b8b80f9cb71.

The selection predicate is the exact XPath read from clean.py. It tests
immediate parents, not entire ancestor subtrees. A star-pagination parent's own
text and tail are excluded, while a nested b child's text survives. Class
equality is exact: the value star-pagination other does not match the exclusion.
Head/title text can survive. XPath normalize-space recognizes XML whitespace
rather than the Python whitespace class used by all_whitespace. These are
observable differences from broad visible-text or subtree-removal
approximations.

The audit includes blank/comment/doctype failures, XML encoding-declaration
rejection, malformed HTML recovery, Latin-1/BMP/astral text, isolated surrogates
and NUL behavior. Native error text is not copied into general diagnostic
records. A ValueError before parsing does not attribute a previous parser error
log to the current call. Target proof and divergence approval are explicitly
absent.

Source hashes cover clean.py and lxml's HTML wrapper, parser and API helpers.
The report binds the clean oracle commit/tree, license/lock, dependency
versions, Unicode version, little-endian 64-bit environment and producer. The
verifier checks content-addressed strings, text-node selection consistency,
exact depth counterexamples and explicit lack of approval. Eight corruption
controls reject changed evidence and fabricated target proof/approval; fresh
replay reproduces the report.

## Parser implementation investigation

The local system libxml2 is 2.15.4, different from the oracle. An isolated
research build uses the official libxml2 2.12.3 source archive and a pinned WASI
SDK 34 archive, each checksum verified against its official distribution
metadata. The resulting scratch WebAssembly module instantiates under Bun and
exports version 21203. This is an instantiation/version observation only: no
HTML output comparison qualifies that module.

The source archive SHA-256 is
8c8f1092340a89ff32bc44ad5c9693aff9bc8a7a3e161bb239666e5d15ac9aaa. The SDK
archive SHA-256 is
b761e3a0721dbae9c09a0059e5fdb2bf917d1b4a8a7b430fb3b5aafb0984b2c4. The scratch
module SHA-256 is
2cd7b4b5763dfd99b8f998523a3898b72b7946b58db5d689c7ccc8f0dc3d10c7, 906,402 bytes.
Build flags include wasm32-wasip1, O2 and no-wasm-opt. A private cache receipt
retains compiler/source hashes and unqualified status.

The SDK and native prototype remain outside the repository. Before incorporating
a runtime asset, qualification must cover lxml's Unicode encoding path and
wrapper behavior, exact parser options, error/limit translation, closed
filesystem/network access, memory/lifecycle/deadline containment and all
linked-library notices. No SDK, libxml2 binary or native C implementation is
incorporated by this evidence commit.

Official discovery sources are the [libxml2 2.12
distribution](https://download.gnome.org/sources/libxml2/2.12/) and [WASI SDK 34
release](https://github.com/WebAssembly/wasi-sdk/releases/tag/wasi-sdk-34).
These are build inputs, not an endorsement or a parity proof for a third-party
wrapper.

## Scope preservation

No target HTML adapter, default Layer, source-map claim, parser-safety
divergence or canonical completion is approved. Existing literal cleaner
implementations and all other required capabilities retain their original
obligations. The source fixture is an audit artifact and cannot authorize the
proposed result change.

The source diagnostic enum HTML_STRUCURE_ERROR retains its upstream spelling.
A file-scoped typos dictionary entry preserves that exact fixture value without
relaxing authored prose checks. The public lxml source-file digest assertion
has a line-scoped secret-scanner annotation; its hash remains fully verified.
