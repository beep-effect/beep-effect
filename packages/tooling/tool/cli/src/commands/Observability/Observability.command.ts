/**
 * `beep observability catalog --write | --check`: maintains the generated
 * instrumentation catalog and the observability standard's generated section.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import { jsonFlag } from "../../internal/cli/Flags.ts";
import { printCommandJson } from "../../internal/cli/Json.ts";
import {
  CatalogRunReport,
  INSTRUMENTATION_CATALOG_GENERATED_BY,
  INSTRUMENTATION_CATALOG_PATH,
  OBSERVABILITY_STANDARD_PATH,
} from "./Observability.schemas.ts";
import { InstrumentationCatalog, InstrumentationCatalogLive } from "./Observability.service.ts";

const encodeReport = S.encodeEffect(CatalogRunReport);

const reportLines = (report: CatalogRunReport): ReadonlyArray<string> => [
  `[observability-catalog] ${INSTRUMENTATION_CATALOG_PATH}: ${report.catalog}`,
  `[observability-catalog] ${OBSERVABILITY_STANDARD_PATH}: ${report.standard}`,
  `[observability-catalog] spans=${report.spans} conforming=${report.conforming} non-conforming=${report.nonConforming}`,
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
      Flag.withDescription(`Regenerate ${INSTRUMENTATION_CATALOG_PATH} and the standard's generated section`)
    ),
    check: Flag.Boolean("check").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Fail on drift, conflicts, cross-package duplicate names or interpolated names (default)")
    ),
    json: jsonFlag,
  },
  Effect.fn(function* ({ write, check, json }) {
    if (write && check) {
      return yield* failWithReportedExit("observability catalog: pass --write or --check, not both.");
    }
    const report = yield* InstrumentationCatalog.use((catalog) => catalog.run(write ? "write" : "check"));
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
