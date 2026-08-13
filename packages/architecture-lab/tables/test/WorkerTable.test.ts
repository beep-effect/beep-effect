import * as DomainWorker from "@beep/architecture-lab-domain/entities/Worker";
import { fromWorkerRow, toWorkerInsert, workerTable } from "@beep/architecture-lab-tables/entities/Worker";
import * as ArchitectureLabIdentity from "@beep/shared-domain/identity/ArchitectureLab";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { getColumns, getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { Effect } from "effect";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const decodeWorkerId = S.decodeUnknownEffect(ArchitectureLabIdentity.WorkerId);
const decodeOrganizationId = S.decodeUnknownEffect(DomainWorker.WorkerOrganizationId);
const WorkerArbitrary = S.toArbitrary(DomainWorker.Worker)(fc);
const WorkerEquivalence = S.toEquivalence(DomainWorker.Worker);

describe("Worker table", () => {
  it.effect(
    "projects the Worker entity through effect-drizzle",
    Effect.fnUntraced(function* () {
      const id = yield* decodeWorkerId(1);
      const organizationId = yield* decodeOrganizationId(1);
      const worker = DomainWorker.create(
        DomainWorker.CreateWorkerInput.make({
          id,
          organizationId,
          displayName: "Ada Lovelace",
        })
      );
      const row = toWorkerInsert(worker);
      const columns = getColumns(workerTable);
      const config = getTableConfig(workerTable);

      expect(getTableName(workerTable)).toBe("architecture_lab_worker");
      expect(DomainWorker.Worker.sql.tableName).toBe("architecture_lab_worker");
      expect(columns.id.primary).toBe(true);
      expect(columns.displayName.name).toBe("display_name");
      expect(config.indexes.map((index) => index.config.name)).toEqual([
        "architecture_lab_worker_org_id_btree_idx",
        "architecture_lab_worker_source_btree_idx",
        "architecture_lab_worker_status_lookup_idx",
        "architecture_lab_worker_public_id_unique_idx",
      ]);
      expect(config.indexes.find((index) => index.config.name.endsWith("public_id_unique_idx"))?.config.unique).toBe(
        true
      );
      expect(fromWorkerRow({ ...row, id }).displayName).toBe("Ada Lovelace");
    })
  );

  it("round-trips schema-derived Workers through the row converters", () =>
    fc.assert(
      fc.property(WorkerArbitrary, (worker) => {
        const insert = toWorkerInsert(worker);
        const decoded = fromWorkerRow({ ...insert, id: worker.id });

        expect(WorkerEquivalence(decoded, worker)).toBe(true);
      }),
      fcRuns(50)
    ));
});
