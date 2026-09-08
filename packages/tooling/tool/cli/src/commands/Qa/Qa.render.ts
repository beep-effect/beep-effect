/**
 * Pure renderers for recorded-QA round reports and judge inventories.
 *
 * Every function here is a total string builder over already-decoded models,
 * so `beep qa report` can re-render a round from `session.json` alone and the
 * rendering is unit-testable without a filesystem.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, O, Str, thunkEmptyReadonlyArray, thunkEmptyStr } from "@beep/utils";
import { HashMap, Number as N, pipe } from "effect";
import { dual } from "effect/Function";
import { isRequiredSeverity } from "./Inventory.schemas.ts";
import type { ActionEvent, CaptureArtifact, ExtractionPlan, SessionManifest } from "@beep/qa-capture";
import type { QaFinding, QaInventory } from "./Inventory.schemas.ts";
import type { QaEventLog } from "./Qa.session.ts";

const BYTES_PER_MIB = 1024 * 1024;

/**
 * Render a byte count as fixed-precision mebibytes.
 *
 * **Example** (Format bytes as mebibytes)
 *
 * ```ts
 * import { formatMib } from "@beep/repo-cli/commands/Qa/Qa.render"
 *
 * console.log(formatMib(2097152)) // "2.00 MiB"
 * ```
 *
 * @param bytes - Byte count to format.
 * @returns The count in mebibytes, to two decimal places.
 * @category formatting
 * @since 0.0.0
 */
export const formatMib = (bytes: number): string => `${(bytes / BYTES_PER_MIB).toFixed(2)} MiB`;

const tableRow = (cells: ReadonlyArray<string>): string => `| ${A.join(cells, " | ")} |`;

const table = (headers: ReadonlyArray<string>, rows: ReadonlyArray<ReadonlyArray<string>>): ReadonlyArray<string> =>
  A.isReadonlyArrayNonEmpty(rows)
    ? [tableRow(headers), tableRow(A.map(headers, () => "---")), ...A.map(rows, tableRow)]
    : ["_none_"];

const countByKind = (events: ReadonlyArray<ActionEvent>): ReadonlyArray<readonly [string, number]> =>
  pipe(
    A.reduce(events, HashMap.empty<string, number>(), (acc, event) =>
      HashMap.set(acc, event.kind, O.getOrElse(HashMap.get(acc, event.kind), () => 0) + 1)
    ),
    HashMap.toEntries,
    A.sort<readonly [string, number]>((left, right) => Str.Order(left[0], right[0]))
  );

const artifactRow = (artifact: CaptureArtifact): ReadonlyArray<string> => [
  artifact.relativePath,
  artifact.kind,
  O.match(artifact.fileSizeBytes, { onNone: () => "-", onSome: (bytes) => `${bytes}` }),
  `${A.length(artifact.eventSeqs)}`,
];

const artifactBytes = (artifacts: ReadonlyArray<CaptureArtifact>): number =>
  A.reduce(artifacts, 0, (total, artifact) => total + O.getOrElse(artifact.fileSizeBytes, () => 0));

const clockSection = (manifest: SessionManifest): ReadonlyArray<string> =>
  O.match(manifest.clockSync, {
    onNone: () => ["_not correlated yet — run `bun run beep qa extract`._"],
    onSome: (clock) => [
      `- method: \`${clock.method}\``,
      `- confidence: \`${clock.confidence}\``,
      `- slope: ${clock.slope}`,
      `- offset: ${N.round(clock.offsetMs, 1)} ms`,
      `- residual RMS: ${N.round(clock.residualRmsMs, 1)} ms`,
    ],
  });

const warnings = (
  manifest: SessionManifest,
  eventLog: QaEventLog,
  plan: O.Option<ExtractionPlan>
): ReadonlyArray<string> => {
  const clockWarning = O.match(manifest.clockSync, {
    onNone: (): ReadonlyArray<string> => ["Clock sync has not been derived; artifact timings are unverified."],
    onSome: (clock): ReadonlyArray<string> =>
      clock.confidence === "low"
        ? ["Clock confidence is low; extraction windows were padded by 250 ms and frame timings may drift."]
        : [],
  });
  const rejectedWarning =
    eventLog.rejectedCount > 0 ? [`${eventLog.rejectedCount} witness line(s) failed schema decoding.`] : [];
  const videoWarning = O.isNone(manifest.videoPath) ? ["No recorded video was captured for this round."] : [];
  const droppedWarning = O.match(plan, {
    onNone: (): ReadonlyArray<string> => [],
    onSome: (value): ReadonlyArray<string> =>
      A.isReadonlyArrayNonEmpty(value.dropped)
        ? [`${A.length(value.dropped)} window(s) were degraded or dropped to stay inside the artifact budget.`]
        : [],
  });
  return [...clockWarning, ...rejectedWarning, ...videoWarning, ...droppedWarning];
};

const bulletList = (lines: ReadonlyArray<string>): ReadonlyArray<string> =>
  A.isReadonlyArrayNonEmpty(lines) ? A.map(lines, (line) => `- ${line}`) : ["_none_"];

const droppedLine = (dropped: ExtractionPlan["dropped"][number]): string => {
  const detail = pipe(
    dropped.detail,
    O.map((value) => `: ${value}`),
    O.getOrElse(thunkEmptyStr)
  );
  return `\`${dropped.ruleKind}\` ${dropped.priority} [${dropped.startEpochMs}, ${dropped.endEpochMs}] — ${dropped.reason}${detail}`;
};

/**
 * Render a round's `report.md` from its decoded session manifest.
 *
 * **Example** (Report from session manifest)
 *
 * ```ts
 * import { CaptureSession, SessionManifest, Viewport } from "@beep/qa-capture"
 * import { renderRoundReport } from "@beep/repo-cli/commands/Qa/Qa.render"
 * import { QaEventLog } from "@beep/repo-cli/commands/Qa/Qa.session"
 * import * as O from "effect/Option"
 *
 * const manifest = SessionManifest.make({
 *   artifacts: [],
 *   clockSync: O.none(),
 *   eventsPath: "events.ndjson",
 *   legacyManifestPath: O.none(),
 *   schemaVersion: "beep.qa.capture-session.v1",
 *   session: CaptureSession.make({
 *     commitDirty: false,
 *     commitSha: "a73f509",
 *     id: "qa-round-1-1754000000000",
 *     lane: "playwright",
 *     round: 1,
 *     scenario: O.none(),
 *     startedAtEpochMs: 1754000000000,
 *     toolVersions: {},
 *     url: "http://storybook.beep.localhost:1355/",
 *     viewport: Viewport.make({ height: 1000, width: 1600 })
 *   }),
 *   videoPath: O.none()
 * })
 *
 * const report = renderRoundReport(manifest, QaEventLog.make({ events: [], rejectedCount: 0 }), O.none())
 * console.log(report.startsWith("# QA round 1")) // true
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const renderRoundReport: {
  (eventLog: QaEventLog, plan: O.Option<ExtractionPlan>): (manifest: SessionManifest) => string;
  (manifest: SessionManifest, eventLog: QaEventLog, plan: O.Option<ExtractionPlan>): string;
} = dual(3, (manifest: SessionManifest, eventLog: QaEventLog, plan: O.Option<ExtractionPlan>): string => {
  const session = manifest.session;
  const budgetBytes = O.match(plan, { onNone: () => 0, onSome: (value) => value.budget.maxTotalBytes });
  const usedBytes = artifactBytes(manifest.artifacts);
  const lines: ReadonlyArray<string> = [
    `# QA round ${session.round} — report`,
    "",
    `- session: \`${session.id}\``,
    `- lane: \`${session.lane}\``,
    `- url: ${session.url}`,
    `- commit: \`${session.commitSha}\`${session.commitDirty ? " (dirty)" : ""}`,
    `- scenario: ${O.getOrElse(session.scenario, () => "_none_")}`,
    `- viewport: ${session.viewport.width}x${session.viewport.height}`,
    `- video: ${O.getOrElse(manifest.videoPath, () => "_none_")}`,
    "",
    "## Clock sync",
    "",
    ...clockSection(manifest),
    "",
    "## Events",
    "",
    ...table(
      ["kind", "count"],
      A.map(countByKind(eventLog.events), ([kind, count]) => [kind, `${count}`])
    ),
    "",
    `- total: ${A.length(eventLog.events)}`,
    `- rejected lines: ${eventLog.rejectedCount}`,
    "",
    "## Artifacts",
    "",
    ...table(["path", "kind", "bytes", "events"], A.map(manifest.artifacts, artifactRow)),
    "",
    budgetBytes > 0
      ? `- total: ${formatMib(usedBytes)} of ${formatMib(budgetBytes)} budget`
      : `- total: ${formatMib(usedBytes)}`,
    "",
    "## Dropped",
    "",
    ...bulletList(
      pipe(
        plan,
        O.map((value) => A.map(value.dropped, droppedLine)),
        O.getOrElse(thunkEmptyReadonlyArray<string>())
      )
    ),
    "",
    "## Warnings",
    "",
    ...bulletList(warnings(manifest, eventLog, plan)),
    "",
  ];
  return A.join(lines, "\n");
});

/**
 * Render the planner's window table for a `--dry-run` extraction.
 *
 * **Example** (Empty extraction plan table)
 *
 * ```ts
 * import { ArtifactBudget, ExtractionPlan } from "@beep/qa-capture"
 * import { renderExtractionPlanTable } from "@beep/repo-cli/commands/Qa/Qa.render"
 *
 * const plan = ExtractionPlan.make({
 *   budget: ArtifactBudget.make({}),
 *   dropped: [],
 *   estimatedTotalBytes: 0,
 *   schemaVersion: "beep.qa.extraction-plan.v1",
 *   windows: []
 * })
 * console.log(renderExtractionPlanTable(plan, 0).length > 0) // true
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const renderExtractionPlanTable: {
  (driverRequestCount: number): (plan: ExtractionPlan) => ReadonlyArray<string>;
  (plan: ExtractionPlan, driverRequestCount: number): ReadonlyArray<string>;
} = dual(
  2,
  (plan: ExtractionPlan, driverRequestCount: number): ReadonlyArray<string> => [
    `qa extract --dry-run: ${A.length(plan.windows)} window(s), ${driverRequestCount} driver request(s)`,
    ...table(
      ["label", "rule", "priority", "start", "end", "frames", "gif"],
      A.map(plan.windows, (window) => [
        window.label,
        window.ruleKind,
        window.priority,
        `${window.startEpochMs}`,
        `${window.endEpochMs}`,
        `${A.length(window.frameTimesEpochMs)}`,
        O.match(window.gif, { onNone: () => "-", onSome: (gif) => `${gif.width}px@${gif.fps}fps` }),
      ])
    ),
    `estimated: ${formatMib(plan.estimatedTotalBytes)} of ${formatMib(plan.budget.maxTotalBytes)} budget`,
    ...A.map(
      plan.dropped,
      (dropped) =>
        `dropped ${dropped.ruleKind} ${dropped.priority} [${dropped.startEpochMs}, ${dropped.endEpochMs}] — ${dropped.reason}`
    ),
  ]
);

const evidenceLine = (finding: QaFinding): ReadonlyArray<string> =>
  A.map(finding.evidence, (evidence) => {
    const range = O.match(evidence.frameRange, {
      onNone: thunkEmptyStr,
      onSome: ([first, last]) => ` frames ${first}–${last}`,
    });
    const events = A.isReadonlyArrayNonEmpty(evidence.eventIds)
      ? ` events ${A.join(
          A.map(evidence.eventIds, (seq) => `${seq}`),
          ", "
        )}`
      : "";
    return `  - \`${evidence.kind}\` \`${evidence.path}\`${range}${events}`;
  });

const findingSection = (finding: QaFinding): ReadonlyArray<string> => [
  `### ${finding.id} — ${finding.severity} — ${finding.title}`,
  "",
  `- lens: \`${finding.lens}\``,
  `- repro: ${finding.repro}`,
  `- fix: ${finding.fix}`,
  ...O.match(finding.resolvedInRound, {
    onNone: (): ReadonlyArray<string> => [],
    onSome: (round) => [`- resolved in round: ${round}`],
  }),
  "- evidence:",
  ...evidenceLine(finding),
  "",
];

/**
 * Render `inventory.md` from a decoded {@link QaInventory}.
 *
 * **Details**
 *
 * The final line is the machine-readable verdict the loop protocol reads; the
 * count comes from the decoded inventory, which the schema already proved
 * consistent with its findings.
 *
 * **Example** (Inventory ending in verdict)
 *
 * ```ts
 * import { QaInventory, QaJudgeRef } from "@beep/repo-cli/commands/Qa/Inventory.schemas"
 * import { renderInventoryMarkdown } from "@beep/repo-cli/commands/Qa/Qa.render"
 *
 * const inventory = QaInventory.make({
 *   findings: [],
 *   judge: QaJudgeRef.make({ effort: "high", model: "gpt-daybreak-blue-latest" }),
 *   requiredCount: 0,
 *   round: 4,
 *   schemaVersion: "qa-inventory/v1",
 *   sessionRef: "session.json"
 * })
 * console.log(renderInventoryMarkdown(inventory).endsWith("REQUIRED FINDINGS: 0\n")) // true
 * ```
 *
 * @param inventory - Decoded inventory to render.
 * @returns Markdown lines ending in the machine-readable verdict.
 * @category formatting
 * @since 0.0.0
 */
export const renderInventoryMarkdown = (inventory: QaInventory): string => {
  const required = A.filter(inventory.findings, (finding) => isRequiredSeverity(finding.severity));
  const optional = A.filter(inventory.findings, (finding) => !isRequiredSeverity(finding.severity));
  const lines: ReadonlyArray<string> = [
    `# QA round ${inventory.round} — vision judge inventory`,
    "",
    `- judge: \`${inventory.judge.model}\` (effort \`${inventory.judge.effort}\`)`,
    `- session: \`${inventory.sessionRef}\``,
    `- findings: ${A.length(inventory.findings)} (${A.length(required)} required, ${A.length(optional)} polish)`,
    "",
    "## Required findings",
    "",
    ...(A.isReadonlyArrayNonEmpty(required) ? A.flatMap(required, findingSection) : ["_none_", ""]),
    "## Polish findings",
    "",
    ...(A.isReadonlyArrayNonEmpty(optional) ? A.flatMap(optional, findingSection) : ["_none_", ""]),
    `REQUIRED FINDINGS: ${inventory.requiredCount}`,
    "",
  ];
  return A.join(lines, "\n");
};
