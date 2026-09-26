import { fcRuns } from "@beep/fc-runs";
import {
  CiAdmissionInput,
  ciAdmissionCommand,
  decideHeavyAdmission,
  HEAVY_ADMISSION_LABEL,
  HeavyAdmission,
  HeavyAdmissionEvent,
  HeavyAdmissionJson,
  HeavyAdmissionReadInput,
  heavyAdmissionSchemasForTesting,
  heavyDocsOnlyPattern,
  isHeavyDocsOnlyPath,
  readHeavyAdmissionEvent,
  renderHeavyAdmissionGithubOutput,
  renderHeavyAdmissionSummary,
  runCiAdmission,
} from "@beep/repo-cli/commands/Ci";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { ConfigProvider, Effect, FileSystem, Layer, Ref, Sink, Stream } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import { Command } from "effect/cli";
import * as O from "effect/Option";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import * as S from "effect/Schema";
import * as TestConsole from "effect/testing/TestConsole";

const code = ["packages/a/src/index.ts"];
const docs = ["docs/runbooks/ci.md", "goals/x/PLAN.md"];
const event = (values: Partial<HeavyAdmissionEvent> = {}) =>
  HeavyAdmissionEvent.make({ eventName: "pull_request", labels: [], draft: false, changedPaths: code, ...values });
const payload = (labels: ReadonlyArray<string>, draft = false, base = "main") =>
  JSON.stringify({
    action: "synchronize",
    number: 1,
    pull_request: { draft, labels: A.map(labels, (name) => ({ name, color: "ededed" })), base: { ref: base } },
  });
const handle = (exitCode: number, output: string) =>
  ChildProcessSpawner.makeHandle({
    all: Stream.make(new TextEncoder().encode(output)),
    stdout: Stream.make(new TextEncoder().encode(output)),
    stderr: Stream.empty,
    stdin: Sink.drain,
    exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(exitCode)),
    getInputFd: () => Sink.drain,
    getOutputFd: () => Stream.empty,
    isRunning: Effect.succeed(false),
    kill: () => Effect.void,
    pid: ChildProcessSpawner.ProcessId(1),
    unref: Effect.succeed(Effect.void),
  });
// The scripted git: fetch succeeds silently, diff prints the scripted paths.
const gitSpawner = (diff: string, commands: Ref.Ref<ReadonlyArray<ReadonlyArray<string>>>) =>
  Layer.succeed(
    ChildProcessSpawner.ChildProcessSpawner,
    ChildProcessSpawner.make((command) => {
      if (!ChildProcess.isStandardCommand(command)) return Effect.die("unexpected pipe");
      return Ref.update(commands, A.append([command.command, ...command.args])).pipe(
        Effect.as(handle(0, command.args[0] === "diff" ? diff : ""))
      );
    })
  );
const platform = Layer.mergeAll(NodeServices.layer, TestConsole.layer);
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
      expect(yield* S.encodeEffect(schema)(decoded)).toEqual(encoded);
    })
  );
});

describe("B8 heavy admission contracts", () => {
  for (const [name, schema] of Object.entries({ ...heavyAdmissionSchemasForTesting, CiAdmissionInput })) {
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
      ["packages/a/README.md", true],
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

  it("renders the github output lines and the summary line", () => {
    const run = decideHeavyAdmission(event({ labels: [HEAVY_ADMISSION_LABEL] }));
    const hold = decideHeavyAdmission(event());
    expect(renderHeavyAdmissionGithubOutput(run)).toBe("verdict=run\nadmitted=true\ndocs_only=false\nsources=label\n");
    expect(renderHeavyAdmissionGithubOutput(hold)).toBe("verdict=hold\nadmitted=false\ndocs_only=false\nsources=\n");
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

it.layer(platform)("B8 heavy admission reader", (layerIt) => {
  layerIt.effect("reads labels, draft and the merge-base diff from the payload, fetching the base first", () =>
    temporary((root) =>
      Effect.gen(function* () {
        const commands = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
        const path = yield* writeEvent(root, payload([HEAVY_ADMISSION_LABEL, "size/S"], true));
        const capture = (_command: string, args: ReadonlyArray<string>) =>
          Ref.update(commands, A.append(["git", ...args])).pipe(
            Effect.as({
              exitCode: 0,
              output: args[0] === "diff" ? " packages/a/src/index.ts\n\ndocs/x.md \n" : "",
              truncated: false,
            })
          );
        const read = yield* readHeavyAdmissionEvent(
          HeavyAdmissionReadInput.make({ eventName: "pull_request", eventPath: O.some(path), cwd: root }),
          capture
        );
        expect(read).toEqual(
          HeavyAdmissionEvent.make({
            eventName: "pull_request",
            labels: [HEAVY_ADMISSION_LABEL, "size/S"],
            draft: true,
            changedPaths: ["packages/a/src/index.ts", "docs/x.md"],
          })
        );
        expect(yield* Ref.get(commands)).toEqual([
          ["git", "fetch", "--quiet", "--no-tags", "origin", "+refs/heads/main:refs/remotes/origin/main"],
          ["git", "diff", "--name-only", "origin/main...HEAD"],
        ]);
        // `--base` overrides the payload ref, with or without the origin/ prefix.
        yield* Ref.set(commands, []);
        yield* readHeavyAdmissionEvent(
          HeavyAdmissionReadInput.make({
            eventName: "pull_request",
            eventPath: O.some(path),
            base: O.some("origin/release/2026"),
            cwd: root,
          }),
          capture
        );
        expect(A.map(yield* Ref.get(commands), lastLine)).toEqual([
          "+refs/heads/release/2026:refs/remotes/origin/release/2026",
          "origin/release/2026...HEAD",
        ]);
        // push and merge_group never read a payload or spawn git.
        yield* Ref.set(commands, []);
        for (const eventName of ["push", "merge_group"] as const) {
          const bare = yield* readHeavyAdmissionEvent(HeavyAdmissionReadInput.make({ eventName, cwd: root }), capture);
          expect(bare).toEqual(HeavyAdmissionEvent.make({ eventName }));
        }
        expect(yield* Ref.get(commands)).toEqual([]);
      })
    )
  );

  layerIt.effect("fails loudly on a missing payload, an undecodable payload, an unsafe base, and a failed diff", () =>
    temporary((root) =>
      Effect.gen(function* () {
        const ok = () => Effect.succeed({ exitCode: 0, output: "", truncated: false });
        const missing = yield* readHeavyAdmissionEvent(
          HeavyAdmissionReadInput.make({ eventName: "pull_request", cwd: root }),
          ok
        ).pipe(Effect.flip);
        expect(missing.message).toContain("GITHUB_EVENT_PATH");
        const broken = yield* writeEvent(root, '{"pull_request":{"labels":"nope"}}');
        const undecodable = yield* readHeavyAdmissionEvent(
          HeavyAdmissionReadInput.make({ eventName: "pull_request", eventPath: O.some(broken), cwd: root }),
          ok
        ).pipe(Effect.flip);
        expect(undecodable.message).toContain("Failed to decode the pull_request payload");
        const path = yield* writeEvent(root, payload([], false, "--upload-pack=evil"));
        const unsafe = yield* readHeavyAdmissionEvent(
          HeavyAdmissionReadInput.make({ eventName: "pull_request", eventPath: O.some(path), cwd: root }),
          ok
        ).pipe(Effect.flip);
        expect(unsafe.message).toContain("unsafe base branch");
        const failed = yield* readHeavyAdmissionEvent(
          HeavyAdmissionReadInput.make({
            eventName: "pull_request",
            eventPath: O.some(path),
            base: O.some("main"),
            cwd: root,
          }),
          (_command, args) => Effect.succeed({ exitCode: args[0] === "diff" ? 128 : 0, output: "", truncated: false })
        ).pipe(Effect.flip);
        expect(failed.message).toContain("exited 128");
        expect(failed.message).not.toContain("(truncated)");
        // A capture that hit the repo-run bound is unreadable even at exit 0: an
        // incomplete path list could classify a code head docs-only.
        const truncated = yield* readHeavyAdmissionEvent(
          HeavyAdmissionReadInput.make({
            eventName: "pull_request",
            eventPath: O.some(path),
            base: O.some("main"),
            cwd: root,
          }),
          (_command, args) => Effect.succeed({ exitCode: 0, output: "docs/a.md\n", truncated: args[0] === "diff" })
        ).pipe(Effect.flip);
        expect(truncated.message).toContain("exited 0 (truncated)");
      })
    )
  );
});

it.layer(platform)("B8 ci admission command", (layerIt) => {
  layerIt.effect("prints the verdict JSON, appends github output, and exits 0 for every verdict", () =>
    temporary((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        // The layer shares one TestConsole across tests: read only this test's lines.
        const priorLines = A.length(yield* logs);
        const path = yield* writeEvent(root, payload([]));
        const output = `${root}/github-output.txt`;
        yield* fs.writeFileString(output, "prior=1\n");
        const docsCapture = () =>
          Effect.succeed({ exitCode: 0, output: "docs/a.md\ngoals/x/PLAN.md\n", truncated: false });
        const held = yield* runCiAdmission(
          CiAdmissionInput.make({
            eventName: O.some("pull_request"),
            eventPath: O.some(path),
            githubOutputPath: O.some(output),
            cwd: root,
          }),
          () => Effect.succeed({ exitCode: 0, output: "packages/a/src/index.ts\n", truncated: false })
        );
        expect(held.verdict).toBe("hold");
        const skipped = yield* runCiAdmission(
          CiAdmissionInput.make({
            eventName: O.some("pull_request"),
            eventPath: O.some(path),
            githubOutputPath: O.some(output),
            json: false,
            cwd: root,
          }),
          docsCapture
        );
        expect(skipped.verdict).toBe("skip-satisfied");
        const printed = A.drop(yield* logs, priorLines);
        expect(yield* HeavyAdmissionJson.decode(printed[0] ?? "")).toEqual(held);
        expect(printed[1]).toContain("heavy admission: skip-satisfied");
        expect(yield* fs.readFileString(output)).toBe(
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
          ].join("\n")
        );
        const unknown = yield* runCiAdmission(
          CiAdmissionInput.make({ eventName: O.some("workflow_dispatch"), cwd: root }),
          docsCapture
        ).pipe(Effect.flip);
        expect(unknown.message).toContain("workflow_dispatch");
        const unnamed = yield* runCiAdmission(CiAdmissionInput.make({ cwd: root }), docsCapture).pipe(Effect.flip);
        expect(unnamed.message).toContain("GITHUB_EVENT_NAME");
      })
    )
  );

  layerIt.effect("resolves flags over the environment and writes $GITHUB_OUTPUT through the real command", () =>
    temporary((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const commands = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
        const path = yield* writeEvent(root, payload([HEAVY_ADMISSION_LABEL], false, "develop"));
        const output = `${root}/github-output.txt`;
        const env = ConfigProvider.layer(
          ConfigProvider.fromUnknown({
            GITHUB_EVENT_NAME: "push",
            GITHUB_EVENT_PATH: "/nonexistent",
            GITHUB_OUTPUT: output,
          })
        );
        yield* runAdmissionCommand([
          "--event-name",
          "pull_request",
          "--event-path",
          path,
          "--base",
          "main",
          "--github-output",
        ]).pipe(provideScopedLayer(Layer.mergeAll(gitSpawner("packages/a/src/index.ts\n", commands), env)));
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
        expect(yield* fs.readFileString(output)).toBe("verdict=run\nadmitted=true\ndocs_only=false\nsources=label\n");
        expect(A.map(yield* Ref.get(commands), (command) => command[1])).toEqual(["fetch", "diff"]);
        // The environment alone drives a push: no payload, no git, exit 0.
        yield* Ref.set(commands, []);
        yield* runAdmissionCommand([]).pipe(provideScopedLayer(Layer.mergeAll(gitSpawner("", commands), env)));
        expect(yield* Ref.get(commands)).toEqual([]);
        expect(yield* fs.readFileString(output)).toBe("verdict=run\nadmitted=true\ndocs_only=false\nsources=label\n");
        const again = yield* logs;
        expect(yield* HeavyAdmissionJson.decode(lastLine(again))).toMatchObject({
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
        const commands = yield* Ref.make<ReadonlyArray<ReadonlyArray<string>>>([]);
        const env = ConfigProvider.layer(ConfigProvider.fromUnknown({}));
        const exit = yield* runAdmissionCommand(["--event-name", "pull_request", "--github-output"]).pipe(
          provideScopedLayer(Layer.mergeAll(gitSpawner("", commands), env)),
          Effect.exit
        );
        expect(exit._tag).toBe("Failure");
        expect(yield* errors).toContain("GITHUB_OUTPUT");
        expect(root.length).toBeGreaterThan(0);
      })
    )
  );
});
