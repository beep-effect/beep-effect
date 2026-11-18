import type * as HandlerRegistry from "@proto/tooling/HandlerRegistry";
import * as Effect from "effect/Effect";
import * as Path from "effect/Path";
import { PartyModel } from "../src/Party.model.ts";

/**
 * Where the Party model's handler registry lives and what it exports.
 *
 * @category generators
 * @since 0.0.0
 */
export const registry = Effect.gen(function* () {
  const path = yield* Path.Path;
  const srcDir = yield* path.fromFileUrl(new URL("../src/", import.meta.url));
  return {
    model: PartyModel,
    modelExport: "PartyModel",
    srcDir,
    output: "Party.handlers.ts",
    exportName: "PartyHandlers",
  } satisfies HandlerRegistry.Options;
});
