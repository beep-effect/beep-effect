/**
 * Schemas for Next.js compiler and React compiler configuration.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoConfigsId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import type { NextConfig as NextConfigFromNext } from "next";

const $I = $RepoConfigsId.create("next/models/Compiler.schema");

const StringArray = S.String.pipe(S.Array, S.mutable);
const StringTuple = S.mutable(S.Tuple([S.String, S.String]));
type RunAfterProductionCompileHook = NonNullable<
  NonNullable<NextConfigFromNext["compiler"]>["runAfterProductionCompile"]
>;
type SassOptionsFromNext = NonNullable<NextConfigFromNext["sassOptions"]>;
const isRunAfterProductionCompileHook = (value: unknown): value is RunAfterProductionCompileHook => P.isFunction(value);
const isSassOptions = (value: unknown): value is SassOptionsFromNext => {
  if (!P.isObject(value)) return false;
  const implementation = value.implementation;
  return P.isUndefined(implementation) || P.isString(implementation);
};

const RunAfterProductionCompile = S.declare<RunAfterProductionCompileHook>(isRunAfterProductionCompileHook, {
  expected: "Function",
  description: "Next.js compiler hook function.",
}).pipe(
  $I.annoteSchema("RunAfterProductionCompile", {
    description: "Hook function that runs after production build compilation finishes.",
  })
);

class EmotionImportMapEntry extends S.Opaque<EmotionImportMapEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    canonicalImport: S.optionalKey(StringTuple),
    styledBaseImport: S.optionalKey(StringTuple),
  }).pipe(
    $I.annoteSchema("EmotionImportMapEntry", {
      description: "Emotion import map entry for a named compiler transform import.",
    })
  )
) {}

/**
 * **Example** (Make EmotionConfig with sourceMap)
 *
 * ```ts
 * import { EmotionConfig } from "@beep/repo-configs/next/models/Compiler.schema"
 * const config = EmotionConfig.make({ sourceMap: true })
 * console.log(config)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class EmotionConfig extends S.Opaque<EmotionConfig, { readonly brand: unique symbol }>()(
  S.Struct({
    sourceMap: S.optionalKey(S.Boolean),
    autoLabel: S.optionalKey(LiteralKit(["dev-only", "always", "never"])),
    labelFormat: S.optionalKey(S.String),
    importMap: S.optionalKey(S.Record(S.String, S.Record(S.String, EmotionImportMapEntry))),
  }).pipe(
    $I.annoteSchema("EmotionConfig", {
      description: "Emotion compiler transform configuration.",
    })
  )
) {}

/**
 * **Example** (Make StyledComponentsConfig with ssr)
 *
 * ```ts
 * import { StyledComponentsConfig } from "@beep/repo-configs/next/models/Compiler.schema"
 * const config = StyledComponentsConfig.make({ ssr: true })
 * console.log(config)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class StyledComponentsConfig extends S.Opaque<StyledComponentsConfig, { readonly brand: unique symbol }>()(
  S.Struct({
    displayName: S.optionalKey(S.Boolean),
    topLevelImportPaths: S.optionalKey(StringArray),
    ssr: S.optionalKey(S.Boolean),
    fileName: S.optionalKey(S.Boolean),
    meaninglessFileNames: S.optionalKey(StringArray),
    minify: S.optionalKey(S.Boolean),
    transpileTemplateLiterals: S.optionalKey(S.Boolean),
    namespace: S.optionalKey(S.String),
    pure: S.optionalKey(S.Boolean),
    cssProp: S.optionalKey(S.Boolean),
  }).pipe(
    $I.annoteSchema("StyledComponentsConfig", {
      description: "Styled Components compiler transform configuration.",
    })
  )
) {}

/**
 * **Example** (Make ReactCompilerOptions with infer)
 *
 * ```ts
 * import { ReactCompilerOptions } from "@beep/repo-configs/next/models/Compiler.schema"
 * const config = ReactCompilerOptions.make({ compilationMode: "infer" })
 * console.log(config)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ReactCompilerOptions extends S.Opaque<ReactCompilerOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    compilationMode: S.optionalKey(LiteralKit(["infer", "annotation", "all"])),
    panicThreshold: S.optionalKey(LiteralKit(["none", "critical_errors", "all_errors"])),
  }).pipe(
    $I.annoteSchema("ReactCompilerOptions", {
      description: "React Compiler options supported by Next.js.",
      documentation: "https://react.dev/reference/react-compiler/configuration",
    })
  )
) {}

class ReactRemovePropertiesConfig extends S.Opaque<ReactRemovePropertiesConfig, { readonly brand: unique symbol }>()(
  S.Struct({
    properties: S.optionalKey(StringArray),
  }).pipe(
    $I.annoteSchema("ReactRemovePropertiesConfig", {
      description: "Compiler transform options that remove selected React properties.",
    })
  )
) {}

class RelayConfig extends S.Opaque<RelayConfig, { readonly brand: unique symbol }>()(
  S.Struct({
    src: S.String,
    artifactDirectory: S.optionalKey(S.String),
    language: S.optionalKey(LiteralKit(["typescript", "javascript", "flow"])),
    eagerEsModules: S.optionalKey(S.Boolean),
  }).pipe(
    $I.annoteSchema("RelayConfig", {
      description: "Relay compiler transform configuration.",
    })
  )
) {}

class RemoveConsoleConfig extends S.Opaque<RemoveConsoleConfig, { readonly brand: unique symbol }>()(
  S.Struct({
    exclude: S.optionalKey(StringArray),
  }).pipe(
    $I.annoteSchema("RemoveConsoleConfig", {
      description: "Compiler transform options that remove console calls.",
    })
  )
) {}

class StyledJsxConfig extends S.Opaque<StyledJsxConfig, { readonly brand: unique symbol }>()(
  S.Struct({
    useLightningcss: S.optionalKey(S.Boolean),
  }).pipe(
    $I.annoteSchema("StyledJsxConfig", {
      description: "Styled JSX compiler options.",
    })
  )
) {}

/**
 * **Example** (Make CompilerConfig removeConsole)
 *
 * ```ts
 * import { CompilerConfig } from "@beep/repo-configs/next/models/Compiler.schema"
 * const config = CompilerConfig.make({ removeConsole: true })
 * console.log(config)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CompilerConfig extends S.Opaque<CompilerConfig, { readonly brand: unique symbol }>()(
  S.Struct({
    reactRemoveProperties: S.optionalKey(
      S.Union([S.Boolean, ReactRemovePropertiesConfig]).annotateKey({
        description: "Compiler transform that removes selected React properties.",
      })
    ),
    relay: S.optionalKey(RelayConfig.annotateKey({ description: "Relay compiler transform configuration." })),
    removeConsole: S.optionalKey(
      S.Union([S.Boolean, RemoveConsoleConfig]).annotateKey({
        description: "Compiler transform that removes console calls.",
      })
    ),
    styledComponents: S.optionalKey(S.Union([S.Boolean, StyledComponentsConfig])),
    emotion: S.optionalKey(S.Union([S.Boolean, EmotionConfig])),
    styledJsx: S.optionalKey(S.Union([S.Boolean, StyledJsxConfig])),
    define: S.optionalKey(S.Record(S.String, S.Union([S.String, S.Finite, S.Boolean]))),
    defineServer: S.optionalKey(S.Record(S.String, S.Union([S.String, S.Finite, S.Boolean]))),
    runAfterProductionCompile: S.optionalKey(RunAfterProductionCompile),
  }).pipe(
    $I.annoteSchema("CompilerConfig", {
      description: "Next.js compiler configuration block.",
    })
  )
) {}

/**
 * **Example** (Decode SassOptions with Schema)
 *
 * ```ts
 * import * as Effect from "effect/Effect";
 * import * as S from "effect/Schema"
 * import { SassOptions } from "@beep/repo-configs/next"
 * const program = S.decodeUnknownEffect(SassOptions)({ implementation: "sass" })
 * console.log(Effect.runPromise(program))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SassOptions = S.declare<SassOptionsFromNext>(isSassOptions, {
  expected: "SassOptions",
  description: "Sass options passed through to Next.js.",
}).pipe(
  $I.annoteSchema("SassOptions", {
    description: "Sass options passed through to Next.js.",
  })
);

/**
 * **Example** (Type annotate SassOptions value)
 *
 * ```ts
 * import type { SassOptions } from "@beep/repo-configs/next"
 * const options: SassOptions = { implementation: "sass" }
 * console.log(options)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SassOptions = typeof SassOptions.Type;
