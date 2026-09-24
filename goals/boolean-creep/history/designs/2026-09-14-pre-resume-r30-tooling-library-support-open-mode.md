# r30-tooling-library-support-open-mode

Native P2 proposal prepared by Codex `gpt-6-astra` with `xhigh` reasoning under
the user's current AGENTS instructions, superseding older packet effort wording.
Source HEAD `e7b1e907726421c7d2a2e1cdd140280df47f2353`; immutable main `bed30c6adf3beed7de8538209fbdc84d26a3b8ce`.
Source file SHA 256 `4993bd3b1d5cd8d0a0765c80f2ad2e81a6ecc80ecb19d396a7f0ecaad6e45566`.
The raw R 30 proposal is confirmed; parent may admit this complete design as
`designed` after census reconciliation. This is not implementation or independent
P3 approval. Tier 1, ordered Tier1E tooling batch; shared-file edits are serial.
Derived/internal carrier: six OpenMode Booleans, 64 representable / 10 legal states.

Unless explicitly qualified, source line references below refer to
`packages/tooling/test-kit/test-utils/src/MemoryFileSystem/MemoryFileSystem.test-kit.ts`.
Paths beginning `src/` or `test/` are relative to `packages/tooling/test-kit/test-utils/`.

## Current shape

Private `OpenMode` at 715–727 is a real S.Class with six required Boolean fields
at 717–722: readable, writable, append, create, exclusive and truncate. The sole
constructor `openMode` 741–749 derives all six from the existing annotated
`OpenFlag` LiteralKit 735–739. It has exactly the ten public FileSystem flags.
No OpenMode member or constructor is exported; this is internal operational
data, not an external SDK Boolean options mirror.

The mapper runs at 1788 for opening,1810 for open watch events and 2240 for
writeFile watch events. Mode is threaded through target selection, existing
and new/symlink targets, and descriptor allocation 1675–1799. Only three of the
six values are copied into the separate stored descriptor 1764–1766. The
companion descriptor design owns that different 8/5 carrier.

This authored implementation lives under src/ despite its .test-kit.ts suffix.
It is admitted source; runnable test files remain supporting proof only.

## Cardinality gap

The complete producer table is:

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

All ten six-bit rows are distinct, versus 64 representable Boolean combinations.
Each flag has a supported public opening witness: existing regular files for
nonexclusive flags; a fresh missing path with an existing parent for exclusive
flags. `r` and `r+` do not create; every other flag can create. Current explicit
exclusive flag fixtures cover wx/wx+/ax/ax+ at `test/MemoryFileSystem/Coverage.test.ts:365–379`.

E4 follows from the sole mapper: append/exclusive/truncate each imply create,
create implies writable, append excludes truncate, and no successful mode has
neither read nor write access. Plus-suffix flags permit both readable and
writable; these are legitimate combined-true states, not exclusions. The full
table, not only a pairwise implication, establishes 64/10.

The public boundary accepts FileSystem.OpenFlag strings, validated at 1787;
it never accepts an OpenMode bag. Private schema permissiveness is not a
supported constructor contract for arbitrary six-bit inputs. Reads after a
successful open and existing test fixtures introduce no alternate producer.
Raw invalid flag diagnostics, numeric creation permissions, file contents and
path payloads remain separate full-domain inputs; none becomes an extra bit.

## Target schema

Keep the existing `OpenFlag` schema/type as the single source of operational
state. Delete OpenMode and openMode entirely; do not replace them with a second
ten-literal kit, a compatibility alias, a tagged object or stored mode cache.
The required result is retention of the original validated source flag through
open resolution, not re-derivation of six stored flags.

Use schema-derived subsets of that existing kit for the actual grouped
operations. For example, a reusable `CreatingOpenFlag` uses
`S.Literals(OpenFlag.omitOptions(["r", "r+"]))`; `ExclusiveOpenFlag` picks
wx/wx+/ax/ax+; `TruncatingOpenFlag` picks w/wx/w+/wx+. Annotate reused schemas
with the existing $I, derive same-name runtime types and S.is guards, and use
kit members/subset helpers instead of a second literal vocabulary. Existing
LiteralKit.pickOptions/omitOptions implementation at the schema package's
LiteralKit.schema.ts 558–566 and local Effect v4 Schema.ts 4779 support those
mechanisms. No as-const arrays, custom filters, ad-hoc string predicates or
six-field Boolean helper object. Scalar predicates at a branch remain derived
observations, not persisted parallel flags.

Replace OpenMode parameters with OpenFlag in the existing helpers without
changing their return schemas, services or errors. Keep the validated flag at
1786–1788; preserve validation order and the original default at each caller:
open defaults r, writeFile defaults w. Do not hoist event decisions before the
successful state transition or change caller-option read timing unnecessarily.

At allocateDescriptor, the companion design maps the same source flag directly
to one five-value DescriptorAccess literal. The open mode must retain all ten
values until creation/exclusivity/truncation work is complete; the descriptor
must then forget those opening-only distinctions. Both designs land in the same
ordered package batch, with a single serial edit to the shared allocation seam.
No new service, module, public export or FileSystem API is needed.

## Migration inventory

| Source / consumer | Required migration and preserved behavior |
| --- | --- |
|715–749|Remove the six-field class and its sole mapper; retain the exact ten-value OpenFlag, annotation and isOpenFlag guard. Add only named schema-derived operational subsets needed by readers.|
|1675–1699|Pass the flag to openExistingTarget. Exclusive existing paths fail AlreadyExists before following/truncating. Failed resolution may follow a dangling final link only for creating flags. Preserve error path, symlink traversal/cycle behavior, File-kind check, retry payload and truncation timing.|
|1702–1740|Pass the flag through link/create helpers. Reclaim newly allocated inode on link failure; retry AlreadyExists only when nonexclusive; retain complete creation permissions/mode, timestamps, allocation and getAllocatedFile invariant error.|
|1742–1799|Pass the flag through selectOpenTarget and its retry loop. NotFound creates only for creating flags; other errors retain current remapping. Keep flag validation before validateMode and allocation only on Ready.|
|1759–1778|Coordinate direct flag-to-descriptor access mapping with the distinct descriptor design. Preserve fd/inode/position=0, counter increment, map insertion and inode openCount. Do not carry create/exclusive/truncate onto the descriptor.|
|1668–1673|Keep truncateOpenTarget's scalar parameter and state/timestamp behavior; supply a derived truncating-flag result. This anonymous function Boolean is not a new model or deletion target.|
|1801–1828|Open event selection still uses prior resolution failure for Create, truncating-open for Update, otherwise no event. Preserve inodeUpdateEvents for all linked paths and successful final path resolution for Create.|
|2219–2250|writeFile retains default w, transactional open/write/close, exact raw options, data bytes and withOperationError remapping. Changed-event predicate remains truncating flag OR nonempty data. Empty r+ writing produces no content-change event, while empty default-w still truncates.|
|761–780,1830–2109|Descriptor access/error/cursor/close operations are migrated by the companion design. This mode design changes no accepted File/Size/SeekMode contract.|
|2976–3031|Keep the one-permit volume, interruptible acquisition, uninterruptible mutation/commit, map replacement and state-assignment/event-publication ordering. No failure may partially commit a newly opened/truncated file.|
|3081–3108,3143,3177|Keep FileSystem.make wiring, make's fresh-volume contract, layer lifetimes and the public FileSystem service return.|
|src/MemoryFileSystem/index.ts:8; package.json exports 19–20; src/index.ts|Only make/layer are exposed by the dedicated facade; implementation subpaths remain blocked, root exports unchanged. No new schema test export or public compatibility API.|

Graft callers reported an ambiguous OpenFileDescriptor name in excluded
scratchpad code; exhaustive scoped source searches established the actual
private writer/readers. No scratchpad implementation is a consumer. Searches
for public imports find only this module's docs and the four MemoryFileSystem
test files. Their FileSystem-facing signatures remain unchanged.

## Guard-deletion accounting

Delete six OpenMode fields, six producer projections 741–749 and all three
openMode materializations 1788/1810/2240. Remove the mode bag and its type threading
from five helper signatures. Replace two exclusive reads 1682/1713, two create
reads 1685/1753 and three truncate reads 1698/1811/2244 with derived source-flag
queries. The actual IO/error/event branches stay; there is no existing generic
coherence guard to claim as deleted.

The allocation rewrite is shared with, and counted once under, the descriptor
design's stored-field deletion. This design does not double-count its three
destination fields. No new local six-Boolean projection is acceptable.

Retain isOpenFlag, validateMode, existence/kind checks, retry bounds, symlink
errors, permission failures, allocation errors, full byte payloads, transaction
locking and watch events. These enforce real independent inputs and cannot
be deleted merely because the operational mode is now honest.

## Encoded-side impact

None: neither the private OpenMode nor the private State has a JSON, disk or
wire codec. Public APIs continue using the exact same ten FileSystem.OpenFlag
strings, defaults, path/byte payloads, numeric mode and typed PlatformError
shapes. Do not export or serialize the internal subset schemas. Current Effect
rc.112 contract is bound by root catalog/lockfile, installed Effect package and
FileSystem.ts; dependencies do not change.

Preserve error method/module/pathOrDescriptor, BadArgument flag rejection,
AlreadyExists and BadResource ordering, original symlink paths and IO return
values. Keep FileSystem.make's derived string/stream operations, public file
handles, fd allocation, contents/timestamps and Create/Update event semantics.
An upstream-derived implementation is not a reason to remodel its external API.

## Test impact

Use the existing @beep/test-utils/MemoryFileSystem facade and @effect/vitest
harnesses. Add a ten-flag public opening matrix using source-valid fixtures,
asserting create/no-create, exclusive failure without prior truncation,
read/write permissions, append versus positional writes and initial contents.
This proves behavior through FileSystem, without exporting private schemas or
constructing arbitrary old OpenMode tuples. Explicitly retain defaults r/w.

Keep Coverage.test.ts 333–379 dangling-link/cycle/kind/exclusive cases and
MemoryFileSystem.test.ts 115–123 dangling-exclusive preservation. Keep shared
FileSystemConformance.ts 317–375 r+ overwrite, empty writes, r rejection,
append and exclusive tests. Assert invalid flag versus invalid creation-mode
error order and unchanged state/descriptor allocation on failure. Preserve
watch effects for empty write under w versus r+, existing/created paths and
hard-link aliases using existing event harnesses; test timestamps only with
the established clock controls.

Concurrent appends/exclusive creation at MemoryFileSystem.test.ts 157–185 must
remain serialized with exactly one exclusive winner. Keep all four memory
suites and the shared conformance registrations. The conformance suite requires
a fresh subject layer per case; do not replace its deliberate D 14 per-test
provision with a shared it.layer. Existing sharing tests retain their separate
intentional shared blocks.

At implementation run focused memory suites, the Node and actual Bun
conformance registrations for their respective runtime assertions, and required
`bun run beep quality package-verify @beep/test-utils`, followed by canonical
Yeet validation for the ordered Tier1 batch. No product tests, package commands,
model lanes or browser runs occur in this P2 preparation.

## Risk

The risk is losing an opening distinction too early: r+ and w+ have identical
descriptor access but different creation/truncation effects, and wx/w must not
collapse before exclusivity has been enforced. Preserve the ten-flag source
through the whole open transaction, then project only at descriptor allocation.
Do not infer permission restrictions from file mode metadata or fold signed
cursor/byte facts into this enum. The companion 8/5 design remains separately
adjudicated, with no duplicated deletion credit. Parent census reconciliation precedes admission of these P2 proposals;
independent P3 precedes implementation. No source change is claimed here.
