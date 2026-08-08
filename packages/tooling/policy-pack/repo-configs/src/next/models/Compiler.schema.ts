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

class EmotionImportMapEntry extends S.Class<EmotionImportMapEntry>($I`EmotionImportMapEntry`)(
  {
    canonicalImport: S.optionalKey(StringTuple),
    styledBaseImport: S.optionalKey(StringTuple),
  },
  $I.annote("EmotionImportMapEntry", {
    description: "Emotion import map entry for a named compiler transform import.",
  })
) {}

/**
 * Emotion compiler transform configuration.
 *
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
export class EmotionConfig extends S.Class<EmotionConfig>($I`EmotionConfig`)(
  {
    sourceMap: S.optionalKey(S.Boolean),
    autoLabel: S.optionalKey(LiteralKit(["dev-only", "always", "never"])),
    labelFormat: S.optionalKey(S.String),
    importMap: S.optionalKey(S.Record(S.String, S.Record(S.String, EmotionImportMapEntry))),
  },
  $I.annote("EmotionConfig", {
    description: "Emotion compiler transform configuration.",
  })
) {}

/**
 * Styled Components compiler transform configuration.
 *
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
export class StyledComponentsConfig extends S.Class<StyledComponentsConfig>($I`StyledComponentsConfig`)(
  {
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
  },
  $I.annote("StyledComponentsConfig", {
    description: "Styled Components compiler transform configuration.",
  })
) {}

/**
 * React Compiler options supported by Next.js.
 *
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
export class ReactCompilerOptions extends S.Class<ReactCompilerOptions>($I`ReactCompilerOptions`)(
  {
    compilationMode: S.optionalKey(LiteralKit(["infer", "annotation", "all"])),
    panicThreshold: S.optionalKey(LiteralKit(["none", "critical_errors", "all_errors"])),
  },
  $I.annote("ReactCompilerOptions", {
    description: "React Compiler options supported by Next.js.",
    documentation: "https://react.dev/reference/react-compiler/configuration",
  })
) {}

class ReactRemovePropertiesConfig extends S.Class<ReactRemovePropertiesConfig>($I`ReactRemovePropertiesConfig`)(
  {
    properties: S.optionalKey(StringArray),
  },
  $I.annote("ReactRemovePropertiesConfig", {
    description: "Compiler transform options that remove selected React properties.",
  })
) {}

class RelayConfig extends S.Class<RelayConfig>($I`RelayConfig`)(
  {
    src: S.String,
    artifactDirectory: S.optionalKey(S.String),
    language: S.optionalKey(LiteralKit(["typescript", "javascript", "flow"])),
    eagerEsModules: S.optionalKey(S.Boolean),
  },
  $I.annote("RelayConfig", {
    description: "Relay compiler transform configuration.",
  })
) {}

class RemoveConsoleConfig extends S.Class<RemoveConsoleConfig>($I`RemoveConsoleConfig`)(
  {
    exclude: S.optionalKey(StringArray),
  },
  $I.annote("RemoveConsoleConfig", {
    description: "Compiler transform options that remove console calls.",
  })
) {}

class StyledJsxConfig extends S.Class<StyledJsxConfig>($I`StyledJsxConfig`)(
  {
    useLightningcss: S.optionalKey(S.Boolean),
  },
  $I.annote("StyledJsxConfig", {
    description: "Styled JSX compiler options.",
  })
) {}

/**
 * Next.js compiler configuration block.
 *
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
export class CompilerConfig extends S.Class<CompilerConfig>($I`CompilerConfig`)(
  {
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
  },
  $I.annote("CompilerConfig", {
    description: "Next.js compiler configuration block.",
  })
) {}

/**
 * Sass options passed through to Next.js.
 *
 * **Example** (Decode SassOptions with Schema)
 *
 * ```ts
 * import { Effect } from "effect"
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
 * Sass options passed through to Next.js.
 *
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
