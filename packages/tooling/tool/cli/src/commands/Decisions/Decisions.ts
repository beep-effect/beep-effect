/**
 * `beep decisions` core: parse package code-decision files, resolve their
 * `governs` and `enforcedBy` anchors with the TypeScript AST, resolve every
 * `// decision: <slug>` pointer in tracked source, and list the decisions that
 * govern a file.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Git } from "@beep/git/Git";
import { GitCommand } from "@beep/git/GitCommand";
import { findRepoRoot } from "@beep/repo-utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Struct from "effect/Struct";
import { ts } from "ts-morph";
import { readDecisionFrontmatter } from "../../internal/decisions/DecisionFile.ts";
import { adaptGitKitError } from "../../internal/repo-run/GitExec.ts";
import { CodeDecisionsExecutionError } from "./Decisions.errors.ts";
import {
  CODE_DECISIONS_DIR,
  CodeDecision,
  CodeDecisionBody,
  CodeDecisionCheckReport,
  CodeDecisionFrontmatter,
  CodeDecisionLintEnforcer,
  CodeDecisionMatch,
  CodeDecisionPointer,
  CodeDecisionProblem,
  CodeDecisionProblemKind,
} from "./Decisions.schemas.ts";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { DecisionFrontmatterReader } from "../../internal/decisions/DecisionFile.ts";
import type { GitCommandErrorAdapter } from "../../internal/repo-run/GitExec.ts";

const REGULAR_FILE_MODES = HashSet.make("100644", "100755");

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"];

const TEST_CALLEES = HashSet.make("describe", "it", "test", "suite");

const DECISION_FILE_PATH = /^(?:packages|apps)\/(?:.+\/)?decisions\/[^/]+\.md$/u;

const DECISION_FILE_SLUG = /^\d{4}-\d{2}-\d{2}-(.+)\.md$/u;

const POINTER_COMMENT = /^\/\/\s*decision: ([a-z0-9][a-z0-9-]*)\s*$/u;

const READ_CONCURRENCY = 32;

const codeDecisionReader: DecisionFrontmatterReader<CodeDecisionFrontmatter> = {
  schemaName: "CodeDecisionFrontmatter",
  requiredKeys: "title, date, reversal, governs, enforcedBy",
  allowedKeys: Struct.keys(CodeDecisionFrontmatter.fields),
  decode: S.decodeUnknownEffect(CodeDecisionFrontmatter, { onExcessProperty: "error", errors: "all" }),
};

const decodeBody = S.decodeUnknownResult(CodeDecisionBody);

const isLintEnforcer = S.is(CodeDecisionLintEnforcer);

const gitErrors: GitCommandErrorAdapter<CodeDecisionsExecutionError> = {
  onSpawnFailure: (commandLine) => () => CodeDecisionsExecutionError.new(`Failed to spawn ${commandLine}.`),
  onNonZeroExit: ({ commandLine, exitCode }) =>
    CodeDecisionsExecutionError.new(`${commandLine} failed with exit code ${exitCode}.`),
  onTruncated: O.none(),
};

const problem = (kind: CodeDecisionProblemKind, file: string, message: string): CodeDecisionProblem =>
  CodeDecisionProblem.make({ kind, file, message });

const byFile: Order.Order<{ readonly file: string }> = Order.mapInput(
  Order.String,
  (entry: { readonly file: string }) => entry.file
);

const scriptKindOf = (file: string): ts.ScriptKind => {
  if (Str.endsWith(".tsx")(file)) {
    return ts.ScriptKind.TSX;
  }
  if (Str.endsWith(".jsx")(file)) {
    return ts.ScriptKind.JSX;
  }
  if (A.some([".js", ".mjs", ".cjs"], (extension) => Str.endsWith(extension)(file))) {
    return ts.ScriptKind.JS;
  }
  return ts.ScriptKind.TS;
};

const parseSource = (file: string, text: string): ts.SourceFile =>
  ts.createSourceFile(file, text, ts.ScriptTarget.Latest, false, scriptKindOf(file));

/**
 * Whether a path names a TypeScript or JavaScript source file.
 *
 * **Example** (Classify paths)
 *
 * ```ts
 * import { isCodeDecisionSourcePath } from "@beep/repo-cli/commands/Decisions"
 *
 * console.log(isCodeDecisionSourcePath("src/Git.ts")) // true
 * console.log(isCodeDecisionSourcePath("README.md")) // false
 * ```
 *
 * @param file - Repository- or package-relative path.
 * @returns `true` for `.ts`, `.tsx`, `.mts`, `.cts`, `.js`, `.jsx`, `.mjs` and `.cjs` files.
 * @category predicates
 * @since 0.0.0
 */
export const isCodeDecisionSourcePath = (file: string): boolean =>
  A.some(SOURCE_EXTENSIONS, (extension) => Str.endsWith(extension)(file));

const statementNames = (statement: ts.Statement): ReadonlyArray<string> => {
  if (ts.isVariableStatement(statement)) {
    return A.flatMap(statement.declarationList.declarations, (declaration) =>
      ts.isIdentifier(declaration.name) ? [declaration.name.text] : A.empty<string>()
    );
  }
  if (
    ts.isFunctionDeclaration(statement) ||
    ts.isClassDeclaration(statement) ||
    ts.isInterfaceDeclaration(statement) ||
    ts.isTypeAliasDeclaration(statement) ||
    ts.isEnumDeclaration(statement)
  ) {
    return statement.name === undefined ? A.empty() : [statement.name.text];
  }
  return A.empty();
};

/**
 * Names of the top-level declarations of one source file, read from the
 * TypeScript AST.
 *
 * **Details**
 *
 * Variable statements (each identifier-named declarator), functions, classes,
 * interfaces, type aliases and enums count, exported or not. Nested
 * declarations, destructured bindings and namespaces do not.
 *
 * **Example** (Read declaration names)
 *
 * ```ts
 * import { topLevelDeclarationNames } from "@beep/repo-cli/commands/Decisions"
 * import * as HashSet from "effect/HashSet"
 *
 * const names = topLevelDeclarationNames("a.ts", "const hidden = 1\nexport function shown() {}\n")
 * console.log(HashSet.has(names, "hidden")) // true
 * ```
 *
 * @param file - Repository-relative path whose extension picks the TypeScript script kind.
 * @param text - Contents of the test file to parse.
 * @returns The declared names.
 * @category parsing
 * @since 0.0.0
 */
export const topLevelDeclarationNames: {
  (text: string): (file: string) => HashSet.HashSet<string>;
  (file: string, text: string): HashSet.HashSet<string>;
} = dual(
  2,
  (file: string, text: string): HashSet.HashSet<string> =>
    HashSet.fromIterable(A.flatMap(parseSource(file, text).statements, statementNames))
);

const calleeRoot = (expression: ts.Expression): O.Option<string> => {
  if (ts.isIdentifier(expression)) {
    return O.some(expression.text);
  }
  if (ts.isPropertyAccessExpression(expression) || ts.isCallExpression(expression)) {
    return calleeRoot(expression.expression);
  }
  return O.none();
};

const literalTitle = (node: ts.Expression | undefined): O.Option<string> =>
  node !== undefined && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    ? O.some(node.text)
    : O.none();

/**
 * Titles of the `describe`, `it`, `test` and `suite` calls of one test file.
 *
 * **Details**
 *
 * A call counts when its callee chain (`it.effect`, `describe.skip`,
 * `it.effect.each(rows)`) starts at one of those identifiers and its first
 * argument is a string literal or a template without substitutions. Any other
 * string literal in the file is ignored.
 *
 * **Example** (Read call titles)
 *
 * ```ts
 * import { testCallTitles } from "@beep/repo-cli/commands/Decisions"
 * import * as HashSet from "effect/HashSet"
 *
 * const titles = testCallTitles("a.test.ts", 'describe("guard", () => { it.effect("refuses dashes", () => null) })')
 * console.log(HashSet.has(titles, "refuses dashes")) // true
 * ```
 *
 * @param file - Repository-relative path whose extension picks the TypeScript script kind.
 * @param text - Contents of the test file to parse.
 * @returns Every literal first argument of a test-suite call, in source order.
 * @category parsing
 * @since 0.0.0
 */
export const testCallTitles: {
  (text: string): (file: string) => HashSet.HashSet<string>;
  (file: string, text: string): HashSet.HashSet<string>;
} = dual(2, (file: string, text: string): HashSet.HashSet<string> => {
  const titles: Array<string> = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const isTestCall = O.exists(calleeRoot(node.expression), (root) => HashSet.has(TEST_CALLEES, root));
      if (isTestCall) {
        O.map(literalTitle(node.arguments[0]), (title) => titles.push(title));
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(parseSource(file, text));
  return HashSet.fromIterable(titles);
});

/**
 * Every `// decision: <slug>` pointer comment of one source file.
 *
 * **Details**
 *
 * Comments are read from the parse tree's leading comment ranges, so text in
 * string or template literals is never read as a comment, and a comment that
 * follows code on the same line is not a pointer. The comment must be a line
 * comment holding exactly `decision: <slug>`.
 *
 * **Example** (Find pointers)
 *
 * ```ts
 * import { decisionPointers } from "@beep/repo-cli/commands/Decisions"
 *
 * const pointers = decisionPointers("src/a.ts", "// decision: raw-ddl\nconst x = '// decision: not-me'\n")
 * console.log(pointers.map((pointer) => pointer.slug)) // ["raw-ddl"]
 * ```
 *
 * @param file - Repository-relative path, recorded on each pointer.
 * @param text - Contents of the test file to parse.
 * @returns The pointers in source order.
 * @category parsing
 * @since 0.0.0
 */
export const decisionPointers: {
  (text: string): (file: string) => ReadonlyArray<CodeDecisionPointer>;
  (file: string, text: string): ReadonlyArray<CodeDecisionPointer>;
} = dual(2, (file: string, text: string): ReadonlyArray<CodeDecisionPointer> => {
  if (!Str.includes("decision:")(text)) {
    return A.empty();
  }
  const sourceFile = parseSource(file, text);
  const seen = MutableHashSet.empty<number>();
  const pointers: Array<CodeDecisionPointer> = [];
  const collect = (position: number): void => {
    for (const range of ts.getLeadingCommentRanges(text, position) ?? []) {
      if (range.kind !== ts.SyntaxKind.SingleLineCommentTrivia || MutableHashSet.has(seen, range.pos)) {
        continue;
      }
      MutableHashSet.add(seen, range.pos);
      const match = POINTER_COMMENT.exec(Str.slice(range.pos, range.end)(text));
      if (match?.[1] !== undefined) {
        const line = sourceFile.getLineAndCharacterOfPosition(range.pos).line + 1;
        pointers.push(CodeDecisionPointer.make({ file, line, slug: match[1] }));
      }
    }
  };
  const visit = (node: ts.Node): void => {
    collect(node.pos);
    for (const child of node.getChildren(sourceFile)) {
      visit(child);
    }
  };
  visit(sourceFile);
  return A.sort(
    pointers,
    Order.mapInput(Order.Number, (pointer: CodeDecisionPointer) => pointer.line)
  );
});

/**
 * Parses one package code-decision file.
 *
 * **Details**
 *
 * The file name follows the goal-decision grammar, the frontmatter decodes as
 * {@link CodeDecisionFrontmatter} with `onExcessProperty: "error"`, its date
 * equals the file name date, and the body holds at most twelve lines and no
 * code fences.
 *
 * **Example** (Parse a file)
 *
 * ```ts
 * import { parseCodeDecision } from "@beep/repo-cli/commands/Decisions"
 * import * as Effect from "effect/Effect"
 *
 * const raw = "---\ntitle: Raw DDL\ndate: 2026-11-21\nreversal: Use drizzle-kit.\ngoverns: [src/a.ts#make]\nenforcedBy: []\n---\n\nBody.\n"
 * console.log(Effect.isEffect(parseCodeDecision("packages/demo/decisions/2026-11-21-raw-ddl.md", "packages/demo", raw))) // true
 * ```
 *
 * @param file - Repository-relative path of the decision file.
 * @param packageRoot - Repository-relative directory of the owning package.
 * @param raw - Full file text.
 * @returns The decision, or the problem that rejects the file.
 * @category parsing
 * @since 0.0.0
 */
export const parseCodeDecision = Effect.fn("Decisions.parseCodeDecision")(function* (
  file: string,
  packageRoot: string,
  raw: string
) {
  const name = pipe(
    Str.split("/")(file),
    A.last,
    O.getOrElse(() => file)
  );
  const parts = yield* readDecisionFrontmatter(codeDecisionReader, name, raw);
  return Result.flatMap(
    Result.mapError(parts, (message) => problem(CodeDecisionProblemKind.Enum["invalid-file"], file, message)),
    ({ frontmatter, body }) =>
      Result.mapBoth(decodeBody(body), {
        onFailure: (error) =>
          problem(
            CodeDecisionProblemKind.Enum["invalid-file"],
            file,
            `body does not decode as CodeDecisionBody: ${pipe(error.message, Str.replace(/\s+/gu, " "))}`
          ),
        onSuccess: (decoded) => CodeDecision.make({ file, packageRoot, frontmatter, body: decoded }),
      })
  );
});

/**
 * Render one problem as a report line.
 *
 * **Example** (Format a problem)
 *
 * ```ts
 * import { CodeDecisionProblem, formatCodeDecisionProblem } from "@beep/repo-cli/commands/Decisions"
 *
 * console.log(
 *   formatCodeDecisionProblem(
 *     CodeDecisionProblem.make({ kind: "unresolved-pointer", file: "packages/demo/src/a.ts:3", message: "no file" })
 *   )
 * ) // "packages/demo/src/a.ts:3  unresolved-pointer: no file"
 * ```
 *
 * @param entry - One decision check failure to report.
 * @returns `<file>  <kind>: <message>`.
 * @category utilities
 * @since 0.0.0
 */
export const formatCodeDecisionProblem = (entry: CodeDecisionProblem): string =>
  `${entry.file}  ${entry.kind}: ${entry.message}`;

const splitAnchor = (anchor: string): readonly [string, string] => {
  const index = O.getOrElse(Str.indexOf("#")(anchor), () => Str.length(anchor));
  return [Str.slice(0, index)(anchor), Str.slice(index + 1)(anchor)];
};

const loadTracked = Effect.fn("Decisions.loadTracked")(function* (cwd: string) {
  const git = yield* Git;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = yield* findRepoRoot(cwd).pipe(
    CodeDecisionsExecutionError.mapError("Failed to locate the repository root")
  );
  const entries = yield* git
    .lsFiles(repoRoot, { pathspec: ["packages", "apps"] })
    .pipe(Effect.mapError(adaptGitKitError(GitCommand.lsFiles(), gitErrors)));
  const files = pipe(
    entries,
    A.filter((entry) => HashSet.has(REGULAR_FILE_MODES, entry.mode)),
    A.map((entry) => entry.path),
    A.dedupe
  );
  const tracked = HashSet.fromIterable(files);
  const packageRoots = HashSet.fromIterable(
    A.flatMap(files, (file) => (path.basename(file) === "package.json" ? [path.dirname(file)] : A.empty<string>()))
  );
  const read = (file: string) =>
    fs.readFileString(path.join(repoRoot, file)).pipe(
      Effect.asSome,
      Effect.catchReason("PlatformError", "NotFound", () => Effect.succeed(O.none<string>())),
      CodeDecisionsExecutionError.mapError(`Failed to read ${file}`)
    );
  const ownerOf = (file: string): O.Option<string> => {
    const directory = path.dirname(file);
    if (HashSet.has(packageRoots, directory)) {
      return O.some(directory);
    }
    return directory === "." || directory === file ? O.none() : ownerOf(directory);
  };
  const resolveAnchorPath = (packageRoot: string, relative: string): string =>
    path.normalize(path.join(packageRoot, relative));
  return { repoRoot, files, tracked, packageRoots, read, ownerOf, resolveAnchorPath };
});

const readDecisions = Effect.fn("Decisions.readDecisions")(function* (
  context: Effect.Success<ReturnType<typeof loadTracked>>
) {
  const path = yield* Path.Path;
  const decisionFiles = A.filter(context.files, (file) => DECISION_FILE_PATH.test(file));
  const outcomes = yield* Effect.forEach(
    decisionFiles,
    Effect.fnUntraced(function* (file: string) {
      const packageRoot = path.dirname(path.dirname(file));
      if (path.basename(path.dirname(file)) !== CODE_DECISIONS_DIR || !HashSet.has(context.packageRoots, packageRoot)) {
        return O.some(
          Result.fail(
            problem(
              CodeDecisionProblemKind.Enum["misplaced-file"],
              file,
              `decision files live directly under <package>/${CODE_DECISIONS_DIR}/; ${packageRoot} has no tracked package.json.`
            )
          )
        );
      }
      const raw = yield* context.read(file);
      return yield* O.match(raw, {
        onNone: () => Effect.succeed(O.none<Result.Result<CodeDecision, CodeDecisionProblem>>()),
        onSome: (text) => Effect.asSome(parseCodeDecision(file, packageRoot, text)),
      });
    }),
    { concurrency: READ_CONCURRENCY }
  );
  const [decisions, problems] = A.separate(A.getSomes(outcomes));
  return { decisionFiles, decisions, problems };
});

const slugOf = (file: string): O.Option<string> =>
  pipe(
    Str.split("/")(file),
    A.last,
    O.flatMap((name) => O.fromNullishOr(DECISION_FILE_SLUG.exec(name)?.[1]))
  );

const slugsByPackage = (decisionFiles: ReadonlyArray<string>, packageOf: (file: string) => string) =>
  pipe(
    decisionFiles,
    A.flatMap((file) => O.toArray(O.map(slugOf(file), (slug) => [packageOf(file), slug] as const))),
    A.groupBy(([packageRoot]) => packageRoot),
    (groups) =>
      HashMap.fromIterable(
        A.map(R.toEntries(groups), ([packageRoot, rows]) => [
          packageRoot,
          HashSet.fromIterable(A.map(rows, ([, slug]) => slug)),
        ])
      )
  );

const duplicateSlugProblems = (
  decisionFiles: ReadonlyArray<string>,
  packageOf: (file: string) => string
): ReadonlyArray<CodeDecisionProblem> =>
  pipe(
    decisionFiles,
    A.flatMap((file) => O.toArray(O.map(slugOf(file), (slug) => [`${packageOf(file)}\u0000${slug}`, file] as const))),
    A.groupBy(([key]) => key),
    R.values,
    A.flatMap((rows) =>
      A.length(rows) < 2
        ? A.empty<CodeDecisionProblem>()
        : A.map(
            A.drop(
              A.sort(
                A.map(rows, ([, file]) => file),
                Order.String
              ),
              1
            ),
            (file) =>
              problem(
                CodeDecisionProblemKind.Enum["duplicate-slug"],
                file,
                "another decision file in this package has the same slug; a decision pointer would be ambiguous. Supersede the older file and delete it."
              )
          )
    )
  );

const readParsed = Effect.fn("Decisions.readParsed")(function* (
  context: Effect.Success<ReturnType<typeof loadTracked>>,
  files: ReadonlyArray<string>,
  parse: (file: string, text: string) => HashSet.HashSet<string>
) {
  const entries = yield* Effect.forEach(
    A.dedupe(A.filter(files, (file) => HashSet.has(context.tracked, file) && isCodeDecisionSourcePath(file))),
    (file) => Effect.map(context.read(file), (text) => [file, O.map(text, (source) => parse(file, source))] as const),
    { concurrency: READ_CONCURRENCY }
  );
  return HashMap.fromIterable(A.flatMap(entries, ([file, names]) => (O.isSome(names) ? [[file, names.value]] : [])));
});

const anchorProblem = (
  context: Effect.Success<ReturnType<typeof loadTracked>>,
  parsed: HashMap.HashMap<string, HashSet.HashSet<string>>,
  decision: CodeDecision,
  field: "governs" | "enforcedBy",
  anchor: string
): O.Option<CodeDecisionProblem> => {
  const [relative, name] = splitAnchor(anchor);
  const target = context.resolveAnchorPath(decision.packageRoot, relative);
  const kind =
    field === "governs"
      ? CodeDecisionProblemKind.Enum["unresolved-anchor"]
      : CodeDecisionProblemKind.Enum["unresolved-enforcer"];
  const what = field === "governs" ? "a top-level declaration" : "a describe/it/test call title";
  if (!HashSet.has(context.tracked, target)) {
    return O.some(problem(kind, decision.file, `${field} ${anchor}: ${target} is not a tracked file.`));
  }
  if (!isCodeDecisionSourcePath(target)) {
    return O.some(
      problem(kind, decision.file, `${field} ${anchor}: ${target} is not a TypeScript or JavaScript file.`)
    );
  }
  return O.match(HashMap.get(parsed, target), {
    onNone: () =>
      O.some(problem(kind, decision.file, `${field} ${anchor}: ${target} is missing from the working tree.`)),
    onSome: (names) =>
      HashSet.has(names, name)
        ? O.none()
        : O.some(problem(kind, decision.file, `${field} ${anchor}: ${target} has no ${what} named "${name}".`)),
  });
};

/**
 * Run `beep decisions check` over the repository that contains `cwd`.
 *
 * **Details**
 *
 * Lists tracked files under `packages/` and `apps/`, decodes every
 * `decisions/*.md`, resolves each `governs` anchor to a top-level declaration
 * and each `enforcedBy` test anchor to a call title (lint enforcers are not
 * resolved), and resolves each `// decision: <slug>` pointer in tracked
 * source to a `decisions/<YYYY-MM-DD>-<slug>.md` in its owning package.
 *
 * **Example** (Check the repository)
 *
 * ```ts
 * import { runCodeDecisionCheck } from "@beep/repo-cli/commands/Decisions"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(runCodeDecisionCheck(process.cwd()))) // true
 * ```
 *
 * @param cwd - Any directory inside the repository.
 * @returns The counts and every problem in file order.
 * @category use-cases
 * @since 0.0.0
 */
export const runCodeDecisionCheck = Effect.fn("Decisions.runCodeDecisionCheck")(function* (
  cwd: string
): Effect.fn.Return<
  CodeDecisionCheckReport,
  CodeDecisionsExecutionError,
  SecureRandom.SecureRandom | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner | Git
> {
  const path = yield* Path.Path;
  const context = yield* loadTracked(cwd);
  const { decisionFiles, decisions, problems: fileProblems } = yield* readDecisions(context);
  const anchorTargets = (field: "governs" | "enforcedBy") =>
    A.flatMap(decisions, (decision) =>
      A.flatMap(decision.frontmatter[field], (anchor) =>
        field === "enforcedBy" && isLintEnforcer(anchor)
          ? A.empty<string>()
          : [context.resolveAnchorPath(decision.packageRoot, splitAnchor(anchor)[0])]
      )
    );
  const declarations = yield* readParsed(context, anchorTargets("governs"), topLevelDeclarationNames);
  const titles = yield* readParsed(context, anchorTargets("enforcedBy"), testCallTitles);
  const anchorProblems = A.flatMap(decisions, (decision) => [
    ...A.getSomes(
      A.map(decision.frontmatter.governs, (anchor) => anchorProblem(context, declarations, decision, "governs", anchor))
    ),
    ...A.getSomes(
      A.map(
        A.filter(decision.frontmatter.enforcedBy, (anchor) => !isLintEnforcer(anchor)),
        (anchor) => anchorProblem(context, titles, decision, "enforcedBy", anchor)
      )
    ),
  ]);
  const slugs = slugsByPackage(decisionFiles, (file) => path.dirname(path.dirname(file)));
  const slugProblems = duplicateSlugProblems(decisionFiles, (file) => path.dirname(path.dirname(file)));
  const sources = yield* Effect.forEach(
    A.filter(context.files, isCodeDecisionSourcePath),
    (file) =>
      Effect.map(
        context.read(file),
        O.match({ onNone: A.empty<CodeDecisionPointer>, onSome: (text) => decisionPointers(file, text) })
      ),
    { concurrency: READ_CONCURRENCY }
  );
  const pointers = A.flatten(sources);
  const pointerProblems = A.flatMap(pointers, (pointer) =>
    O.match(context.ownerOf(pointer.file), {
      onNone: () => [
        problem(
          CodeDecisionProblemKind.Enum["unresolved-pointer"],
          `${pointer.file}:${pointer.line}`,
          `decision: ${pointer.slug} has no owning package.json above it.`
        ),
      ],
      onSome: (owner) =>
        O.exists(HashMap.get(slugs, owner), (known) => HashSet.has(known, pointer.slug))
          ? A.empty<CodeDecisionProblem>()
          : [
              problem(
                CodeDecisionProblemKind.Enum["unresolved-pointer"],
                `${pointer.file}:${pointer.line}`,
                `decision: ${pointer.slug} names no tracked ${owner}/${CODE_DECISIONS_DIR}/<YYYY-MM-DD>-${pointer.slug}.md.`
              ),
            ],
    })
  );
  return CodeDecisionCheckReport.make({
    decisions: A.length(decisions),
    unenforced: A.length(A.filter(decisions, (decision) => A.isReadonlyArrayEmpty(decision.frontmatter.enforcedBy))),
    pointers: A.length(pointers),
    problems: A.sort([...fileProblems, ...slugProblems, ...anchorProblems, ...pointerProblems], byFile),
  });
});

/**
 * Run `beep decisions for <path>...`: the decisions whose `governs` anchors
 * name a queried file, or a queried `path#declaration`.
 *
 * **Details**
 *
 * Query paths resolve against `cwd` and are compared repository-relative.
 * Files that do not decode are skipped; `beep decisions check` reports them.
 *
 * **Example** (List decisions for a file)
 *
 * ```ts
 * import { runCodeDecisionFor } from "@beep/repo-cli/commands/Decisions"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(runCodeDecisionFor(process.cwd(), ["packages/drivers/git/src/Git.ts"]))) // true
 * ```
 *
 * @param cwd - Any directory inside the repository; relative queries resolve against it.
 * @param queries - `path` or `path#declaration` entries.
 * @returns The matching decisions in file order.
 * @category use-cases
 * @since 0.0.0
 */
export const runCodeDecisionFor = Effect.fn("Decisions.runCodeDecisionFor")(function* (
  cwd: string,
  queries: ReadonlyArray<string>
): Effect.fn.Return<
  ReadonlyArray<CodeDecisionMatch>,
  CodeDecisionsExecutionError,
  SecureRandom.SecureRandom | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner | Git
> {
  const path = yield* Path.Path;
  const context = yield* loadTracked(cwd);
  const { decisions } = yield* readDecisions(context);
  const wanted = A.map(queries, (query) => {
    const [file, name] = Str.includes("#")(query) ? splitAnchor(query) : [query, ""];
    const target = path.relative(context.repoRoot, path.resolve(cwd, file));
    return { target, name };
  });
  const matches = A.flatMap(decisions, (decision) => {
    const anchors = A.filter(decision.frontmatter.governs, (anchor) => {
      const [relative, name] = splitAnchor(anchor);
      const target = context.resolveAnchorPath(decision.packageRoot, relative);
      return A.some(wanted, (query) => query.target === target && (Str.isEmpty(query.name) || query.name === name));
    });
    return A.isReadonlyArrayNonEmpty(anchors)
      ? [CodeDecisionMatch.make({ title: decision.frontmatter.title, file: decision.file, anchors })]
      : A.empty<CodeDecisionMatch>();
  });
  return A.sort(matches, byFile);
});
