import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import {
  GitConfig,
  GitConfigDiagnostic,
  GitConfigEditError,
  GitConfigEntry,
  GitConfigInclude,
  GitConfigParseError,
  GitConfigSection,
} from "@beep/git/GitConfig";
import { Gitmodules, GitmodulesEntry } from "@beep/git/Gitmodules";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(
    name,
    [Arbitrary.schema(schema)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(schema)(value);
        const decoded = yield* S.decodeEffect(schema)(encoded);
        assertTrue(S.toEquivalence(schema)(decoded, value));
        const value1 = yield* S.encodeEffect(schema)(decoded);
        assert.deepStrictEqual(value1, encoded);
      }),
    runs
  );
};

describe("GitConfig property floor", () => {
  roundTrips("GitConfigDiagnostic", GitConfigDiagnostic);
  roundTrips("GitConfigParseError", GitConfigParseError);
  roundTrips("GitConfigEditError", GitConfigEditError);
  roundTrips("GitConfigEntry", GitConfigEntry);
  roundTrips("GitConfigSection", GitConfigSection);
  roundTrips("GitConfigInclude", GitConfigInclude);
  roundTrips("GitConfig", GitConfig);

  it.effect.prop(
    "parse and stringify preserve bytes, indexed structure and formatting idempotence",
    [Arbitrary.schema(GitmodulesEntry)],
    ([entry]) =>
      Effect.gen(function* () {
        const canonical = Gitmodules.make({ entries: [entry] }).stringify();
        const text = `\ufeff# preserved comment\r\n\r\n${Str.replaceAll("\n", "\r\n")(canonical)}# trailing comment`;
        const parsed = yield* GitConfig.parse(text);
        assert.strictEqual(parsed.stringify(), text);
        const reparsed = yield* GitConfig.parse(parsed.stringify());
        assertTrue(S.toEquivalence(GitConfig)(reparsed, parsed));
        assert.strictEqual(reparsed.stringify(), parsed.stringify());
        assert.deepStrictEqual(GitConfig.parseResult(text), GitConfig.parseResult(reparsed.stringify()));
      }),
    runs
  );

  it.effect.prop(
    "surgical edits preserve surrounding comments and encoded field values",
    [Arbitrary.schema(GitmodulesEntry)],
    ([entry]) =>
      Effect.gen(function* () {
        const text = "# before\n[core]\n\turl = old # inline\n# after\n";
        const parsed = yield* GitConfig.parse(text);
        const edited = yield* Effect.fromResult(parsed.set("core", undefined, "url", entry.url));
        assert.strictEqual(Str.startsWith("# before\n[core]\n\turl = ")(edited.stringify()), true);
        assert.strictEqual(Str.endsWith(" # inline\n# after\n")(edited.stringify()), true);
        assert.deepStrictEqual(edited.getAll("core", undefined, "url"), [entry.url]);
        const repeated = yield* Effect.fromResult(edited.set("core", undefined, "url", entry.url));
        assert.strictEqual(repeated.stringify(), edited.stringify());
      }),
    runs
  );
});
