import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import {
  detectEol,
  normalizeEol,
  ScanFailure,
  ScanFailureReason,
  ScanResult,
  scan,
} from "@beep/managed-section/internal/scan";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(
    `${name}: decode(encode(x)) equals x and never fails`,
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

describe("exported schema round trips", () => {
  roundTrips("ScanFailureReason", ScanFailureReason);
  roundTrips("ScanFailure", ScanFailure);
  roundTrips("ScanResult", ScanResult);
});

import { CommentStyle } from "@beep/managed-section/CommentStyle";
import { Section } from "@beep/managed-section/Section";
import { SectionDialect } from "@beep/managed-section/SectionDialect";
import * as A from "effect/Array";
import * as Equal from "effect/Equal";
import * as Str from "effect/String";

const content = S.Literals(["a", " ", "\n", "\r\n", "😀", "\t"]).pipe(
  S.Array,
  Arbitrary.schema,
  Arbitrary.map(A.join(""))
);

it.effect.prop(
  "normalization is idempotent and line-ending detection survives canonical conversion",
  [Arbitrary.schema(S.String)],
  ([text]) =>
    Effect.sync(() => {
      const normalized = normalizeEol(text);
      assert.strictEqual(normalizeEol(normalized), normalized);
      assert.strictEqual(detectEol(text), Str.includes("\r\n")(text) ? "\r\n" : "\n");
      assert.strictEqual(detectEol(detectEol(text)), detectEol(text));
      assert.strictEqual(normalizeEol(Str.replace(/\n/g, "\r\n")(normalized)), normalized);
    }),
  runs
);

it.effect.prop(
  "scan/render fidelity retains content, attributes and identity with either EOL",
  [content, Arbitrary.schema(S.Literals(["\n", "\r\n"]))],
  ([body, eol]) =>
    Effect.gen(function* () {
      const dialect = SectionDialect.default;
      const section = Section.make({
        key: "tool",
        commentStyle: CommentStyle.hash,
        content: normalizeEol(body),
        attributes: { origin: "ci", mode: "strict" },
      });
      const rendered = yield* Effect.fromResult(dialect.render(section, eol));
      const parsed = scan(rendered, dialect);
      assert.strictEqual(parsed.ok, true);
      if (parsed.ok) {
        assert.strictEqual(parsed.sections.length, 1);
        for (const placed of parsed.sections) {
          assertTrue(Equal.equals(placed.section, section));
          assert.strictEqual(Str.slice(placed.start, placed.end)(rendered), rendered);
          const formatted = yield* Effect.fromResult(dialect.render(placed.section, eol));
          assert.strictEqual(formatted, rendered);
          const reparsed = scan(formatted, dialect);
          assert.strictEqual(reparsed.ok, true);
          if (reparsed.ok) assertTrue(Equal.equals(reparsed.sections[0]?.section, placed.section));
        }
      }
    }),
  runs
);
