/**
 * Private local storage composition for agent messaging.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as SqliteClient from "@effect/sql-sqlite-bun/SqliteClient";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import { RouterError } from "./AgentMessage.models.ts";
import { AgentMessageStore, makeAgentMessageStore } from "./AgentMessage.store.ts";

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
 * const storage = agentMessageStoreLayer("/work/private/agent-messages")
 * void storage
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const agentMessageStoreLayer = (directory: string) =>
  Layer.unwrap(
    Effect.gen(function* () {
      const filename = yield* prepareDatabase(directory);
      return Layer.effect(AgentMessageStore, makeAgentMessageStore()).pipe(
        Layer.provide(SqliteClient.layer({ filename, busyTimeout: Duration.millis(250) }))
      );
    }).pipe(Effect.withSpan("AgentMessage.storeLayer"))
  );
