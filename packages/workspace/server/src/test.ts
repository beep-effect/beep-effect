/**
 * Workspace server test layer.
 *
 * @packageDocumentation
 * @category testing
 * @since 0.0.0
 */

import { Layer } from "effect";
import { ThreadStoreInMemoryLayer } from "./aggregates/Thread/index.ts";
import {
  InMemoryState,
  MessageEntityInput,
  ThreadEntityInput,
  TurnEntityInput,
} from "./aggregates/Thread/ThreadStore.repo.internal.ts";
import { WorkspaceVaultStoreInMemoryLayer } from "./aggregates/Workspace/index.ts";

/**
 * In-memory workspace server layer for tests.
 *
 * **Example** (Import test server layer)
 *
 * ```ts
 * import { WorkspaceServerTest } from "@beep/workspace-server/test"
 *
 * console.log(WorkspaceServerTest)
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const WorkspaceServerTest = Layer.mergeAll(ThreadStoreInMemoryLayer, WorkspaceVaultStoreInMemoryLayer);

/**
 * ThreadStore repository schemas exposed for package-local parity tests.
 *
 * **Example** (Access test schema nextId)
 *
 * ```ts
 * import { ThreadStoreRepoTestSchemas } from "@beep/workspace-server/test"
 *
 * console.log(ThreadStoreRepoTestSchemas.InMemoryState.make({}).nextId)
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const ThreadStoreRepoTestSchemas = {
  InMemoryState,
  MessageEntityInput,
  ThreadEntityInput,
  TurnEntityInput,
} as const;
