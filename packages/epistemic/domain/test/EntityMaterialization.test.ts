import { toPgTable } from "@beep/effect-drizzle/pg";
import {
  ContradictionCandidate,
  ContradictionDisposition,
  ContradictionReceipt,
} from "@beep/epistemic-domain/entities/Contradiction";
import { describe, expect, it } from "@effect/vitest";
import { getTableConfig } from "drizzle-orm/pg-core";

const indexNames = (config: { indexes: ReadonlyArray<{ config: { name?: string } }> }) =>
  config.indexes.map((index) => index.config.name);

describe("epistemic entity materialization", () => {
  it("materializes contradiction model extras into table indexes", () => {
    const candidate = ContradictionCandidate.pipe(toPgTable, getTableConfig);
    const disposition = ContradictionDisposition.pipe(toPgTable, getTableConfig);
    const receipt = ContradictionReceipt.pipe(toPgTable, getTableConfig);

    expect(indexNames(candidate)).toEqual(
      expect.arrayContaining([
        "epistemic_contradiction_candidate_recorded_at_btree_idx",
        "epistemic_contradiction_candidate_valid_from_btree_idx",
      ])
    );
    expect(indexNames(disposition)).toEqual(
      expect.arrayContaining(["epistemic_contradiction_disposition_candidate_id_unique_idx"])
    );
    expect(indexNames(receipt)).toEqual(
      expect.arrayContaining(["epistemic_contradiction_receipt_candidate_id_btree_idx"])
    );
  });
});
