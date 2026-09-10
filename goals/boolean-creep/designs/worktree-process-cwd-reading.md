# worktree-process-cwd-reading

Native P2 design refresh before R29, bound to merged source HEAD
`f03850b762e41217b5a0c26f26041daee490a070` / main
`4f13d83e13d61275a57004050ffc62a90d86c014`. This preserves status `designed`
and cardinality 4/3. Tier 1: ordered Tier1E tooling batches with serial shared-file edits.
Independent P3 review and implementation acceptance remain pending.

Owner `ProcessCwdReading` at `packages/tooling/tool/cli/src/commands/Worktree/Fleet.service.ts:596`,
with members `unreadable`, `cwd`.
Storage/exposure: stored/internal; target: tagged-union.

The full public [source-impact audit](../data/pre-r29-main-4f13d8-source-impact.md),
[source bindings](../data/pre-r29-main-4f13d8-source-bindings.json), and
[row/design map](../data/pre-r29-main-4f13d8-row-design-map.json) bind this proposal.
The [exact original design](../history/designs/2026-09-09-pre-r29-main-4f13d8/worktree-process-cwd-reading.md) is preserved.
Keep complete decoded exports, typed request diagnostics, public constructor and
helper input domains, encoded keys/defaults/omission and full independent payloads
as specified below. Paths beginning `src/` or `test/` are relative to
`packages/tooling/tool/cli/` unless the design states otherwise.

# Current shape

Private ProcessCwdReading at Fleet.service.ts:593-610 carries cwd:Option<string> and unreadable:boolean. readLink succeeds with Some/full string and false; NotFound means vanished and writes None/false; other platform failures write None/true. Incoming clone enumeration at540-561 changes which checkout paths enter process attribution but leaves the probe declaration/body and its consumers byte-identical apart from line shifts.

# Cardinality gap

Four representable Boolean/presence tuples, three legal: vanished(false,None), unreadable(true,None), read(false,Some(cwd)). True/Some is not produced. E1 is the explicit Result writer605-609; the vanished comment593 is supporting documentation, not sole proof.

# Target schema

Use named annotated schema classes for payload-bearing cases, a LiteralKit for each finite discriminator domain, and schema-derived matching through `S.toTaggedUnion`. Keep schemas in the existing owner module and preserve complete payload types. Exact local Effect v4 references: `.repos/effect/packages/effect/SCHEMA.md:3135-3163`, `src/Schema.ts:5366-5390` (`decodeTo`), `:6105` (`toTaggedUnion`), `:1868` (`encodeUnknownEffect`), `:12848-12851` (`OptionFromNullOr`), and `src/SchemaTransformation.ts:333-340` (fallible bidirectional transformations). The local reference hashes are in the impact receipt; these API references are separate from corpus source pins.

Define private LiteralKit-backed annotated tagged cases vanished, unreadable and read({cwd:S.String}) in Fleet.service.ts. Replace the current private type with the schema-derived Type. Preserve arbitrary cwd strings and original Result-to-platform-error classification. Derive all matching/guards from the schema; no stored readable flag or Option duplicate.

# Migration inventory

- Fleet.service.ts:593-611: change all three producer branches, retaining platformErrorTag(error)!==NotFound semantics.
- Fleet.service.ts:613-645: replace getSomes of reading.cwd with extraction only from read cases, and reading.unreadable filter with schema case selection. Preserve longest containing path, stable path-length order, per-owner counts, scanned PID count and unreadable count.
- Fleet.service.ts session-registry scan following647 and scanFleet:1286-1313 consume the unchanged ProcessScan aggregate and checkout paths. ProcessScan complete/scanned/unreadable and session counts remain in their current contracts; no withdrawn process-scan design is a dependency.
- Fleet.service.ts:540-561,1286-1291: retain incoming NUL enumeration and unlisted clone fallback, so malformed listings still retain the clone as an attribution target rather than deleting it from the scan.
- FleetSnapshot coverage at Worktree.schemas.ts:1090-1112 and construction Fleet.service.ts:1307-1313 retain public process totals. Fleet.command.ts generic JSON and human rendering stay unchanged for this internal migration.
- Worktree/index.ts service wildcard exposes scan results but not this private reading. Keep the cases private; update public fleet scan test seams without exporting test-only constructors.
- worktree-fleet.test.ts and worktree-fleet-scan.test.ts cover scan/attribution and the new degraded fallback. Review current process-identity tests only as preserved dependency; the incoming ProcessIdentity unrecorded-procfs change does not justify forcing new prefixes or changing unknown fallback.

# Guard-deletion accounting

Delete the unreadable field and cwd Option from this private reading, and replace their two coordinated projections at641-644 with schema-derived selection. Keep Result/platform error classification, /proc listing failure, PID filtering, containment/attribution and aggregate completion calculation. Zero standalone validity guards exist for this type; do not claim deletion of process safety checks.

# Encoded-side impact

Tier 1 internal. The reading is never serialized; public snapshot coverage still receives numeric processesScanned/processesUnreadable and every checkout field stays flat. Vanished PIDs contribute to scanned but not unreadable; unknown errors remain unreadable. Keep full cwd payload until attribution and do not add tags to snapshots.

# Test impact

At implementation time cover read cwd, NotFound, permission/other failures, failed /proc enumeration, no matches and overlapping checkout paths. Assert complete original process counts and incoming malformed-listing degraded clone output. Preserve incoming raw procfs identity and recorded-prefixed replay behavior in its separate owner. Run focused fleet tests and CLI package verification at implementation; no tests ran here.

# Risk

A vanished PID must not become an unreadable coverage gap. Keep scope to the reading and its projections; do not require migration of ProcessScan or ProcessIdentity. Land in Tier 1E with serial Fleet.service changes; independent P3 remains pending.
