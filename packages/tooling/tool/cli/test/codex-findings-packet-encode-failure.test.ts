import { CodexFindingRecord, CodexPacketPlan, renderPacketDocuments } from "@beep/repo-cli/test/Codex";
import { A, Str } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { vi } from "vitest";

// The triage ledger is built from an already-validated plan, so its encode can
// only fail if the codec itself fails. Forcing that is the sole way to reach
// the ingest-error mapping the renderer wraps the encode in.
vi.mock("@beep/repo-cli/commands/Codex/Findings.triage.schemas", (importOriginal) =>
  Promise.all([
    importOriginal<typeof import("@beep/repo-cli/commands/Codex/Findings.triage.schemas")>(),
    import("effect/Effect"),
  ]).then(([schemas, EffectModule]) => ({
    ...schemas,
    encodeCodexTriageLedger: () => EffectModule.fail(new Error("forced triage-ledger encode failure")),
  }))
);

const planWith = (records: ReadonlyArray<CodexFindingRecord>) =>
  CodexPacketPlan.make({
    slug: "codex-security-findings-2026-08-06",
    branch: "security/codex-findings-2026-08-06",
    capturedAt: "2026-08-06",
    repository: "kriegcloud/beep-effect",
    sourceUrl: "https://chatgpt.com/codex/cloud/security/findings/",
    findingsView: "repo-scoped, status=open",
    expectedCount: A.length(records),
    records,
    severityCounts: { Medium: A.length(records) },
  });

describe("codex findings packet rendering", () => {
  it.effect("maps a failing triage-ledger encode onto a payload-invalid ingest error", () =>
    Effect.gen(function* () {
      const plan = planWith([
        CodexFindingRecord.make({
          id: "CSF-001",
          codexId: Str.padStart(32, "0")("1"),
          title: "Synthetic finding 1",
          severity: "Medium",
          codexStatus: "New",
          commit: Str.padStart(40, "a")("1"),
        }),
      ]);

      const error = yield* Effect.flip(renderPacketDocuments({ plan, rawPayloadJson: '{"findings":[]}\n' }));

      expect(error.reason).toBe("payload-invalid");
      expect(error.message).toBe("The generated ops/triage.json ledger could not be encoded.");
    })
  );
});
