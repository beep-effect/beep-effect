import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { chosenMatterOf, decodeMatterLookup } from "@/PracticeMod.matters";

const encodeUnknownJson = S.encodeEffect(S.fromJsonString(S.Unknown));

const columns = ["familyKey", "docketKey", "resolution", "client"];
const unique = { data: { columns, rows: [["12345.10008", "12345.10008US01", "unique", "12345"]] } };
const result = (structuredContent: unknown) => ({ content: [], isError: false, structuredContent });

describe("matter lookup", () => {
  it.effect(
    "decodes structured content in column order and selects a unique matter",
    Effect.fnUntraced(function* () {
      const rows = yield* decodeMatterLookup(result(unique));
      assertSome(
        O.map(chosenMatterOf(rows, "10008"), (matter) => matter.docketKey),
        "12345.10008US01"
      );
      assertSome(
        O.map(chosenMatterOf("10008")(rows), (matter) => matter.reference),
        "10008"
      );
    })
  );
  it.effect(
    "decodes the real server's JSON text fallback",
    Effect.fnUntraced(function* () {
      const text = yield* encodeUnknownJson(unique);
      const rows = yield* decodeMatterLookup({ isError: false, content: [{ type: "text", text }] });
      expect(rows.length).toBe(1);
      assertSome(
        O.map(chosenMatterOf(rows, "10008"), (matter) => matter.client),
        "12345"
      );
    })
  );
  it.effect(
    "never selects ambiguous or empty results",
    Effect.fnUntraced(function* () {
      const rows = yield* decodeMatterLookup(
        result({ data: { columns, rows: [["12345.10008", "12345.10008US01", "ambiguous", "12345"]] } })
      );
      assertNone(chosenMatterOf(rows, "10008"));
      const decodedMatterLookup = yield* decodeMatterLookup(result({ data: { columns, rows: [] } }));
      assertNone(chosenMatterOf(decodedMatterLookup, "missing"));
    })
  );
  it.effect(
    "permits a uniquely resolved family without a docket",
    Effect.fnUntraced(function* () {
      const rows = yield* decodeMatterLookup(
        result({ data: { columns, rows: [["12345.10008", null, "unique", null]] } })
      );
      assertSome(
        O.map(chosenMatterOf(rows, "10008"), (matter) => matter.docketKey),
        null
      );
    })
  );
  it.effect(
    "rejects errors, malformed JSON, missing fields, and ragged columns",
    Effect.fnUntraced(function* () {
      for (const raw of [
        { ...result(unique), isError: true },
        { content: [{ type: "text", text: "{" }], isError: false },
        result({ data: { columns: ["resolution"], rows: [["unique"]] } }),
        result({ data: { columns, rows: [["12345.10008"]] } }),
      ]) {
        expect((yield* Effect.flip(decodeMatterLookup(raw)))._tag).toBe("MatterLookupUnreadable");
      }
    })
  );
  it.effect(
    "does not select contradictory unique families",
    Effect.fnUntraced(function* () {
      const rows = yield* decodeMatterLookup(
        result({
          data: {
            columns,
            rows: [
              ["12345.10008", "12345.10008US01", "unique", "12345"],
              ["12345.10009", "12345.10009US01", "unique", "12345"],
            ],
          },
        })
      );
      assertNone(chosenMatterOf(rows, "10008"));
    })
  );
});

it.effect(
  "keeps the docket the attorney explicitly named within a unique family",
  Effect.fnUntraced(function* () {
    const rows = yield* decodeMatterLookup(
      result({
        data: {
          columns,
          rows: [
            ["12345.10008", "12345.10008US01", "unique", "12345"],
            ["12345.10008", "12345.10008US02", "unique", "12345"],
          ],
        },
      })
    );
    assertSome(
      O.map(chosenMatterOf(rows, "12345.10008US02"), (matter) => matter.docketKey),
      "12345.10008US02"
    );
    assertSome(
      O.map(chosenMatterOf(rows, "10008US02"), (matter) => matter.docketKey),
      "12345.10008US02"
    );
  })
);
