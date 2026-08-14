/**
 * Browser-conditions regression guard for the visualizer worker import graph.
 *
 * The sibling `WorkerImportGraph.test.ts` imports the worker entrypoint under
 * the runtime's own (Node-style) export conditions, which cannot catch the
 * class of bug that broke the ontology workbench: packages such as
 * `decode-named-character-reference` ship a `browser` build that touches
 * `document` at module top level, and Vite resolves module workers with
 * browser conditions. Vite dev additionally executes every module in the
 * graph unbundled — no tree-shaking — so an unused barrel leak (e.g. the
 * `@beep/schema` root barrel dragging in `Markdown.ts` → micromark) still
 * evaluates the DOM-touching top-level code and crashes the worker.
 *
 * This test reproduces those exact conditions: it bundles the worker
 * entrypoint with esbuild under `platform: "browser"` with tree-shaking
 * disabled, asserts the markdown stack stays out of the graph, and then
 * evaluates the bundle in this DOM-less runtime.
 */
import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect, layer } from "@effect/vitest";
import { Context, Effect, FileSystem, Layer, Path } from "effect";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { build } from "esbuild";

const WORKER_ENTRY = "@beep/ontology-use-cases/aggregates/Session/worker";

const PACKAGE_ROOT = new URL("..", import.meta.url);

class DynamicModuleLoadError extends S.TaggedError<DynamicModuleLoadError>()("DynamicModuleLoadError", {
  cause: S.Defect({ includeStack: true }),
  url: S.String,
}) {}

const loadDynamicModule = Effect.fn("DynamicModuleLoader.load")((url: string) =>
  Effect.tryPromise<unknown, DynamicModuleLoadError>({
    try: () => import(url),
    catch: (cause) => DynamicModuleLoadError.make({ cause, url }),
  })
);

class DynamicModuleLoader extends Context.Service<DynamicModuleLoader, { readonly load: typeof loadDynamicModule }>()(
  "@beep/ontology-use-cases/test/BrowserWorkerImportGraph.test/DynamicModuleLoader"
) {}

const dynamicModuleLoaderLayer = Layer.succeed(
  DynamicModuleLoader,
  DynamicModuleLoader.of({
    load: loadDynamicModule,
  })
);

const testPlatformLayer = Layer.mergeAll(NodeServices.layer, dynamicModuleLoaderLayer);

layer(testPlatformLayer)("@beep/ontology-use-cases worker import graph (browser conditions)", (it) => {
  it.effect(
    "bundles and evaluates the worker entrypoint under Vite-dev-like browser resolution",
    Effect.fnUntraced(function* () {
      expect("document" in globalThis).toBe(false);
      expect("window" in globalThis).toBe(false);

      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const dynamicModules = yield* DynamicModuleLoader;
      const packageRoot = yield* path.fromFileUrl(PACKAGE_ROOT);
      const result = yield* Effect.tryPromise(() =>
        build({
          entryPoints: [WORKER_ENTRY],
          absWorkingDir: packageRoot,
          bundle: true,
          write: false,
          format: "esm",
          platform: "browser",
          // Vite dev serves the whole graph unbundled and runs every module's
          // top-level code; tree-shaking would hide exactly the leaks that
          // crash real dev workers.
          treeShaking: false,
          metafile: true,
          logLevel: "silent",
        })
      );

      const inputs = Object.keys(result.metafile.inputs);

      // The precise regression: the browser build of this micromark dependency
      // calls `document.createElement` at module top level.
      const domCharacterReference = inputs.filter((input) =>
        input.includes("decode-named-character-reference/index.dom.js")
      );
      expect(domCharacterReference).toEqual([]);

      // The class of regression: the worker needs no markdown support, so any
      // micromark module in the graph is a barrel leak (worker.ts's docstring
      // requires the entrypoint stay free of root package barrels).
      const markdownStack = inputs.filter((input) => /node_modules\/micromark(-[^/]+)?\//.test(input));
      expect(markdownStack).toEqual([]);

      // Strongest form: the bundle's top-level code must run where no DOM
      // exists, exactly like a fresh module worker.
      const dir = yield* fs.makeTempDirectoryScoped({ prefix: "beep-worker-graph-" });
      const bundlePath = path.join(dir, "worker-graph.mjs");
      yield* fs.writeFileString(bundlePath, result.outputFiles[0]?.text ?? "");
      const bundleUrl = yield* path.toFileUrl(bundlePath);
      const moduleExports = yield* dynamicModules.load(bundleUrl.href);
      expect(P.hasProperty(moduleExports, "WorkerCommand")).toBe(true);
      expect(P.hasProperty(moduleExports, "buildOntologyGraphProjection")).toBe(true);
    }),
    120_000
  );
});
