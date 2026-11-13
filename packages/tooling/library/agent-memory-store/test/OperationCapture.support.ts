/**
 * Shared harness for the op capture suites: synthetic bases built by
 * partitioning file texts, a capture-then-apply round trip, and the
 * node-level and character-level edit generators the properties and the
 * goals sample replay use.
 *
 * Every base here is synthetic or derived from the tracked goals sample; the
 * agent-memory-store-p2 lane wrote the generators and is their only labeller.
 */

import {
  applyOperations,
  BaseExport,
  BaseFile,
  BaseNode,
  captureBatch,
  LineageId,
  LogCursor,
  MemoryFilePath,
  OccurrenceAnchor,
  partition,
  RevisionId,
  seededNodeIdMinter,
} from "@beep/agent-memory-store";
import { alignFile } from "@beep/agent-memory-store/internal/OperationCapture.align";
import { SourceTextDigest, SourceTextExtractor, SourceTextIdentity, TextAnchor } from "@beep/provenance";
import { PosixPath, Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as Str from "effect/String";
import type { AppliedFile, FileEdit, NodeId, NodeOperation, OperationBatch } from "@beep/agent-memory-store";
import type { LazyArg } from "effect/Function";

/** The lineage every test batch is written by. */
export const author = LineageId.make("operation-capture-test");

/** SHA-256 of the empty string: the digest the synthetic bases record. */
const emptyDigest = Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");

const extractor = SourceTextExtractor.make({ name: "operation-capture-test", version: "1" });

/** A revision id that is unique per counter value. */
export const revisionFor = (index: number): RevisionId => RevisionId.make(Str.padStart(64, "0")(index.toString(16)));

/** One base node of `path` whose text starts at `offset`. */
export const baseNodeOf = ({
  path,
  nodeId,
  revisionId,
  offset,
  text,
}: {
  readonly path: string;
  readonly nodeId: NodeId;
  readonly revisionId: RevisionId;
  readonly offset: number;
  readonly text: string;
}) =>
  BaseNode.make({
    nodeId,
    revisionId,
    anchor: OccurrenceAnchor.make({
      source: SourceTextIdentity.make({
        scopeRef: "agent-memory-store",
        sourceRef: "export",
        locator: PosixPath.make(path),
        sourceDigest: SourceTextDigest.make(`sha256:${emptyDigest}`),
        textDigest: SourceTextDigest.make(`sha256:${emptyDigest}`),
        extractor,
        normalizationVersion: "1",
      }),
      unit: "utf16",
      anchor: TextAnchor.make({ startChar: offset, endChar: offset + text.length, quote: text }),
    }),
  });

/** A base file whose nodes are exactly `texts`, in order. */
export const baseFileOfNodes = ({
  path,
  texts,
  mint,
  counter,
}: {
  readonly path: string;
  readonly texts: ReadonlyArray<string>;
  readonly mint: LazyArg<NodeId>;
  readonly counter: { value: number };
}): BaseFile => {
  const nodes: Array<BaseNode> = [];
  let offset = 0;
  for (const text of texts) {
    counter.value += 1;
    nodes.push(baseNodeOf({ path, nodeId: mint(), revisionId: revisionFor(counter.value), offset, text }));
    offset += text.length;
  }
  return BaseFile.make({ path: MemoryFilePath.make(path), fileDigest: emptyDigest, nodes });
};

/** A base whose files are the partitions of the given texts; node ids come from `seed`. */
export const seededBaseOf =
  (seed: number) =>
  (files: ReadonlyArray<readonly [string, string]>): BaseExport => {
    const mint = seededNodeIdMinter(seed);
    const counter = { value: 0 };
    return BaseExport.make({
      folderDigest: emptyDigest,
      files: A.map(files, ([path, text]) =>
        baseFileOfNodes({ path, texts: A.map(partition(text).nodes, (node) => node.text), mint, counter })
      ),
      cursor: LogCursor.make(0),
    });
  };

/** A base whose files are the partitions of the given texts, with seed 1. */
export const baseOf = seededBaseOf(1);

/** The operations of a captured batch; none when nothing changed. */
const operationsOf = (batch: O.Option<OperationBatch>): ReadonlyArray<NodeOperation> =>
  O.match(batch, { onNone: () => [], onSome: (value) => value.operations });

const roundTripOf = (base: BaseExport, edits: ReadonlyArray<FileEdit>) => {
  const captured = Result.getOrThrow(captureBatch(base, edits, author, seededNodeIdMinter(99)));
  const files = Result.getOrThrow(applyOperations(base, operationsOf(captured)));
  return { captured, operations: operationsOf(captured), files };
};

/** Captures `edits` against `base` with a seeded minter and applies the batch back. */
export const roundTrip: {
  (edits: ReadonlyArray<FileEdit>): (base: BaseExport) => ReturnType<typeof roundTripOf>;
  (base: BaseExport, edits: ReadonlyArray<FileEdit>): ReturnType<typeof roundTripOf>;
} = dual(2, roundTripOf);

/** The applied file at `path`. */
export const appliedAt: {
  (path: string): (files: ReadonlyArray<AppliedFile>) => AppliedFile;
  (files: ReadonlyArray<AppliedFile>, path: string): AppliedFile;
} = dual(
  2,
  (files: ReadonlyArray<AppliedFile>, path: string): AppliedFile =>
    O.getOrThrow(A.findFirst(files, (file) => file.path === path))
);

/** Operation count and the per-run lower bound of one file's capture. */
export interface CaptureCost {
  /** Nodes kept unchanged. */
  readonly kept: number;
  /** Sum over changed runs of max(base run, edited run): no capture can use fewer operations. */
  readonly lowerBound: number;
  /** Alignment steps that are no `Keep`: one per changed node pairing, insert or retire. */
  readonly operations: number;
  /** Changed runs whose base and edited sides have the same length. */
  readonly pairedRuns: number;
  /** Changed runs. */
  readonly runs: number;
}

const costOfAlignment = (nodes: ReadonlyArray<BaseNode>, editedText: string): CaptureCost => {
  let kept = 0;
  let lowerBound = 0;
  let operations = 0;
  let pairedRuns = 0;
  let runs = 0;
  let baseRun = 0;
  let editedRun = 0;
  const close = (): void => {
    if (baseRun + editedRun > 0) {
      runs += 1;
      lowerBound += Math.max(baseRun, editedRun);
      pairedRuns += baseRun === editedRun ? 1 : 0;
    }
    baseRun = 0;
    editedRun = 0;
  };
  for (const step of alignFile(nodes, editedText)) {
    if (step._tag === "Keep") {
      close();
      kept += 1;
      continue;
    }
    operations += 1;
    baseRun += step._tag === "Insert" ? 0 : 1;
    editedRun += step._tag === "Retire" ? 0 : 1;
  }
  close();
  return { kept, lowerBound, operations, pairedRuns, runs };
};

/** The cost of capturing `editedText` against `nodes`, from the alignment. */
export const costOf: {
  (editedText: string): (nodes: ReadonlyArray<BaseNode>) => CaptureCost;
  (nodes: ReadonlyArray<BaseNode>, editedText: string): CaptureCost;
} = dual(2, costOfAlignment);

/** Markdown-like pieces the generators insert and splice. */
const fragments: ReadonlyArray<string> = [
  "# Heading",
  "Setext\n===",
  "plain text",
  "- item",
  "  - nested",
  "1. ordered",
  "| a | b |",
  "|---|---|",
  "| 1 | 2 |",
  "```",
  "    code",
  "> quote",
  "---",
  "<div>",
  "Café ✓ 😀",
  "---\ntitle: x\n---",
  "﻿",
  "\t- tabbed",
];

/** Separators the generators put after a fragment. */
const separators: ReadonlyArray<string> = ["\n", "\n\n", "\r\n", "", " ", "\r\n\r\n"];

/** Short strings a raw character mutation splices in. */
const splices: ReadonlyArray<string> = ["", "\n", "\r\n", "\n\n", "- ", "|", "#", "x", "﻿", "`", " "];

const pick = <X>(random: LazyArg<number>, values: ReadonlyArray<X>): X =>
  A.getUnsafe(values, Math.floor(random() * values.length));

const at = (random: LazyArg<number>, length: number): number => Math.floor(random() * (length + 1));

// A cut inside a surrogate pair would leave a lone surrogate, which no file
// decoded from UTF-8 holds and `FileEdit` refuses; move such a cut past the pair.
const codePointBoundary = (text: string, index: number): number =>
  Str.slice(0, index)(text).isWellFormed() ? index : index + 1;

/** One generated piece of Markdown-like text. */
export const piece = (random: LazyArg<number>): string => `${pick(random, fragments)}${pick(random, separators)}`;

// One node-level edit: the node counts it applies to, and the edit itself,
// made in place on the node texts.
interface NodeEdit {
  readonly applies: (length: number) => boolean;
  readonly apply: (nodes: Array<string>, index: number, random: LazyArg<number>) => void;
}

// The node-level edits by choice: revise, insert, delete, move. Any other
// choice, or an edit the node count rules out, splices raw characters.
const nodeEdits: ReadonlyArray<NodeEdit> = [
  {
    applies: (length) => length > 0,
    apply: (nodes, index, random) => {
      nodes[index] = piece(random);
    },
  },
  {
    applies: () => true,
    apply: (nodes, _index, random) => {
      nodes.splice(at(random, nodes.length), 0, piece(random));
    },
  },
  {
    applies: (length) => length > 0,
    apply: (nodes, index) => {
      nodes.splice(index, 1);
    },
  },
  {
    applies: (length) => length > 1,
    apply: (nodes, index, random) => {
      const [moved = ""] = nodes.splice(index, 1);
      nodes.splice(at(random, nodes.length), 0, moved);
    },
  },
];

// A raw character splice over the joined node texts, crossing node boundaries.
const spliceCharacters = (nodes: ReadonlyArray<string>, random: LazyArg<number>): string => {
  const joined = A.join(nodes, "");
  const start = codePointBoundary(joined, at(random, joined.length));
  const end = codePointBoundary(joined, Math.min(joined.length, start + Math.floor(random() * 4)));
  return `${Str.slice(0, start)(joined)}${pick(random, splices)}${Str.slice(end)(joined)}`;
};

// One random edit of `current`.
const mutateOnce = (current: string, random: LazyArg<number>): string => {
  const nodes: Array<string> = A.map(partition(current).nodes, (node) => node.text);
  const choice = Math.floor(random() * 5);
  const index = Math.floor(random() * nodes.length);
  return O.match(
    O.filter(A.get(nodeEdits, choice), (edit) => edit.applies(nodes.length)),
    {
      onNone: () => spliceCharacters(nodes, random),
      onSome: (edit) => {
        edit.apply(nodes, index, random);
        return A.join(nodes, "");
      },
    }
  );
};

/**
 * Applies `count` random edits to `text`: node revisions, inserts, deletions
 * and moves on its partition, and raw character splices that cross node
 * boundaries.
 */
export const mutate = ({
  text,
  random,
  count,
}: {
  readonly text: string;
  readonly random: LazyArg<number>;
  readonly count: number;
}): string => {
  let current = text;
  for (let round = 0; round < count; round += 1) {
    current = mutateOnce(current, random);
  }
  return current;
};
