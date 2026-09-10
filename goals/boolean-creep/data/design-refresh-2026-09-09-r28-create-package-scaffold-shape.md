# R28 CreatePackage ScaffoldShape owner correction

Date: 2026-09-09. Frozen HEAD
`93217d998f851e2e93d9864e2b5315552eaa58a7`; frozen main
`d1b4d769fbaffddd55717f3b1ba461897dd545c5`.

**Propose qualification of the existing `create-package-scaffold-shape` id
as a complete three-member 24/11 instance.** Its existing two-Boolean D1
note is false for the actual private post-validation owner. The parent
authorized this bounded continuation after the separate command-data audit
proved that concern. That finalized audit remains unchanged at
`data/design-refresh-2026-09-09-r28-command-data-owners.md`, SHA-256
`9147d713575e238148d7da23cad95a62affc79f4bc5b74e3223b9ca7aa1169ad`.

This is P2 source/design evidence for the lane's pending independent
correction. No canonical/current-design/source/test/archive/ref/index/service
mutation occurs and no Grok/P3 acceptance is claimed. The companion
provisional is `data/provisional-r28-create-package-scaffold-shape.md`.

## Actual declaration, full domain and defaults

All product citations in this section refer to
`packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts`.
The actual schema is the private `S.Class` named `ScaffoldShape` at
477-486, with exactly three own members:

| Member | Declaration | Complete decoded domain |
| --- | --- | --- |
| `appKind` | 479: `S.OptionFromOptionalKey(AppKind)` | None, Some(nextjs), Some(vite), Some(service), Some(tauri), Some(runtime-proof) |
| `lab` | 480: `S.Boolean` | false / true |
| `withStoriesTsconfig` | 481: `S.Boolean` | false / true |

`AppKind` is the existing LiteralKit at 225-239 built from exactly five
`VALID_APP_KINDS` literals at 135. It must not be reduced to a single
Some/None bit: the runtime-proof case has different lab legality and
different output behavior from the four runnable app kinds. No string,
array, count or nested payload axis is added to this three-field owner.

`OptionFromOptionalKey` describes optional encoded-key presence, not a
nullable decoded value. Local Effect v4 source at
`.repos/effect/packages/effect/src/Schema.ts:13266-13284` maps missing key
to None and Some back to a present encoded literal. The decoded field is
a required Option; `Option` at 12780-12826 checks an actual Option and
validates a Some payload against the literal schema. No NullOr schema or
Some(null) case exists. Do not invent an extra null state or conflate
decoded None with an arbitrary null payload.

The class attaches no Boolean or explicit None constructor default.
Its sole actual `.make` call supplies all three decoded values at 1415.
The raw CLI supplies false defaults for lab at 1122 and stories at 1161;
the app-kind flag defaults to an empty string at 1119 and becomes None
or a decoded Some literal at 1213-1215. Those parser defaults remain
outside the schema's declared 24-shape product.

## Allocation after validation, not a raw diagnostic request

The command descriptor and anonymous handler parameter are outside the
campaign's net, as documented in the finalized command-data audit. The
separate eligible data owner is actually allocated here:

```ts
const scaffoldShape = ScaffoldShape.make({ appKind, lab, withStoriesTsconfig });
```

This single allocation at 1415 follows all relevant validation:

- 1188-1215 validates package type and app-kind legality. A non-app cannot
  specify app-kind, and an app requires a valid app-kind. Consequently
  app-kind None at this allocation denotes a library/tool package scaffold.
- 1218-1222 invokes the lab refusal rules at 957-984. Lab requires app
  mode, excludes runtime-proof, rejects a parent override and requires
  nonblank description. Thus `lab => appKind` is one of the four real
  app kinds, never None or runtime-proof.
- 1320-1332 admits stories only for a foundation/ui-system library.
  The earlier type/app-kind rules imply
  `withStoriesTsconfig => appKind=None && lab=false`.
- Name/path/repository/retired-name/lab-workspace checks also precede 1415.
  The later existing-directory check at 1421 and execution steps do not
  add an alternative writer or make the shape a raw conflict request.

The exact raw CLI diagnostics are intentional behavior and remain before
allocation. Their existence alone would not qualify the raw parameter
bag; the relevant fact is that this private operation value is never
constructed for those invalid combinations. Generic schema `.make`
permissiveness is its representational gap, not evidence of an additional
supported writer. No public schema constructor or external request decoder
provides such a writer.

## Complete 24/11 cardinality

Six decoded app-kind values times two lab values times two stories values
gives 24 representable shapes. Eleven are legal at the actual owner:

| appKind | lab | stories | Proposed literal |
| --- | --- | --- | --- |
| None | false | false | package |
| None | false | true | package-with-stories |
| Some(nextjs) | false | false | nextjs |
| Some(nextjs) | true | false | nextjs-lab |
| Some(vite) | false | false | vite |
| Some(vite) | true | false | vite-lab |
| Some(service) | false | false | service |
| Some(service) | true | false | service-lab |
| Some(tauri) | false | false | tauri |
| Some(tauri) | true | false | tauri-lab |
| Some(runtime-proof) | false | false | runtime-proof |

The other thirteen shapes are excluded by the two implications above.
The original `[lab,withStoriesTsconfig]` projection has four representable
and three legal pairs, not four independent pairs. It is not the full
connected cluster because both fields also constrain appKind. Retain the
existing id, expand its members and replace its D1 disposition; do not add
a separate pair-only union or keep the narrow row alongside the broad one.

Package type, package family/kind metadata, description, paths, retired-name
facts and lockfile state are different values outside ScaffoldShape. They
are preserved payloads/inputs at existing interfaces, not missing flags
to multiply into this owner's count.

## Supported constructors, readers and public boundary

Graft's exhaustive search found the class, one `.make` and all direct
readers. Its structural caller graph returned no edges for the class;
that absence was not used as proof. Exact `ScaffoldShape` source/fixture
search across packages/apps confirmed only the following file-local uses.
No test constructs or decodes the schema directly.

| Site | Behavior and preservation requirement |
| --- | --- |
| 1415 | Sole actual constructor, after the raw diagnostic gates. |
| 488-509, called at 1509 | Package/stories templates; Next.js and Vite lab variants; service/Tauri templates; runtime-proof package fallback. Preserve ordered template requests and complete context. |
| 513-519, called at 1572 | Only Tauri/tauri-lab contributes static assets; preserve exact asset/output paths and verbatim bytes. |
| 640-660, called at 1457 and 1615 | Ordered dry-run and summary file lists; stories extras; lab-specific variants followed by lab manifest path. |
| 683-699, called at 1552 | Package/stories and four app directory lists, with runtime-proof package fallback. |
| 1991-2055, called at 1537-1546 | Manifest selection and canonical JSON encoding. Preserve all separate name/type/description/path/family-kind/portless/Effect-version inputs. |

`generatePackageJson` is private, as are the template/file/directory/asset
selectors and `ScaffoldShape`. The module exports only
`resolveCreatePackageTemplateDir` at 107, `TemplateContext` at 732 and
`createPackageCommand` at 1107. Its barrel and the CLI barrel cannot export
unexported declarations. Root command registration and the test runner
consume the public Command, not ScaffoldShape. There are no shape encoder,
decoder, schema export, reflected JSON schema, persisted shape fixture or
outside constructor paths in the audited source.

Generated product data still crosses its existing encoders: manifest JSON
uses `encodeManifestJson` at 1929-1931 and the canonical package encoder;
lab manifests retain their existing encoder; template requests and file
plans retain their complete payloads. The private shape is never itself
serialized. Removing its unused optional-key representation does not
authorize changing any generated file or CLI input format.

## Positive fixtures for all eleven states

These existing tests invoke the actual exported Command through argv,
thereby executing its real validation and sole construction. Tests were
read, not run for this audit.

| Legal family | Actual fixtures |
| --- | --- |
| package | `create-package.test.ts:575-625`, invocation 583-589, plus foundation/tooling/driver/ecosystem package cases later in that file. |
| package-with-stories | `create-package.test.ts:1044-1109`, real creation at 1055-1064 and dry-run at 1092-1102; assertions preserve story files, scripts and config payloads. |
| nextjs / nextjs-lab | `create-package.test.ts:699-759`, invocation 707-715; `create-package-lab.test.ts:401-410`. |
| vite / vite-lab | `create-package.test.ts:841-906`, invocation 859-867; `create-package-lab.test.ts:479-488`. |
| service / service-lab | `create-package.test.ts:909-940`, invocation 917-925; `create-package-lab.test.ts:533-542`. |
| tauri / tauri-lab | `create-package.test.ts:762-838`, invocation 770-778; `create-package-lab.test.ts:607-616`. |
| runtime-proof | `create-package.test.ts:943-985`, invocation 951-959 and package-like output assertions 966-981. The name contains “lab” but the argv does not pass --lab. |

Invalid-input fixtures preserve app-kind-required diagnostics at
`create-package.test.ts:628-645`, stories restrictions at 1112-1138,
and lab wrong-type/runtime-proof/parent/description refusals at
`create-package-lab.test.ts:696-744`. This is positive evidence of
intentional raw request diagnostics and eleven supported resolved values,
not merely a count of branches or generic schema acceptance.

## Proposed row and duplicate accounting

Parent integration proposal only; correction requires independent admission
before the provisional becomes a current design.

```jsonl
{"schemaVersion":"boolean-creep-inventory/v1","id":"create-package-scaffold-shape","file":"packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts","line":479,"symbol":"ScaffoldShape","kind":"schema-struct","members":["appKind","lab","withStoriesTsconfig"],"status":"confirmed","evidence":[{"class":"E4","cite":{"file":"packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts","line":1415},"note":"The only private constructor runs after app-kind/lab/stories validation. Lab requires Some(nextjs|vite|service|tauri); stories requires appKind None and lab false. All eleven legal resolved states have actual CLI fixtures; no public/raw schema writer supplies additional tuples."},{"class":"E4","cite":{"file":"packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts","line":479},"note":"Full declared appKind is Option of five AppKind literals, not a binary presence bit or null value. Its six decoded states crossed with lab and withStoriesTsconfig represent24 shapes; the post-validation writer supports11. The prior two-Boolean D1 projection omitted both the exclusivity and the correlated full literal domain."}],"cardinality":{"representable":24,"legal":11},"storage":"stored","exposure":"internal","targetShape":"literalkit","tier":1,"notes":"Frozen HEAD93217d998f851e2e93d9864e2b5315552eaa58a7/main d1b4d769fbaffddd55717f3b1ba461897dd545c5. Correct the existing stable D1 id in place; no narrow/broad duplicate. Private eleven-value ScaffoldShape literal replaces the class. Preserve raw CLI defaults and typed error ordering before allocation, all full planning/manifest/template payloads, package-like runtime-proof behavior, lab/stories distinctions and generated bytes. No shape codec/export or external constructor exists. See data/design-refresh-2026-09-09-r28-create-package-scaffold-shape.md and data/provisional-r28-create-package-scaffold-shape.md; pending independent correction/admission."}
```

The existing `create-package-command-flags` row is the different excluded
descriptor/parameter owner handled by the frozen command-data audit.
`TemplateContext` is a separately exported data owner with its own canonical
clusters; this correction neither absorbs those clusters nor changes that
schema. No second ScaffoldShape cluster is proposed.

## Hashes and validation

SHA-256 of the exact prior `create-package-scaffold-shape` inventory line,
without trailing newline:
`14d0fe766f572d89b950c9b43dbc060b923ae9f639f505ec4df1f82377defb12`.

| Path | SHA-256 |
| --- | --- |
| `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts` | `8b3108c7db97b1817f9f1504fc1e8d34ce3c72219b18c456e609920bb4203b75` |
| `packages/tooling/tool/cli/src/commands/CreatePackage/index.ts` | `4097f8871b5b25b21611d31fa04d59fa434fbb456f25ebb2c59e13f45bc43482` |
| `packages/tooling/tool/cli/src/index.ts` | `19c10f83b6e17ae87269aa30da8f95fb06108e01ef1330f693281b237cd7c6b8` |
| `packages/tooling/tool/cli/src/commands/Root.ts` | `fe224f04bbf3099678acd77912c67f14c9834dba085cf14994e4412b72f05a64` |
| `packages/tooling/tool/cli/test/create-package.test.ts` | `b20130164ddfd6e4a8e33e4b69553e7b8843bb483c454a5665fe6dc5bf8f296a` |
| `packages/tooling/tool/cli/test/create-package-lab.test.ts` | `d6fa0d3a5a9dc21ad0c65ecb375662e687721a654738d4b7600528a4053818d9` |
| `.repos/effect/packages/effect/src/Schema.ts` | `0f0daf6b6ec3b6c827083d8b76278a4f52fe48a636dfff031ddf18e6c93f82ad` |

Product source and test hashes match frozen HEAD. The Effect reference is
supporting schema-API evidence outside the scanned corpus. Validated the
proposed JSONL, all source anchors, 24/11 enumeration, eight provisional
sections, exact prior artifact hashes and duplicate keys after simulated
canonical replacement in memory.
No product test, package, compiler or service command is needed for this
source/design audit. Graft reported 39,115 tokens saved in this separate
ScaffoldShape follow-up; zero class caller edges did not substitute for
the exhaustive use/constructor/export search.
