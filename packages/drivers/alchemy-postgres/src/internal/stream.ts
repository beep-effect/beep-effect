/**
 * The Postgres stream store, mirroring `Domain.InMemory`'s: one writer per
 * key, a write whose origin is not after the last applied one is dropped, and
 * entries carry the envelope InMemory stamps: id (the key), stream, seq, at
 * and commandId, with no correlation id.
 */
import { isAfter, mergeCheckpoints } from "@alchemy.run/domain/InMemory";
import { emptyStreamMeta } from "@alchemy.run/domain/Platform";
import { A, O, R } from "@beep/utils";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import { encodeJson, StreamEntryJson, StreamMetaJson } from "../AlchemyPostgres.schema.ts";
import { orDieAs, rowsOf } from "./host.ts";
import type * as DomainPlatform from "@alchemy.run/domain/Platform";
import type * as DomainStream from "@alchemy.run/domain/Stream";
import type { HostContext } from "./host.ts";

const decodeMeta = rowsOf(S.Struct({ meta: StreamMetaJson }));
const decodeEntries = rowsOf(StreamEntryJson);

const all = 2_147_483_647;

/** Host one stream. */
export const makeStreamStore = (ctx: HostContext) => (_definition: DomainStream.Any, kit: DomainPlatform.StreamKit) =>
  Effect.sync((): DomainPlatform.StreamStore => {
    const { modelName, sql, tables } = ctx;
    const name = kit.name;
    const orDie = orDieAs("append")(tables.streamKey);
    const lockOf = (key: string) => `stream:${name}/${key}`;

    const metaOf = (key: string) =>
      sql`SELECT meta FROM ${sql(tables.streamKey)} WHERE model = ${modelName} AND stream = ${name} AND key = ${key}`.pipe(
        Effect.flatMap(decodeMeta),
        Effect.map((rows) =>
          O.match(A.head(rows), {
            onNone: (): DomainPlatform.StreamMeta => emptyStreamMeta,
            onSome: ({ meta }) => meta,
          })
        ),
        orDie
      );
    const saveMeta = (key: string, meta: DomainPlatform.StreamMeta) =>
      Effect.flatMap(
        encodeJson(meta),
        (json) => sql`INSERT INTO ${sql(tables.streamKey)} (model, stream, key, meta)
          VALUES (${modelName}, ${name}, ${key}, ${json}::jsonb)
          ON CONFLICT (model, stream, key) DO UPDATE SET meta = EXCLUDED.meta`
      );
    const entriesAfter = (key: string, after: number) =>
      sql`SELECT seq, event, envelope FROM ${sql(tables.streamEntry)}
        WHERE model = ${modelName} AND stream = ${name} AND key = ${key} AND seq > ${after}
        ORDER BY seq LIMIT ${all}`.pipe(Effect.flatMap(decodeEntries), orDie);

    return {
      append: (key, write) =>
        ctx
          .exclusive(lockOf(key))(
            Effect.gen(function* () {
              const meta = yield* metaOf(key);
              if (!isAfter(write.origin, meta.origin)) return;
              yield* Effect.forEach(
                write.events,
                Effect.fnUntraced(function* (event, index) {
                  const seq = meta.seq + index + 1;
                  const envelope: DomainPlatform.EnvelopeJson = {
                    id: key,
                    stream: `${name}/${key}`,
                    seq,
                    at: write.at,
                    commandId: write.commandId,
                  };
                  const encodedEvent = yield* encodeJson(event);
                  const encodedEnvelope = yield* encodeJson(envelope);
                  yield* sql`INSERT INTO ${sql(tables.streamEntry)} (model, stream, key, seq, event, envelope)
                      VALUES (${modelName}, ${name}, ${key}, ${seq}, ${encodedEvent}::jsonb, ${encodedEnvelope}::jsonb)`;
                }),
                { discard: true }
              );
              yield* saveMeta(key, {
                seq: meta.seq + A.length(write.events),
                origin: write.origin,
                checkpoints: {
                  ...meta.checkpoints,
                  [write.source]: Math.max(
                    O.getOrElse(R.get(meta.checkpoints, write.source), () => 0),
                    write.sourceSeq
                  ),
                },
              });
            })
          )
          .pipe(orDie),
      advance: (key, checkpoints) =>
        ctx
          .exclusive(lockOf(key))(
            Effect.gen(function* () {
              const meta = yield* metaOf(key);
              yield* saveMeta(key, { ...meta, checkpoints: mergeCheckpoints(meta.checkpoints, checkpoints) });
            })
          )
          .pipe(orDie),
      read: metaOf,
      changes: (key) =>
        Stream.fromEffectSchedule(metaOf(key), Schedule.spaced(ctx.poll)).pipe(
          Stream.changesWith(
            (left, right) =>
              left.seq === right.seq &&
              left.origin[0] === right.origin[0] &&
              left.origin[1] === right.origin[1] &&
              S.toEquivalence(S.Record(S.String, S.Finite))(left.checkpoints, right.checkpoints)
          )
        ),
      list: (key) => entriesAfter(key, 0),
      tail: (key, after) =>
        ctx.pollTail(
          (last) => entriesAfter(key, last),
          ({ seq }) => seq
        )(after),
    };
  });
