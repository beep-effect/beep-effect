import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { ReconcileInput, ReconcileOutput, reconcile } from "../../../effected/templates/internal/reconcile.ts";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(`${name}: decode(encode(x)) equals x and never fails`, [Arbitrary.schema(schema)], ([value]) =>
    Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(schema)(value);
      const decoded = yield* S.decodeEffect(schema)(encoded);
      assertTrue(S.toEquivalence(schema)(decoded, value));
      assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
    }), runs);
};

describe("exported schema round trips", () => {
  roundTrips("ReconcileInput", ReconcileInput);
  roundTrips("ReconcileOutput", ReconcileOutput);
});

import { assertFalse } from "@effect/vitest/utils";
import { CommentStyle } from "../../../effected/templates/CommentStyle.ts";
import { Section } from "../../../effected/templates/Section.ts";
import { SectionDialect } from "../../../effected/templates/SectionDialect.ts";
import { scan, normalizeEol } from "../../../effected/templates/internal/scan.ts";

const JsonText = S.fromJsonString(S.String);
const encodeText = S.encodeEffect(JsonText);

it.effect.prop("reconciliation is idempotent and preserves every byte outside declared spans including BOM and foreign blocks", [Arbitrary.schema(S.String), Arbitrary.schema(S.String), Arbitrary.schema(S.String)], ([lead, tail, body]) => Effect.gen(function* () {
  const dialect = SectionDialect.default;
  const encodedLead = yield* encodeText(lead);
  const encodedTail = yield* encodeText(tail);
  const encodedBody = yield* encodeText(body);
  const old = Section.make({ key: "tool", commentStyle: CommentStyle.hash, content: "old" });
  const updated = Section.make({ key: "tool", commentStyle: CommentStyle.hash, content: normalizeEol(encodedBody), attributes: { version: "2" } });
  const foreign = Section.make({ key: "foreign", commentStyle: CommentStyle.slash, content: "keep exactly", attributes: { owner: "other" } });
  const oldBlock = yield* Effect.fromResult(dialect.render(old));
  const newBlock = yield* Effect.fromResult(dialect.render(updated));
  const foreignBlock = yield* Effect.fromResult(dialect.render(foreign));
  const prefix = `\uFEFF${encodedLead}\r\n${foreignBlock}\r\n`;
  const suffix = `\r\n${encodedTail}\t\r\n`;
  const text = `${prefix}${oldBlock}${suffix}`;
  const parsed = scan(text, dialect);
  assert.strictEqual(parsed.ok, true);
  if (parsed.ok) {
    const result = yield* Effect.fromResult(reconcile({ text, placed: parsed.sections, declared: [updated], dialect, eol: "\n" }));
    assert.strictEqual(result.text, `${prefix}${newBlock}${suffix}`);
    const reparsed = scan(result.text, dialect);
    assert.strictEqual(reparsed.ok, true);
    if (reparsed.ok) {
      const again = yield* Effect.fromResult(reconcile({ text: result.text, placed: reparsed.sections, declared: [updated], dialect, eol: "\n" }));
      assert.strictEqual(again.text, result.text);
      assertFalse(again.changed);
      assert.deepStrictEqual(reparsed.sections.map((entry) => entry.section.key), ["foreign", "tool"]);
    }
  }
}), runs);
