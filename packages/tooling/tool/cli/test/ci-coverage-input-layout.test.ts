import { it } from "@beep/test-runner";
import { assert, describe } from "@effect/vitest";
import { assertSome, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { parseWorkflowYaml, yamlAt } from "./support/WorkflowYaml.ts";

// Heavy / Coverage Regression downloads every `unit-coverage-<run>-*` artifact with
// actions/download-artifact v8.0.2, which extracts each artifact into its own named directory only when
// two or more match. A lone match (Labs alone, on a diff that plans no Test Unit shard) is extracted
// straight into the path. These cases run the checked-in normalisation step and the comparison's Labs
// manifest check over each layout in a scratch directory, with the real bash, jq and coreutils.

const checkWorkflowText = import.meta.glob<string>("../../../../../.github/workflows/check.yml", {
  eager: true,
  import: "default",
  query: "?raw",
});
const INPUTS = ".beep/ci-coverage-inputs";
const RUN = "123";
const CURRENT_ATTEMPT = 2;
const LANE_GATED = "steps.lane-gate.outputs.should_run == 'true'";
const DOWNLOAD_STEP = "Download coverage evidence";
const NORMALIZE_STEP = "Normalize coverage evidence layout";
const COMPARE_STEP = "Compare coverage evidence";
const LABS_CHECK = '.partitionId == "labs" and .identity.runId == $run and .identity.runAttempt == $attempt';

const isText = S.is(S.String);
const isStepList = S.is(S.Array(S.Unknown));
const encodeJson = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));

const coverageSteps = (): ReadonlyArray<unknown> => {
  const steps = pipe(
    R.values(checkWorkflowText),
    A.head,
    O.getOrThrow,
    parseWorkflowYaml,
    yamlAt(["jobs", "coverage-regression", "steps"])
  );
  assertTrue(isStepList(steps));
  return steps;
};
const isStepNamed =
  (name: string) =>
  (step: unknown): boolean =>
    yamlAt(step, ["name"]) === name;
const stepScript = (steps: ReadonlyArray<unknown>, name: string): string =>
  pipe(A.findFirst(steps, isStepNamed(name)), O.map(yamlAt(["run"])), O.filter(isText), O.getOrThrow);

// The comparison's own manifest check: everything it runs before the coverage command itself.
const labsCheck = (steps: ReadonlyArray<unknown>): string =>
  pipe(stepScript(steps, COMPARE_STEP), Str.split("shape_args="), A.head, O.getOrThrow);

// The fields of a producer manifest the two scripts read; the comparison command validates the rest.
const manifest = (partitionId: string, runId: string, runAttempt: number) => ({
  schemaVersion: "coverage-producer/v1",
  partitionId,
  identity: { runId, runAttempt },
  packages: [],
});

// `accepted`: both scripts pass. `refused`: the normalisation step fails. `rejected`: the layout is
// normalised, or left alone, and the Labs manifest check fails.
type Verdict = "accepted" | "refused" | "rejected";
type Layout = {
  readonly name: string;
  // What the download left under the input directory: a manifest, or raw text.
  readonly files: ReadonlyArray<readonly [path: string, content: unknown]>;
  readonly producerAttempt: number;
  readonly verdict: Verdict;
  // Every file under the input directory once the scripts ran, sorted bytewise.
  readonly after: ReadonlyArray<string>;
};

const labs = (attempt: number) => `unit-coverage-${RUN}-${attempt}-labs`;

const LAYOUTS: ReadonlyArray<Layout> = [
  {
    name: "one artifact extracted flat, the failing case",
    files: [
      ["manifest.json", manifest("labs", RUN, 2)],
      ["packages/foo/coverage-final.json", "{}"],
      [".coverage-meta", "hidden"],
    ],
    producerAttempt: 2,
    verdict: "accepted",
    after: [`${labs(2)}/.coverage-meta`, `${labs(2)}/manifest.json`, `${labs(2)}/packages/foo/coverage-final.json`],
  },
  {
    name: "one Labs artifact carried from the first attempt, extracted flat",
    files: [["manifest.json", manifest("labs", RUN, 1)]],
    producerAttempt: 1,
    verdict: "accepted",
    after: [`${labs(1)}/manifest.json`],
  },
  {
    name: "two artifacts in their own directories",
    files: [
      [`${labs(2)}/manifest.json`, manifest("labs", RUN, 2)],
      [`unit-coverage-${RUN}-2-unit-a/manifest.json`, manifest("unit-a", RUN, 2)],
    ],
    producerAttempt: 2,
    verdict: "accepted",
    after: [`${labs(2)}/manifest.json`, `unit-coverage-${RUN}-2-unit-a/manifest.json`],
  },
  {
    name: "three artifacts across two attempts in their own directories",
    files: [
      [`${labs(1)}/manifest.json`, manifest("labs", RUN, 1)],
      [`${labs(2)}/manifest.json`, manifest("labs", RUN, 2)],
      [`unit-coverage-${RUN}-2-repo-cli-1/manifest.json`, manifest("repo-cli-1", RUN, 2)],
    ],
    producerAttempt: 2,
    verdict: "accepted",
    after: [`${labs(1)}/manifest.json`, `${labs(2)}/manifest.json`, `unit-coverage-${RUN}-2-repo-cli-1/manifest.json`],
  },
  {
    name: "several artifacts without the producer attempt's Labs",
    files: [
      [`${labs(1)}/manifest.json`, manifest("labs", RUN, 1)],
      [`unit-coverage-${RUN}-2-unit-a/manifest.json`, manifest("unit-a", RUN, 2)],
    ],
    producerAttempt: 2,
    verdict: "rejected",
    after: [`${labs(1)}/manifest.json`, `unit-coverage-${RUN}-2-unit-a/manifest.json`],
  },
  {
    name: "one flat manifest from another run",
    files: [["manifest.json", manifest("labs", "456", 2)]],
    producerAttempt: 2,
    verdict: "refused",
    after: ["manifest.json"],
  },
  {
    name: "one flat manifest whose run id is not a string",
    files: [["manifest.json", { ...manifest("labs", RUN, 2), identity: { runId: 123, runAttempt: 2 } }]],
    producerAttempt: 2,
    verdict: "refused",
    after: ["manifest.json"],
  },
  {
    name: "one flat Test Unit shard and no Labs artifact",
    files: [["manifest.json", manifest("unit-a", RUN, 2)]],
    producerAttempt: 2,
    verdict: "rejected",
    after: [`unit-coverage-${RUN}-2-unit-a/manifest.json`],
  },
  {
    name: "one flat Labs manifest older than the producer attempt",
    files: [["manifest.json", manifest("labs", RUN, 1)]],
    producerAttempt: 2,
    verdict: "rejected",
    after: [`${labs(1)}/manifest.json`],
  },
  {
    name: "one flat manifest naming an attempt not yet started",
    files: [["manifest.json", manifest("labs", RUN, CURRENT_ATTEMPT + 1)]],
    producerAttempt: 2,
    verdict: "refused",
    after: ["manifest.json"],
  },
  {
    name: "one flat manifest whose partition leaves the input directory",
    files: [["manifest.json", manifest("../labs", RUN, 2)]],
    producerAttempt: 2,
    verdict: "refused",
    after: ["manifest.json"],
  },
  {
    name: "one flat manifest that is not JSON",
    files: [["manifest.json", "not json"]],
    producerAttempt: 2,
    verdict: "refused",
    after: ["manifest.json"],
  },
  {
    name: "a root manifest beside an artifact directory",
    files: [
      ["manifest.json", manifest("labs", RUN, 2)],
      [`unit-coverage-${RUN}-2-unit-a/manifest.json`, manifest("unit-a", RUN, 2)],
    ],
    producerAttempt: 2,
    verdict: "refused",
    after: ["manifest.json", `unit-coverage-${RUN}-2-unit-a/manifest.json`],
  },
  {
    name: "no artifact at all",
    files: [],
    producerAttempt: 2,
    verdict: "rejected",
    after: [],
  },
];

// Writes the layout read from stdin (NUL-separated path and content pairs) into a scratch directory, runs
// the normalisation and then the Labs check there, prints the verdict and lists what the input holds. The
// listing strips find's leading `./` instead of using GNU find's `-printf`, so it also runs on BSD find.
const HARNESS = `set -uo pipefail
work="$(mktemp -d)"
trap 'rm -rf -- "$work"' EXIT
cd "$work"
while IFS= read -r -d '' file && IFS= read -r -d '' content; do
  mkdir -p -- "$(dirname -- "${INPUTS}/$file")"
  printf '%s' "$content" > "${INPUTS}/$file"
done
if ! bash -c "$NORMALIZE_SCRIPT" > /dev/null 2>&1; then
  echo refused
elif ! bash -c "$LABS_CHECK_SCRIPT" > /dev/null 2>&1; then
  echo rejected
else
  echo accepted
fi
if [[ -d ${INPUTS} ]]; then
  (cd ${INPUTS} && find . -type f) | cut -c3- | LC_ALL=C sort
fi
`;

const fileContent = (content: unknown) => (isText(content) ? Effect.succeed(content) : encodeJson(content));

describe("Coverage Regression evidence layout", () => {
  it("normalises the downloaded layout between the download and the comparison, under the lane gate", () => {
    const steps = coverageSteps();
    const positions = A.map([DOWNLOAD_STEP, NORMALIZE_STEP, COMPARE_STEP], (name) =>
      pipe(A.findFirstIndex(steps, isStepNamed(name)), O.getOrThrow)
    );
    const ordered = A.sort(positions, Order.Number);
    assert.deepStrictEqual(positions, ordered);
    const normalize = pipe(A.findFirst(steps, isStepNamed(NORMALIZE_STEP)), O.getOrThrow);
    assert.strictEqual(yamlAt(normalize, ["if"]), LANE_GATED);
    assert.strictEqual(yamlAt(normalize, ["shell"]), "bash");
    const download = pipe(A.findFirst(steps, isStepNamed(DOWNLOAD_STEP)), O.getOrThrow);
    assert.deepStrictEqual(yamlAt(download, ["with"]), {
      pattern: "unit-coverage-${{ github.run_id }}-*",
      path: INPUTS,
      "merge-multiple": false,
    });
    const check = labsCheck(steps);
    assertTrue(Str.includes(LABS_CHECK)(check));
  });

  for (const layout of LAYOUTS) {
    it.effect(
      `reads ${layout.name}: ${layout.verdict}`,
      Effect.fnUntraced(function* () {
        const steps = coverageSteps();
        const ambientPath = yield* Config.String("PATH");
        const contents = yield* Effect.forEach(layout.files, ([, content]) => fileContent(content));
        const stdin = pipe(
          A.zip(layout.files, contents),
          A.flatMap(([file, content]) => [`${file[0]}\0`, `${content}\0`]),
          A.join("")
        );
        const ran = Bun.spawnSync(["bash", "-c", HARNESS], {
          env: {
            PATH: ambientPath,
            GITHUB_RUN_ID: RUN,
            GITHUB_RUN_ATTEMPT: `${CURRENT_ATTEMPT}`,
            LABS_PRODUCER_ATTEMPT: `${layout.producerAttempt}`,
            NORMALIZE_SCRIPT: stepScript(steps, NORMALIZE_STEP),
            LABS_CHECK_SCRIPT: labsCheck(steps),
          },
          stdin: new TextEncoder().encode(stdin),
          stdout: "pipe",
          stderr: "pipe",
        });
        const stderr = ran.stderr.toString();
        assert.strictEqual(ran.exitCode, 0, stderr);
        const lines = pipe(ran.stdout.toString(), Str.split("\n"), A.filter(Str.isNonEmpty));
        const verdict = A.head(lines);
        assertSome(verdict, layout.verdict);
        const after = A.drop(lines, 1);
        assert.deepStrictEqual(after, layout.after);
      })
    );
  }
});
