/**
 * The workstation goal completion receipt store: an append-only JSON Lines
 * file per repository under the beep state root, shared by every clone and
 * lane on the machine.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { JsonStringCodec } from "../../internal/schema/JsonCodec.ts";
import { makeJsonLinesStore } from "../../internal/state/JsonLinesStore.ts";
import {
  repositoryJsonLinesFileName,
  resolveWorkstationStateDir,
  StateRepository,
} from "../../internal/state/WorkstationState.ts";
import { YeetCommandError } from "../Yeet/Yeet.errors.ts";
import { GoalCompletionReceipt } from "./Goals.schemas.ts";

const $I = $RepoCliId.create("commands/Goals/CompletionReceiptStore.service");
const equivalentStateRepository = S.toEquivalence(StateRepository);

/**
 * JSON Lines codec for one stored goal completion receipt.
 *
 * **Example** (Decode a corrupt line)
 *
 * ```ts
 * import { GoalCompletionReceiptJson } from "@beep/repo-cli/commands/Goals/CompletionReceiptStore.service"
 * import * as O from "effect/Option"
 *
 * console.log(O.isNone(GoalCompletionReceiptJson.decodeOption("not-json"))) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GoalCompletionReceiptJson = JsonStringCodec(GoalCompletionReceipt);

/**
 * The workstation state partition for a GitHub `owner/name` repository slug.
 *
 * **Details**
 *
 * Owner and name are lowercased so every clone of one repository appends to
 * the same file, whatever case its `origin` URL spells.
 *
 * **Example** (Partition a repository slug)
 *
 * ```ts
 * import { goalCompletionReceiptPartition } from "@beep/repo-cli/commands/Goals/CompletionReceiptStore.service"
 *
 * console.log(goalCompletionReceiptPartition("Example/Repo"))
 * // { host: "github.com", owner: "example", name: "repo" }
 * ```
 *
 * @param repository - The receipt's GitHub `owner/name` repository slug.
 * @returns The repository identity the store file is named after.
 * @category formatting
 * @since 0.0.0
 */
export const goalCompletionReceiptPartition = (repository: string): StateRepository => {
  const parts = Str.split(Str.toLowerCase(repository), "/");
  return {
    host: "github.com",
    owner: A.headNonEmpty(parts),
    name: A.join(A.drop(parts, 1), "/"),
  };
};

/**
 * Service contract: append a receipt, or list every receipt stored for one
 * GitHub `owner/name` repository.
 *
 * **Example** (Describe a list)
 *
 * ```ts
 * import type { GoalCompletionReceiptStoreShape } from "@beep/repo-cli/commands/Goals/CompletionReceiptStore.service"
 *
 * const listRepo = (store: GoalCompletionReceiptStoreShape) => store.list("example/repo")
 * console.log(listRepo.length) // 1
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface GoalCompletionReceiptStoreShape {
  readonly append: (receipt: GoalCompletionReceipt) => Effect.Effect<void, YeetCommandError>;
  readonly list: (repository: string) => Effect.Effect<ReadonlyArray<GoalCompletionReceipt>, YeetCommandError>;
}

/**
 * Workstation-scoped store of derived goal completion receipts.
 *
 * **Details**
 *
 * Every clone of a repository on the machine reads and writes the same file,
 * `github.com__<owner>__<name>.jsonl` under `$BEEP_GOALS_STATE_ROOT`, else
 * `$XDG_STATE_HOME/beep/goals`, else `~/.local/state/beep/goals`. Only
 * `goals completion refresh` appends to it.
 *
 * **Example** (Request the store)
 *
 * ```ts
 * import { GoalCompletionReceiptStore } from "@beep/repo-cli/commands/Goals/CompletionReceiptStore.service"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(Effect.gen(function* () { return yield* GoalCompletionReceiptStore }))) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class GoalCompletionReceiptStore extends Context.Service<
  GoalCompletionReceiptStore,
  GoalCompletionReceiptStoreShape
>()($I`GoalCompletionReceiptStore`) {}

/**
 * Build the filesystem-backed store over an explicit directory.
 *
 * **Example** (Build a store in a directory)
 *
 * ```ts
 * import { makeGoalCompletionReceiptStoreAt } from "@beep/repo-cli/commands/Goals/CompletionReceiptStore.service"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(makeGoalCompletionReceiptStoreAt("/state/beep/goals"))) // true
 * ```
 *
 * @param directory - The directory the per-repository files live in.
 * @returns The store's `append` and `list`.
 * @category constructors
 * @since 0.0.0
 */
export const makeGoalCompletionReceiptStoreAt = Effect.fn("GoalCompletionReceiptStore.makeAt")(function* (
  directory: string
) {
  const store = yield* makeJsonLinesStore({
    directory,
    fileName: flow(goalCompletionReceiptPartition, repositoryJsonLinesFileName),
    partitionOf: (receipt: GoalCompletionReceipt) => receipt.repository,
    encode: flow(
      GoalCompletionReceiptJson.encode,
      Effect.mapError((cause) =>
        YeetCommandError.make({ message: "Failed to encode the goal completion receipt.", cause })
      )
    ),
    decodeOption: GoalCompletionReceiptJson.decodeOption,
    onPlatformError: (cause) =>
      YeetCommandError.make({ message: `Goal completion receipt store: ${cause.message}`, cause }),
    label: { scope: "goals", noun: "completion receipt" },
  });
  return GoalCompletionReceiptStore.of(store);
});

/**
 * Build the live store in the resolved workstation state directory.
 *
 * **Example** (Build the live store effect)
 *
 * ```ts
 * import { makeGoalCompletionReceiptStoreLive } from "@beep/repo-cli/commands/Goals/CompletionReceiptStore.service"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(makeGoalCompletionReceiptStoreLive())) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeGoalCompletionReceiptStoreLive = Effect.fn("GoalCompletionReceiptStore.makeLive")(function* () {
  const directory = yield* resolveWorkstationStateDir({ override: "BEEP_GOALS_STATE_ROOT", store: "goals" }).pipe(
    Effect.mapError((cause) =>
      YeetCommandError.make({ message: "Cannot resolve the goal completion receipt store directory.", cause })
    )
  );
  return yield* makeGoalCompletionReceiptStoreAt(directory);
});

/**
 * Live filesystem store layer.
 *
 * **Example** (Provide the live store)
 *
 * ```ts
 * import {
 *   GoalCompletionReceiptStore,
 *   layerGoalCompletionReceiptStoreLive,
 * } from "@beep/repo-cli/commands/Goals/CompletionReceiptStore.service"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.gen(function* () { return yield* GoalCompletionReceiptStore }).pipe(
 *   Effect.provide(layerGoalCompletionReceiptStoreLive)
 * )
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerGoalCompletionReceiptStoreLive = Layer.effect(
  GoalCompletionReceiptStore,
  makeGoalCompletionReceiptStoreLive()
);

/**
 * In-memory store layer for tests.
 *
 * **Example** (Provide the memory store)
 *
 * ```ts
 * import {
 *   GoalCompletionReceiptStore,
 *   layerGoalCompletionReceiptStoreMemory,
 * } from "@beep/repo-cli/commands/Goals/CompletionReceiptStore.service"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.gen(function* () { return yield* GoalCompletionReceiptStore }).pipe(
 *   Effect.provide(layerGoalCompletionReceiptStoreMemory)
 * )
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const layerGoalCompletionReceiptStoreMemory = Layer.effect(
  GoalCompletionReceiptStore,
  Ref.make(A.empty<GoalCompletionReceipt>()).pipe(
    Effect.map((rows) =>
      GoalCompletionReceiptStore.of({
        append: Effect.fn("GoalCompletionReceiptStore.memory.append")((receipt) => Ref.update(rows, A.append(receipt))),
        list: Effect.fn("GoalCompletionReceiptStore.memory.list")((repository) =>
          Ref.get(rows).pipe(
            Effect.map(
              A.filter((receipt) =>
                equivalentStateRepository(
                  goalCompletionReceiptPartition(receipt.repository),
                  goalCompletionReceiptPartition(repository)
                )
              )
            )
          )
        ),
      })
    )
  )
);

/**
 * The provided receipt store, or the live workstation store when none is
 * provided.
 *
 * **Details**
 *
 * Mirrors the `GoalCompletionIo` port: commands run without wiring a layer,
 * and tests isolate the store by providing {@link GoalCompletionReceiptStore}
 * or by pointing `BEEP_GOALS_STATE_ROOT` at a temporary directory.
 *
 * **Example** (Resolve the store)
 *
 * ```ts
 * import { goalCompletionReceiptStore } from "@beep/repo-cli/commands/Goals/CompletionReceiptStore.service"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(goalCompletionReceiptStore())) // true
 * ```
 *
 * @returns The receipt store to read and append through.
 * @category services
 * @since 0.0.0
 */
export const goalCompletionReceiptStore = Effect.fn("GoalCompletionReceiptStore.resolve")(function* () {
  const provided = yield* Effect.serviceOption(GoalCompletionReceiptStore);
  return O.isSome(provided) ? provided.value : yield* makeGoalCompletionReceiptStoreLive();
});
