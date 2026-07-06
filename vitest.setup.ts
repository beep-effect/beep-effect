// Bun-API shim for NODE-based vitest runs (the coverage lane).
// WHY: istanbul coverage under `bunx --bun vitest` instruments nothing
// (measured 0% on packages with passing tests), so per-package `coverage`
// scripts run plain node vitest (v8 provider) while `test` scripts stay
// bun-native. Tests that call Bun APIs (spawnSync, Glob, TOML, serve, ...)
// still execute under node via this shim. The guard below leaves real Bun
// untouched: it only installs when globalThis.Bun lacks the probed surface
// (quality-gate-ratchets A1, 2026-07-06).
import { spawn as nodeSpawn, spawnSync as nodeSpawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";
import { P } from "@beep/utils";
import { addEqualityTesters } from "@effect/vitest";
import { micromark } from "micromark";
import { gfm, gfmHtml } from "micromark-extension-gfm";
import picomatch from "picomatch";
import * as Toml from "toml";
import type { ServerResponse } from "node:http";

addEqualityTesters();

type BunFileShim = {
  readonly arrayBuffer: () => Promise<ArrayBuffer>;
  readonly json: () => Promise<unknown>;
  readonly text: () => Promise<string>;
};

type BunServeOptions = {
  readonly fetch: (request: Request) => Promise<Response> | Response;
  readonly hostname?: string;
  readonly port?: number;
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
  readonly stderr?: "ignore" | "inherit" | "pipe";
  readonly stdout?: "ignore" | "inherit" | "pipe";
};

type BunSpawnSyncObject = BunSpawnSyncOptions & {
  readonly cmd: ReadonlyArray<string>;
};

type BunTestShim = {
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
  readonly TOML: {
    readonly parse: (content: string) => unknown;
  };
  readonly env: NodeJS.ProcessEnv;
  readonly file: (path: string | URL) => BunFileShim;
  readonly markdown: {
    readonly html: (content: string, options?: BunMarkdownOptions) => string;
  };
  readonly serve: (options: BunServeOptions) => {
    readonly port: number;
    readonly stop: (force?: boolean) => Promise<void>;
  };
  readonly sleep: (milliseconds: number) => Promise<void>;
  readonly spawn: (
    commandOrOptions: BunSpawnSyncObject | ReadonlyArray<string>,
    options?: BunSpawnSyncOptions
  ) => {
    readonly exited: Promise<number>;
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

// fallow-ignore-next-line complexity
const isBunTestShim = (value: unknown): value is BunTestShim =>
  isObject(value) &&
  P.hasProperty(value, "Glob") &&
  P.hasProperty(value, "JSONL") &&
  P.hasProperty(value, "TOML") &&
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
  if (Array.isArray(commandOrOptions)) {
    const [command = "", ...args] = commandOrOptions;
    return { args, command, options: options ?? {} };
  }

  const [command = "", ...args] = commandOrOptions.cmd;
  return { args, command, options: commandOrOptions };
};

// fallow-ignore-next-line complexity
const spawnSync = (commandOrOptions: BunSpawnSyncObject | ReadonlyArray<string>, options?: BunSpawnSyncOptions) => {
  const normalized = normalizeSpawnInput(commandOrOptions, options);
  const result = nodeSpawnSync(normalized.command, [...normalized.args], {
    cwd: normalized.options.cwd,
    env: { ...process.env, ...normalized.options.env },
    stderr: stdioMode(normalized.options.stderr),
    stdout: stdioMode(normalized.options.stdout),
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
  const child = nodeSpawn(normalized.command, [...normalized.args], {
    cwd: normalized.options.cwd,
    env: { ...process.env, ...normalized.options.env },
    stderr: stdioMode(normalized.options.stderr),
    stdout: stdioMode(normalized.options.stdout),
  });

  return {
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
  arrayBuffer: async () => bufferToArrayBuffer(await readFile(path)),
  json: async () => JSON.parse(await readFile(path, "utf8")) as unknown,
  text: () => readFile(path, "utf8"),
});

// fallow-ignore-next-line complexity
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
    await writeFile(destination, data);
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

// fallow-ignore-next-line complexity
const requestHeaders = (messageHeaders: NodeJS.Dict<string | readonly string[]>): Headers => {
  const headers = new Headers();
  for (const [key, value] of Object.entries(messageHeaders)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(key, item);
      }
    } else if (value !== undefined) {
      headers.set(key, value);
    }
  }
  return headers;
};

const writeResponse = async (nodeResponse: ServerResponse, response: Response): Promise<void> => {
  nodeResponse.writeHead(response.status, responseHeaders(response));
  nodeResponse.end(Buffer.from(await response.arrayBuffer()));
};

const listenPort = (requestedPort: number | undefined): number =>
  requestedPort === undefined || requestedPort === 0 ? 30_000 + Math.floor(Math.random() * 20_000) : requestedPort;

const serve = (options: BunServeOptions): ReturnType<BunTestShim["serve"]> => {
  const hostname = options.hostname ?? "0.0.0.0";
  const port = listenPort(options.port);
  const server = createServer((request, response) => {
    const chunks: Array<Buffer> = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      // fallow-ignore-next-line complexity
      void (async () => {
        try {
          const url = `http://${request.headers.host ?? `${hostname}:${port}`}${request.url ?? "/"}`;
          const method = request.method ?? "GET";
          const body = method === "GET" || method === "HEAD" ? undefined : Buffer.concat(chunks);
          const fetchRequest = new Request(url, {
            body,
            headers: requestHeaders(request.headers),
            method,
          });
          await writeResponse(response, await options.fetch(fetchRequest));
        } catch (error) {
          response.statusCode = 500;
          response.end(error instanceof Error ? error.message : String(error));
        }
      })();
    });
  });

  server.listen(port, hostname);

  return {
    port,
    stop: () =>
      new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      }),
  };
};

const normalizeTomlValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(normalizeTomlValue);
  }
  if (P.isObjectKeyword(value) && P.isNotNull(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeTomlValue(item)] as const));
  }
  return value;
};

const parseToml = (content: string): unknown => {
  try {
    return normalizeTomlValue(Toml.parse(content));
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    throw new Error(message.includes('"=" found') ? `Unexpected = (${message})` : message);
  }
};

// fallow-ignore-next-line complexity
const parseJsonlChunk: BunTestShim["JSONL"]["parseChunk"] = (content) => {
  const values: Array<unknown> = [];
  let read = 0;

  for (const line of content.split("\n")) {
    const lineWithTerminatorLength = line.length + (read + line.length < content.length ? 1 : 0);
    if (line.trim().length === 0) {
      read += lineWithTerminatorLength;
      continue;
    }
    try {
      values.push(JSON.parse(line) as unknown);
      read += lineWithTerminatorLength;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      return {
        done: true,
        error: {
          message: `Failed to parse JSONL (${message})`,
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

const normalizeFilePath = (value: string): string => value.replaceAll("\\", "/");

class GlobShim {
  private readonly matcher: (value: string) => boolean;

  constructor(readonly pattern: string) {
    this.matcher = picomatch(normalizeFilePath(pattern), { dot: true });
  }

  match(relativePath: string): boolean {
    return this.matcher(normalizeFilePath(relativePath));
  }

  // fallow-ignore-next-line complexity
  scanSync(options?: BunGlobScanOptions): Iterable<string> {
    const cwd = options?.cwd ?? process.cwd();
    const entries: Array<string> = [];
    const recursivePattern = this.pattern.includes("**");
    const includeDirectories = options?.onlyFiles !== true && !this.pattern.endsWith("/**/*");
    const outputPath = (relativePath: string, absolutePath: string): string =>
      options?.absolute === true ? normalizeFilePath(absolutePath) : relativePath;

    // fallow-ignore-next-line complexity
    const visit = (absoluteDirectory: string, relativeDirectory: string): void => {
      for (const dirent of readdirSync(absoluteDirectory, { withFileTypes: true })) {
        if (options?.dot !== true && dirent.name.startsWith(".")) {
          continue;
        }

        const relativePath = normalizeFilePath(
          relativeDirectory === "" ? dirent.name : `${relativeDirectory}/${dirent.name}`
        );
        const absolutePath = join(absoluteDirectory, dirent.name);

        if (dirent.isSymbolicLink()) {
          // Bun.Glob lists matching symlinked entries in recursive scans too;
          // it just does not traverse into symlinked directories.
          if (this.match(relativePath)) {
            entries.push(outputPath(relativePath, absolutePath));
          }
        } else if (dirent.isDirectory()) {
          if (includeDirectories && this.match(relativePath)) {
            entries.push(outputPath(relativePath, absolutePath));
          }
          visit(absolutePath, relativePath);
        } else if (this.match(relativePath)) {
          entries.push(outputPath(relativePath, absolutePath));
        }
      }
    };

    visit(cwd, "");
    return entries.sort();
  }
}

const renderMarkdownHtml = (content: string, options?: BunMarkdownOptions): string => {
  if (options?.tagFilter === false && /^<script\b/iu.test(content.trimStart())) {
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
    Glob: GlobShim,
    JSONL: {
      parseChunk: parseJsonlChunk,
    },
    TOML: {
      parse: parseToml,
    },
    env: process.env,
    file,
    markdown: {
      html: renderMarkdownHtml,
    },
    serve,
    sleep: (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
    spawn,
    spawnSync,
    stderr: process.stderr,
    stdout: process.stdout,
    write,
  } satisfies BunTestShim);
}
