import * as Worker from "@beep/architecture-lab-domain/entities/Worker";
import { toPgTable } from "@beep/effect-drizzle/pg";
import * as ArchitectureLabIdentity from "@beep/shared-domain/identity/ArchitectureLab";
import { describe, expect, it } from "@effect/vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import { Effect } from "effect";
import * as S from "effect/Schema";

const decodeWorkerId = S.decodeUnknownEffect(ArchitectureLabIdentity.WorkerId);
const decodeOrganizationId = S.decodeUnknownEffect(Worker.WorkerOrganizationId);

describe("Worker entity", () => {
  it.effect(
    "creates a product-entity-backed active Worker",
    Effect.fnUntraced(function* () {
      const id = yield* decodeWorkerId(1);
      const organizationId = yield* decodeOrganizationId(1);
      const worker = Worker.create(
        Worker.CreateWorkerInput.make({
          id,
          organizationId,
          displayName: "Ada Lovelace",
        })
      );

      expect(worker.id).toBe(1);
      expect(worker.status).toBe("active");
      expect(Worker.Worker.sql.tableName).toBe("architecture_lab_worker");
      expect(Object.keys(Worker.Worker.insert.fields)).not.toContain("id");
      expect(Object.keys(Worker.Worker.insert.fields)).not.toContain("rowVersion");
      expect(Object.keys(Worker.Worker.insert.fields)).toContain("publicId");
      expect(Object.keys(Worker.Worker.update.fields)).toContain("id");
      expect(Object.keys(Worker.Worker.update.fields)).toContain("rowVersion");
      expect(Object.keys(Worker.Worker.update.fields)).not.toContain("publicId");
      expect(Object.keys(Worker.Worker.jsonCreate.fields)).toEqual(["displayName", "status"]);
      expect(Object.keys(Worker.Worker.jsonUpdate.fields)).toEqual(["displayName", "status"]);
    })
  );

  it("materializes Worker model extras into table indexes", () => {
    const worker = Worker.Worker.pipe(toPgTable, getTableConfig);
    const workerIndexNames = worker.indexes.map((index) => index.config.name);

    expect(workerIndexNames).toEqual(expect.arrayContaining(["architecture_lab_worker_status_lookup_idx"]));
  });
});
