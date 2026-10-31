# Native HTML bytes and pinned converter compatibility

Date: 2026-10-31. Scope: owned Python-byte input through the private native HTML
ports, before complete live cleaner value/registry ownership or public service
composition. No byte-valued raw request or function-valued request is introduced.

## Frozen source observations

The new source report contains 589 complete byte inputs/outcomes and 45 non-text
builtin dispatch observations, with 488 full immutable output/error strings.
All 256 byte values appear both inside content and before a full-document-shaped
input. Additional cases cover UTF-8 declarations, invalid sequences, embedded
NUL, unknown encodings, the existing depth resource boundary, UTF-16/UTF-32 in
both byte orders with/without BOM, and nineteen legacy encodings under meta,
http-equiv and XML declarations. Original Unicode and sequence corpora remain
unchanged; these cases are supplemental source evidence, not target promotion.

The source byte outcomes comprise 565 successful strings, twenty UnicodeDecodeError
outcomes and four ParserError outcomes. One success is the original partial empty
depth-256 result and requires the already approved native resource safety failure
in the target. The effective target counts are therefore 564 exact strings,
twenty decode failures, four parser failures and one explicit resource failure.

The 45 source controls apply each of the five builtins after a callback returns
None, zero, an integer, a list, bytes, bytearray, memoryview, a controlled host
object or a text subclass. Six calls return plain strings and 39 raise TypeError.
No supplied str/bytes/len hook is called. These observations remain source-only
until the complete value owner replays them. A runtime adapter must distinguish
Python bytes from bytearray/memoryview and arbitrary host buffers.

The report pins official eyecite commit
`04d82c032ad5fd0f9ab72a61c87110c46ee8f52e`, tree
`a35a58fac03400f71a93a93485b77f1d56f2b02f`, Python 3.11.15,
PYTHONHASHSEED=0, lxml 5.1.0/libxml2 2.12.3, producer, cleaner, lxml HTML source,
license and lock hashes. The dedicated verifier seals the entire report,
checks every full-string reference, all byte prefixes and non-text accounting,
rejects twelve corruptions and can regenerate byte-identical data from the
pinned interpreter. Exact generated-file formatting/spelling exclusions point
to this validator; no authored implementation is excluded.

## Byte detection and bounded transport

Byte full-document classification uses only ASCII whitespace and ASCII case
folding, matching lxml's bytes regex. Bytes bypass the Unicode-only encoding
declaration rejection and retain their actual payload, including explicit BOMs.
The native AUTO mode adapts lxml parser.pxi: UTF-32 BOMs are removed with the
matching explicit byte order, bare UCS4 detection selects UTF-32, and other
streams use libxml's byte detection. No lossy text coercion or guessed UTF-8
predecode replaces the source parser.

The private preparation port receives immutable adapter-owned Python-byte data.
It determines exact layout and preflights complete framing before allocating a
transport snapshot. Cooperative classification/copy loops retain captured clean
timing. The snapshot owns its bytes independently after return; the adapter must
not mutate its source while preparation runs. This runtime ownership contract is
not supplied by decoding a matching Uint8Array or arbitrary host object.

cleanBytes supervises standalone native byte work; stageBytes borrows the same
exclusive remaining output allowance and returns original live tickets. Both
are private server capabilities. Bytes consume no UTF-16 text charge; produced
Unicode does. A composed callback-bytes-to-html test returns A with exactly one
produced unit under a one-unit original source and production allowance. An
astral output under the same allowance fails explicitly. Raw-text methods retain
the original request/source contract. No frozen limit field changes.

## Matching the actual converter backend

A first native replay exposed a real mismatch: musl's iconv has input-only
support for some encodings, while libxml's handler discovery requires both
conversion directions. GB2312 silently fell back to Latin-1 in that build. This
result was not accepted as a divergence. The pinned oracle's exported converter
version identifies GNU libiconv 1.17, and its complete libiconvlist inventory has
111 groups and 347 aliases. Its locale reports C.UTF-8 and UTF-8.

The build now uses unmodified GNU libiconv 1.17 conversion source, archive SHA-256
`8f74213b56238c85a50a5329f77e06198771e70dd9a739779f4c02f65d971313`.
An authored fixed UTF-8 locale adapter matches the captured source locale without
localcharset/relocation file or environment lookup. The native ABI reports the
actual linked version and encoding inventory; the host verifies both before
parsing, including inventory SHA-256
`51b99795eaf46526e228b70aa2f109b7a12bff156681d25d60bb02f51092b5bc`.
Crypto is captured at construction so returned methods retain R = never.

The byte corpus also exposes parser-recovered invalid UTF-8 that Python's XPath
conversion rejects. The kernel validates scalar UTF-8 before result allocation
and returns a closed unicode-decode-error category. It neither replaces invalid
bytes nor publishes a partial string. Valid UTF-8 unit counting remains exact.
The approved native resource exception is unchanged; this decode failure is
source behavior, not a new safety waiver.

## Reproducible distribution and relinking

Two clean builds produced identical WASM, build receipt, complete GNU source
archive and deterministic relink bundle. Each build independently relinked the
packaged objects and reproduced the exact distributed WASM bytes. Original
archives retain symbol indices, duplicate member names and debug information;
a reduced-member reconstruction changed extraction order and was rejected.
The receipt separately records actually linked members.

The runtime is 1,753,104 bytes, SHA-256
`99e76b7cdfe01e574886d7b93b685174cbe7cb5944f8ba964c97019d8f53156a`.
The relink bundle SHA-256 is
`10abf778c288a827ef035a7a41ba3afe963470a532631bcb5618ea16e99598c1`.
The closed fourteen-import ABI, no automatic start section and unshared 512 MiB
memory ceiling remain. No new host I/O capability is supplied.

GNU libiconv's complete LGPL-2.1-or-later source and COPYING.LIB are packaged.
kernel-relink.tar.xz supplies the application/kernel object, original library and
system archives, CRT object, complete retained licenses and replacement-library
link script. The complete libc archive additionally carries an unlinked FTS
object, so its BSD-3-Clause notice is also retained. Sixteen notices now cover
runtime and relink distribution material. Root THIRD_PARTY_NOTICES.md and the
notice/build inventories identify the changes. Rebuilding needs the pinned free
SDK; no signing key is required, and source hash guards can be updated by a
modified engine. No upstream library source was patched.

## Qualification scope

The direct native test matches every byte classifier and all 589 source outcomes.
The composed byte callback and retained Unicode/preparation/protocol checks pass
focused tests. Byte snapshot independence, exact framing/one-byte-less rejection,
wrong input type, payload bounds and cooperative cancellation are covered.
Full worker replay independently probes child PIDs after each acknowledged exit;
its required aggregate is 589 byte launches/exits, with zero remaining ownership.
The retained Unicode corpus separately requires 859 launches/exits.

The complete live value/registry owner, text subclass/identity rules, all cleaner
sequence replay plus these non-text controls, global admission/quarantine, maps,
public failure translation and final service/Layer remain open. The portable
completion gate must keep rejecting missing complete target proof. This phase
does not close canonical parity, hosted verification or the one-PR delivery goal.

## Observed verification

The final server package gate passed audit in 276.6 seconds and documentation
generation in 15.1 seconds. The use-cases gate passed audit in 10.2 seconds and
documentation generation in 11.0 seconds. The worker corpus tests passed all
589 byte cases and the retained 1,097 Unicode cases, independently confirming
all 589 plus 859 launched child exits and zero remaining ownership. The source,
implementation, tests and native/relink artifacts stayed unchanged during the
gate. The final notice scope wording was then clarified to include relinking
material and re-sealed under the same asset controls.

The focused preparation/kernel/protocol/composition run passed sixteen tests.
Source generation was replayed byte-identically, and all twelve byte-evidence
corruptions and sixteen asset/source/relink corruptions were rejected. Goal
doctor reported no new blockers and the index projection passed. README and
this note pass the actual Markdown CLI with zero errors. THIRD_PARTY_NOTICES.md
retains exactly eight identical baseline Markdown diagnostics in untouched
license text; the new attribution/relinking prose adds none. No suppression or
license rewriting was introduced. Authored spelling and whitespace checks pass.

The eleven-component portable audit and 37 divergence controls remain required
for the final refreshed bindings. Complete target proof remains pending; these
local adapter checks do not close the full engine goal or authorize publication.
