# Effect Schema idiom families — research lane

## Evidence contract

| Item | Verified result / limitation |
|---|---|
| Reference | `.repos/effect` HEAD `51d4a2f08a5c7691dc876415bc9fc0ecf467e153`; verified with `git -C .repos/effect rev-parse HEAD`. Repo catalog `package.json:161` pins `effect@4.0.0-rc.115`. |
| Citation convention | Upstream paths in this report are relative to `.repos/effect/`; repo paths are relative to the repository root. Line numbers are live research-snapshot evidence, not immutable dirty-tree provenance. |
| Scope | **3,173 rg-visible TS/TSX source files** under packages/**/src and apps/**/src. Generated source and JSDoc retained; fixture/test directories and test/spec/tst files excluded. Ignored/untracked-ignored source is not audited. |
| Count unit | **Matching source lines / distinct matching files**, not AST calls or confirmed defects. Regexes miss aliases/multiline syntax and include JSDoc/import strings. Each section supplies a detector sketch for semantic narrowing. No claim of exhaustive confirmed violation count; that count is **UNVERIFIED** unless the section identifies an inspected case. |
| Repeatability | `node explorations/effect-schema-parity/research/idiom-census.mjs` runs ripgrep and writes `idiom-census.json`, including scope file paths, regexes and every matching line. With an F-id argument it prints only that family and does not rewrite the receipt. |
| Coverage | **30 evaluated families**: candidates, rejected hypotheses, and one existing-gate correction. Family count: `rg -c '^## F[0-9]' explorations/effect-schema-parity/research/idiom-families.md`. |
| Performance | No local before/after type-check or benchmark run; all proposed performance improvements **UNVERIFIED**. The focused F26 semantic probe is not a benchmark or package proof. |
| Tool boundary | No network, source edits, git mutations, index rebuilds, full builds or test suites. Graft skill read; queries skipped because their auto-refresh may write outside the authorized research subtree. |

Scope/count implementation: `rg --files --hidden packages apps`, then retain `^(packages|apps)/.+/src/.+\.(ts|tsx)$`, reject directory segments `.repos`, `node_modules`, `dist`, `fixtures`, `__fixtures__`, `test`, `tests`, `__tests__` and test/spec/tst suffixes; each family invokes `rg --json -e REGEX -- ...scopeFiles`. The receipt counts ripgrep `match` records and distinct `data.path.text` values. It does not use glob inclusion ordering, which would accidentally admit scripts outside src.


## Role B mining coverage

Count command: `rg -c '^B  ' explorations/effect-schema-parity/CAPTURE.md` => **39 listed exemplar paths**. Each was scanned with `rg --json -e '\b(?:Schema|S)\.' .repos/effect/PATH`; the following matching-line counts include types and documentation. Zero means no namespace spelling matched, not a semantic proof of no schema relationship. Detailed receipt: `idiom-role-b.json`. The per-family sections identify the semantically inspected exemplars.

| Upstream module | Matching lines | Initial evidence locations |
|---|---:|---|
| `packages/effect/src/unstable/ai/McpSchema.ts` | 398 | `packages/effect/src/unstable/ai/McpSchema.ts:21`; `packages/effect/src/unstable/ai/McpSchema.ts:40` |
| `packages/effect/src/unstable/ai/AnthropicStructuredOutput.ts` | 5 | `packages/effect/src/unstable/ai/AnthropicStructuredOutput.ts:14`; `packages/effect/src/unstable/ai/AnthropicStructuredOutput.ts:20` |
| `packages/effect/src/unstable/ai/Prompt.ts` | 239 | `packages/effect/src/unstable/ai/Prompt.ts:18`; `packages/effect/src/unstable/ai/Prompt.ts:40` |
| `packages/effect/src/unstable/ai/Tool.ts` | 149 | `packages/effect/src/unstable/ai/Tool.ts:21`; `packages/effect/src/unstable/ai/Tool.ts:142` |
| `packages/effect/src/unstable/ai/Toolkit.ts` | 21 | `packages/effect/src/unstable/ai/Toolkit.ts:23`; `packages/effect/src/unstable/ai/Toolkit.ts:43` |
| `packages/effect/src/unstable/ai/Response.ts` | 289 | `packages/effect/src/unstable/ai/Response.ts:17`; `packages/effect/src/unstable/ai/Response.ts:165` |
| `packages/effect/src/unstable/devtools/DevToolsSchema.ts` | 93 | `packages/effect/src/unstable/devtools/DevToolsSchema.ts:15`; `packages/effect/src/unstable/devtools/DevToolsSchema.ts:25` |
| `packages/effect/src/unstable/encoding/Yaml.ts` | 0 | No matches |
| `packages/effect/src/unstable/encoding/Toml.ts` | 0 | No matches |
| `packages/effect/src/unstable/encoding/SchemaBinary.ts` | 98 | `packages/effect/src/unstable/encoding/SchemaBinary.ts:2`; `packages/effect/src/unstable/encoding/SchemaBinary.ts:32` |
| `packages/effect/src/unstable/encoding/Ini.ts` | 0 | No matches |
| `packages/effect/src/unstable/encoding/Ndjson.ts` | 27 | `packages/effect/src/unstable/encoding/Ndjson.ts:16`; `packages/effect/src/unstable/encoding/Ndjson.ts:117` |
| `packages/effect/src/unstable/http/Mime.ts` | 0 | No matches |
| `packages/effect/src/unstable/http/HttpStatus.ts` | 0 | No matches |
| `packages/effect/src/unstable/http/HttpIncomingMessage.ts` | 14 | `packages/effect/src/unstable/http/HttpIncomingMessage.ts:19`; `packages/effect/src/unstable/http/HttpIncomingMessage.ts:61` |
| `packages/effect/src/unstable/http/HttpClientError.ts` | 5 | `packages/effect/src/unstable/http/HttpClientError.ts:14`; `packages/effect/src/unstable/http/HttpClientError.ts:302` |
| `packages/effect/src/unstable/http/HttpServerRespondable.ts` | 1 | `packages/effect/src/unstable/http/HttpServerRespondable.ts:89` |
| `packages/effect/src/unstable/http/HttpBody.ts` | 3 | `packages/effect/src/unstable/http/HttpBody.ts:23`; `packages/effect/src/unstable/http/HttpBody.ts:349` |
| `packages/effect/src/unstable/http/HttpTraceContext.ts` | 0 | No matches |
| `packages/effect/src/unstable/http/Multipart.ts` | 22 | `packages/effect/src/unstable/http/Multipart.ts:29`; `packages/effect/src/unstable/http/Multipart.ts:290` |
| `packages/effect/src/unstable/http/HttpServerRequest.ts` | 27 | `packages/effect/src/unstable/http/HttpServerRequest.ts:24`; `packages/effect/src/unstable/http/HttpServerRequest.ts:197` |
| `packages/effect/src/unstable/http/HttpClientRequest.ts` | 2 | `packages/effect/src/unstable/http/HttpClientRequest.ts:26`; `packages/effect/src/unstable/http/HttpClientRequest.ts:735` |
| `packages/effect/src/unstable/http/HttpStaticServer.ts` | 0 | No matches |
| `packages/effect/src/unstable/http/HttpMethod.ts` | 0 | No matches |
| `packages/effect/src/unstable/http/MultipartParser.ts` | 0 | No matches |
| `packages/effect/src/unstable/http/HttpServerError.ts` | 0 | No matches |
| `packages/effect/src/unstable/http/Headers.ts` | 0 | No matches |
| `packages/effect/src/unstable/http/HttpServerResponse.ts` | 3 | `packages/effect/src/unstable/http/HttpServerResponse.ts:25`; `packages/effect/src/unstable/http/HttpServerResponse.ts:319` |
| `packages/effect/src/unstable/http/HttpClientResponse.ts` | 10 | `packages/effect/src/unstable/http/HttpClientResponse.ts:17`; `packages/effect/src/unstable/http/HttpClientResponse.ts:103` |
| `packages/effect/src/unstable/http/Template.ts` | 0 | No matches |
| `packages/effect/src/unstable/http/Url.ts` | 0 | No matches |
| `packages/effect/src/unstable/http/UrlParams.ts` | 0 | No matches |
| `packages/effect/src/unstable/httpapi/HttpApiSchema.ts` | 99 | `packages/effect/src/unstable/httpapi/HttpApiSchema.ts:14`; `packages/effect/src/unstable/httpapi/HttpApiSchema.ts:23` |
| `packages/effect/src/unstable/net/NetAddress.ts` | 0 | No matches |
| `packages/effect/src/unstable/net/IpInterface.ts` | 0 | No matches |
| `packages/effect/src/unstable/net/IpNetwork.ts` | 0 | No matches |
| `packages/effect/src/unstable/observability/OtlpSerialization.ts` | 0 | No matches |
| `packages/effect/src/unstable/rpc/RpcSchema.ts` | 10 | `packages/effect/src/unstable/rpc/RpcSchema.ts:16`; `packages/effect/src/unstable/rpc/RpcSchema.ts:29` |
| `packages/effect/src/unstable/sql/SqlSchema.ts` | 20 | `packages/effect/src/unstable/sql/SqlSchema.ts:17`; `packages/effect/src/unstable/sql/SqlSchema.ts:33` |

## Existing detectors — already gated, not new proposals

Count commands: `rg -c 'ruleId: "SFV4-' packages/tooling/tool/cli/src/commands/Lint/internal/SchemaFirstDetectors.ts` => **11** explicit advisory emitters; `rg -c '^  "SFV4-' packages/tooling/tool/cli/src/commands/Lint/internal/SchemaFirstPolicy.ts` => **12** remediation entries. These are definition counts, not active finding counts. Additional interface/type-alias/exported-Struct candidate gates are exported by Detectors.ts:1173. `arbitrary-tests` has remediation and scan aggregation (Scan.ts:403), but no emitter in this detector file; its complete implementation is outside this inventory.

All abbreviated `Detectors.ts` references in this section mean `packages/tooling/tool/cli/src/commands/Lint/internal/SchemaFirstDetectors.ts`; `Policy.ts` means the sibling `SchemaFirstPolicy.ts`; `Scan.ts` means the sibling `SchemaFirstScan.ts`.

| Existing gate | Implemented selection | Gap / treatment in this lane |
|---|---|---|
| Data interface/type alias/exported Struct | Same-name schema companions; filters data-like exported contracts; plain top-level Struct excludes local/nested/class-field inputs (Detectors.ts:265, :372) | Preserve repo doctrine; upstream uses Struct too. F22 is not a new blanket gate. Schema recognition regex uses Error, not ErrorClass, and is not general import resolution. |
| SFV4-static-api | Schema-signal file + switch on known discriminator tokens (Detectors.ts:570) | Already gated; helper/guard duplication and LiteralKit retirement are separate gaps (F01/F13/F16). Current remediation encourages a potential retirement target. |
| SFV4-numeric-domain | Broad S.Number/NumberFromString under schema fields with numeric-name tokens (Detectors.ts:454) | A check suppresses broadness; does not recognize redundant built-in equivalents (F04/F27/F30). |
| SFV4-boundary-codec | Direct JSON.parse calls (Detectors.ts:601) | Already gated; no new JSON.parse rule. Does not assess thrown decode failure in an Effect boundary (F05). |
| SFV4-defaults | Nonempty object parameter default named options/params/config/request/args/input, schema-signal file (Detectors.ts:980) | Already gated; does not inspect fallback expressions or retire custom schema-default helpers (F03). |
| SFV4-equivalence | Exported variable literally named equals, manual ===/!==, no recognized schema equivalence (Detectors.ts:1023) | Already gated; misses alternate names and methods. Do not duplicate; validate native class behavior (F26). |
| SFV4-tagged-error-equivalence | Recognized TaggedError factory with no explicit equivalence annotation (Detectors.ts:1128) | **Stale premise**, F26. Explicit import aliases not recognized; hardcoded S/Schema aliases need binding resolution. |
| SFV4-precision-audit | Broad field literally named email (Detectors.ts:498) | Already gated; checks/NonEmptyString suppress it. No new broad-email proposal. |
| SFV4-arbitrary-tests | Policy remediation + scan aggregation (Policy.ts:36; Scan.ts:403) | Test adoption machinery exists; F20 rejects blanket native-generator replacement. |
| SFV4-fn-schema | Exported non-generic function/arrow with inline object parameter/return; excludes TSX (Detectors.ts:690) | Already gated; not a new upstream-parity family. |
| SFV4-normalization | Recognized trim/case calls in schema-boundary functions (Detectors.ts:872) | Already gated; do not relabel normalization as a new detector. |
| SFV4-null-return | Explicit null/undefined return annotation; skips generics and safe wrappers (Detectors.ts:750) | Already gated; does not justify rewriting nullable wire fields (F23). |
| SFV4-getsomes-struct | R/Record.getSomes with inline Option struct (Detectors.ts:939) | Already gated; no duplicate proposal. |

Policy affects enforcement: owner override wins, then family blocking; unmatched family defaults nonblocking (Policy.ts:115). Exemption requires a policy-tracked card (Policy.ts:163). Therefore “already gated” means existing detector/ratchet machinery, **not proof every package currently blocks**. Active owner-policy/finding totals were not run: **UNVERIFIED**.

## Ranked triage table

Score = matching lines × analyst confidence in the stated family decision, **not expected defect count or measured priority benefit**. Candidates/correction are ranked together; rejected hypotheses follow separately so high-confidence rejections cannot outrank actionable work. Broad queues overlap their refined subfamilies and must not be summed.

| Rank | Id / family | Lines | Files | Confidence | Score | Disposition |
|---:|---|---:|---:|---:|---:|---|
| 1 | [F01 — LiteralKit wrapper retirement](#f01) | 1458 | 568 | 0.95 | 1385.10 | candidate |
| 2 | [F05 — Throwing decoders at Effect boundaries](#f05) | 1525 | 482 | 0.45 | 686.25 | candidate |
| 3 | [F26 — Stale tagged-error equivalence gate](#f26) | 484 | 247 | 1.00 | 484.00 | correction |
| 4 | [F03 — Custom key/default combinator wrappers](#f03) | 406 | 104 | 0.95 | 385.70 | candidate |
| 5 | [F06 — Recursive annotations and gratuitous suspension](#f06) | 716 | 19 | 0.40 | 286.40 | candidate |
| 6 | [F15 — Codec-static wrapper surface](#f15) | 238 | 134 | 0.90 | 214.20 | candidate |
| 7 | [F13 — Schema-derived guards versus duplicated predicates](#f13) | 266 | 169 | 0.70 | 186.20 | candidate |
| 8 | [F04 — Opaque custom checks needing constraint classification](#f04) | 325 | 130 | 0.55 | 178.75 | candidate |
| 9 | [F24 — Opaque defect/equivalence wrappers](#f24) | 157 | 116 | 0.85 | 133.45 | candidate |
| 10 | [F25 — Encoded projection used as an executable boundary](#f25) | 153 | 38 | 0.45 | 68.85 | candidate |
| 11 | [F14 — declare used to rebuild primitive validation](#f14) | 85 | 50 | 0.70 | 59.50 | candidate |
| 12 | [F07 — Class field spreads that lose inheritance intent](#f07) | 76 | 41 | 0.55 | 41.80 | candidate |
| 13 | [F19 — Custom JSON Schema document model and rewrites](#f19) | 31 | 6 | 0.70 | 21.70 | candidate |
| 14 | [F28 — Whole-object uniqueness checks hiding field constraints](#f28) | 14 | 8 | 0.85 | 11.90 | candidate |
| 15 | [F16 — Literal discriminants requiring constructor input](#f16) | 12 | 4 | 0.95 | 11.40 | candidate |
| 16 | [F30 — Inline regex/comparison checks hiding built-ins](#f30) | 9 | 7 | 0.95 | 8.55 | candidate |
| 17 | [F18 — Status/cause error construction wrappers](#f18) | 9 | 2 | 0.75 | 6.75 | candidate |
| 18 | [F27 — Paired inclusive bounds instead of isBetween](#f27) | 7 | 5 | 0.95 | 6.65 | candidate |
| 19 | [F29 — Schema guard wrapped back into a brand filter](#f29) | 5 | 4 | 0.85 | 4.25 | candidate |
| 20 | [F17 — Data errors needing schema-backed contracts](#f17) | 4 | 3 | 0.80 | 3.20 | candidate |
| 21 | [F02 — Literal-only Union expansion](#f02) | 2 | 2 | 1.00 | 2.00 | candidate |

| Rejected hypothesis | Lines / files | Confidence | Reason |
|---|---:|---:|---|
| F08 — mutable placement audit | 34 / 11 | 0.95 | Normal mutable arrays are upstream idiom; misuse not established. |
| F09 — ArrayEnsure misuse | 0 / 0 | 1.00 | No ArrayEnsure spelling found. |
| F10 — transformOrFail residue | 0 / 0 | 1.00 | No transformOrFail residue found. |
| F11 — Annotation vocabulary drift | 225 / 26 | 1.00 | documentation remains valid annotation vocabulary. |
| F12 — Standard Schema adapters | 1 / 1 | 0.95 | Only a comment matched; no demonstrated adapter gap. |
| F20 — Custom arbitrary composition versus native derivation | 83 / 16 | 0.95 | Inspected generators already use native Arbitrary. |
| F21 — Hand-rolled model variants | 65 / 11 | 0.95 | effect-drizzle already uses VariantSchema. |
| F22 — Struct plus brand versus Class/Opaque | 262 / 139 | 0.95 | Brand, Struct, Opaque and Class express different intent. |
| F23 — NullOr versus optional/Option defaults | 177 / 46 | 0.95 | Nullable wire fields are not optional-key mistakes. |

<a id="f01"></a>
## F01 — LiteralKit wrapper retirement

Count command: `node explorations/effect-schema-parity/research/idiom-census.mjs F01` => **1458 matching lines / 568 files**. Ripgrep regex: `\bLiteralKit\(`. Confidence **0.95**, disposition **candidate**.

| Dimension | Evidence / decision |
|---|---|
| Idiomatic form | `Schema.Literals`, `.literals`, `.members`, `.pick`, `.transform`, `.mapMembers`: upstream `packages/effect/src/Schema.ts:4768`; Role B literal domain: `packages/effect/src/unstable/ai/Response.ts:2268`. |
| Found / qualification | LiteralKit already calls `S.Literals` (`packages/foundation/modeling/schema/src/LiteralKit/LiteralKit.schema.ts:784`). Its added `Enum`, `is`, `$match`, `thunk`, `HashSet`, mapping and tagged-union conveniences are real additions (`:639`, `:786`), not features all supplied by upstream Literals. |
| Detector sketch and existing-gate boundary | Resolve imports to LiteralKit; trace each produced schema’s static-member consumers. Report upstream-overlapping domain construction separately from adaptations of custom statics. Existing SFV4-static-api prefers LiteralKit; amend its remediation in the same migration, do not add another switch rule. |
| Examples / controls | `apps/labs/api-docs/src/Catalog.models.ts:32`; `apps/labs/api-docs/src/Catalog.models.ts:48`; `apps/labs/ciops/src/projection/Replay.ts:49` |
| Migration recipe | Under the locked same-intent decision, replace domains with S.Literals and migrate Options to literals, picks to pick, tagged cases to mapMembers/toTaggedUnion. Adapt Enum/mapping/matching users explicitly using upstream composition; delete the wrapper only with every consumer migrated. Full static-member consumer census is UNVERIFIED. |
| Cost / semantic evidence | Runtime work constructing guards, enums, thunks and HashSet is visible at LiteralKit.schema.ts:786 and :825; a speedup or reduced type-instantiation count is UNVERIFIED. |

<a id="f02"></a>
## F02 — Literal-only Union expansion

Count command: `node explorations/effect-schema-parity/research/idiom-census.mjs F02` => **2 matching lines / 2 files**. Ripgrep regex: `\b(?:S|Schema)\.Union\(\[\s*(?:S|Schema)\.Literal\([^\n]+(?:S|Schema)\.Literal\(`. Confidence **1.00**, disposition **candidate**.

| Dimension | Evidence / decision |
|---|---|
| Idiomatic form | `Schema.Literals([...])`: upstream `packages/effect/SCHEMA.md:1941`, `packages/effect/src/Schema.ts:4800`. |
| Found / qualification | BrowserHistory and docgen build literal-only arrays with S.Union and repeated S.Literal calls. These inspected matches contain no heterogeneous schema members. |
| Detector sketch and existing-gate boundary | AST: import-resolved Schema.Union whose array argument contains only Schema.Literal calls with one literal argument; include multiline arrays. Reject mixed unions such as false plus an options object. |
| Examples / controls | `packages/tooling/tool/cli/src/commands/Research/internal/BrowserHistory.ts:43`; `packages/tooling/tool/docgen/src/Core.ts:32`; fewer than three observed matches, no invented examples. |
| Migration recipe | Collapse members to S.Literals(values); preserve annotations and ordering. Do not replace with a new local helper. The regex is deliberately single-line and incomplete for multiline syntax. |
| Cost / semantic evidence | Upstream itself maps Literal over values (Schema.ts:4801); fewer source expressions is not evidence of a faster parser. Performance delta UNVERIFIED. |

<a id="f03"></a>
## F03 — Custom key/default combinator wrappers

Count command: `node explorations/effect-schema-parity/research/idiom-census.mjs F03` => **406 matching lines / 104 files**. Ripgrep regex: `\b(?:SchemaUtils\.)?(?:withKeyDefaults|withEmptyArrayDefaults|optionalKeyWithDefault|withConstructorDefaults|withEncodeDefault|boolWithDefault)\(`. Confidence **0.95**, disposition **candidate**.

| Dimension | Evidence / decision |
|---|---|
| Idiomatic form | `withConstructorDefault` and `withDecodingDefaultTypeKey`: upstream `packages/effect/src/Schema.ts:5651`, `:5747`, `:5769`; missing/undefined decision tree `migration/schema.md:512`; Role B `packages/effect/src/unstable/ai/Prompt.ts:146`. |
| Found / qualification | withKeyDefaults already composes upstream defaults (`packages/foundation/modeling/schema/src/SchemaUtils/withKeyDefaults.ts:69`); withEncodeDefault and optionalKeyWithDefault hand-compose optionalKey/decodeTo/SchemaGetter.withDefault. |
| Detector sketch and existing-gate boundary | Resolve calls to named local default helpers; classify missing key, explicit undefined, null, decoded default, encoded default and constructor default separately. Existing SFV4-defaults catches parameter defaults, not wrapper retirement. |
| Examples / controls | `apps/oip-web/src/components/HeroVideo.tsx:58`; `apps/oip-web/src/components/HeroVideo.tsx:59`; `apps/professional-desktop/src/runtime/Migrations.ts:94` |
| Migration recipe | Use withDecodingDefaultTypeKey for decoded missing-key defaults; add withConstructorDefault only when construction shares the default. Preserve lazy thunks with Effect.sync. withEmptyArrayDefaults has value-level missing-or-undefined semantics: use the Type variant rather than mechanically substituting TypeKey. Migrate bool helpers likewise. |
| Cost / semantic evidence | Wrappers add overload/type plumbing, but type-check and runtime deltas are UNVERIFIED. Missing-key/undefined semantics are evidenced in Schema.ts:5747 and :5789. |

<a id="f04"></a>
## F04 — Opaque custom checks needing constraint classification

Count command: `node explorations/effect-schema-parity/research/idiom-census.mjs F04` => **325 matching lines / 130 files**. Ripgrep regex: `\b(?:S|Schema)\.makeFilter\(`. Confidence **0.55**, disposition **candidate**.

| Dimension | Evidence / decision |
|---|---|
| Idiomatic form | Named checks and makeFilter are both official: upstream `packages/effect/SCHEMA.md:2555`, `packages/effect/src/Schema.ts:6578`, `:7365`, `:8046`. |
| Found / qualification | The makeFilter census contains both redundant primitive predicates and necessary multi-field invariants. Color chroma duplicates >= 0; provenance consistency checks cannot be replaced by a primitive bound. |
| Detector sketch and existing-gate boundary | AST: inspect callback or resolve its local declaration, then classify constant comparisons, regex tests, length checks, and cross-field relations. F27–F30 refine this broad queue; deduplicate overlapping findings by source node. Numeric-domain gating only recognizes broad field schemas, not redundant checks. |
| Examples / controls | `packages/foundation/modeling/schema/src/Color/Color.oklch.ts:25`; `packages/foundation/capability/file-processing/src/Artifact/Artifact.schema.ts:25`; `apps/labs/semantica/src/schema/Evidence.ts:676` |
| Migration recipe | Replace only a demonstrated built-in predicate match. Move reusable field constraints to the field schema; retain cross-field checks with expected/message annotations. Never flag makeFilter merely for being custom. |
| Cost / semantic evidence | Built-in checks can expose representation/JSON Schema/arbitrary constraints (e.g. Schema.ts:8489). No measured performance delta; UNVERIFIED. |

<a id="f05"></a>
## F05 — Throwing decoders at Effect boundaries

Count command: `node explorations/effect-schema-parity/research/idiom-census.mjs F05` => **1525 matching lines / 482 files**. Ripgrep regex: `\b(?:S|Schema)\.decode(?:Unknown)?Sync\(`. Confidence **0.45**, disposition **candidate**.

| Dimension | Evidence / decision |
|---|---|
| Idiomatic form | Role B HTTP boundary uses decodeUnknownEffect: upstream `packages/effect/src/unstable/http/HttpIncomingMessage.ts:123`; SQL `packages/effect/src/unstable/sql/SqlSchema.ts:123`. Sync is also idiomatic in `packages/effect/src/unstable/ai/Prompt.ts:1921`. |
| Found / qualification | Repo sync decoder definitions include database row converters; many census lines are executable documentation, not hot-path calls. Presence of decodeUnknownSync alone is not a defect. |
| Detector sketch and existing-gate boundary | AST/dataflow: find a sync decoder applied to external input inside Effect.gen/sync/map callbacks; determine whether throws are caught into the intended typed error. Hoisted decoder creation is not application. Existing boundary-codec only catches JSON.parse. |
| Examples / controls | `packages/documents/tables/src/entities/SyncOperation/SyncOperation.converters.ts:52`; `packages/documents/tables/src/entities/SyncItem/SyncItem.converters.ts:52`; `packages/documents/tables/src/entities/SyncCursor/SyncCursor.converters.ts:52` |
| Migration recipe | At recoverable Effect boundaries use decodeUnknownEffect then mapError to the declared domain error. At deliberate synchronous boundaries retain Sync or use Result. Hoist decoder factories where safe. Confirm exception-to-defect versus typed-failure behavior per call site. |
| Cost / semantic evidence | Actual runtime/type-check benefit UNVERIFIED; do not use published generic benchmark numbers as local evidence. |

<a id="f06"></a>
## F06 — Recursive annotations and gratuitous suspension

Count command: `node explorations/effect-schema-parity/research/idiom-census.mjs F06` => **716 matching lines / 19 files**. Ripgrep regex: `\b(?:S|Schema)\.suspend\(`. Confidence **0.40**, disposition **candidate**.

| Dimension | Evidence / decision |
|---|---|
| Idiomatic form | Explicit Codec<T,E> at cycles: upstream `packages/effect/SCHEMA.md:2108`; Role B `packages/effect/src/unstable/devtools/DevToolsSchema.ts:138` and `:146`. |
| Found / qualification | Html/Md recursive codecs correctly specify Type and Encoded. Generated ACP/runpod sources suspend many field references; whether each needs a cycle/declaration-order break is UNVERIFIED. |
| Detector sketch and existing-gate boundary | AST: build declaration dependency SCCs; retain suspension for actual cycles or initialization order. Flag single-parameter Codec<T> only if encoded type differs, and annotations that erase required decoding/encoding services. Do not require removing explicit Codec annotations. |
| Examples / controls | `packages/foundation/modeling/html/src/Html.model.ts:90`; `packages/foundation/modeling/md/src/Md.model.ts:309`; `packages/drivers/acp/src/_generated/schema.gen.ts:3794` |
| Migration recipe | Preserve Codec<T,E,RD,RE> distinctions; use one stable annotation at a cycle boundary. Remove an acyclic thunk only after initialization-order proof; fix generators for generated source. |
| Cost / semantic evidence | Upstream explains implicit-any inference failures without annotations (SCHEMA.md:2128). A measured TypeScript improvement from reducing thunks is UNVERIFIED. |

<a id="f07"></a>
## F07 — Class field spreads that lose inheritance intent

Count command: `node explorations/effect-schema-parity/research/idiom-census.mjs F07` => **76 matching lines / 41 files**. Ripgrep regex: `\.\.\.[A-Za-z_$][\w$.]*\.fields\b`. Confidence **0.55**, disposition **candidate**.

| Dimension | Evidence / decision |
|---|---|
| Idiomatic form | `Base.extend<Child>(identifier)(fields)` preserves base instance fields: upstream `packages/effect/SCHEMA.md:4222`; ordinary struct field reuse remains supported at `:1013`. |
| Found / qualification | Repeated spreads appear in projection schemas and derived classes. Some intentionally flatten multiple independent structs, which does not imply inheritance. |
| Detector sketch and existing-gate boundary | AST: resolve spread source; only flag a new Class built from one base Class when inherited methods/checks/annotations were intended. Multiple struct composition and protocol snapshots are exemptions, not errors. |
| Examples / controls | `apps/labs/ciops/src/projection/Schemas.ts:752`; `apps/labs/ciops/src/projection/Schemas.ts:760`; `apps/labs/ciops/src/projection/Schemas.ts:761` |
| Migration recipe | Use Base.extend for actual subclassing. For schema projection use upstream field mapping/pick/omit without manufacturing inheritance. Check inherited statics and checks explicitly; field spreads can intentionally discard them. |
| Cost / semantic evidence | Instance/prototype semantics differ (SCHEMA.md:4222); local performance cost UNVERIFIED. |

<a id="f08"></a>
## F08 — mutable placement audit

Count command: `node explorations/effect-schema-parity/research/idiom-census.mjs F08` => **34 matching lines / 11 files**. Ripgrep regex: `\b(?:S|Schema)\.mutable\b`. Confidence **0.95**, disposition **rejected**.

| Dimension | Evidence / decision |
|---|---|
| Idiomatic form | `Schema.mutable(Schema.Array(element))` is idiomatic; Role B `packages/effect/src/unstable/sql/SqlSchema.ts:41`. Array-node encodings are forbidden, element encodings allowed: `packages/effect/src/Schema.ts:4638`. |
| Found / qualification | Inspected mutable uses follow Array then mutable; no misuse was established. A blanket mutable ban would reject upstream SQL itself. |
| Detector sketch and existing-gate boundary | Future AST rule: flag mutable after an array-node encoding, not an encoded element. Resolve aliases and pipe order; runtime AST check can verify encoding presence. |
| Examples / controls | `packages/agents/server/src/AssistantTurn/ScanState.ts:108`; `packages/foundation/modeling/utils/src/Array.ts:50`; `packages/tooling/policy-pack/repo-configs/src/next/models/Compiler.schema.ts:15` |
| Migration recipe | No migration backlog established. If a node-level transform exists, make the underlying array mutable before composing the transform, with Type/Encoded checks. |
| Cost / semantic evidence | Upstream documents a throw on array-node encoding at Schema.ts:4642. No local failing case or performance measurement; UNVERIFIED. |

<a id="f09"></a>
## F09 — ArrayEnsure misuse

Count command: `node explorations/effect-schema-parity/research/idiom-census.mjs F09` => **0 matching lines / 0 files**. Ripgrep regex: `\b(?:S|Schema)\.ArrayEnsure\b`. Confidence **1.00**, disposition **rejected**.

| Dimension | Evidence / decision |
|---|---|
| Idiomatic form | `Schema.ArrayEnsure`: upstream `packages/effect/src/Schema.ts:4537`, `:4541`. |
| Found / qualification | No S/Schema.ArrayEnsure lexical use found. Cannot claim observed misuse or adoption demand. |
| Detector sketch and existing-gate boundary | Future rule: inspect ArrayEnsure element types that themselves accept arrays; inspect consumers requiring array-only encoded output. Named imports/aliases require symbol resolution. |
| Examples / controls | NONE — no matches; three examples cannot truthfully be supplied. |
| Migration recipe | Only adopt when scalar-or-array input and singleton scalar encoding are intended. Empty/multi-element arrays encode as arrays; array-valued elements may select the single branch. |
| Cost / semantic evidence | Cardinality and branch-order behavior is explicit at Schema.ts:4550. Local cost UNVERIFIED. |

<a id="f10"></a>
## F10 — transformOrFail residue

Count command: `node explorations/effect-schema-parity/research/idiom-census.mjs F10` => **0 matching lines / 0 files**. Ripgrep regex: `transformOrFail`. Confidence **1.00**, disposition **rejected**.

| Dimension | Evidence / decision |
|---|---|
| Idiomatic form | v4 decodeTo plus SchemaGetter.transformEffect: upstream `migration/schema.md:873`, especially `:899`. |
| Found / qualification | No transformOrFail text found in the scoped source corpus. |
| Detector sketch and existing-gate boundary | Import-aware deprecated-symbol detector should resolve SchemaGetter/SchemaTransformation too; do not invent Schema.transformEffect as the replacement for every old spelling. |
| Examples / controls | NONE — no matches; three examples cannot truthfully be supplied. |
| Migration recipe | No current backlog. On reintroduction choose decodeTo plus the appropriate getter/transformation and SchemaIssue failure; preserve both encode and decode directions. |
| Cost / semantic evidence | No local residue and no performance evidence; UNVERIFIED. |

<a id="f11"></a>
## F11 — Annotation vocabulary drift

Count command: `node explorations/effect-schema-parity/research/idiom-census.mjs F11` => **225 matching lines / 26 files**. Ripgrep regex: `documentation:`. Confidence **1.00**, disposition **rejected**.

| Dimension | Evidence / decision |
|---|---|
| Idiomatic form | title, description and documentation all remain supported at upstream `packages/effect/src/Schema.ts:15062`; identifier is supported at `:15136`; JSON metadata guidance `packages/effect/SCHEMA.md:5225`. |
| Found / qualification | Repo documentation properties, including generated ACP metadata, are not stale vocabulary. A documentation-to-description blanket rename is unjustified. |
| Detector sketch and existing-gate boundary | AST: distinguish schema annotate, annotateKey, filter annotations, and arbitrary object properties; validate known fields against the pinned annotation interfaces. Custom annotation namespace extensions are legal. |
| Examples / controls | `packages/drivers/acp/src/_generated/schema.gen.ts:49`; `packages/shared/domain/src/values/LocalDate/LocalDate.model.ts:54`; `packages/foundation/modeling/schema/src/AtURI.ts:244` |
| Migration recipe | No blanket migration. Review emitted JSON Schema separately when a documentation value was expected to become a public description; encode-side annotations may require separate placement (SCHEMA.md:5276). |
| Cost / semantic evidence | No performance evidence; UNVERIFIED. Annotation presence alone does not establish downstream emission. |

<a id="f12"></a>
## F12 — Standard Schema adapters

Count command: `node explorations/effect-schema-parity/research/idiom-census.mjs F12` => **1 matching lines / 1 files**. Ripgrep regex: `~standard|toStandardSchemaV1|standardSchemaResolver|effectTsResolver`. Confidence **0.95**, disposition **rejected**.

| Dimension | Evidence / decision |
|---|---|
| Idiomatic form | `Schema.toStandardSchemaV1` and experimental `toStandardJSONSchemaV1`: upstream `packages/effect/src/Schema.ts:1339`, `:1359`. |
| Found / qualification | Only matching line is a comment explicitly saying withCodecStatics omits the adapter. No hand-rolled ~standard implementation or matching resolver found. |
| Detector sketch and existing-gate boundary | AST: find object member "~standard" and schema-specific form resolver wrappers; resolve foreign API requirement before proposing adoption. No target integration was verified. |
| Examples / controls | `packages/foundation/modeling/schema/src/SchemaUtils/withCodecStatics.ts:54`; fewer than three observed matches, no invented examples. |
| Migration recipe | Use the upstream adapter at a consumer that accepts Standard Schema. Absence of an adapter is not a defect in an Effect-native boundary. |
| Cost / semantic evidence | No local integration run or cost evidence; UNVERIFIED. |

<a id="f13"></a>
## F13 — Schema-derived guards versus duplicated predicates

Count command: `node explorations/effect-schema-parity/research/idiom-census.mjs F13` => **266 matching lines / 169 files**. Ripgrep regex: `\): [A-Za-z_$][\w$]* is `. Confidence **0.70**, disposition **candidate**.

| Dimension | Evidence / decision |
|---|---|
| Idiomatic form | `Schema.is`: upstream `packages/effect/src/Schema.ts:1370`, `:1401`; union guards `packages/effect/SCHEMA.md:2077`. |
| Found / qualification | Box.errors repeats finite-number validation; several handlers narrow known union members manually. DOM/class-module shape predicates are often appropriate runtime-handle guards. |
| Detector sketch and existing-gate boundary | AST: resolve type predicate target to an existing schema; compare predicate coverage to schema Type. For already validated tagged unions prefer derived discriminator guards; avoid replacing a cheap tag refinement with full decoding. |
| Examples / controls | `packages/drivers/box/src/Box.errors.ts:484`; `packages/drivers/openai-compat/src/OpenAiCompatLanguageModel.service.ts:422`; `packages/drivers/drizzle/src/Drizzle.errors.ts:331` |
| Migration recipe | Use S.is(S.Finite) for an equivalent unknown-input finite guard. Use schema-derived union guards for existing model variants. Keep external handle guards when no executable model exists. Existing static-api switch gate does not cover predicates. |
| Cost / semantic evidence | Schema.is only converts schema-issue failures to false; other causes can throw (Schema.ts:1377). Custom safeBoolean guards cannot be replaced without preserving that contract. Cost UNVERIFIED. |

<a id="f14"></a>
## F14 — declare used to rebuild primitive validation

Count command: `node explorations/effect-schema-parity/research/idiom-census.mjs F14` => **85 matching lines / 50 files**. Ripgrep regex: `\b(?:S|Schema)\.declare(?:Constructor)?[<(]`. Confidence **0.70**, disposition **candidate**.

| Dimension | Evidence / decision |
|---|---|
| Idiomatic form | `Schema.Number` is a native numeric schema (`packages/effect/src/Schema.ts:2997`); declare is intended for types lacking a built-in representation (`packages/effect/SCHEMA.md:2192`). |
| Found / qualification | ApiTransportDurationNumber wraps P.isNumber with S.declare; ApiTransportDurationString wraps a string predicate. DOM elements and service handles in other matches are legitimate declarations. |
| Detector sketch and existing-gate boundary | AST: match declare callback to a primitive predicate or built-in schema; require semantic review for NaN, infinity, class identity and services. Primitive-only declarations are the target; do not flag arbitrary runtime handles. |
| Examples / controls | `packages/foundation/capability/api-transport/src/Transport.ts:201`; `packages/foundation/capability/api-transport/src/Transport.ts:223`; `apps/oip-web/src/components/HeroVideo.tsx:35` |
| Migration recipe | Replace the numeric declaration with annotated S.Number when its accepted set is confirmed; use string checks/codecs for duration string intent. Retain declare for non-data objects and verify toCodecJson support where needed. |
| Cost / semantic evidence | Built-in representation improves interpreter visibility; exact arbitrary/JSON behavior and runtime/type-check deltas UNVERIFIED. |

<a id="f15"></a>
## F15 — Codec-static wrapper surface

Count command: `node explorations/effect-schema-parity/research/idiom-census.mjs F15` => **238 matching lines / 134 files**. Ripgrep regex: `\bwithCodecStatics\(`. Confidence **0.90**, disposition **candidate**.

| Dimension | Evidence / decision |
|---|---|
| Idiomatic form | Public decoder functions: upstream `packages/effect/src/Schema.ts:1473`, `:1668`, `:1811`; Role B hoisted decoder `packages/effect/src/unstable/http/HttpIncomingMessage.ts:123`. |
| Found / qualification | withCodecStatics exposes upstream runners as selected object statics; it already intentionally omits legacy/JSON-string/Standard Schema conveniences (`packages/foundation/modeling/schema/src/SchemaUtils/withCodecStatics.ts:49`). |
| Detector sketch and existing-gate boundary | Resolve wrapper imports and follow selected static names plus all classStatics consumers. The census covers withCodecStatics call spelling only, not the complete adjacent active packet surface. |
| Examples / controls | `apps/labs/ciops/src/projection/Schemas.ts:66`; `apps/labs/lejeune-bolt-workbench/src/domain/Bundle.ts:699`; `apps/labs/lejeune-bolt-workbench/src/domain/Bundle.ts:1470` |
| Migration recipe | Replace selected methods with direct upstream runner bindings or calls. Coordinate ownership with goals/schema-utils-selective-codec-statics; do not duplicate its work or claim static helper methods are native schema members. |
| Cost / semantic evidence | Extra registry/type surface is observable; measured removal benefit UNVERIFIED. |

<a id="f16"></a>
## F16 — Literal discriminants requiring constructor input

Count command: `node explorations/effect-schema-parity/research/idiom-census.mjs F16` => **12 matching lines / 4 files**. Ripgrep regex: `_tag: (?:S|Schema)\.Literal\(`. Confidence **0.95**, disposition **candidate**.

| Dimension | Evidence / decision |
|---|---|
| Idiomatic form | `Schema.tag` supplies a constructor default; `TaggedClass`/`TaggedError` build it in: upstream `packages/effect/src/Schema.ts:5917`, `:14090`, `:14201`. |
| Found / qualification | Journal classes manually declare _tag: S.Literal, requiring callers to supply a fixed value unless another default exists. |
| Detector sketch and existing-gate boundary | AST: Class/Struct field named _tag initialized by Literal and no constructor default. Exempt read-only exact wire schemas whose construction contract is deliberate. Static-api gate covers switches, not tag declaration. |
| Examples / controls | `packages/tooling/tool/cli/src/commands/Yeet/internal/AttemptJournal.ts:49`; `packages/tooling/tool/cli/src/commands/Yeet/internal/AttemptJournal.ts:88`; `packages/tooling/tool/cli/src/commands/Yeet/internal/AttemptJournal.ts:122` |
| Migration recipe | Use S.tag in fields or TaggedClass; omit the discriminator from make input where supplied by the schema. Preserve wire decoding requiredness and serialized tag; do not substitute tagDefaultOmit accidentally. |
| Cost / semantic evidence | Constructor contract changes intentionally. Runtime/type-check delta UNVERIFIED. |

<a id="f17"></a>
## F17 — Data errors needing schema-backed contracts

Count command: `node explorations/effect-schema-parity/research/idiom-census.mjs F17` => **4 matching lines / 3 files**. Ripgrep regex: `extends (?:Error|Data\.TaggedError|Data\.Error)\b`. Confidence **0.80**, disposition **candidate**.

| Dimension | Evidence / decision |
|---|---|
| Idiomatic form | `Schema.Error` and `Schema.TaggedError`: upstream `packages/effect/src/Schema.ts:14141`, `:14201`; Role B `packages/effect/src/unstable/http/HttpClientError.ts:302`. |
| Found / qualification | InvalidPatternError and ScribeConnectionFailure use Data.TaggedError. Remaining matches are plain Error examples in ArtifactIo JSDoc. Schema.ErrorClass is not an export in this checkout. |
| Detector sketch and existing-gate boundary | AST: resolve extends symbol to Data.TaggedError, Data.Error or global Error; flag when a serializable/domain contract is required. Data.TaggedError itself is valid Effect, not inherently broken. |
| Examples / controls | `packages/drivers/nlp-mcp/src/StreamingHandlers.ts:49`; `packages/foundation/ui-system/ui/src/hooks/use-scribe.ts:173`; `packages/tooling/tool/cli/src/internal/artifacts/ArtifactIo.ts:82` The ArtifactIo entry is JSDoc, not a runtime class; only the first two inspected entries are source error declarations. |
| Migration recipe | Model fields with S.TaggedError or S.Error; retain constructors/message semantics and typed error flow. Existing tagged-error-equivalence detector only checks schema error annotations, not Data-to-Schema conversion. |
| Cost / semantic evidence | Schema construction introduces validation; no performance win demonstrated. Cost UNVERIFIED. |

<a id="f18"></a>
## F18 — Status/cause error construction wrappers

Count command: `node explorations/effect-schema-parity/research/idiom-census.mjs F18` => **9 matching lines / 2 files**. Ripgrep regex: `\bmakeStatusCauseError\b`. Confidence **0.75**, disposition **candidate**.

| Dimension | Evidence / decision |
|---|---|
| Idiomatic form | Schema-backed error constructors already validate fields: upstream `packages/effect/src/Schema.ts:14114`, `:14201`. |
| Found / qualification | makeStatusCauseError adds overloads/currying and status/cause input conversion, rather than implementing a TaggedError replacement (`packages/foundation/modeling/schema/src/StatusCauseError.ts:228`). HttpError delegates through it at :64. |
| Detector sketch and existing-gate boundary | Resolve calls/imports of makeStatusCauseError; inventory currying and cause normalization, not merely class names. Existing error-equivalence gate does not cover constructor glue. |
| Examples / controls | `packages/foundation/modeling/schema/src/StatusCauseError.ts:228`; `packages/foundation/capability/observability/src/HttpError.ts:64`; `packages/foundation/modeling/schema/src/StatusCauseError.ts:259` |
| Migration recipe | Construct upstream schema errors directly and adapt caller inputs, including Option-valued cause and HTTP status. Upstream does not automatically supply this domain policy; same-intent retirement permits adapting it explicitly. |
| Cost / semantic evidence | Overload removal may help types, but no measured type/runtime delta. UNVERIFIED. |

<a id="f19"></a>
## F19 — Custom JSON Schema document model and rewrites

Count command: `node explorations/effect-schema-parity/research/idiom-census.mjs F19` => **31 matching lines / 6 files**. Ripgrep regex: `\b(?:JSONSchema|JsonSchema|SchemaRepresentation)\.`. Confidence **0.70**, disposition **candidate**.

| Dimension | Evidence / decision |
|---|---|
| Idiomatic form | Emit via `Schema.toJsonSchemaDocument` (`packages/effect/src/Schema.ts:14463`); import via `SchemaRepresentation.fromJsonSchemaDocument` (`packages/effect/src/SchemaRepresentation.ts:2880`); Role B emits then rewrites in `packages/effect/src/unstable/ai/AnthropicStructuredOutput.ts:61`. |
| Found / qualification | @beep/schema JSONSchema is a typed lossless draft document codec, not merely an emitter (`packages/foundation/modeling/schema/src/JSONSchema/JSONSchema.schema.ts:1`, `:376`, `:419`). codegen-kit already imports effect/JsonSchema and adds flattening transforms. |
| Detector sketch and existing-gate boundary | AST: separate schema emission, raw-document validation, representation import, and provider/codegen postprocessing. Namespace census is a broad review surface containing import strings/JSDoc. Name overlap cannot prove substitute semantics. |
| Examples / controls | `packages/foundation/modeling/schema/src/JSONSchema/JSONSchema.schema.ts:376`; `packages/foundation/modeling/schema/src/JSONSchema/JSONSchema.schema.ts:419`; `packages/tooling/library/codegen-kit/src/internal/transforms.ts:79` |
| Migration recipe | For common document intent adapt consumers to upstream JsonSchema/SchemaRepresentation; explicitly record lossless unknown-key, boolean-root and reference behavior changes. Keep only necessary consumer transformations; upstream Role B demonstrates some postprocessing is legitimate. Delete the local concept only with migrated consumers. |
| Cost / semantic evidence | JSON Schema validation is preliminary, not equivalent to decoding (SCHEMA.md:5122). Type/runtime and complete replacement behavior UNVERIFIED. |

<a id="f20"></a>
## F20 — Custom arbitrary composition versus native derivation

Count command: `node explorations/effect-schema-parity/research/idiom-census.mjs F20` => **83 matching lines / 16 files**. Ripgrep regex: `\b(?:Arbitrary|FastCheck|fc)\.|arbitrary:`. Confidence **0.95**, disposition **rejected**.

| Dimension | Evidence / decision |
|---|---|
| Idiomatic form | Native `Arbitrary.schema`, map, filter, flatMap, all: upstream `packages/effect/src/unstable/arbitrary/Arbitrary.ts:346`, `:383`, `:404`, `:459`, `:485`. |
| Found / qualification | Inspected Contradiction and highlight/page companions already compose native Arbitrary. Custom dependency-aware generators are not obsolete just because native derivation exists. |
| Detector sketch and existing-gate boundary | AST: resolve imports; distinguish old fast-check adapters from native all/map/filter composition. Compare generated cross-field invariants against schema checks before proposing derivation-only replacement. Existing arbitrary-tests gate covers test presence, not generator minimality. |
| Examples / controls | `packages/epistemic/domain/src/values/Contradiction/Contradiction.model.ts:1533`; `packages/epistemic/use-cases/src/ContradictionTriage/ContradictionTriage.rpc.ts:598`; `packages/epistemic/use-cases/src/ContradictionTriage/ContradictionTriage.rpc.ts:629` |
| Migration recipe | No blanket rewrite. Try Arbitrary.schema only when it can derive the model with bounded discards/shrinking; retain dependency-aware generation and native combinators as needed. |
| Cost / semantic evidence | Derivation can throw when a schema cannot be compiled or recursion lacks a provable finite route (Arbitrary.ts:336). Generator simplification benefit UNVERIFIED. |

<a id="f21"></a>
## F21 — Hand-rolled model variants

Count command: `node explorations/effect-schema-parity/research/idiom-census.mjs F21` => **65 matching lines / 11 files**. Ripgrep regex: `VariantSchema|Model\.Class|FieldOption`. Confidence **0.95**, disposition **rejected**.

| Dimension | Evidence / decision |
|---|---|
| Idiomatic form | Model is built on VariantSchema.make with database/JSON variants: upstream `packages/effect/src/unstable/schema/Model.ts:35`; generic variants `packages/effect/src/unstable/schema/VariantSchema.ts:349`; FieldOption `Model.ts:337`. |
| Found / qualification | effect-drizzle already imports/uses upstream VariantSchema; its Field carries additional database metadata. The observed code does not support a claim that variants were recreated instead of adopted. |
| Detector sketch and existing-gate boundary | AST: detect parallel select/insert/update schemas with repeated fields, then exclude wrappers using VariantSchema and database metadata. Namespace-only census proves adoption surface, not complete duplication census. |
| Examples / controls | `packages/ecosystem/effect-drizzle/src/sqlite/model.ts:17`; `packages/ecosystem/effect-drizzle/src/pg/derive.ts:48`; `packages/ecosystem/effect-drizzle/src/core/Field.ts:20` |
| Migration recipe | No broad migration established. Review genuinely repeated field declarations for Model/VariantSchema adoption, preserving omitted variant sets and default variant identity. |
| Cost / semantic evidence | Default class extraction and omitted variant semantics require pinned regression cases. Local cost/duplication count UNVERIFIED. |

<a id="f22"></a>
## F22 — Struct plus brand versus Class/Opaque

Count command: `node explorations/effect-schema-parity/research/idiom-census.mjs F22` => **262 matching lines / 139 files**. Ripgrep regex: `\b(?:S|Schema)\.brand\(`. Confidence **0.95**, disposition **rejected**.

| Dimension | Evidence / decision |
|---|---|
| Idiomatic form | Branding remains official (`packages/effect/SCHEMA.md:2683`). Opaque preserves plain values; Class introduces a prototype and instance behavior (`:3552`, `:3563`). Role B freely uses Struct (`packages/effect/src/unstable/devtools/DevToolsSchema.ts:25`). |
| Found / qualification | Brand census is mainly primitive domains. It does not establish a Struct-plus-brand anti-idiom; no blanket replacement is supported. |
| Detector sketch and existing-gate boundary | AST: inspect brand input and consumer requirements: opaque identity, instance behavior, prototype and constructor expectations. Existing exported-Struct gate is repo doctrine, not upstream universal preference. |
| Examples / controls | `apps/labs/api-docs/src/Catalog.models.ts:88`; `apps/labs/lejeune-bolt-workbench/src/domain/Ontology.ts:45`; `apps/labs/lejeune-bolt-workbench/src/domain/Ontology.ts:94` |
| Migration recipe | Use Opaque when a plain structural runtime with opaque TS identity is intended; Class for class behavior; retain primitive brands. Never exchange these solely on spelling. |
| Cost / semantic evidence | Runtime representation difference is evidenced; measured checker benefit UNVERIFIED. |

<a id="f23"></a>
## F23 — NullOr versus optional/Option defaults

Count command: `node explorations/effect-schema-parity/research/idiom-census.mjs F23` => **177 matching lines / 46 files**. Ripgrep regex: `\b(?:S|Schema)\.NullOr\(`. Confidence **0.95**, disposition **rejected**.

| Dimension | Evidence / decision |
|---|---|
| Idiomatic form | Optional-key and Option recipes are distinct: upstream `packages/effect/SCHEMA.md:398`, `:728`; NullOr is an official union (`packages/effect/src/Schema.ts:4829`). |
| Found / qualification | Database nullable fields and nullable external provider fields are legitimate. NullOr presence does not prove manual optional handling. |
| Detector sketch and existing-gate boundary | AST/dataflow: pair a nullable schema with repeated null fallback/normalization and verify internal Option intent. Respect external contracts; SFV4-null-return already gates explicit nullable returns, not nullable wire fields. |
| Examples / controls | `apps/oip-web/src/components/HeroVideo.tsx:58`; `packages/architecture-lab/tables/src/aggregates/WorkItem/WorkItem.table.ts:145`; `packages/architecture-lab/tables/src/aggregates/WorkItem/WorkItem.table.ts:146` |
| Migration recipe | Use OptionFromOptionalKey or matching documented optional/null recipe only for an actual internal invariant. Preserve wire null/absence distinctions unless explicitly adapting a consumer. |
| Cost / semantic evidence | No local performance evidence; UNVERIFIED. |

<a id="f24"></a>
## F24 — Opaque defect/equivalence wrappers

Count command: `node explorations/effect-schema-parity/research/idiom-census.mjs F24` => **157 matching lines / 116 files**. Ripgrep regex: `\b(?:Defect|OpaqueUnknown)\(`. Confidence **0.85**, disposition **candidate**.

| Dimension | Evidence / decision |
|---|---|
| Idiomatic form | Native `Schema.Defect` at upstream `packages/effect/src/Schema.ts:8732`; custom equality override remains supported at `:14283`. |
| Found / qualification | Local Defect delegates to S.Defect then marks all values equivalent; OpaqueUnknown similarly annotates S.Unknown (`packages/foundation/modeling/schema/src/Opaque.ts:52`, `:92`). These are not Schema.Opaque. Census intentionally includes native S.Defect and is not a wrapper-consumer count. |
| Detector sketch and existing-gate boundary | AST: resolve Defect/OpaqueUnknown imports to @beep/schema; native S.Defect is a negative control. Trace equivalence consumers before deleting the wrapper. Separate the F26 class-default correction from intentional opaque-field equality. |
| Examples / controls | `packages/foundation/modeling/schema/src/Opaque.ts:52`; `packages/foundation/modeling/schema/src/Opaque.ts:92`; `packages/drivers/duckdb/src/DuckDb.errors.ts:21` |
| Migration recipe | Adopt S.Defect and S.Unknown; either accept changed field equivalence under the locked decision or apply upstream overrideToEquivalence at the precise domain boundary that still requires ignored payloads. Update existing gate remediation that requires @beep/schema Defect. |
| Cost / semantic evidence | Changing always-equal fields changes semantics; no runtime/type-check improvement measured. UNVERIFIED. |

<a id="f25"></a>
## F25 — Encoded projection used as an executable boundary

Count command: `node explorations/effect-schema-parity/research/idiom-census.mjs F25` => **153 matching lines / 38 files**. Ripgrep regex: `\b(?:S|Schema)\.toEncoded\(`. Confidence **0.45**, disposition **candidate**.

| Dimension | Evidence / decision |
|---|---|
| Idiomatic form | `Schema.toEncoded` is a projection (`packages/effect/src/Schema.ts:2541`); HTTP boundary decodes the actual codec (`packages/effect/src/unstable/http/HttpIncomingMessage.ts:123`); encoded-side representations are discussed at `packages/effect/SCHEMA.md:5850`. |
| Found / qualification | Tool success schemas sometimes use S.toEncoded on a domain class; other occurrences deliberately compare wire identities or validate serialized fixtures. Neither use is automatically incorrect. |
| Detector sketch and existing-gate boundary | AST/dataflow: trace toEncoded outputs into Tool/RPC/HTTP contracts and determine whether the caller returns Type instances or Encoded values. Flag loss of a required transformation, not ordinary projection. |
| Examples / controls | `packages/foundation/capability/nlp-processing/src/Tools/Tokenize.ts:69`; `packages/foundation/capability/nlp-processing/src/Tools/LearnCorpus.ts:89`; `apps/labs/semantica/src/canary/Gold.ts:268` |
| Migration recipe | Keep full codec at boundaries requiring encode/decode behavior; retain toEncoded for explicit wire-only schemas and comparisons. Require representative transformed fields in regression proof. |
| Cost / semantic evidence | Potential loss of transformation is semantic, not a proven local bug. Runtime/type-check cost UNVERIFIED. |

<a id="f26"></a>
## F26 — Stale tagged-error equivalence gate

Count command: `node explorations/effect-schema-parity/research/idiom-census.mjs F26` => **484 matching lines / 247 files**. Ripgrep regex: `\.annoteError(?:<|\()`. Confidence **1.00**, disposition **correction**.

| Dimension | Evidence / decision |
|---|---|
| Idiomatic form | Class schema factory supplies fields-derived equivalence by default: upstream `packages/effect/src/Schema.ts:13940`; TaggedError delegates through Error/Class at `:14237`. Commit hint verified: `84864bc30c`. |
| Found / qualification | Existing SFV4-tagged-error-equivalence requires an explicit hook and claims runtime Error metadata is otherwise compared (`packages/tooling/tool/cli/src/commands/Lint/internal/SchemaFirstDetectors.ts:1150`). Identity documentation repeats that claim (`packages/foundation/modeling/identity/src/Id.ts:1108`). |
| Detector sketch and existing-gate boundary | Already gated: correct the existing rule and stale docs, do not propose another detector. annoteError census measures review exposure, not violations; annotations may still carry useful identity/error-reporter metadata. |
| Examples / controls | `apps/labs/ciops/src/projection/Schemas.ts:509`; `apps/labs/ciops/src/projection/Schemas.ts:532`; `apps/labs/ciops/src/projection/Schemas.ts:557` |
| Migration recipe | Remove the requirement for a redundant fields-only equivalence hook after pinned tests establish native behavior. Keep metadata annotations and deliberate custom field equivalences. Do not mechanically remove every annoteError call. |
| Cost / semantic evidence | Focused upstream-source runtime probe PASS: equal fields/different stacks => true; different fields => false. No performance measurement. |

<a id="f27"></a>
## F27 — Paired inclusive bounds instead of isBetween

Count command: `node explorations/effect-schema-parity/research/idiom-census.mjs F27` => **7 matching lines / 5 files**. Ripgrep regex: `S\.makeFilterGroup\(\[S\.isGreaterThanOrEqualTo\([^\n]+S\.isLessThanOrEqualTo\(`. Confidence **0.95**, disposition **candidate**.

| Dimension | Evidence / decision |
|---|---|
| Idiomatic form | `Schema.isBetween({ minimum, maximum })`: upstream `packages/effect/src/Schema.ts:7458`. |
| Found / qualification | LocalDate year/month/day and bounded numeric wrappers build groups of >= and <= checks rather than the combined built-in. |
| Detector sketch and existing-gate boundary | AST: makeFilterGroup containing only compatible numeric inclusive lower/upper bounds with constant limits; no per-check behavior that must remain distinct. Existing numeric-domain gate considers any check sufficient and misses this overlap. |
| Examples / controls | `packages/foundation/modeling/schema/src/LocalDate/LocalDate.schema.ts:58`; `packages/foundation/modeling/schema/src/LocalDate/LocalDate.schema.ts:59`; `packages/foundation/modeling/schema/src/LocalDate/LocalDate.schema.ts:60` |
| Migration recipe | Replace with isBetween; preserve group metadata where appropriate and record changed issue granularity/messages. Keep groups if individual issue reporting is a requirement that upstream composition must retain. |
| Cost / semantic evidence | Equivalent interval intent; issue shape may change. Fewer check objects is not a measured speedup. Cost UNVERIFIED. |

<a id="f28"></a>
## F28 — Whole-object uniqueness checks hiding field constraints

Count command: `node explorations/effect-schema-parity/research/idiom-census.mjs F28` => **14 matching lines / 8 files**. Ripgrep regex: `S\.makeFilter\([^\n]*(?:[Uu]nique|[Dd]edupe)`. Confidence **0.85**, disposition **candidate**.

| Dimension | Evidence / decision |
|---|---|
| Idiomatic form | `Schema.isUnique` uses Effect equality, emits uniqueItems and has constructive arbitrary uniqueness: upstream `packages/effect/src/Schema.ts:8475`, `:8489`. isUniqueKey is specifically for key/value tuples (`:8508`). |
| Found / qualification | EvalSelection checks uniqueness of w1/f1 arrays using HashSet size (`apps/labs/semantica/src/schema/Eval.ts:95`); batch/document ID uniqueness often projects keys from objects. |
| Detector sketch and existing-gate boundary | AST: resolve named uniqueness predicate; distinguish whole element equality from key projection. Move only direct array uniqueness onto the array field. isUniqueKey is not a general object-key selector. |
| Examples / controls | `apps/labs/semantica/src/corpus/Manifest.ts:208`; `apps/labs/semantica/src/schema/Eval.ts:100`; `apps/labs/semantica/src/schema/Eval.ts:106` |
| Migration recipe | Use array.check(S.isUnique()) for w1/f1. For objects unique by id, keep a justified custom check or adapt a tuple representation deliberately; do not compare whole objects as a substitute for identity keys. |
| Cost / semantic evidence | Native uniqueness carries JSON Schema and arbitrary metadata, unlike the shown opaque predicate. Measured discard-rate or runtime benefit UNVERIFIED. |

<a id="f29"></a>
## F29 — Schema guard wrapped back into a brand filter

Count command: `node explorations/effect-schema-parity/research/idiom-census.mjs F29` => **5 matching lines / 4 files**. Ripgrep regex: `S\.makeFilter\(S\.is\(`. Confidence **0.85**, disposition **candidate**.

| Dimension | Evidence / decision |
|---|---|
| Idiomatic form | Branded schema constructors are native (`packages/effect/SCHEMA.md:2833`); existing Brand constructors can integrate via fromBrand (`packages/effect/src/Schema.ts:5067`). |
| Found / qualification | DocumentIndex/TokenIndex/SentenceIndex build Brand.check(S.makeFilter(S.is(NonNegativeInt))). The permission-policy match is a schema guard reuse, not a brand constructor. |
| Detector sketch and existing-gate boundary | AST: Brand.check containing makeFilter(is(schema)); require relation to the exported branded schema. Exclude semantic membership checks and runtime handles. This is not covered by exported-type candidate detection alone. |
| Examples / controls | `packages/foundation/modeling/nlp/src/Core/Document.ts:102`; `packages/foundation/modeling/nlp/src/Core/Sentence.ts:55`; `packages/foundation/modeling/nlp/src/Core/Token.ts:72` |
| Migration recipe | Define the checked branded schema once and use its make constructor, adapting Brand.Constructor consumers as necessary. If preserving an existing brand constructor is required, use fromBrand rather than duplicate invariant declarations. |
| Cost / semantic evidence | Nested parser/predicate layer is observable; before/after runtime/type cost UNVERIFIED. |

<a id="f30"></a>
## F30 — Inline regex/comparison checks hiding built-ins

Count command: `node explorations/effect-schema-parity/research/idiom-census.mjs F30` => **9 matching lines / 7 files**. Ripgrep regex: `S\.makeFilter\([^\n]*(?:>=|<=|\.test\()`. Confidence **0.95**, disposition **candidate**.

| Dimension | Evidence / decision |
|---|---|
| Idiomatic form | `Schema.isPattern` at upstream `packages/effect/src/Schema.ts:6578`; numeric lower bound at `:7365`; format constraints `packages/effect/SCHEMA.md:5487`. |
| Found / qualification | Artifact extension/name callbacks simply call RegExp.test; OklchChroma is value >= 0. Tika trailing-slash callback negates a regex and returns a custom issue string, so it needs semantic adaptation. |
| Detector sketch and existing-gate boundary | AST: makeFilter predicate consisting of positive regex.test(value) or one numeric constant comparison. Preserve regex flags, annotation messages and input type; a negative predicate is not equivalent to isPattern(originalRegex). |
| Examples / controls | `packages/foundation/capability/file-processing/src/Artifact/Artifact.schema.ts:25`; `packages/foundation/capability/file-processing/src/Artifact/Artifact.schema.ts:44`; `packages/foundation/modeling/schema/src/Color/Color.oklch.ts:25` |
| Migration recipe | Use S.isPattern for positive regex checks and S.isGreaterThanOrEqualTo(0) for chroma. For negation design a matching positive constraint or retain custom logic. Do not turn cross-field comparisons into single-field bounds. |
| Cost / semantic evidence | Built-ins expose interpreter metadata, but JSON Schema regex semantics can differ (SCHEMA.md:5140). Measured type/runtime cost UNVERIFIED. |

## Focused semantic proof (F26)

Command: `bun explorations/effect-schema-parity/research/idiom-equivalence-probe.ts`.

```json
{"fieldsOnlyEqual":true,"differentFieldsEqual":false}
```

The saved probe imports the reference checkout directly, constructs unannotated TaggedError values, assigns different stacks, and checks equal versus unequal declared fields. It passed. This proves the tested native default for a string field; it does not prove that Defect fields are always equivalent, custom hooks can be deleted indiscriminately, or all repository error behavior is covered.

## Families rejected and why

| Rejection | Consequence for the future standing gate |
|---|---|
| ErrorClass and Schema.toJsonSchema as presumed public exports | Use Schema.Error and Schema.toJsonSchemaDocument; do not teach a detector an API that this checkout does not export under that name. `toJsonSchema` remains meaningful as an annotation/interpreter hook, not that public emitter function. |
| Any Struct/brand, suspend, mutable or sync decoder is non-idiomatic | These have upstream exemplars. Require type/boundary/initialization intent before emitting a finding. |
| LiteralKit is completely covered statically by Literals | It is built on Literals but adds a public helper contract. Retirement remains authorized by same intent; automatic one-token substitution is unsupported. |
| Native Arbitrary makes custom compositions obsolete | Dependencies and invariant-aware generation remain relevant; native map/all/filter are official APIs. |
| All JSON Schema rewriting is redundant | Role B Anthropic emission deliberately rewrites documents. Raw document codecs, emitted schemas and runtime representations are different surfaces. |
| Schema.is is an always-nonthrowing replacement for every guard | Upstream documents throws for non-schema causes; preserve explicit safe-guard semantics. |
| No Standard Schema use proves missing adoption | Need a consumer contract requiring it; this lane verified none. |
| documentation annotation is stale | It exists in current Annotations.Augment. |
| Missing spelling means complete absence | Aliased/named imports and multiline syntax require the proposed AST pass. Zero here is zero under the recorded regex. |
| Existing SFV4 families need duplicate upstream-parity detectors | Correct/extend existing rules and remediation; introduce new findings only for their documented gaps. |

## Handoff constraints

| Next research/goal input | Required evidence |
|---|---|
| Turn lexical queues into findings | Import-bound AST pass; distinguish comments/generated origins; classify candidate, intentional exception, upstream-covered retirement. No summed lexical total is a verified backlog. |
| Gate correction first | Ratify F26 correction against the pinned fixture; retain custom field policies and useful error annotations. |
| Same-intent retirements | Consumer adaptation list including behavior changes; no thin re-export aliases; delete only with all consumers migrated in the authorized goal PR. |
| Performance acceptance | Before/after TypeScript instantiations/check time first; representative decode/encode runtime second; disclose environment and schema shape. All proposed speedups remain UNVERIFIED. |
| Drift | Re-run the saved rg census against the actual migration base and re-pin upstream evidence on the Effect bump. Dirty-tree files can change independently of HEAD. |
