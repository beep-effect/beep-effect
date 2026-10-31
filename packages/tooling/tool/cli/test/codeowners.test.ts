import { fcRuns } from "@beep/fc-runs";
import { resolveKnowledgeCodeowners } from "@beep/repo-cli/commands/Knowledge";
import { resolveCodeownersOwner } from "@beep/repo-cli/commands/Skills";
import { codeownersPatternToRegExp, matchCodeownersOwners } from "@beep/repo-cli/test/SharedInternals";
import { describe, it } from "@effect/vitest";
import { assertNone, assertSome, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";

// Oracle: the CODEOWNERS compiler, parser and both resolvers exactly as they were inlined in
// KnowledgeDoctor.leases.ts and Skills.patches.ts before the shared module (hand-rolled escape included).
const oracleGlobTokens: Readonly<Record<string, string>> = {
  "**/": "(?:.*/)?",
  "/**": "(?:/.*)?",
  "**": ".*",
  "*": "[^/]*",
  "?": "[^/]",
};

const oracleEscapeRegExp = Str.replace(/[.+^${}()|[\]\\]/gu, "\\$&");

const oracleGlobSource = (glob: string): string =>
  A.join(
    A.map(Str.split(glob, /(\*\*\/|\/\*\*|\*\*|\*|\?)/u), (token) =>
      O.getOrElse(R.get(oracleGlobTokens, token), () => oracleEscapeRegExp(token))
    ),
    ""
  );

const oracleCodeownersPattern = (pattern: string): RegExp => {
  const directoryOnly = Str.endsWith("/")(pattern);
  const body = Str.replace(/^\/+|\/+$/gu, "")(pattern);
  const anchored = Str.startsWith("/")(pattern) || Str.includes("/")(body);
  const prefix = anchored ? "^" : "^(?:.*/)?";
  const suffix = directoryOnly ? "/.*$" : "(?:/.*)?$";
  return new RegExp(`${prefix}${oracleGlobSource(body)}${suffix}`, "u");
};

const oracleParseLine = (
  line: string
): O.Option<{ readonly pattern: RegExp; readonly owners: ReadonlyArray<string> }> =>
  pipe(
    O.liftPredicate(Str.trim(Str.replace(/(^|\s)#.*$/u, "")(line)), Str.isNonEmpty),
    O.map(Str.split(/\s+/u)),
    O.flatMap((words) =>
      O.map(A.head(words), (pattern) => ({ pattern: oracleCodeownersPattern(pattern), owners: A.drop(words, 1) }))
    )
  );

const oracleWinningRule = (codeowners: string, repoPath: string) =>
  A.findLast(A.getSomes(A.map(Str.split(codeowners, "\n"), oracleParseLine)), (rule) => rule.pattern.test(repoPath));

const oracleKnowledgeOwners = (codeowners: string, repoPath: string): ReadonlyArray<string> =>
  pipe(
    oracleWinningRule(codeowners, repoPath),
    O.map((rule) => rule.owners),
    O.getOrElse(A.empty<string>)
  );

const oracleSkillsOwner = (codeowners: string, repoPath: string): O.Option<string> =>
  O.flatMap(oracleWinningRule(codeowners, repoPath), (rule) =>
    A.isReadonlyArrayNonEmpty(rule.owners) ? O.some(A.join(rule.owners, " ")) : O.none()
  );

const PATTERNS = [
  "*",
  "**",
  "/",
  "*.yaml",
  "/.claude/skills/",
  ".claude/skills/oracle/agents/",
  "docs/**",
  "docs/**/",
  "docs/*",
  "/docs/*.md",
  "**/logs",
  "**/logs/",
  "/build/logs/",
  "apps/**/test",
  "foo/**/bar",
  "a?c.md",
  "*.c++",
  "file(1).txt",
  "[abc].ts",
  "{a,b}.md",
  "$money.ts",
  "^caret|pipe",
  "a+b/",
  "a\\b",
  "a-b/c.d",
  "//double//",
] as const;

const PATHS = [
  "",
  "README.md",
  "docs",
  "docs/README.md",
  "docs/guides/guide.md",
  "docs/a.md",
  "packages/docs/guide.md",
  ".claude/skills/oracle/SKILL.md",
  ".claude/skills/oracle/agents/openai.yaml",
  "x/.claude/skills/a",
  "config.yaml",
  "logs",
  "logs/a",
  "src/logs",
  "src/logs/a/b",
  "build/logs/x",
  "apps/test",
  "apps/test/x",
  "apps/web/unit/test",
  "foo/bar",
  "foo/x/y/bar",
  "foo/bar/baz",
  "abc.md",
  "aXc.md",
  "a/c.md",
  "lib.c++",
  "libxc++",
  "file(1).txt",
  "file1.txt",
  "[abc].ts",
  "a.ts",
  "{a,b}.md",
  "a.md",
  "$money.ts",
  "^caret|pipe",
  "caret",
  "a+b/c",
  "aab/c",
  "a\\b",
  "a-b/c.d",
  "a-b/cxd",
  "double/x",
] as const;

const PATTERN_ALPHABET = ["a", "b", "/", "*", "?", ".", "+", "(", ")", "[", "]", "{", "}", "|", "^", "$", "\\", "-"];
const PATH_ALPHABET = ["a", "b", "/", ".", "+", "(", ")", "[", "]", "{", "}", "|", "^", "$", "\\", "-"];

const CODEOWNERS = A.join(
  [
    "# Single-operator laboratory.",
    "* @kriegcloud",
    "/.claude/skills/ @skills",
    "*.yaml @yaml-owner",
    "docs/** @docs",
    ".claude/skills/oracle/agents/",
    "/.agents/ @agents @kriegcloud # trailing comment",
    "   ",
    "build/*.c++\t@native",
    "",
  ],
  "\n"
);

describe("CODEOWNERS shared compiler", () => {
  it("matches every pattern x path pair exactly as the inlined compiler did", () => {
    for (const pattern of PATTERNS) {
      const compiled = codeownersPatternToRegExp(pattern);
      const oracle = oracleCodeownersPattern(pattern);
      for (const path of PATHS) {
        strictEqual(compiled.test(path), oracle.test(path), `${pattern} vs ${path}`);
      }
    }
  });

  it("keeps the documented gitignore anchoring", () => {
    strictEqual(codeownersPatternToRegExp("docs/**").test("docs/guides/guide.md"), true);
    strictEqual(codeownersPatternToRegExp("docs/**").test("packages/docs/guide.md"), false);
    strictEqual(codeownersPatternToRegExp("*.yaml").test("a/b/config.yaml"), true);
    strictEqual(codeownersPatternToRegExp("/build/logs/").test("build/logs"), false);
    strictEqual(codeownersPatternToRegExp("/build/logs/").test("build/logs/x"), true);
    strictEqual(codeownersPatternToRegExp("a?c.md").test("a/c.md"), false);
    strictEqual(codeownersPatternToRegExp("file(1).txt").test("file1.txt"), false);
  });

  it.prop(
    "agrees with the inlined compiler on generated metacharacter-heavy patterns and paths",
    {
      patternChars: S.Literals(PATTERN_ALPHABET).pipe(S.Array, Arbitrary.schema),
      pathChars: S.Literals(PATH_ALPHABET).pipe(S.Array, Arbitrary.schema),
    },
    ({ patternChars, pathChars }) => {
      const pattern = A.join(patternChars, "");
      const path = A.join(pathChars, "");
      strictEqual(codeownersPatternToRegExp(pattern).test(path), oracleCodeownersPattern(pattern).test(path));
    },
    { arbitrary: fcRuns(300) }
  );
});

describe("CODEOWNERS last-match owners", () => {
  it("returns None when no line matches and Some of the winning owners otherwise", () => {
    assertNone(matchCodeownersOwners("docs/ @docs\n", "README.md"));
    assertSome(matchCodeownersOwners(CODEOWNERS, ".agents/x.patch"), ["@agents", "@kriegcloud"]);
    assertSome(matchCodeownersOwners(CODEOWNERS, ".claude/skills/oracle/agents/openai.yaml"), []);
    assertSome(matchCodeownersOwners(".claude/skills/oracle/SKILL.md")(CODEOWNERS), ["@skills"]);
    assertSome(matchCodeownersOwners(CODEOWNERS, "build/lib.c++"), ["@native"]);
  });

  it("keeps both caller projections identical to the inlined resolvers", () => {
    for (const path of [...PATHS, ".agents/x.patch", "build/lib.c++", "docs/x.yaml"]) {
      deepStrictEqual(resolveKnowledgeCodeowners(CODEOWNERS, path), oracleKnowledgeOwners(CODEOWNERS, path));
      deepStrictEqual(resolveCodeownersOwner(CODEOWNERS, path), oracleSkillsOwner(CODEOWNERS, path));
    }
  });
});
