# DESIGN — Packet Convention Migration

## Change tree

```text
packages/tooling/tool/cli/src/commands/Goals/
├── Goals.command.ts                 register explicit migration commands
├── index.ts                         export public command/model surfaces
└── Migration/
    ├── Migration.schemas.ts         typed reports and closed vocabularies
    ├── ManifestTranslation.ts       pure actual-shape translation plans
    ├── FleetLint.ts                 cross-packet graph checks
    ├── PacketForkRepairApplier.ts   staged single-stream repair
    ├── PacketGenesisSeed.ts         honest stream adoption
    └── Migration.command.ts         preview/apply orchestration

packages/tooling/tool/cli/src/commands/Explore/Check.ts
packages/tooling/tool/cli/test/
goals/*/ops/{manifest.json,events/,trace.json}
```

The exact file split may collapse when a separate module would only create a
helper wall. The significant-symbol ledger in `SPEC.md` is binding; filenames
are not.

## Mutation boundaries

### Fork repair

Preview lists the deterministic survivor, losing files, and rebased event
drafts from `planForkRepair`. Apply builds a complete replacement stream in a
sibling staging directory, re-reads and folds it, then swaps it into place
while retaining a recoverable backup until verification succeeds. The normal
CAS store is unchanged and resumes sole append ownership after repair.

### Manifest translation

The translator parses raw JSON, probes observed fields, and emits surgical
JSONC edits. It does not encode/decode the manifest as a replacement object,
because the lenient `GoalManifest` decoder intentionally strips unknown keys.
Apply is all-or-nothing: any violation prevents writes. Reports remain useful
in preview and distinguish assumptions from issues.

### Genesis seeding

Only packets changed by this campaign and lacking `ops/events/` opt in. The
single event records adoption time, current status, and a current phase only
when a valid stage/ordinal pair is derivable. It asserts no earlier actors,
transitions, or dates. The existing projector renders the corresponding trace.

## Fleet graph semantics

- Duplicate slug: two manifests declare the same `initiative.id`.
- Cycle: a directed `blockedBy` dependency cycle between known goal slugs.
- Unreachable reference: `blockedBy` or `supersededBy` names no goal manifest.
- A reference to a known but not-yet-v2 packet is a warning during preview;
  invalid structure or a dangling reference is a violation.

## Failure behavior

No apply occurs while a translation or fleet-lint violation exists. Warnings
remain visible but do not block ordered migration. Every report is sorted by
packet and kind so repeated runs are byte-stable.
