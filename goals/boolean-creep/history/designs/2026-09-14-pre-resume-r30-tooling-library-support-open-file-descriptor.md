# r30-tooling-library-support-open-file-descriptor

Native P2 proposal prepared by Codex `gpt-6-astra` with `xhigh` reasoning under
the user's current AGENTS instructions, superseding older packet effort wording.
Source HEAD `e7b1e907726421c7d2a2e1cdd140280df47f2353`; immutable main `bed30c6adf3beed7de8538209fbdc84d26a3b8ce`.
Source file SHA 256 `4993bd3b1d5cd8d0a0765c80f2ad2e81a6ecc80ecb19d396a7f0ecaad6e45566`.
The raw R 30 proposal is confirmed; parent may admit this complete design as
`designed` after census reconciliation. This is not implementation or independent
P3 approval. Tier 1, ordered Tier1E tooling batch; shared-file edits are serial.
Stored/internal carrier: three descriptor access Booleans, 8 representable / 5 legal states.

Unless explicitly qualified, source line references below refer to
`packages/tooling/test-kit/test-utils/src/MemoryFileSystem/MemoryFileSystem.test-kit.ts`.
Paths beginning `src/` or `test/` are relative to `packages/tooling/test-kit/test-utils/`.

## Current shape

Private `OpenFileDescriptor` 264–276 stores required fd:FileDescriptor,
inode:Inode, position:Cursor and readable/writable/append Booleans 268–270.
`State.descriptors` 282–284 is the private HashMap of these records.
Cursor 257–262 intentionally accepts signed bigint: negative seeks are legal
stored positions, checked only by nonempty IO. These required payloads introduce
no Boolean axes or new nullable states.

The sole allocation 1759–1778 copies three values from the distinct OpenMode
and initializes position 0. Reads and later mutations cannot change the access
triple: read 1892–1895, positional write 1939–1942, seek 2035–2038 and truncate 2078–2081
spread the descriptor and replace only position. Append writing retains the
map 1937–1938; close 1830–1844 removes its record; initial volume 3002 has an empty
map. No public factory accepts a descriptor or State bag. Only make/layer are
exported 3143/3177, returning the FileSystem service.

## Cardinality gap

All source flags and their exact projection are shown here, retaining opening
state only as evidence for the stored carrier:

| OpenFlag | readable | writable | append | create | exclusive | truncate | Stored access |
| --- | --- | --- | --- | --- | --- | --- | --- |
| r | T | F | F | F | F | F | read-only |
| r+ | T | T | F | F | F | F | read-write |
| w | F | T | F | T | F | T | write-only |
| wx | F | T | F | T | T | T | write-only |
| w+ | T | T | F | T | F | T | read-write |
| wx+ | T | T | F | T | T | T | read-write |
| a | F | T | T | T | F | F | append-only |
| ax | F | T | T | T | T | F | append-only |
| a+ | T | T | T | T | F | F | read-append |
| ax+ | T | T | T | T | T | F | read-append |

The stored domain is five triples in order readable/writable/append:

| Stored access | Triple | Supported flag group |
| --- | --- | --- |
| read-only | TFF | r |
| read-write | TTF | r+, w+, wx+ |
| write-only | FTF | w, wx |
| append-only | FTT | a, ax |
| read-append | TTT | a+, ax+ |

Eight representable triples, five legal stored states. Append implies writable;
no allocated descriptor is both unreadable and unwritable. Excluded triples
are FFF, FFT and TFT. All five have concrete supported public opening inputs.
Exclusive flags use a new path; other flags can use an existing regular file.
The explicit allocation table and preservation-only update closure establish
8/5 beyond the single writer, not generic schema permissiveness.

TFT must not be invented as a read-only append handle. Conversely TTT is real:
read-append handles both read and write, while append writes leave their read
cursor unchanged. `Coverage.test.ts:381–408` and the shared conformance
488–529 directly witness these semantics. Read-write without append is also
real for multiple opening policies; descriptor state deliberately does not
retain create/exclusive/truncate.

Closing is map absence, not an all-false descriptor or a sixth access literal.
The separate MemoryFile.closedPosition remains available for infallible seek
after close. Generic construction of private classes does not establish a
supported public malformed-descriptor input contract.

## Target schema

Add one private annotated `DescriptorAccess = LiteralKit(["read-only",
"read-write", "write-only", "append-only", "read-append"])` and same-name
derived type in the existing module before OpenFileDescriptor. Replace its
three Boolean fields with required `access: DescriptorAccess`, retaining fd,
inode and signed Cursor exactly. No default for access, no Option, no classes
per mode and no compatibility getters. The shared payload layout needs one
literal domain, not five tagged payload classes.

The current source has no DescriptorAccess/OpenFileAccess/FileOpenMode domain
to reuse; the existing OpenFlag has ten values and must remain the separate
opening contract. Use OpenFlag.$match to map its ten values directly to these
five cases at allocation, preferably kit Enum/thunk helpers. Do not store the
full opening flag or reconstruct a three-Boolean intermediate. Reuse the same
mapping for every allocation (there is one current call chain).

Retain the existing OpenFileDescriptor S.Class and annotate the changed field
semantics with the same $I. Use .make for the trusted initial record where
appropriate; preserve all existing signed Cursor values in updates and avoid
introducing validation effects/errors on formerly supported seeks. Define the
kit before the class; keep flag-to-access derivation after the existing OpenFlag
definition 735 to avoid forward-initialization dependencies. No module split or
new service is needed.

Derive readable and writable access subsets with S.Literals of the kit's
pickOptions and derive S.is guards. Readable is read-only/read-write/read-append;
writable is every case except read-only. Appending is append-only/read-append.
Use named schema-derived subsets only where reused; do not duplicate literal
vocabularies, ad-hoc string predicates or stored capability Booleans.

`getOpenFile` may retain its current optional scalar request
`"readable" | "writable"` (an excluded function parameter). Replace dynamic
`descriptor[access]` with the corresponding kit-derived capability query while
preserving the exact diagnostics. Do not widen a successful descriptor operation
merely because its requested capability is missing; that rejection remains.

## Migration inventory

| Source / consumer | Required migration and preserved behavior |
| --- | --- |
|257–291|Keep signed Cursor, fd/inode schemas and HashMap/defaults. Define DescriptorAccess before the descriptor class; replace only its three stored access fields.|
|735–749,1759–1778|Joint seam with OpenMode 64/10 design: use the existing validated OpenFlag directly and collapse its ten values to five descriptor access cases. Preserve fd/counter/openCount/inode insertion and position 0. No opening-only flags survive in the descriptor.|
|761–780|Keep lookup-first closed failure, then requested permission failure, then File-inode existence/kind failure. Replace dynamic Boolean property lookup with derived access checks; preserve method and exact 'File descriptor is not readable/writable' descriptions.|
|1869–1914|Read and readAlloc still check readability before zero-length success. Nonempty reads validate signed position, copy only returned bytes, advance cursor by bytes read and update atime; zero-length IO retains cursor/state. Preserve untouched caller buffers on failures.|
|1917–1980|Write/writeAll still check writability before empty success. Append uses current inode byte length and does not advance stored cursor; positional writes use/advance cursor. Keep size checks, allocation-before-committed-byte-mutation, timestamps, buffer copying and nonzero-write events.|
|1830–1844,2000–2008|Closing removes the descriptor once, decrements openCount once, preserves inode until last open/link is gone and snapshots handle closedPosition under the same permit. Repeated close remains harmless.|
|2010–2044|stat/sync require an open File inode but no access capability. seek stays infallible with signed offsets, start/current semantics and handle-local closed cursor. Spread/update access unchanged and never revive closed descriptors.|
|2050–2062|Keep readAlloc's validation/allocation order, typed errors and Option<Uint8Array> result; no new optional descriptor state.|
|2064–2094|truncate retains writable check, allocation and timestamp/event updates. Clamp position only for nonappend access when greater than the new size. Appending cursors remain untouched even if beyond the truncation point.|
|2096–2109|write/writeAll/open signatures, Size versus void results and acquireRelease finalization remain exact.|
|2219–2250|writeFile's temporary descriptor is allocated, written and closed within one volume mutation. Retain default w, complete bytes/mode inputs, error remapping to path/method writeFile and watch events.|
|2976–3031,3081–3108|Keep empty initial descriptor map, one-permit transactional state, cancellation/commit/event order and FileSystem.make method wiring.|
|src/MemoryFileSystem/index.ts:8; src/index.ts; package.json:19–20|Retain only make/layer facade, blocked implementation subpath and package root exports. No public descriptor schema, test-only export or new FileSystem API.|

The full update closure above was verified by targeted Graft and exact source
search, including the bracket access that a dot-only search could miss. Direct
public imports are limited to the four MemoryFileSystem test suites and module
docs; those callers interact through unchanged FileSystem.File APIs. Shared
FileSystemConformance registers the same service protocol against Memory,
Node and Bun. Its source utility is supporting behavior, not a new census row.

## Guard-deletion accounting

Delete three stored Boolean fields 268–270 and three allocation copies 1764–1766;
replace them with one required access literal. The allocation's physical rewrite
is counted here once, with the mode design owning deletion of its separate
six-field source projection. Every later spread preserves access instead of
carrying three loosely typed flags.

Replace the dynamic Boolean lookup 771 with schema-derived readable/writable
membership. Replace append reads 1927/1937 and inverse append 2077 with one
schema-derived append subset at those decisions. Do not cache three equivalent
sibling capability locals on a record or handle. The membership tests remain
necessary permission and cursor behavior; no existing coherence filter is
present, so none is falsely credited as removed.

Keep closed descriptor, inode existence/kind, size/allocation, permission and
cursor checks; they validate real resource/input facts. Keep append EOF selection
and truncate clamping. No deletion credit applies to state locks, openCount,
file bytes, watch events, close finalization or the separate closedPosition.

## Encoded-side impact

Storage here means the private in-memory descriptor map, not persisted files.
The raw report's prose 'persisted access triple' is corrected accordingly.
Neither descriptor nor State has a public/durable codec. The new access literal
must not appear in FileSystem.File.Info, watch events, error messages or output.
Public FileSystem/MemoryFile fields and make/layer return types stay unchanged.

Preserve all ten accepted opening flags and r versus w caller defaults, numeric
permissions, arbitrary supported paths/bytes, signed/large Cursor values and
precise Size/Option returns. Do not tighten Cursor to NonNegativeInt or treat
negative seek as a failed constructor. Preserve descriptor IDs, inode identity,
hard links, unlink/rename-open lifetimes, timestamps, error module/method/path
or descriptor and no-host-IO/fresh-layer isolation. This is not a driver wire
shape migration and requires no dependency/API change.

## Test impact

Extend the existing public flag matrix to observe each of the five descriptor
capabilities. At least r, r+, w, a and a+ witness distinct access; verify every
exclusive/nonexclusive alias group also preserves opening effects under the
companion design. Test both allowed and denied read/write/readAlloc/writeAll/
truncate behavior and stat/sync on every open access class. Do not export a
private constructor just to assert malformed old triples fail.

Retain Coverage.test.ts 381–408 permissions/buffer/cursor checks,412–441 unlinked
handles,445–471 allocation failures, and Characterization.test.ts 137–163 signed
cursor plus zero-length IO and 336–381 closed seek. Add zero-length forbidden
read/write assertions (permission check still precedes empty success), append
write with a nonzero or negative read cursor, append truncate without clamping,
and positional truncate with/without clamping. Assert subsequent readable bytes
and cursor, not only the access label. Preserve an absent map entry as a closed
resource error; do not manufacture an all-false descriptor. Demonstrate that
close/seek never revives a descriptor.

Shared FileSystemConformance.ts 449–572 supplies sequential read/write cursor,
append read-cursor and truncation behavior. Keep per-test fresh layer provision
and scoped resource release; intentional shared-volume characterization remains
separate. MemoryFileSystem.test.ts 157–205 covers serialization and invalid size
atomicity. Preserve watch-event fixtures and hard-link/unlink lifetime behavior;
no failed IO may partially advance a descriptor or mutate a caller buffer.

At implementation run the four memory suites, shared Node and actual-Bun
conformance on their intended runtimes, then required
`bun run beep quality package-verify @beep/test-utils` and ordered Tier1 Yeet
gates. Tests are specified here, not executed by this P2 task. No browser QA
applies, and no process/model lane is launched.

## Risk

The five-state stored access model must not be confused with the ten-state
opening model. Reusing w/wx semantics after opening could accidentally retruncate
on later writes; keeping ten values in the descriptor would retain irrelevant
creation history. The target projects once at allocation, then uses capability
subsets while preserving full fd/inode/signed-cursor payloads. A blanket
nonnegative cursor refinement or 'closed' access variant would violate explicit
fixtures. Both instances remain independently qualified, with shared-file edits
serialized and no double-counted guards. Admission and independent P3 remain
parent-owned after active R 30 reconciliation.
