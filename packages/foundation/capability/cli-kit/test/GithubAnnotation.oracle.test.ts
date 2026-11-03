import { GithubAnnotation } from "@beep/cli-kit";
import { WorkflowCommand } from "@beep/github-commands";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import { identity, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { GithubAnnotationProperties } from "@beep/cli-kit";

type Level = "error" | "warning" | "notice";
const LEVELS: ReadonlyArray<Level> = ["error", "warning", "notice"];

/** The same annotation through the oracle: its readable names for what the wire calls `line` and `col`. */
const oracle = (annotation: GithubAnnotationProperties.Encoded, message: string): string => {
  const properties = {
    ...(annotation.title === undefined ? {} : { title: annotation.title }),
    ...(annotation.file === undefined ? {} : { file: annotation.file }),
    ...(annotation.line === undefined ? {} : { startLine: annotation.line }),
    ...(annotation.endLine === undefined ? {} : { endLine: annotation.endLine }),
    ...(annotation.col === undefined ? {} : { startColumn: annotation.col }),
    ...(annotation.endColumn === undefined ? {} : { endColumn: annotation.endColumn }),
  };
  return WorkflowCommand[annotation.level](message, properties);
};

/**
 * The documented wire grammar, read independently of both implementations: `::level key=value,key=value::message`,
 * where a message escapes `%`, CR and LF and a property also `:` and `,`.
 * https://docs.github.com/en/actions/reference/workflow-commands-for-github-actions
 */
const decode = (command: string) => {
  const match = /^::(error|warning|notice)(?: ([^:]*))?::([\s\S]*)$/.exec(command);
  if (match === null) return undefined;
  const unescapeData = (text: string): string =>
    pipe(text, Str.replace(/%0D/g, "\r"), Str.replace(/%0A/g, "\n"), Str.replace(/%25/g, "%"));
  const unescapeProperty = (text: string): string =>
    unescapeData(pipe(text, Str.replace(/%3A/g, ":"), Str.replace(/%2C/g, ",")));
  const properties: Record<string, string> = {};
  for (const pair of match[2] === undefined || match[2] === "" ? [] : Str.split(match[2], ",")) {
    const at = O.getOrThrow(Str.indexOf("=")(pair));
    properties[Str.slice(0, at)(pair)] = unescapeProperty(Str.slice(at + 1)(pair));
  }
  return { level: match[1], properties, message: unescapeData(A.getUnsafe(match, 3)) };
};

const ALPHABET = ["%", "\r", "\n", ":", ",", "=", "x", " ", "2", "5", "A", "0", "D", "C", "3"];
const upTo = (length: number): ReadonlyArray<string> => {
  const out: Array<string> = [""];
  let frontier = [""];
  for (let n = 1; n <= length; n++) {
    frontier = A.flatMap(frontier, (prefix) => A.map(ALPHABET, (ch) => prefix + ch));
    out.push(...frontier);
  }
  return out;
};

const MESSAGES = [
  "",
  "plain",
  "100% done",
  "%0A literal",
  "%250A",
  "a\nb",
  "a\r\nb",
  "\r",
  "x: y, z",
  "::error::injected",
  "line one\n::error::line two",
  "%%%",
  "a%b\nc%d\r\ne: f, g",
  "日本語 👨‍👩‍👧‍👦",
];

describe("GithubAnnotation.format against the WorkflowCommand oracle", () => {
  it("a table of messages, at every level, with no properties", () => {
    for (const level of LEVELS) {
      for (const message of MESSAGES) {
        assert.strictEqual(
          GithubAnnotation.format({ level }, message),
          oracle({ level }, message),
          Result.getOrThrowWith(S.encodeUnknownResult(S.fromJsonString(S.Unknown))(message), identity)
        );
      }
    }
  });

  it("every property, alone and together, with hostile values", () => {
    const values = ["", "a.ts", "src/a:b,c.ts", "100%", "a\nb", "a\r\nb", "%3A", "x=y", ":", ",", "::", ",,"];
    for (const level of LEVELS) {
      for (const value of values) {
        for (const key of ["title", "file"] as const) {
          const annotation: GithubAnnotationProperties.Encoded = { level, [key]: value };
          assert.strictEqual(
            GithubAnnotation.format(annotation, "m"),
            oracle(annotation, "m"),
            `${level} ${key} ${Result.getOrThrowWith(S.encodeUnknownResult(S.fromJsonString(S.Unknown))(value), identity)}`
          );
        }
        const all: GithubAnnotationProperties.Encoded = {
          level,
          title: value,
          file: value,
          line: 12,
          endLine: 14,
          col: 3,
          endColumn: 9,
        };
        assert.strictEqual(
          GithubAnnotation.format(all, value),
          oracle(all, value),
          `${level} all ${Result.getOrThrowWith(S.encodeUnknownResult(S.fromJsonString(S.Unknown))(value), identity)}`
        );
      }
    }
  });

  it("the numeric properties, and the order they are written in", () => {
    const a: GithubAnnotationProperties.Encoded = { level: "error", line: 1, endLine: 2, col: 3, endColumn: 4 };
    assert.strictEqual(GithubAnnotation.format(a, "m"), oracle(a, "m"));
    assert.strictEqual(GithubAnnotation.format(a, "m"), "::error line=1,endLine=2,col=3,endColumn=4::m");
    const partial: GithubAnnotationProperties.Encoded = { level: "warning", file: "a.ts", col: 5 };
    assert.strictEqual(GithubAnnotation.format(partial, "m"), oracle(partial, "m"));
    const zero: GithubAnnotationProperties.Encoded = { level: "notice", line: 0, col: 0 };
    assert.strictEqual(
      GithubAnnotation.format(zero, "m"),
      oracle(zero, "m"),
      "a zero is a value, not an absent property"
    );
  });

  it("small-alphabet property: every message up to 3 characters, and every title and file up to 2, equals the oracle", () => {
    let cases = 0;
    for (const message of upTo(3)) {
      assert.strictEqual(
        GithubAnnotation.format({ level: "error" }, message),
        oracle({ level: "error" }, message),
        Result.getOrThrowWith(S.encodeUnknownResult(S.fromJsonString(S.Unknown))(message), identity)
      );
      cases++;
    }
    const short = upTo(2);
    for (const title of short) {
      for (const file of ["", "x", ":", ",", "%", "\n"]) {
        const annotation: GithubAnnotationProperties.Encoded = { level: "warning", title, file, line: 7 };
        assert.strictEqual(
          GithubAnnotation.format(annotation, "m"),
          oracle(annotation, "m"),
          Result.getOrThrowWith(S.encodeUnknownResult(S.fromJsonString(S.Unknown))([title, file]), identity)
        );
        cases++;
      }
    }
    assert.isAbove(cases, 3_000);
  });

  it("round-trips through the documented grammar: what GitHub decodes is what was given", () => {
    const messages = [...MESSAGES, ...upTo(2)];
    const titles = ["", "t", "a:b,c", "%3A%2C", "a\r\nb", "x=y", "::"];
    for (const message of messages) {
      for (const title of titles) {
        const annotation: GithubAnnotationProperties.Encoded = {
          level: "error",
          title,
          file: `f${title}`,
          line: 3,
          col: 4,
        };
        const decoded = decode(GithubAnnotation.format(annotation, message));
        assert.deepStrictEqual(
          decoded,
          { level: "error", properties: { title, file: `f${title}`, line: "3", col: "4" }, message },
          Result.getOrThrowWith(S.encodeUnknownResult(S.fromJsonString(S.Unknown))([message, title]), identity)
        );
      }
    }
  });

  it("a message cannot break out of its command: one line, and no second command", () => {
    for (const message of [
      "a\nb",
      "a\r\nb",
      "x\n::error::injected",
      "x\r::warning::injected",
      "::debug::x\n::add-mask::secret",
    ]) {
      const out = GithubAnnotation.format({ level: "error", title: "t\n::error::x" }, message);
      assert.notMatch(
        out,
        /[\r\n]/,
        Result.getOrThrowWith(S.encodeUnknownResult(S.fromJsonString(S.Unknown))(message), identity)
      );
      assert.lengthOf(A.fromIterable(Str.matchAll(/^::/gm)(out)), 1, "exactly one command on the line");
    }
  });

  it("percent is escaped first: an escape it makes is never escaped again", () => {
    assert.strictEqual(GithubAnnotation.format({ level: "error" }, "\n"), "::error::%0A");
    assert.strictEqual(GithubAnnotation.format({ level: "error" }, "%\n"), "::error::%25%0A");
    assert.strictEqual(GithubAnnotation.format({ level: "error", title: ":" }, ""), "::error title=%3A::");
    assert.strictEqual(GithubAnnotation.format({ level: "error", title: "%:" }, ""), "::error title=%25%3A::");
  });

  it("omits a property that is not given, so no title= appears", () => {
    assert.strictEqual(GithubAnnotation.format({ level: "notice" }, "m"), "::notice::m");
    assert.strictEqual(GithubAnnotation.format({ level: "notice", file: "a.ts" }, "m"), "::notice file=a.ts::m");
  });
});
