/**
 * The AC-3 history replay as a replayable fixture: each cluster of the frozen
 * goals history replay (`fixtures/goals-history-replay.json.gz`) becomes one
 * file of one memory folder, holding the cluster's base, and every writer of
 * the cluster edits a whole-file copy of that one base.
 *
 * Each cluster's file sits under its own numbered folder, so no two clusters
 * share a node and one import gives every cluster its base. The typed status
 * field is the goal phase status of this repository (`pending`, `in-progress`,
 * `complete`, `superseded`, the order of `GoalPhaseStatus` in the goals
 * schemas). Rule and lifecycle: decision `p2-ac3-history-replay-construction`.
 *
 * Labeller: the agent-memory-store-p2 lane, the only labeller of the replay.
 */
import { FileEdit, LineageId, StatusFields, StatusLifecycle, StatusValue } from "@beep/agent-memory-store";
import * as A from "effect/Array";
import * as Str from "effect/String";
import { baseTexts, writerText } from "./fixtures/goals-history-replay.ts";
import type { ReplayableFixture, ReplayStatus } from "./admission-replay.ts";
import type { GoalsHistoryReplay } from "./fixtures/goals-history-replay.ts";

/** The goal phase status lifecycle, in the order of the repository's goals schemas. */
const goalPhaseStatus = StatusLifecycle.make({
  field: "status",
  order: [
    StatusValue.make("pending"),
    StatusValue.make("in-progress"),
    StatusValue.make("complete"),
    StatusValue.make("superseded"),
  ],
});

/** The typed status fields the history replay admits with, and the lifecycle its oracle models. */
export const historyStatus: ReplayStatus = {
  fields: StatusFields.make({ lifecycles: [goalPhaseStatus] }),
  lifecycle: goalPhaseStatus,
};

/** The memory-folder path of cluster `index`: its own numbered folder, then the repository path. */
const clusterPath = (index: number, path: string): string => `${Str.padStart(3, "0")(String(index))}/${path}`;

/** The history replay's clusters as one folder of bases and the writers that edit them, in history order. */
export const historyFixtureOf = (replay: GoalsHistoryReplay): ReplayableFixture => {
  const bases = baseTexts(replay.clusters);
  const files = A.map(A.zip(replay.clusters, bases), ([cluster, text], index) => ({
    path: clusterPath(index, cluster.path),
    text,
  }));
  return {
    files,
    clusters: A.map(A.zip(replay.clusters, files), ([cluster, file], index) => ({
      id: index,
      path: file.path,
      stratum: "history",
      writers: A.map(cluster.writers, (writer, at) => ({
        author: LineageId.make(`agent-memory-store-p2:history-c${index}-w${at}`),
        edit: FileEdit.cases.edited.make({ path: file.path, text: writerText(file.text, writer.hunks) }),
      })),
    })),
  };
};
