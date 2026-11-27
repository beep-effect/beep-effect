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

const RULE =
  "ambient process state (process.env / process.arch / process.platform) is never read behind a caller's back — " +
  "read it through ActionEnvironment, or take it as an argument (see ChildEnv's class doc). " +
  "A new sanctioned default must be added to the allowlist in test/ambientReads.test.ts WITH its reason.";

const AMBIENT_MEMBERS = HashSet.make("env", "arch", "platform");

interface Token {
  readonly kind: SyntaxKind;
  readonly start: number;
  readonly value: string;
}

interface Braces {
  depth: number;
  readonly substitutionDepths: Array<number>;
}

const steer = (scanner: ReturnType<typeof createScanner>, braces: Braces, kind: SyntaxKind): SyntaxKind => {
  if (kind === SyntaxKind.TemplateHead || kind === SyntaxKind.TemplateMiddle) {
    braces.substitutionDepths.push(braces.depth);
    return kind;
  }
  if (kind === SyntaxKind.OpenBraceToken) {
    braces.depth += 1;
    return kind;
  }
  if (kind !== SyntaxKind.CloseBraceToken || !O.contains(A.last(braces.substitutionDepths), braces.depth)) {
    braces.depth -= kind === SyntaxKind.CloseBraceToken ? 1 : 0;
    return kind;
  }
  braces.substitutionDepths.pop();
  const resumed = scanner.reScanTemplateToken(false);
  if (resumed === SyntaxKind.TemplateMiddle) braces.substitutionDepths.push(braces.depth);
  return resumed;
};

const codeTokensOf = (text: string): ReadonlyArray<Token> => {
  const scanner = createScanner(true, LanguageVariant.Standard, text);
  const braces: Braces = { depth: 0, substitutionDepths: [] };
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

const scanAmbientReads = (text: string): ReadonlyArray<{ readonly line: number; readonly text: string }> => {
  const lineStarts = computeLineStarts(text);
  const lines = Str.split(text, "\n");
  const tokens = codeTokensOf(text);
  return A.getSomes(
    A.map(tokens, (token, index) => {
      if (!endsAmbientRead(tokens, index)) return O.none();
      const zeroBasedLine = O.getOrElse(
        A.findLastIndex(lineStarts, (start) => start <= token.start),
        () => 0
      );
      return O.some({ line: zeroBasedLine + 1, text: Str.trim(lines[zeroBasedLine] ?? "") });
    })
  );
};

interface Site {
  readonly file: string;
  readonly line: number;
  readonly text: string;
}

const bySite: Order.Order<Site> = Order.combine(
  Order.mapInput(Str.Order, (site: Site) => site.file),
  Order.mapInput(Num.Order, (site: Site) => site.line)
);

const ambientReadSites = (): ReadonlyArray<Site> =>
  A.sort(
    A.flatMap(sourceModules, (file) => A.map(scanAmbientReads(sourceOf(file)), (site) => ({ file, ...site }))),
    bySite
  );

const ALLOWED: ReadonlyArray<readonly [file: string, lineText: string, whySanctioned: string]> = [
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
];

describe("ambient process reads: ActionEnvironment is the one reader; ALLOWED lists the only exceptions", () => {
  const textKey = (site: { readonly file: string; readonly text: string }) => `${site.file} :: ${site.text}`;
  const render = (site: Site) => `  ${site.file}:${site.line}: ${site.text}`;

  it("every read of process.env / process.arch / process.platform in src/ is an allowlisted site", () => {
    const actual = ambientReadSites();
    const allowed = A.map(ALLOWED, ([file, text]) => ({ file, text }));
    const unexpected = A.filter(actual, (site) => !A.some(allowed, (entry) => textKey(entry) === textKey(site)));
    const missing = A.filter(allowed, (entry) => !A.some(actual, (site) => textKey(entry) === textKey(site)));
    assert.deepStrictEqual(
      unexpected,
      [],
      `unsanctioned ambient read(s), keyed on file and line text so an edit above a site passes:\n` +
        `${pipe(unexpected, A.map(render), A.join("\n"))}\n${RULE}`
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
        'const a = "/* process.env */";',
        "// process.env",
        "const b = `${process.env.X}`;",
        "const c = process.env.Y; // trailing process.env",
      ],
      "\n"
    );
    assert.deepStrictEqual(
      scanAmbientReads(fixture),
      [
        { line: 3, text: "const b = `${process.env.X}`;" },
        { line: 4, text: "const c = process.env.Y; // trailing process.env" },
      ],
      "TypeScript's token stream, not a regex: a string literal is one token and a comment is trivia; ${…} reads count"
    );
  });

  it("the scanner resumes template text after a substitution, so `}` inside a template is not code", () => {
    const fixture = "const s = `${({ k: process.arch }).k} process.env ${process.platform}`;";
    assert.deepStrictEqual(
      A.map(scanAmbientReads(fixture), (site) => site.line),
      [1, 1],
      "after a substitution the text is template span; the object literal's own braces must not close it early"
    );
    assert.deepStrictEqual(scanAmbientReads("const t = `${1} process.env`; const u = 2;"), []);
  });

  it("a lookalike is not a read: another object's `.env`, or `process` without the member", () => {
    assert.deepStrictEqual(scanAmbientReads("const a = options.env; const b = process; const c = process.pid;"), []);
  });
});
