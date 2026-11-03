import { resolveKnowledgeCodeowners } from "@beep/repo-cli/commands/Knowledge";
import { resolveCodeownersOwner } from "@beep/repo-cli/commands/Skills";
import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
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

describe("CODEOWNERS last-match owners", () => {
  it("keeps both caller projections identical to the inlined resolvers", () => {
    for (const path of [...PATHS, ".agents/x.patch", "build/lib.c++", "docs/x.yaml"]) {
      deepStrictEqual(resolveKnowledgeCodeowners(CODEOWNERS, path), oracleKnowledgeOwners(CODEOWNERS, path));
      deepStrictEqual(resolveCodeownersOwner(CODEOWNERS, path), oracleSkillsOwner(CODEOWNERS, path));
    }
  });
});
