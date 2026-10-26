import { assert, describe, it } from "@effect/vitest";
import { computeLineStarts, createScanner, LanguageVariant, SyntaxKind } from "@typescript/native/unstable/ast";
import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Str from "effect/String";
import { sourceModules, sourceOf } from "./support/sourceGraph.ts";

/**
 * The package's rule that ambient process state is never read behind a
 * caller's back — stated in `ChildEnv`'s class doc — held structurally.
 *
 * @remarks
 * `ActionEnvironment` is THE reader of `process.env`; everything else asks
 * it, or takes the environment as an argument. The sites below are the
 * closed list of exceptions, each a documented default a caller can
 * override or a host fact no runner variable carries. A new match anywhere
 * else fails here, naming the file and line, rather than in review.
 */
const RULE =
  "ambient process state (process.env / process.arch / process.platform) is never read behind a caller's back — " +
  "read it through ActionEnvironment, or take it as an argument (see ChildEnv's class doc). " +
  "A new sanctioned default must be added to the allowlist in test/ambientReads.test.ts WITH its reason.";

const AMBIENT_MEMBERS = HashSet.make("env", "arch", "platform");

/**
 * Every `process.env` / `process.arch` / `process.platform` read in `text`,
 * found by walking TypeScript's own token stream rather than a regex over
 * comment-stripped source.
 *
 * @remarks
 * A site is the token triple `process` `.` `env|arch|platform`. The scanner
 * skips trivia, so comments never match; a string literal is one
 * `StringLiteral` token, so `"/* process.env *\/"` never matches either — the
 * two false-positive classes a regex has to approximate. Template literals
 * are the one place the scanner needs steering: after a `TemplateHead` or
 * `TemplateMiddle` the code inside `${…}` is scanned as code — a read there
 * IS a read and is counted — and when its closing brace arrives the scanner
 * is told to `reScanTemplateToken`, so the template's remaining text is a
 * template span, not code. Without that, a `}` inside a template resumes
 * scanning template text as identifiers.
 *
 * The scanner is TypeScript 7's, installed under the lab's `@typescript/native`
 * npm alias (`typescript/unstable/ast` upstream) — the
 * package's root export carries only `version` now that the compiler is
 * native, and the JS scanner moved there with a shorter signature (no
 * `ScriptTarget`) and `SyntaxKind.EndOfFile` in place of `EndOfFileToken`.
 */
/** One token of the stream, as the scanner reported it. */
interface Token {
  readonly kind: SyntaxKind;
  readonly start: number;
  /** The identifier text, for an `Identifier`; empty otherwise. */
  readonly value: string;
}

/** The brace bookkeeping that keeps template text out of the code stream. */
interface Braces {
  depth: number;
  /** One entry per open template substitution: the brace depth its `}` closes. */
  readonly open: Array<number>;
}

/**
 * The token after `kind`, steering the scanner through template literals: a
 * `}` that closes a `${…}` substitution is re-scanned as template text, so what
 * follows it is a template span (or the next `${`) and never code.
 */
const steer = (scanner: ReturnType<typeof createScanner>, braces: Braces, kind: SyntaxKind): SyntaxKind => {
  if (kind === SyntaxKind.TemplateHead || kind === SyntaxKind.TemplateMiddle) {
    braces.open.push(braces.depth);
    return kind;
  }
  if (kind === SyntaxKind.OpenBraceToken) {
    braces.depth += 1;
    return kind;
  }
  if (kind !== SyntaxKind.CloseBraceToken || !O.contains(A.last(braces.open), braces.depth)) {
    braces.depth -= kind === SyntaxKind.CloseBraceToken ? 1 : 0;
    return kind;
  }
  braces.open.pop();
  const resumed = scanner.reScanTemplateToken(false);
  if (resumed === SyntaxKind.TemplateMiddle) braces.open.push(braces.depth);
  return resumed;
};

/** The code tokens of `text`, trivia skipped and template text kept apart. */
const tokensOf = (text: string): ReadonlyArray<Token> => {
  const scanner = createScanner(true, LanguageVariant.Standard, text);
  const braces: Braces = { depth: 0, open: [] };
  const tokens: Array<Token> = [];
  for (let kind = scanner.scan(); kind !== SyntaxKind.EndOfFile; kind = scanner.scan()) {
    const settled = steer(scanner, braces, kind);
    tokens.push({
      kind: settled,
      start: scanner.getTokenStart(),
      value: settled === SyntaxKind.Identifier ? scanner.getTokenValue() : "",
    });
  }
  return tokens;
};

/** Whether the token at `index` ends a `process` `.` `env|arch|platform` triple. */
const endsAmbientRead = (tokens: ReadonlyArray<Token>, index: number): boolean => {
  const [owner, dot, member] = A.take(A.drop(tokens, index - 2), 3);
  return (
    index >= 2 &&
    member?.kind === SyntaxKind.Identifier &&
    HashSet.has(AMBIENT_MEMBERS, member.value) &&
    dot?.kind === SyntaxKind.DotToken &&
    owner?.kind === SyntaxKind.Identifier &&
    owner.value === "process"
  );
};

/**
 * Every `process.env` / `process.arch` / `process.platform` read in `text`,
 * found by walking TypeScript's own token stream rather than a regex over
 * comment-stripped source.
 *
 * **Details**
 *
 * A site is the token triple `process` `.` `env|arch|platform`. The scanner
 * skips trivia, so comments never match; a string literal is one
 * `StringLiteral` token, so `"/* process.env *\/"` never matches either — the
 * two false-positive classes a regex has to approximate. Template literals
 * are the one place the scanner needs steering (see `steer`): the code
 * inside `${…}` is scanned as code — a read there IS a read and is counted —
 * and the template's remaining text is a template span, not code.
 *
 * The scanner is TypeScript 7's, installed under the repo's
 * `@typescript/native` npm alias (`typescript/unstable/ast` upstream).
 */
const scanAmbientReads = (text: string): ReadonlyArray<{ readonly line: number; readonly text: string }> => {
  const lineStarts = computeLineStarts(text);
  const lines = Str.split(text, "\n");
  const tokens = tokensOf(text);
  return A.getSomes(
    A.map(tokens, (token, index) => {
      if (!endsAmbientRead(tokens, index)) return O.none();
      // The last line start at or before the token; 0-based.
      const line = O.getOrElse(
        A.findLastIndex(lineStarts, (start) => start <= token.start),
        () => 0
      );
      return O.some({ line: line + 1, text: Str.trim(lines[line] ?? "") });
    })
  );
};

/** One read of ambient process state in `src/`. */
interface Site {
  /** Relative to `src/`. */
  readonly file: string;
  /** 1-based. */
  readonly line: number;
  /** The line's text, trimmed. */
  readonly text: string;
}

const bySite: Order.Order<Site> = Order.combine(
  Order.mapInput(Str.Order, (site: Site) => site.file),
  Order.mapInput(Num.Order, (site: Site) => site.line)
);

/** Every read of ambient process state in `src/`, by token. */
const ambientReadSites = (): ReadonlyArray<Site> =>
  A.sort(
    A.flatMap(sourceModules, (file) => A.map(scanAmbientReads(sourceOf(file)), (site) => ({ file, ...site }))),
    bySite
  );

/**
 * The sanctioned sites, and why each is one. Keep it minimal: remove an
 * entry when its read goes away, and never add one without a reason.
 */
const ALLOWED: ReadonlyArray<readonly [string, string, string]> = [
  [
    "ActionEnvironment.ts",
    "Effect.sync(() => ({ ...process.env })),",
    "THE reader: seeds the environment once, at layer construction",
  ],
  [
    "ActionInput.ts",
    "static provider(env: Readonly<Record<string, string | undefined>> = process.env): ConfigProvider.ConfigProvider {",
    "a default parameter the caller overrides by passing an environment",
  ],
  [
    "DetachedProcess.ts",
    "env: { ...(options.base ?? process.env), ...options.env },",
    "the `base` default — the one sanctioned ambient fallback, same class as ActionInput.provider's",
  ],
  [
    "PackageManagerInstaller.ts",
    "O.match(found, { onNone: (): string => process.arch, onSome: archFromRunner })",
    "the off-runner fallback for RUNNER_ARCH, selecting the native-binary target",
  ],
  [
    "ToolInstaller.ts",
    "ToolInstaller.cachePath({ root, tool, version, arch: process.arch })",
    "the tool-cache layout's arch segment is Node's spelling by contract with the runner",
  ],
  [
    "ToolInstaller.ts",
    "ToolInstaller.cachePath({ root: testRoot(), tool, version, arch: process.arch })",
    "makeTest's cachePath default — the same arch segment `make` writes, for the same reason",
  ],
  [
    "internal/pnpmExe.ts",
    'if (process.platform !== "linux") {',
    "detectMusl: the host libc is a host fact no runner variable carries",
  ],
];

describe("ambient process reads", () => {
  // Keyed on (file, line text), not the line NUMBER: an edit above a sanctioned
  // site must not fail the gate. The number is for the report.
  const key = (site: { readonly file: string; readonly text: string }) => `${site.file} :: ${site.text}`;
  const render = (site: Site) => `  ${site.file}:${site.line}: ${site.text}`;

  it("every read of process.env / process.arch / process.platform in src/ is an allowlisted site", () => {
    const actual = ambientReadSites();
    const allowed = A.map(ALLOWED, ([file, text]) => ({ file, text }));
    const unexpected = A.filter(actual, (site) => !A.some(allowed, (entry) => key(entry) === key(site)));
    const missing = A.filter(allowed, (entry) => !A.some(actual, (site) => key(entry) === key(site)));
    assert.deepStrictEqual(
      unexpected,
      [],
      `unsanctioned ambient read(s):\n${pipe(unexpected, A.map(render), A.join("\n"))}\n${RULE}`
    );
    assert.deepStrictEqual(
      missing,
      [],
      `allowlisted site(s) no longer present — remove them from the allowlist:\n${pipe(
        missing,
        A.map((site) => `  ${site.file}: ${site.text}`),
        A.join("\n")
      )}`
    );
  });

  it("the scan can fail — it is asserting on a non-empty set with ActionEnvironment in it", () => {
    const files = A.map(ambientReadSites(), (site) => site.file);
    assert.include(files, "ActionEnvironment.ts");
  });

  it("the scanner counts code, not comments or strings, and sees inside a template substitution", () => {
    const fixture = A.join(
      [
        'const a = "/* process.env */";', // a string literal: one token, never a read
        "// process.env", // a comment: trivia, skipped
        "const b = `${process.env.X}`;", // a real read inside `${…}`
        "const c = process.env.Y; // trailing process.env", // one read, then a comment
      ],
      "\n"
    );
    assert.deepStrictEqual(scanAmbientReads(fixture), [
      { line: 3, text: "const b = `${process.env.X}`;" },
      { line: 4, text: "const c = process.env.Y; // trailing process.env" },
    ]);
  });

  it("the scanner resumes template text after a substitution, so `}` inside a template is not code", () => {
    // After `${a}` the text ` process.env ` is template span, not an
    // identifier chain; the object literal inside the substitution has its
    // own braces, which must not close the template early.
    const fixture = "const s = `${({ k: process.arch }).k} process.env ${process.platform}`;";
    assert.deepStrictEqual(
      A.map(scanAmbientReads(fixture), (site) => site.line),
      [1, 1]
    );
    assert.deepStrictEqual(scanAmbientReads("const t = `${1} process.env`; const u = 2;"), []);
  });

  it("a lookalike is not a read: another object's `.env`, or `process` without the member", () => {
    assert.deepStrictEqual(scanAmbientReads("const a = options.env; const b = process; const c = process.pid;"), []);
  });
});
