/**
 * Tool-owned input contract for `schema-inventory/v1`: the module list and the catalog pin.
 *
 * **Details**
 *
 * The pin is the repo's own catalog commit (`inventoryPin`): the 40-character sha after
 * `effect@` in the root `package.json` catalog entry for `effect`. The reference clone's HEAD is
 * never consulted, and every source byte is read with `git show <pin>:<file>`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, Str } from "@beep/utils";
import { Effect, flow, pipe } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { EffectSchemaInventoryModule } from "../EffectSchemaInventory.schemas.ts";
import { EffectSchemaInventoryCatalogPinError } from "../Lint.errors.ts";
import type { EffectSchemaInventoryPin } from "../EffectSchemaInventory.schemas.ts";

/**
 * Effect import path of an upstream source file: `effect/` plus the path without
 * `packages/effect/src/`, `.ts`, and a trailing `/index`.
 *
 * **Example** (Derive barrel and nested module paths)
 *
 * ```ts
 * import { effectSchemaInventoryModuleOf } from "@beep/repo-cli/commands/Lint"
 *
 * console.log(effectSchemaInventoryModuleOf("packages/effect/src/schema/index.ts")) // "effect/schema"
 * console.log(effectSchemaInventoryModuleOf("packages/effect/src/SchemaIssue.ts")) // "effect/SchemaIssue"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const effectSchemaInventoryModuleOf: (file: string) => string = flow(
  Str.replace(/^packages\/effect\/src\//u, ""),
  Str.replace(/\.ts$/u, ""),
  Str.replace(/\/index$/u, ""),
  (path) => `effect/${path}`
);

/**
 * JSONL file stem of a module: its import path with `/` replaced by `-`.
 *
 * **Example** (Derive a file stem)
 *
 * ```ts
 * import { effectSchemaInventorySlugOf } from "@beep/repo-cli/commands/Lint"
 *
 * console.log(effectSchemaInventorySlugOf("effect/schema/Model")) // "effect-schema-Model"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const effectSchemaInventorySlugOf: (module: string) => string = Str.replaceAll("/", "-");

const moduleEntry = (file: string, importable: boolean): EffectSchemaInventoryModule => {
  const module = effectSchemaInventoryModuleOf(file);
  return EffectSchemaInventoryModule.make({ file, module, slug: effectSchemaInventorySlugOf(module), importable });
};

const publicModule = (file: string): EffectSchemaInventoryModule => moduleEntry(file, true);
const provenanceModule = (file: string): EffectSchemaInventoryModule => moduleEntry(file, false);

/**
 * The 24 inventoried upstream files in fixture order.
 *
 * **Details**
 *
 * Package-root modules come first, then `effect/schema/**`, then three provenance-only
 * internals whose path Effect's exports map nulls. Adding a barrel target here is the only way
 * a new `export * as` line can pass extraction.
 *
 * **Example** (Count the module list)
 *
 * ```ts
 * import { EffectSchemaInventoryModules } from "@beep/repo-cli/commands/Lint"
 *
 * console.log(EffectSchemaInventoryModules.length) // 24
 * console.log(EffectSchemaInventoryModules[0]?.module) // "effect/Schema"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const EffectSchemaInventoryModules: ReadonlyArray<EffectSchemaInventoryModule> = [
  publicModule("packages/effect/src/Schema.ts"),
  publicModule("packages/effect/src/SchemaAST.ts"),
  publicModule("packages/effect/src/SchemaParser.ts"),
  publicModule("packages/effect/src/SchemaIssue.ts"),
  publicModule("packages/effect/src/SchemaGetter.ts"),
  publicModule("packages/effect/src/SchemaTransformation.ts"),
  publicModule("packages/effect/src/SchemaRepresentation.ts"),
  publicModule("packages/effect/src/Arbitrary.ts"),
  publicModule("packages/effect/src/JsonSchema.ts"),
  publicModule("packages/effect/src/Equivalence.ts"),
  publicModule("packages/effect/src/StandardSchema.ts"),
  publicModule("packages/effect/src/ChannelSchema.ts"),
  publicModule("packages/effect/src/schema/index.ts"),
  publicModule("packages/effect/src/schema/Model.ts"),
  publicModule("packages/effect/src/schema/VariantSchema.ts"),
  publicModule("packages/effect/src/schema/SchemaCompiler.ts"),
  publicModule("packages/effect/src/schema/SchemaCompiler/runtime.ts"),
  publicModule("packages/effect/src/schema/SchemaJITCompiler.ts"),
  publicModule("packages/effect/src/schema/SchemaJITCompiler/enable.ts"),
  publicModule("packages/effect/src/schema/SchemaAOTCompiler.ts"),
  publicModule("packages/effect/src/schema/SchemaAOTCompiler/Build.ts"),
  provenanceModule("packages/effect/src/internal/schema/codegen.ts"),
  provenanceModule("packages/effect/src/internal/schema/compilerRegistry.ts"),
  provenanceModule("packages/effect/src/internal/schema/interpreter.ts"),
];

/**
 * Look up one inventoried module by its Effect import path.
 *
 * **Example** (Find a module and miss an unknown one)
 *
 * ```ts
 * import { findEffectSchemaInventoryModule } from "@beep/repo-cli/commands/Lint"
 * import * as O from "effect/Option"
 *
 * console.log(O.isSome(findEffectSchemaInventoryModule("effect/SchemaIssue"))) // true
 * console.log(O.isNone(findEffectSchemaInventoryModule("effect/Nope"))) // true
 * ```
 *
 * @param module - Effect import path such as `effect/SchemaIssue`.
 * @returns The module-list entry, or `O.none()` for a module outside the inventory.
 * @category utilities
 * @since 0.0.0
 */
export const findEffectSchemaInventoryModule = (module: string): O.Option<EffectSchemaInventoryModule> =>
  A.findFirst(EffectSchemaInventoryModules, (entry) => entry.module === module);

const EffectCatalog = S.Struct({ effect: S.optionalKey(S.String) });

const WorkspacesWithCatalog = S.Struct({ catalog: S.optionalKey(EffectCatalog) });
const isWorkspacesWithCatalog = S.is(WorkspacesWithCatalog);

const RootManifest = S.Struct({
  catalog: S.optionalKey(EffectCatalog),
  workspaces: S.optionalKey(S.Union([S.Array(S.String), WorkspacesWithCatalog])),
});

const decodeRootManifest = S.decodeUnknownEffect(S.fromJsonString(RootManifest));

const SNAPSHOT_PIN = /effect@([0-9a-f]{40})$/u;

const catalogEffectSpecifier = (manifest: typeof RootManifest.Type): O.Option<string> =>
  pipe(
    O.fromUndefinedOr(manifest.catalog?.effect),
    O.orElse(() =>
      pipe(
        O.fromUndefinedOr(manifest.workspaces),
        O.filter(isWorkspacesWithCatalog),
        O.flatMap((workspaces) => O.fromUndefinedOr(workspaces.catalog?.effect))
      )
    )
  );

/**
 * Read `inventoryPin` from the text of the root `package.json`.
 *
 * **Details**
 *
 * Reads the top-level `catalog.effect` entry, falling back to `workspaces.catalog.effect`. The
 * value must end in `effect@<40-character sha>`, the shape of a pkg.pr.new snapshot URL;
 * anything else fails with {@link EffectSchemaInventoryCatalogPinError} rather than guessing.
 *
 * **Example** (Parse a snapshot catalog)
 *
 * ```ts
 * import { parseEffectSchemaInventoryPin } from "@beep/repo-cli/commands/Lint"
 * import * as Effect from "effect/Effect"
 *
 * const manifest = '{"catalog":{"effect":"https://pkg.pr.new/Effect-TS/effect/effect@df77fff9396fe31de72d1947ecb5b74f8cee89e1"}}'
 * Effect.runPromise(parseEffectSchemaInventoryPin(manifest)).then(console.log) // "df77fff9396fe31de72d1947ecb5b74f8cee89e1"
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const parseEffectSchemaInventoryPin = Effect.fn("EffectSchemaInventoryModules.parsePin")(function* (
  packageJsonText: string
): Effect.fn.Return<EffectSchemaInventoryPin, EffectSchemaInventoryCatalogPinError> {
  const manifest = yield* decodeRootManifest(packageJsonText).pipe(
    Effect.mapError(() =>
      EffectSchemaInventoryCatalogPinError.new("<unreadable>", "Root package.json does not decode as a JSON manifest.")
    )
  );
  const specifier = catalogEffectSpecifier(manifest);
  return yield* Effect.fromOption(
    pipe(
      specifier,
      O.flatMap(Str.match(SNAPSHOT_PIN)),
      O.flatMap((match) => O.fromUndefinedOr(match[1]))
    ),
    () =>
      EffectSchemaInventoryCatalogPinError.new(
        O.getOrElse(specifier, () => "<missing>"),
        'Root package.json catalog "effect" is not an effect@<40-character sha> snapshot URL.'
      )
  );
});
