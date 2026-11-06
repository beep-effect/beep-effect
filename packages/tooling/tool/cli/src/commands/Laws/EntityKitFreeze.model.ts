/**
 * Schemas and data for the entity kit freeze law.
 *
 * **Details**
 *
 * Decision D3 of `explorations/alchemy-domain-adoption/DECISIONS.md` freezes
 * the hand-rolled entity kit in `packages/shared/domain/src/entity/`: new work
 * may not import it, and it is deleted with its last consumer. The frozen
 * module specifiers, the barrel bindings and the committed baseline shape live
 * here as data so the scanner in `EntityKitFreeze.ts` stays a pure function of
 * them. `Principal`, `SourceKind`, `PublicEntityId`, `EntityId` and
 * `EntityRef` survive as value schemas and are not frozen.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { ArrayKeyDefaultEmpty } from "@beep/schema/SchemaUtils/withKeyDefaults";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Laws/EntityKitFreeze.model");

/**
 * Rule that produced an entity kit freeze finding.
 *
 * **Details**
 *
 * `new-importer` is a scanned file that imports a frozen specifier and is not
 * in the baseline. `stale-baseline` is a baseline file that no longer imports
 * one; `--write` prunes it, so the baseline only ratchets down.
 *
 * **Example** (Identify a new-importer finding)
 *
 * ```ts
 * import { EntityKitFreezeRule } from "@beep/repo-cli/commands/Laws/EntityKitFreeze.model"
 *
 * console.log(EntityKitFreezeRule.is["new-importer"]("new-importer")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const EntityKitFreezeRule = LiteralKit(["new-importer", "stale-baseline"]).pipe(
  $I.annoteSchema("EntityKitFreezeRule", {
    description: "Rule that produced an entity kit freeze finding.",
  })
);

/**
 * Type-level member of {@link EntityKitFreezeRule}.
 *
 * @category models
 * @since 0.0.0
 */
export type EntityKitFreezeRule = typeof EntityKitFreezeRule.Type;

/**
 * Rule identifier recorded in the committed baseline.
 *
 * **Example** (Read the baseline rule id)
 *
 * ```ts
 * import { ENTITY_KIT_FREEZE_RULE_ID } from "@beep/repo-cli/commands/Laws/EntityKitFreeze.model"
 *
 * console.log(ENTITY_KIT_FREEZE_RULE_ID) // "beep-laws/entity-kit-freeze"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ENTITY_KIT_FREEZE_RULE_ID = "beep-laws/entity-kit-freeze";

/**
 * Date the entity kit was frozen, recorded when the baseline is first seeded.
 *
 * **Example** (Read the freeze date)
 *
 * ```ts
 * import { ENTITY_KIT_FROZEN_SINCE } from "@beep/repo-cli/commands/Laws/EntityKitFreeze.model"
 *
 * console.log(ENTITY_KIT_FROZEN_SINCE) // "2026-11-06"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ENTITY_KIT_FROZEN_SINCE = "2026-11-06";

/**
 * Repository-relative path of the committed baseline.
 *
 * **Example** (Read the baseline path)
 *
 * ```ts
 * import { ENTITY_KIT_FREEZE_BASELINE_PATH } from "@beep/repo-cli/commands/Laws/EntityKitFreeze.model"
 *
 * console.log(ENTITY_KIT_FREEZE_BASELINE_PATH) // "standards/entity-kit-freeze.baseline.jsonc"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ENTITY_KIT_FREEZE_BASELINE_PATH = "standards/entity-kit-freeze.baseline.jsonc";

/**
 * Module specifiers of the frozen entity kit.
 *
 * **Details**
 *
 * Only these exact specifiers are frozen: the `entity` barrel and the kit's
 * own modules. The surviving value-schema subpaths (`entity/Principal`,
 * `entity/SourceKind`, `entity/PublicEntityId`, `entity/EntityId`,
 * `entity/EntityRef`) are not listed.
 *
 * **Example** (Count the frozen specifiers)
 *
 * ```ts
 * import { entityKitFrozenSpecifiers } from "@beep/repo-cli/commands/Laws/EntityKitFreeze.model"
 *
 * console.log(entityKitFrozenSpecifiers.length) // 7
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const entityKitFrozenSpecifiers: ReadonlyArray<string> = [
  "@beep/shared-domain/entity",
  "@beep/shared-domain/entity/EntityKit",
  "@beep/shared-domain/entity/BaseEntity",
  "@beep/shared-domain/entity/AuditEntity",
  "@beep/shared-domain/entity/OrgEntity",
  "@beep/shared-domain/entity/ProductEntity",
  "@beep/shared-domain/entity/primitives",
];

/**
 * Package barrel whose kit bindings are frozen.
 *
 * **Example** (Read the barrel specifier)
 *
 * ```ts
 * import { entityKitFreezeBarrelSpecifier } from "@beep/repo-cli/commands/Laws/EntityKitFreeze.model"
 *
 * console.log(entityKitFreezeBarrelSpecifier) // "@beep/shared-domain"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const entityKitFreezeBarrelSpecifier = "@beep/shared-domain";

/**
 * Named bindings of {@link entityKitFreezeBarrelSpecifier} that reach the frozen kit.
 *
 * **Example** (Check a barrel binding)
 *
 * ```ts
 * import { entityKitFrozenBarrelBindings } from "@beep/repo-cli/commands/Laws/EntityKitFreeze.model"
 *
 * console.log(entityKitFrozenBarrelBindings.includes("ProductEntity")) // true
 * console.log(entityKitFrozenBarrelBindings.includes("Principal")) // false
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const entityKitFrozenBarrelBindings: ReadonlyArray<string> = [
  "ProductEntity",
  "EntityKit",
  "BaseEntity",
  "AuditEntity",
  "OrgEntity",
];

/**
 * Files the law never scans: the law's own model, scanner and tests spell the frozen specifiers as data.
 *
 * **Example** (Check an exempt file)
 *
 * ```ts
 * import { entityKitFreezeExemptPaths } from "@beep/repo-cli/commands/Laws/EntityKitFreeze.model"
 *
 * console.log(entityKitFreezeExemptPaths.length) // 4
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const entityKitFreezeExemptPaths: ReadonlyArray<string> = [
  "packages/tooling/tool/cli/src/commands/Laws/EntityKitFreeze.model.ts",
  "packages/tooling/tool/cli/src/commands/Laws/EntityKitFreeze.ts",
  "packages/tooling/tool/cli/test/laws-entity-kit-freeze.test.ts",
  "packages/tooling/tool/cli/test/laws-entity-kit-freeze-command.test.ts",
];

/**
 * One import of the frozen entity kit found in a source file.
 *
 * **Details**
 *
 * `match` is the frozen specifier, or `<barrel> { <binding> }` for a frozen
 * named binding of the package barrel. Lines and columns are 1-based and point
 * at the `import` or `export` keyword.
 *
 * **Example** (Construct an import)
 *
 * ```ts
 * import { EntityKitImport } from "@beep/repo-cli/commands/Laws/EntityKitFreeze.model"
 *
 * const found = EntityKitImport.make({ line: 3, column: 1, match: "@beep/shared-domain/entity/EntityKit" })
 *
 * console.log(found.match) // "@beep/shared-domain/entity/EntityKit"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EntityKitImport extends S.Opaque<EntityKitImport, { readonly brand: unique symbol }>()(
  S.Struct({
    line: S.Int,
    column: S.Int,
    match: S.String,
  }).pipe(
    $I.annoteSchema("EntityKitImport", {
      description:
        "One import of the frozen entity kit, with its 1-based position and the frozen specifier or binding.",
    })
  )
) {}

/**
 * The frozen-kit imports of one scanned file.
 *
 * **Example** (Construct a file's imports)
 *
 * ```ts
 * import { EntityKitImport, EntityKitImporter } from "@beep/repo-cli/commands/Laws/EntityKitFreeze.model"
 *
 * const importer = EntityKitImporter.make({
 *   file: "packages/demo/src/Thing.ts",
 *   imports: [EntityKitImport.make({ line: 1, column: 1, match: "@beep/shared-domain/entity" })],
 * })
 *
 * console.log(importer.imports.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EntityKitImporter extends S.Opaque<EntityKitImporter, { readonly brand: unique symbol }>()(
  S.Struct({
    file: S.String,
    imports: S.Array(EntityKitImport),
  }).pipe(
    $I.annoteSchema("EntityKitImporter", {
      description: "The frozen entity kit imports of one scanned repository file.",
    })
  )
) {}

/**
 * One entity kit freeze finding.
 *
 * **Example** (Construct a stale-baseline finding)
 *
 * ```ts
 * import { EntityKitFreezeFinding } from "@beep/repo-cli/commands/Laws/EntityKitFreeze.model"
 *
 * const finding = EntityKitFreezeFinding.make({ file: "packages/demo/src/Old.ts", rule: "stale-baseline" })
 *
 * console.log(finding.imports.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EntityKitFreezeFinding extends S.Opaque<EntityKitFreezeFinding, { readonly brand: unique symbol }>()(
  S.Struct({
    file: S.String,
    rule: EntityKitFreezeRule,
    imports: ArrayKeyDefaultEmpty(EntityKitImport),
  }).pipe(
    $I.annoteSchema("EntityKitFreezeFinding", {
      description: "A new importer of the frozen entity kit, or a baseline file that no longer imports it.",
    })
  )
) {}

/**
 * The committed baseline of files allowed to keep importing the frozen kit.
 *
 * **Example** (Construct a baseline)
 *
 * ```ts
 * import { EntityKitFreezeBaseline } from "@beep/repo-cli/commands/Laws/EntityKitFreeze.model"
 *
 * const baseline = EntityKitFreezeBaseline.make({
 *   version: 1,
 *   rule: "beep-laws/entity-kit-freeze",
 *   frozenSince: "2026-11-06",
 *   files: ["packages/demo/src/Thing.ts"],
 * })
 *
 * console.log(baseline.files.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EntityKitFreezeBaseline extends S.Opaque<EntityKitFreezeBaseline, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.Literal(1),
    rule: S.Literal(ENTITY_KIT_FREEZE_RULE_ID),
    frozenSince: S.String,
    files: S.Array(S.String),
  }).pipe(
    $I.annoteSchema("EntityKitFreezeBaseline", {
      description: "Sorted repository-relative files allowed to keep importing the frozen entity kit.",
    })
  )
) {}

/**
 * Runtime options for the entity kit freeze law.
 *
 * **Example** (Configure a strict scan)
 *
 * ```ts
 * import { EntityKitFreezeOptions } from "@beep/repo-cli/commands/Laws/EntityKitFreeze.model"
 *
 * const options = EntityKitFreezeOptions.make({ cwd: process.cwd(), strictCheck: true })
 *
 * console.log(options.write) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EntityKitFreezeOptions extends S.Opaque<EntityKitFreezeOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    cwd: S.String,
    strictCheck: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefaultKey(Effect.succeed(false))
    ),
    write: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefaultKey(Effect.succeed(false))
    ),
  }).pipe(
    $I.annoteSchema("EntityKitFreezeOptions", {
      description: "Runtime options for the entity kit freeze law.",
    })
  )
) {}

/**
 * Result of one entity kit freeze law run.
 *
 * **Example** (Construct a clean summary)
 *
 * ```ts
 * import { EntityKitFreezeSummary } from "@beep/repo-cli/commands/Laws/EntityKitFreeze.model"
 *
 * const summary = EntityKitFreezeSummary.make({
 *   scannedFiles: 10,
 *   skippedBinaryFiles: 0,
 *   outOfScopeFiles: 4,
 *   importerFiles: 2,
 *   baselineFiles: 2,
 *   prunedFiles: 0,
 *   wroteBaseline: false,
 *   strictFailure: false,
 * })
 *
 * console.log(summary.findings.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EntityKitFreezeSummary extends S.Opaque<EntityKitFreezeSummary, { readonly brand: unique symbol }>()(
  S.Struct({
    scannedFiles: S.Int,
    skippedBinaryFiles: S.Int,
    outOfScopeFiles: S.Int,
    importerFiles: S.Int,
    baselineFiles: S.Int,
    prunedFiles: S.Int,
    wroteBaseline: S.Boolean,
    strictFailure: S.Boolean,
    findings: ArrayKeyDefaultEmpty(EntityKitFreezeFinding),
  }).pipe(
    $I.annoteSchema("EntityKitFreezeSummary", {
      description: "Result of one entity kit freeze law run over the git-tracked package and app sources.",
    })
  )
) {}
