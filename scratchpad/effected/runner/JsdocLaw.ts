/**
 * The parts of `.patterns/jsdoc-documentation.md` that docgen's enforcement
 * flags do not check: legacy carriers, canonical categories, `@since 0.0.0`,
 * described `@see`, titled single-fence Examples, section order, tag grammar
 * and `@packageDocumentation` on entry files.
 *
 * **Details**
 *
 * The repo's JSDoc quality tooling scans `packages/**` and `apps/**` only, so
 * the lab enforces the law itself. Findings name `file:line` and the rule.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { isCanonicalJSDocCategory } from "@beep/repo-utils/schemas/JSDocCategories";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { ModuleKind, ModuleResolutionKind, Node, Project, ScriptTarget } from "ts-morph";
import type { JSDoc, SourceFile } from "ts-morph";

const LEGACY = /@(remarks|example|module|template)\b/;
const SECTION = /^\*\*(When to use|Details|Gotchas|Example)\*\*(.*)$/;
const SECTION_ORDER = ["When to use", "Details", "Gotchas", "Example"] as const;

const commentLines = (text: string): ReadonlyArray<string> =>
  A.map(Str.split("\n")(text), (line) => Str.replace(/^\s*\/?\*+\/?\s?/, "")(line));

const lineOf = (sourceFile: SourceFile, position: number): number => sourceFile.getLineAndColumnAtPos(position).line;

/**
 * The structural findings of one JSDoc block, as `rule: detail` strings.
 *
 * **Example** (Find a bare see tag)
 *
 * ```ts
 * import { blockFindings } from "@beep/scratchpad/effected/runner/JsdocLaw"
 *
 * const text = "/**\n * Lead.\n *\n * @see {@link X}\n * @category utilities\n * @since 0.0.0\n *" + "/"
 * console.log(blockFindings(text)) // ["see-purpose: @see {@link X}"]
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export const blockFindings = (text: string): ReadonlyArray<string> => {
  const lines = commentLines(text);
  const findings: Array<string> = [];
  let inFence = false;
  let currentSection: O.Option<string> = O.none();
  let sectionRank = -1;
  let fencesInExample = 0;
  const titles: Array<string> = [];
  const closeExample = (): void => {
    if (O.isSome(currentSection) && currentSection.value === "Example" && fencesInExample !== 1) {
      findings.push(`example-fences: an Example has ${fencesInExample} ts fences`);
    }
  };
  let seenTag = false;
  let awaitingWhenToUse = false;
  for (const line of lines) {
    const trimmed = Str.trim(line);
    if (Str.startsWith("```")(trimmed)) {
      if (!inFence) {
        if (O.isNone(currentSection) || currentSection.value !== "Example") {
          findings.push("loose-fence: a fence outside an Example section");
        } else if (Str.startsWith("```ts")(trimmed)) {
          fencesInExample += 1;
        }
      }
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (awaitingWhenToUse && trimmed.length > 0 && SECTION.exec(trimmed) === null) {
      awaitingWhenToUse = false;
      if (!/^Use (to|when|as|with)\b/.test(trimmed)) findings.push(`when-to-use-opener: ${Str.slice(0, 40)(trimmed)}`);
    }
    const section = SECTION.exec(trimmed);
    if (section !== null) {
      const name = section[1] ?? "";
      const rank = O.getOrElse(
        A.findFirstIndex(SECTION_ORDER, (candidate) => candidate === name),
        () => SECTION_ORDER.length
      );
      closeExample();
      if (seenTag) findings.push(`section-after-tags: **${name}** follows a tag`);
      if (rank < sectionRank) findings.push(`section-order: **${name}** after a later section`);
      if (name !== "Example" && rank === sectionRank) findings.push(`section-duplicate: **${name}** appears twice`);
      sectionRank = rank;
      currentSection = O.some(name);
      awaitingWhenToUse = name === "When to use";
      fencesInExample = 0;
      if (name === "Example") {
        const title = /^\s*\((.+)\)\s*$/.exec(section[2] ?? "");
        if (title === null) {
          findings.push("example-title: an Example has no (Title)");
        } else {
          const value = title[1] ?? "";
          if (A.contains(titles, value)) findings.push(`example-title: duplicate title (${value})`);
          titles.push(value);
        }
      }
      continue;
    }
    if (Str.startsWith("@")(trimmed)) {
      if (!seenTag) closeExample();
      seenTag = true;
      if (LEGACY.test(trimmed)) findings.push(`legacy-tag: ${trimmed}`);
      if (/^@see\s+\{@link\s+[^}]+\}\s*$/.test(trimmed)) findings.push(`see-purpose: ${trimmed}`);
      if (/^@(returns|throws)\s+-/.test(trimmed)) findings.push(`tag-hyphen: ${trimmed}`);
      if (/^@(param|returns|throws)\s+\{/.test(trimmed)) findings.push(`tag-type-braces: ${trimmed}`);
      const category = /^@category\s+(\S+)/.exec(trimmed);
      if (category !== null && !isCanonicalJSDocCategory(category[1] ?? "")) {
        findings.push(`category: non-canonical ${category[1]}`);
      }
      const since = /^@since\s+(\S+)/.exec(trimmed);
      if (since !== null && since[1] !== "0.0.0") findings.push(`since: ${since[1]}`);
    }
  }
  if (!seenTag) closeExample();
  return findings;
};

const hasTag = (doc: JSDoc, tag: string): boolean => A.some(doc.getTags(), (candidate) => candidate.getTagName() === tag);

const docsOf = (node: Node): ReadonlyArray<JSDoc> => {
  if (Node.isVariableDeclaration(node)) {
    const statement = node.getVariableStatement();
    return statement === undefined ? [] : statement.getJsDocs();
  }
  return Node.isJSDocable(node) ? node.getJsDocs() : [];
};

const makeProject = (): Project =>
  new Project({
    skipAddingFilesFromTsConfig: true,
    compilerOptions: {
      allowImportingTsExtensions: true,
      moduleResolution: ModuleResolutionKind.Bundler,
      module: ModuleKind.ESNext,
      target: ScriptTarget.ESNext,
      noEmit: true,
      skipLibCheck: true,
    },
  });

/**
 * Which files are entry points (need `@packageDocumentation`) for one scan.
 *
 * @category type-level
 * @since 0.0.0
 */
export interface JsdocScope {
  readonly files: ReadonlyArray<readonly [absolute: string, label: string]>;
  readonly entries: ReadonlyArray<string>;
}

/**
 * Every JSDoc-law finding in the scope's files, as `label:line rule: detail`.
 *
 * **Example** (Scan a clean file)
 *
 * ```ts
 * import { jsdocLawFindings } from "@beep/scratchpad/effected/runner/JsdocLaw"
 *
 * const findings = jsdocLawFindings({ files: [], entries: [] })
 * console.log(findings) // []
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export const jsdocLawFindings = (scope: JsdocScope): ReadonlyArray<string> => {
  const project = makeProject();
  return A.flatMap(scope.files, ([absolute, label]) => {
    const sourceFile = project.addSourceFileAtPath(absolute);
    const fileFindings: Array<string> = [];
    for (const comment of sourceFile.getDescendants()) {
      if (!Node.isJSDoc(comment)) continue;
      for (const finding of blockFindings(comment.getText())) {
        fileFindings.push(`${label}:${lineOf(sourceFile, comment.getStart())} ${finding}`);
      }
    }
    for (const [name, declarations] of sourceFile.getExportedDeclarations()) {
      for (const declaration of declarations) {
        if (declaration.getSourceFile() !== sourceFile || Node.isSourceFile(declaration)) continue;
        const docs = docsOf(declaration);
        const line = lineOf(sourceFile, declaration.getStart());
        const doc = A.last(docs);
        if (O.isNone(doc)) {
          fileFindings.push(`${label}:${line} missing-doc: export ${name}`);
          continue;
        }
        if (!hasTag(doc.value, "category")) fileFindings.push(`${label}:${line} missing-category: export ${name}`);
        if (!hasTag(doc.value, "since")) fileFindings.push(`${label}:${line} missing-since: export ${name}`);
      }
    }
    if (A.contains(scope.entries, label)) {
      const first = A.head(A.filter(sourceFile.getDescendants(), Node.isJSDoc));
      const packaged = O.exists(first, (doc) => hasTag(doc, "packageDocumentation"));
      if (!packaged) fileFindings.push(`${label}:1 package-documentation: entry file lacks @packageDocumentation`);
    }
    return fileFindings;
  });
};
