import * as Worker from "@beep/architecture-lab-domain/entities/Worker";
import * as ArchitectureLabIdentity from "@beep/shared-domain/identity/ArchitectureLab";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as S from "effect/Schema";

const decodeWorkerId = S.decodeUnknownEffect(ArchitectureLabIdentity.WorkerId);
const decodeOrganizationId = S.decodeUnknownEffect(Worker.WorkerOrganizationId);

describe("Worker entity", () => {
  it.effect(
    "creates a BaseEntity-backed active Worker",
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
      expect(Worker.Worker.definition.tableName).toBe("architecture_lab_worker");
    })
  );
});
