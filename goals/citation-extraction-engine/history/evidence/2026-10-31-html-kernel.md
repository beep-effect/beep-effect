# Pinned private HTML kernel and closed host

Date: 2026-10-31. Scope: authenticated native core, before an owned worker.

The server package now retains a private WebAssembly kernel linked with
libxml2 2.12.3 and WASI SDK 34 runtime code. Its C adapter implements the pinned
eyecite XPath text selection and lxml body/head merging. Public engine
integration and force-stoppable execution remain open. The synchronous private
run method is intended for the future owned worker and carries no claim that
a parent-side timeout can interrupt parsing.

## Build and retained notices

The build producer verifies the official source and SDK archive digests before
extracting them into a fresh temporary directory. It fixes the target,
compiler, feature switches and memory maximum, enables the Unicode converter,
disables catalog/module and HTTP/FTP support, and maps build paths to a stable
prefix. No workstation home path appears in the binary. Two independent clean
builds produced identical WASM bytes and decoded receipts; the
[rebuild observation](./html-kernel-rebuild.json) retains their hashes and inputs.

The complete binary SHA-256 is bound in the private host. A changed asset fails
before compilation. The artifact verifier separately parses its sections: one
unshared memory with an explicit 512 MiB maximum, no automatic start section,
14 function imports from the WASI namespace, and only the expected ABI exports.
The kernel is 980,822 bytes and is packaged with its source and build receipt.
The engine needs no SDK, C compiler or Python at runtime.

The root THIRD_PARTY_NOTICES.md covers the new asset. Fourteen packaged notices
retain the libxml2 main and distinct dictionary/list/trio notices, WASI aggregate
licenses and alternatives, musl COPYRIGHT, cloudlibc BSD notice, dlmalloc
public-domain notice and compiler-rt license. The notice inventory binds source
revisions, original and retained-text hashes, excerpt rules and linked object
names. The linker inventory confirms dlmalloc and iconv; emmalloc and fts are
not incorporated. The existing eyecite and lxml adaptation notices also apply.

Source license spellings and author names remain byte-bound. File-scoped typos
dictionaries preserve upstream names and spelling in the musl notice and the
native diagnostic enum in the source-only result corpus. Authored implementation
and prose retain ordinary checks. Two exact notice paths retain their upstream
final blank lines through file-scoped Git whitespace attributes.

## Runtime boundaries and outcome proof

The host snapshots and authenticates the asset before compiling it. Each run
owns a fresh instance. All descriptor and path imports return EBADF without
accessing host resources or mutating the supplied memory. The environment is
empty, and the imported native clock writes zero. No node:wasi runtime or
ambient process configuration is used. Focused tests invoke all ten denied
I/O callbacks and check that memory remains unchanged, then verify environment
sizes and deterministic time writes. Binding memory is required before init.

Input and result allocations are acquired and released under Effect resource
ownership. Native depth, name and allocation resource signals cannot return
partial output. The C kernel checks output growth before allocating its result,
and the host checks byte/unit lengths and strict UTF-8 decoding while preserving
a leading BOM. The completion guard validates the returned text. Driver
failures retain only closed reasons, without source text or native messages.

The frozen source corpus has 1,097 cases and 1,224 immutable strings. It extends
the 1,075 input cases with 22 head/body/tail and long-name cases. Actual target
execution preserves 840 successful values exactly, matches 238 Unicode
declaration rejections and 16 parser-error categories, and returns the approved
resource failure for three source depth-limit successes. Long ASCII names
produce ordinary recovered results in these observations and do not authorize
a general name-length rejection. Fatal non-resource Unicode diagnostics retain
their source values.

The source producer retains complete source outputs or exception types, source
and dependency pins, license/lock hashes and classified diagnostics. Fresh
oracle replay reproduces it. Fourteen corruption controls reject altered source
rows, scope/pins, the binary and build receipt. The original 69-case audit is
cross-checked independently and remains unchanged. Exact output ceilings,
changed-asset rejection and successful runs after preceding failures also pass.
A one-million-unit input forces real growth from the 327,680-byte initial memory
and preserves the full result; a following instance remains independent.

## Open integration obligations

The private host's typed run method has R = never. Its expected driver failures
still require the full engine translator. It does not qualify a worker's
startup, admission, IPC framing, shared operation deadline, forced stop,
termination acknowledgement or cleanup deadline. The parent must own the
worker, charge complete messages and keep preparation and execution within one
operation budget. Native memory and source-length extremes also need worker
qualification. The live Layer, HTML source maps and complete cleaner pipeline
remain open.

No canonical row, normalization law, semantic waiver or exhaustive parity claim
is promoted. The separate approved native-resource safety exception is unchanged.
