import { ExecContext, LocalExec, LocalExecError } from "@beep/commands";
import {
  DetectedPackageManager,
  PackageManagerDetectionError,
  PackageManagerDetector,
  WorkspaceManifestError,
  WorkspaceRoot,
  WorkspaceRootNotFoundError,
  Workspaces,
} from "@beep/repo-workspaces";
import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import type { PackageManagerName } from "@beep/repo-workspaces";

const declarationTierEvidenceValidForEveryManager = "package.json#packageManager";

const detects = (name: PackageManagerName, runtime: "node" | "bun" = "node") =>
  Layer.succeed(PackageManagerDetector, {
    detect: Effect.fn("PackageManagerDetector.detect")(() =>
      Effect.succeed(
        DetectedPackageManager.make({
          name,
          version: O.none(),
          runtime,
          evidence: declarationTierEvidenceValidForEveryManager,
        })
      )
    ),
  });

const detectorFailing = (failure: PackageManagerDetectionError | WorkspaceManifestError) =>
  Layer.succeed(PackageManagerDetector, {
    detect: Effect.fn("PackageManagerDetector.detect")(() => Effect.fail(failure)),
  });

const noRoot = Layer.succeed(WorkspaceRoot, {
  find: dual(
    (args) => P.isString(args[0]),
    Effect.fn("WorkspaceRoot.find")((cwd: string) =>
      Effect.fail(WorkspaceRootNotFoundError.make({ searchPath: cwd, markers: ["pnpm-workspace.yaml"] }))
    )
  ),
});

const localExecOver = (layers: Layer.Layer<PackageManagerDetector | WorkspaceRoot>, cwd = "/repo/packages/thing") =>
  Workspaces.localExecLayer({ cwd }).pipe(Layer.provide(layers));

const contextOf = Effect.flatMap(LocalExec, (local) => local.context);

const workspaceAt = (root: string, detector: Layer.Layer<PackageManagerDetector>) =>
  Layer.mergeAll(WorkspaceRoot.layerTest(root), detector);

describe("Workspaces.localExecLayer — a detected workspace", () => {
  it.layer(localExecOver(workspaceAt("/repo", detects("pnpm"))), { timeout: "30 seconds" })((it) => {
    it.effect("answers a context built from the detected manager's prefixes", () =>
      Effect.gen(function* () {
        const context = yield* contextOf;
        assertSome(context, O.getOrThrow(context));
        assert.instanceOf(context.value, ExecContext);
        assert.strictEqual(context.value.label, "pnpm");
        const expected = LocalExec.prefixes("pnpm");
        assert.deepStrictEqual(context.value.prefix, expected.prefix);
        assert.deepStrictEqual(context.value.dlxPrefix, expected.dlxPrefix);
        assert.deepStrictEqual(context.value.scriptPrefix, expected.scriptPrefix);
      })
    );
  });

  it.layer(localExecOver(workspaceAt("/repo", detects("pnpm"))), { timeout: "30 seconds" })((it) => {
    it.effect("runs the prefix in the WORKSPACE ROOT, not the caller's cwd", () =>
      Effect.gen(function* () {
        const context = yield* contextOf;
        assertSome(context, O.getOrThrow(context));
        assert.strictEqual(context.value.directory, "/repo");
      })
    );
  });

  let manager: PackageManagerName = "npm";
  const detector = Layer.succeed(PackageManagerDetector, {
    detect: Effect.fn("PackageManagerDetector.detect")(() =>
      Effect.sync(() =>
        DetectedPackageManager.make({
          name: manager,
          version: O.none(),
          runtime: manager === "bun" ? "bun" : "node",
          evidence: "package.json#packageManager",
        })
      )
    ),
  });
  it.layer(localExecOver(workspaceAt("/repo", detector)), { timeout: "30 seconds" })((it) => {
    it.effect("covers every manager the detector can report", () =>
      Effect.gen(function* () {
        for (const name of ["npm", "pnpm", "yarn", "bun"] as const) {
          manager = name;
          const context = yield* contextOf;
          assertSome(context, O.getOrThrow(context));
          const expected = LocalExec.prefixes(name);
          assert.strictEqual(context.value.label, name, `${name} label`);
          assert.deepStrictEqual(context.value.prefix, expected.prefix, `${name} prefix`);
          assert.deepStrictEqual(context.value.dlxPrefix, expected.dlxPrefix, `${name} dlx prefix`);
          assert.deepStrictEqual(context.value.scriptPrefix, expected.scriptPrefix, `${name} script prefix`);
        }
      })
    );
  });
});

describe("Workspaces.localExecLayer — NONE is success, not failure", () => {
  it.layer(localExecOver(Layer.mergeAll(noRoot, detects("pnpm"))), { timeout: "30 seconds" })((it) => {
    it.effect("outside any workspace, the answer is None rather than an error", () =>
      Effect.gen(function* () {
        const context = yield* contextOf;
        assertNone(context);
      })
    );
  });

  it.layer(
    localExecOver(
      workspaceAt(
        "/repo",
        detectorFailing(PackageManagerDetectionError.make({ root: "/repo", checked: ["pnpm-workspace.yaml"] }))
      )
    ),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("a workspace whose manager cannot be identified is also None", () =>
      Effect.gen(function* () {
        const context = yield* contextOf;
        assertNone(context);
      })
    );
  });
});

describe("Workspaces.localExecLayer — mechanism failure IS the typed error", () => {
  it.layer(
    localExecOver(
      workspaceAt(
        "/repo",
        detectorFailing(
          WorkspaceManifestError.make({
            packageJsonPath: "/repo/package.json",
            kind: "decode",
            cause: new Error("Unexpected token"),
          })
        )
      )
    ),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("a corrupt root manifest fails with LocalExecError", () =>
      Effect.gen(function* () {
        const error = yield* contextOf.pipe(Effect.flip);
        assert.instanceOf(error, LocalExecError);
      })
    );
  });

  it.layer(
    localExecOver(
      workspaceAt(
        "/repo",
        detectorFailing(
          WorkspaceManifestError.make({
            packageJsonPath: "/repo/package.json",
            kind: "read",
            cause: new Error("EACCES"),
          })
        )
      )
    ),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("the failure names the directory it was resolving for", () =>
      Effect.gen(function* () {
        const error = yield* contextOf.pipe(Effect.flip);
        assert.instanceOf(error, LocalExecError);
        assert.strictEqual(error.directory, "/repo");
      })
    );
  });

  const underlying = WorkspaceManifestError.make({
    packageJsonPath: "/repo/package.json",
    kind: "decode",
    cause: new Error("Unexpected token"),
  });
  it.layer(localExecOver(workspaceAt("/repo", detectorFailing(underlying))), { timeout: "30 seconds" })((it) => {
    it.effect("the originating failure is preserved structurally on `cause`", () =>
      Effect.gen(function* () {
        const error = yield* contextOf.pipe(Effect.flip);
        assert.instanceOf(error, LocalExecError);
        assert.strictEqual(error.cause, underlying);
      })
    );
  });
});

describe("Workspaces.localExecLayer — cwd", () => {
  const seen: Array<string> = [];
  const recordingRootThatLogsWhenFindRunsNotWhenBuilt = Layer.succeed(WorkspaceRoot, {
    find: dual(
      (args) => P.isString(args[0]),
      Effect.fn("WorkspaceRoot.find")((cwd: string) =>
        Effect.suspend(() => {
          seen.push(cwd);
          return Effect.succeed("/repo");
        })
      )
    ),
  });
  it.layer(
    localExecOver(Layer.mergeAll(recordingRootThatLogsWhenFindRunsNotWhenBuilt, detects("npm")), "/somewhere/else"),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("passes the configured cwd to root resolution", () =>
      Effect.gen(function* () {
        const context = yield* contextOf;
        assertSome(context, O.getOrThrow(context));
        assert.deepStrictEqual(seen, ["/somewhere/else"]);
      })
    );
  });
});
