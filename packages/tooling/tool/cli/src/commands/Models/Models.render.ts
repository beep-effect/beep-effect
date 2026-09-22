/**
 * Pure rendering for `beep models`: expected locator values and the Markdown
 * generated block.
 *
 * **Details**
 *
 * Every value the projection would write is produced here and nowhere else, so
 * `check` and a future `--write` cannot disagree about what "correct" means.
 * Rendering is total on the data it is given and never reads a file, a clock,
 * or the environment.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, O, pipe, Str } from "@beep/utils";
import { Match } from "effect";
import { dual, flow } from "effect/Function";
import type { EffortLevel } from "./Models.catalog.schemas.ts";
import type { LocatorField, LocatorRender, ModelBinding, SupersededModel } from "./Models.manifest.schemas.ts";

/**
 * Opening marker of a tool-owned generated block.
 *
 * **Example** (Render a begin marker)
 *
 * ```ts
 * import { generatedBlockBegin } from "@beep/repo-cli/commands/Models"
 *
 * console.log(generatedBlockBegin("volume-pools")) // "<!-- beep-models:begin volume-pools -->"
 * ```
 *
 * @param blockId - The block identifier the locator names.
 * @returns The literal begin marker line.
 * @category utilities
 * @since 0.0.0
 */
export const generatedBlockBegin = (blockId: string): string => `<!-- beep-models:begin ${blockId} -->`;

/**
 * Closing marker of a tool-owned generated block.
 *
 * **Example** (Render an end marker)
 *
 * ```ts
 * import { generatedBlockEnd } from "@beep/repo-cli/commands/Models"
 *
 * console.log(generatedBlockEnd("volume-pools")) // "<!-- beep-models:end volume-pools -->"
 * ```
 *
 * @param blockId - The block identifier the locator names.
 * @returns The literal end marker line.
 * @category utilities
 * @since 0.0.0
 */
export const generatedBlockEnd = (blockId: string): string => `<!-- beep-models:end ${blockId} -->`;

const labelFor = (render: LocatorRender, effort: EffortLevel): O.Option<string> =>
  Match.value(render).pipe(
    Match.tag("verbatim", () => O.some<string>(effort)),
    Match.tag("effort-display-label", ({ labels }) =>
      pipe(
        labels,
        A.findFirst((entry) => entry.effort === effort),
        O.map((entry) => entry.label)
      )
    ),
    Match.exhaustive
  );

/**
 * The value a locator should hold once its binding is resolved.
 *
 * **Details**
 *
 * `model` renders the bare id, `effort` renders the effort token (or its
 * display label when the locator carries a label map), and
 * `model-effort-suffix` renders the fused `id(effort)` token the proxy's
 * Workflow children take. The result is `None` exactly when the field needs an
 * effort the binding does not carry, or when a label map has no row for the
 * binding's effort — both of which the check run reports as `invalid-effort`
 * rather than treating as a rendering failure.
 *
 * **Example** (Render each field of one binding)
 *
 * ```ts
 * import { ModelId } from "@beep/repo-cli/commands/Models"
 * import { ModelBinding, expectedLocatorValue } from "@beep/repo-cli/commands/Models"
 * import * as O from "effect/Option"
 *
 * const binding = ModelBinding.make({
 *   role: "codex.heavy",
 *   surface: "codex-cli",
 *   modelId: ("gpt-6-astra" as ModelId),
 *   effort: O.some("medium"),
 *   supersedes: [],
 *   note: O.none()
 * })
 * const render = { _tag: "verbatim" } as const
 *
 * console.log(O.getOrNull(expectedLocatorValue(binding, "model", render))) // "gpt-6-astra"
 * console.log(O.getOrNull(expectedLocatorValue(binding, "effort", render))) // "medium"
 * console.log(O.getOrNull(expectedLocatorValue(binding, "model-effort-suffix", render))) // "gpt-6-astra(medium)"
 * ```
 *
 * @param binding - The resolved `role x surface` pin.
 * @param field - Which of the binding's values the locator writes.
 * @param render - How the resolved value is spelled.
 * @returns The expected literal, or `None` when the pairing is unrenderable.
 * @category utilities
 * @since 0.0.0
 */
export const expectedLocatorValue: {
  (binding: ModelBinding, field: LocatorField, render: LocatorRender): O.Option<string>;
  (field: LocatorField, render: LocatorRender): (binding: ModelBinding) => O.Option<string>;
} = dual(
  3,
  (binding: ModelBinding, field: LocatorField, render: LocatorRender): O.Option<string> =>
    Match.value(field).pipe(
      Match.when("model", () => O.some<string>(binding.modelId)),
      Match.when("effort", () => O.flatMap(binding.effort, (effort) => labelFor(render, effort))),
      Match.when("model-effort-suffix", () => O.map(binding.effort, (effort) => `${binding.modelId}(${effort})`)),
      Match.exhaustive
    )
);

const bindingRow = (binding: ModelBinding): string =>
  `| ${binding.role} | ${binding.surface} | \`${binding.modelId}\` | ${pipe(
    binding.effort,
    O.map((effort) => `\`${effort}\``),
    O.getOrElse(() => "—")
  )} |`;

const supersededLine: (superseded: ReadonlyArray<SupersededModel>) => O.Option<string> = flow(
  A.map((entry: SupersededModel) => `${entry.id}`),
  A.match({
    onEmpty: O.none<string>,
    onNonEmpty: (ids) => O.some(`superseded: ${A.join(ids, ", ")}`),
  })
);

/**
 * The body a `md-generated-block` locator should hold.
 *
 * **Details**
 *
 * The body is the routing table for the filtered bindings, optionally followed
 * by the `superseded:` line the model-id lint keys on. Markers are *not* part
 * of the body, so a reader that extracts the region between them compares
 * like-for-like.
 *
 * **Example** (Render a one-row block body)
 *
 * ```ts
 * import { ModelBinding, ModelId, renderGeneratedBlockBody } from "@beep/repo-cli/commands/Models"
 * import * as O from "effect/Option"
 *
 * const binding = ModelBinding.make({
 *   role: "cursor.volume",
 *   surface: "cursor-seat",
 *   modelId: ("composer-2.5" as ModelId),
 *   effort: O.none(),
 *   supersedes: [],
 *   note: O.none()
 * })
 *
 * console.log(renderGeneratedBlockBody([binding], [], false).includes("composer-2.5")) // true
 * ```
 *
 * @param bindings - The bindings the block's filter selected, in manifest order.
 * @param superseded - The manifest's retired-id ledger.
 * @param includeSuperseded - Whether the block carries the `superseded:` line.
 * @returns The rendered block body without its markers.
 * @category utilities
 * @since 0.0.0
 */
export const renderGeneratedBlockBody: {
  (
    bindings: ReadonlyArray<ModelBinding>,
    superseded: ReadonlyArray<SupersededModel>,
    includeSuperseded: boolean
  ): string;
  (
    superseded: ReadonlyArray<SupersededModel>,
    includeSuperseded: boolean
  ): (bindings: ReadonlyArray<ModelBinding>) => string;
} = dual(
  3,
  (
    bindings: ReadonlyArray<ModelBinding>,
    superseded: ReadonlyArray<SupersededModel>,
    includeSuperseded: boolean
  ): string => {
    const header: ReadonlyArray<string> = ["| Role | Surface | Model | Effort |", "| --- | --- | --- | --- |"];
    const tail: ReadonlyArray<string> = includeSuperseded
      ? pipe(
          supersededLine(superseded),
          O.map((line): ReadonlyArray<string> => ["", line]),
          O.getOrElse((): ReadonlyArray<string> => [])
        )
      : [];

    return A.join([...header, ...A.map(bindings, bindingRow), ...tail], "\n");
  }
);

/**
 * Read the body a generated block currently holds.
 *
 * **Details**
 *
 * Returns `None` when either marker is absent, which the check run reports as
 * `missing-locator` — the target names a block the file does not yet own.
 *
 * **Example** (Extract a block body)
 *
 * ```ts
 * import { extractGeneratedBlock } from "@beep/repo-cli/commands/Models"
 * import * as O from "effect/Option"
 *
 * const content = "intro\n<!-- beep-models:begin x -->\nbody\n<!-- beep-models:end x -->\nouttro\n"
 * console.log(O.getOrNull(extractGeneratedBlock(content, "x"))) // "body"
 * console.log(O.isNone(extractGeneratedBlock(content, "y"))) // true
 * ```
 *
 * @param content - The whole target file's text.
 * @param blockId - The block identifier the locator names.
 * @returns The trimmed body between the markers, or `None` when absent.
 * @category utilities
 * @since 0.0.0
 */
export const extractGeneratedBlock: {
  (content: string, blockId: string): O.Option<string>;
  (blockId: string): (content: string) => O.Option<string>;
} = dual(2, (content: string, blockId: string): O.Option<string> => {
  const begin = generatedBlockBegin(blockId);
  const end = generatedBlockEnd(blockId);
  const beginIndex = content.indexOf(begin);
  const endIndex = content.indexOf(end);

  return beginIndex < 0 || endIndex < beginIndex
    ? O.none()
    : O.some(Str.trim(content.slice(beginIndex + begin.length, endIndex)));
});
