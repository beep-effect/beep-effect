import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import { assertDefined, assertSuccess, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  applySplice, GitConfigDiagnosticCode, matchesKey, matchesSection, scan,
  sectionIndent, sectionInsertOffset, serializeHeader, serializeValue,
} from "../../../effected/git/internal/config.ts";

const runs = { arbitrary: fcRuns(100) };
const valueText = Arbitrary.schema(S.String).pipe(Arbitrary.filter((text) => Str.includes("\0")(text) === false));
const subsectionText = valueText.pipe(Arbitrary.filter((text) => Str.includes("\n")(text) === false && Str.includes("\r")(text) === false));

// Offsets index the original spelling; semantic comparison intentionally drops
// those positions when a canonical rendering changes whitespace or quoting.
const semantics = (text: string) => A.map(scan(text).sections, (section) => ({
  name: section.name,
  subsection: section.subsection,
  entries: A.map(section.entries, (entry) => ({ key: entry.key, value: entry.value })),
}));

const canonical = (text: string): string => A.join(A.map(scan(text).sections, (section) =>
  serializeHeader(section.name, section.subsection) + "\n" + A.join(A.map(section.entries, (entry) =>
    "\t" + entry.key + (entry.value === undefined ? "" : " = " + serializeValue(entry.value)) + "\n"
  ), "")
), "");

describe("git config property floor", () => {
  it.effect.prop("a backspace escape decodes to a significant character before an arbitrary serialized value",
    [valueText],
    ([value]) => Effect.gen(function* () {
      const rendered = serializeValue(value);
      const parsed = scan("[core]\nkey = \\b" + rendered + "\n");
      assert.deepStrictEqual(parsed.diagnostics, []);
      const entry = parsed.sections[0]?.entries[0];
      assertDefined(entry);
      assert.strictEqual(entry.value, "\b" + value);
      assert.strictEqual(entry.valueLength, "\\b".length + rendered.length);
    }), runs);

  it.effect.prop("a backslash followed by a bare CR diagnoses the escape and preserves the remaining value and next entry",
    [valueText],
    ([value]) => Effect.gen(function* () {
      const prefix = "[core]\nkey = first";
      const rendered = serializeValue(value);
      const parsed = scan(prefix + "\\\r" + rendered + "\nnext = retained\n");
      assert.deepStrictEqual(parsed.diagnostics, [{
        code: "invalidEscape",
        message: 'invalid escape sequence \\\r in value of "key"',
        offset: prefix.length,
        length: 2,
      }]);
      const section = parsed.sections[0];
      assertDefined(section);
      assert.strictEqual(section.entries.length, 2);
      const entry = section.entries[0];
      assertDefined(entry);
      assert.strictEqual(entry.value, "first" + value);
      assert.strictEqual(entry.valueLength, "first\\\r".length + rendered.length);
      assert.strictEqual(section.entries[1]?.key, "next");
      assert.strictEqual(section.entries[1]?.value, "retained");
    }), runs);

  it.effect.prop("diagnostic codes encode and decode without failure or value loss",
    [Arbitrary.schema(GitConfigDiagnosticCode)],
    ([code]) => Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(GitConfigDiagnosticCode)(code);
      const decoded = yield* S.decodeEffect(GitConfigDiagnosticCode)(encoded).pipe(Effect.result);
      assertSuccess(decoded, code);
    }), runs);

  it.effect.prop("value serialization is faithful and canonical rendering is idempotent through parsing",
    [valueText],
    ([value]) => Effect.gen(function* () {
      const rendered = serializeValue(value);
      const text = "[core]\nkey = " + rendered + "\n";
      const parsed = scan(text);
      assert.deepStrictEqual(parsed.diagnostics, []);
      const entry = parsed.sections[0]?.entries[0];
      assertDefined(entry);
      assert.strictEqual(entry.value, value);
      assertDefined(entry.value);
      assert.strictEqual(serializeValue(entry.value), rendered);
      assert.deepStrictEqual(semantics(canonical(text)), semantics(text));
      assert.strictEqual(canonical(canonical(text)), canonical(text));
    }), runs);

  it.effect.prop("subsection serialization preserves case and escaped characters across repeated parsing",
    [subsectionText],
    ([subsection]) => Effect.gen(function* () {
      const header = serializeHeader("remote", subsection);
      const parsed = scan(header + "\n");
      assert.deepStrictEqual(parsed.diagnostics, []);
      const section = parsed.sections[0];
      assertDefined(section);
      assert.strictEqual(section.subsection, subsection);
      assertTrue(matchesSection(section, "REMOTE", subsection));
      assert.strictEqual(serializeHeader(section.name, section.subsection), header);
      assert.strictEqual(serializeHeader(subsection)("remote"), header);
      assert.deepStrictEqual(semantics(canonical(header)), semantics(header));
      assert.strictEqual(canonical(canonical(header)), canonical(header));
    }), runs);

  it.effect.prop("splicing a value preserves every byte outside its scanned span including BOM and comments",
    [valueText, valueText],
    ([before, after]) => Effect.gen(function* () {
      const prefix = "\uFEFF# lead\r\n[core]\r\n  Key = ";
      const suffix = " \t# untouched\r\n; tail\r\n";
      const text = prefix + serializeValue(before) + suffix;
      const parsed = scan(text);
      assert.deepStrictEqual(parsed.diagnostics, []);
      const section = parsed.sections[0];
      assertDefined(section);
      const entry = section.entries[0];
      assertDefined(entry);
      assertTrue(matchesKey(entry, "KEY"));
      const splice = { offset: entry.valueOffset, length: entry.valueLength, content: serializeValue(after) };
      const edited = applySplice(text, splice);
      assert.strictEqual(edited, prefix + serializeValue(after) + suffix);
      assert.strictEqual(applySplice(splice)(text), edited);
      const rescanned = scan(edited);
      assert.deepStrictEqual(rescanned.diagnostics, []);
      assert.strictEqual(rescanned.sections[0]?.entries[0]?.value, after);
      assert.strictEqual(sectionIndent(text, section), "  ");
      assert.strictEqual(sectionIndent(section)(text), "  ");
      assert.strictEqual(sectionInsertOffset(section), prefix.length + serializeValue(before).length + " \t# untouched\r\n".length);
    }), runs);
});
