/**
 * Driver-failure proof for the Drizzle ThreadStore adapter.
 *
 * The durable-row proof under `test/integration` shows what the store does once
 * the migration bundle has been applied. This one shows what it does when the
 * driver refuses: the PGlite database is deliberately left unmigrated, so every
 * statement comes back as `relation does not exist`, and each operation must
 * redact that driver failure into `ThreadStoreUnavailable` rather than leak the
 * raw cause to the sidecar.
 */

import { Document, P, Text } from "@beep/md";
import { makeDrizzleLayer } from "@beep/postgres";
import { CuidState } from "@beep/schema/Cuid";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { makePgliteSqlTestLayer } from "@beep/test-utils";
import { makeDrizzleThreadStore } from "@beep/workspace-server/aggregates/Thread";
import * as ThreadStoreServer from "@beep/workspace-use-cases/server";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { describe, expect, layer } from "@effect/vitest";
import { Effect, Layer } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";

const decodeThreadId = S.decodeUnknownEffect(WorkspaceIdentity.ThreadId);
const decodeWorkspaceId = S.decodeUnknownEffect(WorkspaceIdentity.WorkspaceId);
const isThreadStoreUnavailable = S.is(ThreadStoreServer.Thread.ThreadStoreUnavailable);

const docOf = (value: string) => Document.make({ children: [P.make({ children: [Text.make({ value })] })] });

const UnmigratedThreadStoreLayer = makeDrizzleLayer().pipe(
  Layer.provideMerge(Layer.fresh(makePgliteSqlTestLayer({ mode: "in-process" }))),
  Layer.provideMerge(CuidState.Default.pipe(Layer.provideMerge(BunCrypto.layer)))
);

// A failed statement leaves an implicit-transaction PGlite session in the
// aborted state, where the only legal next statement is the rollback that
// quiesces it, so every expected failure is followed by one.
const quiesce = Effect.fnUntraced(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* Effect.ignore(sql.unsafe("ROLLBACK"));
});

describe("Workspace ThreadStore driver failures", { concurrent: false }, () => {
  layer(UnmigratedThreadStoreLayer, { timeout: "2 minutes" })((it) => {
    it.effect(
      "redacts every ThreadStore statement to ThreadStoreUnavailable",
      Effect.fnUntraced(function* () {
        const store = yield* makeDrizzleThreadStore();
        const workspaceId = yield* decodeWorkspaceId(2);
        const threadId = yield* decodeThreadId(1);

        const created = yield* Effect.flip(store.createThread({ title: "New thread", workspaceId }));
        yield* quiesce();
        const listed = yield* Effect.flip(store.listThreads(workspaceId));
        yield* quiesce();
        const retitled = yield* Effect.flip(
          store.setTitleIfEmpty({ emptyTitle: "New thread", threadId, title: "Matter intake" })
        );
        yield* quiesce();
        const appended = yield* Effect.flip(
          store.appendTurn({ content: docOf("Hello"), parentTurnId: O.none(), role: "user", threadId })
        );
        yield* quiesce();
        const projected = yield* Effect.flip(store.timeline(threadId));
        yield* quiesce();

        expect(A.map([created, listed, retitled, appended, projected], isThreadStoreUnavailable)).toEqual([
          true,
          true,
          true,
          true,
          true,
        ]);
        expect(listed.reason).toBe(`list Thread failed against ${WorkspaceIdentity.ThreadId.tableName}`);
      })
    );
  });
});
