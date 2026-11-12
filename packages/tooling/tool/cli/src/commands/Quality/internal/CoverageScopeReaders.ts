/**
 * Token- and segment-aware reader scan behind the coverage owner rows of
 * generated repository files.
 *
 * **Details**
 *
 * A coverage owner row says which workspace packages a repository file feeds
 * when it changes. For generated standards files the row is derived, not
 * asserted: a package reads the file when one of its TypeScript sources holds
 * a string token whose path segments include the file's basename. Comments
 * never count, a basename embedded in a longer segment never counts, and a
 * name split across `path.join` arguments or `+` concatenation of literals
 * still counts. The live drift check in the repo-cli tests compares this scan
 * with the rows in `CoverageScope.ts`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { A, Str } from "@beep/utils";
import { dual, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import { ts } from "ts-morph";
import { coverageDependentOwners } from "./CoverageScope.ts";
import type { CoverageScopeOwner } from "./CoverageScope.ts";

const $I = $RepoCliId.create("commands/Quality/internal/CoverageScopeReaders");

/**
 * One workspace source file and its text, as the reader scan consumes it.
 *
 * @category models
 * @since 0.0.0
 */
export class CoverageReaderSource extends S.Opaque<CoverageReaderSource, { readonly brand: unique symbol }>()(
  S.Struct({
    filePath: S.String,
    text: S.String,
  }).pipe(
    $I.annoteSchema("CoverageReaderSource", {
      description: "Repository-relative path and text of one workspace source file scanned for repository reads.",
    })
  )
) {}

const PATH_SEPARATOR = /[\\/]/;

const pathSegments = (value: string): ReadonlyArray<string> => Str.split(PATH_SEPARATOR)(value);

/**
 * The last path segment of a repository path, which the reader scan looks for.
 *
 * **Example** (Read a generated inventory's basename)
 *
 * ```ts
 * import { coverageReaderBasename } from "@beep/repo-cli/test/Quality"
 *
 * console.log(coverageReaderBasename("standards/schema-first.inventory.jsonc")) // "schema-first.inventory.jsonc"
 * ```
 *
 * @param repositoryPath - Repository-relative file or directory path.
 * @returns The final non-empty segment.
 * @category utilities
 * @since 0.0.0
 */
export const coverageReaderBasename = (repositoryPath: string): string =>
  pipe(
    pathSegments(repositoryPath),
    A.filter(Str.isNonEmpty),
    A.last,
    O.getOrElse(() => repositoryPath)
  );

const scriptKindFor = (filePath: string): ts.ScriptKind =>
  Str.endsWith(".tsx")(filePath) || Str.endsWith(".jsx")(filePath) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;

// A `+` chain folds to one string only when every operand is a string token,
// so `"policy-tools" + ".fingerprint.json"` reads as the joined name.
const foldedStringValue = (node: ts.Node): O.Option<string> => {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return O.some(node.text);
  }
  if (ts.isParenthesizedExpression(node)) {
    return foldedStringValue(node.expression);
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    return O.zipWith(foldedStringValue(node.left), foldedStringValue(node.right), (left, right) => `${left}${right}`);
  }
  return O.none();
};

const templatePartValue = (node: ts.Node): O.Option<string> =>
  ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node) ? O.some(node.text) : O.none();

/**
 * Every string token in a TypeScript source: string literals, template text
 * parts and folded `+` chains of literals. Comments are not tokens.
 *
 * **Example** (Skip a comment, keep a joined path argument)
 *
 * ```ts
 * import { CoverageReaderSource, coverageReaderStringTokens } from "@beep/repo-cli/test/Quality"
 *
 * const text = '// standards/a.json\nconst p = path.join(root, "standards", "a.json")'
 * console.log(coverageReaderStringTokens(CoverageReaderSource.make({ filePath: "a.ts", text }))) // ["standards", "a.json"]
 * ```
 *
 * @param source - Module to tokenise; a `.tsx` or `.jsx` path selects the TSX parser.
 * @returns String token values in source order.
 * @category utilities
 * @since 0.0.0
 */
export const coverageReaderStringTokens = ({ filePath, text }: CoverageReaderSource): ReadonlyArray<string> => {
  const sourceFile = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, false, scriptKindFor(filePath));
  const tokens = A.empty<string>();
  const visit = (node: ts.Node): void => {
    const value = O.orElse(foldedStringValue(node), () => templatePartValue(node));
    if (O.isSome(value)) {
      tokens.push(value.value);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return tokens;
};

/**
 * Whether a source reads a repository path: some string token has the path's
 * basename as one whole path segment.
 *
 * **Details**
 *
 * The raw text is checked for the basename's first dot-delimited stem before
 * parsing, so files that cannot match are never parsed.
 *
 * **Gotchas**
 *
 * A basename assembled at runtime from non-literal parts, or split inside its
 * first stem by `+`, is not seen. Reads must spell the basename in one token.
 *
 * **Example** (Recognise a `path.join` read)
 *
 * ```ts
 * import { CoverageReaderSource, coverageSourceReadsPath } from "@beep/repo-cli/test/Quality"
 *
 * const text = 'const p = path.join(root, "standards", "policy-tools.fingerprint.json")'
 * const source = CoverageReaderSource.make({ filePath: "a.ts", text })
 * console.log(coverageSourceReadsPath(source, "standards/policy-tools.fingerprint.json")) // true
 * ```
 *
 * @param source - Module whose string tokens are scanned.
 * @param repositoryPath - Repository-relative file or directory path.
 * @returns `true` when a string token names the basename as a segment.
 * @category predicates
 * @since 0.0.0
 */
export const coverageSourceReadsPath: {
  (repositoryPath: string): (source: CoverageReaderSource) => boolean;
  (source: CoverageReaderSource, repositoryPath: string): boolean;
} = dual(2, (source: CoverageReaderSource, repositoryPath: string): boolean => {
  const basename = coverageReaderBasename(repositoryPath);
  const stem = pipe(
    Str.split(".")(basename),
    A.findFirst(Str.isNonEmpty),
    O.getOrElse(() => basename)
  );
  return (
    Str.includes(stem)(source.text) &&
    A.some(coverageReaderStringTokens(source), (token) => A.contains(pathSegments(token), basename))
  );
});

const byPackagePathLengthDescending = Order.mapInput(
  Order.Number,
  (owner: CoverageScopeOwner) => -Str.length(owner.packagePath)
);

const ownerOf = (owners: ReadonlyArray<CoverageScopeOwner>, filePath: string): O.Option<CoverageScopeOwner> =>
  A.findFirst(A.sort(owners, byPackagePathLengthDescending), (owner) =>
    Str.startsWith(`${owner.packagePath}/`)(filePath)
  );

const isOwnerTestSource = (owner: CoverageScopeOwner, filePath: string): boolean =>
  Str.startsWith(`${owner.packagePath}/test/`)(filePath);

/**
 * The coverage owners a repository path feeds, derived from the reader scan.
 *
 * **Details**
 *
 * A package that reads the path is an owner when it measures coverage. When
 * the read sits outside the package's `test/` tree, any coverage-bearing
 * package that depends on it can execute the read too, so its transitive
 * dependents are owners as well.
 *
 * **Example** (Derive one test-side reader)
 *
 * ```ts
 * import { CoverageReaderSource, CoverageScopeOwner, coverageReaderOwners } from "@beep/repo-cli/test/Quality"
 *
 * const owners = [CoverageScopeOwner.make({ packageName: "@beep/a", packagePath: "packages/a", hasCoverage: true })]
 * const sources = [CoverageReaderSource.make({ filePath: "packages/a/test/A.test.ts", text: '"standards/x.json"' })]
 * console.log(coverageReaderOwners(owners, sources, "standards/x.json")) // ["@beep/a"]
 * ```
 *
 * @param owners - Workspace packages with their workspace-internal dependencies.
 * @param sources - Workspace sources to scan.
 * @param repositoryPath - Repository-relative file or directory path.
 * @returns Sorted unique coverage-bearing owners.
 * @category utilities
 * @since 0.0.0
 */
export const coverageReaderOwners: {
  (
    sources: ReadonlyArray<CoverageReaderSource>,
    repositoryPath: string
  ): (owners: ReadonlyArray<CoverageScopeOwner>) => ReadonlyArray<string>;
  (
    owners: ReadonlyArray<CoverageScopeOwner>,
    sources: ReadonlyArray<CoverageReaderSource>,
    repositoryPath: string
  ): ReadonlyArray<string>;
} = dual(
  3,
  (
    owners: ReadonlyArray<CoverageScopeOwner>,
    sources: ReadonlyArray<CoverageReaderSource>,
    repositoryPath: string
  ): ReadonlyArray<string> => {
    const reads = pipe(
      sources,
      A.filter(coverageSourceReadsPath(repositoryPath)),
      A.flatMap((source) =>
        pipe(
          ownerOf(owners, source.filePath),
          O.map((owner) => [owner, isOwnerTestSource(owner, source.filePath)] as const),
          O.toArray
        )
      )
    );
    const readers = pipe(
      reads,
      A.filter(([owner]) => owner.hasCoverage),
      A.map(([owner]) => owner.packageName)
    );
    const sourceReaders = pipe(
      reads,
      A.filter(([, testOnly]) => !testOnly),
      A.map(([owner]) => owner.packageName),
      A.dedupe
    );
    return pipe(A.appendAll(readers, coverageDependentOwners(owners, sourceReaders)), A.dedupe, A.sort(Order.String));
  }
);
