import { fileURLToPath } from "node:url";
import { ArchitectureLabConfigTest } from "@beep/architecture-lab-config/test";
import * as DomainWorkItem from "@beep/architecture-lab-domain/aggregates/WorkItem";
import * as DomainWorker from "@beep/architecture-lab-domain/entities/Worker";
import * as WorkPriority from "@beep/architecture-lab-domain/values/WorkPriority";
import { makeDrizzleWorkItemRepository } from "@beep/architecture-lab-server/aggregates/WorkItem";
import { makeDrizzleWorkerRepository } from "@beep/architecture-lab-server/entities/Worker";
import { makeDrizzle, makeDrizzleLayer, migrate } from "@beep/postgres";
import { fcRuns, makePgliteIntegrationGate, TestDatabaseInfo } from "@beep/test-utils";
import { A } from "@beep/utils";
import { describe, expect, it, layer } from "@effect/vitest";
import { Effect, Layer, pipe } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const {
  shouldRunPgliteIntegration,
  pgliteIntegrationTimeoutMillis: PgliteIntegrationTimeout,
  makePgliteLayer,
} = makePgliteIntegrationGate();
const migrationsFolder = fileURLToPath(new URL("../../../../_internal/db-admin/drizzle", import.meta.url));
const decodeWorkItemId = S.decodeUnknownEffect(DomainWorkItem.WorkItemId);
const decodeWorkItemTitle = S.decodeUnknownEffect(DomainWorkItem.WorkItemTitle);
const decodeWorkerId = S.decodeUnknownEffect(DomainWorker.WorkerId);
const decodeOrganizationId = S.decodeUnknownEffect(DomainWorker.WorkerOrganizationId);
const encodeWorkItemId = S.encodeEffect(DomainWorkItem.WorkItemId);
const encodeWorkItemTitle = S.encodeEffect(DomainWorkItem.WorkItemTitle);
const encodeWorkerId = S.encodeEffect(DomainWorker.WorkerId);
const encodeOrganizationId = S.encodeEffect(DomainWorker.WorkerOrganizationId);
const WorkItemIdArbitrary = S.toArbitrary(DomainWorkItem.WorkItemId);
const WorkItemTitleArbitrary = S.toArbitrary(DomainWorkItem.WorkItemTitle);
const WorkerIdArbitrary = S.toArbitrary(DomainWorker.WorkerId);
const OrganizationIdArbitrary = S.toArbitrary(DomainWorker.WorkerOrganizationId);
const migrateArchitectureLab = Effect.fnUntraced(function* () {
  const info = yield* TestDatabaseInfo;
  const db = yield* makeDrizzle();
  const migrationsSchema = pipe(
    info.schema,
    O.getOrElse(() => "drizzle")
  );

  yield* migrate(db, { migrationsFolder, migrationsSchema });
});

const WorkItemDrizzleRepositoryLayer = Layer.mergeAll(ArchitectureLabConfigTest, makeDrizzleLayer()).pipe(
  Layer.provideMerge(makePgliteLayer())
);

it("round-trips schema-derived repository identity values through domain schemas", () =>
  fc.assert(
    fc.property(
      WorkItemIdArbitrary,
      WorkItemTitleArbitrary,
      WorkerIdArbitrary,
      OrganizationIdArbitrary,
      (workItemId, title, workerId, organizationId) => {
        const encodedWorkItemId = Effect.runSync(encodeWorkItemId(workItemId));
        const decodedWorkItemId = Effect.runSync(decodeWorkItemId(encodedWorkItemId));
        expect(Effect.runSync(encodeWorkItemId(decodedWorkItemId))).toBe(encodedWorkItemId);

        const encodedTitle = Effect.runSync(encodeWorkItemTitle(title));
        const decodedTitle = Effect.runSync(decodeWorkItemTitle(encodedTitle));
        expect(Effect.runSync(encodeWorkItemTitle(decodedTitle))).toBe(encodedTitle);

        const encodedWorkerId = Effect.runSync(encodeWorkerId(workerId));
        const decodedWorkerId = Effect.runSync(decodeWorkerId(encodedWorkerId));
        expect(Effect.runSync(encodeWorkerId(decodedWorkerId))).toBe(encodedWorkerId);

        const encodedOrganizationId = Effect.runSync(encodeOrganizationId(organizationId));
        const decodedOrganizationId = Effect.runSync(decodeOrganizationId(encodedOrganizationId));
        expect(Effect.runSync(encodeOrganizationId(decodedOrganizationId))).toBe(encodedOrganizationId);
      }
    ),
    fcRuns(25)
  ));

if (!shouldRunPgliteIntegration) {
  describe.skip("ArchitectureLab Drizzle repository PgLite integration", () => {});
} else {
  describe("ArchitectureLab Drizzle repository PgLite integration", { concurrent: false }, () => {
    layer(WorkItemDrizzleRepositoryLayer, { timeout: "5 minutes" })((it) => {
      it.effect(
        "persists WorkItem lifecycle changes through Drizzle",
        Effect.fnUntraced(function* () {
          yield* migrateArchitectureLab();
          const repository = yield* makeDrizzleWorkItemRepository();
          const workerId = yield* decodeWorkerId(1);
          const id = yield* decodeWorkItemId("drizzle-work-item-1");
          const title = yield* decodeWorkItemTitle("Prove Drizzle repository");
          const created = DomainWorkItem.create(
            DomainWorkItem.CreateWorkItemInput.make({
              id,
              title,
              priority: O.some(WorkPriority.WorkPriority.Enum.high),
            })
          );

          const inserted = yield* repository.create(created);
          const assigned = yield* DomainWorkItem.assign(inserted, workerId);
          const saved = yield* repository.save(assigned);
          const found = yield* repository.get(saved.id);
          const all = yield* repository.list;

          expect(found.status).toBe("assigned");
          expect(O.getOrThrow(found.assignee)).toBe(workerId);
          expect(O.getOrThrow(found.priority)).toBe("high");
          expect(
            pipe(
              all,
              A.map((workItem) => workItem.id)
            )
          ).toEqual([saved.id]);
        }),
        PgliteIntegrationTimeout
      );

      it.effect(
        "persists Worker entities through Drizzle",
        Effect.fnUntraced(function* () {
          yield* migrateArchitectureLab();
          const repository = yield* makeDrizzleWorkerRepository();
          const id = yield* decodeWorkerId(1);
          const organizationId = yield* decodeOrganizationId(1);
          const created = DomainWorker.create(
            DomainWorker.CreateWorkerInput.make({
              id,
              organizationId,
              displayName: "Ada Lovelace",
            })
          );

          const inserted = yield* repository.create(created);
          const found = yield* repository.get(inserted.id);
          const all = yield* repository.list;

          expect(found.displayName).toBe("Ada Lovelace");
          expect(
            pipe(
              all,
              A.map((worker) => worker.id)
            )
          ).toEqual([inserted.id]);
        }),
        PgliteIntegrationTimeout
      );
    });
  });
}
