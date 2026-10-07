/**
 * Pure text assembly for the carried documentation surfaces (D4): the
 * KNOWLEDGE.md bundle, the README port-notes skeleton, and the vendored-engine
 * notice scan.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import * as O from "effect/Option";
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
export const okfLinks = (module: ModuleName, claudeMd: string): ReadonlyArray<string> => {
  const own = `okf/modules/${module}.md`;
  const found = A.map(A.fromIterable(claudeMd.matchAll(OKF_LINK)), (match) => match[0]);
  return A.dedupe(A.prepend(found, own));
};

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
 * The KNOWLEDGE.md text of section 10.4: provenance header, then every
 * section verbatim under an HTML comment naming its upstream path.
 *
 * **Example** (Assemble a bundle)
 *
 * ```ts
 * import { assembleKnowledge } from "@beep/scratchpad/effected/runner/Knowledge"
 * import * as O from "effect/Option"
 *
 * const text = assembleKnowledge("yaml", "abc", [{ path: "packages/yaml/CLAUDE.md", content: O.some("# yaml\n") }])
 * console.log(text.startsWith("# yaml — upstream knowledge bundle (verbatim)")) // true
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const assembleKnowledge = (module: ModuleName, commit: string, sections: ReadonlyArray<KnowledgeSection>): string => {
  const header = [
    `# ${module} — upstream knowledge bundle (verbatim)`,
    "",
    `Provenance: ~/YeeBois/references/effect/effected @ ${commit}; files listed below.`,
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
  return `${A.join([...header, ...body], "\n").trimEnd()}\n`;
};

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
 * console.log(scanVendorNotices("a.ts", "// Ported from minimatch (ISC)\nexport const x = 1;")) // ["a.ts:1 // Ported from minimatch (ISC)"]
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const scanVendorNotices = (label: string, text: string): ReadonlyArray<string> =>
  A.filterMap(A.fromIterable(A.take(Str.split("\n")(text), HEADER_LINES).entries()), ([index, line]) =>
    NOTICE.test(line) ? O.some(`${label}:${index + 1} ${Str.trim(line)}`) : O.none()
  );

/**
 * What the README attribution block states for one module.
 *
 * @category type-level
 * @since 0.0.0
 */
export interface Attribution {
  readonly packageName: string;
  readonly version: string;
  readonly commit: string;
  readonly hasLicense: boolean;
  readonly notices: ReadonlyArray<string>;
}

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
 * const text = readmeSkeleton("yaml", "# @effected/yaml\n\nBody.\n", {
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
export const readmeSkeleton = (module: ModuleName, upstreamReadme: string, attribution: Attribution): string => {
  const lines = Str.split("\n")(upstreamReadme);
  const titled = A.match(lines, {
    onEmpty: () => [`# ${module} (lab port of @effected/${module})`],
    onNonEmpty: (all) =>
      Str.startsWith("# ")(all[0])
        ? A.prepend(A.drop(all, 1), `# ${module} (lab port of @effected/${module})`)
        : A.prepend(all, `# ${module} (lab port of @effected/${module})`),
  });
  const noticeLines = A.isNonEmptyReadonlyArray(attribution.notices)
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
  return `${A.join([...titled, ...notes], "\n").trimEnd()}\n`;
};

/**
 * The per-module tsconfig of section 5.3.
 *
 * **Example** (Render a tsconfig)
 *
 * ```ts
 * import { moduleTsconfig } from "@beep/scratchpad/effected/runner/Knowledge"
 *
 * console.log(moduleTsconfig("yaml").includes('"../../test/yaml/**/*.ts"')) // true
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
