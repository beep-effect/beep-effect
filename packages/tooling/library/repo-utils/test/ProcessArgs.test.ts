import { jsonParse, jsonStringifyCompact, jsonStringifyPretty } from "@beep/repo-utils/JsonUtils";
import {
  guardLiteralArg,
  guardLiteralArgs,
  insertEndOfOptions,
  isOptionLike,
  LiteralArg,
  toLiteralArgs,
} from "@beep/repo-utils/ProcessArgs";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import * as S from "effect/Schema";

const isLiteralArg = S.is(LiteralArg);

describe("ProcessArgs", () => {
  it("neutralizes option-like data behind an end-of-options marker", () => {
    expect(isOptionLike("--privileged")).toBe(true);
    expect(isOptionLike("graph")).toBe(false);
    expect(isOptionLike("")).toBe(false);
    expect(toLiteralArgs([])).toStrictEqual([]);
    expect(toLiteralArgs(["-rf"])).toStrictEqual(["--", "-rf"]);
    expect(insertEndOfOptions(["restart"], [])).toStrictEqual(["restart"]);
    expect(insertEndOfOptions(["restart", "--"], ["name"])).toStrictEqual(["restart", "--", "name"]);
    expect(insertEndOfOptions(["restart"], ["name"])).toStrictEqual(["restart", "--", "name"]);
    expect(isLiteralArg("src/index.ts")).toBe(true);
    expect(isLiteralArg("--fix")).toBe(false);
  });

  it.effect(
    "guards literal arguments and rejects option-like data",
    Effect.fnUntraced(function* () {
      const rejected = yield* guardLiteralArg("--privileged").pipe(Effect.flip);

      expect(yield* guardLiteralArg("graph")).toBe("graph");
      expect(yield* guardLiteralArgs(["src/index.ts"])).toStrictEqual(["src/index.ts"]);
      expect(rejected._tag).toBe("OptionInjectionError");
    })
  );
});

describe("JsonUtils", () => {
  it.effect(
    "pretty-prints, compacts, and parses json",
    Effect.fnUntraced(function* () {
      const pretty = yield* jsonStringifyPretty({ ok: true });
      const compact = yield* jsonStringifyCompact({ ok: true });
      const malformed = yield* jsonParse("{").pipe(
        Effect.match({ onFailure: (error) => error._tag, onSuccess: () => "Parsed" })
      );

      expect(pretty).toContain("\n");
      expect(compact).toBe('{"ok":true}');
      expect(yield* jsonParse(compact)).toStrictEqual({ ok: true });
      expect(malformed).toBe("DomainError");
    })
  );
});
