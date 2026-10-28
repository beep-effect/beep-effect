import {
  StrictCompilerOptions,
  StrictTsconfig,
  TsconfigValidationError,
  TsconfigValidator,
} from "@beep/repo-tsconfig/TsconfigValidator";
import { ClosedCompilerOptions, ClosedTsconfigJson } from "@beep/tsconfig";
import { assert, describe, it, layer } from "@effect/vitest";
import { assertInclude, assertInstanceOf, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as SchemaAST from "effect/SchemaAST";
import { fixtureLayer, tree } from "./support/fixtures.ts";

const propertyNames = (ast: SchemaAST.AST): ReadonlyArray<PropertyKey> =>
  SchemaAST.isObjects(ast) ? A.map(ast.propertySignatures, (signature) => signature.name) : [];

/** The strict failure's message, or the success marker, for one in-memory document. */
const verdict = (input: unknown) =>
  TsconfigValidator.validate(input).pipe(
    Effect.match({ onFailure: (error) => error.message, onSuccess: () => "accept" })
  );

const decodeJson = S.decodeEffect(S.fromJsonString(S.Unknown));

const rejects = Effect.fn("rejects")(function* (input: unknown, ...expected: ReadonlyArray<string>) {
  const error = yield* Effect.flip(TsconfigValidator.validate(input));
  assertInstanceOf(error, TsconfigValidationError);
  strictEqual(error.path, "");
  for (const fragment of expected) assertInclude(error.message, fragment);
});

describe("TsconfigValidator in memory", () => {
  it("builds on the @beep/tsconfig closed views: one key universe", () => {
    assert.deepStrictEqual(propertyNames(StrictCompilerOptions.ast), propertyNames(ClosedCompilerOptions.ast));
    assert.deepStrictEqual(propertyNames(StrictTsconfig.ast), propertyNames(ClosedTsconfigJson.ast));
    assert.deepStrictEqual(StrictCompilerOptions.fields, ClosedCompilerOptions.fields);
  });

  it.effect("accepts a minimal document and a realistic one, canonicalizing enums", () =>
    Effect.gen(function* () {
      assert.deepStrictEqual(yield* TsconfigValidator.validate({}), {});
      const document = yield* TsconfigValidator.validate({
        $schema: "https://json.schemastore.org/tsconfig",
        extends: "./tsconfig.base.json",
        files: ["src/index.ts"],
        include: ["src"],
        exclude: ["dist"],
        references: [{ path: "./packages/a" }, { path: "./packages/b" }],
        compileOnSave: false,
        compilerOptions: {
          module: "NodeNext",
          moduleResolution: "Bundler",
          target: "ES2022",
          lib: ["DOM", "ES2022"],
          allowImportingTsExtensions: true,
          noEmit: true,
          paths: { "@app/*": ["src/*"] },
          plugins: [{ name: "typescript-styled-plugin", tags: ["styled", "css"] }],
          types: ["node", "vitest"],
          jsx: "react-jsx",
          rewriteRelativeImportExtensions: true,
          verbatimModuleSyntax: true,
          allowJs: true,
          maxNodeModuleJsDepth: 2,
        },
        watchOptions: { watchFile: "UseFsEvents", excludeFiles: ["a"], excludeDirectories: ["b"] },
        typeAcquisition: { enable: true, include: ["vitest"], exclude: ["jest"] },
      });
      strictEqual(document.compilerOptions?.module, "nodenext");
      strictEqual(document.compilerOptions?.moduleResolution, "bundler");
      strictEqual(document.compilerOptions?.target, "es2022");
      assert.deepStrictEqual(document.compilerOptions?.lib, ["dom", "es2022"]);
      assert.deepStrictEqual(document.compilerOptions?.plugins, [
        { name: "typescript-styled-plugin", tags: ["styled", "css"] },
      ]);
      strictEqual(document.watchOptions?.watchFile, "usefsevents");
      assert.deepStrictEqual(document.references, [{ path: "./packages/a" }, { path: "./packages/b" }]);
      // Encoding gives the on-disk shape with the canonical spelling.
      const encoded = yield* S.encodeEffect(StrictTsconfig)(document);
      strictEqual(encoded.compilerOptions?.target, "es2022");
      assert.deepStrictEqual(encoded.files, ["src/index.ts"]);
    })
  );

  it.effect("accepts the TypeScript 7 targets and library additions through ES2025", () =>
    Effect.gen(function* () {
      const libraries = ["ES2016.Intl", "ES2023.Intl", "ES2025", "ES2025.Float16", "ESNext.Temporal"];
      const options = yield* TsconfigValidator.validateCompilerOptions({ lib: libraries, target: "ES2025" });
      strictEqual(options.target, "es2025");
      assert.deepStrictEqual(options.lib, [
        "es2016.intl",
        "es2023.intl",
        "es2025",
        "es2025.float16",
        "esnext.temporal",
      ]);
    })
  );

  it.effect("rejects unexpected keys at the top level and inside compilerOptions", () =>
    Effect.gen(function* () {
      yield* rejects({ unexpected: true }, "Unexpected key", '["unexpected"]');
      yield* rejects({ compilerOptions: { unexpected: true } }, "Unexpected key", '["compilerOptions"]["unexpected"]');
      yield* rejects({ references: [{ path: "./a", extra: 1 }] }, "Unexpected key", '["references"][0]["extra"]');
      yield* rejects({ watchOptions: { force: "x" } }, "Unexpected key", '["watchOptions"]["force"]');
      yield* rejects({ typeAcquisition: { bogus: true } }, "Unexpected key", '["typeAcquisition"]["bogus"]');
    })
  );

  it.effect("rejects prototype-polluting keys in paths aliases and plugin extras", () =>
    Effect.gen(function* () {
      yield* rejects(
        yield* decodeJson('{"compilerOptions":{"paths":{"__proto__":["./src"],"@x":["./x"]}}}'),
        'Key must not be "__proto__".',
        '["compilerOptions"]["paths"]["__proto__"]'
      );
      yield* rejects(
        yield* decodeJson('{"compilerOptions":{"plugins":[{"name":"p"},{"name":"q","__proto__":{"x":1}}]}}'),
        'Key must not be "__proto__".',
        '["compilerOptions"]["plugins"][1]["__proto__"]'
      );
    })
  );

  it.effect("rejects duplicate items in every unique list", () =>
    Effect.gen(function* () {
      yield* rejects({ files: ["a", "a"] }, "Array items must be unique.", '["files"]');
      yield* rejects({ include: ["a", "a"] }, '["include"]');
      yield* rejects({ exclude: ["a", "a"] }, '["exclude"]');
      yield* rejects({ references: [{ path: "a" }, { path: "a" }] }, '["references"]');
      yield* rejects({ watchOptions: { excludeFiles: ["a", "a"] } }, '["watchOptions"]["excludeFiles"]');
      yield* rejects({ watchOptions: { excludeDirectories: ["a", "a"] } }, '["watchOptions"]["excludeDirectories"]');
      yield* rejects({ typeAcquisition: { include: ["a", "a"] } }, '["typeAcquisition"]["include"]');
      yield* rejects({ typeAcquisition: { exclude: ["a", "a"] } }, '["typeAcquisition"]["exclude"]');
      yield* rejects({ compilerOptions: { lib: ["DOM", "dom"] } }, '["compilerOptions"]["lib"]');
      yield* rejects({ compilerOptions: { types: ["a", "a"] } }, '["compilerOptions"]["types"]');
      yield* rejects({ compilerOptions: { typeRoots: ["a", "a"] } }, '["compilerOptions"]["typeRoots"]');
      yield* rejects({ compilerOptions: { rootDirs: ["a", "a"] } }, '["compilerOptions"]["rootDirs"]');
      yield* rejects({ compilerOptions: { customConditions: ["a", "a"] } }, '["compilerOptions"]["customConditions"]');
      yield* rejects({ compilerOptions: { moduleSuffixes: ["a", "a"] } }, '["compilerOptions"]["moduleSuffixes"]');
      yield* rejects({ compilerOptions: { paths: { "@x": ["a", "a"] } } }, '["compilerOptions"]["paths"]["@x"]');
    })
  );

  it.effect("enforces allowImportingTsExtensions as tsc 7 does (TS5096)", () =>
    Effect.gen(function* () {
      yield* rejects(
        { compilerOptions: { allowImportingTsExtensions: true } },
        "allowImportingTsExtensions",
        "rewriteRelativeImportExtensions"
      );
      for (const enabler of ["noEmit", "emitDeclarationOnly", "rewriteRelativeImportExtensions"]) {
        strictEqual(
          yield* verdict({ compilerOptions: { allowImportingTsExtensions: true, [enabler]: true } }),
          "accept"
        );
      }
      // Inverted from the legacy repo-utils model, which also demanded moduleResolution=bundler; tsc
      // 7 does not (tsc-probe A in the 3-A6 parity note), so a nodenext noEmit config is accepted.
      strictEqual(
        yield* verdict({
          compilerOptions: { allowImportingTsExtensions: true, moduleResolution: "NodeNext", noEmit: true },
        }),
        "accept"
      );
    })
  );

  it.effect("enforces reactNamespace with jsx=react and maxNodeModuleJsDepth with allowJs", () =>
    Effect.gen(function* () {
      yield* rejects({ compilerOptions: { jsx: "react-jsx", reactNamespace: "React" } }, "reactNamespace", "jsx");
      strictEqual(yield* verdict({ compilerOptions: { jsx: "react", reactNamespace: "React" } }), "accept");
      yield* rejects({ compilerOptions: { maxNodeModuleJsDepth: 2 } }, "maxNodeModuleJsDepth", "allowJs");
      strictEqual(yield* verdict({ compilerOptions: { allowJs: true, maxNodeModuleJsDepth: 0 } }), "accept");
    })
  );

  it.effect("rejects negative and fractional maxNodeModuleJsDepth values", () =>
    Effect.gen(function* () {
      yield* rejects(
        { compilerOptions: { allowJs: true, maxNodeModuleJsDepth: -1 } },
        "Expected a non-negative integer.",
        '["compilerOptions"]["maxNodeModuleJsDepth"]'
      );
      yield* rejects({ compilerOptions: { allowJs: true, maxNodeModuleJsDepth: 1.5 } }, "non-negative integer");
    })
  );

  // Verdict shifts from the legacy repo-utils model (3-A6), each inverted here and classified by
  // goals/effected-promotion/ops/tsconfig-validator-parity.ts.
  describe("shifts from the legacy strict model", () => {
    it.effect("rejects null where the legacy model collapsed it to Option.none", () =>
      Effect.gen(function* () {
        yield* rejects({ compilerOptions: { strict: null } }, "Expected boolean, got null", '["strict"]');
        yield* rejects({ include: null }, "got null", '["include"]');
        yield* rejects({ typeAcquisition: null }, "got null", '["typeAcquisition"]');
      })
    );

    it.effect("rejects explicit undefined for an optional key (EF-40 / W4-j)", () =>
      rejects({ compilerOptions: { strict: undefined } }, "Expected boolean, got undefined", '["strict"]')
    );

    it.effect("rejects the legacy ts-node and buildOptions sections as unknown keys", () =>
      Effect.gen(function* () {
        yield* rejects({ "ts-node": { transpileOnly: true } }, "Unexpected key", '["ts-node"]');
        yield* rejects({ buildOptions: { verbose: true } }, "Unexpected key", '["buildOptions"]');
      })
    );

    it.effect("rejects es3, the legacy fallbackPolling aliases and ES2022.SharedMemory", () =>
      Effect.gen(function* () {
        yield* rejects({ compilerOptions: { target: "ES3" } }, 'got "es3"', '["compilerOptions"]["target"]');
        yield* rejects(
          { watchOptions: { fallbackPolling: "fixedPollingInterval" } },
          'got "fixedpollinginterval"',
          '["watchOptions"]["fallbackPolling"]'
        );
        yield* rejects({ compilerOptions: { lib: ["ES2022.SharedMemory"] } }, 'got "es2022.sharedmemory"');
      })
    );

    it.effect("rejects an empty references[].path", () =>
      rejects({ references: [{ path: "" }] }, "at least 1", '["references"][0]["path"]')
    );

    it.effect("rejects a null paths target", () =>
      rejects({ compilerOptions: { paths: { "@x": null } } }, "Expected array, got null", '["paths"]["@x"]')
    );
  });

  it.effect("validateCompilerOptions applies the same rules to a bare options record", () =>
    Effect.gen(function* () {
      const options = yield* TsconfigValidator.validateCompilerOptions({ moduleResolution: "Bundler", strict: true });
      strictEqual(options.moduleResolution, "bundler");
      const error = yield* Effect.flip(TsconfigValidator.validateCompilerOptions({ bogus: 1 }));
      strictEqual(error.path, "");
      assertInclude(error.message, 'invalid tsconfig.json\nUnexpected key with value 1\n  at ["bogus"]');
    })
  );

  it("formats TsconfigValidationError with and without a path, for Error and non-Error causes", () => {
    strictEqual(
      TsconfigValidationError.make({ path: "/p/tsconfig.json", cause: new Error("Expected boolean") }).message,
      'invalid tsconfig.json at "/p/tsconfig.json"\nExpected boolean'
    );
    strictEqual(
      TsconfigValidationError.make({ path: "", cause: "not an error" }).message,
      "invalid tsconfig.json\nnot an error"
    );
  });
});

layer(
  fixtureLayer(
    tree(
      ["/proj/tsconfig.json", '{"extends":"./base.json","compilerOptions":{"strict":true,"outDir":"out"}}'],
      ["/proj/base.json", '{"compilerOptions":{"target":"ES2022","module":"nodenext"}}'],
      ["/proj/typo.json", '{"compilerOptions":{"stirct":true}}'],
      ["/proj/malformed.json", '{"compilerOptions":'],
      ["/proj/broken-chain.json", '{"extends":"./missing.json","compilerOptions":{"strict":true}}'],
      ["/proj/loose-base.json", '{"extends":"./base-with-future.json"}'],
      ["/proj/base-with-future.json", '{"compilerOptions":{"futureOption":true}}']
    )
  ),
  { timeout: "30 seconds" }
)("TsconfigValidator over files", (it) => {
  it.effect("load validates the named file only; compilerOptions validates the merged chain", () =>
    Effect.gen(function* () {
      const document = yield* TsconfigValidator.load("/proj/tsconfig.json");
      assert.deepStrictEqual(document, { extends: "./base.json", compilerOptions: { strict: true, outDir: "out" } });
      const options = yield* TsconfigValidator.compilerOptions("/proj/tsconfig.json");
      // tsc semantics: inherited options merged, path options absolute.
      assert.deepStrictEqual(options, { target: "es2022", module: "nodenext", strict: true, outDir: "/proj/out" });
    })
  );

  it.effect("names the normalized absolute config path in a strict failure", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(TsconfigValidator.load("/proj/typo.json"));
      assertInstanceOf(error, TsconfigValidationError);
      strictEqual(error.path, "/proj/typo.json");
      assertInclude(error.message, 'invalid tsconfig.json at "/proj/typo.json"\nUnexpected key with value true');
      assertInclude(error.message, '["compilerOptions"]["stirct"]');
    })
  );

  it.effect("passes the loader's typed failures through", () =>
    Effect.gen(function* () {
      const parse = yield* Effect.flip(TsconfigValidator.load("/proj/malformed.json"));
      strictEqual(parse._tag, "TsconfigParseError");
      const missing = yield* Effect.flip(TsconfigValidator.load("/proj/missing.json"));
      strictEqual(missing._tag, "PlatformError");
      const chain = yield* Effect.flip(TsconfigValidator.compilerOptions("/proj/broken-chain.json"));
      strictEqual(chain._tag, "TsconfigExtendsError");
    })
  );

  it.effect("rejects a base config whose options the closed model does not type", () =>
    Effect.gen(function* () {
      yield* TsconfigValidator.load("/proj/loose-base.json");
      const error = yield* Effect.flip(TsconfigValidator.compilerOptions("/proj/loose-base.json"));
      assertInstanceOf(error, TsconfigValidationError);
      strictEqual(error.path, "/proj/loose-base.json");
      assertInclude(error.message, '["futureOption"]');
    })
  );
});
