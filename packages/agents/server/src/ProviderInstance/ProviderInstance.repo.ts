/** ProviderInstance Drizzle repository adapter. @packageDocumentation @since 0.0.0 */

import * as Domain from "@beep/agents-domain/entities/ProviderInstance";
import {
  fromProviderInstanceRow,
  PROVIDER_INSTANCE_TABLE_NAME,
  providerInstanceTable,
  toProviderInstanceInsert,
} from "@beep/agents-tables/entities/ProviderInstance";
import {
  ProviderInstanceNotFound,
  ProviderInstanceRepository,
  ProviderProbeUnavailable,
} from "@beep/agents-use-cases/server";
import { PostgresDrizzle } from "@beep/postgres";
import { A, N } from "@beep/utils";
import { asc, eq } from "drizzle-orm";
import { DateTime, Effect, Layer, pipe } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { AddProviderInstanceCommand } from "@beep/agents-use-cases/server";
import type * as Agents from "@beep/shared-domain/identity/Agents";

const SYSTEM_PRINCIPAL = { component: "Runtime", kind: "System" } as const;
const decodeProviderInstance = S.decodeUnknownEffect(Domain.ProviderInstance);

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

const entityFromCommand = Effect.fn("Agents.ProviderInstanceRepository.entityFromCommand")(function* (
  id: number,
  command: AddProviderInstanceCommand
) {
  const now = DateTime.toEpochMillis(yield* DateTime.now);
  return yield* decodeProviderInstance({
    binaryPath: command.binaryPath,
    createdAt: now,
    createdByPrincipal: SYSTEM_PRINCIPAL,
    entityType: Domain.ProviderInstance.definition.entityId.entityType,
    id,
    envVars: command.envVars,
    homePath: O.getOrNull(command.homePath),
    kind: command.kind,
    label: command.label,
    lastProbe: null,
    orgId: 1,
    publicId: `${PROVIDER_INSTANCE_TABLE_NAME}_a${id}`,
    rowVersion: 1,
    schemaVersion: "0.1.0",
    source: "Application",
    updatedAt: now,
    updatedByPrincipal: SYSTEM_PRINCIPAL,
  }).pipe(unavailable("construct ProviderInstance"));
});

/** Build the Drizzle-backed ProviderInstance repository.
 * @example
 * ```ts
 * import { makeProviderInstanceRepository } from "@beep/agents-server/ProviderInstance"
 * console.log(makeProviderInstanceRepository)
 * ```
 * @category repositories @since 0.0.0
 */
export const makeProviderInstanceRepository = Effect.fn("Agents.ProviderInstanceRepository.make")(function* () {
  const db = yield* PostgresDrizzle;

  return ProviderInstanceRepository.of({
    add: Effect.fn("Agents.ProviderInstanceRepository.add")(function* (command) {
      const current = yield* db
        .select({ id: providerInstanceTable.id })
        .from(providerInstanceTable)
        .pipe(unavailable("list ProviderInstance ids"));
      const id = A.reduce(current, 0, (maximum, row) => N.max(maximum, row.id)) + 1;
      const instance = yield* entityFromCommand(id, command);
      const rows = yield* db
        .insert(providerInstanceTable)
        .values(toProviderInstanceInsert(instance))
        .returning()
        .pipe(unavailable("insert ProviderInstance"));
      return pipe(
        rows,
        A.head,
        O.map(fromProviderInstanceRow),
        O.getOrElse(() => instance)
      );
    }),
    get: Effect.fn("Agents.ProviderInstanceRepository.get")(function* (id) {
      const rows = yield* db
        .select()
        .from(providerInstanceTable)
        .where(eq(providerInstanceTable.id, id))
        .limit(1)
        .pipe(unavailable("select ProviderInstance"));
      return yield* pipe(
        A.head(rows),
        O.map(fromProviderInstanceRow),
        O.match({ onNone: () => Effect.fail(notFound(id)), onSome: Effect.succeed })
      );
    }),
    list: db
      .select()
      .from(providerInstanceTable)
      .orderBy(asc(providerInstanceTable.id))
      .pipe(unavailable("list ProviderInstance"), Effect.map(A.map(fromProviderInstanceRow))),
    remove: Effect.fn("Agents.ProviderInstanceRepository.remove")(function* (id) {
      const rows = yield* db
        .delete(providerInstanceTable)
        .where(eq(providerInstanceTable.id, id))
        .returning({ id: providerInstanceTable.id })
        .pipe(unavailable("delete ProviderInstance"));
      if (O.isNone(A.head(rows))) return yield* notFound(id);
    }),
    save: Effect.fn("Agents.ProviderInstanceRepository.save")(function* (instance) {
      const rows = yield* db
        .update(providerInstanceTable)
        .set(toProviderInstanceInsert(instance))
        .where(eq(providerInstanceTable.id, instance.id))
        .returning()
        .pipe(unavailable("update ProviderInstance"));
      return yield* pipe(
        A.head(rows),
        O.map(fromProviderInstanceRow),
        O.match({ onNone: () => Effect.fail(notFound(instance.id)), onSome: Effect.succeed })
      );
    }),
  });
});

/** Drizzle ProviderInstance repository layer requiring `PostgresDrizzle`.
 * @example
 * ```ts
 * import { ProviderInstanceRepositoryLayer } from "@beep/agents-server/ProviderInstance"
 * console.log(ProviderInstanceRepositoryLayer)
 * ```
 * @category layers @since 0.0.0
 */
export const ProviderInstanceRepositoryLayer = Layer.effect(
  ProviderInstanceRepository,
  makeProviderInstanceRepository()
);
