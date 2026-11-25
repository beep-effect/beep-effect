import { fromEvidenceRow, toEvidenceInsert } from "@beep/epistemic-tables/entities/Evidence";
import * as Epistemic from "@beep/shared-domain/identity/Epistemic";
import { it } from "@beep/test-runner";
import { productEntityFixtureInput } from "@beep/test-utils";
import { expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Result from "effect/Result";
import type { EvidenceRow } from "@beep/epistemic-tables/entities/Evidence";

const row = {
  ...productEntityFixtureInput("EpistemicEvidence", 10),
  entityType: Epistemic.EvidenceId.entityType,
  schemaVersion: "0.0.0",
  deletedAt: null,
  deletedByPrincipal: null,
  artifactFixtureKey: "artifact:synthetic",
  spanFixtureKey: "span:synthetic",
  span: { startChar: 2, endChar: 99, quote: "A😀", confidence: 0 },
} satisfies EvidenceRow;

it.effect("L4-7 stored evidence preserves explicit reported zero and emits only v2 writes", () =>
  Effect.gen(function* () {
    const recovered = yield* Effect.fromResult(fromEvidenceRow(row));
    expect(recovered.span).toMatchObject({
      version: "evidence-position/v2",
      position: { startChar: 2, endChar: 5, quote: "A😀" },
      extractorConfidence: {
        _tag: "Present",
        value: { _tag: "ReportedConfidence", value: 0, method: "legacy-reported" },
      },
    });
    expect(row.span.endChar).toBe(99);
    const written = yield* Effect.fromResult(toEvidenceInsert(recovered));
    expect(written.span).toMatchObject({ version: "evidence-position/v2" });
    const reopened = yield* Effect.fromResult(
      fromEvidenceRow({
        ...row,
        ...written,
        id: row.id,
        deletedAt: row.deletedAt,
        deletedByPrincipal: row.deletedByPrincipal,
        rowVersion: row.rowVersion,
      })
    );
    expect(reopened.span).toEqual(recovered.span);
  })
);

it.effect("unresolved legacy positions remain readable and cannot be written as current evidence", () =>
  Effect.gen(function* () {
    const legacy = { ...row, span: { confidence: 1, startChar: 0, endChar: 0, quote: "" } };
    const recovered = yield* Effect.fromResult(fromEvidenceRow(legacy));
    expect(recovered.span).toMatchObject({
      _tag: "LegacyEvidenceUnresolved",
      ...legacy.span,
      reason: "invalid-legacy-position",
    });
    pipe(toEvidenceInsert(recovered), Result.isFailure, assertTrue);
  })
);

it("refuses versioned payloads without repairing them through an untagged reader", () => {
  for (const version of ["evidence-position/v2", "evidence-position/v3", 42]) {
    const malformed = {
      ...row,
      span: {
        ...row.span,
        version,
        position: { startChar: 0, endChar: 1, quote: "fact" },
        extractorConfidence: { _tag: "Absent", reason: "not-assessed" },
      },
    };
    pipe(fromEvidenceRow(malformed), Result.isFailure, assertTrue);
  }
});
