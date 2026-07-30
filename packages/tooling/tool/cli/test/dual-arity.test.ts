import { DualArityRulesOptions, runDualArityRules } from "@beep/repo-cli/test/Laws";
import { FsUtilsLive } from "@beep/repo-utils";
import { TSMorphServiceLive } from "@beep/repo-utils/TSMorph/index";
import { A, Str } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { expect, layer } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path } from "effect";

const PlatformLayer = NodeServices.layer;
const testLayer = Layer.mergeAll(FsUtilsLive, TSMorphServiceLive).pipe(Layer.provideMerge(PlatformLayer));

const withTempWorkingDirectory = <A, E, R>(use: Effect.Effect<A, E, R>) =>
  Effect.acquireUseRelease(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const tmpDir = yield* fs.makeTempDirectory();
      const previousCwd = process.cwd();
      process.chdir(tmpDir);
      return { fs, previousCwd, tmpDir } as const;
    }),
    () => use,
    ({ fs, previousCwd, tmpDir }) =>
      Effect.gen(function* () {
        process.chdir(previousCwd);
        yield* fs.remove(tmpDir, { recursive: true });
      })
  );

const writeProjectFile = Effect.fn(function* (relativePath: string, content: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const absolutePath = path.join(process.cwd(), relativePath);
  const directoryPath = path.dirname(absolutePath);

  yield* fs.makeDirectory(directoryPath, { recursive: true });
  yield* fs.writeFileString(absolutePath, content);
});

const readProjectFile = Effect.fn(function* (relativePath: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  return yield* fs.readFileString(path.join(process.cwd(), relativePath));
});

const writeProjectScaffold = Effect.gen(function* () {
  yield* writeProjectFile("bun.lock", "");
  yield* writeProjectFile(
    "tsconfig.json",
    A.join(
      [
        "{",
        '  "compilerOptions": {',
        '    "target": "ES2022",',
        '    "module": "ESNext",',
        '    "moduleResolution": "Bundler",',
        '    "strict": true,',
        '    "skipLibCheck": true',
        "  },",
        '  "include": ["packages/**/*.ts", "packages/**/*.tsx"]',
        "}",
        "",
      ],
      "\n"
    )
  );
});

const runLaw = (
  options: Partial<{
    readonly write: boolean;
    readonly strictCheck: boolean;
    readonly excludePaths: ReadonlyArray<string>;
  }> = {}
) =>
  runDualArityRules(
    DualArityRulesOptions.make({
      write: options.write ?? false,
      strictCheck: options.strictCheck ?? true,
      excludePaths: options.excludePaths ?? [],
    })
  );

layer(testLayer)("dual arity laws", (it) => {
  it.effect("ignores valid direct dual helpers and tracks exported helpers missing dual", () =>
    withTempWorkingDirectory(
      Effect.gen(function* () {
        yield* writeProjectScaffold;
        yield* writeProjectFile(
          "packages/demo/src/index.ts",
          A.join(
            [
              'import { dual } from "effect/Function";',
              "",
              "export const ok: {",
              "  (self: string, label: string): string",
              "  (label: string): (self: string) => string",
              "} = dual(2, (self: string, label: string): string => `${self}:${label}`);",
              "",
              "export function missing(self: string, label: string): string {",
              "  return `${self}:${label}`;",
              "}",
              "",
            ],
            "\n"
          )
        );

        const summary = yield* runLaw();

        expect(summary.liveEntries).toBe(1);
        expect(summary.missingEntries).toBe(1);
        expect(summary.strictFailure).toBe(true);
        expect(summary.diagnostics[0]).toContain("missing");
        expect(summary.diagnostics[0]).toContain("missing-dual");
      })
    )
  );

  it.effect("accepts namespace dual imports from effect/Function", () =>
    withTempWorkingDirectory(
      Effect.gen(function* () {
        yield* writeProjectScaffold;
        yield* writeProjectFile(
          "packages/demo/src/index.ts",
          A.join(
            [
              'import * as Fn from "effect/Function";',
              "",
              "export const ok: {",
              "  (self: string, label: string): string",
              "  (label: string): (self: string) => string",
              "} = Fn.dual(2, (self: string, label: string): string => `${self}:${label}`);",
              "",
            ],
            "\n"
          )
        );

        const summary = yield* runLaw();

        expect(summary.liveEntries).toBe(0);
        expect(summary.strictFailure).toBe(false);
      })
    )
  );

  it.effect("ignores rich callable object aliases while tracking factory-returned helpers", () =>
    withTempWorkingDirectory(
      Effect.gen(function* () {
        yield* writeProjectScaffold;
        yield* writeProjectFile(
          "packages/demo/src/index.ts",
          A.join(
            [
              "interface IdentityLike {",
              "  (strings: TemplateStringsArray, ...values: ReadonlyArray<unknown>): string",
              "  readonly identifier: string",
              "  make(segment: string): string",
              "}",
              "",
              "declare const identityLike: IdentityLike;",
              "const makeHelper = () => (self: string, label: string): string => `${self}:${label}`;",
              "",
              "export const composer = identityLike;",
              "export const factoryReturned = makeHelper();",
              "",
            ],
            "\n"
          )
        );

        const summary = yield* runLaw();
        const diagnostics = A.join(summary.diagnostics, "\n");

        expect(summary.liveEntries).toBe(1);
        expect(diagnostics).not.toContain("composer");
        expect(diagnostics).toContain("factoryReturned");
        expect(diagnostics).toContain("missing-dual");
      })
    )
  );

  it.effect("ignores exported callable values from schema codecs and Order constructors", () =>
    withTempWorkingDirectory(
      Effect.gen(function* () {
        yield* writeProjectScaffold;
        yield* writeProjectFile(
          "packages/demo/src/index.ts",
          A.join(
            [
              'import * as Order from "effect/Order";',
              'import * as S from "effect/Schema";',
              "",
              "export const decodeName = S.decodeUnknownOption(S.String);",
              "export const encodeName = S.encodeUnknownResult(S.String);",
              "export const NameEquivalence = S.toEquivalence(S.String);",
              "export const ByName: Order.Order<{ readonly name: string }> = Order.mapInput(",
              "  Order.String,",
              "  (value: { readonly name: string }) => value.name",
              ");",
              "",
              "export const helper = (self: string, label: string): string => `${self}:${label}`;",
              "",
            ],
            "\n"
          )
        );

        const summary = yield* runLaw();
        const diagnostics = A.join(summary.diagnostics, "\n");

        expect(summary.liveEntries).toBe(1);
        expect(diagnostics).toContain("helper");
        expect(diagnostics).not.toContain("decodeName");
        expect(diagnostics).not.toContain("encodeName");
        expect(diagnostics).not.toContain("NameEquivalence");
        expect(diagnostics).not.toContain("ByName");
      })
    )
  );

  it.effect("ignores non-helper static callable values while tracking required static function properties", () =>
    withTempWorkingDirectory(
      Effect.gen(function* () {
        yield* writeProjectScaffold;
        yield* writeProjectFile(
          "packages/demo/src/index.ts",
          A.join(
            [
              "declare const S: {",
              "  readonly decodeUnknownEffect: (",
              "    schema: string",
              "  ) => (input: unknown, options?: { readonly strict: boolean }) => string",
              "};",
              "declare const SchemaUtils: {",
              "  readonly toEquivalence: <A>(schema: A) => {",
              "    (self: A, that: A): boolean",
              "    (that: A): (self: A) => boolean",
              "  }",
              "};",
              "declare const makeOptional: () => (",
              "  input: unknown,",
              "  options?: { readonly strict: boolean }",
              ") => string;",
              "",
              "export class Codec {",
              '  static readonly decodeEffect = S.decodeUnknownEffect("schema");',
              '  static readonly equivalence = SchemaUtils.toEquivalence("schema");',
              "}",
              "",
              "export class Optional {",
              "  static readonly parse = makeOptional();",
              "}",
              "",
              "export class Plain {",
              "  static readonly combine: (a: string, b: string) => string = (a: string, b: string): string =>",
              "    `${a}:${b}`;",
              "}",
              "",
            ],
            "\n"
          )
        );

        const summary = yield* runLaw();
        const diagnostics = A.join(summary.diagnostics, "\n");

        expect(summary.liveEntries).toBe(1);
        expect(diagnostics).not.toContain("Codec.decodeEffect");
        expect(diagnostics).not.toContain("Codec.equivalence");
        expect(diagnostics).not.toContain("Optional.parse");
        expect(diagnostics).toContain("Plain.combine");
        expect(diagnostics).toContain("missing-dual");
      })
    )
  );

  it.effect("defers optional-trailing and variadic public shapes", () =>
    withTempWorkingDirectory(
      Effect.gen(function* () {
        yield* writeProjectScaffold;
        yield* writeProjectFile(
          "packages/demo/src/index.ts",
          A.join(
            [
              "export function variadic(first: string, ...rest: ReadonlyArray<string>): string;",
              "export function variadic(values: ReadonlyArray<string>): string;",
              "export function variadic(firstOrValues: string | ReadonlyArray<string>, ...rest: ReadonlyArray<string>): string {",
              "  return Array.isArray(firstOrValues) ? firstOrValues.join(':') : [firstOrValues, ...rest].join(':');",
              "}",
              "",
              "export function optionalFactory(schema: string, error?: string): string {",
              "  return error === undefined ? schema : `${schema}:${error}`;",
              "}",
              "",
              "export const variadicConst = (first: string, ...rest: ReadonlyArray<string>): string =>",
              "  [first, ...rest].join(':');",
              "",
              "export const helper = (self: string, label: string): string => `${self}:${label}`;",
              "",
            ],
            "\n"
          )
        );

        const summary = yield* runLaw();
        const diagnostics = A.join(summary.diagnostics, "\n");

        expect(summary.liveEntries).toBe(1);
        expect(diagnostics).toContain("helper");
        expect(diagnostics).not.toContain("variadic");
        expect(diagnostics).not.toContain("optionalFactory");
        expect(diagnostics).not.toContain("variadicConst");
      })
    )
  );

  it.effect("rejects dual re-exports and mismatched dual arity", () =>
    withTempWorkingDirectory(
      Effect.gen(function* () {
        yield* writeProjectScaffold;
        yield* writeProjectFile(
          "packages/demo/src/index.ts",
          A.join(
            [
              'import { dual } from "@beep/utils/Function";',
              'import { dual as effectDual } from "effect/Function";',
              "",
              "export const wrongSource: {",
              "  (self: string, label: string): string",
              "  (label: string): (self: string) => string",
              "} = dual(2, (self: string, label: string): string => `${self}:${label}`);",
              "",
              "export const wrongArity: {",
              "  (self: string, label: string): string",
              "  (label: string): (self: string) => string",
              "} = effectDual(3, (self: string, label: string): string => `${self}:${label}`);",
              "",
            ],
            "\n"
          )
        );

        const summary = yield* runLaw();
        const diagnostics = A.join(summary.diagnostics, "\n");

        expect(summary.liveEntries).toBe(2);
        expect(diagnostics).toContain("invalid-dual-source");
        expect(diagnostics).toContain("invalid-dual-arity");
      })
    )
  );

  it.effect("accepts predicate dual when public overloads prove both call shapes", () =>
    withTempWorkingDirectory(
      Effect.gen(function* () {
        yield* writeProjectScaffold;
        yield* writeProjectFile(
          "packages/demo/src/index.ts",
          A.join(
            [
              'import { dual } from "effect/Function";',
              "",
              "export const ok: {",
              "  (self: string, label: string): string",
              "  (label: string): (self: string) => string",
              "} = dual(",
              "  (args) => args.length === 2,",
              "  (self: string, label: string): string => `${self}:${label}`",
              ");",
              "",
              "export const missingShape: (self: string, label: string) => string = dual(",
              "  (args) => args.length === 2,",
              "  (self: string, label: string): string => `${self}:${label}`",
              ");",
              "",
            ],
            "\n"
          )
        );

        const summary = yield* runLaw();
        const diagnostics = A.join(summary.diagnostics, "\n");

        expect(summary.liveEntries).toBe(1);
        expect(diagnostics).not.toContain("ok");
        expect(diagnostics).toContain("missingShape");
        expect(diagnostics).toContain("invalid-dual-arity");
      })
    )
  );

  it.effect("requires explicit data-first and data-last public signatures", () =>
    withTempWorkingDirectory(
      Effect.gen(function* () {
        yield* writeProjectScaffold;
        yield* writeProjectFile(
          "packages/demo/src/index.ts",
          A.join(
            [
              'import { dual } from "effect/Function";',
              "",
              "export const missingDataLast: (self: string, label: string) => string = dual(",
              "  2,",
              "  (self: string, label: string): string => `${self}:${label}`",
              ");",
              "",
              "export const ok: {",
              "  (self: string, label: string): string",
              "  (label: string): (self: string) => string",
              "} = dual(2, (self: string, label: string): string => `${self}:${label}`);",
              "",
            ],
            "\n"
          )
        );

        const summary = yield* runLaw();
        const diagnostics = A.join(summary.diagnostics, "\n");

        expect(summary.liveEntries).toBe(1);
        expect(diagnostics).toContain("missingDataLast");
        expect(diagnostics).toContain("missing-dual-signatures");
      })
    )
  );

  it.effect("requires ObjectLike third parameters and accepts named object shapes", () =>
    withTempWorkingDirectory(
      Effect.gen(function* () {
        yield* writeProjectScaffold;
        yield* writeProjectFile(
          "packages/demo/src/index.ts",
          A.join(
            [
              'import { Effect } from "effect";',
              'import { dual } from "effect/Function";',
              'import * as S from "effect/Schema";',
              "",
              "interface InterfaceOptions { readonly strict: boolean }",
              "class ClassOptions { readonly strict = true }",
              "type RecordOptions = Record<string, string>;",
              "type EffectOptions = Effect.Effect<void>;",
              "type SchemaOptions = S.Schema<string>;",
              "",
              "export const inlineOk: {",
              "  (self: string, label: string, options: { readonly strict: boolean }): string",
              "  (label: string, options: { readonly strict: boolean }): (self: string) => string",
              "} = dual(3, (self: string, label: string, options: { readonly strict: boolean }): string =>",
              "  options.strict ? `${self}:${label}` : self",
              ");",
              "",
              "export const interfaceOk: {",
              "  (self: string, label: string, options: InterfaceOptions): string",
              "  (label: string, options: InterfaceOptions): (self: string) => string",
              "} = dual(3, (self: string, label: string, options: InterfaceOptions): string =>",
              "  options.strict ? `${self}:${label}` : self",
              ");",
              "",
              "export const classOk: {",
              "  (self: string, label: string, options: ClassOptions): string",
              "  (label: string, options: ClassOptions): (self: string) => string",
              "} = dual(3, (self: string, label: string, options: ClassOptions): string =>",
              "  options.strict ? `${self}:${label}` : self",
              ");",
              "",
              "export const recordOk: {",
              "  (self: string, label: string, options: RecordOptions): string",
              "  (label: string, options: RecordOptions): (self: string) => string",
              "} = dual(3, (self: string, label: string, options: RecordOptions): string =>",
              '  options["mode"] ?? `${self}:${label}`',
              ");",
              "",
              "export const constrainedGenericOk: {",
              "  <Options extends { readonly strict: boolean }>(self: string, label: string, options: Options): string",
              "  <Options extends { readonly strict: boolean }>(label: string, options: Options): (self: string) => string",
              "} = dual(3, <Options extends { readonly strict: boolean }>(",
              "  self: string,",
              "  label: string,",
              "  options: Options",
              "): string => (options.strict ? `${self}:${label}` : self));",
              "",
              "export const arrayBad: {",
              "  (self: string, label: string, options: ReadonlyArray<string>): string",
              "  (label: string, options: ReadonlyArray<string>): (self: string) => string",
              "} = dual(3, (self: string, label: string, options: ReadonlyArray<string>): string => `${self}:${label}:${options.length}`);",
              "",
              "export const tupleBad: {",
              "  (self: string, label: string, options: readonly [string, string]): string",
              "  (label: string, options: readonly [string, string]): (self: string) => string",
              "} = dual(3, (self: string, label: string, options: readonly [string, string]): string => `${self}:${label}:${options[0]}`);",
              "",
              "export const functionCallableOk: {",
              "  (self: string, label: string, options: () => string): string",
              "  (label: string, options: () => string): (self: string) => string",
              "} = dual(3, (self: string, label: string, options: () => string): string => `${self}:${label}:${options()}`);",
              "",
              "export const stringBad: {",
              "  (self: string, label: string, options: string): string",
              "  (label: string, options: string): (self: string) => string",
              "} = dual(3, (self: string, label: string, options: string): string => `${self}:${label}:${options}`);",
              "",
              "export function nonDualFunctionThirdParam(",
              "  self: string,",
              "  label: string,",
              "  transform: (value: string) => string",
              "): string {",
              "  return transform(`${self}:${label}`);",
              "}",
              "",
              "export const effectBad: {",
              "  (self: string, label: string, options: EffectOptions): string",
              "  (label: string, options: EffectOptions): (self: string) => string",
              "} = dual(3, (self: string, label: string, _options: EffectOptions): string => `${self}:${label}`);",
              "",
              "export const schemaBad: {",
              "  (self: string, label: string, options: SchemaOptions): string",
              "  (label: string, options: SchemaOptions): (self: string) => string",
              "} = dual(3, (self: string, label: string, _options: SchemaOptions): string => `${self}:${label}`);",
              "",
              "export const promiseBad: {",
              "  (self: string, label: string, options: Promise<string>): string",
              "  (label: string, options: Promise<string>): (self: string) => string",
              "} = dual(3, (self: string, label: string, _options: Promise<string>): string => `${self}:${label}`);",
              "",
              "export const anyBad: {",
              "  (self: string, label: string, options: any): string",
              "  (label: string, options: any): (self: string) => string",
              "} = dual(3, (self: string, label: string, _options: any): string => `${self}:${label}`);",
              "",
              "export const unknownBad: {",
              "  (self: string, label: string, options: unknown): string",
              "  (label: string, options: unknown): (self: string) => string",
              "} = dual(3, (self: string, label: string, _options: unknown): string => `${self}:${label}`);",
              "",
              "export const unconstrainedGenericBad: {",
              "  <Options>(self: string, label: string, options: Options): string",
              "  <Options>(label: string, options: Options): (self: string) => string",
              "} = dual(3, <Options>(self: string, label: string, _options: Options): string => `${self}:${label}`);",
              "",
            ],
            "\n"
          )
        );

        const summary = yield* runLaw();
        const diagnostics = A.join(summary.diagnostics, "\n");

        expect(summary.liveEntries).toBe(10);
        expect(diagnostics).toContain("arrayBad");
        expect(diagnostics).toContain("tupleBad");
        expect(diagnostics).toContain("stringBad");
        expect(diagnostics).toContain("nonDualFunctionThirdParam");
        expect(diagnostics).toContain("missing-dual");
        expect(diagnostics).toContain("effectBad");
        expect(diagnostics).toContain("schemaBad");
        expect(diagnostics).toContain("promiseBad");
        expect(diagnostics).toContain("anyBad");
        expect(diagnostics).toContain("unknownBad");
        expect(diagnostics).toContain("unconstrainedGenericBad");
        expect(diagnostics).toContain("third-param-not-object-like");
        expect(diagnostics).not.toContain("inlineOk");
        expect(diagnostics).not.toContain("interfaceOk");
        expect(diagnostics).not.toContain("classOk");
        expect(diagnostics).not.toContain("recordOk");
        expect(diagnostics).not.toContain("constrainedGenericOk");
        expect(diagnostics).not.toContain("functionCallableOk");
      })
    )
  );

  it.effect("flags too many positional parameters and obvious wrong first parameters", () =>
    withTempWorkingDirectory(
      Effect.gen(function* () {
        yield* writeProjectScaffold;
        yield* writeProjectFile(
          "packages/demo/src/index.ts",
          A.join(
            [
              'import { Effect } from "effect";',
              'import { dual } from "effect/Function";',
              "",
              "export function tooMany(self: string, label: string, mode: string, strict: boolean): string {",
              "  return `${self}:${label}:${mode}:${strict}`;",
              "}",
              "",
              "export const wrongFirst: {",
              "  (message: string, effect: Effect.Effect<string>): Effect.Effect<string>",
              "  (effect: Effect.Effect<string>): (message: string) => Effect.Effect<string>",
              "} = dual(2, (message: string, effect: Effect.Effect<string>): Effect.Effect<string> => effect);",
              "",
            ],
            "\n"
          )
        );

        const summary = yield* runLaw();
        const diagnostics = A.join(summary.diagnostics, "\n");

        expect(summary.liveEntries).toBe(2);
        expect(diagnostics).toContain("tooMany");
        expect(diagnostics).toContain("too-many-positional-params");
        expect(diagnostics).toContain("wrongFirst");
        expect(diagnostics).toContain("obvious-wrong-first-parameter");
      })
    )
  );

  it.effect("tracks manual overloads and static class helpers while excluding hooks and components", () =>
    withTempWorkingDirectory(
      Effect.gen(function* () {
        yield* writeProjectScaffold;
        yield* writeProjectFile(
          "packages/demo/src/index.tsx",
          A.join(
            [
              'import { dual } from "effect/Function";',
              "",
              "export function manual(self: string, label: string): string;",
              "export function manual(label: string): (self: string) => string;",
              "export function manual(first: string, second?: string): string | ((self: string) => string) {",
              "  return second === undefined ? (self: string) => `${self}:${first}` : `${first}:${second}`;",
              "}",
              "",
              "export class DomainError {",
              "  static readonly ok: {",
              "    (self: string, label: string): string",
              "    (label: string): (self: string) => string",
              "  } = dual(2, (self: string, label: string): string => `${self}:${label}`);",
              "",
              "  static missing(self: string, label: string): string {",
              "    return `${self}:${label}`;",
              "  }",
              "}",
              "",
              "export const useThing = (self: string, label: string): string => `${self}:${label}`;",
              "export const Component = (props: { readonly value: string }, label: string): string => `${props.value}:${label}`;",
              "",
            ],
            "\n"
          )
        );

        const summary = yield* runLaw();
        const diagnostics = A.join(summary.diagnostics, "\n");

        expect(summary.liveEntries).toBe(2);
        expect(diagnostics).toContain("manual");
        expect(diagnostics).toContain("DomainError.missing");
        expect(diagnostics).not.toContain("useThing");
        expect(diagnostics).not.toContain("Component");
      })
    )
  );

  it.effect("refreshes inventory and fails when tracked candidates move into enforced roots", () =>
    withTempWorkingDirectory(
      Effect.gen(function* () {
        yield* writeProjectScaffold;
        yield* writeProjectFile(
          "packages/demo/src/index.ts",
          A.join(
            ["export function missing(self: string, label: string): string {", "  return `${self}:${label}`;", "}", ""],
            "\n"
          )
        );

        const writeSummary = yield* runLaw({ write: true, strictCheck: false });
        const inventory = yield* readProjectFile("standards/dual-arity.inventory.jsonc");
        const enforcedInventory = Str.replace(
          '"packages/tooling/tool/cli/src/commands/Laws/DualArity.ts"',
          '"packages/demo/src"'
        )(inventory);
        yield* writeProjectFile("standards/dual-arity.inventory.jsonc", enforcedInventory);

        const checkSummary = yield* runLaw();

        expect(writeSummary.wroteInventory).toBe(true);
        expect(writeSummary.strictFailure).toBe(false);
        expect(checkSummary.missingEntries).toBe(0);
        expect(checkSummary.enforcedCandidates).toBe(1);
        expect(checkSummary.strictFailure).toBe(true);
      })
    )
  );

  it.effect("detects stale inventory entries and validates exception metadata", () =>
    withTempWorkingDirectory(
      Effect.gen(function* () {
        yield* writeProjectScaffold;
        yield* writeProjectFile(
          "packages/demo/src/index.ts",
          A.join(
            ["export function missing(self: string, label: string): string {", "  return `${self}:${label}`;", "}", ""],
            "\n"
          )
        );

        yield* runLaw({ write: true, strictCheck: false });
        const inventory = yield* readProjectFile("standards/dual-arity.inventory.jsonc");
        const validExceptionInventory = Str.replace(
          '"reason": "Public 2-3 parameter helper APIs must be implemented with dual from effect/Function."',
          '"reason": "Kept as an explicit compatibility exception for the test fixture."'
        )(
          Str.replace(
            '"owner": "@beep/root"',
            '"owner": "@beep/repo-cli"'
          )(Str.replace('"status": "candidate"', '"status": "exception"')(inventory))
        );
        yield* writeProjectFile("standards/dual-arity.inventory.jsonc", validExceptionInventory);

        const validExceptionSummary = yield* runLaw();

        expect(validExceptionSummary.invalidExceptions).toBe(0);
        expect(validExceptionSummary.strictFailure).toBe(false);

        const invalidExceptionInventory = Str.replace(
          '"reason": "Kept as an explicit compatibility exception for the test fixture."',
          '"reason": ""'
        )(Str.replace('"owner": "@beep/repo-cli"', '"owner": ""')(validExceptionInventory));
        yield* writeProjectFile("standards/dual-arity.inventory.jsonc", invalidExceptionInventory);

        const invalidExceptionSummary = yield* runLaw();

        expect(invalidExceptionSummary.invalidExceptions).toBe(1);
        expect(invalidExceptionSummary.strictFailure).toBe(true);

        const staleInventory = Str.replace(
          '"reason": ""',
          '"reason": "Tracked stale fixture."'
        )(
          Str.replace(
            '"owner": ""',
            '"owner": "@beep/repo-cli"'
          )(Str.replace('"qualifiedName": "missing"', '"qualifiedName": "gone"')(invalidExceptionInventory))
        );
        yield* writeProjectFile("standards/dual-arity.inventory.jsonc", staleInventory);

        const staleSummary = yield* runLaw();

        expect(staleSummary.staleEntries).toBe(1);
        expect(staleSummary.missingEntries).toBe(1);
        expect(staleSummary.strictFailure).toBe(true);
        expect(A.join(staleSummary.diagnostics, "\n")).toContain("[stale]");
      })
    )
  );

  // R12: PERMANENT_EXCLUSIONS is an in-code, driver-verified hold — stronger
  // than a standards/dual-arity.inventory.jsonc exception record. scanChunk
  // is consumed BY REFERENCE as a Stream.mapAccum fold step
  // (AnthropicTurnKernel.ts:143); wrapping it with dual() breaks overload
  // resolution (ops/reports/P2-audits/p2-d5d8.md). A sibling 2-param export
  // NOT registered in PERMANENT_EXCLUSIONS must still fire.
  it.effect(
    "R12: permanently excludes the registered scanChunk fold-step while an unregistered sibling still fires",
    () =>
      withTempWorkingDirectory(
        Effect.gen(function* () {
          yield* writeProjectScaffold;
          yield* writeProjectFile(
            "packages/agents/server/src/AssistantTurn/ScanState.ts",
            A.join(
              [
                "export interface ScanState { readonly buffer: string }",
                "export const scanChunk = (state: ScanState, text: string): [ScanState, Array<string>] => {",
                "  return [state, [text]];",
                "};",
                "",
              ],
              "\n"
            )
          );
          yield* writeProjectFile(
            "packages/demo/src/index.ts",
            A.join(
              [
                "export function otherHelper(self: string, label: string): string {",
                "  return `${self}:${label}`;",
                "}",
                "",
              ],
              "\n"
            )
          );

          const summary = yield* runLaw();
          const diagnostics = A.join(summary.diagnostics, "\n");

          expect(diagnostics).not.toContain("scanChunk");
          expect(diagnostics).toContain("otherHelper");
          expect(summary.liveEntries).toBe(1);
        })
      )
  );

  // R12: isLegitimateConstructorFactory's failing conjunct was
  // isFactoryReturnType — its DIRECT_EFFECT_OR_SCHEMA_TYPE_PATTERN check
  // tests the full printed text of the return type, which for an
  // all-methods-record return type includes every method's own
  // `Effect.Effect<...>` signature text, so it rejected the shape before
  // ever reaching isStrictObjectLikeType. isAllMethodMembersObjectType now
  // accepts an object-like return whose every member resolves to a callable
  // type, checked via each property's own resolved type instead of the
  // return type's printed text.
  it.effect(
    "R12: silently excludes an all-methods-record @category constructors factory while the identical untagged shape still fires",
    () =>
      withTempWorkingDirectory(
        Effect.gen(function* () {
          yield* writeProjectScaffold;
          yield* writeProjectFile(
            "packages/demo/src/index.ts",
            A.join(
              [
                "interface Store { readonly id: string }",
                "interface Kernel { readonly id: string }",
                "interface Usage { readonly id: string }",
                "",
                "/**",
                " * @category constructors",
                " */",
                "export const makeTaggedOperations = (store: Store, kernel: Kernel, usage: Usage) => ({",
                "  listThreads: (workspaceId: string): string => workspaceId,",
                "  createThread: (name: string): string => name,",
                "  sendMessage: (body: string): string => body,",
                "});",
                "",
                "export const makeUntaggedOperations = (store: Store, kernel: Kernel, usage: Usage) => ({",
                "  listThreads: (workspaceId: string): string => workspaceId,",
                "  createThread: (name: string): string => name,",
                "  sendMessage: (body: string): string => body,",
                "});",
                "",
              ],
              "\n"
            )
          );

          const summary = yield* runLaw();
          const diagnostics = A.join(summary.diagnostics, "\n");

          expect(diagnostics).not.toContain("makeTaggedOperations");
          expect(diagnostics).toContain("makeUntaggedOperations");
          expect(diagnostics).toContain("missing-dual");
        })
      )
  );
});
