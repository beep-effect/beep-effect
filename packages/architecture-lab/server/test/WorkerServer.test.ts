import * as DomainWorker from "@beep/architecture-lab-domain/entities/Worker";
import { WorkerServer } from "@beep/architecture-lab-server/entities/Worker";
import { ArchitectureLabServerTest } from "@beep/architecture-lab-server/test";
import { Worker as WorkerUseCases } from "@beep/architecture-lab-use-cases/public";
import * as ArchitectureLabIdentity from "@beep/shared-domain/identity/ArchitectureLab";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import * as S from "effect/Schema";

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const decodeWorkerId = S.decodeUnknownEffect(ArchitectureLabIdentity.WorkerId);
const decodeOrganizationId = S.decodeUnknownEffect(DomainWorker.WorkerOrganizationId);

describe("Worker server", () => {
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
    }, provideScopedLayer(ArchitectureLabServerTest))
  );
});
