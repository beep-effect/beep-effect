/**
 * Shared committed-artifact read/write, JSONC formatting, and truncated-list
 * rendering for repo-cli command adapters.
 *
 * @remarks
 * These consolidate the per-command copies used by the ratchet and generated
 * artifact families:
 *
 * - {@link formatJsonc} promotes the `QualityArtifactSupport.formatJsonc`
 *   renderer (deterministic `SchemaGetter.stringifyJson({ space: 2 })` output
 *   with a trailing newline). Its encode failure is left on the error channel
 *   unmapped so each caller attaches its own tagged error.
 * - {@link readArtifact} reads a committed JSONC document and decodes it through
 *   {@link @beep/schema/Jsonc!decodeJsoncTextAs}, mapping the read and decode
 *   phases with the caller-supplied factories.
 * - {@link writeArtifact} makes the parent directory and writes `header + body`
 *   verbatim; the trailing bytes (a `formatJsonc` result already ends with one
 *   newline) travel in `body` so each caller stays byte-identical to its
 *   current writer.
 * - {@link renderTruncatedLines} is the `... N more` list renderer shared by the
 *   ratchet regression/tighten blocks.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { decodeJsoncTextAs } from "@beep/schema/Jsonc";
import { A, O, pipe, thunkEmptyStr } from "@beep/utils";
import { Effect, FileSystem, Path, SchemaGetter } from "effect";
import type * as S from "effect/Schema";

const stringifyJsonPretty = SchemaGetter.stringifyJson({ space: 2 });

/**
 * Format a JSON-compatible value as deterministic JSONC text with a trailing
 * newline.
 *
 * @remarks
 * Promotes `QualityArtifactSupport.formatJsonc` verbatim; the stringify failure
 * stays on the error channel so callers map it with their own tagged error
 * (for example `QualityScriptCommandError.mapError("...")`).
 *
 * @param value - JSON-compatible value to render.
 * @returns Effect yielding deterministically formatted JSONC text ending in a
 * single newline.
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { formatJsonc } from "@beep/repo-cli/test/Artifacts"
 *
 * const text = Effect.runSync(formatJsonc({ schema_version: 1 }))
 * console.log(text.endsWith("\n")) // true
 * ```
 * @category formatting
 * @since 0.0.0
 */
export const formatJsonc = Effect.fn("ArtifactIo.formatJsonc")(function* (value: unknown) {
  const rendered = yield* stringifyJsonPretty.run(O.some(value), {});
  return `${O.getOrElse(rendered, thunkEmptyStr)}\n`;
});

/**
 * Read a committed JSONC artifact and decode it through a target schema.
 *
 * @remarks
 * Standardizes reads on {@link @beep/schema/Jsonc!decodeJsoncTextAs}. The read
 * and decode phases are mapped separately so callers keep their existing
 * `Failed to read ...` / `Failed to decode ...` message pair.
 *
 * @param input - Absolute artifact path, target schema, and read/decode error
 * factories.
 * @returns Effect yielding the decoded document.
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { readArtifact } from "@beep/repo-cli/test/Artifacts"
 *
 * class ReadError extends Error {}
 * const Doc = S.Struct({ schema_version: S.Literal(1) })
 * const program = readArtifact({
 *   path: "/repo/standards/example.jsonc",
 *   schema: Doc,
 *   onReadError: (cause) => new ReadError(String(cause)),
 *   onDecodeError: (cause) => new ReadError(String(cause))
 * })
 * console.log(Effect.isEffect(program))
 * ```
 * @category filesystem
 * @since 0.0.0
 */
export const readArtifact = Effect.fn("ArtifactIo.readArtifact")(function* <Schema extends S.Top, E>(input: {
  readonly path: string;
  readonly schema: Schema;
  readonly onReadError: (cause: unknown) => E;
  readonly onDecodeError: (cause: unknown) => E;
}) {
  const fs = yield* FileSystem.FileSystem;
  const text = yield* fs.readFileString(input.path).pipe(Effect.mapError(input.onReadError));
  return yield* decodeJsoncTextAs(input.schema)(text).pipe(Effect.mapError(input.onDecodeError));
});

/**
 * Make the parent directory and write a committed artifact verbatim.
 *
 * @remarks
 * Writes exactly `header + body`; no trailing newline is added, so a
 * {@link formatJsonc} body (which already ends in a newline) and the divergent
 * end-of-file bytes of each current writer are reproduced exactly. The mkdir
 * and write failures are mapped with the caller-supplied factory.
 *
 * @param input - Absolute artifact path, optional header block, body, and an
 * error factory.
 * @returns Effect that writes the artifact.
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { writeArtifact } from "@beep/repo-cli/test/Artifacts"
 *
 * class WriteError extends Error {}
 * const program = writeArtifact({
 *   path: "/repo/standards/example.jsonc",
 *   header: "// Do not edit by hand.\n",
 *   body: `{\n  "schema_version": 1\n}\n`,
 *   onError: (cause) => new WriteError(String(cause))
 * })
 * console.log(Effect.isEffect(program))
 * ```
 * @category filesystem
 * @since 0.0.0
 */
export const writeArtifact = Effect.fn("ArtifactIo.writeArtifact")(function* <E>(input: {
  readonly path: string;
  readonly header?: string;
  readonly body: string;
  readonly onError: (cause: unknown) => E;
}) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.makeDirectory(path.dirname(input.path), { recursive: true }).pipe(Effect.mapError(input.onError));
  yield* fs.writeFileString(input.path, `${input.header ?? ""}${input.body}`).pipe(Effect.mapError(input.onError));
});

/**
 * Render a bounded list, appending a `... N more` line when it overflows.
 *
 * @remarks
 * Reproduces the `renderDeltaLines` / `renderFindingLines` helpers copied
 * across the ratchet renderers: the first `limit` items are rendered with
 * `render`, and a single `  - ... N more` line is appended when items were
 * omitted.
 *
 * @param input - The items, a per-item renderer, and the inclusive display
 * limit.
 * @returns The rendered lines, with a trailing `... N more` line when truncated.
 * @example
 * ```ts
 * import { renderTruncatedLines } from "@beep/repo-cli/test/Artifacts"
 *
 * const lines = renderTruncatedLines({
 *   items: ["a", "b", "c"],
 *   render: (item: string) => `  - ${item}`,
 *   limit: 2
 * })
 * console.log(lines) // ["  - a", "  - b", "  - ... 1 more"]
 * ```
 * @category formatting
 * @since 0.0.0
 */
export const renderTruncatedLines = <Item>(input: {
  readonly items: ReadonlyArray<Item>;
  readonly render: (item: Item) => string;
  readonly limit: number;
}): ReadonlyArray<string> => {
  const shown = A.take(input.items, input.limit);
  const omittedCount = A.length(input.items) - A.length(shown);
  return [
    ...A.map(shown, input.render),
    ...pipe(
      omittedCount,
      O.liftPredicate((count) => count > 0),
      O.map((count) => A.of(`  - ... ${count} more`)),
      O.getOrElse(A.empty<string>)
    ),
  ];
};
