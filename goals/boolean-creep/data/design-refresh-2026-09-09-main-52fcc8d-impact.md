# Main `52fcc8d` impact inventory

## Scope and method

- Old corpus: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`.
- New fetched main: `52fcc8d1353db9481ef9edb6cc9619500f95568d`.
- Evidence was read from immutable Git objects with `git diff`, `git show`, and
  `git ls-tree`. The mutable checkout was not used as source evidence and was
  not changed by this audit.
- This is a delta-impact inventory, not a fresh census or an independent P3
  review. It identifies records and designs that need their source SHA, line
  citations, or semantic proof refreshed after the parent merges the new main.

The range contains 149 changed `packages/**/src/**` or `apps/**/src/**` paths.
Eight are under the campaign-excluded `apps/labs/**` trees. One additional path
is the generated Effect-law allowlist snapshot. The included authored corpus
therefore changes 140 product-source paths: 139 under `packages/**/src/**` and
`apps/professional-desktop/src/contradiction/ContradictionQaSeed.ts`.

## Delta character

Most changes are the schema-compiler hoist described by the commit: calls such
as `S.is(...)`, `S.decodeUnknown*`, and `S.encode*` move from functions to
module constants. Those edits shift citations but do not change the Boolean
owner's represented states, defaults, ordering, encoding, or error precedence.

Three areas require more than mechanical line refresh:

1. `packages/tooling/policy-pack/lint-rules/src/rules/no-inline-schema-compile.ts`
   changes classifier behavior. `isStaticSchemaReference` moves from line 61
   to 62 and now recursively requires the root of a member expression to be a
   static schema reference. `isNestedStaticSchemaCall` moves from 146 to 147
   and classifies the first argument of every schema call instead of treating
   every call except `fromJsonString` as nested-static. `reportMessage` moves
   from 158 to 168. The high-before-medium choice remains visible at new lines
   168-172, but the sets reaching each branch changed. Consequently
   `r3-tooling-inline-schema-compile-arg-kind` needs a complete semantic
   evidence and cardinality reread at the new SHA; a line-only edit is
   insufficient.
2. `packages/tooling/tool/cli/src/commands/Quality/internal/LaneProofReuse.ts`
   changes proof reuse semantics. `environmentProfileHash` includes ambient
   environment keys only when `lane.step.useLocalEnv === true`, proof
   persistence uses the prepared session's mode, and
   `prepareLaneProofSession` accepts an explicit mode override.
   `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts` threads that mode
   through GitHub-check wave execution. No current canonical Boolean-creep
   record or design cites `LaneProofReuse.ts`; the records in `Tasks.ts` listed
   below retain their domains and require only their listed line updates.
3. `packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.ts` adds
   the exported testing seam `noteAdmissionWaitForTesting` at new lines
   1806-1821. Production scheduling behavior is unchanged. Evidence before the
   insertion remains fixed. The later wait-loop evidence for
   `scheduler-promotion-tick-origin` moves from 1834 to 1851, and the design's
   broader old migration range `1806-1845` should become `1823-1862`.

Other non-hoist changes include Effect Drizzle static/type corrections, shared
schema utilities, and formatting/type cleanup in `Html.model.ts`. They do not
change the qualified Boolean owners identified below. The generated Effect-law
allowlist snapshot also changes, but generated files remain outside this
campaign's source corpus.

## Required design refreshes

The following already-authored designs intersect changed source or cited
evidence. Each should name the new source SHA and use the new anchors shown in
the inventory appendix.

- Full semantic reread: `r3-tooling-inline-schema-compile-arg-kind`.
- Scheduler test-seam shift: `scheduler-promotion-tick-origin`. Its owner and
  E1 evidence are unchanged; refresh the later E2/wait-loop citation and the
  migration range. `scheduler-admission-attempt-origin` is source-identical at
  every canonical cite.
- Mechanical codec-hoist/line refresh:
  `runners-bake-freshness`, `drivers-migration-journal-shape-row`,
  `create-package-template-type-flags`,
  `create-package-template-app-kind-flags`, `venice-sse-done-payload`,
  `corpus-legacy-word-terminal`, `goals-repair-fork-mode`,
  `goals-migrate-conventions-mode`, `html-select-child-grammar`,
  `html-dl-child-grammar`, `r3-tooling-quality-repo-wide-step-gates`,
  `r3-tooling-quality-root-audit-head-kind`,
  `html-img-sizes-disposition`, `html-link-imagesizes-disposition`,
  `scheduler-protocol-eviction-mode`, `coverage-baseline-write-mode`,
  `yeet-prepared-publish-commit`, `corpus-pst-terminal`,
  `ci-lane-timings-render-mode`, `goals-packet-snapshot-presence`,
  `worktree-idle-reading`, `worktree-pr-classification`,
  `worktree-reap-candidate-retirement`, `receipt-fallback-draft-occupancy`,
  and the post-line-296 consumer citations in `jsdoc-fence-state`.
- `citation-blank-page` has unchanged product source but its cited test line
  moves from 571 to 626; refresh that evidence citation.

## Requested pending-design checks

- `r26-apps-sidecar-ipc-ready-latch`: both
  `apps/professional-desktop/src-tauri/src/lib.rs` and
  `apps/professional-desktop/src/transport/SidecarTransport.ts` are unchanged.
- `r26-cli-commands-l-q-allowlist-check-ok`: `AllowlistCheck.ts`, its command
  wrapper, test kit, and tests are unchanged.
- `r26-cli-commands-l-q-osv-ignore-expiry`:
  `Quality.osv-ignore.ts` is unchanged. `Quality.command.ts` changes elsewhere;
  reread any command-wrapper line citations after merge, but the OSV expiry
  codec/domain itself has no semantic delta.
- `r26-cli-commands-d-k-docgen-quality-command-scope`,
  `docgen-proof-manifest-verification-reason`,
  `docgen-worker-packet-review`, and `package-inventory-docgen-coverage`: their
  defining Docgen/quality-inventory sources are unchanged.
- `r26-cli-commands-d-k-goals-index-command-mode`,
  `goals-packet-migration-kind`, `r2-tooling-packet-transition-stream-trace`,
  and `codex-findings-packet-commit-kind`: defining sources are unchanged.
  `Goals/Adopt.ts` did shift, so the secondary snapshot-presence evidence at
  old line 172 becomes new line 174.
- `receipt-fallback-draft-occupancy`: the owner in `Chat.atoms.ts` moves from
  1017 to 1019 and its constructor evidence from 1030 to 1032. The change in
  that file is a hoisted schema guard; the fallback contract is unchanged.
- `worktree-reap-candidate-retirement`: `Reap.schemas.ts` is unchanged. Its
  `Reap.service.ts` evidence moves by two lines: 406 to 408 and 493 to 495.
- `r3-tooling-coverage-scope-input-kind`: `CoverageScope.ts` is unchanged.
  `coverage-baseline-write-mode` references `Tasks.ts`, where its owner moves
  from 251 to 252 and its E4 cite from 663 to 664.
- The CLI fence owner `jsdoc-fence-state` remains at lines 41-86. A hoisted
  guard inserted later in `JSDocSections.ts` shifts downstream parser consumers
  by one line only; the state proof itself is unchanged.

No requested pending design needs requalification solely because of this
delta. All still need their normal post-merge source-SHA/citation refresh before
formal P3.

## Included source paths

The included paths are grouped compactly by workspace. `apps/labs/**` is
omitted here because it is excluded by the campaign corpus rule.

- `apps/professional-desktop`: `src/contradiction/ContradictionQaSeed.ts`.
- `packages/agents/client`: `src/Chat.atoms.ts`, `src/ClientObservability.ts`.
- `packages/documents/domain`: `src/values/Taxonomy/Taxonomy.projection.ts`.
- `packages/drivers`: ACP, AI-provider CLI, Box, Box provisioning, Drizzle,
  Firecrawl, FreshBooks, HubSpot, libpff, M365, N3, Pacer, Phoenix, Postgres,
  Pretext, RDF canonize, Runpod, Tika, Venice, and Wink source files shown by
  the immutable range; 32 included files total.
- `packages/ecosystem/effect-drizzle`: `src/core/assembly.ts` and
  `src/internal/statics.ts`.
- `packages/epistemic/use-cases`:
  `src/ClaimProjection/ClaimProjection.ts`.
- `packages/foundation/capability`: five files across API transport, file
  processing, LangExtract, and observability.
- `packages/foundation/modeling`: 37 files across HTML, identity, lexical,
  Markdown, NLP, Pandoc AST, schema codecs, skill contract, and utils.
- `packages/foundation/ui-system`: eight files across Dock, editor, and the
  number-input hook.
- `packages/law-practice`: three files across domain, server, and use-cases.
- `packages/ontology/use-cases`: `src/tools/OntologyToolService.ts`.
- `packages/shared/domain`: `src/values/LocalDate/LocalDate.behavior.ts`.
- `packages/tooling/library`: six files across AI metrics and repo utils.
- `packages/tooling/policy-pack`: the inline-schema-compile rule. The changed
  generated allowlist snapshot is excluded from the authored-source manifest.
- `packages/tooling/tool`: 42 files across CLI commands/internal scheduler and
  residue logic.


Exact included manifest:

```text
apps/professional-desktop/src/contradiction/ContradictionQaSeed.ts
packages/agents/client/src/Chat.atoms.ts
packages/agents/client/src/ClientObservability.ts
packages/documents/domain/src/values/Taxonomy/Taxonomy.projection.ts
packages/drivers/acp/src/AcpProtocol.service.ts
packages/drivers/ai-provider-cli/src/AiProviderCli.service.ts
packages/drivers/box-provisioning/src/BoxProvisioningApplier.ts
packages/drivers/box-provisioning/src/BoxProvisioningArtifacts.ts
packages/drivers/box-provisioning/src/BoxProvisioningInventory.ts
packages/drivers/box-provisioning/src/internal/canonical.ts
packages/drivers/box-provisioning/src/internal/live.ts
packages/drivers/box/src/Box.streaming.ts
packages/drivers/drizzle/src/Drizzle.errors.ts
packages/drivers/firecrawl/src/Firecrawl.service.ts
packages/drivers/freshbooks/src/Freshbooks.service.ts
packages/drivers/hubspot/src/HubSpot.service.ts
packages/drivers/libpff/src/Libpff.pffexport.ts
packages/drivers/libpff/src/Libpff.service.ts
packages/drivers/m365/src/M365.service.ts
packages/drivers/n3/src/N3.service.ts
packages/drivers/pacer/src/Pacer.config.ts
packages/drivers/pacer/src/Pacer.mock-data.ts
packages/drivers/pacer/src/PclClient.service.ts
packages/drivers/phoenix/src/Phoenix.errors.ts
packages/drivers/postgres/src/PostgresDrizzle.service.ts
packages/drivers/pretext/src/Pretext.models.ts
packages/drivers/rdf-canonize/src/adapters/canonicalization.ts
packages/drivers/runpod/src/Runpod.service.ts
packages/drivers/tika/src/Tika.server.ts
packages/drivers/venice-ai/src/VeniceAI.service.ts
packages/drivers/wink/src/WinkCorpus.service.ts
packages/drivers/wink/src/WinkTools.service.ts
packages/drivers/wink/src/WinkVectorizer.service.ts
packages/ecosystem/effect-drizzle/src/core/assembly.ts
packages/ecosystem/effect-drizzle/src/internal/statics.ts
packages/epistemic/use-cases/src/ClaimProjection/ClaimProjection.ts
packages/foundation/capability/api-transport/src/Transport.ts
packages/foundation/capability/file-processing/src/test.ts
packages/foundation/capability/langextract/src/Extraction/Extraction.behavior.ts
packages/foundation/capability/observability/src/CauseRedaction.ts
packages/foundation/capability/observability/src/internal/decode.ts
packages/foundation/modeling/html/src/Html.conformance.ts
packages/foundation/modeling/html/src/Html.meta.ts
packages/foundation/modeling/html/src/Html.model.ts
packages/foundation/modeling/html/src/Html.policy.ts
packages/foundation/modeling/html/src/Html.serialize.ts
packages/foundation/modeling/html/src/internal/conformance/Html.heading-conformance.ts
packages/foundation/modeling/identity/src/Id.ts
packages/foundation/modeling/lexical/src/Lexical.codec.ts
packages/foundation/modeling/md/src/Md.ts
packages/foundation/modeling/nlp/src/Core/Pattern.ts
packages/foundation/modeling/nlp/src/Core/PatternParsers.ts
packages/foundation/modeling/pandoc-ast/src/Pandoc.mapping.ts
packages/foundation/modeling/schema/src/CrossOriginEmbedderPolicy/CrossOriginEmbedderPolicy.schema.ts
packages/foundation/modeling/schema/src/CrossOriginOpenerPolicy/CrossOriginOpenerPolicy.schema.ts
packages/foundation/modeling/schema/src/CrossOriginResourcePolicy/CrossOriginResourcePolicy.schema.ts
packages/foundation/modeling/schema/src/Csp/Csp.schema.ts
packages/foundation/modeling/schema/src/ExpectCt/ExpectCt.schema.ts
packages/foundation/modeling/schema/src/ForceHttpsRedirect/ForceHttpsRedirect.schema.ts
packages/foundation/modeling/schema/src/JSONSchema/JSONSchema.shared.ts
packages/foundation/modeling/schema/src/Jsonc.ts
packages/foundation/modeling/schema/src/Jsonl.ts
packages/foundation/modeling/schema/src/Markdown.ts
packages/foundation/modeling/schema/src/NoOpen/NoOpen.schema.ts
packages/foundation/modeling/schema/src/NoSniff/NoSniff.schema.ts
packages/foundation/modeling/schema/src/PermissionsPolicy/PermissionsPolicy.schema.ts
packages/foundation/modeling/schema/src/PermittedCrossDomainPolicies/PermittedCrossDomainPolicies.schema.ts
packages/foundation/modeling/schema/src/ReferrerPolicy/ReferrerPolicy.schema.ts
packages/foundation/modeling/schema/src/SchemaUtils/withCodecStatics.ts
packages/foundation/modeling/schema/src/Toml.ts
packages/foundation/modeling/schema/src/URL.ts
packages/foundation/modeling/schema/src/Xml.ts
packages/foundation/modeling/schema/src/Yaml.ts
packages/foundation/modeling/skill-contract/src/SkillProjection.ts
packages/foundation/modeling/utils/src/Array.ts
packages/foundation/modeling/utils/src/Glob.ts
packages/foundation/modeling/utils/src/Schema.ts
packages/foundation/modeling/utils/src/Struct.ts
packages/foundation/ui-system/dock/src/DockEngine.service.ts
packages/foundation/ui-system/editor/src/capability/composer.tsx
packages/foundation/ui-system/editor/src/chat/attachment-model.ts
packages/foundation/ui-system/editor/src/chat/chat-composer.tsx
packages/foundation/ui-system/editor/src/code-block-node.tsx
packages/foundation/ui-system/editor/src/composer.tsx
packages/foundation/ui-system/editor/src/mermaid-node.tsx
packages/foundation/ui-system/ui/src/hooks/useNumberInput.ts
packages/law-practice/domain/src/values/PatentDocument/PatentDocument.normalizer.ts
packages/law-practice/server/src/PracticeKg.claims.ts
packages/law-practice/use-cases/src/LegalPositionRelatorPolicy/LegalPositionRelatorPolicy.service.ts
packages/ontology/use-cases/src/tools/OntologyToolService.ts
packages/shared/domain/src/values/LocalDate/LocalDate.behavior.ts
packages/tooling/library/ai-metrics/src/archive.ts
packages/tooling/library/ai-metrics/src/otlp.ts
packages/tooling/library/repo-utils/src/JSDoc/models/JSDocTagDefinition.model.ts
packages/tooling/library/repo-utils/src/JSDoc/models/TSCategory.model.ts
packages/tooling/library/repo-utils/src/TSMorph/TSMorph.model.ts
packages/tooling/library/repo-utils/src/schemas/JSDocCategories.ts
packages/tooling/policy-pack/lint-rules/src/rules/no-inline-schema-compile.ts
packages/tooling/tool/cli/src/commands/Architecture/Architecture.command.ts
packages/tooling/tool/cli/src/commands/Cache/Cache.command.ts
packages/tooling/tool/cli/src/commands/Ci/CiLane.ts
packages/tooling/tool/cli/src/commands/Ci/LaneTimings.ts
packages/tooling/tool/cli/src/commands/Corpus/Corpus.command.ts
packages/tooling/tool/cli/src/commands/Corpus/internal/RestorationTransformations.ts
packages/tooling/tool/cli/src/commands/Corpus/internal/ServicePrograms.ts
packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts
packages/tooling/tool/cli/src/commands/DeletePackage/DeletePackage.command.ts
packages/tooling/tool/cli/src/commands/Files/Files.command.ts
packages/tooling/tool/cli/src/commands/Files/internal/MatchPerson.model-store.ts
packages/tooling/tool/cli/src/commands/Files/internal/Process.ts
packages/tooling/tool/cli/src/commands/Goals/Adopt.ts
packages/tooling/tool/cli/src/commands/Goals/Bootstrap.ts
packages/tooling/tool/cli/src/commands/Goals/Migration/Migration.command.ts
packages/tooling/tool/cli/src/commands/Goals/Migration/PacketMutation.ts
packages/tooling/tool/cli/src/commands/Knowledge/Knowledge.command-surface.ts
packages/tooling/tool/cli/src/commands/Qa/Control.ts
packages/tooling/tool/cli/src/commands/Qa/Extract.ts
packages/tooling/tool/cli/src/commands/Qa/JudgePack.ts
packages/tooling/tool/cli/src/commands/Qa/Qa.session.ts
packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts
packages/tooling/tool/cli/src/commands/Quality/Tasks.ts
packages/tooling/tool/cli/src/commands/Quality/internal/CoverageRegression.ts
packages/tooling/tool/cli/src/commands/Quality/internal/LaneProofReuse.ts
packages/tooling/tool/cli/src/commands/Research/Research.command.ts
packages/tooling/tool/cli/src/commands/Research/internal/Daily.ts
packages/tooling/tool/cli/src/commands/Runners/Runners.service.ts
packages/tooling/tool/cli/src/commands/SyncDataToTs/targets/CldrTerritories.ts
packages/tooling/tool/cli/src/commands/SyncDataToTs/targets/IanaMediaTypes.ts
packages/tooling/tool/cli/src/commands/SyncDataToTs/targets/Iso4217.ts
packages/tooling/tool/cli/src/commands/TsconfigSync/TsconfigSync.plan.ts
packages/tooling/tool/cli/src/commands/Worktree/Reap.command.ts
packages/tooling/tool/cli/src/commands/Worktree/Reap.service.ts
packages/tooling/tool/cli/src/commands/Yeet/Yeet.command.ts
packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts
packages/tooling/tool/cli/src/commands/Yeet/internal/ProofDigest.ts
packages/tooling/tool/cli/src/commands/Yeet/internal/Provenance.ts
packages/tooling/tool/cli/src/commands/Yeet/internal/Resume.ts
packages/tooling/tool/cli/src/internal/jsdoc/JSDocSections.ts
packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.ts
packages/tooling/tool/cli/src/internal/repo-run/ResidueReap.ts
```

The exact path set is reproducible without checkout mutation with:

```sh
git diff --name-only \
  9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1 \
  52fcc8d1353db9481ef9edb6cc9619500f95568d \
  -- 'packages/**/src/**' 'apps/**/src/**'
```

## Canonical inventory citation map

This table is the intersection of the current canonical
`goals/boolean-creep/data/inventory.jsonl` with every path changed in the Git
range. `P` is the primary location. The mapping uses unchanged line identity
between the two immutable blobs; semantic exceptions are called out above.
“Design” reports whether a same-ID design file currently exists, so the parent
can prioritize authored design refresh separately from inventory-only records.

| ID | Design | Old cite -> new cite |
| --- | --- | --- |
| `runners-bake-freshness` | yes | `packages/tooling/tool/cli/src/commands/Runners/Runners.service.ts` E4 `780` -> `785` |
| `pretext-engine-profile` | no | `packages/drivers/pretext/src/Pretext.models.ts` P `53` -> `53` |
| `drivers-migration-journal-shape-row` | yes | `packages/drivers/postgres/src/PostgresDrizzle.service.ts` P `348` -> `349`; E2 `469` -> `473`; E4 `472` -> `476` |
| `drivers-acp-protocol-logging-options` | no | `packages/drivers/acp/src/AcpProtocol.service.ts` P `278` -> `280` |
| `drivers-corpus-stats-params` | no | `packages/drivers/wink/src/WinkCorpus.service.ts` P `78` -> `80` |
| `glob-options-scan-flags` | no | `packages/foundation/modeling/utils/src/Glob.ts` P `85` -> `85` |
| `resolved-glob-options-scan-flags` | no | `packages/foundation/modeling/utils/src/Glob.ts` P `108` -> `108` |
| `force-https-redirect-config-flags` | no | `packages/foundation/modeling/schema/src/ForceHttpsRedirect/ForceHttpsRedirect.schema.ts` P `42` -> `42` |
| `chat-composer-props-gates` | no | `packages/foundation/ui-system/editor/src/chat/chat-composer.tsx` P `147` -> `151` |
| `composer-footer-feature-gates` | no | `packages/foundation/ui-system/editor/src/chat/chat-composer.tsx` P `190` -> `194` |
| `composer-surface-props-gates` | no | `packages/foundation/ui-system/editor/src/chat/chat-composer.tsx` P `295` -> `299` |
| `composer-body-props-gates` | no | `packages/foundation/ui-system/editor/src/chat/chat-composer.tsx` P `359` -> `363` |
| `use-number-input-options` | no | `packages/foundation/ui-system/ui/src/hooks/useNumberInput.ts` P `652` -> `653` |
| `number-input-modifier-keys` | no | `packages/foundation/ui-system/ui/src/hooks/useNumberInput.ts` P `62` -> `63` |
| `number-input-step-modifiers` | no | `packages/foundation/ui-system/ui/src/hooks/useNumberInput.ts` P `67` -> `68` |
| `create-package-template-type-flags` | yes | `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts` P `728` -> `732`; E1 `1483` -> `1487` |
| `create-package-template-app-kind-flags` | yes | `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts` P `728` -> `732`; E1 `1486` -> `1490`; E4 `1491` -> `1495` |
| `create-package-template-lab-ecosystem` | no | `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts` P `719` -> `723` |
| `create-package-scaffold-shape` | no | `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts` P `473` -> `477` |
| `yeet-command-shared-options` | no | `packages/tooling/tool/cli/src/commands/Yeet/Yeet.command.ts` P `467` -> `468` |
| `yeet-handler-test-plan-options` | no | `packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts` P `1950` -> `1953` |
| `runners-aws-ebs-block-device` | no | `packages/tooling/tool/cli/src/commands/Runners/Runners.service.ts` P `75` -> `80` |
| `delete-package-handler-options` | no | `packages/tooling/tool/cli/src/commands/DeletePackage/DeletePackage.command.ts` P `553` -> `555` |
| `ci-lane-run-options` | no | `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts` P `619` -> `619` |
| `ci-local-options` | no | `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts` P `2324` -> `2326` |
| `ci-local-step-plan` | no | `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts` P `2389` -> `2391` |
| `quality-test-lane-selection` | no | `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts` P `232` -> `233` |
| `quality-coverage-task-options` | no | `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts` P `249` -> `250` |
| `venice-sse-done-payload` | yes | `packages/drivers/venice-ai/src/VeniceAI.service.ts` P `648` -> `649`; E3 `1899` -> `1900` |
| `r3-foundation-img-responsive-presence` | no | `packages/foundation/modeling/html/src/Html.conformance.ts` P `1061` -> `1065` |
| `r3-foundation-link-responsive-presence` | no | `packages/foundation/modeling/html/src/Html.conformance.ts` P `1107` -> `1111` |
| `r3-foundation-glob-entry-facts` | no | `packages/foundation/modeling/utils/src/Glob.ts` P `398` -> `399` |
| `corpus-organize-category-flags` | no | `packages/tooling/tool/cli/src/commands/Corpus/internal/ServicePrograms.ts` P `2246` -> `2250` |
| `html-element-meta-void-rawtext` | no | `packages/foundation/modeling/html/src/Html.meta.ts` P `1754` -> `1754` |
| `corpus-legacy-word-terminal` | yes | `packages/tooling/tool/cli/src/commands/Corpus/internal/RestorationTransformations.ts` P `3277` -> `3283`; E1 `1351` -> `1357` |
| `goals-repair-fork-mode` | yes | `packages/tooling/tool/cli/src/commands/Goals/Migration/Migration.command.ts` P `103` -> `105`; E2 `57` -> `59` |
| `goals-migrate-conventions-mode` | yes | `packages/tooling/tool/cli/src/commands/Goals/Migration/Migration.command.ts` P `617` -> `619`; E2 `644` -> `646` |
| `html-picture-source-sizes-auto` | no | `packages/foundation/modeling/html/src/Html.conformance.ts` P `1056` -> `1060` |
| `jsonc-parser-sdk-flags` | no | `packages/foundation/modeling/schema/src/Jsonc.ts` P `54` -> `54` |
| `xml-parser-sdk-flags` | no | `packages/foundation/modeling/schema/src/Xml.ts` P `26` -> `26` |
| `identity-property-descriptor-flags` | no | `packages/foundation/modeling/identity/src/Id.ts` P `1986` -> `1989` |
| `goals-adopt-plan-json` | no | `packages/tooling/tool/cli/src/commands/Goals/Adopt.ts` P `505` -> `507` |
| `goals-bootstrap-plan-json` | no | `packages/tooling/tool/cli/src/commands/Goals/Bootstrap.ts` P `883` -> `886` |
| `quality-tmpfs-reap-apply-json` | no | `packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts` P `3482` -> `3486` |
| `create-package-command-flags` | no | `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts` P `1117` -> `1121` |
| `yeet-monitor-command-route` | no | `packages/tooling/tool/cli/src/commands/Yeet/Yeet.command.ts` P `502` -> `503` |
| `r2-foundation-html-audio-boolean-attrs` | no | `packages/foundation/modeling/html/src/Html.model.ts` P `875` -> `859` |
| `r2-foundation-html-button-boolean-attrs` | no | `packages/foundation/modeling/html/src/Html.model.ts` P `1618` -> `1590` |
| `r2-foundation-html-form-boolean-attrs` | no | `packages/foundation/modeling/html/src/Html.model.ts` P `3133` -> `3079` |
| `r2-foundation-html-img-boolean-attrs` | no | `packages/foundation/modeling/html/src/Html.model.ts` P `4131` -> `4061` |
| `r2-foundation-html-input-boolean-attrs` | no | `packages/foundation/modeling/html/src/Html.model.ts` P `4258` -> `4187` |
| `r2-foundation-html-marquee-boolean-attrs` | no | `packages/foundation/modeling/html/src/Html.model.ts` P `5222` -> `5138` |
| `r2-foundation-html-object-boolean-attrs` | no | `packages/foundation/modeling/html/src/Html.model.ts` P `5914` -> `5818` |
| `r2-foundation-html-ol-boolean-attrs` | no | `packages/foundation/modeling/html/src/Html.model.ts` P `6020` -> `5923` |
| `r2-foundation-html-option-boolean-attrs` | no | `packages/foundation/modeling/html/src/Html.model.ts` P `6142` -> `6043` |
| `r2-foundation-html-script-boolean-attrs` | no | `packages/foundation/modeling/html/src/Html.model.ts` P `7016` -> `6901` |
| `r2-foundation-html-select-boolean-attrs` | no | `packages/foundation/modeling/html/src/Html.model.ts` P `7227` -> `7109` |
| `r2-foundation-html-template-shadowroot-flags` | no | `packages/foundation/modeling/html/src/Html.model.ts` P `8213` -> `8069` |
| `r2-foundation-html-textarea-boolean-attrs` | no | `packages/foundation/modeling/html/src/Html.model.ts` P `8290` -> `8145` |
| `r2-foundation-html-video-boolean-attrs` | no | `packages/foundation/modeling/html/src/Html.model.ts` P `9051` -> `8884` |
| `html-select-child-grammar` | yes | `packages/foundation/modeling/html/src/Html.conformance.ts` P `1912` -> `1916`; E1 `1912` -> `1916` |
| `html-dl-child-grammar` | yes | `packages/foundation/modeling/html/src/Html.conformance.ts` P `1787` -> `1791`; E1 `1787` -> `1791` |
| `r2-foundation-retry1-number-input-spin-disabled` | no | `packages/foundation/ui-system/ui/src/hooks/useNumberInput.ts` P `967` -> `968` |
| `r2-foundation-retry1-cause-redaction-truncation` | no | `packages/foundation/capability/observability/src/CauseRedaction.ts` P `350` -> `352` |
| `html-datalist-child-grammar` | no | `packages/foundation/modeling/html/src/Html.conformance.ts` P `1876` -> `1880` |
| `html-media-child-grammar` | no | `packages/foundation/modeling/html/src/Html.conformance.ts` P `1839` -> `1843` |
| `r3-tooling-packet-mutation-restore-presence` | no | `packages/tooling/tool/cli/src/commands/Goals/Migration/PacketMutation.ts` P `255` -> `257` |
| `r3-tooling-packet-mutation-repair-root-residue` | no | `packages/tooling/tool/cli/src/commands/Goals/Migration/PacketMutation.ts` P `293` -> `295` |
| `r2-foundation-html-foreign-entry-flags` | no | `packages/foundation/modeling/html/src/Html.conformance.ts` P `2011` -> `2015` |
| `chat-timeline-refresh-latch` | no | `packages/agents/client/src/Chat.atoms.ts` P `959` -> `961` |
| `wink-token-punctuation-word-like` | no | `packages/drivers/wink/src/WinkTools.service.ts` P `49` -> `51` |
| `wink-token-to-ai-flags` | no | `packages/drivers/wink/src/WinkTools.service.ts` P `121` -> `123` |
| `venice-response-content-type-classifiers` | no | `packages/drivers/venice-ai/src/VeniceAI.service.ts` P `1523` -> `1524` |
| `rdf-canonize-budget-failure-heuristics` | no | `packages/drivers/rdf-canonize/src/adapters/canonicalization.ts` P `168` -> `170` |
| `r3-foundation-attribute-requirement-gates` | no | `packages/foundation/modeling/html/src/Html.conformance.ts` P `1315` -> `1319` |
| `with-codec-statics-install-on-owned-schema` | no | `packages/foundation/modeling/schema/src/SchemaUtils/withCodecStatics.ts` P `351` -> `352` |
| `struct-from-entries-property-descriptor-flags` | no | `packages/foundation/modeling/utils/src/Struct.ts` P `697` -> `698` |
| `acp-client-protocol-capabilities` | no | `packages/drivers/acp/src/AcpProtocol.service.ts` P `853` -> `855` |
| `acp-server-protocol-capabilities` | no | `packages/drivers/acp/src/AcpProtocol.service.ts` P `870` -> `872` |
| `r3-tooling-quality-scheduler-admission-probes` | no | `packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.ts` P `673` -> `673` |
| `r3-domains-ontology-tool-delta-shape-probes` | no | `packages/ontology/use-cases/src/tools/OntologyToolService.ts` P `185` -> `187` |
| `r3-tooling-quality-repo-wide-step-gates` | yes | `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts` P `780` -> `781`; E4 `781` -> `782` |
| `r3-tooling-jsdoc-category-char-class-gates` | no | `packages/tooling/library/repo-utils/src/schemas/JSDocCategories.ts` P `290` -> `290` |
| `r3-tooling-qa-extract-event-kind-gates` | no | `packages/tooling/tool/cli/src/commands/Qa/Extract.ts` P `80` -> `85` |
| `r3-tooling-coverage-owned-arg-kinds` | no | `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts` P `614` -> `615` |
| `r3-tooling-delete-package-collision-gates` | no | `packages/tooling/tool/cli/src/commands/DeletePackage/DeletePackage.command.ts` P `566` -> `568` |
| `r3-domains-patent-normalizer-shape-guards` | no | `packages/law-practice/domain/src/values/PatentDocument/PatentDocument.normalizer.ts` P `32` -> `35` |
| `r3-domains-localdate-order-predicates` | no | `packages/shared/domain/src/values/LocalDate/LocalDate.behavior.ts` P `352` -> `352` |
| `r3-tooling-test-tsgo-collect-gates` | no | `packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts` P `1294` -> `1298` |
| `r3-tooling-dead-lease-scope-plan-guards` | no | `packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.ts` P `1493` -> `1493` |
| `r3-tooling-quality-law-path-gates` | no | `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts` P `2283` -> `2286` |
| `r3-tooling-knowledge-static-node-gates` | no | `packages/tooling/tool/cli/src/commands/Knowledge/Knowledge.command-surface.ts` P `216` -> `216` |
| `r3-apps-contradiction-qa-mkdir-recursive` | no | `apps/professional-desktop/src/contradiction/ContradictionQaSeed.ts` P `905` -> `907` |
| `r3-domains-chat-turn-active-receipt-uncertain` | no | `packages/agents/client/src/Chat.atoms.ts` P `812` -> `814` |
| `r3-tooling-inline-schema-compile-arg-kind` | yes | `packages/tooling/policy-pack/lint-rules/src/rules/no-inline-schema-compile.ts` P `61` -> `62`; E2 `158` -> `168` |
| `r3-tooling-quality-root-audit-head-kind` | yes | `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts` P `281` -> `282`; E2 `330` -> `331` |
| `r3-tooling-model-store-retry-gates` | no | `packages/tooling/tool/cli/src/commands/Files/internal/MatchPerson.model-store.ts` P `161` -> `162` |
| `r3-tooling-quality-tsconfig-profile-gates` | no | `packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts` P `1860` -> `1864` |
| `r3-drivers-arch-box-applier-blocker-predicates` | no | `packages/drivers/box-provisioning/src/BoxProvisioningApplier.ts` P `527` -> `530` |
| `r3-drivers-arch-pcl-failure-classifiers` | no | `packages/drivers/pacer/src/PclClient.service.ts` P `97` -> `100` |
| `r3-drivers-arch-drizzle-error-context-probes` | no | `packages/drivers/drizzle/src/Drizzle.errors.ts` P `176` -> `176` |
| `r3-tooling-coverage-regression-path-schemas` | no | `packages/tooling/tool/cli/src/commands/Quality/internal/CoverageRegression.ts` P `154` -> `154` |
| `r3-tooling-create-package-plugin-gates` | no | `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts` P `160` -> `160` |
| `r3-tooling-quality-tasks-env-arg-gates` | no | `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts` P `772` -> `773` |
| `r3-tooling-tsconfig-sync-plan-export-gates` | no | `packages/tooling/tool/cli/src/commands/TsconfigSync/TsconfigSync.plan.ts` P `490` -> `492` |
| `r3-tooling-judge-pack-green-gates` | no | `packages/tooling/tool/cli/src/commands/Qa/JudgePack.ts` P `374` -> `376` |
| `r3-tooling-coverage-selected-steps-options` | no | `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts` P `2723` -> `2726` |
| `r3-tooling-create-package-literal-guards` | no | `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts` P `222` -> `222` |
| `r3-drivers-arch-venice-content-type-probes` | no | `packages/drivers/venice-ai/src/VeniceAI.service.ts` P `1528` -> `1529` |
| `r3-drivers-arch-m365-path-extension-probes` | no | `packages/drivers/m365/src/M365.service.ts` P `121` -> `124` |
| `r3-tooling-ci-lane-docgen-input-kind` | no | `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts` P `1570` -> `1572` |
| `r3-tooling-lane-timings-window-row-guards` | no | `packages/tooling/tool/cli/src/commands/Ci/LaneTimings.ts` P `1768` -> `1768` |
| `r3-tooling-goals-adopt-path-kinds` | no | `packages/tooling/tool/cli/src/commands/Goals/Adopt.ts` P `57` -> `59` |
| `r24-foundation-modeling-rest-link-sizes-issue-flags` | no | `packages/foundation/modeling/html/src/Html.conformance.ts` P `1031` -> `1035` |
| `html-img-sizes-disposition` | yes | `packages/foundation/modeling/html/src/Html.conformance.ts` P `983` -> `987`; E4 `990` -> `994`; E4 `986` -> `990` |
| `r25-foundation-modeling-rest-img-lazy-auto-sizes` | no | `packages/foundation/modeling/html/src/Html.conformance.ts` P `985` -> `989` |
| `html-link-imagesizes-disposition` | yes | `packages/foundation/modeling/html/src/Html.conformance.ts` P `1029` -> `1033`; E4 `1031` -> `1035`; E4 `1040` -> `1044` |
| `r25-drivers-a-f-box-applier-destructive-blocked` | no | `packages/drivers/box-provisioning/src/BoxProvisioningApplier.ts` P `524` -> `527` |
| `r25-drivers-n-r-runpod-raw-request-authenticated-body` | no | `packages/drivers/runpod/src/Runpod.service.ts` P `134` -> `134` |
| `scheduler-admission-attempt-origin` | yes | `packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.ts` P `1571` -> `1571`; E1 `1587` -> `1587`; E2 `1750` -> `1750` |
| `scheduler-promotion-tick-origin` | yes | `packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.ts` P `1723` -> `1723`; E1 `1747` -> `1747`; E2 `1834` -> `1851` |
| `r25-cli-internal-root-residue-reap-name-brands` | no | `packages/tooling/tool/cli/src/internal/repo-run/ResidueReap.ts` P `61` -> `64` |
| `r25-cli-commands-a-c-ci-lane-run-dry-run-force` | no | `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts` P `619` -> `619` |
| `r25-cli-commands-l-q-coverage-replace-all-scoped` | no | `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts` P `251` -> `252` |
| `r25-cli-commands-l-q-github-checks-failure-policy` | no | `packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts` P `2869` -> `2873` |
| `r25-cli-commands-l-q-residue-reap-apply-json` | no | `packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts` P `3620` -> `3624` |
| `r25-cli-commands-r-z-worktree-reap-apply-json` | no | `packages/tooling/tool/cli/src/commands/Worktree/Reap.command.ts` P `102` -> `104` |
| `r25-cli-yeet-shared-options-ci-parity-no-fail-fast` | no | `packages/tooling/tool/cli/src/commands/Yeet/Yeet.command.ts` P `471` -> `472` |
| `scheduler-protocol-eviction-mode` | yes | `packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts` P `3407` -> `3411`; E2 `3417` -> `3421`; E1 `3424` -> `3428` |
| `coverage-baseline-write-mode` | yes | `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts` P `251` -> `252`; E4 `663` -> `664` |
| `yeet-prepared-publish-commit` | yes | `packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts` P `757` -> `760`; E1 `776` -> `779`; E4 `807` -> `810` |
| `citation-blank-page` | yes | `packages/law-practice/domain/test/LawPracticeDomain.test.ts` E1 `571` -> `626` |
| `corpus-pst-terminal` | yes | `packages/tooling/tool/cli/src/commands/Corpus/internal/RestorationTransformations.ts` P `1362` -> `1368`; E1 `1351` -> `1357` |
| `ci-lane-timings-render-mode` | yes | `packages/tooling/tool/cli/src/commands/Ci/LaneTimings.ts` P `2289` -> `2291`; E2 `2304` -> `2306` |
| `goals-packet-snapshot-presence` | yes | `packages/tooling/tool/cli/src/commands/Goals/Adopt.ts` E4 `172` -> `174` |
| `worktree-idle-reading` | yes | `packages/tooling/tool/cli/src/commands/Worktree/Reap.service.ts` P `88` -> `90`; E3 `211` -> `213`; E2 `363` -> `365` |
| `worktree-pr-classification` | yes | `packages/tooling/tool/cli/src/commands/Worktree/Reap.service.ts` P `81` -> `83`; E1 `159` -> `161`; E3 `336` -> `338` |
| `worktree-reap-candidate-retirement` | yes | `packages/tooling/tool/cli/src/commands/Worktree/Reap.service.ts` E4 `493` -> `495`; E1 `406` -> `408` |
| `agents-chat-turn-surface` | no | `packages/agents/client/src/Chat.atoms.ts` P `508` -> `510` |
| `jsdoc-fence-state` | yes | `packages/tooling/tool/cli/src/internal/jsdoc/JSDocSections.ts` P `41` -> `41`; E1 `45` -> `45`; E4 `84` -> `84`; E2 `86` -> `86` |
| `r26-cli-commands-a-c-validate-pst-export-acceptance-gates` | no | `packages/tooling/tool/cli/src/commands/Corpus/internal/RestorationTransformations.ts` P `1243` -> `1249` |
| `r26-cli-commands-d-k-seed-snapshot-prior-presence` | no | `packages/tooling/tool/cli/src/commands/Goals/Migration/Migration.command.ts` P `326` -> `328` |
| `r26-cli-internal-root-jsdoc-opener-gates` | no | `packages/tooling/tool/cli/src/internal/jsdoc/JSDocSections.ts` P `123` -> `123` |
| `receipt-fallback-draft-occupancy` | yes | `packages/agents/client/src/Chat.atoms.ts` P `1017` -> `1019`; E1 `1030` -> `1032`; E4 `1017` -> `1019` |
| `r26-cli-commands-l-q-coverage-replace-all-skip` | no | `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts` P `251` -> `252` |

## Verification

- Immutable objects for both SHAs resolve.
- The source-path count is 149 total: 8 excluded `apps/labs/**`, 1 excluded
  generated snapshot, and 140 included authored product-source paths.
- Every old-to-new citation below maps to an identical source line in the two
  blobs. Semantic changes were inspected separately rather than accepted from
  line mapping.
- Only this handoff file is owned or changed by this task. Run `git diff
  --check -- goals/boolean-creep/data/design-refresh-2026-09-09-main-52fcc8d-impact.md`
  after generating the citation appendix.
