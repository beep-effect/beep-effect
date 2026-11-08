/**
 * Source-context proof for relative package export claims shared by knowledge scanners.
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { matchKnowledgeEntrypoint } from "./Knowledge.packages.ts";
import { knowledgeInlineSpans } from "./Knowledge.refs.ts";
import type { KnowledgeDocumentLine } from "./Knowledge.refs.ts";
import type { KnowledgeTrackedEntry } from "./Knowledge.schemas.ts";
import type { KnowledgeWorkspacePackage } from "./KnowledgeDoctor.schemas.ts";

const isRegularBlob = (entry: KnowledgeTrackedEntry): boolean => entry.mode === "100644" || entry.mode === "100755";

const negativePackageClaimPrefix = (prefix: string): boolean =>
  /\b(?:not|no|never|without|remove|drop|avoid|proposed|planned|if|whether|could|would|might)\b[^.;|]*$/iu.test(prefix);

// A wildcard spelling is ownership evidence only when its resolved target is tracked.
const hasTrackedExportTarget = (
  pkg: KnowledgeWorkspacePackage,
  subpath: string,
  entries: ReadonlyArray<KnowledgeTrackedEntry>
): boolean =>
  O.exists(matchKnowledgeEntrypoint(pkg.entrypoints, subpath), (entry) =>
    O.exists(
      entry.target,
      (target) =>
        (Str.isEmpty(pkg.root) || Str.startsWith(`${pkg.root}/`)(target)) &&
        !/[\\*?#]/u.test(target) &&
        A.some(entries, (tracked) => tracked.path === target && isRegularBlob(tracked)) &&
        !A.some(entries, (tracked) => !isRegularBlob(tracked) && Str.startsWith(`${tracked.path}/`)(target))
    )
  );

/**
 * Proves affirmative relative export claims using document ownership and tracked package targets.
 *
 * **Example** (Decline an unowned claim)
 * ```ts
 * import { verifiedPackageExportColumns } from "@beep/repo-cli/commands/Knowledge/Knowledge.export-claims"
 * import * as HashSet from "effect/HashSet"
 * console.log(HashSet.size(verifiedPackageExportColumns("`./Sub` package export", [], [], []))) // 0
 * ```
 * @category parsing
 * @since 0.0.0
 */
export const verifiedPackageExportColumns: {
  (
    packages: ReadonlyArray<KnowledgeWorkspacePackage>,
    documentPackages: ReadonlyArray<KnowledgeWorkspacePackage>,
    entries: ReadonlyArray<KnowledgeTrackedEntry>
  ): (lineText: string) => HashSet.HashSet<number>;
  (
    lineText: string,
    packages: ReadonlyArray<KnowledgeWorkspacePackage>,
    documentPackages: ReadonlyArray<KnowledgeWorkspacePackage>,
    entries: ReadonlyArray<KnowledgeTrackedEntry>
  ): HashSet.HashSet<number>;
} = dual(
  4,
  (
    lineText: string,
    packages: ReadonlyArray<KnowledgeWorkspacePackage>,
    documentPackages: ReadonlyArray<KnowledgeWorkspacePackage>,
    entries: ReadonlyArray<KnowledgeTrackedEntry>
  ): HashSet.HashSet<number> => {
    const spans = knowledgeInlineSpans(lineText);
    const localOwners = A.filter(packages, (pkg) =>
      A.some(
        spans,
        ({ span }) => span === pkg.name || (Str.isNonEmpty(pkg.root) && Str.startsWith(`${pkg.root}/`)(span))
      )
    );
    const localNamesPackage = A.some(spans, ({ span }) => /^@beep\/[^/]+$/u.test(span));
    const owners = A.isReadonlyArrayNonEmpty(localOwners) || localNamesPackage ? localOwners : documentPackages;
    return HashSet.fromIterable(
      A.getSomes(
        A.map(spans, (inline) => {
          const after = Str.slice(inline.column - 1)(lineText);
          const before = Str.slice(0, inline.column - 1)(lineText);
          const affirmative = O.fromNullishOr(
            /^`[^`]+`\s+(?:is\s+a\s+)?(?:concept\s+subpath|package)\s+export(?=\s*(?:[),.;|]|$))/u.exec(after)
          );
          if (!Str.startsWith("./")(inline.span) || O.isNone(affirmative) || negativePackageClaimPrefix(before))
            return O.none();
          const suffix = Str.slice(Str.length(O.getOrElse(A.head(affirmative.value), () => "")))(after);
          const cellSuffix = O.getOrElse(A.head(Str.split("|")(suffix)), () => suffix);
          if (
            /\?|\b(?:not|never|if|whether|could|would|might|planned|proposed|removed|hypothetical)\b/iu.test(cellSuffix)
          )
            return O.none();
          if (A.isReadonlyArrayNonEmpty(localOwners) && localOwners.length !== 1) return O.none();
          const matches = A.filter(owners, (pkg) => hasTrackedExportTarget(pkg, inline.span, entries));
          return matches.length === 1 ? O.some(inline.column) : O.none();
        })
      )
    );
  }
);

/**
 * Selects positively named workspace owners from prose in the containing document.
 *
 * **Example** (Keep unmentioned packages out)
 * ```ts
 * import { knowledgeDocumentPackageOwners } from "@beep/repo-cli/commands/Knowledge/Knowledge.export-claims"
 * console.log(knowledgeDocumentPackageOwners([], []).length) // 0
 * ```
 * @category parsing
 * @since 0.0.0
 */
export const knowledgeDocumentPackageOwners: {
  (
    packages: ReadonlyArray<KnowledgeWorkspacePackage>
  ): (lines: ReadonlyArray<KnowledgeDocumentLine>) => ReadonlyArray<KnowledgeWorkspacePackage>;
  (
    lines: ReadonlyArray<KnowledgeDocumentLine>,
    packages: ReadonlyArray<KnowledgeWorkspacePackage>
  ): ReadonlyArray<KnowledgeWorkspacePackage>;
} = dual(
  2,
  (
    lines: ReadonlyArray<KnowledgeDocumentLine>,
    packages: ReadonlyArray<KnowledgeWorkspacePackage>
  ): ReadonlyArray<KnowledgeWorkspacePackage> => {
    const documentNames = HashSet.fromIterable(
      A.flatMap(lines, (line) =>
        line.prose
          ? A.map(
              A.filter(
                knowledgeInlineSpans(line.text),
                (span) => !negativePackageClaimPrefix(Str.slice(0, span.column - 1)(line.text))
              ),
              ({ span }) => span
            )
          : []
      )
    );
    return A.filter(packages, (pkg) => HashSet.has(documentNames, pkg.name));
  }
);
