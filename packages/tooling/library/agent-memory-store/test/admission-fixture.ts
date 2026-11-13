/**
 * The adversarial concurrent-edit fixture for AC-2 and AC-3.
 *
 * One-labeller rule: the agent-memory-store-p2 integration lane built this
 * generator, chose its strata and their shares, and labelled every cluster;
 * no other labeller and no spike trace is involved. The spike's own traces
 * are machine-local and are not used.
 *
 * The generator is deterministic and seeded (mulberry32, seed 20261112). It
 * works over real partitioned Markdown: the files of the frozen goals sample
 * (`fixtures/goals-markdown-sample.json.gz`) that hold a phase-table status
 * cell or both table rows and list items, at most 16,000 characters each. Its
 * composition is fixed before any measurement (decision
 * `p2-adversarial-fixture-is-seeded-contention-strata`): for each stratum in
 * order it takes a fixed number of clusters, each a group of writers that all
 * edit one exported base. A cluster owns a window of its file's nodes that no
 * other cluster touches, so clusters contend only inside themselves. A
 * candidate place is taken only when op capture turns every writer's edit
 * into exactly the operations the stratum declares (for example a revision is
 * one `replace` of the node); otherwise the next candidate is tried. That
 * choice depends on capture alone, never on an admission outcome.
 *
 * Every writer edits the whole file text (its copy of the export) and hands
 * it over as a `FileEdit`, so the operations each writer submits are what op
 * capture and status typing produce.
 */
import {
  captureBatch,
  FileEdit,
  LineageId,
  partition,
  replaceStatusValue,
  StatusFields,
  StatusLifecycle,
  StatusValue,
  seededNodeIdMinter,
  statusValueIn,
  typeStatusMoves,
} from "@beep/agent-memory-store";
import * as A from "effect/Array";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Result from "effect/Result";
import * as Str from "effect/String";
import { seededBaseOf } from "./OperationCapture.support.ts";
import { seededRandom } from "./projector-support.ts";
import type { BaseExport, NodeKind, NodeOperation, PartitionNode } from "@beep/agent-memory-store";
import type { SampleFile } from "./fixtures/goals-markdown-sample.ts";

/** The generator seed. */
const fixtureSeed = 20261112;

const pending = StatusValue.make("pending");
const inProgress = StatusValue.make("in-progress");
const complete = StatusValue.make("complete");

/** The one typed status field of the fixture: a phase table's status cell. */
export const phaseStatus = StatusLifecycle.make({ field: "status", order: [pending, inProgress, complete] });

/** The status lifecycles admission applies in the fixture. */
export const fixtureStatusFields = StatusFields.make({ lifecycles: [phaseStatus] });

/** A status token outside the lifecycle. */
const outsideLifecycle = StatusValue.make("blocked");

/**
 * The declared strata, in generation order, with the number of clusters each
 * contributes. The shares are fixed here, before any measurement.
 */
export const strata = [
  { stratum: "reviseVersusRevise", clusters: 6 },
  { stratum: "identicalText", clusters: 4 },
  { stratum: "reviseVersusRetire", clusters: 6 },
  { stratum: "insertUnderRetiredAnchor", clusters: 4 },
  { stratum: "insertsAfterOnePredecessor", clusters: 4 },
  { stratum: "contestedChainHead", clusters: 3 },
  { stratum: "differentNodesOneFile", clusters: 4 },
  { stratum: "tableRowNeighbours", clusters: 4 },
  { stratum: "listItemNeighbours", clusters: 4 },
  { stratum: "gapNodeEdits", clusters: 4 },
  { stratum: "statusForward", clusters: 3 },
  { stratum: "statusEqual", clusters: 2 },
  { stratum: "statusBackward", clusters: 3 },
  { stratum: "statusOutsideLifecycle", clusters: 2 },
  { stratum: "mixedCleanAndContested", clusters: 4 },
] as const;

/** One declared stratum. */
export type Stratum = (typeof strata)[number]["stratum"];

/** One writer of a cluster: its lineage and its edited copy of one file. */
export interface FixtureWriter {
  readonly author: LineageId;
  readonly edit: FileEdit;
}

/** A group of writers that all edit one exported base inside one window of one file. */
export interface FixtureCluster {
  readonly id: number;
  readonly path: string;
  readonly stratum: Stratum;
  readonly writers: ReadonlyArray<FixtureWriter>;
}

/** The fixture: the files it is built over and its clusters in generation order. */
export interface AdversarialFixture {
  readonly clusters: ReadonlyArray<FixtureCluster>;
  readonly files: ReadonlyArray<SampleFile>;
}

const maxFileChars = 16_000;
const maxStatusFileChars = 40_000;

// Nodes kept untouched on each side of a cluster's window, so no two clusters
// share a node, a gap or an insert anchor.
const margin = 1;
const maxFiles = 14;

const kindCount = (nodes: ReadonlyArray<PartitionNode>, kind: NodeKind): number =>
  A.filter(nodes, (node) => node.kind === kind).length;

const isStatusRow = (node: PartitionNode): boolean =>
  node.kind === "tableRow" && !Str.includes("\n")(node.text) && O.isSome(statusValueIn(phaseStatus, node.text));

/**
 * The sample files the fixture is built over, in path order: every file of at
 * most 40,000 characters holding at least two phase-table status cells, then
 * the first files of at most 16,000 characters holding at least three table
 * rows and three list items, up to fourteen files in all.
 */
const fixtureFiles = (files: ReadonlyArray<SampleFile>): ReadonlyArray<SampleFile> => {
  const sorted = A.sort(
    files,
    Order.mapInput(Order.String, (file: SampleFile) => file.path)
  );
  const nodesOf = (file: SampleFile) => partition(file.text).nodes;
  const withStatus = A.filter(
    sorted,
    (file) => file.text.length <= maxStatusFileChars && A.filter(nodesOf(file), isStatusRow).length >= 2
  );
  const withStructure = A.filter(sorted, (file) => {
    const nodes = nodesOf(file);
    return (
      file.text.length <= maxFileChars &&
      !A.contains(withStatus, file) &&
      kindCount(nodes, "tableRow") >= 3 &&
      kindCount(nodes, "listItem") >= 3
    );
  });
  return A.sort(
    [...withStatus, ...A.take(withStructure, maxFiles - withStatus.length)],
    Order.mapInput(Order.String, (file: SampleFile) => file.path)
  );
};

// --- Text edits -------------------------------------------------------------

const listMarker = /^(\s*)([-*+]|\d+[.)])\s/;

// The node's text revised by `tag`, when the stratum can revise its kind.
const revisedText = (node: PartitionNode, tag: string): O.Option<string> => {
  switch (node.kind) {
    case "paragraph":
      return O.some(`${node.text} Revised by writer ${tag}.`);
    case "heading":
      return Str.startsWith("#")(node.text) ? O.some(`${node.text} (writer ${tag})`) : O.none();
    case "listItem":
      return O.some(`${node.text} (revised by writer ${tag})`);
    case "tableRow":
      return !Str.includes("\n")(node.text) && Str.endsWith("|")(node.text) && !isStatusRow(node)
        ? O.some(`${Str.slice(0, -1)(node.text)} writer ${tag} |`)
        : O.none();
    default:
      return O.none();
  }
};

// A new node of the same kind as `node`, written by `tag`.
const insertedText = (node: PartitionNode, tag: string): O.Option<string> => {
  switch (node.kind) {
    case "paragraph":
      return O.some(`Inserted paragraph by writer ${tag}.`);
    case "listItem":
      return O.map(
        O.fromNullishOr(listMarker.exec(node.text)),
        (match) => `${match[0]}Inserted item by writer ${tag}.`
      );
    case "tableRow": {
      const cells = Str.split("|")(node.text).length - 2;
      return !Str.includes("\n")(node.text) && cells > 0
        ? O.some(
            `|${A.join(
              A.makeBy(cells, () => ` w${tag} `),
              "|"
            )}|`
          )
        : O.none();
    }
    default:
      return O.none();
  }
};

const replaced = (texts: ReadonlyArray<string>, index: number, text: string): ReadonlyArray<string> =>
  A.map(texts, (current, at) => (at === index ? text : current));

const removed = (texts: ReadonlyArray<string>, from: number, count: number): ReadonlyArray<string> =>
  A.filter(texts, (_, at) => at < from || at >= from + count);

const inserted = (texts: ReadonlyArray<string>, at: number, news: ReadonlyArray<string>): ReadonlyArray<string> => [
  ...A.take(texts, at),
  ...news,
  ...A.drop(texts, at),
];

// --- Candidate places ---------------------------------------------------------

interface FilePlan {
  readonly nodes: ReadonlyArray<PartitionNode>;
  readonly path: string;
  readonly texts: ReadonlyArray<string>;
}

// One writer before capture: its tag and its node texts after the edit.
interface DraftWriter {
  readonly tag: string;
  readonly texts: ReadonlyArray<string>;
}

// A candidate cluster: the node indices it touches, its writers and the
// operation shape each writer's capture must have.
interface Draft {
  // A check over every writer's operations together, when the stratum needs one.
  readonly cross?: (operations: ReadonlyArray<ReadonlyArray<NodeOperation>>) => boolean;
  readonly expect: ReadonlyArray<(operations: ReadonlyArray<NodeOperation>, plan: Located) => boolean>;
  readonly touched: readonly [number, number];
  readonly writers: ReadonlyArray<DraftWriter>;
}

// The base node ids of a file, for the shape checks.
interface Located {
  readonly ids: ReadonlyArray<string>;
}

const isGap = (plan: FilePlan, index: number): boolean =>
  O.exists(A.get(plan.nodes, index), (node) => node.kind === "gap");

const nodeAt = (plan: FilePlan, index: number): O.Option<PartitionNode> => A.get(plan.nodes, index);

// The node and the gap the retirement removes with it: the gap before it when
// that gap's text equals the gap after it (so the file keeps its shape), else
// the gap after it.
const retirement = (plan: FilePlan, index: number): O.Option<readonly [number, number]> =>
  isGap(plan, index + 1) ? O.some([index, 2]) : isGap(plan, index - 1) ? O.some([index - 1, 2]) : O.none();

const opsAre = (operations: ReadonlyArray<NodeOperation>, kinds: ReadonlyArray<NodeOperation["op"]>): boolean =>
  operations.length === kinds.length && A.every(A.zip(operations, kinds), ([operation, kind]) => operation.op === kind);

const replaces =
  (index: number) =>
  (operations: ReadonlyArray<NodeOperation>, located: Located): boolean =>
    opsAre(operations, ["replace"]) && operations[0]?.nodeId === located.ids[index];

const replacesBoth =
  (first: number, second: number) =>
  (operations: ReadonlyArray<NodeOperation>, located: Located): boolean =>
    opsAre(operations, ["replace", "replace"]) &&
    A.every(
      operations,
      (operation) => operation.nodeId === located.ids[first] || operation.nodeId === located.ids[second]
    );

const retires =
  (index: number) =>
  (operations: ReadonlyArray<NodeOperation>, located: Located): boolean =>
    opsAre(operations, ["delete", "delete"]) &&
    A.some(operations, (operation) => operation.nodeId === located.ids[index]);

// `count` content inserts, each followed by its gap, the first after one of
// `anchors`; with `retiredBy`, the first anchor must be a node it deletes.
const insertsAfter =
  (anchors: ReadonlyArray<number>, count: number) =>
  (operations: ReadonlyArray<NodeOperation>, located: Located): boolean =>
    opsAre(
      operations,
      A.makeBy(count * 2, () => "insert")
    ) &&
    O.exists(A.head(operations), (first) =>
      first.op === "insert"
        ? O.exists(first.afterNodeId, (after) => A.some(anchors, (anchor) => located.ids[anchor] === after))
        : false
    );

const movesStatus =
  (index: number, to: StatusValue) =>
  (operations: ReadonlyArray<NodeOperation>, located: Located): boolean =>
    opsAre(operations, ["setStatus"]) &&
    O.exists(A.head(operations), (operation) =>
      operation.op === "setStatus" ? operation.nodeId === located.ids[index] && operation.transition.to === to : false
    );

// The first insert of the second writer follows a node the first writer deletes.
const anchoredOnRetired = ([retire, insert]: ReadonlyArray<ReadonlyArray<NodeOperation>>): boolean =>
  O.exists(O.flatMap(O.fromUndefinedOr(insert), A.head), (first) =>
    first.op === "insert"
      ? O.exists(first.afterNodeId, (after) => A.some(retire ?? [], (operation) => operation.nodeId === after))
      : false
  );

const reviseDraft = (plan: FilePlan, index: number, tags: ReadonlyArray<string>): O.Option<Draft> =>
  O.flatMap(nodeAt(plan, index), (node) =>
    O.map(O.all(A.map(tags, (tag) => revisedText(node, tag))), (texts) => ({
      touched: [index, index] as const,
      writers: A.map(A.zip(tags, texts), ([tag, text]) => ({ tag, texts: replaced(plan.texts, index, text) })),
      expect: A.map(tags, () => replaces(index)),
    }))
  );

// A writer that retires the node at `index` with one neighbouring gap.
const retireWriter = (plan: FilePlan, index: number, tag: string): O.Option<DraftWriter> =>
  O.map(retirement(plan, index), ([from, count]) => ({ tag, texts: removed(plan.texts, from, count) }));

// A writer that inserts `count` new nodes like the one at `index`, each with a
// copy of the gap that follows it, right after that gap.
const insertWriter = (plan: FilePlan, index: number, tag: string, count: number): O.Option<DraftWriter> =>
  O.flatMap(nodeAt(plan, index), (node) =>
    O.flatMap(nodeAt(plan, index + 1), (gap) =>
      gap.kind === "gap"
        ? O.map(O.all(A.makeBy(count, (at) => insertedText(node, count === 1 ? tag : `${tag}${at + 1}`))), (texts) => ({
            tag,
            texts: inserted(
              plan.texts,
              index + 2,
              A.flatMap(texts, (text) => [text, gap.text])
            ),
          }))
        : O.none()
    )
  );

const statusMoveWriter = (plan: FilePlan, index: number, tag: string, to: StatusValue): O.Option<DraftWriter> =>
  O.flatMap(nodeAt(plan, index), (node) =>
    O.map(statusValueIn(phaseStatus, node.text), (from) => ({
      tag,
      texts: replaced(plan.texts, index, replaceStatusValue(node.text, from, to)),
    }))
  );

const positionOf = (value: StatusValue): number =>
  A.findFirstIndex(phaseStatus.order, (at) => at === value).pipe(O.getOrElse(() => -1));

const last = phaseStatus.order.length - 1;

// The lifecycle value right after the one at `at`.
const nextOf = (at: number): StatusValue => phaseStatus.order[at + 1] ?? complete;

// The two writers' target values for a status cell at lifecycle position `at`,
// when the stratum can move a cell from there.
type StatusTargets = (at: number) => O.Option<readonly [StatusValue, StatusValue]>;

// Two writers moving the status cell at `index` to the values `targetsOf` picks.
const statusDraft =
  (targetsOf: StatusTargets) =>
  (plan: FilePlan, index: number): O.Option<Draft> =>
    O.flatMap(O.filter(nodeAt(plan, index), isStatusRow), (node) =>
      O.flatMap(statusValueIn(phaseStatus, node.text), (from) =>
        O.flatMap(targetsOf(positionOf(from)), ([toA, toB]) =>
          O.map(
            O.all([statusMoveWriter(plan, index, "a", toA), statusMoveWriter(plan, index, "b", toB)]),
            (writers) => ({
              touched: [index, index] as const,
              writers,
              expect: [movesStatus(index, toA), movesStatus(index, toB)],
            })
          )
        )
      )
    );

// The draft of one stratum's cluster around the content node at `index`.
type DraftBuilder = (plan: FilePlan, index: number) => O.Option<Draft>;

const identicalTextDraft: DraftBuilder = (plan, index) =>
  O.map(reviseDraft(plan, index, ["same"]), (draft) => ({
    touched: draft.touched,
    writers: [
      { tag: "a", texts: draft.writers[0]?.texts ?? [] },
      { tag: "b", texts: draft.writers[0]?.texts ?? [] },
    ],
    expect: [replaces(index), replaces(index)],
  }));

const reviseVersusRetireDraft: DraftBuilder = (plan, index) =>
  O.flatMap(reviseDraft(plan, index, ["a"]), (draft) =>
    O.map(retireWriter(plan, index, "b"), (retire) => ({
      touched: [index - 1, index + 1] as const,
      writers: [...draft.writers, retire],
      expect: [replaces(index), retires(index)],
    }))
  );

// One writer retires the node at `index`, the other inserts `count` nodes after it.
const retiredAnchorDraft =
  (count: number): DraftBuilder =>
  (plan, index) =>
    O.map(O.all([retireWriter(plan, index, "a"), insertWriter(plan, index, "b", count)]), (writers) => ({
      touched: [index - 1, index + 2] as const,
      writers,
      expect: [retires(index), insertsAfter([index, index + 1], count)],
      cross: anchoredOnRetired,
    }));

const insertsAfterOnePredecessorDraft: DraftBuilder = (plan, index) =>
  O.map(O.all([insertWriter(plan, index, "a", 1), insertWriter(plan, index, "b", 1)]), (writers) => ({
    touched: [index, index + 2] as const,
    writers,
    expect: [insertsAfter([index, index + 1], 1), insertsAfter([index, index + 1], 1)],
  }));

const differentNodesOneFileDraft: DraftBuilder = (plan, index) =>
  O.flatMap(
    O.all([reviseDraft(plan, index, ["a"]), reviseDraft(plan, index + 4, ["b"]), reviseDraft(plan, index + 8, ["c"])]),
    (drafts) =>
      A.every(drafts, (draft) => draft.writers.length === 1)
        ? O.some({
            touched: [index, index + 8] as const,
            writers: A.flatMap(drafts, (draft) => draft.writers),
            expect: [replaces(index), replaces(index + 4), replaces(index + 8)],
          })
        : O.none()
  );

// Two writers revising two nodes of `kind` that one gap separates.
const neighboursDraft =
  (kind: NodeKind): DraftBuilder =>
  (plan, index) =>
    O.exists(nodeAt(plan, index), (node) => node.kind === kind) &&
    O.exists(nodeAt(plan, index + 2), (node) => node.kind === kind) &&
    isGap(plan, index + 1)
      ? O.flatMap(O.all([reviseDraft(plan, index, ["a"]), reviseDraft(plan, index + 2, ["b"])]), ([first, second]) =>
          O.some({
            touched: [index, index + 2] as const,
            writers: [...first.writers, ...second.writers],
            expect: [replaces(index), replaces(index + 2)],
          })
        )
      : O.none();

const gapNodeEditsDraft: DraftBuilder = (plan, index) =>
  O.exists(nodeAt(plan, index + 1), (gap) => gap.kind === "gap" && gap.text === "\n\n")
    ? O.map(reviseDraft(plan, index + 2, ["b"]), (draft) => ({
        touched: [index + 1, index + 2] as const,
        writers: [{ tag: "a", texts: replaced(plan.texts, index + 1, "\n\n\n") }, ...draft.writers],
        expect: [replaces(index + 1), replaces(index + 2)],
      }))
    : O.none();

const mixedCleanAndContestedDraft: DraftBuilder = (plan, index) =>
  O.flatMap(nodeAt(plan, index), (node) =>
    O.flatMap(O.all([revisedText(node, "a"), revisedText(node, "b")]), ([textA, textB]) =>
      O.flatMap(nodeAt(plan, index + 4), (clean) =>
        O.map(revisedText(clean, "a-clean"), (cleanText) => ({
          touched: [index, index + 4] as const,
          writers: [
            { tag: "a", texts: replaced(replaced(plan.texts, index, textA), index + 4, cleanText) },
            { tag: "b", texts: replaced(plan.texts, index, textB) },
          ],
          expect: [replacesBoth(index, index + 4), replaces(index)],
        }))
      )
    )
  );

// The draft builder of every stratum.
const draftBuilders: { readonly [K in Stratum]: DraftBuilder } = {
  reviseVersusRevise: (plan, index) => reviseDraft(plan, index, ["a", "b"]),
  identicalText: identicalTextDraft,
  reviseVersusRetire: reviseVersusRetireDraft,
  insertUnderRetiredAnchor: retiredAnchorDraft(1),
  insertsAfterOnePredecessor: insertsAfterOnePredecessorDraft,
  contestedChainHead: retiredAnchorDraft(2),
  differentNodesOneFile: differentNodesOneFileDraft,
  tableRowNeighbours: neighboursDraft("tableRow"),
  listItemNeighbours: neighboursDraft("listItem"),
  gapNodeEdits: gapNodeEditsDraft,
  statusForward: statusDraft((at) => (at === 0 ? O.some([inProgress, complete]) : O.none())),
  statusEqual: statusDraft((at) => (at < last ? O.some([nextOf(at), nextOf(at)]) : O.none())),
  statusBackward: statusDraft((at) => (at >= 1 ? O.some([pending, at < last ? complete : inProgress]) : O.none())),
  statusOutsideLifecycle: statusDraft((at) => (at < last ? O.some([nextOf(at), outsideLifecycle]) : O.none())),
  mixedCleanAndContested: mixedCleanAndContestedDraft,
};

const draftOf = (plan: FilePlan, index: number, stratum: Stratum): O.Option<Draft> =>
  draftBuilders[stratum](plan, index);

// --- Generation -------------------------------------------------------------------

const authorOf = (cluster: number, tag: string): LineageId =>
  LineageId.make(`agent-memory-store-p2:fixture-c${cluster}-${tag}`);

// Whether every writer's captured (and status-typed) operations have the
// shape the stratum declares.
const capturesAsDeclared = (base: BaseExport, plan: FilePlan, draft: Draft): boolean => {
  const located: Located = {
    ids: O.getOrElse(
      O.map(
        A.findFirst(base.files, (file) => file.path === plan.path),
        (file) => A.map(file.nodes, (node) => node.nodeId)
      ),
      () => []
    ),
  };
  const captured = A.map(draft.writers, (writer) =>
    Result.match(
      captureBatch(
        base,
        [FileEdit.cases.edited.make({ path: plan.path, text: A.join(writer.texts, "") })],
        authorOf(0, writer.tag),
        // Base ids come from `fixtureSeed`; minted ids must not repeat them.
        seededNodeIdMinter(fixtureSeed + 1)
      ),
      {
        onFailure: () => O.none<ReadonlyArray<NodeOperation>>(),
        onSuccess: O.map((batch) => typeStatusMoves(batch, fixtureStatusFields).operations),
      }
    )
  );
  return O.match(O.all(captured), {
    onNone: () => false,
    onSome: (operations) =>
      A.every(A.zip(operations, draft.expect), ([submitted, expected]) => expected(submitted, located)) &&
      (draft.cross === undefined || draft.cross(operations)),
  });
};

// One candidate place: a content node of one file.
interface Candidate {
  readonly index: number;
  readonly plan: FilePlan;
}

const plansOf = (files: ReadonlyArray<SampleFile>): ReadonlyArray<FilePlan> =>
  A.map(files, (file) => {
    const nodes = partition(file.text).nodes;
    return { path: file.path, nodes, texts: A.map(nodes, (node) => node.text) };
  });

// Every content node of every file, in the order the fixture seed ranks them.
const candidatesOf = (plans: ReadonlyArray<FilePlan>): ReadonlyArray<Candidate> => {
  const random = seededRandom(fixtureSeed);
  return A.map(
    A.sort(
      A.flatMap(plans, (plan) =>
        A.flatMap(plan.nodes, (node, index) => (node.kind === "gap" ? [] : [{ plan, index, rank: random() }]))
      ),
      Order.mapInput(Order.Number, (candidate: { readonly rank: number }) => candidate.rank)
    ),
    ({ plan, index }) => ({ plan, index })
  );
};

// The node indices clusters already own, by file path.
type Reserved = MutableHashMap.MutableHashMap<string, MutableHashSet.MutableHashSet<number>>;

const isFree = (reserved: Reserved, path: string, from: number, to: number): boolean =>
  O.match(MutableHashMap.get(reserved, path), {
    onNone: () => true,
    onSome: (taken) => A.every(A.range(from, to), (at) => !MutableHashSet.has(taken, at)),
  });

const reserve = (reserved: Reserved, path: string, from: number, to: number): void => {
  const taken = O.getOrElse(MutableHashMap.get(reserved, path), () => MutableHashSet.empty<number>());
  for (const at of A.range(from, to)) {
    MutableHashSet.add(taken, at);
  }
  MutableHashMap.set(reserved, path, taken);
};

// What one stratum's placement reads and the clusters it adds to.
interface Placement {
  readonly base: BaseExport;
  readonly candidates: ReadonlyArray<Candidate>;
  readonly clusters: Array<FixtureCluster>;
  readonly reserved: Reserved;
}

// The draft a candidate yields for `stratum`, when its window (with margins)
// is free and every writer captures as the stratum declares.
const placedAt = (placement: Placement, { plan, index }: Candidate, stratum: Stratum): O.Option<Draft> =>
  O.filter(draftOf(plan, index, stratum), (draft) => {
    const [lo, hi] = draft.touched;
    return (
      isFree(placement.reserved, plan.path, lo - margin, hi + margin) && capturesAsDeclared(placement.base, plan, draft)
    );
  });

const clusterOf = (id: number, plan: FilePlan, stratum: Stratum, draft: Draft): FixtureCluster => ({
  id,
  path: plan.path,
  stratum,
  writers: A.map(draft.writers, (writer) => ({
    author: authorOf(id, writer.tag),
    edit: FileEdit.cases.edited.make({ path: plan.path, text: A.join(writer.texts, "") }),
  })),
});

// Takes the first `wanted` free places of `stratum` in candidate order.
const placeStratum = (placement: Placement, stratum: Stratum, wanted: number): void => {
  let taken = 0;
  for (const candidate of placement.candidates) {
    if (taken === wanted) {
      break;
    }
    const draft = placedAt(placement, candidate, stratum);
    if (O.isSome(draft)) {
      const [lo, hi] = draft.value.touched;
      reserve(placement.reserved, candidate.plan.path, lo - margin, hi + margin);
      placement.clusters.push(clusterOf(placement.clusters.length, candidate.plan, stratum, draft.value));
      taken += 1;
    }
  }
  if (taken < wanted) {
    throw new Error(`The fixture found ${taken} of ${wanted} places for stratum ${stratum}.`);
  }
};

/**
 * Builds the fixture over the sample files. Throws when a stratum runs out of
 * candidate places, so the composition can never silently shrink.
 */
export const buildAdversarialFixture = (sample: ReadonlyArray<SampleFile>): AdversarialFixture => {
  const files = fixtureFiles(sample);
  const placement: Placement = {
    base: seededBaseOf(fixtureSeed)(A.map(files, (file) => [file.path, file.text] as const)),
    candidates: candidatesOf(plansOf(files)),
    clusters: [],
    reserved: MutableHashMap.empty(),
  };
  for (const { stratum, clusters: wanted } of strata) {
    placeStratum(placement, stratum, wanted);
  }
  return { clusters: placement.clusters, files };
};
