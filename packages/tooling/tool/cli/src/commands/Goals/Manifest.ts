/**
 * `beep goals manifest` — write or verify the generated `researchReports` projection.
 *
 * **Details**
 *
 * `--write` regenerates `researchReports` in every `goals/<slug>/ops/manifest.json`
 * from the packet's `research/` listing (sorted, deduplicated, dot-segments
 * hidden), moves entries that point outside `research/` to the hand-maintained
 * `researchReferences` key, and runs `biome format` over the manifests it
 * rewrote so the bytes match the repository formatter. `--check` (the default)
 * reports every drifted packet and exits non-zero; `beep goals doctor` reports
 * the same drift as the blocking `research-reports-drift` finding, which is the
 * hosted proof. `goals/<slug>/ops/manifest.json` sits on the `regenerate` merge
 * driver: a concurrent edit leaves the file conflicted and this writer resolves
 * it after the merged tree is installed.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { failWithReportedExit } from "@beep/repo-cli-kit/cli/ExitCodeError";
import { writeContainedFileString } from "@beep/repo-cli-kit/cli/FsGuards";
import { runToExit } from "@beep/repo-cli-kit/process/StepExec";
import { A, O, pipe } from "@beep/utils";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { makeGoalPacketWorkingTreeReader } from "./Doctor.ts";
import { isJsonRecord, listGoalPacketsStrict, parseGoalManifestText } from "./Inventory.ts";
import { GoalManifestFormatter } from "./Manifest.service.ts";
import {
  diffResearchReports,
  listedManifestStrings,
  planResearchProjection,
  projectResearchReports,
  RESEARCH_REPORTS_KEY,
  ResearchReportsDrift,
  renderResearchReportsDrift,
} from "./ManifestProjection.ts";
import type { GoalPacketReader } from "./Doctor.ts";
import type { GoalPacketRecord } from "./Inventory.ts";
import type { GoalManifestFormatterShape } from "./Manifest.service.ts";

const $I = $RepoCliId.create("commands/Goals/Manifest");

/**
 * One packet whose manifest needs the projection rewritten.
 *
 * **Example** (Construct a row)
 *
 * ```ts
 * import { ManifestProjectionRow } from "@beep/repo-cli/commands/Goals/Manifest"
 * import { ResearchReportsDrift } from "@beep/repo-cli/commands/Goals/ManifestProjection"
 *
 * const row = ManifestProjectionRow.make({
 *   slug: "demo",
 *   manifestPath: "goals/demo/ops/manifest.json",
 *   nextText: "{}\n",
 *   drift: ResearchReportsDrift.make({ missing: [], unlisted: ["research/x.md"], references: [], reordered: false }),
 * })
 * console.log(row.slug) // "demo"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ManifestProjectionRow extends S.Opaque<ManifestProjectionRow, { readonly brand: unique symbol }>()(
  S.Struct({
    slug: S.String,
    manifestPath: S.String,
    nextText: S.String,
    drift: ResearchReportsDrift,
  }).pipe(
    $I.annoteSchema("ManifestProjectionRow", {
      description: "One goal packet whose researchReports projection drifted, with the rewritten manifest text.",
    })
  )
) {}

const projectionRow = Effect.fn("Goals.projectionRow")(function* <E, R>(
  record: GoalPacketRecord,
  reader: GoalPacketReader<E, R>
) {
  // A missing or unparsable manifest is the doctor's finding, not this writer's: it is skipped here.
  const raw = pipe(O.fromUndefinedOr(record.manifestText), O.flatMap(parseGoalManifestText), O.filter(isJsonRecord));
  if (O.isNone(raw) || record.manifestText === undefined) return O.none<ManifestProjectionRow>();
  const files = yield* reader.researchFiles(record.packetPath);
  const expected = projectResearchReports(files);
  const drift = diffResearchReports(listedManifestStrings(raw.value, RESEARCH_REPORTS_KEY), expected);
  const nextText = planResearchProjection(record.manifestText, expected);
  return O.map(O.all({ drift, nextText }), (row) =>
    ManifestProjectionRow.make({
      slug: record.slug,
      manifestPath: record.manifestPath,
      nextText: row.nextText,
      drift: row.drift,
    })
  );
});

/**
 * Collects every packet whose `researchReports` drifts from its `research/` listing.
 *
 * **Example** (Build the collection effect)
 *
 * ```ts
 * import { collectManifestProjectionRows } from "@beep/repo-cli/commands/Goals/Manifest"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(collectManifestProjectionRows())) // true
 * ```
 *
 * @param repoRoot - Checkout to scan; packet paths are joined onto it.
 * @returns The drifted packets in slug order, each with its rewritten manifest text.
 * @category queries
 * @since 0.0.0
 */
export const collectManifestProjectionRows = Effect.fn("Goals.collectManifestProjectionRows")(function* (
  repoRoot = "."
) {
  const records = yield* listGoalPacketsStrict(repoRoot);
  const reader = yield* makeGoalPacketWorkingTreeReader(repoRoot);
  const rows = yield* Effect.forEach(records, (record) => projectionRow(record, reader), {
    concurrency: 1,
  });
  return A.getSomes(rows);
});

/**
 * Live {@link GoalManifestFormatter}: `bunx biome format --write` over the rewritten manifests.
 *
 * **Details**
 *
 * Biome decides line breaks (a short array collapses to one line); the JSONC
 * edit cannot predict that, so the writer formats exactly the files it
 * rewrote. A non-zero Biome exit fails the command, because the unformatted
 * manifests would red the hosted Biome lane.
 *
 * **Example** (Read the live formatter's shape)
 *
 * ```ts
 * import { biomeManifestFormatter } from "@beep/repo-cli/commands/Goals/Manifest"
 *
 * console.log(typeof biomeManifestFormatter.format) // "function"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const biomeManifestFormatter: GoalManifestFormatterShape = {
  format: Effect.fn("Goals.biomeManifestFormatter")(function* (repoRoot: string, paths: ReadonlyArray<string>) {
    const args = ["biome", "format", "--write", ...paths];
    const exitCode = yield* runToExit({ command: "bunx", args, cwd: repoRoot, stdio: "ignore" }).pipe(
      Effect.orElseSucceed(() => 1)
    );
    if (exitCode !== 0) {
      yield* Console.error(`[goals:manifest] bunx ${A.join(args, " ")} exited ${exitCode}.`);
      return yield* failWithReportedExit("goals manifest: biome format failed on the rewritten manifests.");
    }
  }),
};

const driftLine = (row: ManifestProjectionRow): string => `- ${row.slug}: ${renderResearchReportsDrift(row.drift)}`;

/**
 * Runs `beep goals manifest`: rewrite drifted projections or report them.
 *
 * **Example** (Build the check effect)
 *
 * ```ts
 * import { runGoalsManifest } from "@beep/repo-cli/commands/Goals/Manifest"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(runGoalsManifest({ write: false, check: true }))) // true
 * ```
 *
 * @param options - `write` rewrites drifted manifests; `check` (the default) only reports them.
 * @param repoRoot - Checkout to scan and write into.
 * @category use-cases
 * @since 0.0.0
 */
export const runGoalsManifest = Effect.fn("Goals.runGoalsManifest")(function* (
  options: {
    readonly write: boolean;
    readonly check: boolean;
  },
  repoRoot = "."
) {
  if (options.write && options.check) {
    yield* Console.error("[goals:manifest] --write and --check are mutually exclusive.");
    return yield* failWithReportedExit("goals manifest: --write and --check are mutually exclusive.");
  }
  const rows = yield* collectManifestProjectionRows(repoRoot);
  if (A.isReadonlyArrayEmpty(rows)) {
    yield* Console.log("[goals:manifest] OK: every researchReports array matches its research/ listing.");
    return;
  }
  if (!options.write) {
    yield* Console.error(`[goals:manifest] ${A.length(rows)} manifest(s) drift from research/:`);
    yield* Effect.forEach(rows, (row) => Console.error(driftLine(row)), { discard: true });
    return yield* failWithReportedExit(
      "goals manifest: researchReports drift; run bun run beep goals manifest --write."
    );
  }
  yield* Effect.forEach(rows, (row) => writeContainedFileString(repoRoot, row.manifestPath, row.nextText), {
    discard: true,
  });
  const formatter = yield* Effect.serviceOption(GoalManifestFormatter);
  yield* O.getOrElse(formatter, () => biomeManifestFormatter).format(
    repoRoot,
    A.map(rows, (row) => row.manifestPath)
  );
  yield* Effect.forEach(rows, (row) => Console.log(driftLine(row)), { discard: true });
  yield* Console.log(`[goals:manifest] wrote ${A.length(rows)} manifest(s).`);
});

const writeFlag = Flag.Boolean("write").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Rewrite every drifted researchReports projection and biome-format the manifests")
);
const checkFlag = Flag.Boolean("check").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Report drifted manifests and exit non-zero (the default when no flag is given)")
);

/**
 * `bun run beep goals manifest` — generated `researchReports` projection writer and check.
 *
 * **Example** (Read the subcommand identity)
 *
 * ```ts
 * import { goalsManifestCommand } from "@beep/repo-cli/commands/Goals/Manifest"
 *
 * console.log(goalsManifestCommand.name) // "manifest"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const goalsManifestCommand = Command.make(
  "manifest",
  { write: writeFlag, check: checkFlag },
  Effect.fn("Goals.manifestCommand")(function* ({ write, check }) {
    yield* runGoalsManifest({ write, check });
  })
).pipe(
  Command.withDescription(
    "Regenerate (--write) or verify (--check) the researchReports projection of every goals/<slug>/research/"
  )
);
