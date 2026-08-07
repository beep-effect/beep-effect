import {
  decodeCodexFindingsCapturePayload,
  decodeCodexFindingsIngestOptions,
  planPacket,
  priorIdsOfEntries,
  recordIdForOrdinal,
  severityCountsOf,
} from "@beep/repo-cli/test/Codex";
import { A, O } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as S from "effect/Schema";
import type { CodexFindingsIngestError } from "@beep/repo-cli/test/Codex";

const hex = (seed: string, length: number): string => {
  const digits = "0123456789abcdef";
  return A.join(
    A.map(A.range(0, length - 1), (index) => digits[(seed.charCodeAt(index % seed.length) + index) % 16] ?? "0"),
    ""
  );
};

const captureFinding = (input: {
  readonly codexId: string;
  readonly title?: string;
  readonly severity?: string;
  readonly codexStatus?: string;
  readonly commit?: string;
}) => ({
  codexId: input.codexId,
  title: input.title ?? "A captured finding",
  severity: input.severity ?? "Medium",
  codexStatus: input.codexStatus ?? "Open",
  commit: input.commit ?? hex(input.codexId, 40),
});

const payloadOf = (
  findings: ReadonlyArray<ReturnType<typeof captureFinding>>,
  overrides: { readonly expectedCount?: number; readonly authState?: string } = {}
) => ({
  schemaVersion: "codex-findings-capture/v1",
  capture: {
    capturedAt: "2026-08-04",
    sourceUrl: "https://chatgpt.com/codex/cloud/security/findings/",
    repository: "kriegcloud/beep-effect",
    findingsView: "repo-scoped, status=open",
    expectedCount: overrides.expectedCount ?? A.length(findings),
    authState: overrides.authState ?? "authenticated",
  },
  findings,
});

const decodePayload = (value: unknown) => decodeCodexFindingsCapturePayload(value);

const planFrom = (value: unknown) => decodePayload(value).pipe(Effect.flatMap((payload) => planPacket(payload, {})));

describe("codex findings identity assignment", () => {
  it("pads ordinals to three digits and grows beyond them", () => {
    expect(recordIdForOrdinal(1)).toBe("CSF-001");
    expect(recordIdForOrdinal(26)).toBe("CSF-026");
    expect(recordIdForOrdinal(999)).toBe("CSF-999");
    expect(recordIdForOrdinal(1000)).toBe("CSF-1000");
  });

  it("orders most severe first and breaks ties by Codex identity", () =>
    Effect.runPromise(
      planFrom(
        payloadOf([
          captureFinding({ codexId: hex("zz", 32), severity: "Low" }),
          captureFinding({ codexId: hex("bb", 32), severity: "High" }),
          captureFinding({ codexId: hex("aa", 32), severity: "Low" }),
          captureFinding({ codexId: hex("cc", 32), severity: "Informational" }),
        ])
      ).pipe(
        Effect.map((plan) => {
          expect(A.map(plan.records, (record) => record.severity)).toEqual(["High", "Low", "Low", "Informational"]);
          expect(A.map(plan.records, (record) => record.id)).toEqual(["CSF-001", "CSF-002", "CSF-003", "CSF-004"]);
          // Ties broken by identity: the "aa" row sorts ahead of the "zz" row.
          expect(plan.records[1]?.codexId).toBe(hex("aa", 32));
          expect(plan.records[2]?.codexId).toBe(hex("zz", 32));
        })
      )
    ));

  it("produces an identical plan when the same payload arrives in a different row order", () => {
    const a = captureFinding({ codexId: hex("aa", 32), severity: "Low" });
    const b = captureFinding({ codexId: hex("bb", 32), severity: "High" });
    const c = captureFinding({ codexId: hex("cc", 32), severity: "Medium" });
    const encode = S.encodeUnknownSync(S.fromJsonString(S.Unknown));

    return Effect.runPromise(
      Effect.all([planFrom(payloadOf([a, b, c])), planFrom(payloadOf([c, a, b]))]).pipe(
        Effect.map(([first, second]) => {
          expect(encode(first)).toBe(encode(second));
        })
      )
    );
  });
});

describe("codex findings identity is sticky across re-ingest", () => {
  const low = captureFinding({ codexId: hex("aa", 32), severity: "Low" });
  const informational = captureFinding({ codexId: hex("cc", 32), severity: "Informational" });
  const arrivingHigh = captureFinding({ codexId: hex("bb", 32), severity: "High" });

  const planWithPriors = (
    findings: ReadonlyArray<ReturnType<typeof captureFinding>>,
    priors: ReadonlyArray<{ readonly id: string; readonly codexId: string }>
  ) =>
    decodePayload(payloadOf(findings)).pipe(
      Effect.flatMap((payload) => planPacket(payload, { priorIds: priorIdsOfEntries(priors) }))
    );

  it("keeps existing numbers when a more severe finding arrives later", () =>
    Effect.runPromise(
      planWithPriors(
        [low, informational, arrivingHigh],
        [
          { id: "CSF-001", codexId: low.codexId },
          { id: "CSF-002", codexId: informational.codexId },
        ]
      ).pipe(
        Effect.map((plan) => {
          const byCodexId = (codexId: string) => A.findFirst(plan.records, (record) => record.codexId === codexId);

          // The High finding sorts first, but must NOT take CSF-001.
          expect(plan.records[0]?.severity).toBe("High");
          expect(
            O.getOrElse(
              O.map(byCodexId(low.codexId), (r) => r.id),
              () => ""
            )
          ).toBe("CSF-001");
          expect(
            O.getOrElse(
              O.map(byCodexId(informational.codexId), (r) => r.id),
              () => ""
            )
          ).toBe("CSF-002");
          expect(
            O.getOrElse(
              O.map(byCodexId(arrivingHigh.codexId), (r) => r.id),
              () => ""
            )
          ).toBe("CSF-003");
        })
      )
    ));

  it("never reuses a number reserved by a finding that left the export", () =>
    Effect.runPromise(
      // CSF-001 and CSF-002 were assigned before; only CSF-002's finding still
      // appears. A newcomer must land on CSF-003, not recycle CSF-001.
      planWithPriors(
        [informational, arrivingHigh],
        [
          { id: "CSF-001", codexId: low.codexId },
          { id: "CSF-002", codexId: informational.codexId },
        ]
      ).pipe(
        Effect.map((plan) => {
          expect(A.map(plan.records, (record) => record.id)).toContain("CSF-002");
          expect(A.map(plan.records, (record) => record.id)).toContain("CSF-003");
          expect(A.map(plan.records, (record) => record.id)).not.toContain("CSF-001");
        })
      )
    ));

  it("assigns from capture order when there are no prior bindings", () =>
    Effect.runPromise(
      planWithPriors([low, informational, arrivingHigh], []).pipe(
        Effect.map((plan) => {
          expect(A.map(plan.records, (record) => record.id)).toEqual(["CSF-001", "CSF-002", "CSF-003"]);
          expect(plan.records[0]?.severity).toBe("High");
        })
      )
    ));
});

describe("codex findings severity tallies", () => {
  it("omits zero-count severities and keeps domain order", () => {
    const counts = severityCountsOf([{ severity: "Low" }, { severity: "Medium" }, { severity: "Low" }] as const);

    expect(counts).toEqual({ Medium: 1, Low: 2 });
    expect(Object.keys(counts)).toEqual(["Medium", "Low"]);
    expect("High" in counts).toBe(false);
  });
});

describe("codex findings payload rejection", () => {
  const rejects = (value: unknown) =>
    decodePayload(value).pipe(
      Effect.map(() => "accepted"),
      Effect.orElseSucceed(() => "rejected")
    );

  it.effect("rejects a duplicate Codex identity instead of silently deduplicating", () =>
    Effect.gen(function* () {
      const duplicate = captureFinding({ codexId: hex("aa", 32) });

      expect(yield* rejects(payloadOf([duplicate, duplicate]))).toBe("rejected");
    })
  );

  it.effect("rejects a traversal-shaped Codex identity", () =>
    Effect.gen(function* () {
      expect(yield* rejects(payloadOf([captureFinding({ codexId: "../../etc/passwd" })]))).toBe("rejected");
    })
  );

  it.effect("rejects an abbreviated source commit", () =>
    Effect.gen(function* () {
      expect(yield* rejects(payloadOf([captureFinding({ codexId: hex("aa", 32), commit: "244529a" })]))).toBe(
        "rejected"
      );
    })
  );

  it.effect("rejects a title carrying a bidirectional override", () =>
    Effect.gen(function* () {
      expect(yield* rejects(payloadOf([captureFinding({ codexId: hex("aa", 32), title: "safe‮evil" })]))).toBe(
        "rejected"
      );
    })
  );

  it.effect("rejects an over-length title rather than truncating it", () =>
    Effect.gen(function* () {
      expect(yield* rejects(payloadOf([captureFinding({ codexId: hex("aa", 32), title: "x".repeat(301) })]))).toBe(
        "rejected"
      );
    })
  );

  it.effect("rejects an unknown severity", () =>
    Effect.gen(function* () {
      expect(yield* rejects(payloadOf([captureFinding({ codexId: hex("aa", 32), severity: "Critical" })]))).toBe(
        "rejected"
      );
    })
  );

  it.effect("rejects an unknown payload contract version", () =>
    Effect.gen(function* () {
      expect(yield* rejects({ ...payloadOf([]), schemaVersion: "codex-findings-capture/v99" })).toBe("rejected");
    })
  );
});

describe("codex findings reconciliation", () => {
  it("refuses an expired session rather than bootstrapping an empty packet", () =>
    Effect.runPromise(
      planFrom(payloadOf([], { authState: "expired", expectedCount: 0 })).pipe(
        Effect.map(() => "accepted"),
        Effect.catchTag("CodexFindingsIngestError", (error: CodexFindingsIngestError) => Effect.succeed(error.reason))
      )
    ).then((reason) => {
      expect(reason).toBe("auth-expired");
    }));

  it("refuses a short read against the dashboard's own reported total", () =>
    Effect.runPromise(
      planFrom(payloadOf([captureFinding({ codexId: hex("aa", 32) })], { expectedCount: 26 })).pipe(
        Effect.map(() => "accepted"),
        Effect.catchTag("CodexFindingsIngestError", (error: CodexFindingsIngestError) => Effect.succeed(error.reason))
      )
    ).then((reason) => {
      expect(reason).toBe("short-read");
    }));

  it("names neither a local path nor a captured value in a short-read message", () =>
    Effect.runPromise(
      planFrom(payloadOf([captureFinding({ codexId: hex("aa", 32) })], { expectedCount: 26 })).pipe(
        Effect.map(() => ""),
        Effect.catchTag("CodexFindingsIngestError", (error: CodexFindingsIngestError) => Effect.succeed(error.message))
      )
    ).then((message) => {
      expect(message).not.toMatch(/\/home\//);
      expect(message).not.toContain(hex("aa", 32));
    }));
});

describe("codex findings ingest options", () => {
  it("rejects a traversal slug supplied on the command line", () =>
    Effect.runPromise(
      decodeCodexFindingsIngestOptions({ slug: "../../etc" }).pipe(
        Effect.map(() => "accepted"),
        Effect.orElseSucceed(() => "rejected")
      )
    ).then((outcome) => {
      expect(outcome).toBe("rejected");
    }));

  it("rejects a traversal-shaped date override", () =>
    Effect.runPromise(
      decodeCodexFindingsIngestOptions({ date: "2026-08-04/../.." }).pipe(
        Effect.map(() => "accepted"),
        Effect.orElseSucceed(() => "rejected")
      )
    ).then((outcome) => {
      expect(outcome).toBe("rejected");
    }));

  it("defaults every mode flag to false", () =>
    Effect.runPromise(decodeCodexFindingsIngestOptions({})).then((options) => {
      expect(options.dryRun).toBe(false);
      expect(options.force).toBe(false);
      expect(options.refresh).toBe(false);
      expect(options.json).toBe(false);
    }));
});
