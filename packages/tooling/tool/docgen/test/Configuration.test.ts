import * as Configuration from "@beep/repo-docgen/Configuration";
import * as Domain from "@beep/repo-docgen/Domain";
import { Unknown } from "@beep/schema/Unknown";
import { Str } from "@beep/utils";
import { describe, expect, it, layer } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as O from "effect/Option";
import * as PlatformError from "effect/PlatformError";
import * as S from "effect/Schema";

const encodeJson = Unknown.encodeSyncFromJsonString;

const makeLoadArgs = (): Parameters<typeof Configuration.load>[0] => ({
  configFile: O.none(),
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
  runExamples: O.none(),
  include: O.none(),
  exclude: O.none(),
  parseCompilerOptions: O.none(),
  examplesCompilerOptions: O.none(),
});

const makeDocgenJsonLayer = (config: unknown | undefined, configFile = "docgen.json") =>
  Layer.effect(
    FileSystem.FileSystem,
    Effect.gen(function* () {
      const path = yield* Path.Path;

      const readFileString: FileSystem.FileSystem["readFileString"] = (filePath, _encoding) => {
        const fileName = path.basename(filePath);
        if (fileName === "package.json") {
          return Effect.succeed(encodeJson({ name: "name", homepage: "homepage" }));
        }
        if (fileName === configFile && config !== undefined) {
          return Effect.succeed(encodeJson(config));
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
        Effect.succeed(path.basename(filePath) === configFile && config !== undefined);

      return FileSystem.makeNoop({
        exists,
        readFileString,
      });
    })
  ).pipe(Layer.provide(Path.layer));

const makeTestLayer = (config?: unknown, configFile?: string) =>
  Layer.mergeAll(Path.layer, Domain.Process.layer, makeDocgenJsonLayer(config, configFile));

const expectConfig = (actual: Configuration.ConfigurationShape, expected: Configuration.ConfigurationShape) =>
  Effect.sync(() => expect(actual).toEqual(expected));

describe("Configuration", () => {
  layer(makeTestLayer())((it) =>
    it.effect("uses defaults when no docgen.json is present", () =>
      Configuration.load(makeLoadArgs()).pipe(
        Effect.flatMap(
          Effect.fnUntraced(function* (config) {
            return yield* expectConfig(config, {
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
              runExamples: false,
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
            });
          })
        )
      )
    )
  );

  layer(
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
            return yield* expectConfig(config, {
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
              runExamples: false,
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
            });
          })
        )
      )
    )
  );

  layer(makeTestLayer({ projectHomepage: 1 }))((it) =>
    it.effect(
      "raises a typed error when docgen.json is invalid",
      Effect.fnUntraced(function* () {
        const error = yield* Configuration.load(makeLoadArgs()).pipe(Effect.flip);
        expect(S.is(Domain.DocgenError)(error)).toBe(true);
        expect(Str.includes("[Configuration.readJsoncFile] Failed to decode")(error.message)).toBe(true);
        expect(Str.includes("projectHomepage")(error.message)).toBe(true);
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
});
