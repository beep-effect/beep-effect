/**
 * ProviderInstance Drizzle repository adapter.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as Domain from "@beep/agents-domain/entities/ProviderInstance";
import {
  fromProviderInstanceRow,
  PROVIDER_INSTANCE_TABLE_NAME,
  providerInstanceTable,
  toProviderInstanceInsert,
} from "@beep/agents-tables/entities/ProviderInstance";
import {
  ProviderInstanceActorContext,
  ProviderInstanceNotFound,
  ProviderInstanceRepository,
  ProviderProbeUnavailable,
} from "@beep/agents-use-cases/server";
import { PostgresDrizzle } from "@beep/postgres";
import { CuidState } from "@beep/schema/Cuid";
import { Principal } from "@beep/shared-domain/entity/Principal";
import * as PublicEntityId from "@beep/shared-domain/entity/PublicEntityId";
import * as Agents from "@beep/shared-domain/identity/Agents";
import { A } from "@beep/utils";
import { and, asc, eq } from "drizzle-orm";
import { DateTime, Effect, Layer, pipe } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { ProviderInstanceInsert } from "@beep/agents-tables/entities/ProviderInstance";
import type { AddProviderInstanceCommand } from "@beep/agents-use-cases/server";
import type * as Crypto from "effect/Crypto";

const decodeProviderInstanceInsert = S.decodeUnknownEffect(Domain.ProviderInstance.insert);
const encodeProviderInstanceInsert = S.encodeSync(Domain.ProviderInstance.insert);
const encodePrincipal = S.encodeSync(Principal);

const unavailable =
  (operation: string) =>
  <A2, E, R>(effect: Effect.Effect<A2, E, R>): Effect.Effect<A2, ProviderProbeUnavailable, R> =>
    effect.pipe(
      Effect.tapError((cause) =>
        Effect.logDebug("Agents ProviderInstance repository adapter dropped driver failure").pipe(
          Effect.annotateLogs({ operation, table: PROVIDER_INSTANCE_TABLE_NAME, cause })
        )
      ),
      Effect.mapError(() =>
        ProviderProbeUnavailable.make({ guidance: "Provider instance persistence is unavailable. Try again." })
      )
    );

const notFound = (id: Agents.ProviderInstanceId) => ProviderInstanceNotFound.make({ providerInstanceId: id });

const insertFromCommand = Effect.fn("Agents.ProviderInstanceRepository.insertFromCommand")(function* (
  publicId: Domain.ProviderInstance["publicId"],
  command: AddProviderInstanceCommand,
  scope: ProviderInstanceActorContext["Service"]
) {
  const now = DateTime.toEpochMillis(yield* DateTime.now);
  const insert = yield* decodeProviderInstanceInsert({
    binaryPath: command.binaryPath,
    createdAt: now,
    createdByPrincipal: scope.principal,
    entityType: Agents.ProviderInstanceId.entityType,
    envVars: command.envVars,
    homePath: O.getOrNull(command.homePath),
    kind: command.kind,
    label: command.label,
    lastProbe: null,
    orgId: scope.orgId,
    publicId,
    schemaVersion: "0.1.0",
    source: "Application",
    updatedAt: now,
    updatedByPrincipal: scope.principal,
  }).pipe(unavailable("construct ProviderInstance"));
  return { ...encodeProviderInstanceInsert(insert), rowVersion: 1 } satisfies ProviderInstanceInsert;
});

/**
 *  Build the Drizzle-backed ProviderInstance repository.
 *
 * **Example** (Import repository factory)
 *
 * ```ts
 * import { makeProviderInstanceRepository } from "@beep/agents-server/ProviderInstance"
 * console.log(makeProviderInstanceRepository)
 * ```
 *
 * @category repositories
 * @since 0.0.0
 */
export const makeProviderInstanceRepository = Effect.fn("Agents.ProviderInstanceRepository.make")(function* () {
  const db = yield* PostgresDrizzle;
  const scope = yield* ProviderInstanceActorContext;
  const publicIdContext = yield* Effect.context<CuidState | Crypto.Crypto>();

  return ProviderInstanceRepository.of({
    add: Effect.fn("Agents.ProviderInstanceRepository.add")(function* (command) {
      const publicId = yield* PublicEntityId.generate(Agents.ProviderInstanceId).pipe(
        Effect.provide(publicIdContext),
        unavailable("generate ProviderInstance public id")
      );
      const insert = yield* insertFromCommand(publicId, command, scope);
      const rows = yield* db
        .insert(providerInstanceTable)
        .values(insert)
        .returning()
        .pipe(unavailable("insert ProviderInstance"));
      return yield* pipe(
        A.head(rows),
        O.match({
          onNone: () =>
            Effect.fail(
              ProviderProbeUnavailable.make({
                guidance: "Provider instance persistence returned no inserted record. Try again.",
              })
            ),
          onSome: (row) => Effect.succeed(fromProviderInstanceRow(row)),
        })
      );
    }),
    get: Effect.fn("Agents.ProviderInstanceRepository.get")(function* (id) {
      const rows = yield* db
        .select()
        .from(providerInstanceTable)
        .where(and(eq(providerInstanceTable.id, id), eq(providerInstanceTable.orgId, scope.orgId)))
        .limit(1)
        .pipe(unavailable("select ProviderInstance"));
      return yield* pipe(
        A.head(rows),
        O.map(fromProviderInstanceRow),
        Effect.fromOption(() => notFound(id))
      );
    }),
    list: db
      .select()
      .from(providerInstanceTable)
      .where(eq(providerInstanceTable.orgId, scope.orgId))
      .orderBy(asc(providerInstanceTable.id))
      .pipe(unavailable("list ProviderInstance"), Effect.map(A.map(fromProviderInstanceRow))),
    remove: Effect.fn("Agents.ProviderInstanceRepository.remove")(function* (id) {
      const rows = yield* db
        .delete(providerInstanceTable)
        .where(and(eq(providerInstanceTable.id, id), eq(providerInstanceTable.orgId, scope.orgId)))
        .returning({ id: providerInstanceTable.id })
        .pipe(unavailable("delete ProviderInstance"));
      if (O.isNone(A.head(rows))) return yield* notFound(id);
    }),
    save: Effect.fn("Agents.ProviderInstanceRepository.save")(function* (instance) {
      const now = DateTime.toEpochMillis(yield* DateTime.now);
      const rows = yield* db
        .update(providerInstanceTable)
        .set({
          ...toProviderInstanceInsert(instance),
          orgId: scope.orgId,
          rowVersion: instance.rowVersion + 1,
          updatedAt: now,
          updatedByPrincipal: encodePrincipal(scope.principal),
        })
        .where(and(eq(providerInstanceTable.id, instance.id), eq(providerInstanceTable.orgId, scope.orgId)))
        .returning()
        .pipe(unavailable("update ProviderInstance"));
      return yield* pipe(
        A.head(rows),
        O.map(fromProviderInstanceRow),
        Effect.fromOption(() => notFound(instance.id))
      );
    }),
  });
});

/**
 *  Drizzle ProviderInstance repository layer requiring `PostgresDrizzle`.
 *
 * **Example** (Import repository layer)
 *
 * ```ts
 * import { ProviderInstanceRepositoryLayer } from "@beep/agents-server/ProviderInstance"
 * console.log(ProviderInstanceRepositoryLayer)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ProviderInstanceRepositoryLayer = Layer.effect(
  ProviderInstanceRepository,
  makeProviderInstanceRepository()
).pipe(Layer.provide(CuidState.Default));
