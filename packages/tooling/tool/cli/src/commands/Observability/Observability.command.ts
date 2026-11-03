/**
 * `beep observability catalog --write | --check`: maintains the generated
 * per-package instrumentation catalog shards and the observability standard's
 * generated section.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { failWithReportedExit } from "@beep/repo-cli-kit/cli/ExitCodeError";
import { jsonFlag } from "@beep/repo-cli-kit/cli/Flags";
import { printCommandJson } from "@beep/repo-cli-kit/cli/Json";
import { stageGeneratedFiles } from "@beep/repo-cli-kit/cli/ShardScope";
import { findRepoRoot } from "@beep/repo-utils/Root";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Argument from "effect/cli/Argument";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import {
  CatalogRunReport,
  GeneratedFileStatus,
  INSTRUMENTATION_CATALOG_DIR,
  INSTRUMENTATION_CATALOG_GENERATED_BY,
  OBSERVABILITY_STANDARD_PATH,
} from "./Observability.schemas.ts";
import { InstrumentationCatalog, InstrumentationCatalogLive } from "./Observability.service.ts";

const encodeReport = S.encodeEffect(CatalogRunReport);
const isStagedStatus = S.is(S.Literals([GeneratedFileStatus.Enum.wrote, GeneratedFileStatus.Enum.removed]));

const reportLines = (report: CatalogRunReport): ReadonlyArray<string> => [
  `[observability-catalog] ${INSTRUMENTATION_CATALOG_DIR}: shards=${report.shards} drifted=${A.length(report.drifted)}`,
  ...A.map(report.drifted, (file) => `[observability-catalog] ${file.path}: ${file.status}`),
  `[observability-catalog] ${OBSERVABILITY_STANDARD_PATH}: ${report.standard}`,
  `[observability-catalog] spans=${report.spans} conforming=${report.conforming} non-conforming=${report.nonConforming}`,
  ...A.map(
    report.families,
    ({ family, spans, conforming }) =>
      `[observability-catalog] family=${family} spans=${spans} conforming=${conforming} non-conforming=${spans - conforming}`
  ),
  `[observability-catalog] attributes=${report.attributes} declared-instruments=${report.declaredInstruments} declaration-files=${A.length(report.declarationFiles)}`,
  `[observability-catalog] non-literal span names=${A.length(report.nonLiteral)} (reported, not failing)`,
  ...A.map(
    report.interpolated,
    (finding) => `[observability-catalog] interpolated span name ${finding.text} at ${finding.file}:${finding.line}`
  ),
  ...A.map(report.conflicts, (conflict) => `[observability-catalog] conflict: ${conflict}`),
];

const catalogCommand = Command.make(
  "catalog",
  {
    write: Flag.Boolean("write").pipe(
      Flag.withDefault(false),
      Flag.withDescription(
        `Regenerate the shards under ${INSTRUMENTATION_CATALOG_DIR} and the standard's generated section`
      )
    ),
    check: Flag.Boolean("check").pipe(
      Flag.withDefault(false),
      Flag.withDescription(
        "Fail on stale, missing or orphaned shards, conflicts, cross-package duplicate names or interpolated names (default)"
      )
    ),
    stage: Flag.Boolean("stage").pipe(
      Flag.withDefault(false),
      Flag.withDescription("After --write, add every rewritten or removed shard to the git index (pre-commit hook)")
    ),
    json: jsonFlag,
    paths: Argument.String("paths").pipe(
      Argument.variadic,
      Argument.withDescription(
        "Source paths whose owning packages' shards are regenerated; omit to scan the whole repository"
      )
    ),
  },
  Effect.fn(function* ({ write, check, stage, json, paths }) {
    if (write && check) {
      return yield* failWithReportedExit("observability catalog: pass --write or --check, not both.");
    }
    const report = yield* InstrumentationCatalog.use((catalog) =>
      catalog.run(write ? "write" : "check", A.filter(paths, P.isString))
    );
    if (write && stage) {
      const repoRoot = yield* findRepoRoot();
      yield* stageGeneratedFiles(
        repoRoot,
        A.filterMap(report.drifted, (file) =>
          isStagedStatus(file.status) ? Result.succeed(file.path) : Result.failVoid
        )
      );
    }
    if (json) {
      yield* printCommandJson(yield* encodeReport(report));
    } else {
      yield* Console.log(A.join(reportLines(report), "\n"));
    }
    if (!report.ok) {
      return yield* failWithReportedExit(
        `observability catalog: check failed; fix the findings above, then run ${INSTRUMENTATION_CATALOG_GENERATED_BY}.`
      );
    }
  })
).pipe(
  Command.withDescription("Write or check the generated instrumentation catalog"),
  Command.provide(InstrumentationCatalogLive)
);

/**
 * Observability command group.
 *
 * **Example** (Inspect the command name)
 *
 * ```ts
 * import { observabilityCommand } from "@beep/repo-cli/commands/Observability"
 *
 * console.log(observabilityCommand.name) // "observability"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const observabilityCommand = Command.make("observability", {}, () =>
  Console.log("Observability commands: catalog")
).pipe(
  Command.withDescription("Instrumentation catalog and observability standards"),
  Command.withSubcommands([catalogCommand])
);
