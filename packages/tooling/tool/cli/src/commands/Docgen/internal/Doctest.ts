import { extractFencedCodeBlockDetails } from "@beep/repo-docgen/Core";
import { FsUtils, findRepoRoot, resolveWorkspaceDirs } from "@beep/repo-utils";
import { A, O, Str } from "@beep/utils";
import { transform as transformDoctest } from "@effect/doctest/Transform";
import { Effect, FileSystem, flow, Hash, HashMap, Layer, MutableHashMap, Order, Path, pipe, Result } from "effect";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import { Node, SyntaxKind } from "ts-morph";
import { isDoctestSourcePath } from "../../../internal/jsdoc/DoctestSource.ts";
import {
  jsdocOwnersByStart,
  ownJSDocNodeName,
  ParseJSDocSectionsOptions,
  parseJSDocSections,
  rawJSDocSpans,
} from "../../../internal/jsdoc/JSDocSections.ts";
import { runGitLines } from "../../../internal/repo-run/index.ts";
import { createInMemoryTsMorphProject } from "../../../internal/tsmorph/index.ts";
import { DoctestAnalysisError, DoctestRewriteError } from "../Doctest.errors.ts";
import {
  ConsoleRewrite,
  DoctestCounts,
  DoctestFinding,
  DoctestReport,
  FenceInfo,
  FenceLocation,
  ImpureFence,
  MarkPlan,
  PureFence,
  TypeOnlyFence,
} from "../Doctest.schemas.ts";
import { DoctestFenceAnalyzer, DoctestFenceRewriter } from "../Doctest.service.ts";
import type { ChildProcessSpawner } from "effect/unstable/process";
import type { GitCommandErrorAdapter } from "../../../internal/repo-run/index.ts";
import type { DoctestCliConfig, ImpurityReason, PurityVerdict } from "../Doctest.schemas.ts";
import type { DoctestFenceAnalyzerShape, DoctestFenceRewriterShape } from "../Doctest.service.ts";

const normalizeSlashes = (value: string): string => Str.replace(/\\/g, "/")(value);

const sourceDigest = (source: string): string => `effect-hash:${Hash.string(source)}`;

const lineAtOffset = (source: string, offset: number): number =>
  Str.split(/\r?\n/)(Str.slice(0, offset)(source)).length;

const maskJSDocStars: (comment: string) => string = flow(
  Str.replace(/^([ \t]*)\* /gm, "$1  "),
  Str.replace(/^([ \t]*)\*(?!\/)/gm, "$1 ")
);

const ownersByJSDocStart = (file: string, source: string): MutableHashMap.MutableHashMap<number, Node> => {
  const project = createInMemoryTsMorphProject();
  const sourceFile = project.createSourceFile(file, source, { overwrite: true });
  return jsdocOwnersByStart(sourceFile);
};

const importSpecifierPattern =
  /(?:\b(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?|\bimport\s*\(|\brequire\s*\()\s*["']([^"']+)["']/g;

const importSpecifiers: (code: string) => ReadonlyArray<string> = flow(
  Str.matchAll(importSpecifierPattern),
  A.fromIterable,
  A.flatMap((match) => O.match(O.fromUndefinedOr(match[1]), { onNone: A.empty<string>, onSome: A.of }))
);

const firstMatch = (code: string, pattern: RegExp): O.Option<string> => {
  const match = pattern.exec(code);
  return match === null ? O.none() : O.some(match[0]);
};

const firstSpecifier = (
  specifiers: ReadonlyArray<string>,
  predicate: (specifier: string) => boolean
): O.Option<string> => A.findFirst(specifiers, predicate);

const specifierOrSource = (specifier: O.Option<string>, source: O.Option<string>): O.Option<string> =>
  pipe(
    specifier,
    O.orElse(() => source)
  );

const isAllowedPackageImport = (specifier: string): boolean =>
  specifier === "effect" ||
  Str.startsWith("effect/")(specifier) ||
  Str.startsWith("@effect/")(specifier) ||
  Str.startsWith("@beep/")(specifier);

const isExternalImport = (specifier: string): boolean =>
  specifier !== "react" &&
  !Str.startsWith("react/")(specifier) &&
  !Str.startsWith("./")(specifier) &&
  !Str.startsWith("../")(specifier) &&
  !Str.startsWith("node:")(specifier);

const impurity = (code: string, language: "ts" | "typescript" | "tsx"): O.Option<ImpureFence> => {
  const specifiers = importSpecifiers(code);
  const reasonAndEvidence: ReadonlyArray<readonly [ImpurityReason, O.Option<string>]> = [
    ["process-env", firstMatch(code, /\bprocess\.env\b/)],
    [
      "node-import",
      firstSpecifier(
        specifiers,
        (specifier) =>
          Str.startsWith("node:")(specifier) ||
          (Str.startsWith("@effect/platform-")(specifier) && !Str.startsWith("@effect/platform-bun")(specifier))
      ),
    ],
    [
      "file-system",
      specifierOrSource(
        firstSpecifier(specifiers, (specifier) => specifier === "effect/FileSystem"),
        firstMatch(code, /\bFileSystem\.|\bnode:fs(?:\/promises)?\b/)
      ),
    ],
    [
      "network",
      specifierOrSource(
        firstSpecifier(
          specifiers,
          (specifier) =>
            specifier === "effect/unstable/http" ||
            Str.startsWith("effect/unstable/http/")(specifier) ||
            specifier === "effect/unstable/socket"
        ),
        firstMatch(code, /\bfetch\s*\(|\bHttpClient\b/)
      ),
    ],
    [
      "child-process",
      specifierOrSource(
        firstSpecifier(
          specifiers,
          (specifier) =>
            specifier === "effect/unstable/process" || Str.startsWith("effect/unstable/process/")(specifier)
        ),
        firstMatch(code, /\bChildProcess\b|\bCommand\.make\b|\bnode:child_process\b/)
      ),
    ],
    [
      "bun-runtime",
      specifierOrSource(
        firstSpecifier(
          specifiers,
          (specifier) => specifier === "bun" || Str.startsWith("@effect/platform-bun")(specifier)
        ),
        firstMatch(code, /\bBun\./)
      ),
    ],
    [
      "database",
      specifierOrSource(
        firstSpecifier(
          specifiers,
          (specifier) => Str.startsWith("effect/unstable/sql")(specifier) || Str.startsWith("@effect/sql")(specifier)
        ),
        firstMatch(code, /\b(?:Sql|Database|Pg|Sqlite|Drizzle)\b|(?:postgres|mysql|sqlite|drizzle|pg)(?:\/|$)/i)
      ),
    ],
    [
      "external-package-import",
      firstSpecifier(specifiers, (value) => isExternalImport(value) && !isAllowedPackageImport(value)),
    ],
    [
      "relative-import",
      firstSpecifier(specifiers, (value) => Str.startsWith("./")(value) || Str.startsWith("../")(value)),
    ],
    [
      "jsx-react",
      language === "tsx"
        ? O.some("tsx")
        : pipe(
            firstSpecifier(specifiers, (value) => value === "react" || Str.startsWith("react/")(value)),
            O.orElse(() => firstMatch(code, /<\/?[A-Za-z][^>]*>/))
          ),
    ],
  ];
  return pipe(
    reasonAndEvidence,
    A.findFirst((entry) => O.isSome(entry[1])),
    O.flatMap(([reason, evidence]) => O.map(evidence, (value) => ImpureFence.make({ reason, evidence: value })))
  );
};

const isDeclaredStatement = (statement: Node): boolean =>
  (Node.isVariableStatement(statement) ||
    Node.isFunctionDeclaration(statement) ||
    Node.isClassDeclaration(statement) ||
    Node.isEnumDeclaration(statement)) &&
  statement.getFirstChildByKind(SyntaxKind.DeclareKeyword) !== undefined;

const isDeclaredModule = (statement: Node): boolean => Node.isModuleDeclaration(statement) && statement.isAmbient();

function isTypeOnlyModule(statement: Node): boolean {
  if (!Node.isModuleDeclaration(statement)) return false;
  if (isDeclaredModule(statement)) return true;
  const body = statement.getBody();
  if (body === undefined) return true;
  return Node.isModuleBlock(body) ? A.every(body.getStatements(), isTypeOnlyStatement) : isTypeOnlyModule(body);
}

function isTypeOnlyStatement(statement: Node): boolean {
  return (
    Node.isImportDeclaration(statement) ||
    Node.isTypeAliasDeclaration(statement) ||
    Node.isInterfaceDeclaration(statement) ||
    isTypeOnlyModule(statement) ||
    isDeclaredStatement(statement)
  );
}

/**
 * Classifies a TypeScript fence as runnable, impure, or runtime-vacuous.
 *
 * **Example** (Classify a pure expression)
 *
 * ```ts
 * import { classifyDoctestFence } from "@beep/repo-cli/test/Docgen"
 *
 * const verdict = classifyDoctestFence("1 + 1", "ts")
 * console.log(verdict._tag)
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const classifyDoctestFence: {
  (language: "ts" | "typescript" | "tsx"): (code: string) => PurityVerdict;
  (code: string, language: "ts" | "typescript" | "tsx"): PurityVerdict;
} = dual(2, (code: string, language: "ts" | "typescript" | "tsx"): PurityVerdict => {
  const rejected = impurity(code, language);
  if (O.isSome(rejected)) return rejected.value;

  const project = createInMemoryTsMorphProject();
  const sourceFile = project.createSourceFile(`doctest.${language === "tsx" ? "tsx" : "ts"}`, code, {
    overwrite: true,
  });
  return A.every(sourceFile.getStatements(), isTypeOnlyStatement) ? TypeOnlyFence.make({}) : PureFence.make({});
});

const namespaceForOption = (code: string): O.Option<string> => {
  const match = /import\s*\*\s*as\s+([A-Za-z_$][\w$]*)\s+from\s+["']effect\/Option["']/.exec(code);
  return match === null ? O.none() : O.fromUndefinedOr(match[1]);
};

const isIdentifierText = (node: Node, values: ReadonlyArray<string>): boolean =>
  Node.isIdentifier(node) && A.contains(values, node.getText());

type LiteralLikePredicate = (node: Node) => boolean;

const literalKeywordKinds = [SyntaxKind.TrueKeyword, SyntaxKind.FalseKeyword, SyntaxKind.NullKeyword];
const literalIdentifiers = ["undefined", "NaN", "Infinity"];

const isPrimitiveLiteral: LiteralLikePredicate = (node) =>
  Node.isStringLiteral(node) ||
  Node.isNoSubstitutionTemplateLiteral(node) ||
  Node.isNumericLiteral(node) ||
  Node.isBigIntLiteral(node) ||
  A.contains(literalKeywordKinds, node.getKind()) ||
  isIdentifierText(node, literalIdentifiers);

const isParenthesizedLiteral: LiteralLikePredicate = (node) =>
  Node.isParenthesizedExpression(node) && isLiteralLikeExpression(node.getExpression());

const isUnaryLiteral: LiteralLikePredicate = (node) =>
  Node.isPrefixUnaryExpression(node) &&
  A.contains([SyntaxKind.PlusToken, SyntaxKind.MinusToken], node.getOperatorToken()) &&
  (Node.isNumericLiteral(node.getOperand()) || isIdentifierText(node.getOperand(), ["Infinity"]));

const isArrayLiteral: LiteralLikePredicate = (node) =>
  Node.isArrayLiteralExpression(node) &&
  A.every(node.getElements(), (element) => !Node.isSpreadElement(element) && isLiteralLikeExpression(element));

const isLiteralProperty = (property: Node): boolean => {
  if (!Node.isPropertyAssignment(property)) return false;
  if (property.getNameNode().getKind() === SyntaxKind.ComputedPropertyName) return false;
  return O.match(O.fromUndefinedOr(property.getInitializer()), {
    onNone: () => false,
    onSome: isLiteralLikeExpression,
  });
};

const isObjectLiteral: LiteralLikePredicate = (node) =>
  Node.isObjectLiteralExpression(node) && A.every(node.getProperties(), isLiteralProperty);

const optionCallParts = (node: Node): O.Option<readonly [string, string, ReadonlyArray<Node>]> => {
  if (!Node.isCallExpression(node)) return O.none();
  const expression = node.getExpression();
  if (!Node.isPropertyAccessExpression(expression)) return O.none();
  return O.some([expression.getExpression().getText(), expression.getName(), node.getArguments()]);
};

const isNoneLiteral = (method: string, args: ReadonlyArray<Node>): boolean =>
  method === "none" && A.isReadonlyArrayEmpty(args);

const isSomeLiteral = (method: string, args: ReadonlyArray<Node>): boolean =>
  method === "some" &&
  args.length === 1 &&
  O.match(O.fromUndefinedOr(args[0]), {
    onNone: () => false,
    onSome: isLiteralLikeExpression,
  });

const isOptionLiteral: LiteralLikePredicate = (node) =>
  pipe(
    optionCallParts(node),
    O.exists(
      ([owner, method, args]) =>
        A.contains(["Option", "O"], owner) && (isNoneLiteral(method, args) || isSomeLiteral(method, args))
    )
  );

const literalLikePredicates: ReadonlyArray<LiteralLikePredicate> = [
  isPrimitiveLiteral,
  isParenthesizedLiteral,
  isUnaryLiteral,
  isArrayLiteral,
  isObjectLiteral,
  isOptionLiteral,
];

const isLiteralLikeExpression = (node: Node): boolean => A.some(literalLikePredicates, (predicate) => predicate(node));

const parseExpectedExpression = (expected: string): O.Option<Node> => {
  const project = createInMemoryTsMorphProject();
  const sourceFile = project.createSourceFile("expected.ts", `const expected = (${expected})`, { overwrite: true });
  const declaration = sourceFile.getVariableDeclaration("expected");
  return O.fromUndefinedOr(declaration?.getInitializer());
};

const normalizeOptionExpected = (expected: string, namespace: O.Option<string>): O.Option<string> => {
  if (!/^(?:Option|O)\.(?:some|none)\(/.test(expected)) return O.some(expected);
  return O.map(namespace, (alias) => Str.replace(/^(?:Option|O)\./, `${alias}.`)(expected));
};

const parseConsoleObservation = (line: string): O.Option<readonly [string, string]> => {
  const match = /^\s*console\.log\((.*)\);?\s*\/\/\s*(\S[\s\S]*?)\s*$/.exec(line);
  return match === null || !P.isString(match[1]) || !P.isString(match[2]) ? O.none() : O.some([match[1], match[2]]);
};

const consoleCallArgument = (statement: Node): O.Option<Node> => {
  if (!Node.isExpressionStatement(statement)) return O.none();
  const call = statement.getExpression();
  if (!Node.isCallExpression(call) || call.getArguments().length !== 1) return O.none();
  const target = call.getExpression();
  if (!Node.isPropertyAccessExpression(target) || target.hasQuestionDotToken() || target.getText() !== "console.log") {
    return O.none();
  }
  return O.filter(O.fromUndefinedOr(call.getArguments()[0]), (argument) => !Node.isSpreadElement(argument));
};

const parseConsoleCallArgument = (expressionText: string): O.Option<Node> => {
  const project = createInMemoryTsMorphProject();
  const sourceFile = project.createSourceFile("console.ts", `console.log(${expressionText})`, { overwrite: true });
  return O.flatMap(O.fromUndefinedOr(sourceFile.getStatements()[0]), consoleCallArgument);
};

const normalizedExpectedExpression = (expectedText: string, optionNamespace: O.Option<string>): O.Option<string> =>
  pipe(
    parseExpectedExpression(expectedText),
    O.filter(isLiteralLikeExpression),
    O.flatMap(() => normalizeOptionExpected(expectedText, optionNamespace))
  );

const makeConsoleRewrite = (
  lineNumber: number,
  expressionText: string,
  expectedText: string,
  optionNamespace: O.Option<string>
): O.Option<ConsoleRewrite> =>
  pipe(
    O.all({
      argument: parseConsoleCallArgument(expressionText),
      expectedExpression: normalizedExpectedExpression(expectedText, optionNamespace),
    }),
    O.map(({ argument, expectedExpression }) =>
      ConsoleRewrite.make({
        line: lineNumber,
        expression: Node.isObjectLiteralExpression(argument) ? `(${expressionText})` : expressionText,
        expectedExpression,
      })
    )
  );

const consoleRewriteForLine = (
  line: string,
  lineNumber: number,
  optionNamespace: O.Option<string>
): O.Option<ConsoleRewrite> =>
  O.flatMap(parseConsoleObservation(line), ([expressionText, expectedText]) =>
    makeConsoleRewrite(lineNumber, expressionText, expectedText, optionNamespace)
  );

/**
 * Finds console observations whose literal expectations can become inline doctest assertions.
 *
 * **Example** (Plan a console rewrite)
 *
 * ```ts
 * import { planConsoleRewrites } from "@beep/repo-cli/test/Docgen"
 *
 * const rewrites = planConsoleRewrites("console.log(1 + 1) // 2", 8)
 * console.log(rewrites[0]?.line)
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const planConsoleRewrites: {
  (startLine: number): (code: string) => ReadonlyArray<ConsoleRewrite>;
  (code: string, startLine: number): ReadonlyArray<ConsoleRewrite>;
} = dual(2, (code: string, startLine: number): ReadonlyArray<ConsoleRewrite> => {
  const namespace = namespaceForOption(code);
  return pipe(
    Str.split(/\r?\n/)(code),
    A.flatMap((line, index) =>
      O.match(consoleRewriteForLine(line, startLine + index, namespace), {
        onNone: A.empty<ConsoleRewrite>,
        onSome: A.of,
      })
    )
  );
});

/**
 * Uses the upstream doctest transform to report an invalid inline assertion.
 *
 * **Example** (Validate an assertion)
 *
 * ```ts
 * import { validateDoctestAssertions } from "@beep/repo-cli/test/Docgen"
 * import * as O from "effect/Option"
 *
 * const issue = validateDoctestAssertions("1 + 1 // => 2", "fixture.ts", 1)
 * console.log(O.isNone(issue))
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const validateDoctestAssertions: {
  (file: string, line: number): (code: string) => O.Option<string>;
  (code: string, file: string, line: number): O.Option<string>;
} = dual(
  3,
  (code: string, file: string, line: number): O.Option<string> =>
    Result.match(
      Result.try({
        try: () => transformDoctest(code, file, line),
        catch: (cause) =>
          P.hasProperty(cause, "message") && P.isString(cause.message) ? cause.message : "Invalid assertion",
      }),
      { onFailure: O.some, onSuccess: () => O.none() }
    )
);

/**
 * Quotes an Example title for doctest metadata when one delimiter remains safe.
 *
 * **Example** (Quote a doctest name)
 *
 * ```ts
 * import { quotedDoctestName } from "@beep/repo-cli/test/Docgen"
 * import * as O from "effect/Option"
 *
 * const name = quotedDoctestName("Add numbers")
 * console.log(O.getOrUndefined(name))
 * ```
 *
 * @param title - Example title to encode in fence metadata.
 * @returns Quoted metadata when either supported delimiter is safe.
 * @category testing
 * @since 0.0.0
 */
export const quotedDoctestName = (title: string): O.Option<string> =>
  !Str.includes('"')(title)
    ? O.some(`name="${title}"`)
    : !Str.includes("'")(title)
      ? O.some(`name='${title}'`)
      : O.none();

const parseFenceInfo = (raw: string): FenceInfo => {
  const normalized = Str.trim(raw);
  const language = Str.startsWith("typescript")(normalized)
    ? "typescript"
    : Str.startsWith("tsx")(normalized)
      ? "tsx"
      : "ts";
  const nameMatch = /\bname=(?:"([^"]*)"|'([^']*)'|([^\s]+))/.exec(normalized);
  const name = nameMatch === null ? O.none<string>() : O.fromUndefinedOr(nameMatch[1] ?? nameMatch[2] ?? nameMatch[3]);
  return FenceInfo.make({
    lang: language,
    markerPresent: Str.includes("import.meta.vitest")(normalized),
    ...O.getSomesStruct({ name }),
  });
};

const canonicalInfoString = (title: string): O.Option<string> =>
  O.map(quotedDoctestName(title), (name) => `ts import.meta.vitest ${name}`);

type ScannedFence = {
  readonly code: string;
  readonly codeStartLine: number;
  readonly infoString: string;
  readonly location: FenceLocation;
};

const scanSourceFences = (file: string, source: string): ReadonlyArray<ScannedFence> => {
  const owners = ownersByJSDocStart(file, source);
  return A.flatMap(rawJSDocSpans(source), (span) => {
    const masked = maskJSDocStars(span.text);
    const [details] = extractFencedCodeBlockDetails(masked);
    const exampleTitles = pipe(
      parseJSDocSections(ParseJSDocSectionsOptions.make({ commentText: span.text })).sections,
      A.filter((section) => section.name === "Example"),
      A.map((section) => section.title)
    );
    const owner = MutableHashMap.get(owners, span.start);
    return A.map(details, (detail, index) => {
      const absoluteStart = span.start + detail.fenceStart;
      const absoluteEnd = span.start + detail.fenceEnd;
      const rawCode = Str.slice(detail.codeStart, detail.codeEnd)(masked);
      const trimmedCodeOffset = O.getOrElse(Str.indexOf(detail.code)(rawCode), () => 0);
      const title = exampleTitles[index];
      return {
        code: detail.code,
        codeStartLine: lineAtOffset(source, span.start + detail.codeStart + trimmedCodeOffset),
        infoString: detail.infoString,
        location: FenceLocation.make({
          file,
          startLine: lineAtOffset(source, absoluteStart),
          endLine: lineAtOffset(source, absoluteEnd),
          ...O.getSomesStruct({
            enclosingSymbol: O.flatMap(owner, ownJSDocNodeName),
            exampleTitle: O.fromUndefinedOr(title),
          }),
        }),
      };
    });
  });
};

const markedImpureFindings = (
  fence: ScannedFence,
  info: FenceInfo,
  verdict: ImpureFence
): ReadonlyArray<DoctestFinding> =>
  info.markerPresent
    ? A.of(
        DoctestFinding.make({
          kind: "marked-impure",
          location: fence.location,
          info,
          verdict,
          message: `Marked fence is impure: ${verdict.reason} (${verdict.evidence}).`,
        })
      )
    : A.empty();

const missingTitleFinding = (
  fence: ScannedFence,
  info: FenceInfo,
  verdict: Exclude<PurityVerdict, ImpureFence>
): DoctestFinding =>
  DoctestFinding.make({
    kind: "missing-example-title",
    location: fence.location,
    info,
    verdict,
    message: "Runnable TypeScript fence has no enclosing titled Example section.",
  });

const unnameableTitleFinding = (
  fence: ScannedFence,
  info: FenceInfo,
  verdict: Exclude<PurityVerdict, ImpureFence>
): DoctestFinding =>
  DoctestFinding.make({
    kind: "unnameable-example-title",
    location: fence.location,
    info,
    verdict,
    message: "Example title contains both quote delimiters and cannot be represented by upstream metadata.",
  });

const markerFindings = (
  fence: ScannedFence,
  info: FenceInfo,
  verdict: Exclude<PurityVerdict, ImpureFence>,
  canonicalInfo: string,
  plan: O.Option<MarkPlan>
): ReadonlyArray<DoctestFinding> => {
  if (!info.markerPresent) {
    return A.of(
      DoctestFinding.make({
        kind: "pure-unmarked",
        location: fence.location,
        info,
        verdict,
        message: "Pure fence is not marked for runtime documentation testing.",
        ...O.getSomesStruct({ plan }),
      })
    );
  }
  if (fence.infoString !== canonicalInfo) {
    return A.of(
      DoctestFinding.make({
        kind: "marker-metadata-drift",
        location: fence.location,
        info,
        verdict,
        message: `Marked fence metadata must be '${canonicalInfo}'.`,
        ...O.getSomesStruct({ plan }),
      })
    );
  }
  return O.exists(plan, (value) => A.isReadonlyArrayNonEmpty(value.consoleRewrites))
    ? A.of(
        DoctestFinding.make({
          kind: "console-rewrite",
          location: fence.location,
          info,
          verdict,
          message: "Marked fence contains console observations that can become inline doctest assertions.",
          ...O.getSomesStruct({ plan }),
        })
      )
    : A.empty();
};

const typeOnlyFindings = (
  fence: ScannedFence,
  info: FenceInfo,
  verdict: Exclude<PurityVerdict, ImpureFence>,
  plan: O.Option<MarkPlan>
): ReadonlyArray<DoctestFinding> =>
  verdict._tag === "typeOnly"
    ? A.of(
        DoctestFinding.make({
          kind: "type-only",
          location: fence.location,
          info,
          verdict,
          message: "Fence is runtime-vacuous after TypeScript syntax is stripped.",
          ...O.getSomesStruct({ plan }),
        })
      )
    : A.empty();

const invalidAssertionFindings = (
  fence: ScannedFence,
  info: FenceInfo,
  verdict: Exclude<PurityVerdict, ImpureFence>
): ReadonlyArray<DoctestFinding> =>
  info.markerPresent
    ? pipe(
        validateDoctestAssertions(fence.code, fence.location.file, fence.location.startLine),
        O.map((message) =>
          DoctestFinding.make({ kind: "invalid-assertion", location: fence.location, info, verdict, message })
        ),
        O.match({ onNone: A.empty<DoctestFinding>, onSome: A.of })
      )
    : A.empty();

const findingForFence = (source: string, fence: ScannedFence): ReadonlyArray<DoctestFinding> => {
  const info = parseFenceInfo(fence.infoString);
  const verdict = classifyDoctestFence(fence.code, info.lang);
  if (verdict._tag === "impure") return markedImpureFindings(fence, info, verdict);

  const title = O.fromUndefinedOr(fence.location.exampleTitle);
  if (O.isNone(title)) return A.of(missingTitleFinding(fence, info, verdict));

  const canonical = canonicalInfoString(title.value);
  if (O.isNone(canonical)) return A.of(unnameableTitleFinding(fence, info, verdict));

  const consoleRewrites = planConsoleRewrites(fence.code, fence.codeStartLine);
  const plan = O.some(
    MarkPlan.make({
      location: fence.location,
      sourceDigest: sourceDigest(source),
      expectedInfoString: canonical.value,
      addMarker: !info.markerPresent,
      ...O.getSomesStruct({
        addName: O.isNone(O.fromUndefinedOr(info.name))
          ? O.some(Str.slice("ts import.meta.vitest ".length)(canonical.value))
          : O.none<string>(),
      }),
      consoleRewrites,
    })
  );
  return A.flatten([
    markerFindings(fence, info, verdict, canonical.value, plan),
    typeOnlyFindings(fence, info, verdict, plan),
    invalidAssertionFindings(fence, info, verdict),
  ]);
};

type DoctestSourceInspection = {
  readonly fences: number;
  readonly findings: ReadonlyArray<DoctestFinding>;
};

/**
 * Analyzes an in-memory source file without filesystem or Git dependencies.
 *
 * **Example** (Inspect empty source)
 *
 * ```ts
 * import { analyzeDoctestSourceForTesting } from "@beep/repo-cli/test/Docgen"
 *
 * const inspection = analyzeDoctestSourceForTesting("packages/example/src/index.ts", "")
 * console.log(inspection.fences)
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const analyzeDoctestSourceForTesting: {
  (source: string): (file: string) => DoctestSourceInspection;
  (file: string, source: string): DoctestSourceInspection;
} = dual(2, (file: string, source: string): DoctestSourceInspection => {
  const fences = scanSourceFences(file, source);
  return { fences: fences.length, findings: A.flatMap(fences, (fence) => findingForFence(source, fence)) };
});

const gitErrorAdapter: GitCommandErrorAdapter<DoctestAnalysisError> = {
  onSpawnFailure: (commandLine) => () => DoctestAnalysisError.make({ message: `Failed to spawn ${commandLine}.` }),
  onNonZeroExit: ({ commandLine, exitCode }) =>
    DoctestAnalysisError.make({ message: `${commandLine} failed with exit code ${exitCode}.` }),
  onTruncated: O.none(),
};

/**
 * Resolves the existing changed Doctest host files for a test-controlled repository root.
 *
 * **Example** (Build changed-file discovery)
 *
 * ```ts
 * import { discoverChangedDoctestFilesForTesting } from "@beep/repo-cli/test/Docgen"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(discoverChangedDoctestFilesForTesting("/repo")))
 * ```
 *
 * @param repoRoot - Repository root used for Git and filesystem resolution.
 * @returns Existing changed TypeScript and TSX host paths.
 * @category testing
 * @since 0.0.0
 */
export const discoverChangedDoctestFilesForTesting = Effect.fn("Doctest.discoverChangedFiles")(function* (
  repoRoot: string
) {
  const [committed, dirty, untracked] = yield* Effect.all([
    runGitLines(repoRoot, ["diff", "--name-only", "origin/main...HEAD", "--", "packages", "apps"], gitErrorAdapter),
    runGitLines(repoRoot, ["diff", "--name-only", "HEAD", "--", "packages", "apps"], gitErrorAdapter),
    runGitLines(repoRoot, ["ls-files", "--others", "--exclude-standard", "--", "packages", "apps"], gitErrorAdapter),
  ]);
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const candidates = pipe(
    [...committed, ...dirty, ...untracked],
    A.filter(isDoctestSourcePath),
    A.dedupe,
    A.sort(Order.String)
  );
  return yield* Effect.filter(candidates, (file) => fs.exists(path.join(repoRoot, file))).pipe(
    Effect.mapError(() => DoctestAnalysisError.make({ message: "Failed to inspect changed Doctest source files." }))
  );
});

const discoverFiles = Effect.fn("Doctest.discoverFiles")(function* (config: DoctestCliConfig) {
  const repoRoot = yield* findRepoRoot().pipe(
    Effect.mapError(() => DoctestAnalysisError.make({ message: "Failed to locate repository root." }))
  );
  const path = yield* Path.Path;
  const fsUtils = yield* FsUtils;
  const packagePrefix = yield* O.match(O.fromUndefinedOr(config.filter), {
    onNone: () => Effect.succeed(O.none<string>()),
    onSome: Effect.fnUntraced(function* (filter) {
      const workspaces = yield* resolveWorkspaceDirs(repoRoot).pipe(
        Effect.mapError(() => DoctestAnalysisError.make({ message: "Failed to resolve workspaces." }))
      );
      const workspace = HashMap.get(workspaces, filter);
      if (O.isNone(workspace)) {
        return yield* DoctestAnalysisError.make({ message: `Unknown workspace filter '${filter}'.` });
      }
      return O.some(`${normalizeSlashes(path.relative(repoRoot, workspace.value))}/`);
    }),
  });
  const includePatterns = A.flatMap(config.include, (pattern) => {
    if (O.isNone(packagePrefix) || Str.startsWith("packages/")(pattern) || Str.startsWith("apps/")(pattern)) {
      return A.of(pattern);
    }
    return Str.startsWith("src/")(pattern)
      ? A.of(`${packagePrefix.value}${pattern}`)
      : [`${packagePrefix.value}${pattern}`, `${packagePrefix.value}src/${pattern}`];
  });
  const selected = A.isReadonlyArrayNonEmpty(includePatterns)
    ? yield* fsUtils
        .globFiles(includePatterns, { cwd: repoRoot })
        .pipe(Effect.mapError(() => DoctestAnalysisError.make({ message: "Failed to expand doctest include globs." })))
    : O.isSome(packagePrefix)
      ? yield* fsUtils
          .globFiles([
            path.join(repoRoot, packagePrefix.value, "src", "**", "*.ts"),
            path.join(repoRoot, packagePrefix.value, "src", "**", "*.tsx"),
          ])
          .pipe(
            Effect.mapError(() => DoctestAnalysisError.make({ message: "Failed to discover package source files." }))
          )
      : yield* discoverChangedDoctestFilesForTesting(repoRoot);
  const relative = A.map(selected, (file) =>
    path.isAbsolute(file) ? normalizeSlashes(path.relative(repoRoot, file)) : normalizeSlashes(file)
  );
  return {
    repoRoot,
    files: pipe(
      relative,
      A.filter(isDoctestSourcePath),
      A.filter((file) => O.isNone(packagePrefix) || Str.startsWith(packagePrefix.value)(file)),
      A.dedupe,
      A.sort(Order.String)
    ),
  };
});

const analyzeWithServices = Effect.fn("Doctest.analyze")(function* (config: DoctestCliConfig) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const { files, repoRoot } = yield* discoverFiles(config);
  const perFile = yield* Effect.forEach(
    files,
    Effect.fnUntraced(function* (file) {
      const source = yield* fs
        .readFileString(path.join(repoRoot, file))
        .pipe(Effect.mapError(() => DoctestAnalysisError.make({ message: "Failed to read source file.", file })));
      const fences = scanSourceFences(file, source);
      return { fences, findings: A.flatMap(fences, (fence) => findingForFence(source, fence)) };
    }),
    { concurrency: 8 }
  );
  const fences = A.flatMap(perFile, (entry) => entry.fences);
  const findings = A.flatMap(perFile, (entry) => entry.findings);
  const verdicts = A.map(fences, (fence) => classifyDoctestFence(fence.code, parseFenceInfo(fence.infoString).lang));
  const infos = A.map(fences, (fence) => parseFenceInfo(fence.infoString));
  const plans = pipe(
    findings,
    A.flatMap((finding) => O.match(O.fromUndefinedOr(finding.plan), { onNone: A.empty<MarkPlan>, onSome: A.of })),
    A.dedupeWith(
      (left, right) =>
        left.location.file === right.location.file && left.location.startLine === right.location.startLine
    )
  );
  return DoctestReport.make({
    schemaVersion: "doctest-report/v1",
    config,
    counts: DoctestCounts.make({
      files: files.length,
      fences: fences.length,
      pure: A.filter(verdicts, (verdict) => verdict._tag === "pure").length,
      impure: A.filter(verdicts, (verdict) => verdict._tag === "impure").length,
      typeOnly: A.filter(verdicts, (verdict) => verdict._tag === "typeOnly").length,
      marked: A.filter(infos, (info) => info.markerPresent).length,
      unmarked: A.filter(infos, (info) => !info.markerPresent).length,
      plannedMarkers: A.filter(plans, (plan) => plan.addMarker).length,
      plannedConsoleRewrites: A.reduce(plans, 0, (count, plan) => count + plan.consoleRewrites.length),
      findings: findings.length,
    }),
    findings,
    changedFiles: [],
  });
});

const validateReport = (report: DoctestReport): Effect.Effect<void, DoctestAnalysisError> => {
  const blocking = A.filter(
    report.findings,
    (finding) => finding.kind !== "pure-unmarked" && finding.kind !== "type-only"
  );
  return A.isReadonlyArrayEmpty(blocking)
    ? Effect.void
    : DoctestAnalysisError.make({ message: `Doctest verification found ${blocking.length} blocking finding(s).` });
};

const plansByFile = (plans: ReadonlyArray<MarkPlan>): HashMap.HashMap<string, ReadonlyArray<MarkPlan>> =>
  A.reduce(plans, HashMap.empty<string, ReadonlyArray<MarkPlan>>(), (grouped, plan) =>
    HashMap.modifyAt(grouped, plan.location.file, (current) =>
      O.some(O.match(current, { onNone: () => [plan], onSome: (values) => A.append(values, plan) }))
    )
  );

const replaceSourceLine = (
  lines: ReadonlyArray<string>,
  index: number,
  replacement: string,
  error: DoctestRewriteError
): Effect.Effect<ReadonlyArray<string>, DoctestRewriteError> =>
  Effect.fromOption(A.replace(lines, index, replacement), () => error);

const applyMarkerEdit = (
  file: string,
  lines: ReadonlyArray<string>,
  plan: MarkPlan
): Effect.Effect<ReadonlyArray<string>, DoctestRewriteError> => {
  const openingIndex = plan.location.startLine - 1;
  const opening = lines[openingIndex];
  if (opening === undefined || !/(?:```|~~~)/.test(opening)) {
    return DoctestRewriteError.make({
      message: "Opening fence no longer matches the analyzed location.",
      file,
      line: plan.location.startLine,
    });
  }
  return replaceSourceLine(
    lines,
    openingIndex,
    Str.replace(/((?:```|~~~)).*$/, `$1${plan.expectedInfoString}`)(opening),
    DoctestRewriteError.make({
      message: "Opening fence no longer matches the analyzed location.",
      file,
      line: plan.location.startLine,
    })
  );
};

const applyConsoleEdit = (
  file: string,
  lines: ReadonlyArray<string>,
  rewrite: ConsoleRewrite
): Effect.Effect<ReadonlyArray<string>, DoctestRewriteError> => {
  const lineIndex = rewrite.line - 1;
  const current = lines[lineIndex];
  if (current === undefined) {
    return DoctestRewriteError.make({ message: "Console rewrite line is missing.", file, line: rewrite.line });
  }
  const indentation = /^\s*(?:\*\s*)?/.exec(current)?.[0] ?? "";
  return replaceSourceLine(
    lines,
    lineIndex,
    `${indentation}${rewrite.expression} // => ${rewrite.expectedExpression}`,
    DoctestRewriteError.make({ message: "Console rewrite line is missing.", file, line: rewrite.line })
  );
};

const initialRewrite = (lines: ReadonlyArray<string>): Effect.Effect<ReadonlyArray<string>, DoctestRewriteError> =>
  Effect.succeed(lines);

const applyConsoleEdits = (
  file: string,
  lines: ReadonlyArray<string>,
  rewrites: ReadonlyArray<ConsoleRewrite>
): Effect.Effect<ReadonlyArray<string>, DoctestRewriteError> =>
  A.reduce(rewrites, initialRewrite(lines), (updated, rewrite) =>
    Effect.flatMap(updated, (current) => applyConsoleEdit(file, current, rewrite))
  );

const applyPlanEdits = (
  file: string,
  lines: ReadonlyArray<string>,
  plan: MarkPlan
): Effect.Effect<ReadonlyArray<string>, DoctestRewriteError> =>
  Effect.flatMap(applyMarkerEdit(file, lines, plan), (marked) => applyConsoleEdits(file, marked, plan.consoleRewrites));

const applyRewritePlans = (
  file: string,
  lines: ReadonlyArray<string>,
  plans: ReadonlyArray<MarkPlan>
): Effect.Effect<ReadonlyArray<string>, DoctestRewriteError> =>
  pipe(
    plans,
    A.sort(Order.mapInput(Order.Number, (value: MarkPlan) => -value.location.startLine)),
    A.reduce(initialRewrite(lines), (updated, plan) =>
      Effect.flatMap(updated, (current) => applyPlanEdits(file, current, plan))
    )
  );

const invalidRewrittenPlan = (file: string, rewritten: string, plans: ReadonlyArray<MarkPlan>): O.Option<MarkPlan> =>
  A.findFirst(plans, (plan) => {
    const rescanned = A.findFirst(
      scanSourceFences(file, rewritten),
      (fence) => fence.location.startLine === plan.location.startLine
    );
    return (
      O.isNone(rescanned) || O.isSome(validateDoctestAssertions(rescanned.value.code, file, plan.location.startLine))
    );
  });

const validateRewrittenSource = (
  file: string,
  rewritten: string,
  plans: ReadonlyArray<MarkPlan>
): Effect.Effect<string, DoctestRewriteError> =>
  O.match(invalidRewrittenPlan(file, rewritten, plans), {
    onNone: () => Effect.succeed(rewritten),
    onSome: (plan) =>
      DoctestRewriteError.make({
        message: "Rewritten fence failed upstream doctest transform validation.",
        file,
        line: plan.location.startLine,
      }),
  });

const rewriteSource = (
  file: string,
  source: string,
  plans: ReadonlyArray<MarkPlan>
): Effect.Effect<string, DoctestRewriteError> => {
  if (A.some(plans, (plan) => plan.sourceDigest !== sourceDigest(source))) {
    return DoctestRewriteError.make({ message: "Source changed after analysis; refusing stale plan.", file });
  }
  const lines = A.fromIterable(Str.split(/\r?\n/)(source));
  return Effect.flatMap(applyRewritePlans(file, lines, plans), (rewrittenLines) =>
    validateRewrittenSource(file, A.join(rewrittenLines, Str.includes("\r\n")(source) ? "\r\n" : "\n"), plans)
  );
};

/**
 * Applies verified rewrite plans to an in-memory source string for focused tests.
 *
 * **Example** (Rewrite unchanged source)
 *
 * ```ts
 * import { rewriteDoctestSourceForTesting } from "@beep/repo-cli/test/Docgen"
 * import { Effect } from "effect"
 *
 * const rewritten = Effect.runSync(
 *   rewriteDoctestSourceForTesting("packages/example/src/index.ts", "export const value = 1", [])
 * )
 * console.log(rewritten)
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const rewriteDoctestSourceForTesting: {
  (source: string, plans: ReadonlyArray<MarkPlan>): (file: string) => Effect.Effect<string, DoctestRewriteError>;
  (file: string, source: string, plans: ReadonlyArray<MarkPlan>): Effect.Effect<string, DoctestRewriteError>;
} = dual(3, rewriteSource);

const rewriteWithServices = Effect.fn("Doctest.rewrite")(function* (plans: ReadonlyArray<MarkPlan>, write: boolean) {
  const repoRoot = yield* findRepoRoot().pipe(
    Effect.mapError(() => DoctestRewriteError.make({ message: "Failed to locate repository root.", file: "." }))
  );
  const fs = yield* FileSystem.FileSystem;
  const fsUtils = yield* FsUtils;
  const path = yield* Path.Path;
  const transformed = yield* Effect.forEach(
    HashMap.toEntries(plansByFile(plans)),
    Effect.fnUntraced(function* ([file, filePlans]) {
      const absolute = path.join(repoRoot, file);
      const source = yield* fs
        .readFileString(absolute)
        .pipe(
          Effect.mapError(() => DoctestRewriteError.make({ message: "Failed to read planned source file.", file }))
        );
      return [file, absolute, yield* rewriteSource(file, source, filePlans)] as const;
    })
  );
  if (write) {
    yield* Effect.forEach(
      transformed,
      Effect.fnUntraced(function* ([file, absolute, content]) {
        yield* fsUtils
          .modifyFile(absolute, () => content)
          .pipe(
            Effect.mapError(() => DoctestRewriteError.make({ message: "Failed to write rewritten source file.", file }))
          );
      })
    );
  }
  return A.map(transformed, ([file]) => file);
});

/**
 * Supplies the filesystem-backed doctest analyzer used by CLI commands.
 *
 * **Example** (Inspect the live analyzer layer)
 *
 * ```ts
 * import { DoctestFenceAnalyzerLive } from "@beep/repo-cli/test/Docgen"
 * import { Layer } from "effect"
 *
 * console.log(Layer.isLayer(DoctestFenceAnalyzerLive))
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const DoctestFenceAnalyzerLive = Layer.effect(
  DoctestFenceAnalyzer,
  Effect.gen(function* () {
    const context = yield* Effect.context<
      FileSystem.FileSystem | Path.Path | FsUtils | ChildProcessSpawner.ChildProcessSpawner
    >();
    return {
      analyze: Effect.fn("DoctestFenceAnalyzer.analyze")((config) =>
        analyzeWithServices(config).pipe(Effect.provide(context))
      ),
      validateMarkedAssertions: validateReport,
    };
  })
);

/**
 * Supplies the filesystem-backed doctest rewriter used by CLI commands.
 *
 * **Example** (Inspect the live rewriter layer)
 *
 * ```ts
 * import { DoctestFenceRewriterLive } from "@beep/repo-cli/test/Docgen"
 * import { Layer } from "effect"
 *
 * console.log(Layer.isLayer(DoctestFenceRewriterLive))
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const DoctestFenceRewriterLive = Layer.effect(
  DoctestFenceRewriter,
  Effect.gen(function* () {
    const context = yield* Effect.context<FileSystem.FileSystem | Path.Path | FsUtils>();
    return {
      preview: Effect.fn("DoctestFenceRewriter.preview")((plans) =>
        rewriteWithServices(plans, false).pipe(Effect.provide(context))
      ),
      write: Effect.fn("DoctestFenceRewriter.write")((plans) =>
        rewriteWithServices(plans, true).pipe(Effect.provide(context))
      ),
    };
  })
);

/**
 * Builds an analyzer layer from a test-controlled service implementation.
 *
 * **Example** (Provide a test analyzer)
 *
 * ```ts
 * import { makeDoctestAnalyzerLayer } from "@beep/repo-cli/test/Docgen"
 * import { Effect, Layer } from "effect"
 *
 * const layer = makeDoctestAnalyzerLayer({
 *   analyze: () => Effect.dieMessage("analysis is not used in this fixture"),
 *   validateMarkedAssertions: () => Effect.void
 * })
 * console.log(Layer.isLayer(layer))
 * ```
 *
 * @param service - Analyzer implementation supplied by the test.
 * @returns A layer that provides the supplied analyzer.
 * @category testing
 * @since 0.0.0
 */
export const makeDoctestAnalyzerLayer = (service: DoctestFenceAnalyzerShape) =>
  Layer.succeed(DoctestFenceAnalyzer)(service);

/**
 * Builds a rewriter layer from a test-controlled service implementation.
 *
 * **Example** (Provide a test rewriter)
 *
 * ```ts
 * import { makeDoctestRewriterLayer } from "@beep/repo-cli/test/Docgen"
 * import { Effect, Layer } from "effect"
 *
 * const layer = makeDoctestRewriterLayer({
 *   preview: () => Effect.succeed([]),
 *   write: () => Effect.succeed([])
 * })
 * console.log(Layer.isLayer(layer))
 * ```
 *
 * @param service - Rewriter implementation supplied by the test.
 * @returns A layer that provides the supplied rewriter.
 * @category testing
 * @since 0.0.0
 */
export const makeDoctestRewriterLayer = (service: DoctestFenceRewriterShape) =>
  Layer.succeed(DoctestFenceRewriter)(service);
