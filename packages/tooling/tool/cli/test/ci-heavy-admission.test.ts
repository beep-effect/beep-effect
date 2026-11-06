import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import { fcRuns } from "@beep/fc-runs";
import { Git, GitCommandError, UnknownRefError } from "@beep/git/Git";
import { ActionEnvironment } from "@beep/github-actions/ActionEnvironment";
import { ActionOutputs } from "@beep/github-actions/ActionOutputs";
import {
  CiAdmissionInput,
  ciAdmissionCommand,
  decideHeavyAdmission,
  HEAVY_ADMISSION_LABEL,
  HeavyAdmission,
  HeavyAdmissionEvent,
  HeavyAdmissionJson,
  HeavyAdmissionReadInput,
  heavyAdmissionGithubOutputs,
  heavyAdmissionSchemasForTesting,
  heavyDocsOnlyPattern,
  isHeavyDocsOnlyPath,
  readHeavyAdmissionEvent,
  renderHeavyAdmissionSummary,
  runCiAdmission,
} from "@beep/repo-cli/commands/Ci";
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
const platform = Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, TestConsole.layer);
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

  it("classifies docs-only paths by the widened goals_document_pattern", () => {
    const rows: ReadonlyArray<readonly [string, boolean]> = [
      ["goals/INDEX.md", true],
      ["goals/README.md", true],
      ["goals/time-to-certainty/GOAL.md", true],
      ["goals/time-to-certainty/PLAN.md", true],
      ["goals/time-to-certainty/README.md", true],
      ["goals/time-to-certainty/SPEC.md", true],
      ["goals/time-to-certainty/DECISIONS.md", true],
      ["goals/time-to-certainty/ops/manifest.json", true],
      ["goals/time-to-certainty/research/b8-brief.md", true],
      ["goals/x/scripts/run.sh", false],
      ["goals/x/ops/fixtures.json", false],
      ["goals/x/ops/manifest.json.bak", false],
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
      [".github/workflows/check.yml", false],
      ["scripts/ci-change-profile.sh", false],
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
      parseRunnerFile("verdict=run\nadmitted=true\ndocs_only=false\nsources=label\n")
    );
    expect(heavyAdmissionGithubOutputs(hold)).toEqual(
      parseRunnerFile("verdict=hold\nadmitted=false\ndocs_only=false\nsources=\n")
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
                "verdict=skip-satisfied",
                "admitted=false",
                "docs_only=true",
                "sources=",
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
          parseRunnerFile("verdict=run\nadmitted=true\ndocs_only=false\nsources=label\n")
        );
        expect(A.map(gitWork(spawner), (spawn) => spawn.args[0])).toEqual(["fetch", "diff"]);
        // The environment alone drives a push: no payload, no git, exit 0.
        const idle = gitSpawner([]);
        yield* runAdmissionCommand([]).pipe(
          provideScriptedGit(idle),
          Effect.provideService(ConfigProvider.ConfigProvider, env)
        );
        expect(idle.spawns).toEqual([]);
        const readFileString9 = yield* fs.readFileString(output);
        expect(parseRunnerFile(readFileString9)).toEqual(
          parseRunnerFile("verdict=run\nadmitted=true\ndocs_only=false\nsources=label\n")
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
