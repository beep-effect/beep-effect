/**
 * Browser-only decoding of the matter lookup's columnar MCP response.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $PracticeClaudeModId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ChosenMatter } from "./PracticeMod.values.ts";

const $I = $PracticeClaudeModId.create("PracticeMod.matters");

const Envelope = S.Struct({
  data: S.Struct({ columns: S.Array(S.String), rows: S.Unknown.pipe(S.Array, S.Array) }),
});
const decodeEnvelopeJson = S.decodeUnknownEffect(S.fromJsonString(Envelope));

const MatterRow = S.Struct({
  resolution: S.Literals(["unique", "ambiguous", "none"]),
  docketKey: S.NullOr(S.NonEmptyString),
  client: S.NullOr(S.NonEmptyString),
  familyKey: S.NonEmptyString,
});
const ToolResult = S.Struct({
  isError: S.Boolean,
  structuredContent: S.optionalKey(S.Unknown),
  content: S.Array(S.Struct({ type: S.String, text: S.optionalKey(S.String) })),
});

class MatterLookupUnreadable extends S.TaggedError<MatterLookupUnreadable, { readonly brand: unique symbol }>(
  $I`MatterLookupUnreadable`
)(
  "MatterLookupUnreadable",
  { message: S.String },
  $I.annote("MatterLookupUnreadable", { description: "A matter lookup response could not be decoded safely." })
) {}
const unreadable = (issue: unknown) => MatterLookupUnreadable.make({ message: String(issue) });

/**
 * Decodes structured content or the JSON text fallback into the four matter fields.
 *
 * **Example** (Decode an empty lookup)
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { decodeMatterLookup } from "@/PracticeMod.matters"
 * const result = decodeMatterLookup({ isError: false, content: [], structuredContent: { data: { columns: [], rows: [] } } })
 * console.log(Effect.isEffect(result)) // true
 * ```
 * @category decoding
 * @since 0.0.0
 */
export const decodeMatterLookup = Effect.fn("PracticeMod.decodeMatterLookup")(function* (raw: unknown) {
  const result = yield* S.decodeUnknownEffect(ToolResult)(raw).pipe(Effect.mapError(unreadable));
  if (result.isError) return yield* unreadable("The lookup failed.");
  const envelope = yield* O.fromUndefinedOr(result.structuredContent).pipe(
    O.map((value) => S.decodeUnknownEffect(Envelope)(value)),
    O.orElse(() =>
      O.map(
        A.findFirst(result.content, (block) => block.type === "text" && block.text !== undefined),
        (block) => decodeEnvelopeJson(block.text)
      )
    ),
    O.getOrElse(() => Effect.fail(unreadable("Missing lookup content."))),
    Effect.mapError(unreadable)
  );
  return yield* Effect.forEach(
    envelope.data.rows,
    (cells) =>
      cells.length !== envelope.data.columns.length
        ? Effect.fail(unreadable("Column count does not match row width."))
        : S.decodeUnknownEffect(MatterRow)(R.fromEntries(A.zip(envelope.data.columns, cells))).pipe(
            Effect.mapError(unreadable)
          ),
    { concurrency: 1 }
  );
});

/**
 * Selects a matter only when every returned docket belongs to one uniquely resolved family.
 *
 * **Example** (Keep an empty lookup unselected)
 * ```ts
 * import * as O from "effect/Option"
 * import { chosenMatterOf } from "@/PracticeMod.matters"
 * console.log(O.isNone(chosenMatterOf([], "10008"))) // true
 * ```
 * @category constructors
 * @since 0.0.0
 */
export const chosenMatterOf: {
  (reference: string): (rows: ReadonlyArray<typeof MatterRow.Type>) => O.Option<ChosenMatter>;
  (rows: ReadonlyArray<typeof MatterRow.Type>, reference: string): O.Option<ChosenMatter>;
} = dual(
  2,
  (rows: ReadonlyArray<typeof MatterRow.Type>, reference: string): O.Option<ChosenMatter> =>
    O.flatMap(A.head(rows), (first) => {
      if (!A.every(rows, (row) => row.resolution === "unique" && row.familyKey === first.familyKey)) return O.none();
      const preferred = O.getOrElse(
        A.findFirst(
          rows,
          (row) =>
            row.docketKey === reference || (row.docketKey !== null && Str.endsWith(`.${reference}`)(row.docketKey))
        ),
        () => first
      );
      return ChosenMatter.makeOption({ reference, docketKey: preferred.docketKey, client: preferred.client });
    })
);
