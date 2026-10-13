import { assert, describe, it } from "@effect/vitest";
import { assertDefined, assertFalse } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { matchesSection, scan } from "../../../effected/git/internal/config.ts";

describe("git config scanner boundary coverage", () => {
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
