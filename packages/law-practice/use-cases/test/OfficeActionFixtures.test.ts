import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const Outcome = S.Union([
  S.Struct({
    status: S.Literal("recognized"),
    finality: S.Literals(["FINAL", "NON-FINAL"]),
    finalityQuote: S.NonEmptyString,
    periodQuote: S.NonEmptyString,
  }),
  S.Struct({
    status: S.Literal("abstained"),
    code: S.Literals(["absent", "ambiguous", "unsupported", "low-quality-source", "rule-not-covered"]),
  }),
]);
const Fixture = S.Struct({
  id: S.NonEmptyString,
  modality: S.Literals(["public-form-language", "ocr-derived", "layout-derived"]),
  family: S.NonEmptyString,
  evaluationLane: S.Literals(["oracle-upstream", "full-pipeline"]),
  heldOut: S.Boolean,
  provenanceRow: S.NonEmptyString,
  diagnostic: S.Literals(["correct", "miss", "false-alarm", "split", "merge", "many-to-many"]),
  relationships: S.Array(S.Literals(["same-paragraph", "sibling", "continuation", "reading-order"])),
  outcome: Outcome,
});
const read = (name: string) =>
  Effect.flatMap(FileSystem.FileSystem, (fs) =>
    fs.readFileString(new URL(`./fixtures/office-action-structure/${name}`, import.meta.url).pathname)
  );

describe("office-action fixture truth", () => {
  it.effect("decodes the reconciled inventory and retains exact source quotes", () =>
    Effect.gen(function* () {
      const jsonl = yield* read("labels.jsonl");
      const rows = Str.split(Str.trimEnd(jsonl), "\n");
      expect(rows).toHaveLength(34);
      for (const line of rows) {
        const fixture = yield* S.decodeEffect(S.fromJsonString(Fixture))(line);
        const text = yield* read(`${fixture.id}.txt`);
        if (fixture.outcome.status === "recognized") {
          expect(Str.includes(fixture.outcome.finalityQuote)(text)).toBe(true);
          expect(Str.includes(fixture.outcome.periodQuote)(text)).toBe(true);
        }
      }
    }).pipe(Effect.provide(BunFileSystem.layer))
  );
});
