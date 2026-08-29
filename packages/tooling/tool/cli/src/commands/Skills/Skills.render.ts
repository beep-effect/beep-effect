/**
 * Pure renderers for read-only skill provenance reports.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Unknown } from "@beep/schema/Unknown";
import { Result } from "effect";
import * as A from "effect/Array";
import * as Str from "effect/String";
import * as jsonc from "jsonc-parser";
import type { SkillProvenanceReport } from "./Skills.schemas.ts";

const encodeUnknownJson = Unknown.encodeUnknownResultFromJsonString;

/**
 * Renders the would-be `skills-lock/v2` entry of a report as stable, formatted JSON.
 *
 * **Details**
 *
 * Only `report.entry` is rendered, never the drift inventory, so the output is
 * exactly the text that would be written into the lock file. Formatting is
 * two-space jsonc with a trailing newline, which keeps repeated runs diffable.
 *
 * **Example** (Render the lock text for a computed report)
 *
 * ```ts
 * import { renderSkillProvenanceJson } from "@beep/repo-cli/commands/Skills/Skills.render"
 * import { SkillProvenanceReport } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 * import * as S from "effect/Schema"
 *
 * const digest = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 * const revision = "91f21dfe1328585670275781b4525fff2507f917"
 *
 * const report = S.decodeUnknownSync(SkillProvenanceReport)({
 *   skill: "shadcn",
 *   driftPaths: [],
 *   entry: {
 *     sourceType: "github",
 *     upstream: {
 *       repository: "shadcn-ui/ui",
 *       repositoryUrl: "https://github.com/shadcn-ui/ui",
 *       treePath: "skills/shadcn",
 *       entryPath: "skills/shadcn/SKILL.md",
 *       trackingRef: "main",
 *       sourceRevision: revision,
 *       observedHeadRevision: revision,
 *       observedPathRevision: revision,
 *     },
 *     snapshot: {
 *       algorithm: "sha256",
 *       treeHash: digest,
 *       fileCount: 1,
 *       manifestHash: digest,
 *       manifest: [{ path: "SKILL.md", mode: "100644", sha256: digest }],
 *     },
 *     license: { spdxId: "MIT", path: "LICENSE.md", sha256: digest },
 *     provenance: {
 *       status: "exact",
 *       confidence: "high",
 *       matchedFileCount: 1,
 *       upstreamFileCount: 1,
 *       evidence: ["exact-tree"],
 *     },
 *     patches: { required: false, patchSetHash: digest, series: [] },
 *     effective: {
 *       treeHash: digest,
 *       installedTargets: [".claude/skills/shadcn"],
 *       installedTreeHash: digest,
 *     },
 *   },
 * })
 *
 * const json = renderSkillProvenanceJson(report)
 *
 * console.log(json.includes(`"sourceType": "github"`)) // true
 * console.log(json.endsWith("\n")) // true
 * ```
 *
 * @param report - Computed provenance report whose `entry` is rendered.
 * @returns Stable two-space-formatted JSON text of the lock entry, ending in a newline.
 * @throws When the entry cannot be encoded to JSON; a schema-decoded report never triggers this.
 * @see {@link renderSkillProvenanceSummary} for the human-facing rendering of the same report.
 * @category formatting
 * @since 0.0.0
 */
export const renderSkillProvenanceJson = (report: SkillProvenanceReport): string => {
  const encoded = Result.getOrThrow(encodeUnknownJson(report.entry));
  const edits = jsonc.format(encoded, undefined, {
    tabSize: 2,
    insertSpaces: true,
  });
  return `${jsonc.applyEdits(encoded, edits)}\n`;
};

/**
 * Renders a computed provenance report as a concise, line-per-fact human summary.
 *
 * **Details**
 *
 * The first line always names the skill, and the remaining lines follow a fixed
 * order (source, pin, observed revisions, snapshot, license, provenance, drift,
 * patches, effective) so two runs can be diffed line by line. Digests are
 * printed in full except for the patch-set hash, which is abbreviated to twelve
 * characters because it is a set identifier rather than a verification target.
 *
 * **Example** (Summarize a drift-free report)
 *
 * ```ts
 * import { renderSkillProvenanceSummary } from "@beep/repo-cli/commands/Skills/Skills.render"
 * import { SkillProvenanceReport } from "@beep/repo-cli/commands/Skills/Skills.schemas"
 * import * as S from "effect/Schema"
 *
 * const digest = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 * const revision = "91f21dfe1328585670275781b4525fff2507f917"
 *
 * const report = S.decodeUnknownSync(SkillProvenanceReport)({
 *   skill: "shadcn",
 *   driftPaths: [],
 *   entry: {
 *     sourceType: "github",
 *     upstream: {
 *       repository: "shadcn-ui/ui",
 *       repositoryUrl: "https://github.com/shadcn-ui/ui",
 *       treePath: "skills/shadcn",
 *       entryPath: "skills/shadcn/SKILL.md",
 *       trackingRef: "main",
 *       sourceRevision: revision,
 *       observedHeadRevision: revision,
 *       observedPathRevision: revision,
 *     },
 *     snapshot: {
 *       algorithm: "sha256",
 *       treeHash: digest,
 *       fileCount: 1,
 *       manifestHash: digest,
 *       manifest: [{ path: "SKILL.md", mode: "100644", sha256: digest }],
 *     },
 *     license: { spdxId: "MIT", path: "LICENSE.md", sha256: digest },
 *     provenance: {
 *       status: "exact",
 *       confidence: "high",
 *       matchedFileCount: 1,
 *       upstreamFileCount: 1,
 *       evidence: ["exact-tree"],
 *     },
 *     patches: { required: false, patchSetHash: digest, series: [] },
 *     effective: {
 *       treeHash: digest,
 *       installedTargets: [".claude/skills/shadcn"],
 *       installedTreeHash: digest,
 *     },
 *   },
 * })
 *
 * const summary = renderSkillProvenanceSummary(report)
 *
 * console.log(summary.split("\n")[0]) // "skills:provenance: shadcn"
 * console.log(summary.includes("drift: none against pinned snapshot")) // true
 * ```
 *
 * @param report - Computed provenance report to summarize.
 * @returns Fixed-order, line-per-fact summary text suitable for line-by-line diffing.
 * @see {@link renderSkillProvenanceJson} for the lock-shaped rendering of the same report.
 * @category formatting
 * @since 0.0.0
 */
export const renderSkillProvenanceSummary = (report: SkillProvenanceReport): string => {
  const { entry } = report;
  const drift = A.isReadonlyArrayEmpty(report.driftPaths)
    ? "none against pinned snapshot"
    : A.join(report.driftPaths, ", ");
  const patches = entry.patches.required
    ? `${entry.patches.series.length} proposed patch(es); set ${Str.slice(0, 12)(entry.patches.patchSetHash)}`
    : `none; empty-set ${Str.slice(0, 12)(entry.patches.patchSetHash)}`;

  return A.join(
    [
      `skills:provenance: ${report.skill}`,
      `source: ${entry.upstream.repository}:${entry.upstream.treePath}`,
      `pin: ${entry.upstream.sourceRevision}`,
      `observed: head ${entry.upstream.observedHeadRevision}; path ${entry.upstream.observedPathRevision}`,
      `snapshot: ${entry.snapshot.fileCount} file(s); tree ${entry.snapshot.treeHash}; manifest ${entry.snapshot.manifestHash}`,
      `license: ${entry.license.spdxId} ${entry.license.path} ${entry.license.sha256}`,
      `provenance: ${entry.provenance.status}/${entry.provenance.confidence}; matched ${entry.provenance.matchedFileCount}/${entry.provenance.upstreamFileCount}`,
      `drift: ${drift}`,
      `patches: ${patches}`,
      `effective: ${entry.effective.treeHash}; installed ${entry.effective.installedTreeHash}`,
    ],
    "\n"
  );
};
