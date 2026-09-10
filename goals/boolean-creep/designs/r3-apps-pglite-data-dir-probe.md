# Instance

- id: `r3-apps-pglite-data-dir-probe`
- file:line: `apps/professional-desktop/src/runtime/Pglite.ts:257`
- symbol: `ensureCompatibleChatDbDataDir`
- members: `dataDirExists`, `markerExists`
- evidence: E1/E4 at `Pglite.ts:257-265` — marker existence is forced false
  when the directory is absent, and the reader orders marked before missing;
  marked-without-directory is unrepresentable.

# Current shape

The compatibility preflight performs a directory probe, conditionally performs
a marker probe, and carries both booleans into two ordered branches. The domain
is one filesystem observation: the directory is missing, present without the
compatibility marker, or present with the marker.

# Cardinality gap

Four boolean pairs are representable and three probe states are legal:
`missing`, `unmarked`, and `marked`.

# Target schema

Define a private named `ChatDbDataDirMarkerState` LiteralKit with `missing`,
`unmarked`, and `marked`. Add an effectful classifier that first probes the
directory and probes the marker only for a present directory. Match that one
derived literal in `ensureCompatibleChatDbDataDir`; do not store it or change
the function's existing return contract. Import `LiteralKit` through the
current narrow `@beep/schema/LiteralKit` subpath.

# Migration inventory

- `apps/professional-desktop/src/runtime/Pglite.ts` imports and compatibility
  constants — add the narrow `@beep/schema/LiteralKit` import and private
  LiteralKit owner beside the marker domain.
- `Pglite.ts:252-268` — derive one marker state and replace the two boolean
  branches with an exhaustive match. `marked` retains the open-compatibility
  probe and false return; `missing` creates the directory and returns true;
  `unmarked` continues into the existing entry inspection.
- `Pglite.ts:270-292` — preserve empty, compatible PGlite, legacy/incompatible,
  quarantine, unreadable-directory, logging, and backup behavior unchanged.
- `Pglite.ts:400-408` — the `shouldMarkDataDir` consumer remains a separate
  post-migration decision and keeps its current boolean return contract.
- `test/integration/PgliteDataDirCompatibility.test.ts:137-278` — retain every
  direct consumer and exact filesystem fixture; no source barrel exposes the
  private classifier.

# Guard-deletion accounting

Delete `dataDirExists`, `markerExists`, the conditional false projection, and
the paired `if (markerExists)` / `if (!dataDirExists)` interpretation. The
classifier and one literal match become the sole coherence boundary.

# Encoded-side impact

None. The state is private and ephemeral. Directory names, compatibility marker
bytes, backup naming, logs, errors, the exported Effect return type, and PGlite
open/migration behavior remain unchanged.

# Test impact

Table-test missing, unmarked-empty, unmarked-compatible, unmarked-legacy,
marked-compatible, marked-incompatible, unreadable, and quarantine cases.
Assert the marker path is never probed before the directory exists and that the
marker is still written only after real open plus migrations. Keep the existing
app test imports and run focused desktop integration verification plus the
repository-required package/app check and changeset policy.

# Risk and sequencing

Land in Tier 1D with the other Professional Desktop state changes. The risk is
reordering filesystem effects or marking before migrations; the classifier
must only replace the two existence bits and leave every later action in its
current order.
