/**
 * Private local storage composition for agent messaging.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as Reactivity from "effect/reactivity/Reactivity";
import * as SqlClient from "effect/sql/SqlClient";
import { RouterError } from "./AgentMessage.models.ts";
import { AgentMessageStore, makeAgentMessageStore } from "./AgentMessage.store.ts";

/**
 * Open a real SQLite connection using the current JavaScript runtime's driver.
 *
 * **Details**
 * Driver loading occurs only when this effect runs, so importing command metadata
 * under Node does not resolve Bun-only modules. The caller owns the connection scope.
 *
 * **Example** (Prepare a scoped connection)
 * ```ts
 * import { makeAgentMessageSqliteClient } from "@beep/repo-cli/test/AgentMessage"
 * import * as Effect from "effect/Effect"
 * const connection = makeAgentMessageSqliteClient("/work/private/messages.sqlite")
 * console.log(Effect.isEffect(connection)) // true
 * ```
 *
 * @internal
 * @category constructors
 * @since 0.0.0
 */
export const makeAgentMessageSqliteClient = Effect.fn("AgentMessage.openSqlite")(function* (
  filename: string,
  busyTimeout: Duration.Input = Duration.millis(250)
) {
  const loadFailure = () =>
    RouterError.make({ code: "storage", message: "Agent message SQLite driver could not be loaded." });
  const client: SqlClient.SqlClient = yield* P.isUndefined(process.versions.bun)
    ? Effect.tryPromise({ try: () => import("@effect/sql-sqlite-node/SqliteClient"), catch: loadFailure }).pipe(
        Effect.flatMap((driver) => driver.make({ filename, busyTimeout }))
      )
    : Effect.tryPromise({ try: () => import("@effect/sql-sqlite-bun/SqliteClient"), catch: loadFailure }).pipe(
        Effect.flatMap((driver) => driver.make({ filename, busyTimeout }))
      );
  return client;
});

/**
 * Require a private real path before opening a database or launch-grant file.
 *
 * **Details**
 *
 * Refuses symlinks and group/other permissions. This boundary assumes the
 * current OS account is trusted; it does not sandbox other processes of that account.
 *
 * **Example** (Validate a private grant path)
 *
 * ```ts
 * import { requirePrivateAgentPath } from "@beep/repo-cli/commands/AgentMessage"
 * const check = requirePrivateAgentPath("/work/private/grant.json", "File")
 * void check
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const requirePrivateAgentPath = Effect.fn("AgentMessage.requirePrivatePath")(function* (
  filename: string,
  kind: "File" | "Directory"
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const absolute = path.resolve(filename);
  const real = yield* fs.realPath(absolute);
  const info = yield* fs.stat(absolute);
  if (real !== absolute || info.type !== kind || (info.mode & 0o077) !== 0) {
    return yield* RouterError.make({
      code: "policyMismatch",
      message: "Agent state must be a real private path without group or other access.",
    });
  }
  return absolute;
});

const prepareDatabase = Effect.fn("AgentMessage.prepareDatabase")(function* (directory: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  if (!path.isAbsolute(directory)) {
    return yield* RouterError.make({ code: "unsupported", message: "--state-dir must be absolute." });
  }
  yield* fs.makeDirectory(directory, { recursive: true, mode: 0o700 });
  const root = yield* requirePrivateAgentPath(directory, "Directory");
  const filename = path.join(root, "messages.sqlite");
  yield* fs
    .writeFileString(filename, "", { flag: "wx", mode: 0o600 })
    .pipe(Effect.catchReason("PlatformError", "AlreadyExists", () => Effect.void));
  yield* requirePrivateAgentPath(filename, "File");
  return filename;
});

/**
 * Open the transactional store beneath an explicitly selected private directory.
 *
 * **Details**
 *
 * SQLite and all its sidecars live beneath the validated private directory.
 * The store initializes its schema and checks WAL/FULL before accepting messages.
 * The caller owns the layer scope; disposing it closes the database connection.
 *
 * **Example** (Compose local storage)
 *
 * ```ts
 * import { agentMessageStoreLayer } from "@beep/repo-cli/commands/AgentMessage"
 * import * as Layer from "effect/Layer"
 * const storage = agentMessageStoreLayer("/work/private/agent-messages")
 * console.log(Layer.isLayer(storage)) // true
 * ```
 *
 * @param directory - Absolute private directory for the database and its sidecars.
 * @returns A scoped store layer that validates filesystem access before opening SQLite.
 * @category layers
 * @since 0.0.0
 */
export const agentMessageStoreLayer = (directory: string) =>
  Layer.unwrap(
    Effect.gen(function* () {
      const filename = yield* prepareDatabase(directory);
      return Layer.effect(AgentMessageStore, makeAgentMessageStore()).pipe(
        Layer.provide(
          Layer.effect(SqlClient.SqlClient, makeAgentMessageSqliteClient(filename)).pipe(
            Layer.provide(Reactivity.layer)
          )
        )
      );
    }).pipe(Effect.withSpan("AgentMessage.storeLayer"))
  );
