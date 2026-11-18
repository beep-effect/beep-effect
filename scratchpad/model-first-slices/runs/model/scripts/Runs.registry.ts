import type * as HandlerRegistry from "@proto/tooling/HandlerRegistry";
import * as Effect from "effect/Effect";
import * as Path from "effect/Path";
import { RunsModel } from "../src/Runs.model.ts";

/**
 * Where the Runs.model's handler registry lives and what it exports.
 *
 * @category generators
 * @since 0.0.0
 */
export const registry = Effect.gen(function* () {
  const path = yield* Path.Path;
  const srcDir = yield* path.fromFileUrl(new URL("../src/", import.meta.url));
  return {
    model: RunsModel,
    modelExport: "RunsModel",
    srcDir,
    output: "Runs.handlers.ts",
    exportName: "RunsHandlers",
  } satisfies HandlerRegistry.Options;
});
