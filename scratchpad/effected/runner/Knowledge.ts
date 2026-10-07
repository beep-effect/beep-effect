/**
 * Pure text assembly for the carried documentation surfaces (D4): the
 * KNOWLEDGE.md bundle, the README port-notes skeleton, and the vendored-engine
 * notice scan.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as Str from "effect/String";
import type { ModuleName } from "./Ledger.schema.ts";

const OKF_LINK = /okf\/[A-Za-z0-9_./-]+\.md/g;

/**
 * Every `okf/...md` path an upstream `CLAUDE.md` names, in first-occurrence
 * order without duplicates, with the module's own `okf/modules/<m>.md` forced
 * to the front (section 10.4).
 *
 * **Example** (Order the links of a CLAUDE.md)
 *
 * ```ts
 * import { okfLinks } from "@beep/scratchpad/effected/runner/Knowledge"
 *
 * const links = okfLinks("yaml", "See `okf/conventions/format-package-convention.md` and @./okf/modules/yaml.md.")
 * console.log(links) // ["okf/modules/yaml.md", "okf/conventions/format-package-convention.md"]
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const okfLinks: {
  (claudeMd: string): (module: ModuleName) => ReadonlyArray<string>;
  (module: ModuleName, claudeMd: string): ReadonlyArray<string>;
} = dual(2, (module: ModuleName, claudeMd: string): ReadonlyArray<string> => {
  const found = A.map(A.fromIterable(claudeMd.matchAll(OKF_LINK)), (match) => match[0]);
  return A.dedupe(A.prepend(found, `okf/modules/${module}.md`));
});

/**
 * One carried file: its upstream-relative path and its text, or none when the
 * link points at a file the checkout does not have.
 *
 * @category type-level
 * @since 0.0.0
 */
export interface KnowledgeSection {
  readonly path: string;
  readonly content: O.Option<string>;
}

/**
 * The knowledge-bundle header naming the module and the upstream commit.
 *
 * @category type-level
 * @since 0.0.0
 */
export interface KnowledgeHeader {
  readonly module: ModuleName;
  readonly commit: string;
}

/**
 * The KNOWLEDGE.md text of section 10.4: provenance header, then every
 * section verbatim under an HTML comment naming its upstream path.
 *
 * **Example** (Assemble a bundle)
 *
 * ```ts
 * import { assembleKnowledge } from "@beep/scratchpad/effected/runner/Knowledge"
 * import * as O from "effect/Option"
 *
 * const text = assembleKnowledge({ module: "yaml", commit: "abc" }, [
 *   { path: "packages/yaml/CLAUDE.md", content: O.some("# yaml\n") },
 * ])
 * console.log(text.startsWith("# yaml — upstream knowledge bundle (verbatim)")) // true
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const assembleKnowledge: {
  (sections: ReadonlyArray<KnowledgeSection>): (header: KnowledgeHeader) => string;
  (header: KnowledgeHeader, sections: ReadonlyArray<KnowledgeSection>): string;
} = dual(2, (header: KnowledgeHeader, sections: ReadonlyArray<KnowledgeSection>): string => {
  const lead = [
    `# ${header.module} — upstream knowledge bundle (verbatim)`,
    "",
    `Provenance: ~/YeeBois/references/effect/effected @ ${header.commit}; files listed below.`,
    "Relative `okf/...` links refer to that checkout. Content is carried verbatim; port",
    "decisions live in README.md → Port notes, not here.",
    "",
  ];
  const body = A.flatMap(sections, (section) => [
    "---",
    `<!-- ${section.path} -->`,
    O.getOrElse(section.content, () => `<!-- missing in the upstream checkout: ${section.path} -->`),
    "",
  ]);
  return `${Str.trimEnd(A.join([...lead, ...body], "\n"))}\n`;
});

const NOTICE = /copyright|ported from|vendored|derived from|adapted from|\bMIT\b|licen[cs]e/i;
const HEADER_LINES = 40;

/**
 * Header lines of one source file that look like a vendored-engine or
 * license notice, as `path:line text`.
 *
 * **Details**
 *
 * The scan covers the first forty lines only; notices sit at the top of a
 * file. The result feeds README *Port notes → Attribution* and is a lead for
 * the S2 editorial pass, not a verdict.
 *
 * **Example** (Scan a header)
 *
 * ```ts
 * import { scanVendorNotices } from "@beep/scratchpad/effected/runner/Knowledge"
 *
 * const notices = scanVendorNotices("a.ts", "// Ported from minimatch (ISC)\nexport const x = 1;")
 * console.log(notices) // ["a.ts:1 // Ported from minimatch (ISC)"]
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const scanVendorNotices: {
  (text: string): (label: string) => ReadonlyArray<string>;
  (label: string, text: string): ReadonlyArray<string>;
} = dual(
  2,
  (label: string, text: string): ReadonlyArray<string> =>
    A.filterMap(A.take(Str.split("\n")(text), HEADER_LINES), (line, index) =>
      NOTICE.test(line) ? Result.succeed(`${label}:${index + 1} ${Str.trim(line)}`) : Result.failVoid
    )
);

/**
 * What the README attribution block states for one module.
 *
 * @category type-level
 * @since 0.0.0
 */
export interface Attribution {
  readonly module: ModuleName;
  readonly packageName: string;
  readonly version: string;
  readonly commit: string;
  readonly hasLicense: boolean;
  readonly notices: ReadonlyArray<string>;
}

const labTitle = (module: ModuleName): string => `# ${module} (lab port of @effected/${module})`;

/**
 * The adapted README of section 10.3: the upstream text with the lab title,
 * followed by the four fixed *Port notes* subsections. Badge, install and
 * stability trimming is editorial and stays for S2.
 *
 * **Example** (Skeleton a README)
 *
 * ```ts
 * import { readmeSkeleton } from "@beep/scratchpad/effected/runner/Knowledge"
 *
 * const text = readmeSkeleton("# @effected/yaml\n\nBody.\n", {
 *   module: "yaml",
 *   packageName: "@effected/yaml",
 *   version: "0.19.0",
 *   commit: "abc",
 *   hasLicense: true,
 *   notices: [],
 * })
 * console.log(text.startsWith("# yaml (lab port of @effected/yaml)")) // true
 * console.log(text.includes("## Port notes")) // true
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const readmeSkeleton: {
  (attribution: Attribution): (upstreamReadme: string) => string;
  (upstreamReadme: string, attribution: Attribution): string;
} = dual(2, (upstreamReadme: string, attribution: Attribution): string => {
  const title = labTitle(attribution.module);
  const titled = A.match(Str.split("\n")(upstreamReadme), {
    onEmpty: () => [title],
    onNonEmpty: (all) => (Str.startsWith("# ")(all[0]) ? A.prepend(A.drop(all, 1), title) : A.prepend(all, title)),
  });
  const noticeLines = A.isReadonlyArrayNonEmpty(attribution.notices)
    ? A.map(attribution.notices, (notice) => `- ${notice}`)
    : ["- Vendored-engine notices: none found in source headers."];
  const notes = [
    "",
    "## Port notes",
    "",
    "### Attribution",
    "",
    `- Upstream package: \`${attribution.packageName}\` ${attribution.version}`,
    `- Upstream commit: \`${attribution.commit}\` (~/YeeBois/references/effect/effected)`,
    attribution.hasLicense
      ? "- License: [LICENSE](./LICENSE) (verbatim upstream MIT notice)"
      : "- License: upstream package ships no LICENSE file; the repository-level license applies",
    ...noticeLines,
    "",
    "### Added exports",
    "",
    "None.",
    "",
    "### Deviations",
    "",
    "None.",
    "",
    "### Dependency backlog",
    "",
    "None.",
    "",
  ];
  return `${Str.trimEnd(A.join([...titled, ...notes], "\n"))}\n`;
});

/**
 * The per-module tsconfig of section 5.3.
 *
 * **Example** (Render a tsconfig)
 *
 * ```ts
 * import { moduleTsconfig } from "@beep/scratchpad/effected/runner/Knowledge"
 *
 * console.log(moduleTsconfig("yaml").includes("../../test/yaml/")) // true
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const moduleTsconfig = (module: ModuleName): string =>
  `${A.join(
    [
      "{",
      '  "$schema": "https://json.schemastore.org/tsconfig",',
      '  "extends": "../../tsconfig.json",',
      `  "include": ["./**/*.ts", "../../test/${module}/**/*.ts"]`,
      "}",
    ],
    "\n"
  )}\n`;
