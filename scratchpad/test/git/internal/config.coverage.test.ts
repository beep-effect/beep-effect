import { assert, describe, it } from "@effect/vitest";
import { assertDefined, assertFalse } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { applySplice, matchesSection, scan } from "../../../effected/git/internal/config.ts";

describe("git config scanner boundary coverage", () => {
  it.effect("commits whitespace and raw replacement spans through LF, CRLF and EOF continuations", () =>
    Effect.gen(function* () {
      for (const ending of ["\\", "\\\n", "\\\r\n"]) {
        for (const whitespace of [" ", "\t", " \t"]) {
          for (const tail of ending === "\\" ? [""] : ["", "\n", "\r\n", "# keep\n", "; keep\r\n", " \t # keep\n"]) {
            const raw = `a${whitespace}${ending}`;
            const text = `[core]\nkey=${raw}${tail}`;
            const parsed = scan(text);
            assert.deepStrictEqual(parsed.diagnostics, []);
            const entry = parsed.sections[0]?.entries[0];
            assertDefined(entry);
            assert.strictEqual(entry.value, `a${whitespace}`);
            assert.strictEqual(entry.valueOffset, "[core]\nkey=".length);
            assert.strictEqual(entry.valueLength, raw.length);
            assert.strictEqual(entry.offset, "[core]\n".length);
            assert.strictEqual(entry.length, `key=${raw}${tail}`.length);
            const replaced = applySplice(text, { offset: entry.valueOffset, length: entry.valueLength, content: "z" });
            assert.strictEqual(replaced, `[core]\nkey=z${tail}`);
            const rescanned = scan(replaced);
            assert.deepStrictEqual(rescanned.diagnostics, []);
            assert.strictEqual(rescanned.sections[0]?.entries[0]?.value, "z");
          }
        }
      }
    }),
  );

  it.effect("continues trimming ordinary trailing whitespace outside continuation spans", () =>
    Effect.gen(function* () {
      for (const tail of [" \t", " \t\n", " \t\r\n", " \t# keep\n", " \t; keep\r\n"]) {
        const text = `[core]\nkey=a${tail}`;
        const parsed = scan(text);
        assert.deepStrictEqual(parsed.diagnostics, []);
        const entry = parsed.sections[0]?.entries[0];
        assertDefined(entry);
        assert.strictEqual(entry.value, "a");
        assert.strictEqual(entry.valueLength, 1);
        assert.strictEqual(applySplice(text, { offset: entry.valueOffset, length: entry.valueLength, content: "z" }), `[core]\nkey=z${tail}`);
      }
    }),
  );

  it.effect("skips leading unquoted whitespace after empty quotes and initial continuations with accurate spans", () =>
    Effect.gen(function* () {
      for (const [raw, value, significantRaw] of [
        ['"" \tb', "b", '"" \tb'],
        ["\\\n \tb", "b", "\\\n \tb"],
        ["\\\r\n \tb", "b", "\\\r\n \tb"],
        ['""\\\n \t"" \tb', "b", '""\\\n \t"" \tb'],
        ['"" \t', "", '""'],
        ["\\\n \t", "", "\\\n"],
        ['" " b', "  b", '" " b'],
        ['" "\\\n b', "  b", '" "\\\n b'],
        ["\\t b", "\t b", "\\t b"],
      ] as const) {
        const text = `[core]\nkey= \t${raw}\n`;
        const parsed = scan(text);
        assert.deepStrictEqual(parsed.diagnostics, []);
        const entry = parsed.sections[0]?.entries[0];
        assertDefined(entry);
        assert.strictEqual(entry.value, value);
        assert.strictEqual(entry.valueOffset, "[core]\nkey= \t".length);
        assert.strictEqual(entry.valueLength, significantRaw.length);
        assert.strictEqual(text.slice(entry.valueOffset, entry.valueOffset + entry.valueLength), significantRaw);
      }
    }),
  );

  it.effect("accepts horizontal whitespace between a quoted subsection and its closing bracket", () =>
    Effect.gen(function* () {
      const text = '[remote "Origin" \t]\nkey = value\n';
      const parsed = scan(text);
      assert.deepStrictEqual(parsed.diagnostics, []);
      const section = parsed.sections[0];
      assertDefined(section);
      assert.strictEqual(section.name, "remote");
      assert.strictEqual(section.subsection, "Origin");
      assert.strictEqual(section.bracketLength, '[remote "Origin" \t]'.length);
      assert.strictEqual(section.entries[0]?.value, "value");
    }),
  );

  it.effect("drops a CRLF continuation without dropping the following value text", () =>
    Effect.gen(function* () {
      const parsed = scan("[core]\r\nkey = first\\\r\nsecond\r\n");
      assert.deepStrictEqual(parsed.diagnostics, []);
      const section = parsed.sections[0];
      assertDefined(section);
      const entry = section.entries[0];
      assertDefined(entry);
      assert.strictEqual(entry.value, "firstsecond");
      assert.strictEqual(entry.length, "key = first\\\r\nsecond\r\n".length);
    }),
  );

  it.effect("accepts a trailing value escape at EOF and retains the preceding value and raw span", () =>
    Effect.gen(function* () {
      const text = "[core]\nkey = first\\";
      const parsed = scan(text);
      assert.deepStrictEqual(parsed.diagnostics, []);
      assert.strictEqual(parsed.sections[0]?.entries[0]?.valueLength, "first\\".length);
      assert.strictEqual(parsed.sections[0]?.entries[0]?.value, "first");
    }),
  );

  it.effect("rejects subsection escapes ending at EOF, LF or CR and recovers at the next header", () =>
    Effect.gen(function* () {
      for (const suffix of ["", "\n", "\r\n"]) {
        const malformed = '[remote "origin\\' + suffix;
        const text = suffix === "" ? malformed : malformed + "[core]\nbare\n";
        const parsed = scan(text);
        assert.deepStrictEqual(parsed.diagnostics, [{
          code: "unterminatedQuote",
          message: "unterminated subsection name",
          offset: 0,
          length: malformed.length,
        }]);
        assert.deepStrictEqual(A.map(parsed.sections, (section) => section.name), suffix === "" ? [] : ["core"]);
      }
    }),
  );

  it.effect("rejects nonterminal carriage returns after headers and malformed dotted headers", () =>
    Effect.gen(function* () {
      for (const [text, message] of [
        ["[core]\rjunk\n", "unexpected text after carriage return"],
        ["[.origin]\n", "malformed dotted section header"],
      ]) {
        assertDefined(text);
        assertDefined(message);
        const parsed = scan(text);
        assert.deepStrictEqual(parsed.sections, []);
        assert.deepStrictEqual(parsed.diagnostics, [{ code: "invalidSectionHeader", message, offset: 0, length: text.length }]);
      }
    }),
  );

  it.effect("accepts an empty dotted subsection while retaining its header span", () =>
    Effect.gen(function* () {
      const text = "[remote.]\nurl=u\n";
      const parsed = scan(text);
      assert.deepStrictEqual(parsed.diagnostics, []);
      const section = parsed.sections[0];
      assertDefined(section);
      assert.strictEqual(section.name, "remote");
      assert.strictEqual(section.subsection, "");
      assert.strictEqual(section.fold, true);
      assert.strictEqual(section.bracketLength, "[remote.]".length);
      assert.strictEqual(section.entries[0]?.value, "u");
    }),
  );

  it.effect("a plain section cannot match an address with a subsection", () =>
    Effect.gen(function* () {
      const section = scan("[remote]\n").sections[0];
      assertDefined(section);
      assertFalse(matchesSection(section, "REMOTE", "origin"));
      assertFalse(matchesSection("REMOTE", "origin")(section));
    }),
  );
});
