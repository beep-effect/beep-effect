import { lexAll } from "@beep/yaml/internal/lexer";
import { YamlToken } from "@beep/yaml/internal/token";
import { Yaml } from "@beep/yaml/Yaml";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

const quotedTails = [
  '"hello # not"',
  "'hello # not'",
  "'hello '' # not'",
  '"hello \\" # not"',
  '"hello \\\\ # not"',
  '"hello \' # not"',
  "'hello \" # not'",
  "\"hello\" 'again # not'",
];

const invalidHeaderTokens = (header: string, newline: string): Array<YamlToken> => {
  const expected: Array<YamlToken> = [
    YamlToken.make({ kind: "error", value: header, offset: 0, length: header.length, line: 0, column: 0 }),
  ];
  if (newline !== "")
    expected.push(
      YamlToken.make({
        kind: "newline",
        value: newline,
        offset: header.length,
        length: newline.length,
        line: 0,
        column: header.length,
      })
    );
  return expected;
};

const assertQuotedHashHeader = (header: string, newline: string) => {
  const source = `${header}${newline}`;
  assert.deepStrictEqual(lexAll(source), invalidHeaderTokens(header, newline));
  assert.strictEqual(Yaml.stripComments(source), source);
  assert.strictEqual(Yaml.stripComments(source, "_"), source);
};

describe("invalid block-scalar header quoted hashes", () => {
  it.effect("keeps quoted hashes and exact error/newline spans", () =>
    Effect.sync(() => {
      for (const prefix of ["| ", "> ", "|+", ">2", "|0", "|++ "]) {
        for (const tail of quotedTails) {
          for (const newline of ["\n", "\r", "\r\n", ""]) assertQuotedHashHeader(`${prefix}${tail}`, newline);
        }
      }
    })
  );

  it.effect("splits only the real comment after a closing quote with exact spans", () =>
    Effect.sync(() => {
      for (const tail of quotedTails) {
        for (const newline of ["\n", "\r", "\r\n", ""]) {
          const header = `| ${tail}\t`;
          const comment = "# real";
          const source = `${header}${comment}${newline}`;
          const expected: Array<YamlToken> = [
            YamlToken.make({ kind: "error", value: header, offset: 0, length: header.length, line: 0, column: 0 }),
            YamlToken.make({
              kind: "comment",
              value: comment,
              offset: header.length,
              length: comment.length,
              line: 0,
              column: header.length,
            }),
          ];
          if (newline !== "")
            expected.push(
              YamlToken.make({
                kind: "newline",
                value: newline,
                offset: header.length + comment.length,
                length: newline.length,
                line: 0,
                column: header.length + comment.length,
              })
            );
          assert.deepStrictEqual(lexAll(source), expected);
          assert.strictEqual(Yaml.stripComments(source), `${header}${newline}`);
          assert.strictEqual(Yaml.stripComments(source, "_"), `${header}______${newline}`);
        }
      }
    })
  );

  it.effect("keeps unterminated quoted hashes and stops escapes at the physical header boundary", () =>
    Effect.sync(() => {
      for (const tail of ['"hello # not', "'hello # not", '"hello # not\\']) {
        for (const newline of ["\n", "\r", "\r\n", ""]) {
          const header = `> ${tail}`;
          const source = `${header}${newline}`;
          assert.deepStrictEqual(
            lexAll(source)[0],
            YamlToken.make({
              kind: "error",
              value: header,
              offset: 0,
              length: header.length,
              line: 0,
              column: 0,
            })
          );
          assert.strictEqual(Yaml.stripComments(source), source);
          assert.strictEqual(Yaml.stripComments(source, "_"), source);
        }
      }
    })
  );

  it.effect("retains the unquoted-header split and unseparated hashes after quotes", () =>
    Effect.sync(() => {
      const header = "> hello ";
      assert.deepStrictEqual(lexAll(`${header}# comment\n`), [
        YamlToken.make({ kind: "error", value: header, offset: 0, length: header.length, line: 0, column: 0 }),
        YamlToken.make({ kind: "comment", value: "# comment", offset: 8, length: 9, line: 0, column: 8 }),
        YamlToken.make({ kind: "newline", value: "\n", offset: 17, length: 1, line: 0, column: 17 }),
      ]);
      assert.strictEqual(Yaml.stripComments(`${header}# comment\n`), `${header}\n`);
      for (const tail of quotedTails) {
        const source = `| ${tail}# content\n`;
        assert.strictEqual(lexAll(source)[0]?.value, `| ${tail}# content`);
        assert.strictEqual(Yaml.stripComments(source), source);
      }
    })
  );
});
