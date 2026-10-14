### sol-3-1
- file: scratchpad/effected/workspaces/WorkspaceRoot.ts:202
- class: bug   severity: required
- standard: D9/D11 and section 14, verified upstream-bug; `WorkspaceRoot`’s marker-file contract and its requirement to continue past unusable ancestors.   evidence: Read-only `bun --eval` probes against the lab and the frozen oracle used a valid `/repo/package.json` containing `{"name":"root","workspaces":[]}` and a directory created by the virtual file `/repo/packages/a/pnpm-workspace.yaml/child`. Both readers returned `/repo/packages/a` from `find("/repo/packages/a")`. A control with `/repo/packages/a/ordinary/child` returned `/repo`; a real `/repo/packages/a/pnpm-workspace.yaml` file correctly returned `/repo/packages/a`.
- failure: `fs.exists` accepts a directory as the pnpm workspace marker. That false marker stops the ascent and hides the valid ancestor workspace, causing downstream readers to operate against the wrong root.
- fix: Probe the pnpm marker with `fs.stat` and require `type === "File"`, preserving per-probe error absorption and continuing to the package.json check when the path is a directory. Add directory-marker and real-file controls to `WorkspaceRoot.test.ts`; record the verified upstream-bug deviation under section 14.

### sol-3-2
- file: scratchpad/effected/workspaces/WorkspaceDiscovery.ts:259
- class: test   severity: required
- standard: D10 and `scratchpad/EFFECTED_PORT_GOAL.md` section 11.4 require a generated encode/decode round-trip property for every exported schema; D11 treats binding-law violations as required.   evidence: At the reviewed commit, `WorkspaceDiscovery.property.test.ts:18` registers properties for the four error/info schemas but omits `WorkspaceDiscoveryOptions`. An exhaustive read of every workspaces test found zero references to `WorkspaceDiscoveryOptions`. A read-only derivation probe, `Arbitrary.schema(WorkspaceDiscoveryOptions)`, additionally threw `Unable to derive an arbitrary for an unsupported Declaration` at `["maxDepth"]`. The composite-options tests work around that declaration with a generator-only annotation, but do not test this owning schema.
- failure: The exported discovery-options schema does not meet the required property floor, and its unsupported depth declaration prevents directly adding the prescribed generator. Full execution coverage and the composite-schema properties leave this omission undetected.
- fix: Add a round-trip property for the actual `WorkspaceDiscoveryOptions` codec. Supply a generation link for the depth declaration, following the existing generator-only approach in `Workspaces.test.ts`, and use `fcRuns`. Preserve the production schema’s numeric acceptance and lazy defaults; retain explicit controls for omitted keys, present `undefined` on `stopAt`, and non-finite depth values.

### sol-3-3
- file: scratchpad/effected/workspaces/WorkspacePackage.ts:108
- class: test   severity: required
- standard: D10 and `scratchpad/EFFECTED_PORT_GOAL.md` section 11.4 require a generated encode/decode round-trip property for every exported schema; D11 treats binding-law violations as required.   evidence: At the reviewed commit, `WorkspacePackage.property.test.ts:27` tests `PublishConfig`, `WorkspaceManifestError`, and `WorkspacePackage`, but omits the newly exported `DependencyDiff` schema. An exhaustive read of every workspaces test found zero references to `DependencyDiff`. A read-only probe confirmed that `Arbitrary.schema(DependencyDiff)` derives successfully.
- failure: The new public diff codec has no required generated proof that its added, removed, and changed records survive encoding and decoding. Existing `dependencyDiff` operation tests exercise returned values without verifying this codec’s round-trip contract.
- fix: Import `DependencyDiff` into `WorkspacePackage.property.test.ts` and register it with the existing `roundTrips` helper, retaining its equivalence assertion, encoded-value stability assertion, and `fcRuns` configuration.

REQUIRED: 3
BACKLOG: 0