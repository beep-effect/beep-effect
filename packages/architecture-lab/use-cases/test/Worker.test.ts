import * as DomainWorker from "@beep/architecture-lab-domain/entities/Worker";
import { Worker } from "@beep/architecture-lab-use-cases/public";
import * as WorkerServer from "@beep/architecture-lab-use-cases/server";
import * as ArchitectureLabIdentity from "@beep/shared-domain/identity/ArchitectureLab";
import { A } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, HashMap } from "effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const decodeWorkerId = S.decodeUnknownEffect(ArchitectureLabIdentity.WorkerId);
const decodeOrganizationId = S.decodeUnknownEffect(DomainWorker.WorkerOrganizationId);

const makeRepository = (): WorkerServer.Worker.WorkerRepositoryShape => {
  let workers = HashMap.empty<ArchitectureLabIdentity.WorkerId, DomainWorker.Worker>();
  return {
    create: (worker) =>
      O.isSome(HashMap.get(workers, worker.id))
        ? Effect.fail(
            WorkerServer.Worker.WorkerRepositoryConflict.make({
              workerId: worker.id,
              reason: "Worker already exists.",
            })
          )
        : Effect.sync(() => {
            workers = HashMap.set(workers, worker.id, worker);
            return worker;
          }),
    get: (id) =>
      pipe(
        HashMap.get(workers, id),
        Effect.fromOption(() => WorkerServer.Worker.WorkerRepositoryNotFound.make({ workerId: id }))
      ),
    list: Effect.sync(() => A.fromIterable(HashMap.values(workers))),
  };
};

describe("Worker use-cases", () => {
  it.effect(
    "creates and lists Worker entities",
    Effect.fnUntraced(function* () {
      const workerId = yield* decodeWorkerId(1);
      const organizationId = yield* decodeOrganizationId(1);
      const useCases = WorkerServer.Worker.makeWorkerUseCases(makeRepository());
      const created = yield* useCases.create(
        Worker.CreateWorkerCommand.make({
          id: workerId,
          organizationId,
          displayName: "Ada Lovelace",
        })
      );
      const listed = yield* useCases.list(Worker.ListWorkersQuery.make({ status: O.some("active") }));

      expect(created.displayName).toBe("Ada Lovelace");
      expect(A.map(listed, (worker) => worker.id)).toEqual([workerId]);
    })
  );

  it.effect(
    "translates repository not-found failures to public failures",
    Effect.fnUntraced(function* () {
      const workerId = yield* decodeWorkerId(1);
      const useCases = WorkerServer.Worker.makeWorkerUseCases(makeRepository());
      const error = yield* useCases.get(Worker.GetWorkerQuery.make({ id: workerId })).pipe(Effect.flip);

      expect(error._tag).toBe("WorkerNotFound");
    })
  );
});
