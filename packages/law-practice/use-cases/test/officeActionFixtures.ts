import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Str from "effect/String";
import { decodeFixtureJson } from "./fixtures/office-action-structure/Fixture.schema.ts";
import { fixtureTexts } from "./fixtures/office-action-structure/texts.ts";

export const readFixture = (name: string) =>
  Effect.fromOption(HashMap.get(fixtureTexts, name), () => `Missing fixture: ${name}`);
export const fixtureInventory = Effect.gen(function* () {
  const text = yield* readFixture("labels.jsonl");
  return yield* Effect.forEach(Str.split(Str.trimEnd(text), "\n"), decodeFixtureJson, {
    concurrency: 1,
  });
});
