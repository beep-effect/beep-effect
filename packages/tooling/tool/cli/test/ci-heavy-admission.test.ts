import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import { fcRuns } from "@beep/fc-runs";
import { Git, GitCommandError, UnknownRefError } from "@beep/git/Git";
import { ActionEnvironment } from "@beep/github-actions/ActionEnvironment";
import { ActionOutputs } from "@beep/github-actions/ActionOutputs";
import {
  ChangeClassifier,
  CiAdmissionInput,
  ciAdmissionCommand,
  ciOperationalPatterns,
  decideHeavyAdmission,
  decideHeavyLaneSkips,
  HEAVY_ADMISSION_LABEL,
  HEAVY_LANE_IDS,
  HeavyAdmission,
  HeavyAdmissionEvent,
  HeavyAdmissionJson,
  HeavyAdmissionReadInput,
  heavyAdmissionGithubOutputs,
  heavyAdmissionSchemasForTesting,
  heavyDocgenRelevantPattern,
  heavyDocsOnlyPattern,
  isHeavyDocsOnlyPath,
  RouteError,
  readHeavyAdmissionEvent,
  readHeavyAdmissionRoute,
  readHeavyLaneSkips,
  renderHeavyAdmissionSummary,
  runCiAdmission,
} from "@beep/repo-cli/commands/Ci";
import { ChangedPathEntry, ClassifyDiff, classifyChangedPaths } from "@beep/repo-cli/commands/Ci/RouteClassify";
import { provideScopedLayer } from "@beep/test-utils/Layer";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { identity } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as TestClock from "effect/testing/TestClock";
import * as TestConsole from "effect/testing/TestConsole";
import { parseRunnerFile } from "./support/runnerFile.ts";
import { provideSpawner } from "./support/ScriptedProcess.ts";

const code = ["packages/a/src/index.ts"];
const docs = ["docs/runbooks/ci.md", "goals/x/PLAN.md"];
const event = (values: Partial<HeavyAdmissionEvent> = {}) =>
  HeavyAdmissionEvent.make({ eventName: "pull_request", labels: [], draft: false, changedPaths: code, ...values });
const UnknownJson = S.fromJsonString(S.Unknown);
const payload = (labels: ReadonlyArray<string>, draft = false, base = "main") =>
  Result.getOrThrowWith(
    S.encodeUnknownResult(UnknownJson)({
      action: "synchronize",
      number: 1,
      pull_request: {
        draft,
        labels: A.map(labels, (name) => ({ name, color: "ededed" })),
        head: { repo: { full_name: "beep-effect/beep-effect" } },
        base: { ref: base, repo: { full_name: "beep-effect/beep-effect" } },
      },
    }),
    identity
  );
// The scripted git: fetch succeeds silently, diff prints the scripted paths NUL-delimited, as `git diff -z` does.
const gitSpawner = (paths: ReadonlyArray<string>) =>
  ScriptedSpawner.make((_command, args) => ({
    stdout: args[0] === "diff" ? A.join(A.map(paths, nulTerminated), "") : "",
  }));
const nulTerminated = (path: string): string => `${path}\0`;
// The fetch and the diff, without the kit's own `config --get` probes ahead of a network call.
const gitWork = (spawner: ScriptedSpawner) => A.filter(spawner.spawns, (spawn) => spawn.args[0] !== "config");
// `Git` over the scripted spawner, which also serves the patient fetch instance.
const provideScriptedGit =
  (spawner: ScriptedSpawner) =>
  <V, E, R>(effect: Effect.Effect<V, E, R>) =>
    effect.pipe(provideScopedLayer(Git.layer), provideSpawner(spawner));
// A `Git` whose `changedFiles` fails as given; the patient fetch still runs over a silent scripted spawner.
const provideFailingDiff =
  (error: GitCommandError | UnknownRefError) =>
  <V, E, R>(effect: Effect.Effect<V, E, R>) =>
    effect.pipe(
      provideScopedLayer(Git.layerTest({ changedFiles: () => Effect.fail(error) })),
      provideSpawner(gitSpawner([]))
    );
const platform = Layer.mergeAll(
  NodeServices.layer,
  NodeCrypto.layer,
  TestConsole.layer,
  Layer.succeed(
    ChangeClassifier,
    ChangeClassifier.of({
      classify: Effect.fn("ChangeClassifier.classify")(() =>
        Effect.fail(RouteError.new("classify", "Fixture classifier is unavailable."))
      ),
    })
  )
);
const lastLine = (lines: ReadonlyArray<string>): string => O.getOrElse(A.last(lines), () => "");
const runAdmissionCommand = Command.runWith(ciAdmissionCommand, { version: "0.0.0" });
const temporary = Effect.fn("admissionTest.temporary")(function* <V, E, R>(
  use: (root: string) => Effect.Effect<V, E, R>
) {
  const fs = yield* FileSystem.FileSystem;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "ci-admission-" });
  return yield* use(root);
});
const writeEvent = Effect.fn("admissionTest.writeEvent")(function* (root: string, content: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = `${root}/event.json`;
  yield* fs.writeFileString(path, content);
  return path;
});
const logs = TestConsole.logLines.pipe(Effect.map(A.map(String)));
const errors = TestConsole.errorLines.pipe(Effect.map(A.map(String)), Effect.map(A.join("\n")));
// Current Effect v4 exposes Arbitrary.schema, replacing the brief's S.toArbitrary.
const roundTrips = Effect.fn("admissionTest.roundTrips")(function* <Schema extends S.Constraint>(schema: Schema) {
  const values = yield* Arbitrary.sampleEffect(Arbitrary.schema(schema), { count: 24, seed: 7 });
  yield* Effect.forEach(
    values,
    Effect.fnUntraced(function* (value) {
      const encoded = yield* S.encodeEffect(schema)(value);
      const decoded = yield* S.decodeUnknownEffect(schema)(encoded);
      const value1 = yield* S.encodeEffect(schema)(decoded);
      expect(value1).toEqual(encoded);
    })
  );
});

describe("B8 heavy admission contracts", () => {
  for (const [name, schema] of R.toEntries({ ...heavyAdmissionSchemasForTesting, CiAdmissionInput })) {
    it.effect(`generated ${name} round-trips`, () => roundTrips(schema));
  }

  it("decides every (event, label, draft, docs-only) row", () => {
    const rows: ReadonlyArray<
      readonly [
        HeavyAdmissionEvent["eventName"],
        boolean,
        boolean,
        boolean,
        HeavyAdmission["verdict"],
        ReadonlyArray<HeavyAdmission["sources"][number]>,
      ]
    > = [
      ["pull_request", false, false, false, "hold", []],
      ["pull_request", false, false, true, "skip-satisfied", []],
      ["pull_request", false, true, false, "hold", []],
      ["pull_request", false, true, true, "skip-satisfied", []],
      ["pull_request", true, false, false, "run", ["label"]],
      ["pull_request", true, false, true, "run", ["label"]],
      ["pull_request", true, true, false, "run", ["label"]],
      ["pull_request", true, true, true, "run", ["label"]],
      ["push", false, false, false, "run", ["main-push"]],
      ["push", true, true, true, "run", ["main-push"]],
      ["merge_group", false, false, false, "run", ["merge-group"]],
      ["merge_group", true, true, true, "run", ["merge-group"]],
    ];
    for (const [eventName, labelled, draft, docsOnly, verdict, sources] of rows) {
      const decided = decideHeavyAdmission(
        event({
          eventName,
          labels: labelled ? [HEAVY_ADMISSION_LABEL, "size/M"] : ["size/M"],
          draft,
          changedPaths: docsOnly ? docs : code,
        })
      );
      expect(decided.verdict, `${eventName} label=${labelled} draft=${draft} docs=${docsOnly}`).toBe(verdict);
      expect(decided.sources).toEqual(sources);
      expect(decided.admitted).toBe(verdict === "run");
      expect(decided.docsOnly).toBe(eventName === "pull_request" && docsOnly);
      expect(decided.changedPathCount).toBe(docsOnly ? 2 : 1);
    }
    // An empty pull-request diff is never docs-only: nothing proves it harmless.
    expect(decideHeavyAdmission(event({ changedPaths: [] })).verdict).toBe("hold");
    expect(decideHeavyAdmission(event({ changedPaths: [...docs, ...code] })).verdict).toBe("hold");
  });

  it.prop(
    "every generated event yields a coherent admission",
    { event: Arbitrary.schema(HeavyAdmissionEvent) },
    ({ event }) => {
      const decided = decideHeavyAdmission(event);
      const labelled = event.eventName === "pull_request" && A.contains(event.labels, HEAVY_ADMISSION_LABEL);
      const admitted = event.eventName !== "pull_request" || labelled;
      expect(decided.admitted).toBe(decided.verdict === "run");
      expect(decided.admitted).toBe(admitted);
      expect(A.isReadonlyArrayNonEmpty(decided.sources)).toBe(admitted);
      expect(decided.docsOnly).toBe(
        event.eventName === "pull_request" &&
          A.isReadonlyArrayNonEmpty(event.changedPaths) &&
          A.every(event.changedPaths, isHeavyDocsOnlyPath)
      );
      expect(decided.verdict === "skip-satisfied").toBe(!admitted && decided.docsOnly);
      expect(decided.verdict === "hold").toBe(!admitted && !decided.docsOnly);
      expect(decided.changedPathCount).toBe(A.length(event.changedPaths));
    },
    { arbitrary: fcRuns(60) }
  );

  it("classifies the complete PR 2750 packet diff as docs-only but retains mixed-code work", () => {
    const changedPaths = [
      "explorations/research-library-ontology/BRIEF.md",
      "explorations/research-library-ontology/CAPTURE.md",
      "explorations/research-library-ontology/DECISIONS.md",
      "explorations/research-library-ontology/MAP.md",
      "explorations/research-library-ontology/README.md",
      "explorations/research-library-ontology/RESEARCH.md",
      "explorations/research-library-ontology/assets/.gitkeep",
      "explorations/research-library-ontology/ops/manifest.json",
      "explorations/research-library-ontology/research/SOURCES.md",
      "goals/research-intake-2026-11/GOAL.md",
      "goals/research-intake-2026-11/PLAN.md",
      "goals/research-intake-2026-11/README.md",
      "goals/research-intake-2026-11/SPEC.md",
      "goals/research-intake-2026-11/decisions/2026-11-06-box-ip-law-ontology-research-gets-its-own-intake-with-t1-triage-only.md",
      "goals/research-intake-2026-11/decisions/2026-11-06-box-is-the-authoritative-nightly-series-near-duplicates-are-versions-of-one-identity.md",
      "goals/research-intake-2026-11/decisions/2026-11-06-mining-tiers-and-pools.md",
      "goals/research-intake-2026-11/decisions/2026-11-06-the-private-dm-archive-enters-the-library-under-a-private-access-class.md",
      "goals/research-intake-2026-11/history/.gitkeep",
      "goals/research-intake-2026-11/history/reflections/.gitkeep",
      "goals/research-intake-2026-11/ops/manifest.json",
      "goals/research-intake-2026-11/research/.gitkeep",
      "goals/research-intake-2026-11/research/SOURCES.md",
      "goals/research-library-ontology-core/GOAL.md",
      "goals/research-library-ontology-core/PLAN.md",
      "goals/research-library-ontology-core/README.md",
      "goals/research-library-ontology-core/SPEC.md",
      "goals/research-library-ontology-core/decisions/2026-11-06-dispositions-are-capture-phases-and-hop-depth-is-an-edge-property.md",
      "goals/research-library-ontology-core/decisions/2026-11-06-effect-s-class-is-the-ontology-source-turtle-and-shacl-are-generated.md",
      "goals/research-library-ontology-core/decisions/2026-11-06-library-models-stay-in-tooling-epistemic-promotion-is-gated.md",
      "goals/research-library-ontology-core/history/.gitkeep",
      "goals/research-library-ontology-core/history/reflections/.gitkeep",
      "goals/research-library-ontology-core/ops/manifest.json",
      "goals/research-library-ontology-core/research/.gitkeep",
      "goals/research-library-ontology-core/research/SOURCES.md",
      "goals/research-library-routes/GOAL.md",
      "goals/research-library-routes/PLAN.md",
      "goals/research-library-routes/README.md",
      "goals/research-library-routes/SPEC.md",
      "goals/research-library-routes/decisions/2026-11-06-hop-2-admission-is-a-routed-finding-gate-with-domain-caps.md",
      "goals/research-library-routes/decisions/2026-11-06-vidbee-and-alphaxiv-are-import-result-methods-box-is-a-native-route-on-beep-box.md",
      "goals/research-library-routes/decisions/2026-11-06-web-acquisition-runs-through-a-new-beep-firecrawl-driver.md",
      "goals/research-library-routes/history/.gitkeep",
      "goals/research-library-routes/history/reflections/.gitkeep",
      "goals/research-library-routes/ops/manifest.json",
      "goals/research-library-routes/research/.gitkeep",
      "goals/research-library-routes/research/SOURCES.md",
    ];
    expect(decideHeavyAdmission(event({ changedPaths }))).toMatchObject({ docsOnly: true, verdict: "skip-satisfied" });
    for (const executable of ["packages/a/src/index.ts"]) {
      expect(decideHeavyAdmission(event({ changedPaths: [...changedPaths, executable] })).docsOnly).toBe(false);
    }
  });

  it("routes the complete PR 2993 goal packet without product verification", () => {
    const changedPaths = [
      "docs/ROADMAP.md",
      "goals/attributed-multi-claim-span/README.md",
      "goals/attributed-multi-claim-span/ops/manifest.json",
      "goals/text-knowledge-stack-rebuild/GOAL.md",
      "goals/text-knowledge-stack-rebuild/PLAN.md",
      "goals/text-knowledge-stack-rebuild/README.md",
      "goals/text-knowledge-stack-rebuild/SPEC.md",
      "goals/text-knowledge-stack-rebuild/decisions/2026-11-08-program-shape-one-packet-design-first-layers-bottom-up-folds-by-census.md",
      "goals/text-knowledge-stack-rebuild/decisions/2026-11-09-breaking-changes-accepted-the-best-core-outranks-compatibility.md",
      "goals/text-knowledge-stack-rebuild/decisions/2026-11-09-open-questions-1-5-resolved-toward-the-clean-core-p0-confirms-or-reverses.md",
      "goals/text-knowledge-stack-rebuild/history/.gitkeep",
      "goals/text-knowledge-stack-rebuild/history/reflections/.gitkeep",
      "goals/text-knowledge-stack-rebuild/ops/manifest.json",
      "goals/text-knowledge-stack-rebuild/research/.gitkeep",
      "goals/text-knowledge-stack-rebuild/research/2026-11-08-critic-1-theory.md",
      "goals/text-knowledge-stack-rebuild/research/2026-11-08-critic-2-doctrine.md",
      "goals/text-knowledge-stack-rebuild/research/2026-11-08-critic-3-product.md",
      "goals/text-knowledge-stack-rebuild/research/2026-11-08-reader-a-law-practice.md",
      "goals/text-knowledge-stack-rebuild/research/2026-11-08-reader-b-modeling-audit.md",
      "goals/text-knowledge-stack-rebuild/research/2026-11-08-reader-c-agent-surfaces.md",
      "goals/text-knowledge-stack-rebuild/research/2026-11-08-reader-d-standards-vision.md",
      "goals/text-knowledge-stack-rebuild/research/2026-11-08-rebuild-report.md",
      "goals/text-knowledge-stack-rebuild/research/OPPORTUNITIES.md",
      "goals/text-knowledge-stack-rebuild/research/SOURCES.md",
      "goals/text-knowledge-stack-rebuild/research/figures/anchored-annotation.dot",
      "goals/text-knowledge-stack-rebuild/research/figures/anchored-annotation.svg",
      "goals/text-knowledge-stack-rebuild/research/figures/boundary-worlds.dot",
      "goals/text-knowledge-stack-rebuild/research/figures/boundary-worlds.svg",
      "goals/text-knowledge-stack-rebuild/research/figures/stack-layers.dot",
      "goals/text-knowledge-stack-rebuild/research/figures/stack-layers.svg",
      "goals/text-knowledge-stack-rebuild/research/law-test-plan.md",
    ];
    expect(decideHeavyAdmission(event({ changedPaths }))).toMatchObject({
      docsOnly: true,
      verdict: "skip-satisfied",
    });
    for (const input of [
      "packages/a/src/index.ts",
      ".github/workflows/check.yml",
      "standards/schema-first.inventory.jsonc",
    ]) {
      expect(decideHeavyAdmission(event({ changedPaths: [...changedPaths, input] })).docsOnly).toBe(false);
    }
  });

  it("classifies docs-only paths by the widened goals_document_pattern", () => {
    const rows: ReadonlyArray<readonly [string, boolean]> = [
      ["goals/INDEX.md", true],
      ["goals/README.md", true],
      ["goals/knowledge-doctor.baseline.jsonc", false],
      ["goals/knowledge-doctor.leases.jsonc", false],
      ["goals/knowledge-doctor.promotions.jsonc", false],
      ["goals/goals-doctor.baseline.jsonc", false],
      ["goals/tsconfig.ops.json", false],
      ["goals/time-to-certainty/GOAL.md", true],
      ["goals/time-to-certainty/PLAN.md", true],
      ["goals/time-to-certainty/README.md", true],
      ["goals/time-to-certainty/SPEC.md", true],
      ["goals/time-to-certainty/DECISIONS.md", true],
      ["goals/time-to-certainty/ops/manifest.json", true],
      ["goals/time-to-certainty/research/b8-brief.md", true],
      ["goals/x/history/.gitkeep", true],
      ["goals/x/history/reflections/.gitkeep", true],
      ["goals/x/research/.gitkeep", true],
      ["goals/x/ops/.gitkeep", true],
      ["goals/x/scripts/.gitkeep", true],
      ["goals/x/research/.gitkeep.sh", true],
      ["goals/x/research/figures/diagram.dot", true],
      ["goals/x/research/figures/diagram.svg", true],
      ["goals/x/decisions/assets/diagram.png", true],
      ["goals/x/designs/diagram.mermaid", true],
      ["goals/x/research/reference.pdf", true],
      // Code-shaped files stay on the code route inside a docs root: SAST scans JavaScript and
      // TypeScript, dependency review reads manifests, and repo-wide globs read tool configuration.
      ["goals/x/research/diagram.svg.ts", false],
      ["explorations/x/assets/build.mjs", false],
      ["research/x/probe.cts", false],
      ["goals/x/package.json", false],
      ["docs/examples/bun.lock", false],
      ["research/x/requirements.txt", false],
      ["goals/x/research/.gitignore", false],
      ["explorations/x/docgen.json", false],
      ["goals/x/biome.jsonc", false],
      ["goals/x/research/verify.sh", true],
      ["goals/x/research/tool.py", true],
      ["goals/x/research/tool", true],
      ["goals/x/research/figures/tsconfig.json", false],
      ["goals/x/research/fixtures/input.svg", true],
      ["goals/x/scripts/input.svg", true],
      ["goals/x/ops/input.svg", true],
      ["goals/x/research/fixture.json", true],
      ["goals/x/scripts/run.sh", true],
      ["goals/x/ops/fixtures.json", true],
      ["goals/x/ops/manifest.json.bak", true],
      // Goal-data consumer rows (ROUT-03): tests read, spawn or import these, so they keep verification.
      ["goals/citation-extraction-engine/ops/probe-html-bytes.py", false],
      ["goals/citation-extraction-engine/ops/qualify-regex-translator.child.mjs", false],
      ["goals/citation-extraction-engine/ops/README.md", false],
      [
        "goals/citation-extraction-engine/history/evidence/2026-11-08-six-form-selection/profile.frozen.json.txt",
        false,
      ],
      ["goals/citation-extraction-engine/history/evidence/2026-11-08-six-form-selection/README.md", true],
      ["goals/semantica-canary/history/c2/full-w1.replay.eval-report.json", false],
      ["goals/time-to-certainty/research/economics.json", false],
      ["goals/time-to-certainty/research/gate-order-handoff.json", false],
      ["goals/time-to-certainty/research/other.json", true],
      ["goals/turborepo-cache-trust-observability/research/native-dependency-diagnostics.py", false],
      ["goals/turborepo-cache-trust-observability/research/native-dependency-diagnostics.test.py", false],
      ["goals/turborepo-cache-trust-observability/research/native-dependency-diagnostics.md", true],
      ["goals/x/ops/check.ts", false],
      ["goals/x/ops/codemod/rewrite.ts", false],
      // Every JavaScript or TypeScript module variant is code-shaped, not only the ops `.ts` row.
      ["goals/x/ops/check.tsx", false],
      // Post-merge census gaps: bare-string and exploration reads keep verification too.
      ["goals/speed-loop/ops/runner-burst/teardown-burst-runners.sh", false],
      ["goals/speed-loop/ops/runner-burst/README.md", false],
      ["goals/speed-loop/ops/other.sh", true],
      ["explorations/beep-ci-operational-ontology/ontology/extraction/s6/graphs/abox.ttl", false],
      ["explorations/beep-ci-operational-ontology/ontology/extraction/s6/snapshot/raw/journal.ndjson", false],
      ["explorations/beep-ci-operational-ontology/ontology/extraction/s6/README.md", true],
      [
        "explorations/beep-ci-operational-ontology/ontology/extraction/s4/beep-ci-ops/corpus/run4-fleet/MANIFEST.yaml",
        false,
      ],
      ["explorations/legal-ontology-landscape/assets/manifest.jsonl", false],
      ["explorations/legal-ontology-landscape/assets/other.jsonl", true],
      ["explorations/beep-ci-operational-ontology/research/control-interventions.yaml", false],
      [
        "explorations/beep-ci-operational-ontology/research/evidence/journal-snapshot-2026-10-01/journal.redacted.ndjson",
        false,
      ],
      ["explorations/beep-ci-operational-ontology/research/other.yaml", true],
      ["docs/runbooks/ci-runner-reliability.md", true],
      ["docs/assets/diagram.svg", true],
      ["explorations/INBOX.md", true],
      ["explorations/merge-queue/capture.json", true],
      ["research/ledger/claims.jsonl", true],
      [".changeset/brave-owls-sing.md", true],
      [".changeset/config.json", false],
      ["packages/a/README.md", false],
      ["packages/a/src/index.ts", false],
      ["packages/a/src/index.md.ts", false],
      ["README.md", true],
      ["standards/ARCHITECTURE.md", true],
      ["standards/architecture/DECISIONS.md", true],
      ["standards/schema-first.inventory.jsonc", false],
      ["standards/schema-first.inventory.json", false],
      [".github/workflows/check.yml", false],
      ["scripts/cloud/bootstrap.sh", false],
      ["mydocs/file.ts", false],
    ];
    for (const [path, expected] of rows) {
      expect(isHeavyDocsOnlyPath(path), path).toBe(expected);
      expect(heavyDocsOnlyPattern.test(path), path).toBe(expected);
    }
    // No global flag: repeated tests of the same path never alternate on lastIndex.
    expect(heavyDocsOnlyPattern.global).toBe(false);
  });

  it("projects the github outputs the old key=value lines carried, and renders the summary line", () => {
    const run = decideHeavyAdmission(event({ labels: [HEAVY_ADMISSION_LABEL] }));
    const hold = decideHeavyAdmission(event());
    // Parity with the lines `ci admission` appended before the write moved to
    // `ActionOutputs.set`: the same names, values and order the runner reads.
    expect(heavyAdmissionGithubOutputs(run)).toEqual(
      parseRunnerFile(
        "verdict=run\nadmitted=true\ndocs_only=false\nsources=label\nroute_skips=\nroute_receipt=route-unavailable\nlane_skips=\n"
      )
    );
    expect(heavyAdmissionGithubOutputs(hold)).toEqual(
      parseRunnerFile(
        "verdict=hold\nadmitted=false\ndocs_only=false\nsources=\nroute_skips=\nroute_receipt=route-unavailable\nlane_skips=\n"
      )
    );
    expect(renderHeavyAdmissionSummary(hold)).toBe(
      "heavy admission: hold; sources: none; docs-only: no; changed paths: 1; admit: gh pr edit --add-label ready-for-heavy"
    );
    expect(renderHeavyAdmissionSummary(decideHeavyAdmission(event({ changedPaths: docs })))).toBe(
      "heavy admission: skip-satisfied; sources: none; docs-only: yes; changed paths: 2"
    );
    // An admitted head names its sources and never prints the admitting command.
    expect(renderHeavyAdmissionSummary(run)).toBe(
      "heavy admission: run; sources: label; docs-only: no; changed paths: 1"
    );
    expect(renderHeavyAdmissionSummary(decideHeavyAdmission(event({ eventName: "push" })))).toBe(
      "heavy admission: run; sources: main-push; docs-only: no; changed paths: 1"
    );
  });
});

it.layer(platform, { timeout: "30 seconds" })("B8 heavy admission reader", (layerIt) => {
  layerIt.effect("reads labels, draft and the merge-base diff from the payload, fetching the base first", () =>
    temporary((root) =>
      Effect.gen(function* () {
        const path = yield* writeEvent(root, payload([HEAVY_ADMISSION_LABEL, "size/S"], true));
        const spawner = gitSpawner(["packages/a/src/index.ts", "docs/x y.md"]);
        const read = yield* readHeavyAdmissionEvent(
          HeavyAdmissionReadInput.make({ eventName: "pull_request", eventPath: O.some(path), cwd: root })
        ).pipe(provideScriptedGit(spawner));
        expect(read).toEqual(
          HeavyAdmissionEvent.make({
            eventName: "pull_request",
            labels: [HEAVY_ADMISSION_LABEL, "size/S"],
            draft: true,
            changedPaths: ["packages/a/src/index.ts", "docs/x y.md"],
          })
        );
        expect(A.map(gitWork(spawner), (spawn) => spawn.args)).toEqual([
          ["fetch", "--no-tags", "origin", "+refs/heads/main:refs/remotes/origin/main"],
          ["diff", "--name-only", "-z", "--no-relative", "origin/main...HEAD"],
        ]);
        // `--base` overrides the payload ref, with or without the origin/ prefix.
        const release = gitSpawner([]);
        yield* readHeavyAdmissionEvent(
          HeavyAdmissionReadInput.make({
            eventName: "pull_request",
            eventPath: O.some(path),
            base: O.some("origin/release/2026"),
            cwd: root,
          })
        ).pipe(provideScriptedGit(release));
        expect(A.map(gitWork(release), (spawn) => lastLine(spawn.args))).toEqual([
          "+refs/heads/release/2026:refs/remotes/origin/release/2026",
          "origin/release/2026...HEAD",
        ]);
        // push and merge_group never read a payload or spawn git.
        const idle = gitSpawner([]);
        for (const eventName of ["push", "merge_group"] as const) {
          const bare = yield* readHeavyAdmissionEvent(HeavyAdmissionReadInput.make({ eventName, cwd: root })).pipe(
            provideScriptedGit(idle)
          );
          expect(bare).toEqual(HeavyAdmissionEvent.make({ eventName }));
        }
        expect(idle.spawns).toEqual([]);
      })
    )
  );

  layerIt.effect("reads a payload whose head and base carry no repository as empty repositories", () =>
    temporary((root) =>
      Effect.gen(function* () {
        const path = yield* writeEvent(
          root,
          '{"action":"opened","number":1,"pull_request":{"draft":false,"labels":[],"base":{"ref":"main"}}}'
        );
        const read = yield* readHeavyAdmissionEvent(
          HeavyAdmissionReadInput.make({ eventName: "pull_request", eventPath: O.some(path), cwd: root })
        ).pipe(provideScriptedGit(gitSpawner([])));
        expect([read.headRepository, read.baseRepository]).toEqual(["", ""]);
      })
    )
  );

  layerIt.effect("keeps reading after a failed best-effort fetch", () =>
    temporary((root) =>
      Effect.gen(function* () {
        const path = yield* writeEvent(root, payload([]));
        const spawner = ScriptedSpawner.make((_command, args) =>
          args[0] === "fetch" ? { exit: 128, stderr: "fatal: unable to access" } : { stdout: "docs/a.md\0" }
        );
        const read = yield* readHeavyAdmissionEvent(
          HeavyAdmissionReadInput.make({ eventName: "pull_request", eventPath: O.some(path), cwd: root })
        ).pipe(provideScriptedGit(spawner));
        expect(read.changedPaths).toEqual(["docs/a.md"]);
      })
    )
  );

  layerIt.effect("fails loudly on a missing payload, an undecodable payload, an unsafe base, and a failed diff", () =>
    temporary((root) =>
      Effect.gen(function* () {
        const ok = provideScriptedGit(gitSpawner([]));
        const missing = yield* readHeavyAdmissionEvent(
          HeavyAdmissionReadInput.make({ eventName: "pull_request", cwd: root })
        ).pipe(ok, Effect.flip);
        expect(missing.message).toContain("GITHUB_EVENT_PATH");
        const broken = yield* writeEvent(root, '{"pull_request":{"labels":"nope"}}');
        const undecodable = yield* readHeavyAdmissionEvent(
          HeavyAdmissionReadInput.make({ eventName: "pull_request", eventPath: O.some(broken), cwd: root })
        ).pipe(ok, Effect.flip);
        expect(undecodable.message).toContain("Failed to decode the pull_request payload");
        const path = yield* writeEvent(root, payload([], false, "--upload-pack=evil"));
        const unsafe = yield* readHeavyAdmissionEvent(
          HeavyAdmissionReadInput.make({ eventName: "pull_request", eventPath: O.some(path), cwd: root })
        ).pipe(ok, Effect.flip);
        expect(unsafe.message).toContain("unsafe base branch");
        const mainBase = HeavyAdmissionReadInput.make({
          eventName: "pull_request",
          eventPath: O.some(path),
          base: O.some("main"),
          cwd: root,
        });
        const failed = yield* readHeavyAdmissionEvent(mainBase).pipe(
          provideFailingDiff(UnknownRefError.make({ ref: "origin/main", cwd: root })),
          Effect.flip
        );
        expect(failed.message).toContain("git diff --name-only origin/main...HEAD exited 128.");
        expect(failed.message).not.toContain("(truncated)");
        // A read that overflowed the kit's bound is unreadable: an incomplete path
        // list could classify a code head docs-only.
        const truncated = yield* readHeavyAdmissionEvent(mainBase).pipe(
          provideFailingDiff(GitCommandError.make({ kind: "truncated", args: ["diff"], cwd: root, stderr: "" })),
          Effect.flip
        );
        expect(truncated.message).toContain("(truncated)");
        const unspawned = yield* readHeavyAdmissionEvent(mainBase).pipe(
          provideFailingDiff(GitCommandError.make({ kind: "failed", args: ["diff"], cwd: root, stderr: "" })),
          Effect.flip
        );
        expect(unspawned.message).toContain("Failed to run git diff for heavy admission.");
      })
    )
  );
});

it.layer(platform, { timeout: "30 seconds" })("B8 ci admission command", (layerIt) => {
  layerIt.effect("prints the verdict JSON, appends github output, and exits 0 for every verdict", () =>
    temporary((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        // The layer shares one TestConsole across tests: read only this test's lines.
        const logs4 = yield* logs;
        const priorLines = A.length(logs4);
        const path = yield* writeEvent(root, payload([]));
        const output = `${root}/github-output.txt`;
        yield* fs.writeFileString(output, "prior=1\n");
        const docsGit = provideScriptedGit(gitSpawner(["docs/a.md", "goals/x/PLAN.md"]));
        const outputs = ActionOutputs.layer.pipe(Layer.provide(ActionEnvironment.layerTest({ GITHUB_OUTPUT: output })));
        const held = yield* runCiAdmission(
          CiAdmissionInput.make({
            eventName: O.some("pull_request"),
            eventPath: O.some(path),
            githubOutput: true,
            cwd: root,
          })
        ).pipe(provideScopedLayer(outputs), provideScriptedGit(gitSpawner(["packages/a/src/index.ts"])));
        expect(held.verdict).toBe("hold");
        const skipped = yield* runCiAdmission(
          CiAdmissionInput.make({
            eventName: O.some("pull_request"),
            eventPath: O.some(path),
            githubOutput: true,
            json: false,
            cwd: root,
          })
        ).pipe(provideScopedLayer(outputs), docsGit);
        expect(skipped.verdict).toBe("skip-satisfied");
        const logs5 = yield* logs;
        const printed = A.drop(logs5, priorLines);
        const decoded6 = yield* HeavyAdmissionJson.decode(printed[0] ?? "");
        expect(decoded6).toEqual(held);
        expect(printed[1]).toContain("heavy admission: skip-satisfied");
        // Parity: the entries the runner reads equal the key=value lines the
        // command appended before the write moved to `ActionOutputs.set`.
        const readFileString7 = yield* fs.readFileString(output);
        expect(parseRunnerFile(readFileString7)).toEqual(
          parseRunnerFile(
            A.join(
              [
                "prior=1",
                "verdict=hold",
                "admitted=false",
                "docs_only=false",
                "sources=",
                "route_skips=",
                "route_receipt=route-unavailable",
                "lane_skips=",
                "verdict=skip-satisfied",
                "admitted=false",
                "docs_only=true",
                "sources=",
                "route_skips=",
                "route_receipt=route-unavailable",
                "lane_skips=",
                "",
              ],
              "\n"
            )
          )
        );
        const unknown = yield* runCiAdmission(
          CiAdmissionInput.make({ eventName: O.some("workflow_dispatch"), cwd: root })
        ).pipe(provideScopedLayer(outputs), docsGit, Effect.flip);
        expect(unknown.message).toContain("workflow_dispatch");
        const unnamed = yield* runCiAdmission(CiAdmissionInput.make({ cwd: root })).pipe(
          provideScopedLayer(outputs),
          docsGit,
          Effect.flip
        );
        expect(unnamed.message).toContain("GITHUB_EVENT_NAME");
      })
    )
  );

  layerIt.effect("resolves flags over the environment and writes $GITHUB_OUTPUT through the real command", () =>
    temporary((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const spawner = gitSpawner(["packages/a/src/index.ts"]);
        const path = yield* writeEvent(root, payload([HEAVY_ADMISSION_LABEL], false, "develop"));
        const output = `${root}/github-output.txt`;
        const env = ConfigProvider.fromUnknown({
          GITHUB_EVENT_NAME: "push",
          GITHUB_EVENT_PATH: "/nonexistent",
          GITHUB_OUTPUT: output,
        });
        yield* runAdmissionCommand([
          "--event-name",
          "pull_request",
          "--event-path",
          path,
          "--base",
          "main",
          "--github-output",
        ]).pipe(provideScriptedGit(spawner), Effect.provideService(ConfigProvider.ConfigProvider, env));
        const printed = yield* logs;
        const decoded = yield* HeavyAdmissionJson.decode(lastLine(printed));
        expect(decoded).toEqual(
          HeavyAdmission.make({
            verdict: "run",
            admitted: true,
            sources: ["label"],
            docsOnly: false,
            changedPathCount: 1,
          })
        );
        const readFileString8 = yield* fs.readFileString(output);
        expect(parseRunnerFile(readFileString8)).toEqual(
          parseRunnerFile(
            "verdict=run\nadmitted=true\ndocs_only=false\nsources=label\nroute_skips=\nroute_receipt=route-unavailable\nlane_skips=\n"
          )
        );
        expect(A.map(gitWork(spawner), (spawn) => spawn.args[0])).toEqual(["fetch", "diff", "merge-base"]);
        // The environment alone drives a push: no payload, no git, exit 0.
        const idle = gitSpawner([]);
        yield* runAdmissionCommand([]).pipe(
          provideScriptedGit(idle),
          Effect.provideService(ConfigProvider.ConfigProvider, env)
        );
        expect(idle.spawns).toEqual([]);
        const readFileString9 = yield* fs.readFileString(output);
        expect(parseRunnerFile(readFileString9)).toEqual(
          parseRunnerFile(
            "verdict=run\nadmitted=true\ndocs_only=false\nsources=label\nroute_skips=\nroute_receipt=route-unavailable\nlane_skips=\n"
          )
        );
        const again = yield* logs;
        const decoded10 = yield* HeavyAdmissionJson.decode(lastLine(again));
        expect(decoded10).toMatchObject({
          verdict: "run",
          sources: ["main-push"],
          changedPathCount: 0,
        });
      })
    )
  );

  layerIt.effect("reports unreadable inputs on stderr with a failing exit", () =>
    temporary((root) =>
      Effect.gen(function* () {
        const env = ConfigProvider.fromUnknown({});
        const exit = yield* runAdmissionCommand(["--event-name", "pull_request", "--github-output"]).pipe(
          provideScriptedGit(gitSpawner([])),
          Effect.provideService(ConfigProvider.ConfigProvider, env),
          Effect.exit
        );
        expect(exit._tag).toBe("Failure");
        const errors11 = yield* errors;
        expect(errors11).toContain("GITHUB_OUTPUT");
        expect(root.length).toBeGreaterThan(0);
      })
    )
  );
});

it.layer(platform, { timeout: "30 seconds" })("hosted admission route", (layerIt) => {
  const classify = (paths: ReadonlyArray<string>) =>
    classifyChangedPaths(
      ClassifyDiff.make({
        base: "base",
        head: "head",
        commits: 1,
        entries: A.map(paths, (path) => ChangedPathEntry.make({ path, status: "M" })),
      }),
      (_ref, path) =>
        Effect.succeed(
          path === "package.json" ? O.some('{"name":"@fixture/root","workspaces":["packages/*"]}') : O.none()
        )
    );

  for (const row of [
    {
      name: "packet markdown emits check and build skips",
      paths: ["goals/x/SPEC.md"],
      eventName: "pull_request",
      revoked: false,
      failed: false,
      skips: "build,check",
    },
    {
      name: "source changes retain every heavy lane",
      paths: ["packages/x/src/index.ts"],
      eventName: "pull_request",
      revoked: false,
      failed: false,
      skips: "",
    },
    {
      name: "push never routes",
      paths: ["goals/x/SPEC.md"],
      eventName: "push",
      revoked: false,
      failed: false,
      skips: "",
    },
    {
      name: "merge groups never route",
      paths: ["goals/x/SPEC.md"],
      eventName: "merge_group",
      revoked: false,
      failed: false,
      skips: "",
    },
    {
      name: "classifier failure retains every lane",
      paths: ["goals/x/SPEC.md"],
      eventName: "pull_request",
      revoked: false,
      failed: true,
      skips: "",
    },
    {
      name: "revoked refinement runs shadow skips",
      paths: ["goals/x/SPEC.md"],
      eventName: "pull_request",
      revoked: true,
      failed: false,
      skips: "",
    },
  ] as const) {
    layerIt.layer(
      Git.layerTest({
        mergeBase: () => Effect.succeed("merge-base"),
        show: () =>
          Effect.succeed(
            row.revoked
              ? O.some('{"revoked":[{"id":"packet-markdown-out-of-build-check","reason":"fixture"}]}')
              : O.none()
          ),
      }),
      { timeout: "30 seconds" }
    )(row.name, (routeIt) => {
      routeIt.effect("publishes lane skips and receipt", () =>
        temporary((root) =>
          Effect.gen(function* () {
            const path = yield* writeEvent(root, payload([HEAVY_ADMISSION_LABEL]));
            const change = yield* classify(row.paths);
            let calls = 0;
            const route = yield* readHeavyAdmissionRoute(
              HeavyAdmissionReadInput.make({
                eventName: row.eventName,
                eventPath: O.some(path),
                cwd: root,
              })
            ).pipe(
              Effect.provideService(
                ChangeClassifier,
                ChangeClassifier.of({
                  classify: Effect.fn("ChangeClassifier.classify")(function* (input) {
                    calls++;
                    expect(input.base).toBe("merge-base");
                    expect(input.head).toBe("HEAD");
                    if (row.failed) {
                      return yield* RouteError.make({ reason: "classify", message: "fixture classifier failure" });
                    }
                    return change;
                  }),
                })
              )
            );
            const admission = HeavyAdmission.make({ ...decideHeavyAdmission(event()), route });
            const outputs = R.fromEntries(heavyAdmissionGithubOutputs(admission));
            expect(outputs.route_skips).toBe(row.skips);
            expect(outputs.route_receipt).not.toContain("\n");
            if (row.eventName !== "pull_request") {
              expect(calls).toBe(0);
            } else if (row.failed) {
              expect(route.receipt).toBe("route-unavailable");
            } else {
              expect(route.lanes).toHaveLength(5);
              if (row.revoked)
                expect(A.filter(route.lanes, (lane) => lane.decision === "shadow-skipped")).toHaveLength(2);
              if (row.skips !== "") {
                const receipt = yield* S.decodeEffect(UnknownJson)(route.receipt);
                expect(receipt).toMatchObject({
                  footprintDigest: expect.stringMatching(/^[a-f0-9]{64}$/u),
                  atoms: expect.arrayContaining([
                    { kind: "packet", count: 1 },
                    { kind: "commits", count: 1 },
                  ]),
                  skipped: expect.arrayContaining([
                    {
                      lane: "check",
                      refinements: ["packet-markdown-out-of-build-check"],
                      reason: expect.stringContaining("footprint"),
                    },
                  ]),
                });
              }
            }
          })
        )
      );
    });
  }

  layerIt.layer(Git.layerTest({ mergeBase: () => Effect.succeed("merge-base"), show: () => Effect.succeedNone }), {
    timeout: "30 seconds",
  })("a stalled route read", (routeIt) => {
    routeIt.effect("falls back to route-unavailable once the read bound passes", () =>
      temporary((root) =>
        Effect.gen(function* () {
          const path = yield* writeEvent(root, payload([HEAVY_ADMISSION_LABEL]));
          // A short live bound instead of advancing the block's shared test clock (EV015): the
          // classifier never completes, so only the read bound can end the route read.
          const route = yield* TestClock.withLive(
            readHeavyAdmissionRoute(
              HeavyAdmissionReadInput.make({ eventName: "pull_request", eventPath: O.some(path), cwd: root }),
              "200 millis"
            ).pipe(
              Effect.provideService(
                ChangeClassifier,
                ChangeClassifier.of({ classify: Effect.fn("ChangeClassifier.classify")(() => Effect.never) })
              )
            )
          );
          expect([route.lanes, route.receipt]).toEqual([[], "route-unavailable"]);
        })
      )
    );
  });
});

// HOST-06 (goals/heavy-pool-diet slice 3): Heavy Admission decides the goals-only and Docgen skips
// heavy.yml's in-VM lane gate takes, so the caller can skip those lanes before a runner boots.
const payloadWithShas = (shas: { readonly base?: string; readonly head?: string }) =>
  Result.getOrThrowWith(
    S.encodeUnknownResult(UnknownJson)({
      action: "synchronize",
      number: 1,
      pull_request: {
        draft: false,
        labels: [{ name: HEAVY_ADMISSION_LABEL }],
        head: {
          repo: { full_name: "beep-effect/beep-effect" },
          ...(shas.head === undefined ? {} : { sha: shas.head }),
        },
        base: {
          ref: "main",
          repo: { full_name: "beep-effect/beep-effect" },
          ...(shas.base === undefined ? {} : { sha: shas.base }),
        },
      },
    }),
    identity
  );
// The pinned `git diff --name-only --no-renames <base>...<head>` the lane gate reads, as C-quoted
// newline lines, or a non-zero exit when the base is unreadable; fetches and other git calls succeed.
const pinnedDiffSpawner = (diff: O.Option<ReadonlyArray<string>>) =>
  ScriptedSpawner.make((_command, args) =>
    A.contains(args, "--no-renames")
      ? O.match(diff, {
          onNone: () => ({ exit: 128, stderr: "fatal: bad revision 'base...head'" }),
          onSome: (paths) => ({
            stdout: A.join(
              A.map(paths, (path) => `${path}\n`),
              ""
            ),
          }),
        })
      : { stdout: "" }
  );
const pinnedDiffSpawns = (spawner: ScriptedSpawner) =>
  A.filter(spawner.spawns, (spawn) => A.contains(spawn.args, "--no-renames"));
const ALL_HEAVY_LANES = "build,check,docgen,doctest,lint-policy";
// No `--github-output`: the command never writes, but its signature still names the service.
const noGithubOutput = provideScopedLayer(ActionOutputs.layer.pipe(Layer.provide(ActionEnvironment.layerTest({}))));

it.layer(platform, { timeout: "30 seconds" })("HOST-06 heavy lane skips", (layerIt) => {
  for (const row of [
    // Markdown is Docgen-relevant (`\.md$`) and docs are not goals-only: every lane runs.
    { name: "documentation-only diff", paths: O.some(["docs/runbooks/ci.md"]), skips: "" },
    { name: "goals-only diff", paths: O.some(["goals/x/PLAN.md", "goals/x/SPEC.md"]), skips: ALL_HEAVY_LANES },
    // An empty diff is not goals-only, but has no Docgen-relevant path: Docgen skips, as today.
    { name: "empty (no-diff) pull request", paths: O.some([]), skips: "docgen" },
    { name: "unreadable base", paths: O.none(), skips: "" },
    { name: "Docgen-relevant diff", paths: O.some(["packages/a/src/index.ts"]), skips: "" },
    { name: "Docgen-irrelevant code diff", paths: O.some([".github/workflows/heavy.yml"]), skips: "docgen" },
    // git C-quotes a special byte; the quoted line matches no Docgen root or suffix, as the grep does.
    { name: "C-quoted path", paths: O.some(['"docs/\\303\\244.md"']), skips: "docgen" },
  ] as const) {
    layerIt.layer(
      Git.layerTest({
        changedFiles: () => Effect.succeed(O.getOrElse(row.paths, A.empty<string>)),
        mergeBase: () => Effect.succeed("merge-base"),
        show: () => Effect.succeedNone,
      }),
      { timeout: "30 seconds" }
    )(row.name, (laneIt) => {
      laneIt.effect("publishes lane_skips and leaves verdict, route_skips and route_receipt unchanged", () =>
        temporary((root) =>
          Effect.gen(function* () {
            const change = yield* classifyChangedPaths(
              ClassifyDiff.make({
                base: "base",
                head: "head",
                commits: 1,
                entries: A.map(O.getOrElse(row.paths, A.empty<string>), (path) =>
                  ChangedPathEntry.make({ path, status: "M" })
                ),
              }),
              () => Effect.succeedNone
            );
            const classifier = ChangeClassifier.of({
              classify: Effect.fn("ChangeClassifier.classify")(() => Effect.succeed(change)),
            });
            const decide = Effect.fn("admissionTest.decide")(function* (content: string, spawner: ScriptedSpawner) {
              const path = yield* writeEvent(root, content);
              const admission = yield* runCiAdmission(
                CiAdmissionInput.make({ eventName: O.some("pull_request"), eventPath: O.some(path), cwd: root })
              ).pipe(Effect.provideService(ChangeClassifier, classifier), noGithubOutput, provideSpawner(spawner));
              return R.fromEntries(heavyAdmissionGithubOutputs(admission));
            });
            // Without the pinned SHAs the lane-skip read is off: the outputs every caller read before.
            const before = yield* decide(payloadWithShas({}), pinnedDiffSpawner(row.paths));
            const spawner = pinnedDiffSpawner(row.paths);
            const after = yield* decide(payloadWithShas({ base: "base-sha", head: "head-sha" }), spawner);
            expect(after.lane_skips).toBe(row.skips);
            expect(before.lane_skips).toBe("");
            expect(R.remove(after, "lane_skips")).toEqual(R.remove(before, "lane_skips"));
            expect(A.map(pinnedDiffSpawns(spawner), (spawn) => spawn.args)).toEqual([
              ["diff", "--name-only", "--no-renames", "base-sha...head-sha"],
            ]);
          })
        )
      );
    });
  }

  layerIt.effect("a push event decides no lane skip and never spawns the pinned diff", () =>
    temporary((root) =>
      Effect.gen(function* () {
        const spawner = pinnedDiffSpawner(O.some(["goals/x/PLAN.md"]));
        const admission = yield* runCiAdmission(CiAdmissionInput.make({ eventName: O.some("push"), cwd: root })).pipe(
          noGithubOutput,
          provideScriptedGit(spawner)
        );
        const outputs = R.fromEntries(heavyAdmissionGithubOutputs(admission));
        expect([outputs.verdict, outputs.route_skips, outputs.route_receipt, outputs.lane_skips]).toEqual([
          "run",
          "",
          "route-not-applicable",
          "",
        ]);
        expect(spawner.spawns).toEqual([]);
      })
    )
  );

  layerIt.effect("fails open: a missing SHA, an unreadable pattern file and a missing payload skip nothing", () =>
    temporary((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        // A goals-only path that is also Docgen-irrelevant (no `.md` suffix).
        const goals = O.some(["goals/x/ops/manifest.json"]);
        const read = (content: string, spawner: ScriptedSpawner) =>
          writeEvent(root, content).pipe(
            Effect.flatMap((path) =>
              readHeavyLaneSkips(
                HeavyAdmissionReadInput.make({ eventName: "pull_request", eventPath: O.some(path), cwd: root })
              )
            ),
            provideSpawner(spawner)
          );
        const headOnly = pinnedDiffSpawner(goals);
        const headOnlySkips = yield* read(payloadWithShas({ head: "head-sha" }), headOnly);
        expect(headOnlySkips).toEqual([]);
        expect(pinnedDiffSpawns(headOnly)).toEqual([]);
        // An unreadable pattern file drops only the goals-only reason; the Docgen reason stands.
        yield* fs.makeDirectory(`${root}/packages/tooling/tool/cli/src/commands/Ci`, { recursive: true });
        yield* fs.writeFileString(`${root}/packages/tooling/tool/cli/src/commands/Ci/CiOperational.patterns.json`, "{");
        const unreadablePatternSkips = yield* read(payloadWithShas({ base: "b", head: "h" }), pinnedDiffSpawner(goals));
        expect(unreadablePatternSkips).toEqual(["docgen"]);
        // A missing payload is an error the read swallows.
        const missing = yield* readHeavyLaneSkips(
          HeavyAdmissionReadInput.make({
            eventName: "pull_request",
            eventPath: O.some(`${root}/absent.json`),
            cwd: root,
          })
        ).pipe(provideSpawner(pinnedDiffSpawner(goals)));
        expect(missing).toEqual([]);
        const errors12 = yield* errors;
        expect(errors12).toContain("heavy lane skips");
      })
    )
  );

  it("decides the skips purely, in heavy lane order", () => {
    const patterns = O.some(ciOperationalPatterns);
    expect(HEAVY_LANE_IDS).toEqual(["build", "check", "docgen", "doctest", "lint-policy"]);
    expect(decideHeavyLaneSkips("pull_request", O.some(["goals/x/PLAN.md"]), patterns)).toEqual(HEAVY_LANE_IDS);
    // No pattern data: the goals-only reason cannot hold. Packet markdown is Docgen-relevant, a
    // packet manifest is not.
    expect(decideHeavyLaneSkips("pull_request", O.some(["goals/x/PLAN.md"]), O.none())).toEqual([]);
    expect(decideHeavyLaneSkips("pull_request", O.some(["goals/x/ops/manifest.json"]), O.none())).toEqual(["docgen"]);
    expect(decideHeavyLaneSkips("merge_group", O.some([]), patterns)).toEqual([]);
    for (const [path, relevant] of [
      ["apps/web/src/a.ts", true],
      ["infra/r2-cache/adapter.sh", true],
      ["packages/x/docgen.json", true],
      ["docgen.json", false],
      ["scripts/a.mts", true],
      ["README.md", true],
      [".github/workflows/heavy.yml", false],
      ["standards/branch-protection-contexts.json", false],
    ] as const) {
      expect(heavyDocgenRelevantPattern.test(path), path).toBe(relevant);
    }
  });
});
