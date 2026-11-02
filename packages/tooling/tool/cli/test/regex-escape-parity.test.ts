import { fcRuns } from "@beep/fc-runs";
import { describe, it } from "@effect/vitest";
import { assertTrue, strictEqual } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Regex from "effect/RegExp";
import * as S from "effect/Schema";
import * as Str from "effect/String";

// Oracles: the hand-rolled escapes `effect/RegExp` `escape` replaced. The first was exported from
// QualityArtifactSupport.ts and copied into Quality.rubric.ts and Docgen/internal/Local.ts; the second was
// GlobPattern.ts `escapeRegexChar`, which left `*` alone because the glob compiler consumes every `*` first.
const oracleEscape = Str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const oracleGlobCharEscape = Str.replace(/[.+?^${}()|[\]\\]/g, "\\$&");

// `Regex.escape` additionally escapes `/`. Outside unicode mode `\/` is an identity escape for `/`, so the two
// sources compile to the same pattern; every caller builds its RegExp without the `u` or `v` flag.
const slashEscaped = Str.replaceAll("/", "\\/");

const ALPHABET_WITHOUT_STAR = [
  "a",
  "Z",
  "_",
  "/",
  ".",
  "+",
  "?",
  "^",
  "$",
  "{",
  "}",
  "(",
  ")",
  "|",
  "[",
  "]",
  "\\",
  "-",
  " ",
];
const ALPHABET = [...ALPHABET_WITHOUT_STAR, "*"];

describe("effect/RegExp escape parity with the retired hand-rolled escapes", () => {
  it.prop(
    "differs from the Quality escape only by escaping `/`",
    { chars: S.Literals(ALPHABET).pipe(S.Array, Arbitrary.schema) },
    ({ chars }) => {
      const text = A.join(chars, "");
      strictEqual(Regex.escape(text), slashEscaped(oracleEscape(text)));
    },
    { arbitrary: fcRuns(300) }
  );

  it.prop(
    "differs from the glob character escape only by escaping `/` on the star-free inputs it received",
    { chars: S.Literals(ALPHABET_WITHOUT_STAR).pipe(S.Array, Arbitrary.schema) },
    ({ chars }) => {
      const text = A.join(chars, "");
      strictEqual(Regex.escape(text), slashEscaped(oracleGlobCharEscape(text)));
    },
    { arbitrary: fcRuns(300) }
  );

  it.prop(
    "compiles to a pattern that matches the same texts as the retired escape",
    {
      chars: S.Literals(ALPHABET).pipe(S.Array, Arbitrary.schema),
      noise: S.Literals(ALPHABET).pipe(S.Array, Arbitrary.schema),
    },
    ({ chars, noise }) => {
      const text = A.join(chars, "");
      const other = A.join(noise, "");
      const escaped = new RegExp(`^${Regex.escape(text)}$`);
      const retired = new RegExp(`^${oracleEscape(text)}$`);
      assertTrue(escaped.test(text));
      for (const candidate of [text, other, `${text}${other}`, `${other}${text}`]) {
        strictEqual(escaped.test(candidate), retired.test(candidate));
      }
    },
    { arbitrary: fcRuns(300) }
  );

  it("keeps the caller templates equivalent for module specifiers and package prefixes", () => {
    for (const module of ["effect/Array", "effect/Option", "effect/Record", "packages/tooling/tool/cli/"]) {
      const escaped = new RegExp(`import\\s*\\{[^}]+\\}\\s*from\\s*["']${Regex.escape(module)}["']`);
      const retired = new RegExp(`import\\s*\\{[^}]+\\}\\s*from\\s*["']${oracleEscape(module)}["']`);
      for (const line of [
        `import { map } from "${module}"`,
        `import { map } from "${module}x"`,
        'import { map } from "a"',
      ]) {
        strictEqual(escaped.test(line), retired.test(line), `${module} vs ${line}`);
      }
    }
  });
});
