/**
 * Credential-free input preparation for the hosted cache pilot jobs.
 *
 * **Details**
 *
 * `beep ci cache-pilot-inputs` replaces the retired shell-and-Python adapter
 * that fed the typed `beep cache dependencies`, `beep cache activation` and
 * pilot commands. It writes the same files with the same bytes (JSON in
 * Python's `json.dumps` framing), the same `GITHUB_OUTPUT` lines and the same
 * refusal messages, under the same `umask 077`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as NodeBuffer from "node:buffer";
import * as NodeZlib from "node:zlib";
import { CliReportedExit, failWithReportedExit } from "@beep/repo-cli-kit/cli/ExitCodeError";
import { Sha256HexFromBytes } from "@beep/schema";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Digest from "effect/crypto/Digest";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Base64 from "effect/encoding/Base64";
import * as FileSystem from "effect/FileSystem";
import * as HttpClient from "effect/http/HttpClient";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { Parser } from "tar";
import { CiCachePilotComputation, CiCachePilotMode } from "./CiCachePilot.schemas.ts";
import { readStepVariable } from "./CiCachePilotHost.ts";

const COMMAND = "ci cache-pilot-inputs";
const MiB = 1024 * 1024;
const PINS_FILE = "goals/turborepo-quality-cache-adoption/research/errors-only-client-pins.json";
const STABLE_EXECUTABLE = "node_modules/@turbo/linux-64/bin/turbo";
const BIOME_EXECUTABLE = "node_modules/@biomejs/cli-linux-x64/biome";
const inherited = { stdin: "inherit", stdout: "inherit", stderr: "inherit" } as const;
const lintProfiles: Readonly<Record<CiCachePilotComputation, string>> = {
  "@beep/identity#lint": "packages/foundation/modeling/identity/turbo.json",
  "@beep/types#lint": "packages/foundation/primitive/types/turbo.json",
};
const isPilotMode = S.is(CiCachePilotMode);
const isPilotComputation = S.is(CiCachePilotComputation);
const RunNumber = S.String.check(S.isPattern(/^[1-9][0-9]*$/u));
const isRunNumber = S.is(RunNumber);
const hashBytes = S.decodeEffect(Sha256HexFromBytes);
const JsonRecord = S.Record(S.String, S.Unknown);
const isJsonRecord = S.is(JsonRecord);
const isJsonArray = S.is(S.Array(S.Unknown));
const decodeJson = S.decodeUnknownEffect(S.fromJsonString(S.Unknown));
const isReportedExit = S.is(CliReportedExit);
const decoder = new TextDecoder();

/**
 * The input directory, relative to the checkout, that each pilot mode owns.
 *
 * **Example** (Locate the local observation inputs)
 *
 * ```ts
 * import { cachePilotInputDirectory } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(cachePilotInputDirectory.local) // ".beep/cache/local-pilot-observation"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const cachePilotInputDirectory: Readonly<Record<CiCachePilotMode, string>> = {
  signed: ".beep/cache/protected-producer-trial",
  local: ".beep/cache/local-pilot-observation",
};

// A refusal the Python adapter raised as `SystemExit(message)`: stderr, exit 1.
const refuse = (message: string) => Console.error(message).pipe(Effect.andThen(failWithReportedExit(message)));
const variable = (name: string) => readStepVariable(COMMAND, name);

// `json.dumps` string framing with its default `ensure_ascii=True`: the
// short escapes, then every unit outside printable ASCII (control units, DEL,
// non-ASCII and lone surrogates) as a lowercase `\uXXXX` escape.
const shortEscapes: Readonly<Record<string, string>> = {
  '"': '\\"',
  "\\": "\\\\",
  "\b": "\\b",
  "\f": "\\f",
  "\n": "\\n",
  "\r": "\\r",
  "\t": "\\t",
};
const hexDigits = Str.split("0123456789abcdef", "");
const escapeUnit = (unit: string): string =>
  O.getOrElse(R.get(shortEscapes, unit), () => {
    const code = O.getOrElse(Str.charCodeAt(unit, 0), () => 0);
    return code >= 0x20 && code < 0x7f
      ? unit
      : `\\u${A.join(
          A.map([12, 8, 4, 0], (shift) => A.getUnsafe(hexDigits, (code >>> shift) & 15)),
          ""
        )}`;
  });
const pythonString = (value: string) => `"${A.join(A.map(Str.split(value, ""), escapeUnit), "")}"`;

// `json.dumps(value)` (`", "` and `": "` separators) or, with a width,
// `json.dumps(value, indent=width)`. Keys keep their insertion order.
const pythonJson = (value: unknown, indent: O.Option<number>, level = 0): string => {
  const frame = (open: string, close: string, items: ReadonlyArray<string>) =>
    A.isReadonlyArrayNonEmpty(items)
      ? O.match(indent, {
          onNone: () => `${open}${A.join(items, ", ")}${close}`,
          onSome: (width) => {
            const inner = `\n${Str.repeat((level + 1) * width)(" ")}`;
            return `${open}${inner}${A.join(items, `,${inner}`)}\n${Str.repeat(level * width)(" ")}${close}`;
          },
        })
      : `${open}${close}`;
  const nested = (item: unknown) => pythonJson(item, indent, level + 1);
  return Match.value(value).pipe(
    Match.when(P.isString, pythonString),
    Match.when(P.isBoolean, (flag) => (flag ? "true" : "false")),
    Match.when(P.isNumber, (number) => `${number}`),
    Match.when(isJsonArray, (items) => frame("[", "]", A.map(items, nested))),
    Match.when(isJsonRecord, (record) =>
      frame(
        "{",
        "}",
        A.map(R.toEntries(record), ([key, item]) => `${pythonString(key)}: ${nested(item)}`)
      )
    ),
    Match.orElse(() => "null")
  );
};
const compactJson = (value: unknown) => `${pythonJson(value, O.none())}\n`;

const CachePilotClientPin = S.Struct({
  reportedVersion: S.String,
  sha256: S.String,
  tarball: S.optionalKey(S.String),
  integrity: S.optionalKey(S.String),
  archiveMember: S.optionalKey(S.String),
});
const CachePilotClientPins = S.Struct({ stable: CachePilotClientPin, canary: CachePilotClientPin });
const decodePins = S.decodeUnknownEffect(S.fromJsonString(CachePilotClientPins));
const CachePilotTools = S.Struct({
  executable: S.String,
  client: S.Unknown,
  worktrees: S.Tuple([S.String, S.String]),
});
const decodeTools = S.decodeUnknownEffect(S.fromJsonString(CachePilotTools));

// `urllib.parse.urlsplit`: scheme, netloc, query and fragment of a URL.
const UrlParts = /^([^:/?#]+):\/\/([^/?#]*)[^?#]*(?:\?([^#]*))?(?:#(.*))?$/u;
const isReviewedRegistryUrl = (url: string) =>
  O.match(Str.match(UrlParts)(url), {
    onNone: () => false,
    onSome: (parts) =>
      Str.toLowerCase(parts[1] ?? "") === "https" &&
      parts[2] === "registry.npmjs.org" &&
      Str.isEmpty(parts[3] ?? "") &&
      Str.isEmpty(parts[4] ?? ""),
  });

interface ArchiveMember {
  readonly data: Array<Uint8Array>;
  readonly file: boolean;
  readonly name: string;
  readonly size: number;
}

// `tarfile.getmembers()` over an already decompressed archive; pax and GNU
// long-name records fold into the member they describe.
const tarMembers = (archive: Uint8Array) =>
  Effect.try({
    try: () => {
      const members: Array<ArchiveMember> = [];
      const parser = new Parser({
        strict: true,
        onReadEntry: (entry) => {
          const member: ArchiveMember = {
            name: entry.type === "Directory" ? Str.replace(/\/+$/u, "")(entry.path) : entry.path,
            file: entry.type === "File" || entry.type === "OldFile" || entry.type === "ContiguousFile",
            size: entry.size,
            data: [],
          };
          entry.on("data", (chunk: Uint8Array) => member.data.push(chunk));
          members.push(member);
        },
      });
      parser.on("error", (cause) => {
        throw cause;
      });
      parser.end(NodeBuffer.Buffer.from(archive.buffer, archive.byteOffset, archive.byteLength));
      return members;
    },
    catch: () => "unreadable",
  });

const fetchCanary = Effect.fn("Ci.fetchCachePilotCanary")(function* (
  pin: typeof CachePilotClientPin.Type,
  privateRoot: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const client = yield* HttpClient.HttpClient;
  const tarball = pin.tarball ?? "";
  if (!isReviewedRegistryUrl(tarball))
    return yield* refuse("Native canary must use its reviewed public registry source.");
  const archive = yield* client.get(tarball).pipe(
    Effect.flatMap((response) => response.arrayBuffer),
    Effect.map((buffer) => new Uint8Array(buffer)),
    Effect.timeout(Duration.seconds(30)),
    Effect.catch(() => refuse("Native canary archive could not be downloaded."))
  );
  const digest = yield* Digest.Digest;
  const archiveDigest = yield* digest.digest(Digest.sha512, archive);
  const integrity = `sha512-${Base64.encode(archiveDigest)}`;
  if (archive.byteLength > 64 * MiB || integrity !== pin.integrity)
    return yield* refuse("Native canary archive differs from its reviewed integrity.");
  const bounds = "Native canary archive exceeds its reviewed extraction bounds.";
  const unpacked = yield* Effect.try({
    try: () => NodeZlib.gunzipSync(archive, { maxOutputLength: 160 * MiB }),
    catch: () => "unbounded",
  }).pipe(Effect.catch(() => refuse(bounds)));
  const members = yield* tarMembers(unpacked).pipe(
    Effect.catch(() => refuse("Native canary archive is not a readable gzip tar archive."))
  );
  if (A.length(members) > 32 || A.reduce(members, 0, (total, member) => total + member.size) > 128 * MiB)
    return yield* refuse(bounds);
  const matches = A.filter(members, (member) => member.name === pin.archiveMember);
  const member = A.get(matches, 0);
  if (
    A.length(matches) !== 1 ||
    O.isNone(member) ||
    !member.value.file ||
    member.value.size <= 0 ||
    member.value.size > 64 * MiB
  )
    return yield* refuse("Native canary executable member is invalid.");
  const executable = path.join(privateRoot, "turbo-canary");
  yield* fs.writeFile(executable, NodeBuffer.Buffer.concat(member.value.data), { flag: "wx" });
  yield* fs.chmod(executable, 0o500);
  return executable;
});

// `{'path': <checkout-relative>, 'sha256': <hex>}` for one prepared input file.
const fileReference = Effect.fn("Ci.cachePilotReference")(function* (folder: string, relative: string, name: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const bytes = yield* fs.readFile(path.join(folder, name));
  const sha256 = yield* hashBytes(bytes);
  return { path: `${relative}/${name}`, sha256 };
});

/**
 * Write the pilot's source profiles, activation request and tool selection.
 *
 * **Details**
 *
 * The first stage of `beep ci cache-pilot-inputs`. It verifies the native
 * Turbo client against its reviewed pin (downloading and checking the canary
 * archive first on the canary channel), creates the mode's input directory
 * (mode `0700`, refusing an existing one), writes `before.json`,
 * `after.json` with lint caching enabled, `activation-request.json` and
 * `tools.json`, and appends `source_inputs`, `worktree_a` and `worktree_b` to
 * `GITHUB_OUTPUT`. It reads `BEEP_CACHE_PRODUCER_PRIVATE_ROOT`,
 * `BEEP_CACHE_PRODUCER_CHANNEL`, `GITHUB_RUN_ID`, `GITHUB_RUN_ATTEMPT` and
 * `GITHUB_OUTPUT` from the step environment.
 *
 * **Example** (Prepare the local observation sources)
 *
 * ```ts
 * import { prepareCachePilotSources } from "@beep/repo-cli/commands/Ci"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(prepareCachePilotSources("/repo", "local", "@beep/types#lint"))) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const prepareCachePilotSources = Effect.fn("Ci.prepareCachePilotSources")(function* (
  root: string,
  mode: CiCachePilotMode,
  computation: CiCachePilotComputation
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const privateRoot = yield* variable("BEEP_CACHE_PRODUCER_PRIVATE_ROOT");
  const channel = yield* variable("BEEP_CACHE_PRODUCER_CHANNEL");
  if (channel !== "stable" && channel !== "canary")
    return yield* refuse("Only the two reviewed native channels are supported.");
  const pins = yield* fs.readFileString(path.join(root, PINS_FILE)).pipe(Effect.flatMap(decodePins));
  const pin = pins[channel];
  const executable = channel === "canary" ? yield* fetchCanary(pin, privateRoot) : path.join(root, STABLE_EXECUTABLE);
  const executableBytes = yield* fs.readFile(executable);
  const executableDigest = yield* hashBytes(executableBytes);
  if (executableDigest !== pin.sha256) return yield* refuse("Native client differs from its reviewed binary pin.");
  const relative = cachePilotInputDirectory[mode];
  const folder = path.join(root, relative);
  yield* fs.makeDirectory(path.dirname(folder), { recursive: true, mode: 0o700 });
  yield* fs.makeDirectory(folder, { mode: 0o700 });
  const profile = lintProfiles[computation];
  const before = yield* fs.readFile(path.join(root, profile));
  const source = yield* decodeJson(decoder.decode(before));
  const tasks = isJsonRecord(source) ? source.tasks : undefined;
  const lint = isJsonRecord(tasks) ? tasks.lint : undefined;
  if (!isJsonRecord(source) || !isJsonRecord(tasks) || !isJsonRecord(lint))
    return yield* refuse(`${COMMAND}: ${profile} has no tasks.lint object`);
  if (lint.cache !== false) return yield* refuse("The selected lint pilot source profile changed; renew its review.");
  // Spreading keeps every key in place, so only `cache` changes in the output.
  const after = { ...source, tasks: { ...tasks, lint: { ...lint, cache: true } } };
  yield* fs.writeFile(path.join(folder, "before.json"), before);
  yield* fs.writeFileString(path.join(folder, "after.json"), `${pythonJson(after, O.some(2))}\n`);
  const reference = (name: string) => fileReference(folder, relative, name);
  const beforeReference = yield* reference("before.json");
  const afterReference = yield* reference("after.json");
  yield* fs.writeFileString(
    path.join(folder, "activation-request.json"),
    compactJson({ computation, path: profile, before: beforeReference, after: afterReference })
  );
  const runId = yield* variable("GITHUB_RUN_ID");
  const runAttempt = yield* variable("GITHUB_RUN_ATTEMPT");
  if (!isRunNumber(runId) || !isRunNumber(runAttempt)) return yield* refuse("Hosted run identity is invalid.");
  const trees = A.map(["a", "b"], (suffix) => `${root}-worktrees/cache-producer-${runId}-${runAttempt}-${suffix}`);
  const resolvedExecutable = yield* fs.realPath(executable);
  yield* fs.writeFileString(
    path.join(folder, "tools.json"),
    compactJson({
      executable: resolvedExecutable,
      client: {
        version: pin.reportedVersion,
        sha256: pin.sha256,
        namespace: mode === "signed" ? "team_beep_signed_canary_v1" : "team_beep_local_observation_v1",
      },
      worktrees: trees,
    })
  );
  const outputFile = yield* variable("GITHUB_OUTPUT");
  yield* fs.writeFileString(outputFile, `source_inputs=${folder}\nworktree_a=${trees[0]}\nworktree_b=${trees[1]}\n`, {
    flag: "a",
  });
});

// `shutil.which`: the first executable regular file named `name` on `PATH`.
const which = Effect.fn("Ci.cachePilotWhich")(function* (name: string) {
  const fs = yield* FileSystem.FileSystem;
  const searchPath = yield* variable("PATH");
  return yield* Effect.findFirst(
    A.map(Str.split(searchPath, ":"), (directory) => `${Str.isEmpty(directory) ? "." : directory}/${name}`),
    (file) =>
      fs.stat(file).pipe(
        Effect.map((info) => info.type === "File" && (info.mode & 0o111) !== 0),
        Effect.orElseSucceed(() => false)
      )
  );
});

/**
 * Add the two detached pilot worktrees and write the pilot request.
 *
 * **Details**
 *
 * The second stage of `beep ci cache-pilot-inputs`, after the dependency and
 * activation receipts exist. It creates the worktree parent (mode `0700`),
 * runs `git worktree add --detach <tree> $GITHUB_SHA` for each tree, then
 * writes `request.json`: the full signed producer request in `signed` mode,
 * its `pilot` member alone in `local` mode.
 *
 * **Example** (Write the local observation request)
 *
 * ```ts
 * import { prepareCachePilotRequest } from "@beep/repo-cli/commands/Ci"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(prepareCachePilotRequest("/repo", "local"))) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const prepareCachePilotRequest = Effect.fn("Ci.prepareCachePilotRequest")(function* (
  root: string,
  mode: CiCachePilotMode
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const relative = cachePilotInputDirectory[mode];
  const folder = path.join(root, relative);
  const tools = yield* fs.readFileString(path.join(folder, "tools.json")).pipe(Effect.flatMap(decodeTools));
  const parent = path.dirname(tools.worktrees[0]);
  if (!(yield* fs.exists(parent))) yield* fs.makeDirectory(parent, { mode: 0o700 });
  const revision = yield* variable("GITHUB_SHA");
  yield* Effect.forEach(
    tools.worktrees,
    Effect.fnUntraced(function* (tree) {
      const handle = yield* spawner.spawn(
        ChildProcess.make("git", ["worktree", "add", "--detach", tree, revision], { ...inherited, cwd: root })
      );
      const status = yield* handle.exitCode;
      if (status !== 0) return yield* refuse(`${COMMAND}: git worktree add exited ${Number(status)}`);
    }, Effect.scoped),
    { concurrency: 1, discard: true }
  );
  const reference = (name: string) => fileReference(folder, relative, name);
  const node = yield* which("node");
  if (O.isNone(node)) return yield* refuse(`${COMMAND}: node is not on PATH`);
  const channel = yield* variable("BEEP_CACHE_PRODUCER_CHANNEL");
  const biomeExecutable = yield* fs.realPath(path.join(root, BIOME_EXECUTABLE));
  const nodeExecutable = yield* fs.realPath(node.value);
  const dependencies = yield* reference("dependencies.json");
  const activation = yield* reference("activation.json");
  const pilot = {
    channel,
    client: tools.client,
    executable: tools.executable,
    biomeExecutable,
    nodeExecutable,
    dependencies,
    worktrees: tools.worktrees,
    activation,
    selection: "full",
  };
  yield* fs.writeFileString(
    path.join(folder, "request.json"),
    compactJson(mode === "signed" ? { sourceRoot: root, pilot } : pilot)
  );
});

const runStatus = Effect.fn("Ci.cachePilotRun")(function* (
  command: string,
  args: ReadonlyArray<string>,
  stdout: "inherit" | "pipe",
  env: Readonly<Record<string, string>>
) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const handle = yield* spawner.spawn(
    ChildProcess.make(command, args, { stdin: "inherit", stdout, stderr: "inherit", env, extendEnv: true })
  );
  const [output, status] = yield* Effect.all(
    [stdout === "pipe" ? handle.stdout.pipe(Stream.decodeText, Stream.mkString) : Effect.succeed(""), handle.exitCode],
    { concurrency: 2 }
  );
  return { output, status: Number(status) };
}, Effect.scoped);

/**
 * Prepare the fixed full-pilot inputs of a hosted cache pilot job.
 *
 * **Details**
 *
 * Accepts `signed` (the default, `@beep/identity#lint` only) or `local` with
 * either reviewed computation; anything else exits 64 before a tool runs.
 * Under `umask 077` it requires a clean checkout at `$GITHUB_SHA`, runs
 * {@link prepareCachePilotSources}, `beep cache dependencies`,
 * `beep cache activation` and {@link prepareCachePilotRequest}, and requires
 * the checkout to stay clean. A failing step ends the command with its exit
 * status. The mode, computation and input directory reach the child commands
 * as `BEEP_CACHE_PILOT_MODE`, `BEEP_CACHE_PILOT_COMPUTATION` and
 * `BEEP_CACHE_PILOT_INPUTS`.
 *
 * **Example** (Prepare the signed producer inputs)
 *
 * ```ts
 * import { runCachePilotInputs } from "@beep/repo-cli/commands/Ci"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(runCachePilotInputs("signed", "@beep/identity#lint"))) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const runCachePilotInputs = Effect.fn("Ci.runCachePilotInputs")(function* (mode: string, computation: string) {
  if (!isPilotMode(mode)) {
    yield* Console.error("Unsupported pilot input mode.");
    return yield* failWithReportedExit("Unsupported pilot input mode.", 64);
  }
  if (!isPilotComputation(computation)) {
    yield* Console.error("Unsupported pilot computation.");
    return yield* failWithReportedExit("Unsupported pilot computation.", 64);
  }
  if (mode === "signed" && computation !== "@beep/identity#lint") {
    yield* Console.error("Signed execution remains restricted to identity lint.");
    return yield* failWithReportedExit("Signed execution remains restricted to identity lint.", 64);
  }
  const path = yield* Path.Path;
  const inputs = cachePilotInputDirectory[mode];
  const env = {
    BEEP_CACHE_PILOT_MODE: mode,
    BEEP_CACHE_PILOT_COMPUTATION: computation,
    BEEP_CACHE_PILOT_INPUTS: inputs,
  };
  const step = Effect.fn("Ci.cachePilotStep")(function* (command: string, args: ReadonlyArray<string>) {
    const { status } = yield* runStatus(command, args, "inherit", env);
    if (status !== 0) return yield* failWithReportedExit(`${command} exited ${status}`, status);
  });
  const root = path.resolve(".");
  const program = Effect.gen(function* () {
    const head = yield* runStatus("git", ["rev-parse", "HEAD"], "pipe", env);
    // `$(git rev-parse HEAD)` drops trailing newlines before the comparison.
    const revision = yield* variable("GITHUB_SHA");
    if (Str.replace(/\n+$/u, "")(head.output) !== revision)
      return yield* failWithReportedExit("Checkout is not at GITHUB_SHA.");
    yield* step("git", ["diff", "--quiet", "HEAD"]);
    yield* prepareCachePilotSources(root, mode, computation);
    yield* step("bun", [
      "--no-env-file",
      "run",
      "beep",
      "cache",
      "dependencies",
      "--output",
      `${inputs}/dependencies.json`,
    ]);
    yield* step("bun", [
      "--no-env-file",
      "run",
      "beep",
      "cache",
      "activation",
      "--request",
      `${inputs}/activation-request.json`,
      "--output",
      `${inputs}/activation.json`,
    ]);
    yield* prepareCachePilotRequest(root, mode);
    yield* step("git", ["diff", "--quiet", "HEAD"]);
  });
  // `umask 077` covers every file this command and its children create. A
  // platform or decoding failure (the Python adapter's traceback) exits 1.
  return yield* Effect.acquireUseRelease(
    Effect.sync(() => process.umask(0o077)),
    () => program,
    (previous) => Effect.sync(() => process.umask(previous))
  ).pipe(
    Effect.catchIf(P.not(isReportedExit), (error) =>
      refuse(`${COMMAND}: ${P.hasProperty(error, "message") ? String(error.message) : "failed"}`)
    )
  );
});
