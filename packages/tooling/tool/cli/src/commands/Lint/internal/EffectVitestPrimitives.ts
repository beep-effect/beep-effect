/**
 * Authoritative pinned Effect Vitest primitive graph loading and indexing.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A } from "@beep/utils";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Inspectable from "effect/Inspectable";
import * as Path from "effect/Path";
import { readArtifact } from "../../../internal/artifacts/index.ts";
import { EffectVitestPrimitiveGraphError } from "../Lint.errors.ts";
import { EffectVitestPrimitiveGraphDocument, EffectVitestPrimitiveGraphPath } from "../Lint.schemas.ts";
import type { EffectVitestPrimitive } from "../Lint.schemas.ts";

/**
 * Read and schema-decode the committed primitive graph beneath a repository root.
 *
 * **Example** (Build a graph read effect)
 *
 * ```ts
 * import { readEffectVitestPrimitiveGraph } from "@beep/repo-cli/commands/Lint"
 * import * as Effect from "effect/Effect";
 * console.log(Effect.isEffect(readEffectVitestPrimitiveGraph(process.cwd()))) // true
 * ```
 *
 * @category resources
 * @since 0.0.0
 */
export const readEffectVitestPrimitiveGraph = Effect.fn("EffectVitestPrimitives.read")(function* (root: string) {
  const path = yield* Path.Path;
  return yield* readArtifact({
    path: path.resolve(root, EffectVitestPrimitiveGraphPath),
    schema: EffectVitestPrimitiveGraphDocument,
    onReadError: (cause) =>
      EffectVitestPrimitiveGraphError.new(
        `Unable to read ${EffectVitestPrimitiveGraphPath}: ${Inspectable.toStringUnknown(cause, 0)}`
      ),
    onDecodeError: (cause) =>
      EffectVitestPrimitiveGraphError.new(
        `Unable to decode ${EffectVitestPrimitiveGraphPath}: ${Inspectable.toStringUnknown(cause, 0)}`
      ),
  });
});

/**
 * Index a decoded primitive graph by stable primitive identifier.
 *
 * **Example** (Index the graph entries)
 *
 * ```ts
 * import { indexEffectVitestPrimitives } from "@beep/repo-cli/commands/Lint"
 * import * as HashMap from "effect/HashMap";
 * console.log(HashMap.size(indexEffectVitestPrimitives([]))) // 0
 * ```
 *
 * @param entries - Pinned primitive entries to look up by their public identifier.
 * @returns An identifier-indexed map of the supplied primitive entries.
 * @category utilities
 * @since 0.0.0
 */
export const indexEffectVitestPrimitives = (
  entries: ReadonlyArray<EffectVitestPrimitive>
): HashMap.HashMap<string, EffectVitestPrimitive> =>
  HashMap.fromIterable(A.map(entries, (entry): readonly [string, EffectVitestPrimitive] => [entry.id, entry]));
