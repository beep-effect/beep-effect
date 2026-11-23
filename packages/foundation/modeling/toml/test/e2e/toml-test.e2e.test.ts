import { Toml, TomlParseError } from "@beep/toml/Toml";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { invalidCases, readInvalid, readValid, readValidExpected, validCases } from "../corpus.ts";
import { expectFailure } from "../expectFailure.ts";
import { assertMatchesTagged } from "./taggedJson.ts";

const TaggedJson = S.fromJsonString(S.Unknown);

const README_VALID_COUNT = 214;
const README_INVALID_COUNT = 467;

describe("toml-test compliance", () => {
  it("discovers the full vendored corpus", () => {
    assert.isAtLeast(validCases.length, README_VALID_COUNT, "valid corpus walk came up short");
    assert.isAtLeast(invalidCases.length, README_INVALID_COUNT, "invalid corpus walk came up short");
  });

  describe("valid", () => {
    for (const relPath of validCases) {
      it.effect(relPath, () =>
        Effect.gen(function* () {
          const source = readValid(relPath);
          const expected = yield* S.decodeEffect(TaggedJson)(readValidExpected(relPath));
          const actual = yield* Toml.parse(source);
          assertMatchesTagged(actual, expected, "$");
        })
      );
    }
  });

  describe("invalid", () => {
    for (const relPath of invalidCases) {
      it.effect(relPath, () =>
        Effect.gen(function* () {
          const source = readInvalid(relPath);
          const error = yield* expectFailure(Toml.parse(source));
          assert.instanceOf(error, TomlParseError);
        })
      );
    }
  });
});
