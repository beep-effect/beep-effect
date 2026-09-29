import * as DomainWorker from "@beep/architecture-lab-domain/entities/Worker";
import { WorkerServer } from "@beep/architecture-lab-server/entities/Worker";
import { ArchitectureLabServerTest } from "@beep/architecture-lab-server/test";
import { Worker as WorkerUseCases } from "@beep/architecture-lab-use-cases/public";
import * as ArchitectureLabIdentity from "@beep/shared-domain/identity/ArchitectureLab";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import * as S from "effect/Schema";

const decodeWorkerId = S.decodeUnknownEffect(ArchitectureLabIdentity.WorkerId);
const decodeOrganizationId = S.decodeUnknownEffect(DomainWorker.WorkerOrganizationId);

describe("Worker server", () => {
  it.layer(ArchitectureLabServerTest)("isolated repository stores", (it) => {
    it.effect(
      "provides a configured Worker use-case facade",
      Effect.fnUntraced(function* () {
        const server = yield* WorkerServer;
        const id = yield* decodeWorkerId(1);
        const organizationId = yield* decodeOrganizationId(1);
        const worker = yield* server.create(
          WorkerUseCases.CreateWorkerCommand.make({
            id,
            organizationId,
            displayName: "Ada Lovelace",
          })
        );

        expect(worker.status).toBe("active");
      })
    );
  });

  it.layer(ArchitectureLabServerTest, { timeout: "10 seconds" })(
    "Worker lifecycle against a fresh repository store",
    (it) => {
      it.effect(
        "lists workers and reports a missing id and a duplicate create",
        Effect.fnUntraced(function* () {
          const server = yield* WorkerServer;
          const id = yield* decodeWorkerId(1);
          const missingId = yield* decodeWorkerId(2);
          const organizationId = yield* decodeOrganizationId(1);
          const command = WorkerUseCases.CreateWorkerCommand.make({
            id,
            organizationId,
            displayName: "Ada Lovelace",
          });
          const created = yield* server.create(command);
          const listed = yield* server.list(WorkerUseCases.ListWorkersQuery.make({}));
          const missing = yield* server.get(WorkerUseCases.GetWorkerQuery.make({ id: missingId })).pipe(Effect.flip);
          const conflict = yield* server.create(command).pipe(Effect.flip);

          expect(created.status).toBe("active");
          expect(listed).toHaveLength(1);
          expect(missing._tag).toBe("WorkerNotFound");
          expect(conflict._tag).toBe("WorkerConflict");
        })
      );
    }
  );
});
