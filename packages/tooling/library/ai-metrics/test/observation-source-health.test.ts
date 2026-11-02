import {
  ObservationSourceCycle,
  ObservationSourceHealth,
  renderObservationSourceMetrics,
  summarizeObservationSources,
} from "@beep/repo-ai-metrics/observation-source-health";
import { TranscriptDiscoveryReport } from "@beep/repo-ai-metrics/transcript-discovery";
import { TranscriptAcceptance } from "@beep/repo-ai-metrics/transcript-intake";
import { TranscriptPageError } from "@beep/repo-ai-metrics/transcript-page";
import { TranscriptSweepOutcome, TranscriptSweepReport } from "@beep/repo-ai-metrics/transcript-sweep";
import { Sha256Hex } from "@beep/schema";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Str from "effect/String";

const sourceId = Sha256Hex.make(Str.repeat(64)("a"));

it.effect("counts page occurrences and partial tails separately without claiming delivery or fleet coverage", () =>
  Effect.sync(() => {
    const discovery = TranscriptDiscoveryReport.make({
      operations: 4,
      candidates: 5,
      activeHelpers: 1,
      roots: [
        {
          rootId: sourceId,
          source: "codex",
          state: "complete",
          cycle: 2,
          entries: 5,
          candidates: 5,
          excludedLinks: 0,
          read: { assessed: 5, pending: 1, accepted: 2, idle: 1, partial: 2, backlogged: 1, failed: 1 },
        },
      ],
    });
    const accepted = (frames: number, waitingForPartialLine: boolean) =>
      TranscriptSweepOutcome.cases.Accepted.make({
        sourceId,
        receipt: TranscriptAcceptance.make({
          receiptId: sourceId,
          sequence: 1,
          acceptedAt: 1000,
          payloadBytes: 100,
          frames,
        }),
        reset: "none",
        waitingForPartialLine,
        remainingBytes: 0,
      });
    const summary = summarizeObservationSources({
      discovery,
      sweep: TranscriptSweepReport.make({
        declared: 5,
        retired: 0,
        eligible: 5,
        outcomes: [
          accepted(3, false),
          accepted(2, true),
          TranscriptSweepOutcome.cases.Idle.make({ sourceId, waitingForPartialLine: false }),
          TranscriptSweepOutcome.cases.Idle.make({ sourceId, waitingForPartialLine: true }),
          TranscriptSweepOutcome.cases.Failed.make({
            sourceId,
            error: TranscriptPageError.make({ reason: "unavailable" }),
          }),
        ],
      }),
    });
    expect(summary).toMatchObject({
      acceptedPages: 2,
      acceptedFrames: 5,
      idleFiles: 1,
      partialFiles: 2,
      failedFiles: 1,
    });
    const metrics = renderObservationSourceMetrics(
      ObservationSourceHealth.cases.Configured.make({
        observedAt: 2500,
        running: true,
        phase: "degraded",
        lastCycleAgeMillis: O.some(500),
        lastCycle: O.some({
          startedAt: 1000,
          completedAt: 2000,
          result: ObservationSourceCycle.cases.Completed.make({ summary }),
        }),
      })
    );
    for (const [name, value] of [
      ["pass_accepted_pages", 2],
      ["pass_accepted_frames", 5],
      ["pass_idle_files", 1],
      ["pass_partial_files", 2],
      ["pass_failed_files", 1],
      ["cycle_pending_files", 1],
      ["cycle_partial_files", 2],
      ["cycle_failed_files", 1],
      ["cycle_backlogged_files", 1],
      ["cycle_assessed_files", 5],
      ["active_helpers", 1],
      ["pass_operations", 4],
    ])
      expect(metrics).toContain(`beep_observation_sources_${name} ${value}\n`);
    expect(metrics).toContain('beep_observation_sources_roots{state="complete"} 1');
    expect(metrics).not.toContain(sourceId);
    expect(metrics).not.toContain("_total");
  })
);

it.effect("omits unknown source counts before observation and after incomplete cycles", () =>
  Effect.sync(() => {
    const absent = renderObservationSourceMetrics(ObservationSourceHealth.cases.NotConfigured.make({}));
    expect(absent).toContain("beep_observation_sources_configured 0");
    expect(absent).not.toContain("beep_observation_sources_running");
    const outcomes = [
      O.none(),
      ...A.map(
        [
          ObservationSourceCycle.cases.Failed.make({}),
          ObservationSourceCycle.cases.Deadline.make({}),
          ObservationSourceCycle.cases.Paused.make({}),
        ],
        (result) => O.some({ startedAt: 1000, completedAt: 2000, result })
      ),
    ];
    for (const lastCycle of outcomes) {
      const metrics = renderObservationSourceMetrics(
        ObservationSourceHealth.cases.Configured.make({
          observedAt: 2500,
          running: false,
          phase: "stopped",
          lastCycle,
          lastCycleAgeMillis: O.none(),
        })
      );
      expect(metrics).toContain("beep_observation_sources_running 0");
      expect(metrics).not.toContain("beep_observation_sources_pass_accepted_pages");
      expect(metrics).not.toContain("beep_observation_sources_cycle_pending_files");
      expect(metrics).not.toContain("beep_observation_sources_roots");
    }
  })
);
