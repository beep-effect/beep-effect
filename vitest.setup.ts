// Bun-API shim for Node-based Vitest runs, including the canonical coverage lane.
// Explicit Bun coverage runs use Istanbul instrumentation; Node uses V8.
// The per-file regression baseline requires Node/V8, so production coverage commands
// retain that runtime until a compatible baseline migration is validated.
// Tests calling Bun APIs still execute under Node through this shim. The guard
// leaves real Bun untouched and only installs when the probed surface is absent.
//
// This file is typechecked by the root tsconfig.configs.json project
// (repo-sanity:config-typecheck). It is a Node polyfill of Bun's
// Promise-based API surface, so the Effect diagnostics below cannot hold here
// by construction; every other rule stays enforced. The five skip-file lines
// are the declared exemption that `beep quality tsgo-rules` admits for this
// path and nowhere else (goals/tsgo-045-effect-idiom-sweep, D1); the gate
// compares them exactly, so the reasons live here:
// - nodeBuiltinImport: the shim implements Bun.spawn/file/serve/CryptoHasher over node:child_process, node:fs, node:http, node:crypto
// - asyncFunction: Bun.file().text(), Bun.write, Bun.serve fetch handlers are async by contract
// - newPromise: Bun.spawn().exited, Bun.sleep, and server.stop are Promises by contract
// - globalTimers: Bun.sleep is a plain setTimeout promise
// - globalRandom: Bun.serve picks its first candidate port with no Effect Random service at setup time
// @effect-diagnostics nodeBuiltinImport:skip-file
// @effect-diagnostics asyncFunction:skip-file
// @effect-diagnostics newPromise:skip-file
// @effect-diagnostics globalTimers:skip-file
// @effect-diagnostics globalRandom:skip-file

import * as NodeChildProcess from "node:child_process";
import * as NodeCrypto from "node:crypto";
import * as NodeFS from "node:fs";
import * as NodeFSP from "node:fs/promises";
import * as NodeHttp from "node:http";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeStream from "node:stream";
import { GlobPattern, GlobPatternOptions } from "@beep/glob/GlobPattern";
import { A, O, P, R } from "@beep/utils";
import { addEqualityTesters } from "@effect/vitest";
import * as MutableHashSet from "effect/MutableHashSet";
import * as Result from "effect/Result";
import * as Str from "effect/String";
import { micromark } from "micromark";
import { gfm, gfmHtml } from "micromark-extension-gfm";

// Node 26 exposes a configurable experimental `localStorage` getter even when
// no `--localstorage-file` was supplied. Vitest consequently sees the property
// as already present and does not install jsdom's working implementation, while
// reading Node's getter yields `undefined` and emits an ExperimentalWarning.
// Replace that distinct non-enumerable Node descriptor with an isolated
// in-memory Web Storage before any browser-facing module evaluates.
// The configs typecheck unit has no DOM lib, so the Web Storage surface the shim
// installs is declared locally instead of referencing lib.dom.
interface WebStorageShim {
  clear(): void;
  getItem(key: string): string | null;
  key(index: number): string | null;
  readonly length: number;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
}

const localStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
if (
  P.hasProperty(globalThis, "window") &&
  typeof globalThis.Bun === "undefined" &&
  localStorageDescriptor?.get !== undefined &&
  localStorageDescriptor.enumerable === false
) {
  const values = new Map<string, string>();
  const localStorage: WebStorageShim = {
    get length(): number {
      return values.size;
    },
    clear: (): void => values.clear(),
    getItem: (key): string | null => values.get(key) ?? null,
    key: (index): string | null => Array.from(values.keys())[index] ?? null,
    removeItem: (key): void => {
      values.delete(key);
    },
    setItem: (key, value): void => {
      values.set(key, String(value));
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: localStorage,
  });
}

addEqualityTesters();

// Property-test run floors and seeds now flow through @beep/fc-runs
// (BEEP_FC_NUM_RUNS / BEEP_FC_SEED) into per-test `{ arbitrary: ... }`
// options; the native effect Arbitrary model has no global configuration.

type BunFileShim = {
  readonly arrayBuffer: () => Promise<ArrayBuffer>;
  readonly json: () => Promise<unknown>;
  readonly text: () => Promise<string>;
};

type BunServeOptions = {
  readonly fetch: (request: Request, server: ReturnType<BunTestShim["serve"]>) => Promise<Response> | Response;
  readonly hostname?: string;
  readonly unix?: string;
  readonly port?: number;
  readonly maxRequestBodySize?: number;
};

type BunMarkdownOptions = {
  readonly tagFilter?: boolean;
};

type BunGlobScanOptions = {
  readonly absolute?: boolean;
  readonly cwd?: string;
  readonly dot?: boolean;
  readonly onlyFiles?: boolean;
};

type BunSpawnSyncOptions = {
  readonly cwd?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly stdin?: "ignore" | "inherit" | "pipe" | string | Uint8Array;
  readonly stderr?: "ignore" | "inherit" | "pipe";
  readonly stdout?: "ignore" | "inherit" | "pipe";
};

type BunSpawnSyncObject = BunSpawnSyncOptions & {
  readonly cmd: ReadonlyArray<string>;
};

type BunTestShim = {
  readonly CryptoHasher: new (algorithm: string, hmacKey?: string | Uint8Array) => CryptoHasherShim;
  readonly Glob: new (pattern: string) => object;
  readonly JSONL: {
    readonly parseChunk: (content: string) => {
      readonly done: boolean;
      readonly error: null | {
        readonly message: string;
      };
      readonly read: number;
      readonly values: ReadonlyArray<unknown>;
    };
  };
  readonly env: NodeJS.ProcessEnv;
  readonly file: (path: string | URL) => BunFileShim;
  readonly markdown: {
    readonly html: (content: string, options?: BunMarkdownOptions) => string;
  };
  readonly shimPortLockDirectory: string;
  readonly serve: (options: BunServeOptions) => {
    readonly hostname: string;
    readonly port: number | undefined;
    readonly reload: (options: Pick<BunServeOptions, "fetch">) => void;
    readonly stop: (force?: boolean) => Promise<void>;
  };
  readonly sleep: (milliseconds: number) => Promise<void>;
  readonly spawn: (
    commandOrOptions: BunSpawnSyncObject | ReadonlyArray<string>,
    options?: BunSpawnSyncOptions
  ) => {
    readonly exited: Promise<number>;
    readonly stderr: ReturnType<typeof NodeStream.Readable.toWeb> | undefined;
    readonly stdout: ReturnType<typeof NodeStream.Readable.toWeb> | undefined;
  };
  readonly spawnSync: (
    commandOrOptions: BunSpawnSyncObject | ReadonlyArray<string>,
    options?: BunSpawnSyncOptions
  ) => {
    readonly exitCode: number;
    readonly signalCode: NodeJS.Signals | null;
    readonly stderr: Buffer;
    readonly stdout: Buffer;
    readonly success: boolean;
  };
  readonly stderr: typeof process.stderr;
  readonly stdout: typeof process.stdout;
  readonly write: (destination: NodeJS.WritableStream | string | URL, input: unknown) => Promise<number>;
};

const isObject = (value: unknown): value is object => P.isObjectKeyword(value) && P.isNotNull(value);
const hasFunctionProperty = (value: unknown, key: string): boolean =>
  isObject(value) && typeof Reflect.get(value, key) === "function";

// fallow-ignore-next-line complexity -- CRAP finding comes from fallow's static coverage estimate; the probe is a flat 12-way conjunction of function-property checks over the Bun shim API with cognitive 1. Owner: repo root (vitest.setup.ts). Exit: remove once fallow health reads the measured coverage for this file (#1855 detector frontier) or the branches collapse.
const isBunTestShim = (value: unknown): value is BunTestShim =>
  isObject(value) &&
  hasFunctionProperty(value, "CryptoHasher") &&
  P.hasProperty(value, "Glob") &&
  P.hasProperty(value, "JSONL") &&
  P.hasProperty(value, "env") &&
  hasFunctionProperty(value, "file") &&
  P.hasProperty(value, "markdown") &&
  hasFunctionProperty(value, "serve") &&
  hasFunctionProperty(value, "sleep") &&
  hasFunctionProperty(value, "spawn") &&
  hasFunctionProperty(value, "spawnSync") &&
  hasFunctionProperty(value, "write");

const stdioMode = (mode: BunSpawnSyncOptions["stdout"]): "ignore" | "inherit" | "pipe" => mode ?? "pipe";

const normalizeSpawnInput = (
  commandOrOptions: BunSpawnSyncObject | ReadonlyArray<string>,
  options: BunSpawnSyncOptions | undefined
): {
  readonly args: ReadonlyArray<string>;
  readonly command: string;
  readonly options: BunSpawnSyncOptions;
} => {
  if (P.hasProperty(commandOrOptions, "cmd")) {
    const [command = "", ...args] = commandOrOptions.cmd;
    return { args, command, options: commandOrOptions };
  }

  const [command = "", ...args] = commandOrOptions;
  return { args, command, options: options ?? {} };
};

const spawnSync = (commandOrOptions: BunSpawnSyncObject | ReadonlyArray<string>, options?: BunSpawnSyncOptions) => {
  const normalized = normalizeSpawnInput(commandOrOptions, options);
  const stdin = normalized.options.stdin;
  const stdinIsMode = stdin === "ignore" || stdin === "inherit" || stdin === "pipe";
  const result = NodeChildProcess.spawnSync(normalized.command, [...normalized.args], {
    cwd: normalized.options.cwd,
    env: normalized.options.env,
    input: stdinIsMode ? undefined : stdin,
    stdio: [stdinIsMode ? stdin : "pipe", stdioMode(normalized.options.stdout), stdioMode(normalized.options.stderr)],
  });
  const exitCode = result.status ?? (result.signal === null ? 0 : 1);

  return {
    exitCode,
    signalCode: result.signal,
    stderr: Buffer.isBuffer(result.stderr) ? result.stderr : Buffer.alloc(0),
    stdout: Buffer.isBuffer(result.stdout) ? result.stdout : Buffer.alloc(0),
    success: exitCode === 0,
  } as const;
};

const spawn = (commandOrOptions: BunSpawnSyncObject | ReadonlyArray<string>, options?: BunSpawnSyncOptions) => {
  const normalized = normalizeSpawnInput(commandOrOptions, options);
  const child = NodeChildProcess.spawn(normalized.command, [...normalized.args], {
    cwd: normalized.options.cwd,
    env: normalized.options.env,
    stdio: ["ignore", stdioMode(normalized.options.stdout), stdioMode(normalized.options.stderr)],
  });

  return {
    stderr: child.stderr === null ? undefined : NodeStream.Readable.toWeb(child.stderr),
    stdout: child.stdout === null ? undefined : NodeStream.Readable.toWeb(child.stdout),
    exited: new Promise<number>((resolve, reject) => {
      child.on("error", reject);
      child.on("exit", (code, signal) => {
        resolve(code ?? (signal === null ? 0 : 1));
      });
    }),
  } as const;
};

const bufferToArrayBuffer = (buffer: Buffer): ArrayBuffer => {
  const arrayBuffer = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(arrayBuffer).set(buffer);
  return arrayBuffer;
};

const file = (path: string | URL): BunFileShim => ({
  arrayBuffer: async () => bufferToArrayBuffer(await NodeFSP.readFile(path)),
  json: async () => JSON.parse(await NodeFSP.readFile(path, "utf8")) as unknown,
  text: () => NodeFSP.readFile(path, "utf8"),
});

const writeInput = async (input: unknown): Promise<string | Uint8Array> => {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof ArrayBuffer) {
    return new Uint8Array(input);
  }
  if (ArrayBuffer.isView(input)) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  }
  if (input instanceof Blob) {
    return new Uint8Array(await input.arrayBuffer());
  }
  return String(input);
};

const write = async (destination: NodeJS.WritableStream | string | URL, input: unknown): Promise<number> => {
  const data = await writeInput(input);
  const byteLength = typeof data === "string" ? Buffer.byteLength(data) : data.byteLength;

  if (typeof destination === "string" || destination instanceof URL) {
    await NodeFSP.writeFile(destination, data);
    return byteLength;
  }

  destination.write(data);
  return byteLength;
};

const responseHeaders = (response: Response): Record<string, string> => {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  return headers;
};

const appendRequestHeader = (headers: Headers, key: string, value: string | readonly string[] | undefined): void => {
  if (P.isUndefined(value)) {
    return;
  }
  if (P.isString(value)) {
    headers.set(key, value);
    return;
  }
  for (const item of value) {
    headers.append(key, item);
  }
};

const requestHeaders = (messageHeaders: NodeJS.Dict<string | readonly string[]>): Headers => {
  const headers = new Headers();
  for (const [key, value] of R.toEntries(messageHeaders)) {
    appendRequestHeader(headers, key, value);
  }
  return headers;
};

const errorMessage = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause));

const toFetchRequest = (
  request: NodeHttp.IncomingMessage,
  chunks: ReadonlyArray<Buffer>,
  fallbackHost: string
): Request => {
  const url = `http://${request.headers.host ?? fallbackHost}${request.url ?? "/"}`;
  const method = request.method ?? "GET";
  const body = method === "GET" || method === "HEAD" ? undefined : Buffer.concat(chunks);
  return new Request(url, {
    ...(P.isUndefined(body) ? {} : { body }),
    headers: requestHeaders(request.headers),
    method,
  });
};

const writeResponse = async (nodeResponse: NodeHttp.ServerResponse, response: Response): Promise<void> => {
  nodeResponse.writeHead(response.status, responseHeaders(response));
  nodeResponse.end(Buffer.from(await response.arrayBuffer()));
};

// Bun.serve binds before it returns, so its `port` is the bound port. node:http binds
// asynchronously, so the shim names the port before it listens, and BunHttpServer reads it at
// once. A random port inside the kernel's ephemeral range (32768 and up on Linux) could lose that
// bind after `serve` returned; the caller's requests then reached whichever process held the port.
// Port 0 therefore draws from below the ephemeral range, where no outgoing socket or port-0 bind
// lands, and each port is reserved across test processes by an exclusive lock file naming its
// owner, removed when the server stops or the process exits.
const shimPortFloor = 20_000;
const shimPortCount = 12_000;
const shimPortLockDirectory = NodePath.join(NodeOS.tmpdir(), "beep-vitest-bun-serve-ports");
const ownedShimPorts = MutableHashSet.empty<number>();
// Setup runs again for each file in shared workers. The process owns one cleanup listener and
// every evaluation publishes its absolute lock paths into the same registry. Keep ownedShimPorts
// local so stopping a server can only release a reservation acquired by its own shim instance.
const shimPortCleanupKey = Symbol.for("@beep/vitest/BunServePortCleanup");
const shimPortCleanup = (() => {
  const existing: unknown = Reflect.get(process, shimPortCleanupKey);
  if (MutableHashSet.isMutableHashSet<string>(existing)) return existing;
  const locks = MutableHashSet.empty<string>();
  Reflect.set(process, shimPortCleanupKey, locks);
  process.once("exit", () => {
    for (const lock of locks) NodeFS.rmSync(lock, { force: true });
    MutableHashSet.clear(locks);
  });
  return locks;
})();
let nextShimPortOffset = Math.floor(Math.random() * shimPortCount);

const shimPortLockPath = (port: number): string => NodePath.join(shimPortLockDirectory, `${port}.lock`);

const errnoCode = (cause: unknown): unknown =>
  P.isError(cause) && P.hasProperty(cause, "code") ? cause.code : undefined;

// EPERM still means the process exists; only ESRCH proves the owner is gone.
const isLiveProcess = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (cause) {
    return errnoCode(cause) !== "ESRCH";
  }
};

// The pid is written to a private staging file first and hard-linked into place, so a lock never
// exists without its owner's pid and the link fails if the lock already exists.
const createShimPortLock = (port: number): boolean => {
  const staging = NodePath.join(shimPortLockDirectory, `${port}.${process.pid}.${Math.random()}.tmp`);
  NodeFS.writeFileSync(staging, `${process.pid}`);
  try {
    NodeFS.linkSync(staging, shimPortLockPath(port));
    return true;
  } catch (cause) {
    if (errnoCode(cause) !== "EEXIST") throw cause;
    return false;
  } finally {
    NodeFS.rmSync(staging, { force: true });
  }
};

// Each reclaimer holds a hard link to the inode it inspected. Only a canonical lock with exactly
// that one extra link can be removed: another live reclaimer's link prevents both from winning.
// Keeping the link through publication also protects a new owner's lock from a late stale unlink.
const pruneAbandonedShimPortLinks = (port: number): void => {
  for (const name of NodeFS.readdirSync(shimPortLockDirectory)) {
    if (!Str.startsWith(`${port}.`)(name) || !(Str.endsWith(".tmp")(name) || Str.endsWith(".reap")(name))) continue;
    const owner = Number(Str.split(name, ".")[1]);
    if (Number.isInteger(owner) && owner > 0 && !isLiveProcess(owner)) {
      NodeFS.rmSync(NodePath.join(shimPortLockDirectory, name), { force: true });
    }
  }
};

const reclaimAbandonedShimPort = (port: number, intent: string): boolean => {
  const owner = Number.parseInt(NodeFS.readFileSync(intent, "utf8"), 10);
  if (Number.isInteger(owner) && isLiveProcess(owner)) return false;
  pruneAbandonedShimPortLinks(port);
  const inspected = NodeFS.statSync(intent);
  const canonical = shimPortLockPath(port);
  let current: NodeFS.Stats;
  try {
    current = NodeFS.statSync(canonical);
  } catch (cause) {
    if (errnoCode(cause) === "ENOENT") return createShimPortLock(port);
    throw cause;
  }
  if (current.dev !== inspected.dev || current.ino !== inspected.ino || current.nlink !== 2) return false;
  NodeFS.rmSync(canonical, { force: true });
  return createShimPortLock(port);
};

const lockShimPort = (port: number): boolean => {
  if (createShimPortLock(port)) return true;
  const intent = NodePath.join(shimPortLockDirectory, `${port}.${process.pid}.${NodeCrypto.randomUUID()}.reap`);
  try {
    NodeFS.linkSync(shimPortLockPath(port), intent);
  } catch (cause) {
    if (errnoCode(cause) === "ENOENT") return createShimPortLock(port);
    throw cause;
  }
  try {
    return reclaimAbandonedShimPort(port, intent);
  } finally {
    NodeFS.rmSync(intent, { force: true });
  }
};

const claimShimPort = (): number => {
  NodeFS.mkdirSync(shimPortLockDirectory, { recursive: true });
  for (let attempt = 0; attempt < shimPortCount; attempt++) {
    const offset = (nextShimPortOffset + attempt) % shimPortCount;
    const port = shimPortFloor + offset;
    if (lockShimPort(port)) {
      nextShimPortOffset = (offset + 1) % shimPortCount;
      MutableHashSet.add(ownedShimPorts, port);
      MutableHashSet.add(shimPortCleanup, shimPortLockPath(port));
      return port;
    }
  }
  throw new Error(
    `Bun.serve shim: every port in ${shimPortFloor}-${shimPortFloor + shimPortCount - 1} is reserved (${shimPortLockDirectory})`
  );
};

const releaseShimPort = (port: number): void => {
  if (!MutableHashSet.has(ownedShimPorts, port)) return;
  MutableHashSet.remove(ownedShimPorts, port);
  MutableHashSet.remove(shimPortCleanup, shimPortLockPath(port));
  NodeFS.rmSync(shimPortLockPath(port), { force: true });
};

const listenPort = (requestedPort: number | undefined): number =>
  requestedPort === undefined || requestedPort === 0 ? claimShimPort() : requestedPort;

const collectRequestBody = (
  request: NodeHttp.IncomingMessage,
  response: NodeHttp.ServerResponse,
  limit: number | undefined,
  onBody: (chunks: ReadonlyArray<Buffer>) => void
): void => {
  const chunks: Array<Buffer> = [];
  let size = 0;
  request.on("data", (chunk: Buffer) => {
    size += chunk.byteLength;
    if (size > (limit ?? Number.POSITIVE_INFINITY)) {
      chunks.length = 0;
      response.writeHead(413);
      response.end();
      request.destroy();
    } else chunks.push(chunk);
  });
  request.on("end", () => {
    if (!request.destroyed) onBody(chunks);
  });
};

const respondToRequest = async (
  request: NodeHttp.IncomingMessage,
  response: NodeHttp.ServerResponse,
  chunks: ReadonlyArray<Buffer>,
  handle: ReturnType<BunTestShim["serve"]>,
  handler: BunServeOptions["fetch"]
): Promise<void> => {
  try {
    const fallbackHost = handle.port === undefined ? "localhost" : `${handle.hostname}:${handle.port}`;
    const fetchRequest = toFetchRequest(request, chunks, fallbackHost);
    await writeResponse(response, await handler(fetchRequest, handle));
  } catch (error) {
    response.statusCode = 500;
    response.end(errorMessage(error));
  }
};

const stopServer = (server: NodeHttp.Server): Promise<void> =>
  new Promise((resolve, reject) => {
    const close = () =>
      server.close((error) => {
        if (P.isUndefined(error)) resolve();
        else reject(error);
      });
    if (server.listening) close();
    else {
      server.once("listening", close);
      server.once("error", reject);
    }
  });

const serve = (options: BunServeOptions): ReturnType<BunTestShim["serve"]> => {
  let handler = options.fetch;
  let stopped: Promise<void> | undefined;
  const hostname = options.hostname ?? "0.0.0.0";
  // Unix listeners must not reserve or bind an unrelated TCP port.
  const port = options.unix === undefined ? listenPort(options.port) : undefined;
  let bindError: Error | undefined;
  let bindFailed = false;
  const server = NodeHttp.createServer((request, response) => {
    collectRequestBody(request, response, options.maxRequestBodySize, (chunks) => {
      void respondToRequest(request, response, chunks, handle, handler);
    });
  });

  server.on("error", (error) => {
    bindError = error;
    bindFailed = true;
  });
  if (options.unix !== undefined) server.listen(options.unix);
  else server.listen(port, hostname);

  const handle: ReturnType<BunTestShim["serve"]> = {
    hostname,
    port,
    reload: (options) => {
      if (bindError !== undefined) {
        const error = bindError;
        bindError = undefined;
        throw error;
      }
      handler = options.fetch;
    },
    stop: () =>
      (bindFailed ? Promise.resolve() : (stopped ??= stopServer(server))).finally(() => {
        if (port !== undefined) releaseShimPort(port);
      }),
  };
  return handle;
};

const parseJsonlChunk: BunTestShim["JSONL"]["parseChunk"] = (content) => {
  const values: Array<unknown> = [];
  let read = 0;

  for (const line of Str.split("\n")(content)) {
    const lineWithTerminatorLength = line.length + (read + line.length < content.length ? 1 : 0);
    if (Str.trim(line).length === 0) {
      read += lineWithTerminatorLength;
      continue;
    }
    try {
      values.push(JSON.parse(line) as unknown);
      read += lineWithTerminatorLength;
    } catch (cause) {
      return {
        done: true,
        error: {
          message: `Failed to parse JSONL (${errorMessage(cause)})`,
        },
        read,
        values,
      };
    }
  }

  return {
    done: true,
    error: null,
    read,
    values,
  };
};

const normalizeFilePath = (value: string): string => Str.replaceAll("\\", "/")(value);
const globMetaPattern = /[*?[{(!]/u;

const scanRootForGlobPattern = (pattern: string): string => {
  const segments = Str.split("/")(normalizeFilePath(pattern));
  const staticSegments = O.match(
    A.findFirstIndex(segments, (segment) => globMetaPattern.test(segment)),
    {
      onNone: () => segments.slice(0, -1),
      onSome: (firstMetaSegment) => segments.slice(0, firstMetaSegment),
    }
  );
  return A.join(staticSegments, "/");
};

const isMissingPathError = (cause: unknown): boolean =>
  P.isError(cause) && P.hasProperty(cause, "code") && cause.code === "ENOENT";

// Bun.CryptoHasher over node:crypto: a plain hash, or an HMAC when a key is given.
class CryptoHasherShim {
  private readonly hasher: ReturnType<typeof NodeCrypto.createHash> | ReturnType<typeof NodeCrypto.createHmac>;

  constructor(algorithm: string, hmacKey?: string | Uint8Array) {
    this.hasher = P.isUndefined(hmacKey) ? NodeCrypto.createHash(algorithm) : NodeCrypto.createHmac(algorithm, hmacKey);
  }

  update(data: string | Uint8Array): this {
    this.hasher.update(data);
    return this;
  }

  digest(): Buffer;
  digest(encoding: "base64" | "base64url" | "hex"): string;
  digest(encoding?: "base64" | "base64url" | "hex"): Buffer | string {
    return P.isUndefined(encoding) ? this.hasher.digest() : this.hasher.digest(encoding);
  }
}

// Bun.Glob.match admits dotfiles wherever a wildcard stands (the walker below applies
// Bun.Glob.scanSync's own `dot` option before any path reaches the matcher) and reads a
// leading `#` as a literal, not a comment; it negates a leading `!` as minimatch does.
const globShimOptions = GlobPatternOptions.make({ dot: true, nocomment: true });

// Bun.Glob over `@beep/glob`: the matcher is the kit's `GlobPattern`; the walker keeps Bun's
// scanSync semantics for Node runs of Bun-targeted suites (effected-promotion W4-p).
class GlobShim {
  private readonly matcher: GlobPattern;

  constructor(readonly pattern: string) {
    this.matcher = Result.getOrThrowWith(
      GlobPattern.compileResult(normalizeFilePath(pattern), globShimOptions),
      (error) => new Error(`Bun.Glob shim: ${error.message}`, { cause: error })
    );
  }

  match(relativePath: string): boolean {
    return this.matcher.matches(normalizeFilePath(relativePath));
  }

  scanSync(options?: BunGlobScanOptions): Iterable<string> {
    const cwd = options?.cwd ?? process.cwd();
    const entries: Array<string> = [];
    const normalizedPattern = normalizeFilePath(this.pattern);
    const patternDepth = Str.split("/")(normalizedPattern).length;
    const recursivePattern = Str.includes("**")(normalizedPattern);
    const scanRoot = scanRootForGlobPattern(normalizedPattern);
    // Bun.Glob.scanSync defaults `onlyFiles` to true: directories are listed only on request.
    const includeDirectories = options?.onlyFiles === false;
    const outputPath = (relativePath: string, absolutePath: string): string =>
      options?.absolute === true ? normalizeFilePath(absolutePath) : relativePath;

    // fallow-ignore-next-line complexity -- recursive walker keeps Bun.Glob's dotfile, symlink, directory and file semantics in one traversal (cognitive 26). Owner: repo root (vitest.setup.ts). Exit: delete with the Bun shim when Vitest runs these suites on Bun natively.
    const visit = (absoluteDirectory: string, relativeDirectory: string): void => {
      const dirents = (() => {
        try {
          return NodeFS.readdirSync(absoluteDirectory, { withFileTypes: true });
        } catch (cause) {
          if (isMissingPathError(cause)) {
            return [];
          }
          throw cause;
        }
      })();

      for (const dirent of dirents) {
        if (options?.dot !== true && Str.startsWith(".")(dirent.name)) {
          continue;
        }

        const relativePath = normalizeFilePath(
          relativeDirectory === "" ? dirent.name : `${relativeDirectory}/${dirent.name}`
        );
        const absolutePath = NodePath.join(absoluteDirectory, dirent.name);

        if (dirent.isSymbolicLink()) {
          // Bun.Glob parity: recursive scans list symlinks whose target is a
          // file but neither list nor traverse symlinked directories;
          // non-recursive scans list any matching symlink.
          if (this.match(relativePath)) {
            const targetIsFile = (() => {
              try {
                return NodeFS.statSync(absolutePath).isFile();
              } catch {
                return false;
              }
            })();
            if (targetIsFile || !recursivePattern) {
              entries.push(outputPath(relativePath, absolutePath));
            }
          }
        } else if (dirent.isDirectory()) {
          if (includeDirectories && this.match(relativePath)) {
            entries.push(outputPath(relativePath, absolutePath));
          }
          if (recursivePattern || Str.split("/")(relativePath).length < patternDepth) {
            visit(absolutePath, relativePath);
          }
        } else if (this.match(relativePath)) {
          entries.push(outputPath(relativePath, absolutePath));
        }
      }
    };

    if (scanRoot.length > 0 && includeDirectories && this.match(scanRoot)) {
      entries.push(outputPath(scanRoot, NodePath.join(cwd, scanRoot)));
    }
    visit(NodePath.join(cwd, scanRoot), scanRoot);
    return entries.sort();
  }
}

const renderMarkdownHtml = (content: string, options?: BunMarkdownOptions): string => {
  if (options?.tagFilter === false && /^<script\b/iu.test(Str.trimStart(content))) {
    return `${content}\n`;
  }

  return `${micromark(content, {
    allowDangerousHtml: true,
    extensions: [gfm()],
    htmlExtensions: [gfmHtml()],
  })}\n`;
};

if (!isBunTestShim(Reflect.get(globalThis, "Bun"))) {
  Reflect.set(globalThis, "Bun", {
    CryptoHasher: CryptoHasherShim,
    Glob: GlobShim,
    JSONL: {
      parseChunk: parseJsonlChunk,
    },
    env: process.env,
    file,
    markdown: {
      html: renderMarkdownHtml,
    },
    serve,
    // Shim-only: tests of the shim find its port reservations here; real Bun has no such property.
    shimPortLockDirectory,
    sleep: (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
    spawn,
    spawnSync,
    stderr: process.stderr,
    stdout: process.stdout,
    write,
  } satisfies BunTestShim);
}

// Bun exposes the native constant-time comparator on its global Crypto API.
// Node coverage runs use the same native primitive through this platform shim.
if (!hasFunctionProperty(globalThis.crypto, "timingSafeEqual")) {
  Reflect.set(globalThis.crypto, "timingSafeEqual", NodeCrypto.timingSafeEqual);
}

// Effect's Bun HTTP adapter consumes Bun's batched reader API. Node readers
// expose read() only; one returned chunk is a valid readMany() batch. Keep
// cancellation and locking on the original reader, and leave native Bun alone.
if (!hasFunctionProperty(ReadableStreamDefaultReader.prototype, "readMany")) {
  Object.defineProperty(ReadableStreamDefaultReader.prototype, "readMany", {
    configurable: true,
    writable: true,
    value: function <T>(this: ReadableStreamDefaultReader<T>) {
      return this.read().then((result) =>
        result.done ? { done: true, value: undefined } : { done: false, value: [result.value] }
      );
    },
  });
}
