/**
 * The portable-tsconfig filter — projects a `ResolvedTsconfig` or a
 * bare `CompilerOptions.Type` down to the small, machine-independent
 * slice of compilerOptions that a virtual TypeScript environment (Twoslash,
 * API Extractor, an in-memory language service) can safely reuse: no absolute
 * paths, no emit artifacts, no file-selection surface.
 *
 * **Details**
 *
 * This module is already string-level (CompilerOptions decodes TS's numeric
 * enums to canonical lowercase strings — see CompilerOptions.ts and
 * TsEnumCodec.ts), the
 * filter here is exactly three things: a key allow-list, two forced flags,
 * and a `$schema` stamp. No enum conversion is needed or performed.
 *
 * ALLOW-LIST, NOT DENY-LIST: only the keys named below
 * ever reach the output. An option this package does not yet know about —
 * including every unknown/future passthrough key `CompilerOptions.Type`
 * preserves for forward tolerance — is silently dropped here. A portable
 * config is deliberately a strict subset of "everything the source config
 * said"; growing it is an explicit, reviewed addition to the allow-list
 * below, never an accident of "we didn't exclude it."
 *
 * The allow-list has two tiers. The unconditional one below is safe for every
 * consumer. The second is a single opt-in key, `types`, which is portable but
 * resolution-dependent — see OPT_IN_TYPES_OPTION for why that distinction
 * exists and why it does not default on. (Virtual TypeScript environments lost
 * their Node globals when `types` was left unclassified.)
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $TsconfigId } from "@beep/identity/packages";
import * as O from "@beep/utils/Option";
import * as A from "effect/Array";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as SchemaParser from "effect/SchemaParser";
import * as Struct from "effect/Struct";
import { CompilerOptions } from "./CompilerOptions.ts";
import type { ResolvedTsconfig } from "./ResolvedTsconfig.ts";

const $I = $TsconfigId.create("PortableTsconfig");

const TSCONFIG_SCHEMA_URL = "https://json.schemastore.org/tsconfig";

// decision: portable-allow-list-criterion
const PRESERVED_BOOLEAN_OPTIONS = [
  "strict",
  "noImplicitAny",
  "strictNullChecks",
  "strictFunctionTypes",
  "strictBindCallApply",
  "strictPropertyInitialization",
  "strictBuiltinIteratorReturn",
  "noImplicitThis",
  "useUnknownInCatchVariables",
  "alwaysStrict",
  "noUnusedLocals",
  "noUnusedParameters",
  "exactOptionalPropertyTypes",
  "noImplicitReturns",
  "noFallthroughCasesInSwitch",
  "noUncheckedIndexedAccess",
  "noImplicitOverride",
  "noPropertyAccessFromIndexSignature",
  "allowUnusedLabels",
  "allowUnreachableCode",
  "noUncheckedSideEffectImports",
  "allowJs",
  "checkJs",
  "resolveJsonModule",
  "allowArbitraryExtensions",
  "allowImportingTsExtensions",
  "rewriteRelativeImportExtensions",
  "resolvePackageJsonExports",
  "resolvePackageJsonImports",
  "allowSyntheticDefaultImports",
  "esModuleInterop",
  "preserveSymlinks",
  "allowUmdGlobalAccess",
  "verbatimModuleSyntax",
  "isolatedModules",
  "isolatedDeclarations",
  "erasableSyntaxOnly",
  "forceConsistentCasingInFileNames",
  "useDefineForClassFields",
  "noLib",
  "skipDefaultLibCheck",
  "skipLibCheck",
  "noCheck",
  "experimentalDecorators",
  "emitDecoratorMetadata",
  "importHelpers",
  "downlevelIteration",
  "preserveConstEnums",
] as const;

const PRESERVED_ENUM_OPTIONS = [
  "target",
  "module",
  "moduleResolution",
  "jsx",
  "moduleDetection",
  "lib",
  "ignoreDeprecations",
] as const;

const PRESERVED_STRING_OPTIONS = ["jsxFactory", "jsxFragmentFactory", "jsxImportSource", "reactNamespace"] as const;

const PRESERVED_OPTIONS = [
  ...PRESERVED_BOOLEAN_OPTIONS,
  ...PRESERVED_ENUM_OPTIONS,
  ...PRESERVED_STRING_OPTIONS,
] as const;

type PreservedCompilerOptions = Pick<CompilerOptions.Type, (typeof PRESERVED_OPTIONS)[number]>;

// decision: portable-types-opt-in
const OPT_IN_TYPES_OPTION = "types";

const isResolvedTsconfig = (input: ResolvedTsconfig | CompilerOptions.Type): input is ResolvedTsconfig =>
  P.isString(input.configPath) && A.isArray(input.extendedPaths) && P.isObjectOrArray(input.compilerOptions);

const PortableCompilerOptions = S.Struct({
  ...Struct.pick(CompilerOptions.schema.fields, PRESERVED_OPTIONS),
  types: CompilerOptions.schema.fields.types,
  noEmit: S.tag(true).pipe(
    $I.annoteKey("PortableCompilerOptions.noEmit", {
      description: "Portable environments control emission externally.",
    })
  ),
  composite: S.tag(false).pipe(
    $I.annoteKey("PortableCompilerOptions.composite", {
      description: "Portable configs do not orchestrate project-reference builds.",
    })
  ),
}).pipe(
  $I.annoteSchema("PortableCompilerOptions", {
    description:
      "Only portable compiler options, with optional type packages and required non-emitting, non-composite flags.",
  })
);

/**
 * A portable, JSON-serializable tsconfig.json (compilerOptions-only), for
 * virtual TypeScript environments that control their own file paths and emit
 * settings externally. Carries only knowably-portable options: no absolute or
 * machine-specific paths, and no emit or file-selection surface.
 *
 * @public
 */
const PortableTsconfigData = S.Struct({
  $schema: S.tag(TSCONFIG_SCHEMA_URL).pipe(
    $I.annoteKey("PortableTsconfigData.$schema", {
      description: "The tsconfig JSON Schema URL, stamped for IDE support.",
    })
  ),
  compilerOptions: PortableCompilerOptions.pipe(
    $I.annoteKey("PortableTsconfigData.compilerOptions", {
      description: "Allow-listed options with forced portable flags.",
    })
  ),
}).pipe(
  $I.annoteSchema("PortableTsconfig", {
    description: "A portable compiler-options-only tsconfig for virtual TypeScript environments.",
  })
);

/**
 * **Example** (Enable resolution-dependent type packages)
 *
 * ```ts
 * import { PortableTsconfigOptions } from "@beep/tsconfig/PortableTsconfig";
 * import * as S from "effect/Schema";
 *
 * console.log(S.decodeUnknownSync(PortableTsconfigOptions)({ includeTypes: true }).includeTypes) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class PortableTsconfigOptions extends S.Opaque<PortableTsconfigOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    /**
     * Carry `types` (an array of `@types` package NAMES) onto the portable
     * shape when the source declares it. Defaults to `false`.
     *
     * **Details**
     *
     * Opt in when the consuming environment can resolve those packages — it
     * materializes `@types` into its virtual filesystem, or type-checks against
     * a real `node_modules`. Leaving it off keeps the permissive default, where
     * TypeScript auto-includes whatever `@types` the environment happens to
     * have and never errors on a missing one.
     *
     * `typeRoots` is NOT carried under this flag: it names filesystem
     * directories, which are machine-specific and config-location-dependent,
     * so they are never portable.
     */
    includeTypes: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("PortableTsconfigOptions.includeTypes", {
        description: "Carry types package names when the consumer can resolve them; defaults to false.",
      })
    ),
  }).pipe(
    $I.annoteSchema("PortableTsconfigOptions", {
      description: "Opt-ins for resolution-dependent portable compiler options.",
    })
  )
) {}

/**
 * @public
 * @category type-level
 * @since 0.0.0
 */
export declare namespace PortableTsconfigOptions {
  /**
   * The unbranded option record accepted by {@link (PortableTsconfig:class).make}.
   *
   * @public
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof PortableTsconfigOptions.Encoded;
}

const projectBehindMake = (
  input: ResolvedTsconfig | CompilerOptions.Type,
  options?: PortableTsconfigOptions.Encoded
): typeof PortableTsconfigData.Type => {
  const source = isResolvedTsconfig(input) ? input.compilerOptions : input;
  const compilerOptions: { -readonly [Key in keyof PreservedCompilerOptions]: PreservedCompilerOptions[Key] } = {};
  const copyOption = <Key extends (typeof PRESERVED_OPTIONS)[number]>(key: Key): void => {
    const value = source[key];
    if (value !== undefined) compilerOptions[key] = value;
  };
  for (const key of PRESERVED_OPTIONS) copyOption(key);
  const types = options?.includeTypes === true ? source[OPT_IN_TYPES_OPTION] : undefined;
  return {
    $schema: TSCONFIG_SCHEMA_URL,
    compilerOptions: {
      ...compilerOptions,
      ...O.getSomesStruct({ types: O.fromUndefinedOr(types) }),
      composite: false,
      noEmit: true,
    },
  };
};

/**
 * The portable-tsconfig filter: {@link (PortableTsconfig:class).make}
 * narrows a resolved or bare compiler-options object to the allow-listed,
 * machine-independent subset described on {@link (PortableTsconfig:interface)}.
 *
 * **Example** (Keep checking options in a portable config)
 *
 * ```ts
 * import { PortableTsconfig } from "@beep/tsconfig/PortableTsconfig";
 *
 * const portable = PortableTsconfig.make({ strict: true, outDir: "/project/dist" });
 * console.log(portable.compilerOptions.strict) // true
 * console.log("outDir" in portable.compilerOptions) // false
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class PortableTsconfig extends S.Opaque<PortableTsconfig, { readonly brand: unique symbol }>()(
  PortableTsconfigData
) {
  /**
   * Project a {@link (ResolvedTsconfig:interface)} or a bare
   * `CompilerOptions.Type` down to a {@link (PortableTsconfig:interface)}:
   * copy only the allow-listed type-semantics options, force
   * `composite: false` and `noEmit: true` regardless of what the source
   * declared, and stamp `$schema`. Every other key — including every
   * unknown passthrough key the source preserved for forward tolerance —
   * is dropped; this is an allow-list, not a deny-list, so an option this
   * package does not yet classify never leaks onto the portable shape by
   * accident.
   *
   * **Details**
   *
   * `types` is the one deliberate exception, and it is opt-in rather than
   * unclassified: it is portable (package names, not paths) but carrying it
   * makes TypeScript demand those packages be resolvable, which a virtual
   * environment with no `node_modules` cannot satisfy. Pass
   * {@link PortableTsconfigOptions.includeTypes} when the consumer
   * materializes `@types`; leave it off for the permissive default. Related
   * `typeRoots` is never carried — machine-specific,
   * config-location-dependent directories.
   *
   * **Example** (Carry type packages while forcing portable flags)
   *
   * ```ts
   * import { PortableTsconfig } from "@beep/tsconfig/PortableTsconfig";
   *
   * const portable = PortableTsconfig.make(
   *   { types: ["node"], typeRoots: ["/project/types"], composite: true },
   *   { includeTypes: true },
   * );
   * console.log(portable.compilerOptions.composite) // false
   * console.log(portable.compilerOptions.noEmit) // true
   * console.log("typeRoots" in portable.compilerOptions) // false
   * console.log(JSON.stringify(portable.compilerOptions.types)) // ["node"]
   * ```
   *
   * @param input - The resolved config, or a bare compiler-options bag.
   * @param options - Opt-ins for options that are portable but
   * resolution-dependent. Omitted means the strict, always-safe subset.
   * @category constructors
   * @since 0.0.0
   */
  static override readonly make = (
    input: ResolvedTsconfig | CompilerOptions.Type,
    options?: PortableTsconfigOptions.Encoded & S.MakeOptions
  ): PortableTsconfig => inheritedSchemaMakeValidatingProjection(projectBehindMake(input, options), options);
}

const inheritedSchemaMakeValidatingProjection = SchemaParser.make(PortableTsconfig);
