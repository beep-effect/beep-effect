import { TranscriptIngestSummary } from "@beep/repo-ai-metrics/models";
import {
  makeAiMetricsPrivacyCheckResult,
  privacyCheckToJson,
  redactAiMetricsSensitiveText,
} from "@beep/repo-ai-metrics/privacy";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Str from "effect/String";

const canary = () => A.join(["canary", "Alpha", "4927", "Beta"], "");
const summary = TranscriptIngestSummary.make({
  acceptedEvents: 0,
  eventNames: [],
  rejectedLines: 0,
  sourceKind: "codex",
  sourcePathHash: "0000000000000000000000000000000000000000000000000000000000000000",
  totalLines: 0,
});

describe("metrics canonical bank compatibility", () => {
  it.effect("preserves rendering and updates counts only for union matches", () =>
    Effect.gen(function* () {
      for (const name of ["TOKEN", "2-session-id", "pass", "passwd"]) {
        const input = `${name} : ${canary()}`;
        expect(redactAiMetricsSensitiveText(input) === `${name}=[REDACTED]`).toBe(true);
        const result = yield* makeAiMetricsPrivacyCheckResult({
          content: input,
          hashSalt: O.some("synthetic-salt"),
          relativePath: O.none(),
          sourcePath: "synthetic.txt",
          summary,
        });
        expect(result.redaction.secretAssignmentCount).toBe(1);
        expect(result.redaction.safeForDerivedUi).toBe(false);
        expect(Str.includes(canary())(yield* privacyCheckToJson(result))).toBe(false);
      }
      for (const header of ["Authorization", "Proxy-Authorization", "Cookie", "Set-Cookie"]) {
        const input = `${header}: ${canary()}`;
        expect(redactAiMetricsSensitiveText(input) === `${header}: [REDACTED]`).toBe(true);
        const result = yield* makeAiMetricsPrivacyCheckResult({
          content: input,
          hashSalt: O.some("synthetic-salt"),
          relativePath: O.none(),
          sourcePath: "synthetic.txt",
          summary,
        });
        expect(result.redaction.authHeaderCount).toBe(1);
        expect(result.redaction.safeForDerivedUi).toBe(false);
        expect(Str.includes(canary())(yield* privacyCheckToJson(result))).toBe(false);
      }
      expect(redactAiMetricsSensitiveText(`Authorization: Bearer ${canary()}`) === "Authorization: [REDACTED]").toBe(
        true
      );
      for (const input of [
        `APP_TOKEN="public Authorization: ${canary()}"`,
        `APP_TOKEN="Authorization: public" OTHER_TOKEN=${canary()}`,
        `Authorization: APP_TOKEN="public\n${canary()}"`,
      ]) {
        expect(Str.includes(canary())(redactAiMetricsSensitiveText(input))).toBe(false);
      }
    })
  );
});
