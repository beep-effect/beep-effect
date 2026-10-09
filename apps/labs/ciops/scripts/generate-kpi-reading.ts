import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import { CiOpsKpi } from "@/kpi/CiOpsKpi";
import { kpiOutputPaths, kpiReadingInput } from "@/kpi/Pins";
import { renderReadingJson, renderReadingMarkdown } from "@/kpi/Render";
import { runKpiScript, syncKpiArtifacts } from "@/kpi/Script";
import { decodeEvidenceMode, EvidenceMode, EvidenceWriteScript } from "@/projection/Evidence";

// The W8 KPI reading (S7 contract §9, launch sitting Ruling 10). The service reads every pin
// by path and SHA-256 (the typed constants in `Pins.ts`, shared with the end-to-end test) and
// folds them with no wall clock, environment read or process spawn. Run the snapshot's own
// `research/scripts/redact_journal_snapshot.py --check` before this script: the reading pins
// the projection's digest, and that check is what ties the projection to its payload.
// Check-by-default: the bare script compares the committed JSON and Markdown with the
// recomputed render; only `--write` rewrites them.
const repoRoot = "../../..";
const writeScript = EvidenceWriteScript.Enum["evidence:kpi:write"];

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
