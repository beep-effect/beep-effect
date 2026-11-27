import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import { CiOpsKpi } from "@/kpi/CiOpsKpi";
import { kpiOutputPaths, kpiReadingInput } from "@/kpi/Pins";
import { renderReadingJson, renderReadingMarkdown } from "@/kpi/Render";
import { runKpiScript, syncKpiArtifacts } from "@/kpi/Script";
import { decodeEvidenceMode, EvidenceMode, EvidenceWriteScript } from "@/projection/Evidence";

const repoRoot = "../../..";
const writeScript = EvidenceWriteScript.Enum["evidence:kpi:write"];

// decision: opt-in-evidence-writes
const generate = Effect.gen(function* () {
  const mode = yield* decodeEvidenceMode(process.argv, writeScript);
  const reading = yield* (yield* CiOpsKpi).read(kpiReadingInput(repoRoot));
  yield* syncKpiArtifacts(mode, repoRoot, writeScript, [
    [kpiOutputPaths.readingJson, yield* renderReadingJson(reading)],
    [kpiOutputPaths.readingMarkdown, renderReadingMarkdown(reading)],
  ]);
  const normative = A.findFirst(reading.starvation, (row) => row.slice === "W" && row.normative);
  const starvation = O.match(normative, {
    onNone: () => "absent",
    onSome: (row) => `${row.beyondBound} of ${row.requests}`,
  });
  yield* Console.log(
    `${EvidenceMode.is.check(mode) ? "Checked" : "Wrote"} ${kpiOutputPaths.readingJson} and ${kpiOutputPaths.readingMarkdown}: ${A.length(reading.percentiles)} percentile rows; normative starvation in W ${starvation}.`
  );
}).pipe(Effect.withSpan("KpiReading.generate"));

runKpiScript(generate);
