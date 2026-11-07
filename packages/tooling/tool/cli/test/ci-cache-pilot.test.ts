import * as NodeBuffer from "node:buffer";
import * as NodeZlib from "node:zlib";
import {
  CiStepEnvironment,
  cachePilotInputDirectory,
  prepareCachePilotRequest,
  prepareCachePilotSources,
} from "@beep/repo-cli/commands/Ci";
import { findRepoRoot } from "@beep/repo-utils/Root";
import { it } from "@beep/test-runner";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { assert, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Digest from "effect/crypto/Digest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Base64 from "effect/encoding/Base64";
import * as Hex from "effect/encoding/Hex";
import * as FileSystem from "effect/FileSystem";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Layer from "effect/Layer";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { Header } from "tar";

// Golden outputs for the cache-pilot commands that replaced the #2850 shell
// adapters (ci-cache-native-sandbox.sh, ci-cache-pilot-cleanup.sh,
// ci-cache-pilot-inputs.sh). The expected bytes were captured from those
// scripts over these fixtures on 2026-11-07, before they were deleted. The
// sandbox and cleanup commands run through the slim CI entry, as the compiled
// binary would; input preparation runs its two stages in process.

const CI_ENTRY = "packages/tooling/tool/cli/src/bin-ci.ts";
const MAIN_ENTRY = "packages/tooling/tool/cli/src/bin.ts";

interface Run {
  readonly exitCode: number;
  readonly stderr: string;
  readonly stdout: string;
}

const run = (argv: ReadonlyArray<string>, cwd: string, env: Readonly<Record<string, string | undefined>>): Run => {
  const result = Bun.spawnSync([...argv], { cwd, env: { ...env }, stdout: "pipe", stderr: "pipe" });
  return { exitCode: result.exitCode, stdout: result.stdout.toString(), stderr: result.stderr.toString() };
};

const gitIn =
  (cwd: string) =>
  (args: ReadonlyArray<string>): string => {
    const result = Bun.spawnSync(
      [
        "git",
        "-c",
        "user.email=cache-pilot@example.test",
        "-c",
        "user.name=Cache Pilot",
        "-c",
        "commit.gpgsign=false",
        ...args,
      ],
      { cwd, stderr: "pipe", stdout: "pipe" }
    );
    assert.strictEqual(result.exitCode, 0, result.stderr.toString());
    return Str.trim(result.stdout.toString());
  };

// The real Bun executable: the PATH entry may be a version-manager wrapper
// script that needs tools a minimal fixture PATH leaves out.
const bunExecutable = (): string => {
  const result = Bun.spawnSync(["bun", "-e", "console.log(process.execPath)"], { stdout: "pipe", stderr: "pipe" });
  assert.strictEqual(result.exitCode, 0, result.stderr.toString());
  return Str.trim(result.stdout.toString());
};

const toolPath = Effect.fnUntraced(function* (name: string) {
  const fs = yield* FileSystem.FileSystem;
  const hostPath = yield* Config.String("PATH").pipe(Config.withDefault(""));
  const found = yield* Effect.findFirst(
    A.map(Str.split(hostPath, ":"), (directory) => `${directory}/${name}`),
    (file) => fs.exists(file)
  );
  assert.isTrue(found._tag === "Some", `${name} must be installed for the fixtures`);
  return found._tag === "Some" ? found.value : name;
});

it.layer(NodeServices.layer, { timeout: "120 seconds" })("cache pilot host command golden outputs", (it) => {
  it.effect(
    "installs bubblewrap through the same managers, privilege and messages as the shell adapter",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "ci-cache-sandbox-" }).pipe(Effect.flatMap(fs.realPath));
      const home = yield* Config.String("HOME");
      // Only fixture tools are reachable: hosted images ship apt-get in /usr/bin.
      const tools = path.join(root, "tools");
      yield* fs.makeDirectory(tools);
      yield* Effect.forEach(
        ["ls", "chmod"],
        Effect.fnUntraced(function* (name) {
          const target = yield* toolPath(name);
          yield* fs.symlink(target, path.join(tools, name));
        }),
        { discard: true }
      );
      const sudo = process.geteuid?.() !== 0;
      const sudoLine = (command: string) => (sudo ? `sudo -n ${command}\n` : "");
      const cases: ReadonlyArray<
        readonly [string, ReadonlyArray<string>, boolean, Readonly<Record<string, string>>, number, string, boolean]
      > = [
        // [label, package managers, bwrap present, env, exit, stdout (ls -l bodies dropped), apt pruned]
        ["present", [], true, {}, 0, "bubblewrap 0.11.0\n", false],
        [
          "dnf before apt-get",
          ["dnf", "apt-get"],
          false,
          {},
          0,
          `${sudoLine("dnf install -y bubblewrap")}dnf install -y bubblewrap\nbubblewrap 0.11.0\n`,
          false,
        ],
        [
          "apt-get prunes first",
          ["apt-get"],
          false,
          {},
          0,
          A.join(
            [
              "apt sources before pruning:\n",
              "<F>/apt/a.list\n<F>/apt/b.sources\n",
              "apt sources after pruning:\n",
              sudoLine("apt-get update"),
              "apt-get update\n",
              sudoLine("apt-get install -y --no-install-recommends bubblewrap"),
              "apt-get install -y --no-install-recommends bubblewrap\n",
              "bubblewrap 0.11.0\n",
            ],
            ""
          ),
          true,
        ],
        [
          "no manager",
          [],
          false,
          {},
          1,
          "::error::Producer inspection requires <F>/bwrap; no supported package manager.\n",
          false,
        ],
        [
          "install leaves no bwrap",
          ["dnf"],
          false,
          { FAKE_CREATE: "0" },
          1,
          `${sudoLine("dnf install -y bubblewrap")}dnf install -y bubblewrap\n`,
          false,
        ],
        [
          "failing install keeps its status",
          ["dnf"],
          false,
          { FAKE_STATUS: "3" },
          3,
          `${sudoLine("dnf install -y bubblewrap")}dnf install -y bubblewrap\n`,
          false,
        ],
        [
          "failing apt update keeps its status",
          ["apt-get"],
          false,
          { FAKE_STATUS: "5" },
          5,
          `apt sources before pruning:\n<F>/apt/a.list\n<F>/apt/b.sources\napt sources after pruning:\n${sudoLine("apt-get update")}apt-get update\n`,
          true,
        ],
      ];
      for (const [label, managers, present, env, exitCode, stdout, pruned] of cases) {
        const fixture = path.join(root, `case-${A.length(managers)}-${exitCode}-${label.length}`);
        const bin = path.join(fixture, "bin");
        const apt = path.join(fixture, "apt");
        yield* fs.makeDirectory(bin, { recursive: true });
        yield* fs.makeDirectory(apt);
        yield* Effect.forEach(["a.list", "ubuntu.sources", "b.sources", "keep.txt"], (name) =>
          fs.writeFileString(path.join(apt, name), "")
        );
        const bwrap = path.join(fixture, "bwrap");
        const bwrapScript = '#!/bin/bash\necho "bubblewrap 0.11.0"\n';
        yield* fs.writeFileString(path.join(bin, "sudo"), '#!/bin/bash\necho "sudo $*"\nshift\nexec "$@"\n');
        yield* Effect.forEach(managers, (manager) =>
          fs.writeFileString(
            path.join(bin, manager),
            A.join(
              [
                "#!/bin/bash",
                `echo "${manager} $*"`,
                `if [[ "$*" == *install* && "\${FAKE_CREATE:-1}" == 1 ]]; then printf '%s' '${bwrapScript}' > '${bwrap}'; chmod +x '${bwrap}'; fi`,
                'exit "${FAKE_STATUS:-0}"',
                "",
              ],
              "\n"
            )
          )
        );
        if (present) yield* fs.writeFileString(bwrap, bwrapScript);
        const scripts = yield* fs.readDirectory(bin);
        yield* Effect.forEach(scripts, (name) => fs.chmod(path.join(bin, name), 0o755));
        if (present) yield* fs.chmod(bwrap, 0o755);
        const result = run(
          [
            bunExecutable(),
            path.join(repoRoot, CI_ENTRY),
            "ci",
            "cache-sandbox",
            "--bwrap",
            bwrap,
            "--apt-sources",
            apt,
          ],
          fixture,
          { PATH: `${bin}:${tools}`, HOME: home, ...env }
        );
        const listed = A.join(
          A.filter(Str.split(result.stdout, "\n"), (line) => !/^(total|-rw)/u.test(line)),
          "\n"
        );
        expect(result.exitCode, `${label}: ${result.stderr}`).toBe(exitCode);
        expect(listed, label).toBe(Str.replaceAll("<F>", fixture)(stdout));
        expect(result.stderr, label).toBe("");
        const sources = yield* fs.readDirectory(apt);
        expect(A.sort(sources, Order.String), label).toEqual(
          pruned ? ["keep.txt", "ubuntu.sources"] : ["a.list", "b.sources", "keep.txt", "ubuntu.sources"]
        );
      }
    })
  );

  it.effect(
    "removes only the owned pilot layout and refuses everything else like the shell adapter",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const base = yield* fs.makeTempDirectoryScoped({ prefix: "ci-cache-cleanup-" }).pipe(Effect.flatMap(fs.realPath));
      const hostPath = yield* Config.String("PATH");
      const fixture = Effect.fnUntraced(function* (index: number) {
        const T = path.join(base, `case-${index}`);
        const ws = path.join(T, "ws");
        yield* fs.makeDirectory(ws, { recursive: true });
        const git = gitIn(ws);
        git(["init", "-q"]);
        git(["commit", "-q", "--allow-empty", "-m", "base"]);
        git(["worktree", "add", "-q", "--detach", `${ws}-worktrees/cache-producer-11-1-a`, "HEAD"]);
        git(["worktree", "add", "-q", "--detach", `${ws}-worktrees/cache-producer-11-1-b`, "HEAD"]);
        for (const directory of [
          "home/.cache/beep/cache-producer-trial-v1",
          "runner/beep-cache-local-observation.abc123",
          "runner/beep-cache-local-observation.abc12",
          "ws/.beep/cache/protected-producer-trial",
          "ws/.beep/cache/local-pilot-observation",
          "ws-worktrees/cache-producer-11-1-plain",
          "ws-worktrees/cache-producer-12-1-a",
          "foreign",
        ])
          yield* fs.makeDirectory(path.join(T, directory), { recursive: true });
        yield* fs.writeFileString(path.join(T, "foreign/sentinel"), "preserve\n");
        yield* fs.writeFileString(path.join(T, "ws/.beep/cache/protected-producer-trial/f"), "x\n");
        return { T, ws };
      });
      const tracked = [
        "home/.cache/beep/cache-producer-trial-v1",
        "runner/beep-cache-local-observation.abc123",
        "runner/beep-cache-local-observation.abc12",
        "ws/.beep/cache/protected-producer-trial",
        "ws/.beep/cache/local-pilot-observation",
        "ws-worktrees/cache-producer-11-1-a",
        "ws-worktrees/cache-producer-11-1-b",
        "ws-worktrees/cache-producer-11-1-plain",
        "ws-worktrees/cache-producer-12-1-a",
        "foreign/sentinel",
      ] as const;
      const TREE = "::error::Refusing unexpected producer worktree.\n";
      const INPUTS = "::error::Refusing unexpected producer input directory.\n";
      const PRIVATE = "::error::Refusing unexpected private pilot directory.\n";
      type Env = Readonly<Record<string, string>>;
      const layout = (T: string, ws: string) => ({
        trial: `${T}/home/.cache/beep/cache-producer-trial-v1`,
        local: `${T}/runner/beep-cache-local-observation.abc123`,
        signedInputs: `${ws}/.beep/cache/protected-producer-trial`,
        localInputs: `${ws}/.beep/cache/local-pilot-observation`,
        a: `${ws}-worktrees/cache-producer-11-1-a`,
        b: `${ws}-worktrees/cache-producer-11-1-b`,
      });
      const none = { TRIAL_ROOT: "", TRIAL_INPUTS: "", TRIAL_WORKTREE_A: "", TRIAL_WORKTREE_B: "" };
      // [label, mode argv, env, exit, stdout, stderr, removed tracked paths]
      const cases: ReadonlyArray<
        readonly [
          string,
          ReadonlyArray<string>,
          (T: string, ws: string) => Env,
          number,
          string,
          string,
          ReadonlyArray<(typeof tracked)[number]>,
        ]
      > = [
        ["unsupported mode", ["bogus"], () => none, 64, "", "Unsupported cleanup mode.\n", []],
        [
          "signed owned layout",
          ["signed"],
          (T, ws) => {
            const l = layout(T, ws);
            return { TRIAL_ROOT: l.trial, TRIAL_INPUTS: l.signedInputs, TRIAL_WORKTREE_A: l.a, TRIAL_WORKTREE_B: l.b };
          },
          0,
          "",
          "",
          [
            "home/.cache/beep/cache-producer-trial-v1",
            "ws/.beep/cache/protected-producer-trial",
            "ws-worktrees/cache-producer-11-1-a",
            "ws-worktrees/cache-producer-11-1-b",
          ],
        ],
        [
          "absent mode is signed",
          [],
          (T, ws) => ({ ...none, TRIAL_ROOT: layout(T, ws).trial }),
          0,
          "",
          "",
          ["home/.cache/beep/cache-producer-trial-v1"],
        ],
        [
          "foreign worktree",
          ["signed"],
          (T, ws) => {
            const l = layout(T, ws);
            return {
              TRIAL_ROOT: l.trial,
              TRIAL_INPUTS: l.signedInputs,
              TRIAL_WORKTREE_A: `${T}/foreign`,
              TRIAL_WORKTREE_B: l.b,
            };
          },
          1,
          TREE,
          "",
          [
            "home/.cache/beep/cache-producer-trial-v1",
            "ws/.beep/cache/protected-producer-trial",
            "ws-worktrees/cache-producer-11-1-b",
          ],
        ],
        [
          "missing worktrees are skipped",
          ["signed"],
          (T, ws) => ({
            ...none,
            TRIAL_ROOT: layout(T, ws).trial,
            TRIAL_WORKTREE_A: `${ws}-worktrees/cache-producer-11-1-zz`,
            TRIAL_WORKTREE_B: `${ws}-worktrees/cache-producer-11-1-c`,
          }),
          0,
          "",
          "",
          ["home/.cache/beep/cache-producer-trial-v1"],
        ],
        [
          "unowned worktree suffix",
          ["signed"],
          (T, ws) => ({
            ...none,
            TRIAL_ROOT: layout(T, ws).trial,
            TRIAL_WORKTREE_A: `${ws}-worktrees/cache-producer-11-1-plain`,
          }),
          1,
          TREE,
          "",
          ["home/.cache/beep/cache-producer-trial-v1"],
        ],
        [
          "signed refuses the local layout",
          ["signed"],
          (T, ws) => ({ ...none, TRIAL_ROOT: layout(T, ws).local, TRIAL_INPUTS: layout(T, ws).localInputs }),
          1,
          `${INPUTS}${PRIVATE}`,
          "",
          [],
        ],
        [
          "local refuses foreign inputs",
          ["local"],
          (T, ws) => ({ ...none, TRIAL_ROOT: layout(T, ws).local, TRIAL_INPUTS: `${T}/foreign` }),
          1,
          INPUTS,
          "",
          ["runner/beep-cache-local-observation.abc123"],
        ],
        [
          "local owned layout",
          ["local"],
          (T, ws) => ({
            ...none,
            TRIAL_ROOT: layout(T, ws).local,
            TRIAL_INPUTS: layout(T, ws).localInputs,
            TRIAL_WORKTREE_A: layout(T, ws).a,
          }),
          0,
          "",
          "",
          [
            "runner/beep-cache-local-observation.abc123",
            "ws/.beep/cache/local-pilot-observation",
            "ws-worktrees/cache-producer-11-1-a",
          ],
        ],
        [
          "local short suffix",
          ["local"],
          (T) => ({ ...none, TRIAL_ROOT: `${T}/runner/beep-cache-local-observation.abc12` }),
          1,
          PRIVATE,
          "",
          [],
        ],
        [
          "local nested suffix",
          ["local"],
          (T) => ({ ...none, TRIAL_ROOT: `${T}/runner/x/beep-cache-local-observation.abc123` }),
          1,
          PRIVATE,
          "",
          [],
        ],
        ["local empty root", ["local"], () => none, 1, PRIVATE, "", []],
        [
          "unset inputs stop before removal",
          ["signed"],
          () => ({ TRIAL_ROOT: "", TRIAL_WORKTREE_A: "", TRIAL_WORKTREE_B: "" }),
          1,
          "",
          "ci cache-pilot-cleanup: TRIAL_INPUTS: unbound variable\n",
          [],
        ],
      ];
      let index = 0;
      for (const [label, argv, env, exitCode, stdout, stderr, removed] of cases) {
        index += 1;
        const { T, ws } = yield* fixture(index);
        const result = run([bunExecutable(), path.join(repoRoot, CI_ENTRY), "ci", "cache-pilot-cleanup", ...argv], ws, {
          PATH: hostPath,
          HOME: `${T}/home`,
          GITHUB_WORKSPACE: ws,
          RUNNER_TEMP: `${T}/runner`,
          GITHUB_RUN_ID: "11",
          GITHUB_RUN_ATTEMPT: "1",
          ...env(T, ws),
        });
        expect(result.exitCode, `${label}: ${result.stderr}`).toBe(exitCode);
        expect(result.stdout, label).toBe(stdout);
        expect(result.stderr, label).toBe(stderr);
        for (const entry of tracked) {
          const observed1 = yield* fs.exists(path.join(T, entry));
          expect(observed1, `${label}: ${entry}`).toBe(!A.contains(removed, entry));
        }
      }

      // A failed `git worktree remove` of an owned path marks the run failed
      // but still removes the private directory.
      const { T, ws } = yield* fixture(index + 1);
      const failed = run([bunExecutable(), path.join(repoRoot, CI_ENTRY), "ci", "cache-pilot-cleanup", "signed"], ws, {
        PATH: hostPath,
        HOME: `${T}/home`,
        GITHUB_WORKSPACE: ws,
        RUNNER_TEMP: `${T}/runner`,
        GITHUB_RUN_ID: "12",
        GITHUB_RUN_ATTEMPT: "1",
        ...none,
        TRIAL_ROOT: `${T}/home/.cache/beep/cache-producer-trial-v1`,
        TRIAL_WORKTREE_A: `${ws}-worktrees/cache-producer-12-1-a`,
      });
      expect(failed.exitCode).toBe(1);
      expect(failed.stdout).toBe("");
      expect(failed.stderr).toContain("is not a working tree");
      const observed2 = yield* fs.exists(`${ws}-worktrees/cache-producer-12-1-a`);
      expect(observed2).toBe(true);
      const observed3 = yield* fs.exists(`${T}/home/.cache/beep/cache-producer-trial-v1`);
      expect(observed3).toBe(false);
    })
  );

  it.effect(
    "refuses unsupported input modes and computations with exit 64 before any tool runs",
    Effect.fnUntraced(function* () {
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const home = yield* Config.String("HOME");
      for (const [argv, message] of [
        [["signed", "@beep/types#lint"], "Signed execution remains restricted to identity lint.\n"],
        [["unknown", "@beep/identity#lint"], "Unsupported pilot input mode.\n"],
        [["local", "@beep/unknown#lint"], "Unsupported pilot computation.\n"],
      ] as const) {
        const result = run(
          [bunExecutable(), path.join(repoRoot, MAIN_ENTRY), "ci", "cache-pilot-inputs", ...argv],
          repoRoot,
          { PATH: path.dirname(bunExecutable()), HOME: home }
        );
        expect(result.exitCode, result.stderr).toBe(64);
        expect(result.stdout).toBe("");
        expect(result.stderr).toBe(message);
      }
    })
  );
});

// The two input stages, in process, against the bytes the Python heredocs wrote.
const SIMPLE_PROFILE =
  '{"$schema": "x", "tasks": {"lint": {"cache": false, "outputs": []}, "build": {"dependsOn": ["^build"]}}, "extends": ["//"]}';
const SIMPLE_AFTER =
  '{\n  "$schema": "x",\n  "tasks": {\n    "lint": {\n      "cache": true,\n      "outputs": []\n    },\n    "build": {\n      "dependsOn": [\n        "^build"\n      ]\n    }\n  },\n  "extends": [\n    "//"\n  ]\n}\n';
// Exercises `ensure_ascii` escapes (non-ASCII, DEL, an astral pair) and nesting.
const RICH_PROFILE = `{"$schema": "x", "tasks": {"lint": {"cache": false, "outputs": [], "env": ["café ✓ \u007f 😀", "q\\"\\\\\\n\\t"]}, "build": {"dependsOn": ["^build"], "x": {}}}, "extends": ["//"], "n": 3, "z": null}`;
const NATIVE = "fixture-native-never-executed";
const NATIVE_SHA256 = "1eef7aff593cc8a24fdb48945e027520bc48c59f1ef20f9fb2099d230cd4dc11";
const EMPTY_RECEIPT_SHA256 = "ca3d163bab055381827226140568f3bef7eaac187cebd76878e0b63e9e442356";

const sha256Hex = Effect.fnUntraced(function* (bytes: Uint8Array) {
  const digest = yield* Digest.Digest;
  const hash = yield* digest.digest(Digest.sha256, bytes);
  return Hex.encode(hash);
});

const tarEntry = (name: string, body: Uint8Array, type: "File" | "Directory" = "File") => {
  const header = NodeBuffer.Buffer.alloc(512);
  new Header({
    path: name,
    size: body.byteLength,
    type,
    mode: 0o755,
    mtime: DateTime.toDateUtc(DateTime.makeUnsafe(0)),
  }).encode(header);
  const padded = NodeBuffer.Buffer.alloc(Math.ceil(body.byteLength / 512) * 512);
  padded.set(body);
  return NodeBuffer.Buffer.concat([header, padded]);
};

// The registry answers every request with `archive`.
const registry = (archive: Uint8Array) =>
  Effect.provideService(
    HttpClient.HttpClient,
    HttpClient.make((request) =>
      Effect.succeed(HttpClientResponse.fromWeb(request, new Response(NodeBuffer.Buffer.from(archive))))
    )
  );

const encodeJson = S.encodeEffect(S.fromJsonString(S.Unknown));
const stageLayer = Layer.mergeAll(NodeServices.layer, NodeCrypto.layer);

it.layer(stageLayer, { timeout: "60 seconds" })("cache pilot input stages", (it) => {
  const makeRoot = Effect.fnUntraced(function* (profilePath: string, profile: string, pins: unknown) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const base = yield* fs.makeTempDirectoryScoped({ prefix: "ci-cache-inputs-" }).pipe(Effect.flatMap(fs.realPath));
    const root = path.join(base, "root");
    const write = Effect.fnUntraced(function* (relative: string, body: string | Uint8Array) {
      yield* fs.makeDirectory(path.dirname(path.join(root, relative)), { recursive: true });
      yield* P.isString(body)
        ? fs.writeFileString(path.join(root, relative), body)
        : fs.writeFile(path.join(root, relative), body);
    });
    yield* write("node_modules/@turbo/linux-64/bin/turbo", NATIVE);
    yield* write("node_modules/@biomejs/cli-linux-x64/biome", "fixture-biome-never-executed");
    yield* write("fixture-bin/node", "fixture-node-never-executed");
    yield* fs.chmod(path.join(root, "fixture-bin/node"), 0o500);
    const pinsJson = yield* encodeJson(pins);
    yield* write("goals/turborepo-quality-cache-adoption/research/errors-only-client-pins.json", pinsJson);
    yield* write(profilePath, profile);
    yield* fs.makeDirectory(path.join(base, "private"));
    const git = gitIn(root);
    git(["init", "-q"]);
    git(["commit", "-q", "--allow-empty", "-m", "base"]);
    return { base, root, revision: git(["rev-parse", "HEAD"]), output: path.join(base, "outputs") };
  });
  const environment = (base: string, root: string, revision: string, channel: string) =>
    ConfigProvider.fromUnknown(
      {
        BEEP_CACHE_PRODUCER_PRIVATE_ROOT: `${base}/private`,
        BEEP_CACHE_PRODUCER_CHANNEL: channel,
        GITHUB_RUN_ID: "11",
        GITHUB_RUN_ATTEMPT: "1",
        GITHUB_SHA: revision,
        GITHUB_OUTPUT: `${base}/outputs`,
        PATH: `${root}/fixture-bin`,
      },
      { preserveEmptyStrings: true }
    );
  const stablePins = {
    stable: { reportedVersion: "2.11.10", sha256: NATIVE_SHA256 },
    canary: { reportedVersion: "x", sha256: "x" },
  };

  it.effect(
    "writes both request layouts with the adapter's JSON framing, modes and output lines",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      for (const [mode, computation, profilePath, profile] of [
        ["signed", "@beep/identity#lint", "packages/foundation/modeling/identity/turbo.json", SIMPLE_PROFILE],
        ["local", "@beep/types#lint", "packages/foundation/primitive/types/turbo.json", RICH_PROFILE],
      ] as const) {
        const { base, root, revision, output } = yield* makeRoot(profilePath, profile, stablePins);
        const relative = cachePilotInputDirectory[mode];
        const folder = `${root}/${relative}`;
        const provide = Effect.provideService(CiStepEnvironment, environment(base, root, revision, "stable"));
        yield* prepareCachePilotSources(root, mode, computation).pipe(provide, registry(new Uint8Array()));
        const trees = [`${base}/root-worktrees/cache-producer-11-1-a`, `${base}/root-worktrees/cache-producer-11-1-b`];
        const observed4 = yield* fs.readFileString(output);
        expect(observed4).toBe(`source_inputs=${folder}\nworktree_a=${trees[0]}\nworktree_b=${trees[1]}\n`);
        const observed5 = yield* fs.readFileString(`${folder}/before.json`);
        expect(observed5).toBe(profile);
        const after = yield* fs.readFile(`${folder}/after.json`);
        if (mode === "signed") expect(new TextDecoder().decode(after)).toBe(SIMPLE_AFTER);
        const beforeSha =
          mode === "signed"
            ? "a84f22afdb695ee3a25c45dd54c92f49ca49f0b35528fca6a267f91efefa488b"
            : "c38769189f38a25fd91fda87117beef0f24bd964254447a75f55a9031c899cfb";
        const afterSha =
          mode === "signed"
            ? "426bee72da937b636c96d7645f9e89f90d44f2c3d071ecc2a6bb95c7aebf7099"
            : "4cebffecd981e0075b26d0e6172c4514cc114b917e0388eff1b71c697b2df6bf";
        const observed6 = yield* sha256Hex(after);
        expect(observed6).toBe(afterSha);
        const observed7 = yield* fs.readFileString(`${folder}/activation-request.json`);
        expect(observed7).toBe(
          `{"computation": "${computation}", "path": "${profilePath}", "before": {"path": "${relative}/before.json", "sha256": "${beforeSha}"}, "after": {"path": "${relative}/after.json", "sha256": "${afterSha}"}}\n`
        );
        const namespace = mode === "signed" ? "team_beep_signed_canary_v1" : "team_beep_local_observation_v1";
        const client = `{"version": "2.11.10", "sha256": "${NATIVE_SHA256}", "namespace": "${namespace}"}`;
        const worktrees = `["${trees[0]}", "${trees[1]}"]`;
        const observed8 = yield* fs.readFileString(`${folder}/tools.json`);
        expect(observed8).toBe(
          `{"executable": "${root}/node_modules/@turbo/linux-64/bin/turbo", "client": ${client}, "worktrees": ${worktrees}}\n`
        );
        expect((yield* fs.stat(folder)).mode & 0o777).toBe(0o700);
        expect((yield* fs.stat(`${root}/.beep/cache`)).mode & 0o777).toBe(0o700);
        // An existing input directory is never reused.
        const reused = yield* prepareCachePilotSources(root, mode, computation).pipe(
          provide,
          registry(new Uint8Array()),
          Effect.isFailure
        );
        assert.isTrue(reused);

        for (const name of ["dependencies.json", "activation.json"])
          yield* fs.writeFileString(`${folder}/${name}`, "{}\n");
        yield* prepareCachePilotRequest(root, mode).pipe(provide);
        const receipt = (name: string) => `{"path": "${relative}/${name}", "sha256": "${EMPTY_RECEIPT_SHA256}"}`;
        const pilot = `{"channel": "stable", "client": ${client}, "executable": "${root}/node_modules/@turbo/linux-64/bin/turbo", "biomeExecutable": "${root}/node_modules/@biomejs/cli-linux-x64/biome", "nodeExecutable": "${root}/fixture-bin/node", "dependencies": ${receipt("dependencies.json")}, "worktrees": ${worktrees}, "activation": ${receipt("activation.json")}, "selection": "full"}`;
        const observed9 = yield* fs.readFileString(`${folder}/request.json`);
        expect(observed9).toBe(mode === "signed" ? `{"sourceRoot": "${root}", "pilot": ${pilot}}\n` : `${pilot}\n`);
        for (const tree of trees) expect(gitIn(tree)(["rev-parse", "HEAD"])).toBe(revision);
        expect((yield* fs.stat(`${base}/root-worktrees`)).mode & 0o777).toBe(0o700);
      }
    })
  );

  it.effect(
    "refuses unreviewed channels, changed profiles, invalid run identity and unpinned clients",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const profilePath = "packages/foundation/primitive/types/turbo.json";
      const attempt = Effect.fnUntraced(function* (
        profile: string,
        pins: unknown,
        overrides: Readonly<Record<string, string>>
      ) {
        const { base, root, revision } = yield* makeRoot(profilePath, profile, pins);
        const provider = ConfigProvider.fromUnknown(
          {
            BEEP_CACHE_PRODUCER_PRIVATE_ROOT: `${base}/private`,
            BEEP_CACHE_PRODUCER_CHANNEL: "stable",
            GITHUB_RUN_ID: "11",
            GITHUB_RUN_ATTEMPT: "1",
            GITHUB_SHA: revision,
            GITHUB_OUTPUT: `${base}/outputs`,
            ...overrides,
          },
          { preserveEmptyStrings: true }
        );
        const exit = yield* prepareCachePilotSources(root, "local", "@beep/types#lint").pipe(
          Effect.provideService(CiStepEnvironment, provider),
          registry(new Uint8Array()),
          Effect.exit
        );
        return { exit, root, output: yield* fs.exists(`${base}/outputs`) };
      });
      const failedWith = (exit: unknown, message: string) => expect(String(exit)).toContain(message);
      const nightly = yield* attempt(SIMPLE_PROFILE, stablePins, { BEEP_CACHE_PRODUCER_CHANNEL: "nightly" });
      failedWith(nightly.exit, "Only the two reviewed native channels are supported.");
      const cached = yield* attempt(Str.replace('"cache": false', '"cache": true')(SIMPLE_PROFILE), stablePins, {});
      failedWith(cached.exit, "The selected lint pilot source profile changed; renew its review.");
      const zeroRun = yield* attempt(SIMPLE_PROFILE, stablePins, { GITHUB_RUN_ID: "011" });
      failedWith(zeroRun.exit, "Hosted run identity is invalid.");
      expect(zeroRun.output).toBe(false);
      const unpinned = yield* attempt(
        SIMPLE_PROFILE,
        { ...stablePins, stable: { reportedVersion: "2.11.10", sha256: Str.repeat(64)("0") } },
        {}
      );
      failedWith(unpinned.exit, "Native client differs from its reviewed binary pin.");
      const observed10 = yield* fs.exists(`${unpinned.root}/.beep`);
      expect(observed10).toBe(false);
    })
  );

  it.effect(
    "verifies, bounds and extracts the canary client before writing its private executable",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const digest = yield* Digest.Digest;
      const member = "turbo-linux-x64/bin/turbo";
      const native = new TextEncoder().encode("fixture-canary-never-executed");
      const archive = NodeZlib.gzipSync(
        NodeBuffer.Buffer.concat([
          tarEntry("turbo-linux-x64/", new Uint8Array(), "Directory"),
          tarEntry(member, native),
          NodeBuffer.Buffer.alloc(1024),
        ])
      );
      const archiveDigest = yield* digest.digest(Digest.sha512, archive);
      const integrity = `sha512-${Base64.encode(archiveDigest)}`;
      const canary = (overrides: Readonly<Record<string, string>>) => ({
        stable: { reportedVersion: "2.11.10", sha256: NATIVE_SHA256 },
        canary: {
          reportedVersion: "2.11.11-canary.1",
          sha256: "",
          tarball: "https://registry.npmjs.org/@turbo/linux-64/-/linux-64-2.11.11-canary.1.tgz",
          integrity,
          archiveMember: member,
          ...overrides,
        },
      });
      const nativeSha = yield* sha256Hex(native);
      const prepare = Effect.fnUntraced(function* (pins: unknown) {
        const { base, root, revision } = yield* makeRoot(
          "packages/foundation/primitive/types/turbo.json",
          SIMPLE_PROFILE,
          pins
        );
        const exit = yield* prepareCachePilotSources(root, "local", "@beep/types#lint").pipe(
          Effect.provideService(CiStepEnvironment, environment(base, root, revision, "canary")),
          registry(archive),
          Effect.exit
        );
        return { exit, base, root };
      });
      const accepted = yield* prepare(canary({ sha256: nativeSha }));
      assert.strictEqual(accepted.exit._tag, "Success", String(accepted.exit));
      const executable = `${accepted.base}/private/turbo-canary`;
      const observed11 = yield* fs.readFileString(executable);
      expect(observed11).toBe("fixture-canary-never-executed");
      expect((yield* fs.stat(executable)).mode & 0o777).toBe(0o500);
      const observed12 = yield* fs.readFileString(`${accepted.root}/.beep/cache/local-pilot-observation/tools.json`);
      expect(observed12).toContain(
        `{"executable": "${executable}", "client": {"version": "2.11.11-canary.1", "sha256": "${nativeSha}"`
      );
      for (const [overrides, message] of [
        [{ tarball: "http://registry.npmjs.org/x.tgz" }, "Native canary must use its reviewed public registry source."],
        [
          { tarball: "https://registry.npmjs.org.evil/x.tgz" },
          "Native canary must use its reviewed public registry source.",
        ],
        [
          { tarball: "https://registry.npmjs.org/x.tgz?y=1" },
          "Native canary must use its reviewed public registry source.",
        ],
        [{ integrity: "sha512-AAAA" }, "Native canary archive differs from its reviewed integrity."],
        [{ archiveMember: "turbo-linux-x64" }, "Native canary executable member is invalid."],
        [{ archiveMember: "package/bin/turbo" }, "Native canary executable member is invalid."],
        [{ sha256: Str.repeat(64)("0") }, "Native client differs from its reviewed binary pin."],
      ] as const) {
        const refused = yield* prepare(canary({ sha256: nativeSha, ...overrides }));
        expect(String(refused.exit), message).toContain(message);
      }
    })
  );
});
