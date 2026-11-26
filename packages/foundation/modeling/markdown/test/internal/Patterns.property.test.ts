import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { globalOf, matchFrom, stickyOf, unitAt } from "@beep/markdown/internal/patterns";
import { matchesAt } from "@beep/markdown/internal/preprocess";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const runs = { arbitrary: fcRuns(100) };
it.effect.prop(
  "cloning is idempotent and matching preserves cursor semantics without mutating the original pattern",
  [Arbitrary.schema(S.String)],
  ([prefix]) =>
    Effect.sync(() => {
      const original = /^word/giy;
      original.lastIndex = 7;
      const sticky = stickyOf(original);
      const again = stickyOf(sticky);
      assert.strictEqual(again.source, sticky.source);
      assert.strictEqual(again.flags, sticky.flags);
      sticky.lastIndex = prefix.length;
      assert.strictEqual(sticky.exec(`${prefix}WORD`)?.[0], "WORD");
      assert.strictEqual(sticky.lastIndex, prefix.length + 4);
      assert.strictEqual(again.lastIndex, 0);
      assert.strictEqual(original.lastIndex, 7);
      const global = globalOf(/word/iy);
      const clonedGlobal = globalOf(global);
      assert.strictEqual(clonedGlobal.source, global.source);
      assert.strictEqual(clonedGlobal.flags, global.flags);
      global.lastIndex = prefix.length;
      assert.strictEqual(global.exec(`${prefix}---WORD`)?.index, prefix.length + 3);
    }),
  runs
);

it.effect.prop(
  "unitAt reads one UTF-16 unit inside the subject and the empty string outside it",
  [Arbitrary.schema(S.String)],
  ([subject]) =>
    Effect.sync(() => {
      for (let index = 0; index < subject.length; index += 1) {
        assert.strictEqual(unitAt(subject, index), Str.slice(index, index + 1)(subject));
        assert.strictEqual(unitAt(index)(subject), unitAt(subject, index));
      }
      assert.strictEqual(unitAt(subject, subject.length), "");
      assert.strictEqual(unitAt(subject.length)(subject), "");
      assert.strictEqual(unitAt(subject, -1), "");
      assert.isFalse(
        /^u/.test(unitAt(subject, subject.length + 1)),
        "the EOF and out-of-range guard never returns undefined, which a regex would test as the string undefined"
      );
    }),
  runs
);

it.effect("unitAt returns each half of a surrogate pair as itself", () =>
  Effect.sync(() => {
    assert.strictEqual(unitAt("😀", 0), "\ud83d");
    assert.strictEqual(unitAt("😀", 1), "\ude00");
    assert.strictEqual(unitAt("😀", 2), "");
  })
);

it.effect.prop(
  "matchFrom and matchesAt agree in their data-first and data-last forms",
  [Arbitrary.schema(S.String)],
  ([prefix]) =>
    Effect.sync(() => {
      const subject = `${prefix}word`;
      const first = { subject, pos: prefix.length };
      const last = { subject, pos: prefix.length };
      assert.strictEqual(matchFrom(first, /^word/), "word");
      assert.strictEqual(matchFrom(/^word/)(last), "word");
      assert.strictEqual(first.pos, last.pos);
      assert.isUndefined(matchFrom(/^word/)(last));
      const sticky = /word/y;
      assert.isTrue(matchesAt(sticky, subject, prefix.length));
      assert.isTrue(matchesAt(subject, prefix.length)(sticky));
      assert.isFalse(matchesAt(subject, prefix.length + 1)(sticky));
    }),
  runs
);

it.effect("matchFrom uses an already sticky pattern as is", () =>
  Effect.sync(() => {
    const sticky = stickyOf(/^b+/);
    const cursor = { subject: "abbbc", pos: 1 };
    assert.strictEqual(matchFrom(cursor, sticky), "bbb");
    assert.strictEqual(cursor.pos, 4);
    assert.strictEqual(sticky.lastIndex, 4);
  })
);
