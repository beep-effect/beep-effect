/**
 * Op capture invariant: for every base and every edited text, applying the
 * captured batch to the base node list yields exactly the edited bytes, and
 * the resulting node list is the partition of the edited text.
 *
 * Inputs: generated Markdown-like text under seeded node-level and raw
 * character-level edits, arbitrary strings, and the frozen goals Markdown
 * sample (`fixtures/goals-markdown-sample.json.gz`) under the same seeded
 * edits. The agent-memory-store-p2 lane wrote the generators and is their
 * only labeller. Set `BEEP_TEST_AGENT_MEMORY_REPORT` to a file path to append
 * the measured operation counts there; the tests assert them either way.
 */
import { captureBatch, FileEdit, isWellFormedText, partition, seededNodeIdMinter } from "@beep/agent-memory-store";
import { describe, expect, it } from "@effect/vitest";
import { deepStrictEqual } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { loadGoalsMarkdownSample } from "./fixtures/goals-markdown-sample.ts";
import {
  appliedAt,
  author,
  baseOf,
  costOf,
  mutate,
  piece,
  roundTrip,
  seededRandom,
} from "./OperationCapture.support.ts";
import { report, TestPlatform } from "./projector-support.ts";
import type { CaptureCost } from "./OperationCapture.support.ts";

const path = "notes/generated.md";

const Seed = S.Int.check(S.isBetween({ minimum: 0, maximum: 2_147_483_647 }));

// `FileEdit` refuses a lone surrogate, which no file decoded from UTF-8 holds.
const WellFormedText = S.String.check(isWellFormedText);

// Checks the invariant for one base text and one edited text.
const assertCaptures = (filePath: string, baseText: string, editedText: string): void => {
  const base = baseOf([[filePath, baseText]]);
  const { files } = roundTrip(base, [FileEdit.cases.edited.make({ path: filePath, text: editedText })]);
  const file = appliedAt(files, filePath);
  expect(file.text).toBe(editedText);
  deepStrictEqual(
    A.map(file.nodes, (node) => node.text),
    A.map(partition(editedText).nodes, (node) => node.text)
  );
};

// A base text and an edited text drawn from one seed.
const generated = (seed: number): readonly [string, string] => {
  const random = seededRandom(seed);
  const baseText = A.join(
    A.makeBy(Math.floor(random() * 30), () => piece(random)),
    ""
  );
  return [baseText, mutate({ text: baseText, random, count: 1 + Math.floor(random() * 6) })];
};

describe("op capture invariant", () => {
  it.prop(
    "reproduces Markdown-like text under node-level and character-level edits",
    [Arbitrary.schema(Seed)],
    ([seed]) => {
      const [baseText, editedText] = generated(seed);
      assertCaptures(path, baseText, editedText);
    },
    { arbitrary: { runs: 400 } }
  );

  it.prop(
    "reproduces arbitrary strings, unrelated or not",
    [Arbitrary.schema(WellFormedText), Arbitrary.schema(WellFormedText)],
    ([baseText, editedText]) => {
      assertCaptures(path, baseText, editedText);
      assertCaptures(path, baseText, `${baseText}${editedText}`);
    },
    { arbitrary: { runs: 200 } }
  );

  it.prop(
    "is deterministic for a seeded minter",
    [Arbitrary.schema(Seed)],
    ([seed]) => {
      const [baseText, editedText] = generated(seed);
      const base = baseOf([[path, baseText]]);
      const edits = [FileEdit.cases.edited.make({ path, text: editedText })];
      deepStrictEqual(
        captureBatch(base, edits, author, seededNodeIdMinter(seed)),
        captureBatch(base, edits, author, seededNodeIdMinter(seed))
      );
    },
    { arbitrary: { runs: 50 } }
  );
});

const addCost = (total: CaptureCost, cost: CaptureCost): CaptureCost => ({
  kept: total.kept + cost.kept,
  lowerBound: total.lowerBound + cost.lowerBound,
  operations: total.operations + cost.operations,
  pairedRuns: total.pairedRuns + cost.pairedRuns,
  runs: total.runs + cost.runs,
});

const zero: CaptureCost = { kept: 0, lowerBound: 0, operations: 0, pairedRuns: 0, runs: 0 };

describe("op capture on the goals Markdown sample", () => {
  it.layer(TestPlatform)("goals Markdown sample", (it) => {
    it.effect(
      "reproduces every seeded edit of every sample file with a near-minimal batch",
      Effect.fnUntraced(function* () {
        const sample = yield* loadGoalsMarkdownSample;
        const random = seededRandom(20261112);
        let edits = 0;
        let total = zero;
        for (const file of sample.files) {
          for (let round = 0; round < 3; round += 1) {
            const editedText = mutate({ text: file.text, random, count: 1 + round });
            assertCaptures(file.path, file.text, editedText);
            const [base] = baseOf([[file.path, file.text]]).files;
            total = addCost(total, costOf(base?.nodes ?? [], editedText));
            edits += 1;
          }
        }
        yield* report(
          `op capture goals sample: edits=${edits} operations=${total.operations} lowerBound=${total.lowerBound} ` +
            `ratio=${(total.operations / total.lowerBound).toFixed(4)} runs=${total.runs} pairedRuns=${total.pairedRuns} kept=${total.kept}`
        );
        expect(edits).toBe(sample.files.length * 3);
        // Every operation touches at most one base and one edited node, so the
        // lower bound is the floor; unpaired runs cost at most twice it.
        expect(total.operations).toBeGreaterThanOrEqual(total.lowerBound);
        expect(total.operations).toBeLessThanOrEqual(2 * total.lowerBound);
      })
    );
  });
});
