# runners-bake-cli-mode: current raw-owner disposition

Future-main preparation only. Native P2 verification used `gpt-6-astra` with
`xhigh` reasoning, retaining the actual parent-confirmed launch provenance.
The source checkout is HEAD `04cc73e733758e39a4e15ec294f86ef74ecc66c5` over
main `702e815971a4030806cdbd9e8f6aa9260d0d3b62`. All Runners source and tests
match both commits. Canonical R31 remains pinned at HEAD
`4509872869eb87071250c67717769260f850bcf5` / main
`d68f1a11dd41579660a6c72f3d3e060d6b61352d`; it is not changed here.

Proposed disposition: preserve the stable id and raw owner, reclassify it D1,
and archive/remove its implementation design from the qualified design set.
Do not install this disposition as a new qualified design. The previous full
design, family file, inventory and exact row are preserved under `before/`.
No P3, implementation, test, census or dry-round credit is claimed.

All abbreviated source/test paths below are relative to
`packages/tooling/tool/cli/`.

## Current shape

`BakeCliOptions` at `src/commands/Runners/Runners.command.ts:93-106` is a named
raw request type, not an anonymous parameter-only owner and not the return of
normalization. It contains three actual Booleans (`plan`, `check`, `json`),
strings (`region`, `baseAmiParameter`, `instanceType`), Options of strings
(`subnet`, `securityGroup`, `instanceProfile`, `report`, new `manifest`) and
an Option of a string record (`tags`). The original selected pair is plan/check.
The actual owner passes the net, but that does not establish a cardinality gap.

The request flows from the CLI handler :225-226 and from the exported
`runBakeCommandForTesting` :183-185 into the same `runBakeCommand` :108-166.
The test seam's documented purpose at :169-177 explicitly includes flag
validation with an injected service. Its public export is retained in
`commands/Runners/index.ts:14`. The new supported negative fixture at
`test/runners-bake.test.ts:309-323` passes a full request with default bake
flags and Some("image.json"), then expects `--manifest requires --check`.
This is a legitimate input to the raw request/diagnostic seam, even though
it does not describe an executable operation.

`resolveBakeMode` at :38-45 is independently exported and dual. Direct tests
at :373-380 exercise plan, check, default and conflict. Its true/true branch
returns the exact RunnersCommandError; it does not reject a raw schema decode.
Within the command, service access :109 precedes mode resolution :110,
manifest validation :111-113, operation dispatch :114-166, and output/errors.
The literal `mode` already represents successful selection. No current
schema/object/instantiated result containing narrowed mode Booleans exists
after resolution. A proposed post-validation union would be new code, not
an eligible current owner for the old row's evidence.

## Cardinality gap

The actual raw request has no proven gap for its selected pair. All four
plan/check inputs have defined handler outcomes, and the source explicitly
returns a typed diagnostic for true/true. `json` is an independent output
choice in all branches. The new manifest Option adds eight projected
plan/check/presence requests, each supported as a raw input:

| plan | check | manifest | First branch after acquiring the service |
| --- | --- | --- | --- |
| false | false | None | Bake: validate subnet then security group, obtain clock, construct BakeConfig, call bake. |
| false | false | Some(path) | `runners bake: --manifest requires --check.` |
| false | true | None | Live-image check through `service.check(region)`. |
| false | true | Some(path) | Intended-image check through `service.checkManifest(path)`. |
| true | false | None | Plan through `service.plan`. |
| true | false | Some(path) | `runners bake: --manifest requires --check.` |
| true | true | None | `runners bake: --plan and --check are mutually exclusive.` |
| true | true | Some(path) | The same plan/check conflict, before manifest validation. |

Every row retains both json choices, yielding sixteen Boolean/presence
requests when that independent output flag is included. This finite table
holds the other payloads at supported values; it does not reduce their full
string/Option domains to single values or claim that all bakes succeed.
Service errors and bake placement validation remain part of each request's
existing behavior.

The former 4/3 number describes successful BakeMode values, not the supported
raw owner. The new 8/4 number likewise counts successful operation branches
while deleting four required diagnostic requests. Neither can qualify this
owner. The old E2 citation :44 is a successful-return projection inside the
resolver; its preceding explicit error path at :42-43 and the public raw
validation seam are part of the contract. No actual eligible narrowed Boolean
carrier was found to support a re-anchor. No new id or kind is proposed.

## Target schema

None for this disqualified owner. Keep the current raw request, its full
accepted input contract and error-producing boundary. Do not replace the
raw testing seam with a validated options class, add an 8/4 operation schema
and attribute it to today's owner, remove manifest-bearing error inputs, or
normalize true/true into a successful mode. A useful refactor is not a
qualification proof.

Retain existing `BakeMode` at `Runners.schemas.ts:64-83`. No duplicate mode
LiteralKit, new tagged union, input codec, decoded alias, default, schema
constraint, or export change is required by this P2 disposition. The original
implementation design is not semantically adequate with a binding prefix:
it omits manifest, narrows the raw test-seam inputs to mode, and counts only
successful requests. Preserve it in history rather than present it as a
current executable design.

## Migration inventory

There is no source migration. This complete preservation inventory makes the
retirement scope reviewable:

| Current site | Preserve |
| --- | --- |
| Runners.command.ts:38-45 | Both `resolveBakeMode(plan, check)` and `resolveBakeMode(check)(plan)` forms, default bake, plan/check results and exact conflict error. Direct curried typing is a supported declared API even though the current direct test uses data-first. |
| Runners.command.ts:93-106 | Complete raw request, all twelve fields including manifest, and all diagnostic input combinations. Do not import a new narrow operation schema into this declaration. |
| Runners.command.ts:108-113 | Service acquisition first, plan/check resolution second, manifest-requires-check diagnostic third. Conflict wins when both flags and a manifest are supplied. Manifest rejection precedes required bake flags. |
| Runners.command.ts:114-120 | Plan selection and existing text/JSON encoding. Extra bake-only raw payloads remain accepted and ignored here. |
| Runners.command.ts:122-143 | None routes to check(region); Some(path) routes only to checkManifest(path). Preserve full path value and current resolution in the service. Report output precedes stale failure, and encoding/output failures still prevent the later stale diagnostic. |
| Runners.command.ts:135-137 | Intended manifest and live AMI have distinct stale messages. The manifest branch must not fall through to live AWS checks. |
| Runners.command.ts:145-163 | Subnet validation, then security group, then clock, BakeConfig construction and bake/report behavior. Preserve optional instance profile, tags fallback, report Option, region, parameter and instance-type semantics. |
| Runners.command.ts:183-185 | Exported test seam accepts the same raw request and injected service. The manifest validation fixture remains expressible without a cast, fake schema or separate unsupported adapter. |
| Runners.command.ts:188-234 | Exact parser flags and defaults, path parsers, handler diagnostic catch, reported exit and service provision. Preserve plan/check/json=false; region=us-east-1; default base AMI path; instanceType=r7a.2xlarge; all optional parser values. |
| Runners.schemas.ts:64-83,120-137,199-226 | Existing mode kit, BakeConfig defaults/constraints at their current stage, and BakeManifestJson's four-field subset of BakeReport. No mode-driven schema rewrite. |
| Runners.service.ts:189-194,749-831,874-887 | Existing service shape, live check, checkManifest and captured-context layers. The freshness owner separately updates the shared report contract, not these mode inputs. |
| commands/Runners/index.ts:14,39; src/index.ts:328; commands/Root.ts:35,92 | Existing facade, manifest codec export and command registration. Preserve resolver and test seam exports. |
| test/runners-bake.test.ts:110-123,187-195,241-338,373-418 | Complete base raw fixture, stub's checkManifest method, raw command helper, manifest service/validation/stale fixtures, four resolver outcomes, command render outputs and required-bake diagnostics. |

The inherited design's claimed test-line mappings are stale after the new
103-line manifest suite. The complete diff and before/future files provide
exact replacements; the live source/test symbols listed above were searched
across `packages/` and `apps/`. The first Graft query failed because the isolated
checkout has no graph. Parent authorized scoped source/barrel searches and
prohibited building an index during the proof. No missing edge was treated as
absence evidence.

## Guard-deletion accounting

Delete no runtime guard for this D1 owner. The plan/check conflict guard,
manifest-requires-check diagnostic, required-subnet and required-security-group
checks, Option dispatch and distinct stale errors preserve the supported raw
request contract. They are not redundant coherence checks in a successfully
constructed operation record. Removing or replacing them with generic schema
failures would change behavior verified through the exported test seam.

Delete no flag declarations, compatibility export, renderer, report codec or
service method. The canonical packet change, if the parent accepts this
proposal after R31, is a D1 row plus archived qualified design and the bounded
family-scope correction. Source remains untouched.

## Encoded-side impact

No encoded change. Preserve CLI spellings, defaults, parser path behavior,
exact error strings, output order and reported exit handling. Keep
BakePlanJson/BakeReportJson/BakeCheckReportJson and BakeManifestJson behavior.
The manifest reader accepts both full bake reports and the observed minimal
freshness subset; the mode refresh does not narrow either input.

The sibling `runners-bake-freshness` design owns BakeCheckReport and its legacy
wire representation, shared compareBakeInputs output, renderCheck and fresh/
stale result handling. This row's withdrawal neither withdraws that independent
qualification nor changes its compatibility obligations. Preserve the intended
production pin/YAML validation, no-AWS manifest path and upstream typed errors.
No dependency, lockfile, generated file or package script/export change is
proposed.

## Test impact

No product or package test was run or changed. Current negative request tests
remain exactly representable, including manifest with default bake flags at
:311-314. The same command handler preserves conflict-before-manifest and
manifest-before-required-placement ordering by source inspection. The existing
manifest live-service fixture :242-307 checks the full and minimal codec forms,
all freshness keys, pin mismatch, malformed manifest, and no AWS invocation;
:309-323 checks mode validation/routing; :325-338 checks intended stale text
following report output. Existing live stale output at :396-403 remains.

The private raw-request matrix is a source interpretation, not a new test or
runtime proof. No schema test is requested to manufacture either supported or
unsupported tuples. If a later authorized implementation changes this command,
its diagnostics must be tested through the same raw boundary. This P2
reclassification requires packet validation only, under parent integration.

## Risk

The principal risk is confusing a successful mode's range with its request
carrier's legal input domain. True/true is rejected as an operation but accepted
as a request that reports a deliberate typed error. The manifest addition makes
the raw diagnostic contract concrete in an exported fixture. An operation
union designed after validation cannot retroactively qualify the existing owner.

This is a correction to inherited qualification/design reasoning exposed by
new source behavior, not a production bug report. Reclassification changes the
row from historically reviewed to disqualified/D1 and retires this design.
No replacement independent review is implied. Parent must approve/integrate
only after R31's frozen inputs are released, then reassess the new inventory
projection. Current source and dependency bindings are immutable snapshots;
advisory Effect reference movement is recorded separately at handoff.
