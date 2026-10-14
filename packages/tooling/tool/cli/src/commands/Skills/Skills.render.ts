/**
 * Pure renderers for skill provenance, lock-plan, and materialize reports.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import * as Match from "effect/Match";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as jsonc from "jsonc-parser";
import { SkillsLockMigrationPlan, SkillsLockWriteReceipt } from "./SkillsLock.schemas.ts";
import type { SkillProvenanceReport } from "./Skills.schemas.ts";
import type { SkillMigrationRow, UnresolvedMigrationRow, VendoredMigrationRow } from "./SkillsLock.schemas.ts";
import type { SkillMaterializeReport, SkillMaterializeRow } from "./SkillsMaterialize.schemas.ts";

const encodeUnknownJson = S.encodeUnknownResult(S.fromJsonString(S.Unknown));

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

const encodeMigrationPlanJson = S.encodeResult(S.fromJsonString(SkillsLockMigrationPlan));

/**
 * Renders a lock migration plan as formatted JSON.
 *
 * **Example** (Render an empty plan)
 *
 * ```ts
 * import { renderSkillsLockMigrationPlanJson } from "@beep/repo-cli/commands/Skills/Skills.render"
 * import { SkillsLockMigrationPlan } from "@beep/repo-cli/commands/Skills/SkillsLock.schemas"
 * import { Sha256Hex } from "@beep/schema"
 *
 * const digest = Sha256Hex.make("0".repeat(64))
 * const plan = SkillsLockMigrationPlan.make({ planDigest: digest, lockSha256: digest, rows: [] })
 * console.log(renderSkillsLockMigrationPlanJson(plan).includes("skills-lock-migration-plan/v3")) // true
 * ```
 *
 * @param plan - Migration plan to render.
 * @returns Two-space formatted JSON with a trailing newline.
 * @category formatting
 * @since 0.0.0
 */
export const renderSkillsLockMigrationPlanJson = (plan: SkillsLockMigrationPlan): string => {
  const encoded = Result.getOrThrow(encodeMigrationPlanJson(plan));
  const edits = jsonc.format(encoded, undefined, { tabSize: 2, insertSpaces: true });
  return `${jsonc.applyEdits(encoded, edits)}\n`;
};

const abbreviatedRevision = Str.slice(0, 10);

const describePin = (row: VendoredMigrationRow): string =>
  row.pin.proposal === "pristine-at-revision"
    ? `pristine at ${abbreviatedRevision(row.pin.revision)} (proposed pin)`
    : `no pristine revision; keeps current pin ${abbreviatedRevision(row.pin.revision)}`;

const describeDrift = (row: VendoredMigrationRow): string => {
  const local = A.filter(row.drift, (drift) => drift.driftClass === "matches-no-examined-revision");
  const pulled = A.length(A.filter(row.drift, (drift) => drift.driftClass === "matches-upstream-revision"));
  const candidates = A.isReadonlyArrayEmpty(local)
    ? ""
    : ` (patch candidates: ${A.join(
        A.map(local, (drift) => drift.path),
        ", "
      )})`;
  return A.isReadonlyArrayEmpty(row.drift)
    ? "no drift from current pin"
    : `drift from current pin: ${pulled} match an upstream revision, ${A.length(local)} match no examined revision${candidates}`;
};

const describePatches = (row: VendoredMigrationRow): string =>
  A.match(row.entry.patches.series, {
    onEmpty: () => "no patches",
    onNonEmpty: (series) =>
      `patches: ${A.join(
        A.map(series, (patch) => patch.path),
        ", "
      )}`,
  });

const describeUnresolved = (row: UnresolvedMigrationRow): string =>
  `  ${row.skill}: unresolved, ${row.cause}${row.cause === "no-ratified-seed" ? " (written local)" : " (blocks write)"} (${row.note})`;

const describeHistory = (row: VendoredMigrationRow): string =>
  `history: ${row.pathHistory.revisionCount} revision(s) at ${row.pathHistory.trackingRef}, head ${abbreviatedRevision(
    row.pathHistory.head
  )}${row.pathHistory.truncated ? ", truncated (older revisions not examined)" : ""}`;

/**
 * Renders a lock migration plan as one line per skill.
 *
 * **Details**
 *
 * The headline gives the disposition counts and the plan digest. A vendored
 * line names its pin proposal, its drift from the current pin split by
 * path-history class (listing the files no revision explains), the patch
 * series its entry carries at the proposed pin, and the path history it was
 * classified against, including whether that history was truncated. An
 * unresolved line names its cause and marks the causes that block a write.
 *
 * **Example** (Render an empty plan summary)
 *
 * ```ts
 * import { renderSkillsLockMigrationPlanSummary } from "@beep/repo-cli/commands/Skills/Skills.render"
 * import { SkillsLockMigrationPlan } from "@beep/repo-cli/commands/Skills/SkillsLock.schemas"
 * import { Sha256Hex } from "@beep/schema"
 *
 * const digest = Sha256Hex.make("0".repeat(64))
 * const plan = SkillsLockMigrationPlan.make({ planDigest: digest, lockSha256: digest, rows: [] })
 * console.log(renderSkillsLockMigrationPlanSummary(plan).startsWith("skills lock-plan: 0 vendored")) // true
 * ```
 *
 * @param plan - Migration plan to render.
 * @returns Headline counts and digest followed by one line per skill.
 * @category formatting
 * @since 0.0.0
 */
export const renderSkillsLockMigrationPlanSummary = (plan: SkillsLockMigrationPlan): string => {
  const count = (disposition: string): number =>
    A.length(A.filter(plan.rows, (row) => row.disposition === disposition));
  const lines = A.map(
    plan.rows,
    Match.type<SkillMigrationRow>().pipe(
      Match.discriminatorsExhaustive("disposition")({
        vendored: (row) =>
          `  ${row.skill}: vendored; ${describePin(row)}; ${describeDrift(row)}; ${describePatches(row)}; ${describeHistory(row)}`,
        unresolved: describeUnresolved,
        local: (row) => `  ${row.skill}: local`,
      })
    )
  );
  return A.join(
    [
      `skills lock-plan: ${count("vendored")} vendored, ${count("local")} local, ${count("unresolved")} unresolved`,
      `plan-digest: ${plan.planDigest}`,
      ...lines,
    ],
    "\n"
  );
};

const encodeWriteReceiptJson = S.encodeResult(S.fromJsonString(SkillsLockWriteReceipt));

/**
 * Renders a skills-lock write receipt as formatted JSON.
 *
 * **Example** (Render a receipt)
 *
 * ```ts
 * import { renderSkillsLockWriteReceiptJson } from "@beep/repo-cli/commands/Skills/Skills.render"
 * import { SkillsLockWriteReceipt, SkillsLockWrittenFile } from "@beep/repo-cli/commands/Skills/SkillsLock.schemas"
 * import { Sha256Hex } from "@beep/schema"
 *
 * const digest = Sha256Hex.make("0".repeat(64))
 * const receipt = SkillsLockWriteReceipt.make({
 *   planDigest: digest,
 *   outcome: "already-applied",
 *   lock: SkillsLockWrittenFile.make({ path: "skills-lock.json", sha256: digest }),
 *   vendored: 0,
 *   local: 0,
 *   patches: [],
 * })
 * console.log(renderSkillsLockWriteReceiptJson(receipt).includes("already-applied")) // true
 * ```
 *
 * @param receipt - The receipt a reviewed write returned.
 * @returns Two-space formatted JSON with a trailing newline.
 * @category formatting
 * @since 0.0.0
 */
export const renderSkillsLockWriteReceiptJson = (receipt: SkillsLockWriteReceipt): string => {
  const encoded = Result.getOrThrow(encodeWriteReceiptJson(receipt));
  const edits = jsonc.format(encoded, undefined, { tabSize: 2, insertSpaces: true });
  return `${jsonc.applyEdits(encoded, edits)}\n`;
};

const describeMaterializeTargets = (row: SkillMaterializeRow): string =>
  A.join(
    A.map(row.targets, (target) => `${target.target} ${target.state}`),
    ", "
  );

const describeMaterializeRow = (row: SkillMaterializeRow): string => {
  const patches = row.kind === "vendored" ? `, ${row.patches} patch(es)` : "";
  const skew = A.length(A.dedupe(A.map(row.targets, (target) => target.state))) > 1 ? "; targets skewed" : "";
  return `  ${row.skill}: ${row.status} (${row.kind}${patches}) [${describeMaterializeTargets(row)}]${skew}`;
};

/**
 * Renders a materialize report as a headline plus one line per entry.
 *
 * **Details**
 *
 * The headline counts entries per status. Each entry line names its status,
 * kind, patch count, and every install target with its state before the run
 * wrote anything; targets in different states are flagged as skewed, which is
 * what a crash between the two publish renames leaves behind.
 *
 * **Example** (Render an empty check report)
 *
 * ```ts
 * import { renderSkillMaterializeSummary } from "@beep/repo-cli/commands/Skills/Skills.render"
 * import { SkillMaterializeReport } from "@beep/repo-cli/commands/Skills/SkillsMaterialize.schemas"
 *
 * const report = SkillMaterializeReport.make({ mode: "check", rows: [] })
 * console.log(renderSkillMaterializeSummary(report)) // "skills materialize --check: 0 current, 0 rebuilt, 0 would-rebuild, 0 local-drift"
 * ```
 *
 * @param report - Mode plus one status row per lock entry (current, rebuilt, would-rebuild, local-drift).
 * @returns The headline followed by one line per entry.
 * @category formatting
 * @since 0.0.0
 */
export const renderSkillMaterializeSummary = (report: SkillMaterializeReport): string => {
  const count = (status: SkillMaterializeRow["status"]): string =>
    `${A.length(A.filter(report.rows, (row) => row.status === status))} ${status}`;
  const headline = `skills materialize${report.mode === "check" ? " --check" : ""}: ${A.join(
    [count("current"), count("rebuilt"), count("would-rebuild"), count("local-drift")],
    ", "
  )}`;
  return A.join([headline, ...A.map(report.rows, describeMaterializeRow)], "\n");
};
