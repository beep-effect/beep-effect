import { ClaimDisposition, EdgeVersion } from "@beep/epistemic-domain";
import * as Epistemic from "@beep/shared-domain/identity/Epistemic";
import { A, R, Str } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { Order, pipe } from "effect";

type PersistedDescriptors = Readonly<
  Record<string, { readonly storageKind: string; readonly valueStrategy: string; readonly columnName?: string }>
>;

// `entityId` columns project to Postgres `serial` only under the
// `generatedOnInsert` strategy and to plain `integer` otherwise, so every
// reference column has to stay `provided`: a reference that generated its own
// value would invent rows instead of pointing at them.
const strategyOf = (persisted: PersistedDescriptors, key: string): string => persisted[key].valueStrategy;

// Mirrors `EntitySchema.columnNameFor`: an explicit `columnName` wins, otherwise
// the field key is snake-cased. Reimplemented locally because the real helper is
// generic over the discriminated descriptor union and this test deliberately
// walks descriptors through a loose, entity-agnostic shape.
const columnNameOf = (key: string, descriptor: { readonly columnName?: string }): string =>
  descriptor.columnName ?? Str.snakeCase(key);

const columnNamesByStorageKind = (persisted: PersistedDescriptors, storageKind: string): ReadonlyArray<string> =>
  pipe(
    R.toEntries(persisted),
    A.filter(([, descriptor]) => descriptor.storageKind === storageKind),
    A.map(([key, descriptor]) => columnNameOf(key, descriptor)),
    A.sort(Order.String)
  );

describe("EdgeVersion / ClaimDisposition persistence wiring", () => {
  it("derives the ratified table names and entity types", () => {
    expect(Epistemic.EdgeVersionId.tableName).toBe("epistemic_edge_version");
    expect(Epistemic.EdgeVersionId.entityType).toBe("EpistemicEdgeVersion");
    expect(Epistemic.ClaimDispositionId.tableName).toBe("epistemic_claim_disposition");
    expect(Epistemic.ClaimDispositionId.entityType).toBe("EpistemicClaimDisposition");
  });

  it("wires each entity to its own epistemic entity id", () => {
    expect(EdgeVersion.definition.entityId).toBe(Epistemic.EdgeVersionId);
    expect(ClaimDisposition.definition.entityId).toBe(Epistemic.ClaimDispositionId);
  });

  it("keeps every reference column integer-backed rather than serial", () => {
    const edge = EdgeVersion.definition.persisted;

    expect(strategyOf(edge, "supersedesId")).toBe("provided");
    expect(strategyOf(edge, "sourceClaimId")).toBe("provided");
    expect(strategyOf(edge, "sourceEvidenceId")).toBe("provided");
    expect(strategyOf(edge, "targetClaimId")).toBe("provided");
    expect(strategyOf(edge, "targetEvidenceId")).toBe("provided");
    expect(strategyOf(ClaimDisposition.definition.persisted, "claimId")).toBe("provided");
  });

  it("keeps the surrogate primary key the only generated entity id", () => {
    expect(strategyOf(EdgeVersion.definition.persisted, "id")).toBe("generatedOnInsert");
    expect(strategyOf(ClaimDisposition.definition.persisted, "id")).toBe("generatedOnInsert");
  });

  it("projects both bitemporal axes onto BIGINT millis columns", () => {
    expect(columnNamesByStorageKind(EdgeVersion.definition.persisted, "timestampMillis")).toEqual([
      "created_at",
      "expired_at",
      "recorded_at",
      "updated_at",
      "valid_from",
      "valid_to",
    ]);
    expect(columnNamesByStorageKind(ClaimDisposition.definition.persisted, "timestampMillis")).toEqual([
      "created_at",
      "resolved_at",
      "updated_at",
    ]);
  });

  it("flattens each endpoint side onto its own per-kind reference column quadruple", () => {
    expect(columnNamesByStorageKind(EdgeVersion.definition.persisted, "entityId")).toEqual([
      "id",
      "org_id",
      "source_claim_id",
      "source_evidence_id",
      "supersedes_id",
      "target_claim_id",
      "target_evidence_id",
    ]);
  });
});
