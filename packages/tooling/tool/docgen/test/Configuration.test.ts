import { MemoryFileSystem } from "@beep/memfs";
import * as Configuration from "@beep/repo-docgen/Configuration";
import * as Domain from "@beep/repo-docgen/Domain";
import { it } from "@beep/test-runner";
import { A, HostProcessPlatform, Str } from "@beep/utils";
import { describe, expect } from "@effect/vitest";
import { assertInclude, assertTrue } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { flow } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const isDomainDocgenError = S.is(Domain.DocgenError);

const encodeJson = flow(S.encodeUnknownResult(S.fromJsonString(S.Unknown)), Result.getOrThrow);

const makeLoadArgs = (): Parameters<typeof Configuration.load>[0] => ({
  projectHomepage: O.none(),
  srcLink: O.none(),
  srcDir: O.none(),
  outDir: O.none(),
  theme: O.none(),
  enableSearch: O.none(),
  enforceDescriptions: O.none(),
  enforceExamples: O.none(),
  enforceVersion: O.none(),
  tscExecutable: O.none(),
  include: O.none(),
  exclude: O.none(),
  parseCompilerOptions: O.none(),
  examplesCompilerOptions: O.none(),
});

interface DocgenConfigFile {
  readonly exists: boolean;
  readonly text: O.Option<string>;
}

const defaultPackageJson = encodeJson({ name: "name", homepage: "homepage" });

const makeDocgenFileLayer = (configFile: string, file: DocgenConfigFile, packageJson = defaultPackageJson) =>
  Layer.effect(
    FileSystem.FileSystem,
    Effect.gen(function* () {
      const path = yield* Path.Path;

      const readFileString: FileSystem.FileSystem["readFileString"] = (filePath, _encoding) => {
        const fileName = path.basename(filePath);
        if (fileName === "package.json") {
          return Effect.succeed(packageJson);
        }
        if (fileName === configFile && O.isSome(file.text)) {
          return Effect.succeed(file.text.value);
        }
        return Effect.fail(
          PlatformError.systemError({
            _tag: "NotFound",
            module: "ConfigurationTest",
            method: "readFileString",
            pathOrDescriptor: filePath,
          })
        );
      };

      const exists: FileSystem.FileSystem["exists"] = (filePath) =>
        Effect.succeed(path.basename(filePath) === configFile && file.exists);

      return FileSystem.makeNoop({
        exists,
        readFileString,
      });
    })
  ).pipe(Layer.provide(Path.layer));

const makeDocgenJsonLayer = (config: unknown | undefined, configFile = "docgen.json") =>
  makeDocgenFileLayer(configFile, {
    exists: config !== undefined,
    text: O.map(O.fromUndefinedOr(config), encodeJson),
  });

const makeTextLayer = (file: DocgenConfigFile, packageJson?: string) =>
  Layer.mergeAll(Path.layer, Domain.Process.layer, makeDocgenFileLayer("docgen.json", file, packageJson));

const makeTestLayer = (config?: unknown, configFile?: string) =>
  Layer.mergeAll(Path.layer, Domain.Process.layer, makeDocgenJsonLayer(config, configFile));

// package.json reads that fail at the file system: `NotFound` reaches the
// `PackageJsonNotFoundError` branch, any other system error the read branch.
const makePackageJsonFailureLayer = (reason: "NotFound" | "PermissionDenied") =>
  Layer.mergeAll(
    Path.layer,
    Domain.Process.layer,
    FileSystem.layerNoop({
      exists: () => Effect.succeed(false),
      readFileString: (filePath) =>
        Effect.fail(
          PlatformError.systemError({
            _tag: reason,
            module: "ConfigurationTest",
            method: "readFileString",
            pathOrDescriptor: filePath,
          })
        ),
    })
  );

const expectConfig = (actual: Configuration.ConfigurationShape, expected: Configuration.ConfigurationShape) =>
  Effect.sync(() => expect(actual).toEqual(expected));

// A real virtual filesystem for the tsconfig-path cases: `TsconfigValidator.compilerOptions`
// walks the named file's `extends` chain, which a method stub cannot answer faithfully.
const PKG = "/pkg";
const makeTsconfigLayer = (
  files: Readonly<Record<string, string>>,
  docgen: unknown = { parseCompilerOptions: "tsconfig.json" }
) =>
  Layer.mergeAll(
    Path.layer,
    Layer.succeed(
      Domain.Process,
      Domain.Process.of({ cwd: Effect.succeed(PKG), platform: HostProcessPlatform, argv: Effect.succeed([]) })
    ),
    MemoryFileSystem.layerWith({
      [`${PKG}/package.json`]: defaultPackageJson,
      [`${PKG}/docgen.json`]: encodeJson(docgen),
      ...files,
    })
  );

const expectReadTsconfigError = Effect.fn("expectReadTsconfigError")(function* (
  step: string,
  ...fragments: ReadonlyArray<string>
) {
  const error = yield* Configuration.load(makeLoadArgs()).pipe(Effect.flip);
  expect(isDomainDocgenError(error)).toBe(true);
  assertInclude(error.message, `[Configuration.readTSConfig] Failed to ${step} TSConfig file '${PKG}/tsconfig.json'`);
  for (const fragment of fragments) assertInclude(error.message, fragment);
});

describe("Configuration", () => {
  it.layer(makeTestLayer())((it) =>
    it.effect("uses defaults when configFile is omitted and no docgen.json is present", () =>
      Configuration.load(makeLoadArgs()).pipe(
        Effect.flatMap(
          Effect.fnUntraced(function* (config) {
            return yield* expectConfig(
              config,
              Configuration.ConfigurationShape.make({
                projectName: "name",
                projectHomepage: "homepage",
                srcLink: "homepage/blob/main/src/",
                srcDir: "src",
                outDir: "docs",
                theme: "mikearnaldi/just-the-docs",
                enableSearch: true,
                enforceDescriptions: false,
                enforceExamples: false,
                enforceVersion: true,
                tscExecutable: "tsc",
                include: [],
                exclude: [],
                parseCompilerOptions: Configuration.defaultCompilerOptions,
                examplesCompilerOptions: {
                  ...Configuration.defaultCompilerOptions,
                  allowImportingTsExtensions: true,
                  noUnusedLocals: false,
                  noUnusedParameters: false,
                  types: ["node", "bun"],
                },
              })
            );
          })
        )
      )
    )
  );

  it.layer(
    makeTestLayer({
      projectHomepage: "myproject",
      srcLink: "mygithub",
      parseCompilerOptions: {
        noEmit: true,
        strict: true,
        skipLibCheck: true,
        exactOptionalPropertyTypes: true,
        moduleResolution: "bundler",
        target: "es2022",
        lib: ["ES2022", "DOM"],
      },
    })
  )((it) =>
    it.effect("uses configuration from docgen.json when present", () =>
      Configuration.load(makeLoadArgs()).pipe(
        Effect.flatMap(
          Effect.fnUntraced(function* (config) {
            return yield* expectConfig(
              config,
              Configuration.ConfigurationShape.make({
                projectName: "name",
                projectHomepage: "myproject",
                srcLink: "mygithub",
                srcDir: "src",
                outDir: "docs",
                theme: "mikearnaldi/just-the-docs",
                enableSearch: true,
                enforceDescriptions: false,
                enforceExamples: false,
                enforceVersion: true,
                tscExecutable: "tsc",
                include: [],
                exclude: [],
                parseCompilerOptions: {
                  noEmit: true,
                  strict: true,
                  skipLibCheck: true,
                  exactOptionalPropertyTypes: true,
                  moduleResolution: "bundler",
                  target: "es2022",
                  lib: ["ES2022", "DOM"],
                },
                examplesCompilerOptions: {
                  ...Configuration.defaultCompilerOptions,
                  allowImportingTsExtensions: true,
                  noUnusedLocals: false,
                  noUnusedParameters: false,
                  types: ["node", "bun"],
                },
              })
            );
          })
        )
      )
    )
  );

  it.layer(makeTestLayer({ projectHomepage: 1 }))((it) =>
    it.effect(
      "raises a typed error when docgen.json is invalid",
      Effect.fnUntraced(function* () {
        const error = yield* Configuration.load(makeLoadArgs()).pipe(Effect.flip);
        expect(isDomainDocgenError(error)).toBe(true);
        expect(Str.includes("[Configuration.readJsoncFile] Failed to decode")(error.message)).toBe(true);
        expect(Str.includes("projectHomepage")(error.message)).toBe(true);
      })
    )
  );

  // docgen read docgen.json through jsonc-parser with its errors ignored, so a
  // malformed file decoded whatever fragment survived. Through ConfigFile.read
  // and JsoncCodec (wave 3, W3-e) the parse failure is typed.
  it.layer(makeTextLayer({ exists: true, text: O.some('{ "srcDir": "src", ') }), { timeout: "30 seconds" })((it) =>
    it.effect(
      "raises a typed parse error when docgen.json is malformed JSONC",
      Effect.fnUntraced(function* () {
        const error = yield* Configuration.load(makeLoadArgs()).pipe(Effect.flip);
        expect(isDomainDocgenError(error)).toBe(true);
        expect(Str.includes("[Configuration.readJsoncFile] Failed to parse")(error.message)).toBe(true);
        expect(Str.includes("docgen.json")(error.message)).toBe(true);
      })
    )
  );

  it.layer(
    makeTextLayer({
      exists: true,
      text: O.some('{\n  // comments and trailing commas stay legal\n  "srcDir": "lib",\n}\n'),
    }),
    { timeout: "30 seconds" }
  )((it) =>
    it.effect(
      "reads comments and trailing commas in docgen.json",
      Effect.fnUntraced(function* () {
        const config = yield* Configuration.load(makeLoadArgs());
        expect(config.srcDir).toBe("lib");
      })
    )
  );

  // package.json is JSON, not JSONC: npm and Node read it with JSON.parse. The
  // retired reader shared docgen.json's JSONC codec and accepted comments; the
  // `PackageJsonFile` read (3-A4) rejects them.
  it.layer(
    makeTextLayer(
      { exists: false, text: O.none() },
      '{\n  // a comment\n  "name": "name",\n  "homepage": "homepage",\n}\n'
    ),
    { timeout: "30 seconds" }
  )((it) =>
    it.effect(
      "rejects comments and trailing commas in package.json",
      Effect.fnUntraced(function* () {
        const error = yield* Configuration.load(makeLoadArgs()).pipe(Effect.flip);
        expect(isDomainDocgenError(error)).toBe(true);
        assertTrue(Str.includes("[Configuration.readPackageJson] Failed to parse")(error.message));
        expect(error.cause).toMatchObject({ _tag: "PackageJsonParseError" });
      })
    )
  );

  it.layer(makeTextLayer({ exists: false, text: O.none() }, encodeJson({ name: "name" })), {
    timeout: "30 seconds",
  })((it) =>
    it.effect(
      "requires a homepage in package.json",
      Effect.fnUntraced(function* () {
        const error = yield* Configuration.load(makeLoadArgs()).pipe(Effect.flip);
        expect(isDomainDocgenError(error)).toBe(true);
        assertTrue(Str.includes("[Configuration.readPackageJson] Failed to decode")(error.message));
        assertTrue(Str.includes("`homepage`")(error.message));
      })
    )
  );

  it.layer(makeTextLayer({ exists: false, text: O.none() }, encodeJson({ name: 1, homepage: "homepage" })), {
    timeout: "30 seconds",
  })((it) =>
    it.effect(
      "rejects a package.json field of the wrong type",
      Effect.fnUntraced(function* () {
        const error = yield* Configuration.load(makeLoadArgs()).pipe(Effect.flip);
        expect(isDomainDocgenError(error)).toBe(true);
        assertTrue(Str.includes("[Configuration.readPackageJson] Failed to decode")(error.message));
      })
    )
  );

  it.layer(makePackageJsonFailureLayer("NotFound"), { timeout: "30 seconds" })((it) =>
    it.effect(
      "raises a typed read error when package.json is missing",
      Effect.fnUntraced(function* () {
        const error = yield* Configuration.load(makeLoadArgs()).pipe(Effect.flip);
        expect(isDomainDocgenError(error)).toBe(true);
        assertTrue(Str.includes("[Configuration.readPackageJson] Failed to read")(error.message));
        assertTrue(Str.includes("The file does not exist.")(error.message));
      })
    )
  );

  it.layer(makePackageJsonFailureLayer("PermissionDenied"), { timeout: "30 seconds" })((it) =>
    it.effect(
      "raises a typed read error when package.json cannot be read",
      Effect.fnUntraced(function* () {
        const error = yield* Configuration.load(makeLoadArgs()).pipe(Effect.flip);
        expect(isDomainDocgenError(error)).toBe(true);
        assertTrue(Str.includes("[Configuration.readPackageJson] Failed to read")(error.message));
      })
    )
  );

  it.layer(makeTextLayer({ exists: true, text: O.none() }), { timeout: "30 seconds" })((it) =>
    it.effect(
      "raises a typed read error when docgen.json exists but cannot be read",
      Effect.fnUntraced(function* () {
        const error = yield* Configuration.load(makeLoadArgs()).pipe(Effect.flip);
        expect(isDomainDocgenError(error)).toBe(true);
        expect(Str.includes("[Configuration.readJsoncFile] Failed to read")(error.message)).toBe(true);
      })
    )
  );

  it.layer(makeTestLayer({ srcDir: "effect-ontology" }, "docgen.effect-ontology.json"))(
    "alternate configuration file",
    (it) => {
      it.effect(
        "loads an explicitly selected configuration without replacing docgen.json",
        Effect.fnUntraced(function* () {
          const config = yield* Configuration.load({
            ...makeLoadArgs(),
            configFile: O.some("docgen.effect-ontology.json"),
          });

          expect(config.srcDir).toBe("effect-ontology");
        })
      );
    }
  );

  // A string `parseCompilerOptions` / `examplesCompilerOptions` names a tsconfig file. docgen read
  // the single file through the repo-utils strict model; since 3-A6 it reads the file through
  // `TsconfigValidator.compilerOptions`: the named file passes the strict closed check, its whole
  // `extends` chain is merged with tsc semantics, and the merged options pass the check too.
  describe("tsconfig file input", () => {
    it.layer(
      makeTsconfigLayer({
        [`${PKG}/tsconfig.json`]:
          '{ "extends": "./base.json", "compilerOptions": { "strict": true, "outDir": "out" } }',
        [`${PKG}/base.json`]: '{ "compilerOptions": { "target": "ES2022", "lib": ["DOM", "ES2022"], "noEmit": true } }',
      }),
      { timeout: "30 seconds" }
    )((it) =>
      it.effect("merges the extends chain with tsc semantics and encodes canonical spellings", () =>
        Effect.gen(function* () {
          const config = yield* Configuration.load(makeLoadArgs());
          // Inherited options are kept (not replaced by the defaults); path options are absolute.
          expect(config.parseCompilerOptions).toEqual({
            target: "es2022",
            lib: ["dom", "es2022"],
            noEmit: true,
            strict: true,
            outDir: `${PKG}/out`,
          });
          // The examples options came from the defaults, not the file.
          expect(config.examplesCompilerOptions.target).toBe("es2022");
        })
      )
    );

    it.layer(
      makeTsconfigLayer({
        [`${PKG}/tsconfig.json`]: '{ "extends": "../base.json" }',
        "/base.json": '{ "compilerOptions": { "paths": { "@shared/*": ["./packages/*/src", "/external/*"] } } }',
      }),
      { timeout: "30 seconds" }
    )((it) =>
      it.effect("resolves inherited paths against the declaring config directory without baseUrl", () =>
        Effect.gen(function* () {
          const config = yield* Configuration.load(makeLoadArgs());
          expect(config.parseCompilerOptions.paths).toEqual({ "@shared/*": ["/packages/*/src", "/external/*"] });
        })
      )
    );

    it.layer(
      makeTsconfigLayer({
        [`${PKG}/tsconfig.json`]: '{ "extends": "../base.json" }',
        "/base.json":
          '{ "compilerOptions": { "baseUrl": "./workspace", "paths": { "@shared/*": ["./packages/*/src"] } } }',
      }),
      { timeout: "30 seconds" }
    )((it) =>
      it.effect("keeps paths relative to an explicit inherited baseUrl", () =>
        Effect.gen(function* () {
          const config = yield* Configuration.load(makeLoadArgs());
          expect(config.parseCompilerOptions.baseUrl).toBe("/workspace");
          expect(config.parseCompilerOptions.paths).toEqual({ "@shared/*": ["./packages/*/src"] });
        })
      )
    );

    it.layer(
      makeTsconfigLayer({
        [`${PKG}/tsconfig.json`]: '{ "extends": "../broken-base.json" }',
        "/broken-base.json": '{ "compilerOptions": ',
      }),
      { timeout: "30 seconds" }
    )((it) =>
      it.effect("names the malformed base config in a parse failure", () =>
        expectReadTsconfigError("decode", "/broken-base.json", "JSONC parse failed")
      )
    );

    it.layer(makeTsconfigLayer({ [`${PKG}/tsconfig.json`]: "{}" }), { timeout: "30 seconds" })((it) =>
      it.effect("falls back to the default compiler options when the chain declares none", () =>
        Effect.gen(function* () {
          const config = yield* Configuration.load(makeLoadArgs());
          expect(config.parseCompilerOptions).toEqual(Configuration.defaultCompilerOptions);
        })
      )
    );

    it.layer(
      makeTsconfigLayer(
        { [`${PKG}/tsconfig.json`]: '{ "compilerOptions": { "stirct": true } }' },
        {
          examplesCompilerOptions: "tsconfig.json",
        }
      ),
      { timeout: "30 seconds" }
    )((it) =>
      it.effect("fails typed on an unknown compiler option in the named file", () =>
        expectReadTsconfigError("decode", "Unexpected key", '["compilerOptions"]["stirct"]')
      )
    );

    it.layer(
      makeTsconfigLayer({
        [`${PKG}/tsconfig.json`]: '{ "extends": "./base.json" }',
        [`${PKG}/base.json`]: '{ "compilerOptions": { "futureOption": true } }',
      }),
      { timeout: "30 seconds" }
    )((it) =>
      it.effect("fails typed on an unknown compiler option inherited from a base config", () =>
        expectReadTsconfigError("decode", '["futureOption"]')
      )
    );

    it.layer(makeTsconfigLayer({ [`${PKG}/tsconfig.json`]: '{ "compilerOptions": ' }), { timeout: "30 seconds" })(
      (it) => it.effect("fails typed on malformed JSONC", () => expectReadTsconfigError("decode", "JSONC parse failed"))
    );

    it.layer(makeTsconfigLayer({ [`${PKG}/tsconfig.json`]: '{ "extends": "./missing.json" }' }), {
      timeout: "30 seconds",
    })((it) =>
      it.effect("fails typed on a broken extends chain", () =>
        expectReadTsconfigError("resolve", 'cannot resolve extends target "./missing.json"')
      )
    );

    it.layer(makeTsconfigLayer({}), { timeout: "30 seconds" })((it) =>
      it.effect("fails typed when the named file is missing", () => expectReadTsconfigError("read", "tsconfig.json"))
    );
  });

  describe("encodeExamplesTsconfig", () => {
    it.effect("renders the validated document with canonical enum spellings", () =>
      Effect.gen(function* () {
        const text = yield* Configuration.encodeExamplesTsconfig({
          noEmit: true,
          target: "ES2022",
          lib: ["DOM", "ES2022"],
          moduleResolution: "Bundler",
        });
        // Schema field order and the canonical lower-case spelling, pretty-printed by the repo renderer.
        expect(text).toBe(
          A.join(
            [
              "{",
              '  "compilerOptions": {',
              '    "target": "es2022",',
              '    "moduleResolution": "bundler",',
              '    "lib": [',
              '      "dom",',
              '      "es2022"',
              "    ],",
              '    "noEmit": true',
              "  }",
              "}",
            ],
            "\n"
          )
        );
      })
    );

    it.effect("fails typed on an option the strict rules reject", () =>
      Effect.gen(function* () {
        const error = yield* Configuration.encodeExamplesTsconfig({ maxNodeModuleJsDepth: 2 }).pipe(Effect.flip);
        expect(isDomainDocgenError(error)).toBe(true);
        assertInclude(error.message, "[Configuration.encodeExamplesTsconfig] Failed to encode examples tsconfig");
        assertInclude(error.message, "maxNodeModuleJsDepth");
      })
    );
  });
});
