/**
 * Type-safe tsconfig.json schemas using Effect v4 Schema.
 *
 * The exported `TSConfig` schema models the TypeScript configuration surface we
 * intentionally support from SchemaStore, including JSONC-aware decode helpers
 * for comments and trailing commas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoUtilsId } from "@beep/identity/packages";
import { JsoncTextToUnknown } from "@beep/schema/Jsonc";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import * as A from "@beep/utils/Array";
import * as Eq from "@beep/utils/Equal";
import * as O from "@beep/utils/Option";
import * as P from "@beep/utils/Predicate";
import * as R from "@beep/utils/Record";
import * as Str from "@beep/utils/Str";
import * as Struct from "@beep/utils/Struct";
import { thunkFalse, thunkTrue } from "@beep/utils/thunk";
import { Cause, Effect, Exit, Result, SchemaGetter, SchemaIssue } from "effect";
import { dual, identity, pipe } from "effect/Function";
import * as S from "effect/Schema";
import * as Model from "effect/unstable/schema/Model";
import { jsonStringifyPretty } from "../JsonUtils.ts";
import type { DomainError } from "../errors/index.ts";

const $I = $RepoUtilsId.create("schemas/TSConfig");

const strictDecodeOptions = { onExcessProperty: "error" as const };

const MODULE_VALUES = [
  "commonjs",
  "amd",
  "system",
  "umd",
  "es6",
  "es2015",
  "es2020",
  "esnext",
  "none",
  "es2022",
  "node16",
  "node18",
  "node20",
  "nodenext",
  "preserve",
] as const;

const MODULE_RESOLUTION_VALUES = ["classic", "node", "node10", "node16", "nodenext", "bundler"] as const;

const TARGET_VALUES = [
  "es3",
  "es5",
  "es6",
  "es2015",
  "es2016",
  "es2017",
  "es2018",
  "es2019",
  "es2020",
  "es2021",
  "es2022",
  "es2023",
  "es2024",
  "es2025",
  "esnext",
] as const;

const LIB_VALUES = [
  "ES5",
  "ES6",
  "ES2015",
  "ES2015.Collection",
  "ES2015.Core",
  "ES2015.Generator",
  "ES2015.Iterable",
  "ES2015.Promise",
  "ES2015.Proxy",
  "ES2015.Reflect",
  "ES2015.Symbol.WellKnown",
  "ES2015.Symbol",
  "ES2016",
  "ES2016.Array.Include",
  "ES2016.Intl",
  "ES2017",
  "ES2017.Intl",
  "ES2017.Object",
  "ES2017.SharedMemory",
  "ES2017.String",
  "ES2017.TypedArrays",
  "ES2017.ArrayBuffer",
  "ES2018",
  "ES2018.AsyncGenerator",
  "ES2018.AsyncIterable",
  "ES2018.Intl",
  "ES2018.Promise",
  "ES2018.Regexp",
  "ES2019",
  "ES2019.Array",
  "ES2019.Intl",
  "ES2019.Object",
  "ES2019.String",
  "ES2019.Symbol",
  "ES2020",
  "ES2020.BigInt",
  "ES2020.Promise",
  "ES2020.String",
  "ES2020.Symbol.WellKnown",
  "ESNext",
  "ESNext.Array",
  "ESNext.AsyncIterable",
  "ESNext.BigInt",
  "ESNext.Collection",
  "ESNext.Intl",
  "ESNext.Iterator",
  "ESNext.Object",
  "ESNext.Promise",
  "ESNext.Regexp",
  "ESNext.String",
  "ESNext.Symbol",
  "DOM",
  "DOM.AsyncIterable",
  "DOM.Iterable",
  "ScriptHost",
  "WebWorker",
  "WebWorker.AsyncIterable",
  "WebWorker.ImportScripts",
  "Webworker.Iterable",
  "ES7",
  "ES2021",
  "ES2020.SharedMemory",
  "ES2020.Intl",
  "ES2020.Date",
  "ES2020.Number",
  "ES2021.Promise",
  "ES2021.String",
  "ES2021.WeakRef",
  "ESNext.WeakRef",
  "ES2021.Intl",
  "ES2022",
  "ES2022.Array",
  "ES2022.Error",
  "ES2022.Intl",
  "ES2022.Object",
  "ES2022.String",
  "ES2022.SharedMemory",
  "ES2022.RegExp",
  "ES2023",
  "ES2023.Array",
  "ES2023.Intl",
  "ES2024",
  "ES2024.ArrayBuffer",
  "ES2024.Collection",
  "ES2024.Object",
  "ES2024.Promise",
  "ES2024.Regexp",
  "ES2024.SharedMemory",
  "ES2024.String",
  "ES2025",
  "ES2025.Collection",
  "ES2025.Float16",
  "ES2025.Intl",
  "ES2025.Iterator",
  "ES2025.Promise",
  "ES2025.RegExp",
  "Decorators",
  "Decorators.Legacy",
  "ES2017.Date",
  "ES2023.Collection",
  "ESNext.Decorators",
  "ESNext.Date",
  "ESNext.Disposable",
  "ESNext.Error",
  "ESNext.Float16",
  "ESNext.Sharedmemory",
  "ESNext.Temporal",
  "ESNext.TypedArrays",
] as const;

const JSX_VALUES = ["preserve", "react", "react-jsx", "react-jsxdev", "react-native"] as const;

const NEW_LINE_VALUES = ["crlf", "lf"] as const;

const FALLBACK_POLLING_VALUES = [
  "fixedPollingInterval",
  "priorityPollingInterval",
  "dynamicPriorityPolling",
  "fixedInterval",
  "priorityInterval",
  "dynamicPriority",
  "fixedChunkSize",
] as const;

const WATCH_DIRECTORY_VALUES = [
  "useFsEvents",
  "fixedPollingInterval",
  "dynamicPriorityPolling",
  "fixedChunkSizePolling",
] as const;

const WATCH_FILE_VALUES = [
  "fixedPollingInterval",
  "priorityPollingInterval",
  "dynamicPriorityPolling",
  "useFsEvents",
  "useFsEventsOnParentDirectory",
  "fixedChunkSizePolling",
] as const;

const MODULE_DETECTION_VALUES = ["auto", "legacy", "force"] as const;

const IMPORTS_NOT_USED_AS_VALUES = ["remove", "preserve", "error"] as const;

const TS_NODE_EXPERIMENTAL_SPECIFIER_RESOLUTION_VALUES = ["explicit", "node"] as const;

const TS_NODE_MODULE_TYPE_VALUES = ["cjs", "esm", "package"] as const;

// `__proto__` cannot exist as an own data property after effect's record
// rebuilds (plain assignment sets the prototype instead), so admitting it on
// the wire both breaks round-tripping and invites prototype pollution.
const TSConfigJsonKey = S.String.check(
  S.makeFilter((key: string) => key !== "__proto__", {
    identifier: $I.make("TSConfigJsonKeyCheck"),
    title: "TSConfig JSON Key",
    description: 'A tsconfig JSON object key; the prototype-polluting "__proto__" is rejected.',
    message: 'Key must not be "__proto__".',
  })
);

const JsonRecord = S.Record(TSConfigJsonKey, S.Json).pipe(
  SchemaUtils.withCodecStatics(["decodeUnknownEffect"]),
  SchemaUtils.withStatics((schema) => ({
    empty: schema.make({}),
  })),
  $I.annoteSchema("TSConfigJsonRecord", {
    description: "A JSON object used for open tsconfig extension points such as plugin extras and ts-node overrides.",
  })
);

// StructWithRest applies its record schema to fixed keys too. Keep the
// transform's structural target permissive; decodeRest still validates every
// actual extension key as JSON in both directions. Preserve JSON-only
// arbitrary generation so schema-derived values remain encodable.
const LooseJsonValue = S.Unknown.annotate({
  toArbitrary: () => (fc) => fc.jsonValue(),
});
const LooseRecord = S.Record(TSConfigJsonKey, LooseJsonValue);

interface ToTypeSchemaField extends Struct.Lambda {
  readonly "~lambda.out": this["~lambda.in"] extends S.Top ? S.toType<this["~lambda.in"]> : never;
  <Schema extends S.Top>(schema: Schema): S.toType<Schema>;
}

interface ToEncodedSchemaField extends Struct.Lambda {
  readonly "~lambda.out": this["~lambda.in"] extends S.Top ? S.toEncoded<this["~lambda.in"]> : never;
  <Schema extends S.Top>(schema: Schema): S.toEncoded<Schema>;
}

const toTypeSchemaField = Struct.lambda<ToTypeSchemaField>(S.toType);
const toEncodedSchemaField = Struct.lambda<ToEncodedSchemaField>(S.toEncoded);

const isLooseJsonRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  P.isObject(value) ? !A.isArray(value) : false;

const makeTypeStruct = <Fields extends S.Struct.Fields>(fields: Fields) =>
  S.Struct(Struct.map(fields, toTypeSchemaField));

const makeEncodedStruct = <Fields extends S.Struct.Fields>(fields: Fields) =>
  S.Struct(Struct.map(fields, toEncodedSchemaField));

const emptyJsonRecord: Readonly<Record<string, S.Json>> = {};

const mergeLooseJsonObject: {
  <Value extends object>(
    rest: Readonly<Record<string, S.Json>>,
    value: Value
  ): Readonly<Record<string, S.Json>> & Value;
  <Value extends object>(
    value: Value
  ): (rest: Readonly<Record<string, S.Json>>) => Readonly<Record<string, S.Json>> & Value;
} = dual(
  2,
  <Value extends object>(
    rest: Readonly<Record<string, S.Json>>,
    value: Value
  ): Readonly<Record<string, S.Json>> & Value => ({ ...rest, ...value })
);

const makeLooseJsonObject = <Fields extends S.Struct.Fields>(fields: Fields, name: string, description: string) => {
  const strict = S.Struct(fields);
  const knownKeys = R.keys(fields);
  const decoded = S.make<
    S.Codec<
      Readonly<Record<string, S.Json>> & typeof strict.Type,
      Readonly<Record<string, S.Json>> & typeof strict.Type
    >
  >(S.StructWithRest(makeTypeStruct(fields), [LooseRecord]).ast);
  const encoded = S.make<
    S.Codec<
      Readonly<Record<string, S.Json>> & S.Codec.Encoded<typeof strict>,
      Readonly<Record<string, S.Json>> & S.Codec.Encoded<typeof strict>
    >
  >(S.StructWithRest(makeEncodedStruct(fields), [LooseRecord]).ast);
  const decodeStrict = S.decodeUnknownEffect(strict);
  const encodeStrict = S.encodeEffect(strict);

  const pickKnownKeys = <Value extends Readonly<Record<string, unknown>>>(value: Value) =>
    R.filter(value, (_value, key) => A.contains(knownKeys, key));
  const pickUnknownKeys = <Value extends Readonly<Record<string, unknown>>>(value: Value) =>
    R.filter(value, (_value, key) => !A.contains(knownKeys, key));

  return encoded.pipe(
    S.decodeTo(decoded, {
      decode: SchemaGetter.transformOrFail((input, options) =>
        isLooseJsonRecord(input)
          ? Effect.zipWith(
              decodeStrict(pickKnownKeys(input), options).pipe(Effect.mapError((error) => error.issue)),
              JsonRecord.decodeUnknownEffect(pickUnknownKeys(input), options).pipe(
                Effect.mapError((error) => error.issue)
              ),
              (decodedValue, decodedRest) => mergeLooseJsonObject(decodedRest, decodedValue)
            )
          : decodeStrict(input, options).pipe(
              Effect.mapError((error) => error.issue),
              Effect.map((decodedValue) => mergeLooseJsonObject(emptyJsonRecord, decodedValue))
            )
      ),
      encode: SchemaGetter.transformOrFail((input, options) =>
        Effect.zipWith(
          encodeStrict(pickKnownKeys(input) as typeof strict.Type, options).pipe(
            Effect.mapError((error) => error.issue)
          ),
          JsonRecord.decodeUnknownEffect(pickUnknownKeys(input), options).pipe(Effect.mapError((error) => error.issue)),
          (encodedValue, encodedRest) => mergeLooseJsonObject(encodedRest, encodedValue)
        )
      ),
    }),
    $I.annoteSchema(name, {
      description,
    })
  );
};

const makeCaseInsensitiveLiteralSchema = <const Values extends A.NonEmptyReadonlyArray<string>>(
  values: Values,
  name: string,
  description: string
) => {
  const CanonicalValue = LiteralKit(values);
  const expected = pipe(values, A.join(", "));

  return S.String.pipe(
    S.decodeTo(CanonicalValue, {
      decode: SchemaGetter.transformOrFail((value) => {
        const normalizedValue = pipe(value, Str.toLowerCase);

        return pipe(
          values,
          A.findFirst((candidate) => pipe(candidate, Str.toLowerCase) === normalizedValue),
          Effect.fromOption(
            () =>
              new SchemaIssue.InvalidValue({
                message: `Expected one of ${expected}.`,
              })
          )
        );
      }),
      encode: SchemaGetter.transform((value) => value),
    }),
    $I.annoteSchema(name, {
      description,
    })
  );
};

const makeUniqueArraySchema = <Item extends S.Top>(item: Item, name: string, description: string) => {
  const equivalence = S.toEquivalence(item);

  return S.Array(item)
    .check(
      S.makeFilter(
        (values: ReadonlyArray<Item["Type"]>) => A.length(A.dedupeWith(equivalence)(values)) === A.length(values),
        {
          identifier: $I.make(`${name}UniqueItemsCheck`),
          title: `${name} Unique Items`,
          description: `${description} Items must be unique.`,
          message: "Array items must be unique.",
        }
      )
    )
    .pipe(
      $I.annoteSchema(name, {
        description,
      })
    );
};

const optionalField = <Schema extends S.Top>(schema: Schema, name: string, description: string) =>
  schema.pipe(S.OptionFromOptionalKey, $I.annoteSchema(name, { description })).annotateKey({ description });

const nullableOptionalField = <Schema extends S.Top>(schema: Schema, name: string, description: string) =>
  Model.optionalOption(schema).pipe($I.annoteSchema(name, { description })).annotateKey({ description });

const toOptionalValue = <Value>(value: O.Option<Value> | Value | null | undefined): O.Option<Value> => {
  if (P.isNullish(value)) {
    return O.none();
  }

  return O.isOption(value) ? value : O.some(value);
};

const isTrueOption = (value: O.Option<boolean> | boolean | null | undefined): boolean =>
  pipe(
    toOptionalValue(value),
    O.match({
      onNone: thunkFalse,
      onSome: identity,
    })
  );

const getTargetRank = (target: (typeof TARGET_VALUES)[number]): number =>
  pipe(
    TARGET_VALUES,
    A.findFirstIndex(Eq.equals(target)),
    O.getOrElse(() => -1)
  );

const isTargetAtLeast = (target: (typeof TARGET_VALUES)[number], minimum: (typeof TARGET_VALUES)[number]): boolean =>
  getTargetRank(target) >= getTargetRank(minimum);

const TSConfigUniqueStringArray = makeUniqueArraySchema(
  S.String,
  "TSConfigUniqueStringArray",
  "A unique array of strings reused by tsconfig list-style properties."
);

const TSConfigModule = makeCaseInsensitiveLiteralSchema(
  MODULE_VALUES,
  "TSConfigModule",
  "Canonical TypeScript module emit target values accepted by tsconfig."
);

const TSConfigModuleResolution = makeCaseInsensitiveLiteralSchema(
  MODULE_RESOLUTION_VALUES,
  "TSConfigModuleResolution",
  "Canonical TypeScript module resolution strategies accepted by tsconfig."
);

const TSConfigTarget = makeCaseInsensitiveLiteralSchema(
  TARGET_VALUES,
  "TSConfigTarget",
  "Canonical TypeScript JavaScript target values accepted by tsconfig."
);

const TSConfigLibName = makeCaseInsensitiveLiteralSchema(
  LIB_VALUES,
  "TSConfigLibName",
  "Canonical TypeScript bundled library declaration names accepted by tsconfig."
);

const TSConfigLibNames = makeUniqueArraySchema(
  TSConfigLibName,
  "TSConfigLibNames",
  "A unique array of TypeScript bundled library declaration names."
);

const TSConfigJsx = makeCaseInsensitiveLiteralSchema(
  JSX_VALUES,
  "TSConfigJsx",
  "Canonical JSX emit modes accepted by tsconfig."
);

const TSConfigNewLine = makeCaseInsensitiveLiteralSchema(
  NEW_LINE_VALUES,
  "TSConfigNewLine",
  "Canonical newline emit modes accepted by tsconfig."
);

const TSConfigFallbackPolling = makeCaseInsensitiveLiteralSchema(
  FALLBACK_POLLING_VALUES,
  "TSConfigFallbackPolling",
  "Canonical fallback polling strategies accepted by tsconfig."
);

const TSConfigWatchDirectory = makeCaseInsensitiveLiteralSchema(
  WATCH_DIRECTORY_VALUES,
  "TSConfigWatchDirectory",
  "Canonical watchDirectory strategies accepted by tsconfig."
);

const TSConfigWatchFile = makeCaseInsensitiveLiteralSchema(
  WATCH_FILE_VALUES,
  "TSConfigWatchFile",
  "Canonical watchFile strategies accepted by tsconfig."
);

const TSConfigModuleDetection = makeCaseInsensitiveLiteralSchema(
  MODULE_DETECTION_VALUES,
  "TSConfigModuleDetection",
  "Canonical module detection strategies accepted by tsconfig."
);

const TSConfigImportsNotUsedAsValues = makeCaseInsensitiveLiteralSchema(
  IMPORTS_NOT_USED_AS_VALUES,
  "TSConfigImportsNotUsedAsValues",
  "Canonical importsNotUsedAsValues behaviors accepted by tsconfig."
);

const TSNodeExperimentalSpecifierResolution = makeCaseInsensitiveLiteralSchema(
  TS_NODE_EXPERIMENTAL_SPECIFIER_RESOLUTION_VALUES,
  "TSNodeExperimentalSpecifierResolution",
  "Canonical ts-node experimental specifier resolution modes accepted by tsconfig."
);

const TSNodeModuleType = makeCaseInsensitiveLiteralSchema(
  TS_NODE_MODULE_TYPE_VALUES,
  "TSNodeModuleType",
  "Canonical ts-node module type override values accepted by tsconfig."
);

const TSConfigExtends = S.Union([S.String, S.Array(S.String)]).pipe(
  $I.annoteSchema("TSConfigExtends", {
    description: "A tsconfig extends reference represented as a single base config path or an ordered array of paths.",
  })
);

/**
 * Project reference entry for tsconfig `references`.
 *
 * **Example** (Import TSConfigReference schema)
 *
 * ```ts
 * import { TSConfigReference } from "@beep/repo-utils/schemas/TSConfig"
 * const schema = TSConfigReference
 * console.log(schema)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export class TSConfigReference extends S.Class<TSConfigReference>($I`TSConfigReference`)(
  {
    path: S.String.annotateKey({
      description: "Path to the referenced tsconfig file or to the directory containing it.",
    }),
  },
  $I.annote("TSConfigReference", {
    description: "A single project reference entry in tsconfig `references`.",
    messageUnexpectedKey: "Unexpected tsconfig reference key",
  })
) {}

const TSConfigReferences = makeUniqueArraySchema(
  TSConfigReference,
  "TSConfigReferences",
  "A unique array of TypeScript project reference entries."
);

const tsConfigCompilerPluginBaseFields = {
  name: S.String.annotateKey({
    description: "Language service plugin package or module name.",
  }),
} as const;

const TSConfigCompilerPlugin = makeLooseJsonObject(
  tsConfigCompilerPluginBaseFields,
  "TSConfigCompilerPlugin",
  "A TypeScript language service plugin entry with a required name and plugin-specific JSON extras."
);

const TSConfigCompilerPlugins = S.Array(TSConfigCompilerPlugin).pipe(
  $I.annoteSchema("TSConfigCompilerPlugins", {
    description: "An ordered array of compiler plugin entries.",
  })
);

const TSConfigPathTargets = S.NullOr(TSConfigUniqueStringArray).pipe(
  $I.annoteSchema("TSConfigPathTargets", {
    description: "A tsconfig `paths` entry target array or null when explicitly disabled in the encoded document.",
  })
);

const TSConfigPaths = S.Record(TSConfigJsonKey, TSConfigPathTargets).pipe(
  $I.annoteSchema("TSConfigPaths", {
    description: "The compilerOptions.paths map from module specifier aliases to arrays of target paths or null.",
  })
);

const TSNodeIgnoreDiagnostic = S.Union([S.String, S.Finite]).pipe(
  $I.annoteSchema("TSNodeIgnoreDiagnostic", {
    description: "A single ts-node ignored diagnostic identifier represented as a string or numeric code.",
  })
);

const TSNodeIgnoreDiagnostics = S.Array(TSNodeIgnoreDiagnostic).pipe(
  $I.annoteSchema("TSNodeIgnoreDiagnostics", {
    description: "An ordered list of ts-node ignored TypeScript diagnostics.",
  })
);

const TSNodeRequire = S.Array(S.String).pipe(
  $I.annoteSchema("TSNodeRequire", {
    description: "An ordered list of modules to require before ts-node execution.",
  })
);

const TSNodeTranspilerTuple = S.Tuple([S.NullOr(S.String), S.NullOr(JsonRecord)]).pipe(
  $I.annoteSchema("TSNodeTranspilerTuple", {
    description: "Tuple form of the ts-node transpiler setting with a transpiler id and optional JSON options object.",
  })
);

const TSNodeTranspiler = S.Union([S.String, TSNodeTranspilerTuple]).pipe(
  $I.annoteSchema("TSNodeTranspiler", {
    description: "The ts-node transpiler setting represented as either a string id or a `[id, options]` tuple.",
  })
);

const TSNodeModuleTypes = S.Record(TSConfigJsonKey, TSNodeModuleType).pipe(
  $I.annoteSchema("TSNodeModuleTypes", {
    description: "A ts-node module type override map from glob patterns to `cjs`, `esm`, or `package`.",
  })
);

const compilerOptionsDescription = "Instructs the TypeScript compiler how to compile .ts files.";
const watchOptionsDescription = "Settings for the watch mode in TypeScript.";
const buildOptionsDescription = "Settings for TypeScript project build mode.";
const typeAcquisitionDescription =
  "Auto type acquisition options for this project. Missing or explicit null decodes to Option.none.";
const tsNodeDescription =
  "ts-node options used to execute or transpile TypeScript directly from tsconfig-compatible JSON documents.";

const MaxNodeModuleJsDepth = S.Int.check(S.isGreaterThanOrEqualTo(0)).pipe(
  $I.annoteSchema("CompilerOptionsMaxNodeModuleJsDepthValue", {
    description: "Non-negative integer depth for JavaScript files checked under node_modules.",
  })
);

const tsConfigCompilerOptionsFields = {
  allowArbitraryExtensions: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsAllowArbitraryExtensions",
    "Enable importing files with any extension, provided a declaration file is present."
  ),
  allowImportingTsExtensions: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsAllowImportingTsExtensions",
    "Allow imports to include TypeScript file extensions. Requires `moduleResolution = bundler` and either `noEmit` or `emitDeclarationOnly`."
  ),
  charset: nullableOptionalField(
    S.String,
    "CompilerOptionsCharset",
    "No longer supported. In early versions, manually set the text encoding for reading files."
  ),
  composite: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsComposite",
    "Enable constraints that allow a TypeScript project to be used with project references."
  ),
  customConditions: nullableOptionalField(
    TSConfigUniqueStringArray,
    "CompilerOptionsCustomConditions",
    "Conditions to set in addition to the resolver-specific defaults when resolving imports."
  ),
  declaration: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsDeclaration",
    "Generate .d.ts files from TypeScript and JavaScript files in your project."
  ),
  declarationDir: nullableOptionalField(
    S.String,
    "CompilerOptionsDeclarationDir",
    "Specify the output directory for generated declaration files."
  ),
  diagnostics: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsDiagnostics",
    "Output compiler performance information after building."
  ),
  disableReferencedProjectLoad: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsDisableReferencedProjectLoad",
    "Reduce the number of projects loaded automatically by TypeScript."
  ),
  noPropertyAccessFromIndexSignature: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsNoPropertyAccessFromIndexSignature",
    "Enforces using indexed accessors for keys declared using an indexed type."
  ),
  emitBOM: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsEmitBOM",
    "Emit a UTF-8 byte order mark at the beginning of emitted files."
  ),
  emitDeclarationOnly: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsEmitDeclarationOnly",
    "Only output declaration files and not JavaScript files."
  ),
  erasableSyntaxOnly: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsErasableSyntaxOnly",
    "Do not allow runtime constructs that are not part of ECMAScript."
  ),
  exactOptionalPropertyTypes: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsExactOptionalPropertyTypes",
    "Interpret optional property types as written rather than adding `undefined`."
  ),
  incremental: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsIncremental",
    "Enable incremental compilation. Requires TypeScript version 3.4 or later."
  ),
  tsBuildInfoFile: nullableOptionalField(
    S.String,
    "CompilerOptionsTsBuildInfoFile",
    "Specify the path to the `.tsbuildinfo` incremental compilation file."
  ),
  inlineSourceMap: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsInlineSourceMap",
    "Include source map files inside the emitted JavaScript."
  ),
  inlineSources: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsInlineSources",
    "Include source code inside inline source maps."
  ),
  jsx: optionalField(TSConfigJsx, "CompilerOptionsJsx", "Specify what JSX code is generated."),
  reactNamespace: nullableOptionalField(
    S.String,
    "CompilerOptionsReactNamespace",
    "Specify the object invoked for `createElement`. This only applies when targeting `react` JSX emit."
  ),
  jsxFactory: nullableOptionalField(
    S.String,
    "CompilerOptionsJsxFactory",
    "Specify the JSX factory function used when targeting React JSX emit."
  ),
  jsxFragmentFactory: nullableOptionalField(
    S.String,
    "CompilerOptionsJsxFragmentFactory",
    "Specify the JSX fragment reference used when targeting React JSX emit."
  ),
  jsxImportSource: nullableOptionalField(
    S.String,
    "CompilerOptionsJsxImportSource",
    "Specify the module specifier used to import the JSX factory helpers when using `react-jsx*` emit."
  ),
  listFiles: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsListFiles",
    "Print all files read during the compilation."
  ),
  mapRoot: nullableOptionalField(
    S.String,
    "CompilerOptionsMapRoot",
    "Specify the location where the debugger should locate map files instead of generated locations."
  ),
  module: nullableOptionalField(TSConfigModule, "CompilerOptionsModule", "Specify what module code is generated."),
  moduleResolution: nullableOptionalField(
    TSConfigModuleResolution,
    "CompilerOptionsModuleResolution",
    "Specify how TypeScript looks up a file from a given module specifier."
  ),
  moduleSuffixes: nullableOptionalField(
    TSConfigUniqueStringArray,
    "CompilerOptionsModuleSuffixes",
    "List of file name suffixes to search when resolving a module."
  ),
  newLine: nullableOptionalField(
    TSConfigNewLine,
    "CompilerOptionsNewLine",
    "Set the newline character used when emitting files."
  ),
  noEmit: nullableOptionalField(S.Boolean, "CompilerOptionsNoEmit", "Disable emitting files from a compilation."),
  noEmitHelpers: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsNoEmitHelpers",
    "Disable generating custom helper functions such as `__extends` in compiled output."
  ),
  noEmitOnError: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsNoEmitOnError",
    "Disable emitting files when type checking errors are reported."
  ),
  noImplicitAny: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsNoImplicitAny",
    "Enable error reporting for expressions and declarations with an implied `any` type."
  ),
  noImplicitThis: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsNoImplicitThis",
    "Enable error reporting when `this` is given the type `any`."
  ),
  noUnusedLocals: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsNoUnusedLocals",
    "Enable error reporting when local variables are not read."
  ),
  noUnusedParameters: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsNoUnusedParameters",
    "Raise an error when a function parameter is not read."
  ),
  noLib: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsNoLib",
    "Disable including any library files, including the default `lib.d.ts`."
  ),
  noResolve: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsNoResolve",
    "Disallow imports, requires, or references from expanding the number of files in the program."
  ),
  noStrictGenericChecks: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsNoStrictGenericChecks",
    "Disable strict checking of generic signatures in function types."
  ),
  out: nullableOptionalField(S.String, "CompilerOptionsOut", "Deprecated setting. Use `outFile` instead."),
  skipDefaultLibCheck: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsSkipDefaultLibCheck",
    "Skip type checking `.d.ts` files that are included with TypeScript."
  ),
  skipLibCheck: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsSkipLibCheck",
    "Skip type checking all `.d.ts` files."
  ),
  outFile: nullableOptionalField(
    S.String,
    "CompilerOptionsOutFile",
    "Specify a file that bundles all outputs into one JavaScript file and optionally bundled declaration output."
  ),
  outDir: nullableOptionalField(S.String, "CompilerOptionsOutDir", "Specify an output folder for all emitted files."),
  preserveConstEnums: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsPreserveConstEnums",
    "Disable erasing `const enum` declarations in generated code."
  ),
  preserveSymlinks: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsPreserveSymlinks",
    "Disable resolving symlinks to their real path."
  ),
  preserveValueImports: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsPreserveValueImports",
    "Preserve unused imported values in the JavaScript output that would otherwise be removed."
  ),
  preserveWatchOutput: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsPreserveWatchOutput",
    "Disable wiping the console in watch mode."
  ),
  pretty: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsPretty",
    "Enable color and formatting in TypeScript output to make compiler errors easier to read."
  ),
  removeComments: nullableOptionalField(S.Boolean, "CompilerOptionsRemoveComments", "Disable emitting comments."),
  rewriteRelativeImportExtensions: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsRewriteRelativeImportExtensions",
    "Rewrite `.ts`, `.tsx`, `.mts`, and `.cts` file extensions in relative import paths to JavaScript equivalents in output files."
  ),
  rootDir: nullableOptionalField(
    S.String,
    "CompilerOptionsRootDir",
    "Specify the root folder within your source files."
  ),
  isolatedModules: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsIsolatedModules",
    "Ensure that each file can be safely transpiled without relying on other imports."
  ),
  sourceMap: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsSourceMap",
    "Create source map files for emitted JavaScript files."
  ),
  sourceRoot: nullableOptionalField(
    S.String,
    "CompilerOptionsSourceRoot",
    "Specify the root path for debuggers to find the reference source code."
  ),
  suppressExcessPropertyErrors: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsSuppressExcessPropertyErrors",
    "Disable reporting of excess property errors during creation of object literals."
  ),
  suppressImplicitAnyIndexErrors: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsSuppressImplicitAnyIndexErrors",
    "Suppress `noImplicitAny` errors when indexing objects that lack index signatures."
  ),
  stripInternal: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsStripInternal",
    "Disable emitting declarations that have `@internal` in their JSDoc comments."
  ),
  target: nullableOptionalField(
    TSConfigTarget,
    "CompilerOptionsTarget",
    "Set the JavaScript language version for emitted JavaScript and include compatible library declarations."
  ),
  useUnknownInCatchVariables: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsUseUnknownInCatchVariables",
    "Default catch clause variables to `unknown` instead of `any`."
  ),
  watch: nullableOptionalField(S.Boolean, "CompilerOptionsWatch", "Watch input files."),
  fallbackPolling: optionalField(
    TSConfigFallbackPolling,
    "CompilerOptionsFallbackPolling",
    "Specify the polling strategy to use when the system runs out of or does not support native file watchers."
  ),
  watchDirectory: optionalField(
    TSConfigWatchDirectory,
    "CompilerOptionsWatchDirectory",
    "Specify the strategy for watching directories on systems that lack recursive file watching functionality."
  ),
  watchFile: optionalField(
    TSConfigWatchFile,
    "CompilerOptionsWatchFile",
    "Specify the strategy for watching individual files."
  ),
  experimentalDecorators: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsExperimentalDecorators",
    "Enable experimental support for legacy decorators."
  ),
  emitDecoratorMetadata: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsEmitDecoratorMetadata",
    "Emit design-type metadata for decorated declarations."
  ),
  allowUnusedLabels: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsAllowUnusedLabels",
    "Disable error reporting for unused labels."
  ),
  noImplicitReturns: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsNoImplicitReturns",
    "Enable error reporting for code paths that do not explicitly return in a function."
  ),
  noUncheckedIndexedAccess: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsNoUncheckedIndexedAccess",
    "Add `undefined` to a type when it is accessed using an index."
  ),
  noFallthroughCasesInSwitch: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsNoFallthroughCasesInSwitch",
    "Enable error reporting for fallthrough cases in switch statements."
  ),
  noImplicitOverride: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsNoImplicitOverride",
    "Ensure overriding members in derived classes are marked with an override modifier."
  ),
  allowUnreachableCode: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsAllowUnreachableCode",
    "Disable error reporting for unreachable code."
  ),
  forceConsistentCasingInFileNames: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsForceConsistentCasingInFileNames",
    "Ensure that casing is correct in imports."
  ),
  generateCpuProfile: nullableOptionalField(
    S.String,
    "CompilerOptionsGenerateCpuProfile",
    "Emit a V8 CPU profile of the compiler run for debugging."
  ),
  baseUrl: nullableOptionalField(
    S.String,
    "CompilerOptionsBaseUrl",
    "Specify the base directory to resolve non-relative module names."
  ),
  paths: nullableOptionalField(
    TSConfigPaths,
    "CompilerOptionsPaths",
    "Specify a set of entries that re-map imports to additional lookup locations."
  ),
  plugins: nullableOptionalField(
    TSConfigCompilerPlugins,
    "CompilerOptionsPlugins",
    "Specify a list of language service plugins to include."
  ),
  rootDirs: nullableOptionalField(
    TSConfigUniqueStringArray,
    "CompilerOptionsRootDirs",
    "Allow multiple folders to be treated as one when resolving modules."
  ),
  typeRoots: nullableOptionalField(
    TSConfigUniqueStringArray,
    "CompilerOptionsTypeRoots",
    "Specify multiple folders that act like `./node_modules/@types`."
  ),
  types: nullableOptionalField(
    TSConfigUniqueStringArray,
    "CompilerOptionsTypes",
    "Specify type package names to be included without being referenced in a source file."
  ),
  traceResolution: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsTraceResolution",
    "Log paths used during the `moduleResolution` process."
  ),
  allowJs: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsAllowJs",
    "Allow JavaScript files to be part of the program."
  ),
  noErrorTruncation: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsNoErrorTruncation",
    "Disable truncating types in error messages."
  ),
  allowSyntheticDefaultImports: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsAllowSyntheticDefaultImports",
    "Allow `import x from y` when a module does not have a default export."
  ),
  noImplicitUseStrict: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsNoImplicitUseStrict",
    "Disable adding `use strict` directives in emitted JavaScript files."
  ),
  listEmittedFiles: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsListEmittedFiles",
    "Print the names of emitted files after a compilation."
  ),
  disableSizeLimit: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsDisableSizeLimit",
    "Remove the 20MB cap on total source code size for JavaScript files in the TypeScript language server."
  ),
  lib: nullableOptionalField(
    TSConfigLibNames,
    "CompilerOptionsLib",
    "Specify a set of bundled library declaration files that describe the target runtime environment."
  ),
  libReplacement: nullableOptionalField(S.Boolean, "CompilerOptionsLibReplacement", "Enable lib replacement."),
  moduleDetection: optionalField(
    TSConfigModuleDetection,
    "CompilerOptionsModuleDetection",
    "Control what method is used to detect module-format JavaScript files."
  ),
  strictNullChecks: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsStrictNullChecks",
    "When type checking, take into account `null` and `undefined`."
  ),
  maxNodeModuleJsDepth: nullableOptionalField(
    MaxNodeModuleJsDepth,
    "CompilerOptionsMaxNodeModuleJsDepth",
    "Specify the maximum folder depth used for checking JavaScript files from `node_modules`."
  ),
  importHelpers: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsImportHelpers",
    "Allow importing helper functions from tslib once per project instead of including them per file."
  ),
  importsNotUsedAsValues: optionalField(
    TSConfigImportsNotUsedAsValues,
    "CompilerOptionsImportsNotUsedAsValues",
    "Specify emit and checking behavior for imports that are only used for types."
  ),
  alwaysStrict: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsAlwaysStrict",
    "Ensure `use strict` is always emitted."
  ),
  strict: nullableOptionalField(S.Boolean, "CompilerOptionsStrict", "Enable all strict type checking options."),
  strictBindCallApply: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsStrictBindCallApply",
    "Check that the arguments for `bind`, `call`, and `apply` methods match the original function."
  ),
  downlevelIteration: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsDownlevelIteration",
    "Emit more compliant but more verbose JavaScript for iteration."
  ),
  checkJs: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsCheckJs",
    "Enable error reporting in type-checked JavaScript files."
  ),
  strictFunctionTypes: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsStrictFunctionTypes",
    "When assigning functions, check that parameters and return values are subtype compatible."
  ),
  strictPropertyInitialization: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsStrictPropertyInitialization",
    "Check for class properties that are declared but not set in the constructor."
  ),
  esModuleInterop: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsEsModuleInterop",
    "Emit additional JavaScript to ease support for importing CommonJS modules."
  ),
  allowUmdGlobalAccess: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsAllowUmdGlobalAccess",
    "Allow accessing UMD globals from modules."
  ),
  keyofStringsOnly: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsKeyofStringsOnly",
    "Make `keyof` only return strings instead of strings, numbers, or symbols."
  ),
  useDefineForClassFields: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsUseDefineForClassFields",
    "Emit ECMAScript-standard-compliant class fields."
  ),
  declarationMap: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsDeclarationMap",
    "Create source maps for `.d.ts` files."
  ),
  resolveJsonModule: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsResolveJsonModule",
    "Enable importing `.json` files."
  ),
  resolvePackageJsonExports: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsResolvePackageJsonExports",
    "Use the `package.json` exports field when resolving package imports."
  ),
  resolvePackageJsonImports: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsResolvePackageJsonImports",
    "Use the `package.json` imports field when resolving imports."
  ),
  assumeChangesOnlyAffectDirectDependencies: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsAssumeChangesOnlyAffectDirectDependencies",
    "Have recompiles assume that changes within a file will only affect files directly depending on it."
  ),
  extendedDiagnostics: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsExtendedDiagnostics",
    "Output more detailed compiler performance information after building."
  ),
  listFilesOnly: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsListFilesOnly",
    "Print the names of files that are part of the compilation and then stop processing."
  ),
  disableSourceOfProjectReferenceRedirect: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsDisableSourceOfProjectReferenceRedirect",
    "Disable preferring source files instead of declaration files when referencing composite projects."
  ),
  disableSolutionSearching: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsDisableSolutionSearching",
    "Opt a project out of multi-project reference checking when editing."
  ),
  verbatimModuleSyntax: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsVerbatimModuleSyntax",
    "Do not transform or elide any imports or exports not marked as type-only."
  ),
  noCheck: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsNoCheck",
    "Disable full type checking; only critical parse and emit errors will be reported."
  ),
  isolatedDeclarations: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsIsolatedDeclarations",
    "Require sufficient annotation on exports so other tools can trivially generate declaration files."
  ),
  noUncheckedSideEffectImports: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsNoUncheckedSideEffectImports",
    "Check side effect imports."
  ),
  strictBuiltinIteratorReturn: nullableOptionalField(
    S.Boolean,
    "CompilerOptionsStrictBuiltinIteratorReturn",
    "Instantiate built-in iterators with a `TReturn` type of `undefined` instead of `any`."
  ),
} as const;

class TSConfigCompilerOptionsShape extends S.Class<TSConfigCompilerOptionsShape>($I`TSConfigCompilerOptionsShape`)(
  tsConfigCompilerOptionsFields
) {}

type TSConfigCompilerOptionsShapeType = TSConfigCompilerOptionsShape;

const TSConfigCompilerOptionsChecks = S.makeFilterGroup(
  [
    S.makeFilter(
      (options: TSConfigCompilerOptionsShapeType) =>
        !isTrueOption(options.allowImportingTsExtensions) ||
        (pipe(
          toOptionalValue(options.moduleResolution),
          O.match({
            onNone: () => false,
            onSome: (moduleResolution) => moduleResolution === "bundler",
          })
        ) &&
          (isTrueOption(options.noEmit) || isTrueOption(options.emitDeclarationOnly))),
      {
        identifier: $I`TSConfigCompilerOptionsAllowImportingTsExtensionsCheck`,
        title: "TSConfig allowImportingTsExtensions",
        description:
          "allowImportingTsExtensions requires moduleResolution=bundler and either noEmit or emitDeclarationOnly.",
        message:
          "compilerOptions.allowImportingTsExtensions requires compilerOptions.moduleResolution to be bundler and either compilerOptions.noEmit or compilerOptions.emitDeclarationOnly to be true.",
      }
    ),
    S.makeFilter(
      (options: TSConfigCompilerOptionsShapeType) =>
        pipe(
          toOptionalValue(options.reactNamespace),
          O.match({
            onNone: thunkTrue,
            onSome: () =>
              pipe(
                toOptionalValue(options.jsx),
                O.exists((jsx) => jsx === "react")
              ),
          })
        ),
      {
        identifier: $I`TSConfigCompilerOptionsReactNamespaceCheck`,
        title: "TSConfig reactNamespace",
        description: "reactNamespace only applies when jsx is set to react.",
        message: "compilerOptions.reactNamespace requires compilerOptions.jsx to be set to react.",
      }
    ),
    S.makeFilter(
      (options: TSConfigCompilerOptionsShapeType) =>
        pipe(
          toOptionalValue(options.maxNodeModuleJsDepth),
          O.match({
            onNone: thunkTrue,
            onSome: () => isTrueOption(options.allowJs),
          })
        ),
      {
        identifier: $I`TSConfigCompilerOptionsMaxNodeModuleJsDepthCheck`,
        title: "TSConfig maxNodeModuleJsDepth",
        description: "maxNodeModuleJsDepth only applies when allowJs is enabled.",
        message: "compilerOptions.maxNodeModuleJsDepth requires compilerOptions.allowJs to be true.",
      }
    ),
  ],
  {
    identifier: $I`TSConfigCompilerOptionsChecks`,
    title: "TSConfig Compiler Options Checks",
    description: "Cross-field semantic checks for tsconfig compilerOptions.",
  }
);

const TSConfigCompilerOptionsSemantic = TSConfigCompilerOptionsShape.check(TSConfigCompilerOptionsChecks).pipe(
  $I.annoteSchema("TSConfigCompilerOptionsSemantic", {
    description: "Compiler options shape with additional semantic refinement checks applied for strict decode helpers.",
  })
);

const TSNodeCompilerOptions = makeLooseJsonObject(
  tsConfigCompilerOptionsFields,
  "TSNodeCompilerOptions",
  "Open ts-node compilerOptions override object containing the canonical compilerOptions fields plus additional JSON-valued overrides."
);

/**
 * Strict TypeScript compilerOptions section.
 *
 * **Example** (Import compiler options schema)
 *
 * ```ts
 * import { TSConfigCompilerOptions } from "@beep/repo-utils/schemas/TSConfig"
 * const schema = TSConfigCompilerOptions
 * console.log(schema)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const TSConfigCompilerOptions = TSConfigCompilerOptionsSemantic.pipe(
  $I.annoteSchema("TSConfigCompilerOptions", {
    description: "Strict TypeScript compilerOptions section derived from the official SchemaStore tsconfig schema.",
    messageUnexpectedKey: "Unexpected compilerOptions key",
  })
);

/**
 * Runtime type for {@link TSConfigCompilerOptions}.
 *
 * **Example** (Accept compiler options type)
 *
 * ```ts
 * import type { TSConfigCompilerOptions } from "@beep/repo-utils/schemas/TSConfig"
 * const acceptCompilerOptions = (_value: TSConfigCompilerOptions) => undefined
 * console.log(acceptCompilerOptions)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TSConfigCompilerOptions = (typeof TSConfigCompilerOptions)["Type"];

const tsConfigWatchOptionsFields = {
  force: nullableOptionalField(
    S.String,
    "WatchOptionsForce",
    "Undocumented watch option preserved from SchemaStore for compatibility."
  ),
  watchFile: nullableOptionalField(
    TSConfigWatchFile,
    "WatchOptionsWatchFile",
    "Specify how the TypeScript watch mode works."
  ),
  watchDirectory: nullableOptionalField(
    TSConfigWatchDirectory,
    "WatchOptionsWatchDirectory",
    "Specify how directories are watched on systems that lack recursive file watching functionality."
  ),
  fallbackPolling: nullableOptionalField(
    TSConfigFallbackPolling,
    "WatchOptionsFallbackPolling",
    "Specify what approach the watcher should use if the system runs out of native file watchers."
  ),
  synchronousWatchDirectory: nullableOptionalField(
    S.Boolean,
    "WatchOptionsSynchronousWatchDirectory",
    "Synchronously call callbacks and update directory watcher state on platforms that do not support recursive watching natively."
  ),
  excludeFiles: nullableOptionalField(
    TSConfigUniqueStringArray,
    "WatchOptionsExcludeFiles",
    "Remove a list of files from the watch mode processing."
  ),
  excludeDirectories: nullableOptionalField(
    TSConfigUniqueStringArray,
    "WatchOptionsExcludeDirectories",
    "Remove a list of directories from the watch process."
  ),
} as const;

/**
 * Strict TypeScript watchOptions section.
 *
 * **Example** (Import watch options schema)
 *
 * ```ts
 * import { TSConfigWatchOptions } from "@beep/repo-utils/schemas/TSConfig"
 * const schema = TSConfigWatchOptions
 * console.log(schema)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export class TSConfigWatchOptions extends S.Class<TSConfigWatchOptions>($I`TSConfigWatchOptions`)(
  tsConfigWatchOptionsFields,
  $I.annote("TSConfigWatchOptions", {
    description: "Strict TypeScript watchOptions section derived from the official SchemaStore tsconfig schema.",
    messageUnexpectedKey: "Unexpected watchOptions key",
  })
) {}

const tsConfigBuildOptionsFields = {
  dry: nullableOptionalField(S.Boolean, "BuildOptionsDry", "Enable TypeScript build dry-run mode."),
  force: nullableOptionalField(
    S.Boolean,
    "BuildOptionsForce",
    "Build all projects, including those that appear to be up to date."
  ),
  verbose: nullableOptionalField(S.Boolean, "BuildOptionsVerbose", "Enable verbose logging."),
  incremental: nullableOptionalField(
    S.Boolean,
    "BuildOptionsIncremental",
    "Save `.tsbuildinfo` files to allow incremental compilation of projects."
  ),
  assumeChangesOnlyAffectDirectDependencies: nullableOptionalField(
    S.Boolean,
    "BuildOptionsAssumeChangesOnlyAffectDirectDependencies",
    "Have recompiles assume that changes within a file only affect files directly depending on it."
  ),
  traceResolution: nullableOptionalField(
    S.Boolean,
    "BuildOptionsTraceResolution",
    "Log paths used during the moduleResolution process."
  ),
} as const;

/**
 * Strict TypeScript buildOptions section.
 *
 * **Example** (Import build options schema)
 *
 * ```ts
 * import { TSConfigBuildOptions } from "@beep/repo-utils/schemas/TSConfig"
 * const schema = TSConfigBuildOptions
 * console.log(schema)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export class TSConfigBuildOptions extends S.Class<TSConfigBuildOptions>($I`TSConfigBuildOptions`)(
  tsConfigBuildOptionsFields,
  $I.annote("TSConfigBuildOptions", {
    description: "Strict TypeScript buildOptions section derived from the official SchemaStore tsconfig schema.",
    messageUnexpectedKey: "Unexpected buildOptions key",
  })
) {}

const tsConfigTypeAcquisitionFields = {
  enable: nullableOptionalField(S.Boolean, "TypeAcquisitionEnable", "Enable auto type acquisition."),
  include: nullableOptionalField(
    TSConfigUniqueStringArray,
    "TypeAcquisitionInclude",
    "Specify a list of type declarations to include in auto type acquisition."
  ),
  exclude: nullableOptionalField(
    TSConfigUniqueStringArray,
    "TypeAcquisitionExclude",
    "Specify a list of type declarations to exclude from auto type acquisition."
  ),
} as const;

/**
 * Strict TypeScript typeAcquisition section.
 *
 * **Example** (Import type acquisition schema)
 *
 * ```ts
 * import { TSConfigTypeAcquisition } from "@beep/repo-utils/schemas/TSConfig"
 * const schema = TSConfigTypeAcquisition
 * console.log(schema)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export class TSConfigTypeAcquisition extends S.Class<TSConfigTypeAcquisition>($I`TSConfigTypeAcquisition`)(
  tsConfigTypeAcquisitionFields,
  $I.annote("TSConfigTypeAcquisition", {
    description: "Strict TypeScript typeAcquisition section derived from the official SchemaStore tsconfig schema.",
    messageUnexpectedKey: "Unexpected typeAcquisition key",
  })
) {}

const tsNodeFields = {
  compiler: nullableOptionalField(S.String, "TsNodeCompiler", "Specify a custom TypeScript compiler."),
  compilerHost: nullableOptionalField(
    S.Boolean,
    "TsNodeCompilerHost",
    "Use TypeScript's compiler host API instead of the language service API."
  ),
  compilerOptions: nullableOptionalField(
    TSNodeCompilerOptions,
    "TsNodeCompilerOptions",
    "JSON object to merge with TypeScript compilerOptions, including additional JSON-valued overrides."
  ),
  emit: nullableOptionalField(S.Boolean, "TsNodeEmit", "Emit output files into the `.ts-node` directory."),
  esm: nullableOptionalField(S.Boolean, "TsNodeEsm", "Enable native ESM support in ts-node."),
  experimentalReplAwait: nullableOptionalField(
    S.Boolean,
    "TsNodeExperimentalReplAwait",
    "Allow top-level await in the ts-node REPL."
  ),
  experimentalResolver: nullableOptionalField(
    S.Boolean,
    "TsNodeExperimentalResolver",
    "Enable ts-node experimental import and require remapping features."
  ),
  experimentalSpecifierResolution: nullableOptionalField(
    TSNodeExperimentalSpecifierResolution,
    "TsNodeExperimentalSpecifierResolution",
    "Set ts-node experimental specifier resolution behavior."
  ),
  files: nullableOptionalField(S.Boolean, "TsNodeFiles", "Load `files` and `include` from tsconfig on startup."),
  ignore: nullableOptionalField(S.Array(S.String), "TsNodeIgnore", "Paths which should not be compiled by ts-node."),
  ignoreDiagnostics: nullableOptionalField(
    TSNodeIgnoreDiagnostics,
    "TsNodeIgnoreDiagnostics",
    "Ignore TypeScript warnings by diagnostic code."
  ),
  logError: nullableOptionalField(
    S.Boolean,
    "TsNodeLogError",
    "Log TypeScript errors to stderr instead of throwing exceptions."
  ),
  moduleTypes: nullableOptionalField(
    TSNodeModuleTypes,
    "TsNodeModuleTypes",
    "Override certain paths to be compiled and executed as CommonJS, ESM, or package-default modules."
  ),
  preferTsExts: nullableOptionalField(
    S.Boolean,
    "TsNodePreferTsExts",
    "Re-order file extensions so that TypeScript imports are preferred."
  ),
  pretty: nullableOptionalField(S.Boolean, "TsNodePretty", "Use ts-node pretty diagnostic formatting."),
  require: nullableOptionalField(TSNodeRequire, "TsNodeRequire", "Modules to require before ts-node execution."),
  scope: nullableOptionalField(S.Boolean, "TsNodeScope", "Scope compilation to files within `scopeDir`."),
  scopeDir: nullableOptionalField(
    S.String,
    "TsNodeScopeDir",
    "Base directory used when ts-node scope mode is enabled."
  ),
  skipIgnore: nullableOptionalField(
    S.Boolean,
    "TsNodeSkipIgnore",
    "Skip ignore checks so that compilation will be attempted for all files with matching extensions."
  ),
  swc: nullableOptionalField(
    S.Boolean,
    "TsNodeSwc",
    "Transpile with swc instead of the TypeScript compiler and skip type checking."
  ),
  transpileOnly: nullableOptionalField(S.Boolean, "TsNodeTranspileOnly", "Use TypeScript's faster `transpileModule`."),
  transpiler: nullableOptionalField(
    TSNodeTranspiler,
    "TsNodeTranspiler",
    "Specify a custom transpiler for use with transpileOnly."
  ),
  typeCheck: nullableOptionalField(
    S.Boolean,
    "TsNodeTypeCheck",
    "Deprecated ts-node typeCheck flag preserved from SchemaStore."
  ),
} as const;

/**
 * Strict ts-node config section stored under `ts-node`.
 *
 * **Example** (Import ts-node config schema)
 *
 * ```ts
 * import { TSNodeConfig } from "@beep/repo-utils/schemas/TSConfig"
 * const schema = TSNodeConfig
 * console.log(schema)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export class TSNodeConfig extends S.Class<TSNodeConfig>($I`TSNodeConfig`)(
  tsNodeFields,
  $I.annote("TSNodeConfig", {
    description: "Strict ts-node config section stored under the `ts-node` key in tsconfig documents.",
    messageUnexpectedKey: "Unexpected ts-node key",
  })
) {}

const tsConfigFields = {
  $schema: optionalField(
    S.String,
    "TSConfigSchemaUri",
    "Optional schema URI declared at the top of the tsconfig file."
  ),
  extends: optionalField(
    TSConfigExtends,
    "TSConfigExtendsField",
    "Path to the base configuration file to inherit from or an ordered array of base configuration paths."
  ),
  files: nullableOptionalField(
    TSConfigUniqueStringArray,
    "TSConfigFiles",
    "Explicit list of files to include in compilation."
  ),
  exclude: nullableOptionalField(
    TSConfigUniqueStringArray,
    "TSConfigExclude",
    "List of file or glob patterns to exclude from compilation."
  ),
  include: nullableOptionalField(
    TSConfigUniqueStringArray,
    "TSConfigInclude",
    "List of file or glob patterns to include in compilation."
  ),
  references: optionalField(
    TSConfigReferences,
    "TSConfigReferencesField",
    "Referenced TypeScript projects for project references mode."
  ),
  compileOnSave: nullableOptionalField(S.Boolean, "TSConfigCompileOnSave", "Enable compile-on-save for this project."),
  compilerOptions: nullableOptionalField(
    TSConfigCompilerOptions,
    "TSConfigCompilerOptionsField",
    compilerOptionsDescription
  ),
  watchOptions: nullableOptionalField(TSConfigWatchOptions, "TSConfigWatchOptionsField", watchOptionsDescription),
  buildOptions: optionalField(TSConfigBuildOptions, "TSConfigBuildOptionsField", buildOptionsDescription),
  typeAcquisition: nullableOptionalField(
    TSConfigTypeAcquisition,
    "TSConfigTypeAcquisitionField",
    typeAcquisitionDescription
  ),
  "ts-node": nullableOptionalField(TSNodeConfig, "TSConfigTsNodeField", tsNodeDescription),
} as const;

/**
 * Strict TypeScript tsconfig document schema.
 *
 * **Details**
 *
 * Unexpected keys are rejected by the exported decode helpers.
 *
 * **Example** (Import TSConfig schema)
 *
 * ```ts
 * import { TSConfig } from "@beep/repo-utils/schemas/TSConfig"
 * const schema = TSConfig
 * console.log(schema)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export class TSConfig extends S.Class<TSConfig>($I`TSConfig`)(
  tsConfigFields,
  $I.annote("TSConfig", {
    description:
      "A strict TypeScript tsconfig document schema derived from the official SchemaStore definition, with JSONC-aware decode helpers.",
    messageUnexpectedKey: "Unexpected tsconfig key",
  })
) {
  /**
   * Strictly decode an unknown value into the semantic `TSConfig` shape.
   *
   * **Example** (Decode strict result)
   *
   * ```ts
   * import { TSConfig } from "@beep/repo-utils/schemas/TSConfig"
   * const result = TSConfig.decodeStrictResult({ compilerOptions: { strict: true } })
   * console.log(result)
   * ```
   *
   * @param input - Unknown value to decode as strict tsconfig data.
   * @returns Decode result containing a `TSConfig` value or schema error.
   * @category validation
   * @since 0.0.0
   */
  static readonly decodeStrictResult = (input: unknown): Result.Result<TSConfig.Type, S.SchemaError> =>
    TSConfigSemantic.decodeUnknownResult(input, strictDecodeOptions);

  /**
   * Strictly decode an unknown value into `TSConfig`, preserving failures in an `Exit`.
   *
   * **Example** (Decode strict Exit)
   *
   * ```ts
   * import { TSConfig } from "@beep/repo-utils/schemas/TSConfig"
   * const exit = TSConfig.decodeStrictExit({ compilerOptions: { noEmit: true } })
   * console.log(exit)
   * ```
   *
   * @param input - Unknown value to decode as strict tsconfig data.
   * @returns Exit containing a `TSConfig` value or schema error.
   * @category validation
   * @since 0.0.0
   */
  static readonly decodeStrictExit = (input: unknown): Exit.Exit<TSConfig.Type, S.SchemaError> =>
    TSConfigSemantic.decodeUnknownExit(input, strictDecodeOptions);

  /**
   * Strictly decode an unknown value into `TSConfig` as an Effect.
   *
   * **Example** (Decode strict Effect)
   *
   * ```ts
   * import { Effect } from "effect"
   * import { TSConfig } from "@beep/repo-utils/schemas/TSConfig"
   * const config = Effect.runSync(TSConfig.decodeStrictEffect({ compilerOptions: { strict: true } }))
   * console.log(config.compilerOptions)
   * ```
   *
   * @param input - Unknown value to decode as strict tsconfig data.
   * @returns Effect that succeeds with `TSConfig` or fails with a schema error.
   * @category validation
   * @since 0.0.0
   */
  static readonly decodeStrictEffect = (input: unknown): Effect.Effect<TSConfig.Type, S.SchemaError> =>
    TSConfigSemantic.decodeUnknownEffect(input, strictDecodeOptions).pipe(
      // Not a trivial lambda: S.Class `make` runs `new this(...)`, so a bare
      // `TSConfig.make` reference detaches `this` and throws at decode time.
      Effect.map((decoded) => TSConfig.make(decoded))
    );

  /**
   * Decode JSONC text into strict `TSConfig`.
   *
   * **Example** (Decode JSONC text Effect)
   *
   * ```ts
   * import { Effect } from "effect"
   * import { TSConfig } from "@beep/repo-utils/schemas/TSConfig"
   * const config = Effect.runSync(TSConfig.decodeJsoncTextEffect("{\"compilerOptions\":{\"strict\":true}}"))
   * console.log(config.compilerOptions)
   * ```
   *
   * @category validation
   * @since 0.0.0
   */
  static readonly decodeJsoncTextEffect: (input: string) => Effect.Effect<TSConfig.Type, S.SchemaError> = Effect.fn(
    "RepoUtils.TSConfig.decodeJsoncText"
  )(function* (input) {
    const parsed = yield* decodeJsoncUnknownText(input);
    const decoded = yield* TSConfigSemantic.decodeUnknownEffect(parsed, strictDecodeOptions);
    return TSConfig.make(decoded);
  });

  /**
   * Encode strict `TSConfig` input back to its external shape.
   *
   * **Example** (Encode strict Effect)
   *
   * ```ts
   * import { Effect } from "effect"
   * import { TSConfig } from "@beep/repo-utils/schemas/TSConfig"
   * const encoded = Effect.runSync(TSConfig.encodeStrictEffect({ compilerOptions: { strict: true } }))
   * console.log(encoded.compilerOptions?.strict)
   * ```
   *
   * @category validation
   * @since 0.0.0
   */
  static readonly encodeStrictEffect: (input: unknown) => Effect.Effect<TSConfig.Encoded, S.SchemaError> = Effect.fn(
    "RepoUtils.TSConfig.encodeStrict"
  )(function* (input) {
    const validated = yield* TSConfig.decodeStrictEffect(input);
    return yield* encodeTSConfigUnknownEffect(validated);
  });

  /**
   * Encode strict `TSConfig` input to compact JSON text.
   *
   * **Example** (Encode compact JSON string)
   *
   * ```ts
   * import { Effect } from "effect"
   * import { TSConfig } from "@beep/repo-utils/schemas/TSConfig"
   * const json = Effect.runSync(TSConfig.encodeJsonStringEffect({ compilerOptions: { strict: true } }))
   * console.log(json.includes("\"strict\":true"))
   * ```
   *
   * @category validation
   * @since 0.0.0
   */
  static readonly encodeJsonStringEffect: (input: unknown) => Effect.Effect<string, S.SchemaError> = Effect.fn(
    "RepoUtils.TSConfig.encodeJsonString"
  )(function* (input) {
    const validated = yield* TSConfig.decodeStrictEffect(input);
    return yield* encodeTSConfigJsonStringEffect(validated);
  });

  /**
   * Decode `TSConfig` input to compact JSON text.
   *
   * **Example** (Encode compact JSON string)
   *
   * ```ts
   * import { Effect } from "effect"
   * import { TSConfig } from "@beep/repo-utils/schemas/TSConfig"
   * const json = Effect.runSync(TSConfig.decodeUnknownEffect({ compilerOptions: { strict: true } }))
   * console.log(json.includes("\"strict\":true"))
   * ```
   *
   * @category validation
   * @since 0.0.0
   */
  static readonly decodeUnknownEffect = S.decodeUnknownEffect(TSConfig);
}

/**
 * Namespace helpers for the strict tsconfig schema.
 *
 * **Example** (Read TSConfig.Type helpers)
 *
 * ```ts
 * import type { TSConfig } from "@beep/repo-utils/schemas/TSConfig"
 * const readCompilerOptions = (value: TSConfig.Type) => value.compilerOptions
 * console.log(readCompilerOptions)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace TSConfig {
  /**
   * Decoded runtime type for {@link TSConfig}.
   *
   * @category models
   * @since 0.0.0
   */
  export type Type = TSConfig;

  /**
   * Encoded representation for {@link TSConfig}.
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = S.Codec.Encoded<typeof TSConfig>;
}

type TSConfigShapeType = TSConfig;

const getCompilerTarget = (config: TSConfigShapeType): (typeof TARGET_VALUES)[number] =>
  pipe(
    toOptionalValue(config.compilerOptions),
    O.flatMap((compilerOptions) => toOptionalValue(compilerOptions.target)),
    O.getOrElse(() => TARGET_VALUES[0])
  );

const TSConfigSemanticChecks = S.makeFilterGroup(
  [
    S.makeFilter(
      (config: TSConfigShapeType) =>
        pipe(
          toOptionalValue(config["ts-node"]),
          O.flatMap((tsNode) => toOptionalValue(tsNode.experimentalReplAwait)),
          O.match({
            onNone: thunkTrue,
            onSome: (enabled) => !enabled || isTargetAtLeast(getCompilerTarget(config), "es2018"),
          })
        ),
      {
        identifier: $I`TSConfigExperimentalReplAwaitTargetCheck`,
        title: "TSConfig experimentalReplAwait",
        description: "ts-node experimentalReplAwait requires compilerOptions.target to be at least ES2018.",
        message:
          "`ts-node`.experimentalReplAwait requires compilerOptions.target to be ES2018 or newer when it is enabled.",
      }
    ),
  ],
  {
    identifier: $I`TSConfigSemanticChecks`,
    title: "TSConfig Semantic Checks",
    description: "Cross-field semantic checks for strict tsconfig decode helpers.",
  }
);

const TSConfigSemantic = S.make<(typeof TSConfig)["Rebuild"]>(TSConfig.ast)
  .check(TSConfigSemanticChecks)
  .pipe(
    SchemaUtils.withCodecStatics(["decodeUnknownEffect", "decodeUnknownExit", "decodeUnknownResult"]),
    $I.annoteSchema("TSConfigSemantic", {
      description: "Strict tsconfig shape with cross-field semantic checks used by the decode helpers.",
    })
  );

const decodeJsoncUnknownText = (input: string): Effect.Effect<unknown, S.SchemaError> => {
  const exit = JsoncTextToUnknown.decodeUnknownExit(input);

  if (Exit.isSuccess(exit)) {
    return Effect.succeed(exit.value);
  }

  return Cause.findErrorOption(exit.cause).pipe(
    O.map(Effect.fail),
    O.getOrElse(() => pipe(exit.cause, Cause.squash, Effect.die))
  );
};

const encodeTSConfigUnknownEffect = S.encodeUnknownEffect(TSConfig);
const encodeTSConfigJsonStringEffect = S.encodeUnknownEffect(S.fromJsonString(TSConfig));

/**
 * Synchronously decode an unknown value into a strict `TSConfig`.
 * Throws a `SchemaError` if validation fails.
 *
 * **Example** (Decode TSConfig synchronously)
 *
 * ```ts
 * import { decodeTSConfig } from "@beep/repo-utils/schemas/TSConfig"
 * const config = decodeTSConfig({ compilerOptions: { strict: true } })
 * console.log(config)
 * ```
 *
 * @param input - Unknown tsconfig-shaped value to validate and decode.
 * @returns Decoded strict `TSConfig` value.
 * @category validation
 * @since 0.0.0
 */
export const decodeTSConfig = (input: unknown): TSConfig.Type => Result.getOrThrow(TSConfig.decodeStrictResult(input));

/**
 * Synchronously decode an unknown value into a strict `TSConfig`,
 * returning an `Exit` instead of throwing.
 *
 * **Example** (Decode TSConfig Exit)
 *
 * ```ts
 * import { decodeTSConfigExit } from "@beep/repo-utils/schemas/TSConfig"
 * const exit = decodeTSConfigExit({ compilerOptions: { strict: true } })
 * console.log(exit)
 * ```
 *
 * @param input - Unknown tsconfig-shaped value to validate and decode.
 * @returns Exit describing either the decoded tsconfig or the schema failure.
 * @category validation
 * @since 0.0.0
 */
export const decodeTSConfigExit: (input: unknown) => Exit.Exit<TSConfig.Type, S.SchemaError> = (input) =>
  TSConfig.decodeStrictExit(input);

/**
 * Decode an unknown value into a strict `TSConfig` as an Effect.
 *
 * **Details**
 *
 * Semantic decoding keeps the SchemaStore-compatible shape while normalizing
 * loose JSON records into the schema-backed `TSConfig` model. Unknown compiler
 * option keys are rejected.
 *
 * **Example** (Decode TSConfig Effect)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 * import { decodeTSConfigEffect } from "@beep/repo-utils/schemas/TSConfig"
 * const config = Effect.runSync(
 *   decodeTSConfigEffect({ compilerOptions: { strict: true, noEmit: true } })
 * )
 * const strict = config.compilerOptions.pipe(
 *   O.flatMap((options) => options.strict),
 *   O.getOrElse(() => false)
 * )
 * console.log(strict) // true
 * ```
 *
 * @param input - Unknown value decoded against the strict `TSConfig` schema.
 * @returns An Effect that succeeds with the decoded `TSConfig` or fails with `S.SchemaError`.
 * @effects
 * Runs strict Effect Schema decoding and semantic normalization into
 * `TSConfig`; failures are reported as `S.SchemaError`.
 * @category validation
 * @since 0.0.0
 */
export const decodeTSConfigEffect: (input: unknown) => Effect.Effect<TSConfig.Type, S.SchemaError> = (input) =>
  TSConfig.decodeStrictEffect(input);

/**
 * Decode JSONC text into a strict `TSConfig`.
 *
 * **Details**
 *
 * Supports comments and trailing commas through `@beep/schema/Jsonc`.
 * Encoding remains JSON-only and does not preserve comments.
 *
 * **Example** (Decode JSONC with comments)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 * import { decodeTSConfigFromJsoncTextEffect } from "@beep/repo-utils/schemas/TSConfig"
 * const config = Effect.runSync(decodeTSConfigFromJsoncTextEffect(`{
 *   // Typecheck only
 *   "compilerOptions": { "noEmit": true }
 * }`))
 * const noEmit = config.compilerOptions.pipe(
 *   O.flatMap((options) => options.noEmit),
 *   O.getOrElse(() => false)
 * )
 * console.log(noEmit) // true
 * ```
 *
 * @effects
 * Parses JSONC text through `@beep/schema/Jsonc`, then runs the same strict
 * tsconfig schema decode; parse and validation failures are `S.SchemaError`s.
 * @category validation
 * @since 0.0.0
 */
export const decodeTSConfigFromJsoncTextEffect: (input: string) => Effect.Effect<TSConfig.Type, S.SchemaError> =
  TSConfig.decodeJsoncTextEffect;

/**
 * Encode a strict `TSConfig` value back to its encoded form as an Effect.
 *
 * **Details**
 *
 * The input is first decoded with strict excess-property rejection so callers
 * do not accidentally encode malformed tsconfig objects.
 *
 * **Example** (Encode validated TSConfig)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { encodeTSConfigEffect } from "@beep/repo-utils/schemas/TSConfig"
 * const encoded = Effect.runSync(
 *   encodeTSConfigEffect({ compilerOptions: { strict: true, moduleResolution: "bundler" } })
 * )
 * console.log(encoded.compilerOptions?.moduleResolution) // "bundler"
 * ```
 *
 * @effects
 * Decodes the input with strict tsconfig validation before encoding it back to
 * the schema's external representation; failures are reported as
 * `S.SchemaError`.
 * @category validation
 * @since 0.0.0
 */
export const encodeTSConfigEffect: (input: unknown) => Effect.Effect<TSConfig.Encoded, S.SchemaError> =
  TSConfig.encodeStrictEffect;

/**
 * Encode a strict `TSConfig` value to a compact JSON string as an Effect.
 *
 * **Example** (Encode compact JSON Effect)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { encodeTSConfigToJsonEffect } from "@beep/repo-utils/schemas/TSConfig"
 * const json = Effect.runSync(
 *   encodeTSConfigToJsonEffect({ compilerOptions: { strict: true } })
 * )
 * console.log(json.includes("\"strict\":true")) // true
 * ```
 *
 * @effects
 * Validates the tsconfig value and serializes the encoded representation
 * through the schema JSON-string encoder; failures are `S.SchemaError`s.
 * @category validation
 * @since 0.0.0
 */
export const encodeTSConfigToJsonEffect: (input: unknown) => Effect.Effect<string, S.SchemaError> =
  TSConfig.encodeJsonStringEffect;

/**
 * Encode a strict `TSConfig` value to a pretty-printed JSON string.
 *
 * **Details**
 *
 * Pretty printing validates first, then formats the encoded shape with the
 * shared repo JSON renderer. Comments from JSONC input are not preserved.
 *
 * **Example** (Encode pretty-printed JSON)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { encodeTSConfigPrettyEffect } from "@beep/repo-utils/schemas/TSConfig"
 * const pretty = Effect.runSync(
 *   encodeTSConfigPrettyEffect({ compilerOptions: { strict: true } })
 * )
 * console.log(pretty.includes("\n")) // true
 * ```
 *
 * @effects
 * Validates and encodes the tsconfig value, then pretty-prints the JSON
 * payload; formatting failures surface as `DomainError`.
 * @category validation
 * @since 0.0.0
 */
export const encodeTSConfigPrettyEffect: (input: unknown) => Effect.Effect<string, S.SchemaError | DomainError> =
  Effect.fn("RepoUtils.TSConfig.encodePretty")(function* (input) {
    const validated = yield* encodeTSConfigEffect(input);
    return yield* jsonStringifyPretty(validated);
  });
