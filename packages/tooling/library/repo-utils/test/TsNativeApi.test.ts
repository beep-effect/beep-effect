import {
  TsNativeApi,
  TsNativeBinaryNotFound,
  TsNativeConfig,
  TsNativeFileNotInProgram,
  TsNativeProtocolFailure,
} from "@beep/repo-utils/TsNativeApi";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it, vi } from "@effect/vitest";
import { isImportDeclaration, isStringLiteral } from "@typescript/native/unstable/ast";
import { API } from "@typescript/native/unstable/sync";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as PlatformError from "effect/PlatformError";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import * as Scope from "effect/Scope";
import type { Node } from "@typescript/native/unstable/ast";

const fixture = new URL("./fixtures/ts-native/", import.meta.url).pathname;
const layer = TsNativeApi.layer(TsNativeConfig.make({ cwd: fixture, tsconfig: "tsconfig.json" })).pipe(
  Layer.provide(NodeServices.layer)
);
const walk = (node: Node): ReadonlyArray<string> => {
  const imports: Array<string> = [];
  const visit = (node: Node): void => {
    if (isImportDeclaration(node) && isStringLiteral(node.moduleSpecifier)) imports.push(node.moduleSpecifier.text);
    node.forEachChild(visit);
  };
  visit(node);
  return imports;
};

describe("TsNativeApi", () => {
  it.layer(NodeServices.layer, { timeout: "30 seconds" })((it) => {
    it.effect(
      "maps executable resolver spawn failure to a binary error",
      Effect.fnUntraced(function* () {
        const spawnFailure = PlatformError.systemError({
          _tag: "NotFound",
          module: "ChildProcess",
          method: "spawn",
        });
        const unavailable = TsNativeApi.layer(TsNativeConfig.make({ cwd: fixture, tsconfig: "tsconfig.json" })).pipe(
          Layer.provide(
            Layer.succeed(
              ChildProcessSpawner.ChildProcessSpawner,
              ChildProcessSpawner.make((command) => {
                expect(ChildProcess.isStandardCommand(command)).toBe(true);
                if (ChildProcess.isStandardCommand(command)) {
                  expect(command.command).toBe(process.execPath);
                  expect(command.args).toContain("get-exe-path");
                  expect(command.options.cwd).toBe(fixture);
                }
                return Effect.fail(spawnFailure);
              })
            )
          ),
          Layer.provide(NodeServices.layer)
        );
        const error = yield* Layer.build(unavailable).pipe(Effect.flip);
        expect(error).toBeInstanceOf(TsNativeBinaryNotFound);
      })
    );

    it.layer(layer, { timeout: "30 seconds" })((it) => {
      it.effect(
        "loads a fixture program and walks native AST nodes",
        Effect.fnUntraced(function* () {
          const api = yield* TsNativeApi;
          const program = yield* api.program();
          expect(program.getSourceFileNames()).toContain(`${fixture}input.ts`);
          const source = yield* api.sourceFile("input.ts");
          expect(walk(source)).toEqual(["fixture-module"]);
          const diagnostics = yield* api.diagnostics();
          expect(A.some(diagnostics, (diagnostic) => diagnostic.code === 2307)).toBe(true);
        })
      );

      it.effect(
        "parses virtual sources and preserves an earlier snapshot",
        Effect.fnUntraced(function* () {
          const api = yield* TsNativeApi;
          const first = yield* api.parseSource("control.ts", 'import { a } from "first";');
          const second = yield* api.parseSource("control.ts", 'import { b } from "second";');
          expect(walk(first)).toEqual(["first"]);
          expect(walk(second)).toEqual(["second"]);
        })
      );

      it.effect(
        "fails with a typed error when a file cannot be loaded",
        Effect.fnUntraced(function* () {
          const api = yield* TsNativeApi;
          const error = yield* api.sourceFile("missing.ts").pipe(Effect.flip);
          expect(error).toBeInstanceOf(TsNativeFileNotInProgram);
        })
      );
      it.effect(
        "maps project lookup failure to a protocol error",
        Effect.fnUntraced(function* () {
          const api = yield* TsNativeApi;
          const error = yield* api.program("missing.json").pipe(Effect.flip);
          expect(error).toBeInstanceOf(TsNativeProtocolFailure);
        })
      );
    });
    it.effect(
      "reports a missing executable before starting a native process",
      Effect.fnUntraced(function* () {
        const unavailable = TsNativeApi.layer(
          TsNativeConfig.make({ cwd: fixture, tsconfig: "tsconfig.json", executable: O.some("missing-compiler") })
        ).pipe(Layer.provide(NodeServices.layer));
        const error = yield* Layer.build(unavailable).pipe(Effect.flip);
        expect(error).toBeInstanceOf(TsNativeBinaryNotFound);
      })
    );

    it.effect(
      "closes one API process after multiple scoped operations",
      Effect.fnUntraced(function* () {
        const close = yield* Effect.acquireRelease(
          Effect.sync(() => vi.spyOn(API.prototype, "close")),
          (spy) => Effect.sync(() => spy.mockRestore())
        );
        const scope = yield* Effect.acquireRelease(Scope.make(), (scope) => Scope.close(scope, Exit.void));
        const context = yield* Layer.buildWithScope(Layer.fresh(layer), scope);
        const api = Context.get(context, TsNativeApi);
        yield* api.program().pipe(Effect.provideService(Scope.Scope, scope));
        yield* api.sourceFile("input.ts").pipe(Effect.provideService(Scope.Scope, scope));
        yield* api.parseSource("scoped.ts", "export const value = 1;").pipe(Effect.provideService(Scope.Scope, scope));
        expect(close).not.toHaveBeenCalled();
        yield* Scope.close(scope, Exit.void);
        expect(close).toHaveBeenCalledTimes(1);
      })
    );
  });
});
