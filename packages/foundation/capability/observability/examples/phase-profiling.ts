import { profilePhase } from "@beep/observability";
import * as Effect from "effect/Effect";
import * as Metric from "effect/Metric";

const started = Metric.counter("example_phase_started_total");
const completed = Metric.counter("example_phase_completed_total");
const failed = Metric.counter("example_phase_failed_total");

void profilePhase(
  {
    phase: "retrieve",
    attributes: { run_kind: "query" },
    started,
    completed,
    failed,
  },
  Effect.succeed("ok")
);
