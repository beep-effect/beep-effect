/**
 * Internal YAML runtime helpers.
 *
 * @since 0.0.0
 */
import { A, thunkEmptyRecord } from "@beep/utils";
import { pipe, Result } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as YamlPackage from "yaml";

type BunYamlRuntime = {
  readonly YAML: {
    readonly parse: (input: string) => unknown;
  };
};

type YamlRuntime = {
  readonly Bun?: BunYamlRuntime;
};

type YamlModule = typeof YamlPackage;

/**
 * Public schema module export.
 *
 * @category type-level
 * @since 0.0.0
 */
export type YamlParseResult = Result.Result<unknown, ReadonlyArray<string>>;

type YamlModuleLoader = () => YamlModule;

/**
 * Parses a YAML document into an untyped value.
 *
 * Named (rather than spelled inline) so the pipeable-signature analysis can
 * relate the data-first and data-last returns of {@link makeParseYaml}.
 */
export type YamlParser = (input: string) => unknown;

/**
 * Parses a YAML document into a `Result` carrying the document's errors.
 */
type YamlSchemaParser = (input: string) => YamlParseResult;

/**
 * Public schema module export.
 *
 * @category schemas
 * @since 0.0.0
 */
export const loadYamlModule = (): YamlModule => YamlPackage;

const yamlDocumentToResult = (document: {
  readonly errors: ReadonlyArray<{ readonly message: string }>;
  toJSON: () => unknown;
}): YamlParseResult =>
  A.match(document.errors, {
    onEmpty: () => Result.succeed(document.toJSON()),
    onNonEmpty: (errors) => Result.fail(A.map(errors, ({ message }) => message)),
  });

const getBunRuntime = (runtime: YamlRuntime): O.Option<BunYamlRuntime> => O.fromNullishOr(runtime.Bun);

const getBunYamlParse = (input: unknown): O.Option<(input: string) => unknown> =>
  pipe(
    O.fromNullishOr(input),
    O.filter(P.isObject),
    O.flatMap((value) => (P.hasProperty(value, "Bun") ? O.fromNullishOr(value.Bun) : O.none())),
    O.filter(P.isObject),
    O.flatMap((value) => (P.hasProperty(value, "YAML") ? O.fromNullishOr(value.YAML) : O.none())),
    O.filter(P.isObject),
    O.flatMap((value) =>
      P.hasProperty(value, "parse")
        ? (() => {
            const parse = value.parse;

            return P.isFunction(parse) ? O.some((input: string) => parse(input)) : O.none();
          })()
        : O.none()
    )
  );

const makeBunYamlParse = (parse: (input: string) => unknown) => ({
  Bun: {
    YAML: {
      parse,
    },
  },
});

/**
 * Public schema module export.
 *
 * @category schemas
 * @since 0.0.0
 */
export const getGlobalYamlRuntime = (): YamlRuntime =>
  getBunYamlParse(globalThis).pipe(O.map(makeBunYamlParse), O.getOrElse(thunkEmptyRecord));

/**
 * Public schema module export.
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeParseYaml: {
  (loadYaml: YamlModuleLoader): (runtime: YamlRuntime) => YamlParser;
  (runtime: YamlRuntime, loadYaml: YamlModuleLoader): YamlParser;
} = dual(
  2,
  (runtime: YamlRuntime, loadYaml: YamlModuleLoader): YamlParser =>
    (input: string): unknown =>
      getBunRuntime(runtime).pipe(
        O.map(({ YAML }) => YAML.parse(input)),
        O.getOrElse(() => loadYaml().parse(input))
      )
);

/**
 * Public schema module export.
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeParseYamlForSchema: {
  (loadYaml: YamlModuleLoader): (runtime: YamlRuntime) => YamlSchemaParser;
  (runtime: YamlRuntime, loadYaml: YamlModuleLoader): YamlSchemaParser;
} = dual(
  2,
  (runtime: YamlRuntime, loadYaml: YamlModuleLoader): YamlSchemaParser =>
    (input: string): YamlParseResult =>
      getBunRuntime(runtime).pipe(
        O.match({
          onNone: () => yamlDocumentToResult(loadYaml().parseDocument(input)),
          onSome: ({ YAML }) => Result.succeed(YAML.parse(input)),
        })
      )
);
