/**
 * Scoped TypeScript 7 compiler access using the installed Effect executable.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoUtilsId } from "@beep/identity/packages";
import { API, DiagnosticCategory } from "@typescript/native/unstable/sync";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import {
  TsNativeBinaryNotFound,
  TsNativeDiagnostic,
  TsNativeFileNotInProgram,
  TsNativeProtocolFailure,
} from "./TsNativeApi.models.ts";
import type { SourceFile } from "@typescript/native/unstable/ast";
import type { Diagnostic, Program, Snapshot } from "@typescript/native/unstable/sync";
import type * as Scope from "effect/Scope";
import type { TsNativeConfig } from "./TsNativeApi.models.ts";

const $I = $RepoUtilsId.create("TsNativeApi");

/**
 * Configuration for the native compiler service.
 *
 * **Example** (Import TsNativeConfig)
 *
 * ```ts
 * import { TsNativeConfig } from "@beep/repo-utils/TsNativeApi"
 * console.log(TsNativeConfig)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
/**
 * Native compiler boundary model.
 *
 * **Example** (Import TsNativeDiagnostic)
 *
 * ```ts
 * import { TsNativeDiagnostic } from "@beep/repo-utils/TsNativeApi"
 * console.log(TsNativeDiagnostic)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
/**
 * Native compiler boundary model.
 *
 * **Example** (Import TsNativeDiagnosticCategory)
 *
 * ```ts
 * import { TsNativeDiagnosticCategory } from "@beep/repo-utils/TsNativeApi"
 * console.log(TsNativeDiagnosticCategory)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
/**
 * Native compiler boundary model.
 *
 * **Example** (Import TsNativeBinaryNotFound)
 *
 * ```ts
 * import { TsNativeBinaryNotFound } from "@beep/repo-utils/TsNativeApi"
 * console.log(TsNativeBinaryNotFound)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
/**
 * Native compiler boundary model.
 *
 * **Example** (Import TsNativeProtocolFailure)
 *
 * ```ts
 * import { TsNativeProtocolFailure } from "@beep/repo-utils/TsNativeApi"
 * console.log(TsNativeProtocolFailure)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
/**
 * Native compiler boundary model.
 *
 * **Example** (Import TsNativeFileNotInProgram)
 *
 * ```ts
 * import { TsNativeFileNotInProgram } from "@beep/repo-utils/TsNativeApi"
 * console.log(TsNativeFileNotInProgram)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export {
  TsNativeBinaryNotFound,
  TsNativeConfig,
  TsNativeDiagnostic,
  TsNativeDiagnosticCategory,
  TsNativeFileNotInProgram,
  TsNativeProtocolFailure,
} from "./TsNativeApi.models.ts";

/**
 * Scoped native program and syntax operations. Returned handles are valid only
 * inside the requesting scope; diagnostics are detached values.
 *
 * **Example** (Describe the service contract)
 *
 * ```ts
 * import type { TsNativeApiShape } from "@beep/repo-utils/TsNativeApi"
 * const operation: keyof TsNativeApiShape = "sourceFile"
 * console.log(operation)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface TsNativeApiShape {
  readonly diagnostics: (
    tsconfig?: string
  ) => Effect.Effect<ReadonlyArray<TsNativeDiagnostic>, TsNativeProtocolFailure, Scope.Scope>;
  readonly parseSource: (
    fileName: string,
    source: string
  ) => Effect.Effect<SourceFile, TsNativeProtocolFailure | TsNativeFileNotInProgram, Scope.Scope>;
  readonly program: (tsconfig?: string) => Effect.Effect<Program, TsNativeProtocolFailure, Scope.Scope>;
  readonly sourceFile: (
    filePath: string
  ) => Effect.Effect<SourceFile, TsNativeProtocolFailure | TsNativeFileNotInProgram, Scope.Scope>;
}

/**
 * One native Go process shared by scoped program and source-file operations.
 *
 * **Example** (Import TsNativeApi)
 *
 * ```ts
 * import { TsNativeApi } from "@beep/repo-utils/TsNativeApi"
 * console.log(TsNativeApi)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class TsNativeApi extends Context.Service<TsNativeApi, TsNativeApiShape>()($I`TsNativeApi`) {
  /**
   * Acquire one native API process and close it when the layer scope ends.
   *
   * **Example** (Configure a repository compiler)
   *
   * ```ts
   * import { TsNativeApi, TsNativeConfig } from "@beep/repo-utils/TsNativeApi"
   * const layer = TsNativeApi.layer(TsNativeConfig.make({ cwd: "/repo", tsconfig: "tsconfig.json" }))
   * console.log(layer)
   * ```
   *
   * @param config - Repository and compiler settings for the native API process.
   * @returns A layer that provides TsNativeApi for operations against the configured repository.
   * @category layers
   * @since 0.0.0
   */
  static readonly layer = (config: TsNativeConfig) => Layer.effect(TsNativeApi, make(config));
}

const protocol = Effect.fnUntraced(function* <A>(operation: string, evaluate: () => A) {
  return yield* Effect.try({ try: evaluate, catch: (cause) => TsNativeProtocolFailure.make({ operation, cause }) });
});
const category = Match.type<DiagnosticCategory>().pipe(
  Match.when(DiagnosticCategory.Warning, () => "warning"),
  Match.when(DiagnosticCategory.Error, () => "error"),
  Match.when(DiagnosticCategory.Suggestion, () => "suggestion"),
  Match.when(DiagnosticCategory.Message, () => "message"),
  Match.orElse(() => undefined)
);
const decodeDiagnostic = Effect.fnUntraced(function* (diagnostic: Diagnostic) {
  return yield* S.decodeUnknownEffect(TsNativeDiagnostic)({
    ...diagnostic,
    category: category(diagnostic.category),
  }).pipe(Effect.mapError((cause) => TsNativeProtocolFailure.make({ operation: "diagnostic.decode", cause })));
});

const make = Effect.fn("TsNativeApi.layer")(function* (config: TsNativeConfig) {
  if (P.hasProperty(process.versions, "bun")) {
    return yield* TsNativeProtocolFailure.make({
      operation: "runtime",
      cause: "The TypeScript sync transport requires Node stdio handles.",
    });
  }
  const path = yield* Path.Path;
  const fs = yield* FileSystem.FileSystem;
  const resolve = (file: string) => path.resolve(config.cwd, file);
  const executable = yield* O.match(config.executable, {
    onSome: (value) => Effect.succeed(resolve(value)),
    onNone: Effect.fn("TsNativeApi.resolveExecutable")(
      function* () {
        const packageUrl = yield* Effect.try(() => new URL(import.meta.resolve("@effect/tsgo/package.json")));
        const packageJson = yield* path.fromFileUrl(packageUrl);
        const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
        const handle = yield* spawner.spawn(
          ChildProcess.make(
            process.execPath,
            [path.join(path.dirname(packageJson), "dist", "effect-tsgo.cjs"), "get-exe-path"],
            { cwd: config.cwd }
          )
        );
        const output = yield* handle.stdout.pipe(Stream.decodeText(), Stream.mkString);
        const exitCode = yield* handle.exitCode;
        if (exitCode !== 0) {
          return yield* TsNativeBinaryNotFound.make({ executable: "@effect/tsgo", cause: { exitCode } });
        }
        return Str.trim(output);
      },
      Effect.scoped,
      Effect.mapError((cause) => TsNativeBinaryNotFound.make({ executable: "@effect/tsgo", cause }))
    ),
  });
  yield* fs.access(executable).pipe(Effect.mapError((cause) => TsNativeBinaryNotFound.make({ executable, cause })));
  let parseId = 0;
  let virtualFiles = HashMap.empty<string, string>();
  const virtualDirectory = resolve(".beep-ts-native");
  const api = yield* Effect.acquireRelease(
    protocol(
      "start",
      () =>
        new API({
          tsserverPath: executable,
          cwd: config.cwd,
          fs: {
            readFile: (file) => O.getOrUndefined(HashMap.get(virtualFiles, file)),
            fileExists: (file) => (HashMap.has(virtualFiles, file) ? true : undefined),
            directoryExists: (directory) => (Str.startsWith(virtualDirectory)(directory) ? true : undefined),
            getAccessibleEntries: (directory) =>
              Str.startsWith(virtualDirectory)(directory)
                ? {
                    files: virtualFiles.pipe(
                      HashMap.keys,
                      A.fromIterable,
                      A.filter((file) => path.dirname(file) === directory),
                      A.map((file) => path.basename(file))
                    ),
                    directories: [],
                  }
                : undefined,
          },
        })
    ),
    (api) => protocol("close", () => api.close()).pipe(Effect.orDie)
  );
  const snapshot = Effect.fnUntraced(function* (
    operation: string,
    acquire: () => Snapshot,
    close: Parameters<API["updateSnapshot"]>[0]
  ) {
    return yield* Effect.acquireRelease(protocol(operation, acquire), (snapshot) =>
      protocol("snapshot.dispose", () => {
        snapshot.dispose();
        api.updateSnapshot(close).dispose();
      }).pipe(Effect.orDie)
    );
  });
  const program = Effect.fn("TsNativeApi.program")(function* (tsconfig = config.tsconfig) {
    const configPath = resolve(tsconfig);
    yield* protocol("parseConfigFile", () => api.parseConfigFile(configPath));
    const current = yield* snapshot("openProject", () => api.updateSnapshot({ openProjects: [configPath] }), {
      closeProjects: [configPath],
    });
    const project = yield* protocol("getProject", () => current.getProject(configPath));
    return (yield* Effect.fromOption(O.fromNullishOr(project), () =>
      TsNativeProtocolFailure.make({ operation: "getProject", cause: configPath })
    )).program;
  });
  const openSource = Effect.fn("TsNativeApi.openSource")(function* (file: string) {
    const virtualConfig = path.join(path.dirname(file), "tsconfig.json");
    const current = yield* snapshot(
      "openVirtualProject",
      () => api.updateSnapshot({ openProjects: [virtualConfig], fileChanges: { invalidateAll: true } }),
      { closeProjects: [virtualConfig] }
    );
    const source = yield* protocol("getSourceFile", () =>
      current.getProject(virtualConfig)?.program.getSourceFile(file)
    );
    return yield* Effect.fromOption(O.fromNullishOr(source), () =>
      TsNativeFileNotInProgram.make({ filePath: file, tsconfig: virtualConfig })
    );
  });
  return TsNativeApi.of({
    program,
    sourceFile: Effect.fn("TsNativeApi.sourceFile")(function* (filePath) {
      const current = yield* program();
      const file = resolve(filePath);
      const source = yield* protocol("getSourceFile", () => current.getSourceFile(file));
      return yield* Effect.fromOption(O.fromNullishOr(source), () =>
        TsNativeFileNotInProgram.make({ filePath: file, tsconfig: resolve(config.tsconfig) })
      );
    }),
    parseSource: Effect.fn("TsNativeApi.parseSource")(function* (fileName, source) {
      const file = path.join(virtualDirectory, `${parseId++}`, path.basename(fileName));
      const virtualConfig = path.join(path.dirname(file), "tsconfig.json");
      virtualFiles = HashMap.set(
        virtualFiles,
        virtualConfig,
        '{"compilerOptions":{"noLib":true,"noResolve":true,"types":[]},"include":["*"]}'
      );
      virtualFiles = HashMap.set(virtualFiles, file, source);
      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          virtualFiles = virtualFiles.pipe(HashMap.remove(file), HashMap.remove(virtualConfig));
        })
      );
      return yield* openSource(file);
    }),
    diagnostics: Effect.fn("TsNativeApi.diagnostics")(function* (tsconfig) {
      const current = yield* program(tsconfig);
      const diagnostics = yield* protocol("diagnostics", () => [
        ...current.getConfigFileParsingDiagnostics(),
        ...current.getSyntacticDiagnostics(),
        ...current.getSemanticDiagnostics(),
      ]);
      return yield* Effect.forEach(diagnostics, decodeDiagnostic);
    }),
  });
});
