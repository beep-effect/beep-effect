import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { Fixture } from "./fixtures/office-action-structure/Fixture.schema.ts";
import { fixtureTexts } from "./fixtures/office-action-structure/texts.ts";

const read = (name: string) => Effect.fromOption(HashMap.get(fixtureTexts, name), () => `Missing fixture: ${name}`);

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
    })
  );
});
