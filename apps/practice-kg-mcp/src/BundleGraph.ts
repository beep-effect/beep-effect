/**
 * Bundle-graph hygiene for the compiled practice KG host: proves the host's
 * module graph cannot reach the OpenTelemetry SDK or the observability
 * server and experimental-server entrypoints, which the strict tier must
 * never ship.
 *
 * **Details**
 *
 * The compiled executable is opaque to the archive inventory check, so this
 * check bundles the same entrypoint with Bun's metafile and inspects every
 * input module instead.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as Str from "effect/String";
import { PackageFailure } from "./PracticeKgMcp.errors.ts";

const NativeAddonExternals: ReadonlyArray<string> = [
  "@duckdb/node-bindings-linux-x64/duckdb.node",
  "@duckdb/node-bindings-linux-x64-musl/duckdb.node",
  "@duckdb/node-bindings-linux-arm64/duckdb.node",
  "@duckdb/node-bindings-linux-arm64-musl/duckdb.node",
  "@duckdb/node-bindings-darwin-arm64/duckdb.node",
  "@duckdb/node-bindings-darwin-x64/duckdb.node",
  "@duckdb/node-bindings-win32-arm64/duckdb.node",
  "@duckdb/node-bindings-win32-x64/duckdb.node",
];

const ForbiddenBundleFragments: ReadonlyArray<string> = [
  "@effect/opentelemetry/",
  "@opentelemetry/",
  "capability/observability/src/server/",
  "capability/observability/src/experimental/server/",
  "@beep/observability/server",
  "@beep/observability/experimental/server",
];

/**
 * The input module paths of a bundle that match a forbidden fragment.
 *
 * **Example** (Find a forbidden input)
 *
 * ```ts
 * import { forbiddenBundleInputs } from "../../src/BundleGraph.ts"
 *
 * console.log(forbiddenBundleInputs(["src/bin.ts", "node_modules/@opentelemetry/api/index.js"]))
 * // ["node_modules/@opentelemetry/api/index.js"]
 * ```
 *
 * @param inputs - Input module paths from a Bun build metafile.
 * @returns The forbidden input paths, sorted.
 * @category use-cases
 * @since 0.0.0
 */
export const forbiddenBundleInputs = (inputs: ReadonlyArray<string>): ReadonlyArray<string> =>
  A.sort(
    A.filter(inputs, (input) => A.some(ForbiddenBundleFragments, (fragment) => Str.includes(fragment)(input))),
    Order.String
  );

/**
 * Bundles `entrypoint` for Bun with a metafile and fails when any input
 * module matches `ForbiddenBundleFragments`.
 *
 * **Example** (Check the host entrypoint)
 *
 * ```ts
 * import { assertBundleGraph } from "../../src/BundleGraph.ts"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(assertBundleGraph("apps/practice-kg-mcp/src/bin.ts"))) // true
 * ```
 *
 * @param entrypoint - The host entrypoint the executable is compiled from.
 * @returns The number of input modules checked.
 * @category use-cases
 * @since 0.0.0
 */
export const assertBundleGraph = Effect.fn("PracticeKgBundleGraph.assert")(function* (entrypoint: string) {
  const build = yield* Effect.tryPromise({
    try: () =>
      Bun.build({
        entrypoints: [entrypoint],
        target: "bun",
        metafile: true,
        external: [...NativeAddonExternals],
      }),
    catch: (cause) => PackageFailure.make({ cause, message: "The host bundle graph could not be built." }),
  });
  if (!build.success || build.metafile === undefined) {
    return yield* PackageFailure.make({ message: "The host bundle graph build failed." });
  }
  const inputs = R.keys(build.metafile.inputs);
  const forbidden = forbiddenBundleInputs(inputs);
  if (A.isReadonlyArrayNonEmpty(forbidden)) {
    return yield* PackageFailure.make({
      message: `The host bundle reaches modules the strict tier forbids: ${A.join(forbidden, ", ")}`,
    });
  }
  return A.length(inputs);
});
