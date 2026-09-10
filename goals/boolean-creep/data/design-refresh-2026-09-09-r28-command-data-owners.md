# R28 command data-owner boundaries

Date: 2026-09-09. Frozen HEAD
`93217d998f851e2e93d9864e2b5315552eaa58a7`; frozen main
`d1b4d769fbaffddd55717f3b1ba461897dd545c5`.

This bounded P2 audit resolves two metadata questions from
`data/design-refresh-2026-09-09-r28-cli-first-owners.md` and
`data/design-refresh-2026-09-09-r28-observability-docgen.md`.
Those audits were read first and remain unchanged. Only this new file is
written for this task. No source, test, current design, inventory, archive,
status, ref, index or service changes occur; no package command or independent
Grok/P3 review is claimed.

## Dispositions

| Stable id | Disposition |
| --- | --- |
| `r25-tool-docgen-cli-config-toggles` | Retain D1; reanchor to the actual object passed to `Configuration.load`, opening at `CLI.ts:168`, with its first Boolean Option member at 175. Four complete Option<Boolean> domains support 81/81 combinations. |
| `create-package-command-flags` | Withdraw the descriptor/anonymous-handler-parameter row from the live census. No separate five-member Boolean data model or constructed request object was found. A real downstream `ScaffoldShape` is different and already inventoried. |

The actual filename is uppercase `packages/tooling/tool/docgen/src/CLI.ts`.
`docgenCommand` in the proposed row is the existing enclosing-symbol locator;
it does not claim that the exported Command handle itself stores these
Boolean values. The source anchor and `object-literal` kind identify the
specific runtime load-request construction.

## Docgen: actual request object and full independent domains

`CLI.ts:53-71` declares four `Flag.boolean(...).pipe(Flag.optional)`
handles. `options` at 115-133 is a collection of those descriptors.
`docgenCommand` at 156 is a Command handle, and `input` at 159 is the
anonymous handler parameter. None is the object-literal Boolean data owner
claimed by the earlier metadata proposal.

The actual constructed data owner is the object expression at 168-184:

```ts
const config = yield* Configuration.load({
  // Complete path, theme, compiler and glob payloads also supplied.
  enableSearch: input.enableSearch,
  enforceDescriptions: input.enforceDescriptions,
  enforceExamples: input.enforceExamples,
  enforceVersion: input.enforceVersion,
  // Remaining payloads preserved.
});
```

The real members at 175-178 are parsed `Option<boolean>` values, copied
without masking siblings. The receiving named `LoadArgs` type explicitly
declares all four `O.Option<boolean>` fields at
`Configuration.ts:344-349`. This is an actual load request object with
Boolean Option values, rather than an inferred object manufactured for the
inventory or a relocation to the callback parameter.

Each domain is None / Some(false) / Some(true). The installed Effect v4
Flag API at `node_modules/effect/src/unstable/cli/Flag.ts:59-76` documents
positive and negative Boolean flags; `optional` at 775 preserves omission
as an Option. The local Effect reference agrees at
`.repos/effect/packages/effect/src/unstable/cli/Flag.ts:59-76,600`, with
capitalized constructor spelling in that reference. This audit does not
substitute that spelling into the frozen product source.

The four Boolean controls are not grouped by an exclusive-choice parser or
a later combination guard. In `Configuration.load`, lines 570-573 resolve
each independently with `O.getOrElse`, and lines 599-603 pass each resulting
Boolean to `Configuration.of`. For each field:

| Input | Resolution |
| --- | --- |
| None | That same field's docgen configuration value |
| Some(false) | false, including when the configured default is true |
| Some(true) | true, including when the configured default is false |

When no file config exists, `ConfigurationSchema.make({})` supplies the
defaults at 554: search true, descriptions false, examples false, version
true, defined independently at 102-113. A loaded file supplies its own
values; omission of a CLI overlay must not overwrite those file values.
Some(false) is never treated as absence or replaced through Boolean `||`.

The complete optional-input state space is **3^4 = 81, all legal settings**.
The resolved Boolean settings have **2^4 = 16, all legal settings**. These
are different owners/domains. The actual consumers reinforce independence:
`Core.ts:694,733` renders the search setting; `Checker.ts:58-76` applies
the three documentation checks separately and can accumulate their errors.
A particular document failing an enabled check does not make its configuration
tuple an invalid combination. D1 here describes accepted settings, not a
promise that every document succeeds under every setting.

All other fields in the actual request stay intact: optional config path,
homepage/source link, directories, theme, executable, include/exclude globs,
and complete parse/examples compiler inputs at 169-183. The two compiler
inputs are resolved before this object at 160-167. Their payload dimensions
are not additional Boolean axes. Layer construction at 186-193 and the
project-name error prefix at 194-202 remain unchanged.

Actual fixtures in `Configuration.test.ts:15-30` construct a complete
all-None request. The default assertions at 73-99 cover the four resolved
defaults; the alternate-file fixture at 175-188 passes a concrete request
with `configFile` Some. The public source example at
`Configuration.ts:511-537` also shows mixed None, Some(false) and Some(true)
overlays. No exhaustive 81-row test is claimed or run; full legality follows
from the supported parser domains and independent loader/read behavior.

## Create-package: descriptors, parameter aliases and downstream owners

`CreatePackage.command.ts:1107-1166` constructs a Command descriptor. The
five fields at 1121,1127,1152,1156,1160 are Flag objects with false defaults,
not Boolean fields in a named request schema. The anonymous Effect handler
receives `config` at 1170. Its body const destructuring at 1171-1185 copies
`lab`, `reuseRetiredName`, `dryRun`, `skipLockfile` and `withStoriesTsconfig`.

Those destructured bindings really are Boolean values. The scope correction
does not deny their existence. They are direct aliases of the anonymous
function's flag parameters, not a separately declared data owner or newly
constructed five-member request/state object. Reclassifying that same
parameter bag as `createPackageCommand.config` or inventing a
`CreatePackageOptions` model would evade the explicit function-flag-parameter
exclusion. The named `createPackageCommand` export remains a command handle.

The full five-member producer/reader trace is bounded to this handler:

| Member | Actual uses and later ownership |
| --- | --- |
| `lab` | Validation at 1218-1222; directory choice at 1372; workspace/path guards at 1400-1412; copied into `ScaffoldShape` at 1415; dry-run identity output at 1433; portless label at 1471; renamed `isLab` in `TemplateContext` at 1496; manifest creation at 1547; identity registration at 1592. |
| `reuseRetiredName` | Passed as a flag parameter to `ensureRetiredNameAllowed` at 1397; helper 990-1004 reads it against registry membership, returns `retiredNameReused` and preserves a typed refusal. It is not copied into the later five-member object. |
| `dryRun` | Controls existing-directory check at 1421 and preview/early return at 1431-1465. No later data carrier stores this input flag. |
| `skipLockfile` | Controls preview text at 1462, derived `lockfileRefreshed` at 1606 and final skip output at 1642. No later five-member carrier stores it. |
| `withStoriesTsconfig` | Validated at 1320-1332 and copied into `ScaffoldShape` at 1415. Its downstream template/file/directory/script readers consume that separate shape. |

The concrete construction at 1415 is
`ScaffoldShape.make({ appKind, lab, withStoriesTsconfig })`, whose schema
at 477-486 declares precisely those fields. It has neither retired-name
reuse nor dry-run nor lockfile skip. The later `TemplateContext.make` at
1477-1502 carries a renamed lab projection and template-specific data;
it also does not contain the original five-member set. Their existing
canonical rows cannot be used to claim this broad command row is covered
by a new five-field owner.

Exports do not create another data contract: the CreatePackage barrel at
`commands/CreatePackage/index.ts:14` reexports the command module; the CLI
barrel at `src/index.ts:118` exports the Command; `commands/Root.ts:18,93`
registers it as a subcommand. Actual tests call `Command.runWith` using
argument arrays at `create-package.test.ts:27-31` and
`create-package-lab.test.ts:42-46`. These runner fixtures are not named
source request schemas or five-Boolean object constructors.

Behavior remains fully preserved by the withdrawal. The stories refusal
fixture at `create-package.test.ts:1112-1138` asserts its exact diagnostic.
The retired-name fixture at `create-package-lab.test.ts:818-866` covers
normal and dry-run refusal, explicitly authorized dry-run reuse with no
registry mutation, and subsequent real reuse. No diagnostic, default,
scaffolding, lockfile, directory or registry behavior is changed. Do not
turn this census withdrawal into a product parameter refactor.

## Adjacent owner caveat and follow-up boundary

The old broad note says all five controls combine freely and refers to
ScaffoldShape's correlated subset. The existing
`create-package-scaffold-shape` D1 note separately says lab and stories
combine freely. That successful-operation assertion is contradicted by
the actual single writer: lab validation at 1218 requires app mode, while
stories validation at 1321 requires a foundation/ui-system library.
Both true therefore cannot reach `ScaffoldShape.make` at 1415.

This establishes a material concern in a different actual schema owner;
it does not make the excluded broad command parameter row qualified.
The parent authorized a separate bounded follow-up to resolve the complete
ScaffoldShape schema/optional literal domain, all constructors, exports,
readers and tests before any new qualification. This file freezes the two
requested metadata dispositions; the separate follow-up must own any full
cardinality/provisional proposal and avoid overlapping broad/narrow coverage.

Docgen's existing `LoadArgs`, `ConfigurationSchema` and `ConfigurationShape`
D1 rows represent different declared owners and remain separate. The
LoadArgs note's “16 combinations” can only describe resolved settings;
its four actual Option<Boolean> fields have 81 input combinations. The
prior observability/docgen audit already records that correction. Do not
duplicate the CLI request object under a second new id.

## Exact proposed live row and withdrawal action

Retain the existing docgen id and enclosing locator, but anchor to the
first actual Boolean Option member of the runtime request object:

```jsonl
{"schemaVersion":"boolean-creep-inventory/v1","id":"r25-tool-docgen-cli-config-toggles","file":"packages/tooling/tool/docgen/src/CLI.ts","line":175,"symbol":"docgenCommand","kind":"object-literal","members":["enableSearch","enforceDescriptions","enforceExamples","enforceVersion"],"status":"disqualified","disqualifier":{"class":"D1","note":"Actual parsed-value object passed to Configuration.load at168-184, with four Option<boolean> members175-178. Each independently supports None, Some(false), Some(true): all81 input combinations are legal settings. Configuration.load570-573 resolves each None against that field's file/default value; explicit false and true remain unchanged. Documentation-check failures are content diagnostics, not invalid configuration tuples."},"notes":"Frozen HEAD93217d998f851e2e93d9864e2b5315552eaa58a7/main d1b4d769fbaffddd55717f3b1ba461897dd545c5. docgenCommand is the enclosing-symbol locator only: the data owner is the Configuration.load argument object, not Command.make156, descriptor options115-133 or Flag handles53-71. Preserve all path/theme/glob/compiler payloads and defaults true/false/false/true. Supersedes the incorrect object-literal anchor156 in the prior observability-docgen audit. See data/design-refresh-2026-09-09-r28-command-data-owners.md."}
```

Parent integration action, not an inventory/v1 replacement row:

```json
{"id":"create-package-command-flags","action":"withdraw-out-of-net","file":"packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts","rowSha256":"3cb209a1b007d0f8437978e48ad2889b118d76adada5997d9c889566c36a5a56","proof":"Flag descriptor bag1109-1166 and anonymous handler config1170; const destructuring1171-1185 aliases those parameters. No separately declared or constructed five-member data owner follows. ScaffoldShape.make1415 carries only appKind/lab/withStoriesTsconfig and is separately inventoried. Preserve actual CLI defaults, typed refusals and behavior; archive the old D1 reasoning rather than inventing an owner or status."}
```

## Source and row hashes

SHA-256. Row hashes are over the exact current inventory line bytes with
no trailing newline. They bind the pre-integration snapshot, not a claim
that the live inventory cannot change concurrently.

| Existing row | SHA-256 |
| --- | --- |
| `r25-tool-docgen-cli-config-toggles` | `ff7a4ac80b9d45885684f7324251716b056a5b11749da95313e6e8e803ac7d72` |
| `create-package-command-flags` | `3cb209a1b007d0f8437978e48ad2889b118d76adada5997d9c889566c36a5a56` |

| Path | SHA-256 |
| --- | --- |
| `packages/tooling/tool/docgen/src/CLI.ts` | `bdbee0f4068afecb084396dd491f665a8264c0de1f2cda06e1d786c02a89507a` |
| `packages/tooling/tool/docgen/src/Configuration.ts` | `ac1a676711a1eb1d4837403d642469e2ecb72e8af984892959605293b450e1fd` |
| `packages/tooling/tool/docgen/src/Checker.ts` | `b180f70055ff7ca72984fd83ff145f1bcf1400f7d94afcb36437c972c7e9cbc0` |
| `packages/tooling/tool/docgen/src/Core.ts` | `d6ba58abb574a4f37b789772d4bbbe253eb36628d7a9a8470b0b22628a9becca` |
| `packages/tooling/tool/docgen/test/Configuration.test.ts` | `d530559efd2f91067c98c08b4ddcb3d19ff1d5fc7414b74d1ae814af1f0a150e` |
| `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts` | `8b3108c7db97b1817f9f1504fc1e8d34ce3c72219b18c456e609920bb4203b75` |
| `packages/tooling/tool/cli/src/commands/CreatePackage/index.ts` | `4097f8871b5b25b21611d31fa04d59fa434fbb456f25ebb2c59e13f45bc43482` |
| `packages/tooling/tool/cli/src/index.ts` | `19c10f83b6e17ae87269aa30da8f95fb06108e01ef1330f693281b237cd7c6b8` |
| `packages/tooling/tool/cli/src/commands/Root.ts` | `fe224f04bbf3099678acd77912c67f14c9834dba085cf14994e4412b72f05a64` |
| `packages/tooling/tool/cli/test/create-package.test.ts` | `b20130164ddfd6e4a8e33e4b69553e7b8843bb483c454a5665fe6dc5bf8f296a` |
| `packages/tooling/tool/cli/test/create-package-lab.test.ts` | `d6fa0d3a5a9dc21ad0c65ecb375662e687721a654738d4b7600528a4053818d9` |
| `data/design-refresh-2026-09-09-r28-cli-first-owners.md` | `611d6d0bc3ad5dd378b7680a79cf4622d60d45cbbfb7eef0b6b72c5d2e9b8f02` |
| `data/design-refresh-2026-09-09-r28-observability-docgen.md` | `7d861e0f6370c5010e68a464828b16b725eb18f276eeb6e1eb5e444c27626aa7` |
| `.repos/effect/packages/effect/src/unstable/cli/Flag.ts` | `176ac1bf637200cec7bbf12b87168cca55c762b1e018d67c233069ebc7eb889d` |
| `node_modules/effect/src/unstable/cli/Flag.ts` | `4f4f45fdb2976d5bd2c072bef3e24d4db414b6b77b1e3c5e7980d57cf76bb824` |

Product source/fixture bytes were checked against frozen HEAD. The local
Effect reference and installed dependency are supporting API evidence,
not additions to the scanned corpus. Prior audit bytes remain unchanged.

## Validation and limits

Validated JSON parsing, exact source anchors, the 81-input/16-resolved domain
enumeration, recorded hashes and duplicate owner/member keys after simulated
replacement/withdrawal in memory.
No product test, package command, compiler invocation or service was run.
These dispositions need parent integration and the lane's independent
correction; they do not constitute P3 or a broad resweep. Graft-first
discovery reported 152,038 tokens saved across three calls in this task.
