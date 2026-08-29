/**
 * Process and HTTP operations for the Tailscale CLI driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Duration, Effect, flow, Number as N, pipe, Stream } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import {
  DEFAULT_TAILSCALE_SERVE_PORT,
  TAILSCALE_PROBE_TIMEOUT,
  TAILSCALE_SERVE_TIMEOUT,
  TAILSCALE_STATUS_TIMEOUT,
} from "./Tailscale.config.ts";
import {
  TailscaleCommandExitError,
  TailscaleCommandOutputError,
  TailscaleCommandSpawnError,
  TailscaleCommandTimeoutError,
  TailscaleStatusParseError,
} from "./Tailscale.errors.ts";
import { TailnetIpv4Address, TailscaleStatus, TailscaleStatusJson } from "./Tailscale.models.ts";
import type { HttpClientResponse } from "effect/unstable/http";
import type { TailscaleCommandError } from "./Tailscale.errors.ts";
import type { TailnetIpv4Address as TailnetIpv4AddressType } from "./Tailscale.models.ts";

const tailscaleExecutable = "tailscale";
const forceKillGrace = Duration.seconds(2);
const emptyString = () => Str.empty;

const collectStdout = <E>(stream: Stream.Stream<Uint8Array, E>): Effect.Effect<string, E> =>
  stream.pipe(Stream.decodeText(), Stream.runFold(emptyString, Str.concat));

const collectStderr = collectStdout;

const decodeTailscaleStatusJson = S.decodeEffect(S.fromJsonString(TailscaleStatusJson));

function normalizeMagicDnsName(status: TailscaleStatusJson): O.Option<string> {
  return pipe(
    status.Self?.DNSName,
    O.fromUndefinedOr,
    O.map(flow(Str.trim, Str.replace(/\.$/u, ""))),
    O.filter(Str.isNonEmpty)
  );
}

const tailnetIpv4AddressOption = O.liftPredicate(S.is(TailnetIpv4Address));

/**
 * Decode and normalize the local node's MagicDNS name.
 *
 * **Example** (Parse MagicDNS name JSON)
 *
 * ```ts
 * import { parseTailscaleMagicDnsName } from "@beep/tailscale/Tailscale.service"
 * import { Effect } from "effect"
 *
 * Effect.runPromise(parseTailscaleMagicDnsName('{"Self":{"DNSName":"host.tail.ts.net."}}'))
 *   .then(console.log)
 * ```
 *
 * @effects Decodes JSON with Schema and fails with `TailscaleStatusParseError` for invalid input.
 * @category parsing
 * @since 0.0.0
 */
export const parseTailscaleMagicDnsName = Effect.fn("Tailscale.parseMagicDnsName")((rawStatusJson: string) =>
  decodeTailscaleStatusJson(rawStatusJson).pipe(
    Effect.mapError((cause) => TailscaleStatusParseError.make({ cause })),
    Effect.map(normalizeMagicDnsName)
  )
);

/**
 * Check whether a string is an IPv4 address in Tailscale's assigned range.
 *
 * **Example** (Check Tailscale IPv4 range)
 *
 * ```ts
 * import { isTailscaleIpv4Address } from "@beep/tailscale/Tailscale.service"
 *
 * console.log(isTailscaleIpv4Address("100.64.0.1")) // true
 * console.log(isTailscaleIpv4Address("192.168.0.1")) // false
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isTailscaleIpv4Address: (address: string) => address is TailnetIpv4AddressType = S.is(TailnetIpv4Address);

/**
 * Decode the local node facts returned by `tailscale status --json`.
 *
 * **Example** (Parse status JSON string)
 *
 * ```ts
 * import { parseTailscaleStatus } from "@beep/tailscale/Tailscale.service"
 * import { Effect } from "effect"
 *
 * const json = '{"Self":{"TailscaleIPs":["100.100.100.100"]}}'
 * Effect.runPromise(parseTailscaleStatus(json)).then(console.log)
 * ```
 *
 * @effects Decodes JSON with Schema and fails with `TailscaleStatusParseError` for invalid input.
 * @category parsing
 * @since 0.0.0
 */
export const parseTailscaleStatus = Effect.fn("Tailscale.parseStatus")((rawStatusJson: string) =>
  decodeTailscaleStatusJson(rawStatusJson).pipe(
    Effect.mapError((cause) => TailscaleStatusParseError.make({ cause })),
    Effect.map((parsed) => {
      const tailnetIpv4Addresses = pipe(
        parsed.Self?.TailscaleIPs,
        O.fromUndefinedOr,
        O.map(flow(A.map(tailnetIpv4AddressOption), A.getSomes)),
        O.getOrElse(A.empty<TailnetIpv4AddressType>)
      );

      return TailscaleStatus.make({
        magicDnsName: normalizeMagicDnsName(parsed),
        tailnetIpv4Addresses,
      });
    })
  )
);

/**
 * Read and normalize the local node's current Tailscale status.
 *
 * **Example** (Map status to magic DNS)
 *
 * ```ts
 * import { readTailscaleStatus } from "@beep/tailscale/Tailscale.service"
 * import { Effect } from "effect"
 *
 * const magicDnsName = readTailscaleStatus.pipe(
 *   Effect.map((status) => status.magicDnsName)
 * )
 * console.log(magicDnsName)
 * ```
 *
 * @effects Spawns `tailscale status --json` and collects its output.
 * @category services
 * @since 0.0.0
 */
export const readTailscaleStatus = Effect.gen(function* () {
  const args = ["status", "--json"];
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const commandContext: {
    readonly executable: typeof tailscaleExecutable;
    readonly subcommand: "status";
    readonly argumentCount: number;
  } = {
    executable: tailscaleExecutable,
    subcommand: "status",
    argumentCount: A.length(args),
  };
  return yield* Effect.gen(function* () {
    const child = yield* spawner
      .spawn(
        ChildProcess.make(tailscaleExecutable, args, {
          forceKillAfter: forceKillGrace,
          stdin: "ignore",
          stderr: "pipe",
          stdout: "pipe",
        })
      )
      .pipe(
        Effect.mapError((cause) =>
          TailscaleCommandSpawnError.make({
            ...commandContext,
            cause,
          })
        )
      );
    const [stdout, stderr, exitCode] = yield* Effect.all(
      [collectStdout(child.stdout), collectStderr(child.stderr), child.exitCode.pipe(Effect.map(Number))],
      { concurrency: "unbounded" }
    ).pipe(
      Effect.mapError((cause) =>
        TailscaleCommandOutputError.make({
          ...commandContext,
          cause,
        })
      )
    );
    if (exitCode !== 0) {
      return yield* TailscaleCommandExitError.make({
        ...commandContext,
        exitCode,
        stdoutLength: Str.length(stdout),
        stderrLength: Str.length(stderr),
      });
    }
    return yield* parseTailscaleStatus(stdout);
  }).pipe(
    Effect.scoped,
    Effect.timeout(TAILSCALE_STATUS_TIMEOUT),
    Effect.catchTags({
      TimeoutError: (cause) =>
        Effect.fail(
          TailscaleCommandTimeoutError.make({
            ...commandContext,
            timeoutMs: Duration.toMillis(TAILSCALE_STATUS_TIMEOUT),
            cause,
          })
        ),
    })
  );
}).pipe(Effect.withSpan("Tailscale.readStatus"));

const runTailscaleCommand: {
  (
    args: readonly string[],
    timeoutInput: Duration.Input
  ): Effect.Effect<void, TailscaleCommandError, ChildProcessSpawner.ChildProcessSpawner>;
  (
    timeoutInput: Duration.Input
  ): (args: readonly string[]) => Effect.Effect<void, TailscaleCommandError, ChildProcessSpawner.ChildProcessSpawner>;
} = dual(
  2,
  Effect.fn("Tailscale.runCommand")(function* (
    args: readonly string[],
    timeoutInput: Duration.Input
  ): Effect.fn.Return<void, TailscaleCommandError, ChildProcessSpawner.ChildProcessSpawner> {
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const commandContext: {
      readonly executable: typeof tailscaleExecutable;
      readonly subcommand: "serve";
      readonly argumentCount: number;
    } = {
      executable: tailscaleExecutable,
      subcommand: "serve",
      argumentCount: A.length(args),
    };
    const timeout = Duration.fromInputUnsafe(timeoutInput);
    return yield* Effect.gen(function* () {
      const child = yield* spawner
        .spawn(
          ChildProcess.make(tailscaleExecutable, args, {
            forceKillAfter: forceKillGrace,
            stdin: "ignore",
            stderr: "pipe",
            stdout: "ignore",
          })
        )
        .pipe(
          Effect.mapError((cause) =>
            TailscaleCommandSpawnError.make({
              ...commandContext,
              cause,
            })
          )
        );
      const [stderr, exitCode] = yield* Effect.all(
        [collectStderr(child.stderr), child.exitCode.pipe(Effect.map(Number))],
        { concurrency: "unbounded" }
      ).pipe(
        Effect.mapError((cause) =>
          TailscaleCommandOutputError.make({
            ...commandContext,
            cause,
          })
        )
      );
      if (exitCode !== 0) {
        return yield* TailscaleCommandExitError.make({
          ...commandContext,
          exitCode,
          stderrLength: Str.length(stderr),
        });
      }
    }).pipe(
      Effect.scoped,
      Effect.timeout(timeout),
      Effect.catchTags({
        TimeoutError: (cause) =>
          Effect.fail(
            TailscaleCommandTimeoutError.make({
              ...commandContext,
              timeoutMs: Duration.toMillis(timeout),
              cause,
            })
          ),
      })
    );
  })
);

/**
 * Configure Tailscale Serve to proxy HTTPS traffic to a local port.
 *
 * **Example** (Configure Serve local proxy)
 *
 * ```ts
 * import { ensureTailscaleServe } from "@beep/tailscale/Tailscale.service"
 *
 * const program = ensureTailscaleServe({ localPort: 3000, servePort: 8443 })
 * console.log(program)
 * ```
 *
 * @effects Mutates the local Tailscale Serve configuration.
 * @category services
 * @since 0.0.0
 */
export const ensureTailscaleServe = Effect.fn("Tailscale.ensureServe")(function* (input: {
  readonly localPort: number;
  readonly servePort?: number;
  readonly localHost?: string;
}) {
  const servePort = input.servePort ?? DEFAULT_TAILSCALE_SERVE_PORT;
  const localHost = input.localHost ?? "127.0.0.1";
  const args = ["serve", "--bg", `--https=${servePort}`, `http://${localHost}:${input.localPort}`];
  return yield* runTailscaleCommand(args, TAILSCALE_SERVE_TIMEOUT);
});

/**
 * Disable the configured HTTPS listener for Tailscale Serve.
 *
 * **Example** (Disable Serve on port)
 *
 * ```ts
 * import { disableTailscaleServe } from "@beep/tailscale/Tailscale.service"
 *
 * const program = disableTailscaleServe({ servePort: 8443 })
 * console.log(program)
 * ```
 *
 * @effects Mutates the local Tailscale Serve configuration.
 * @category services
 * @since 0.0.0
 */
export const disableTailscaleServe = Effect.fn("Tailscale.disableServe")(function* (
  input: { readonly servePort?: number } = {}
): Effect.fn.Return<void, TailscaleCommandError, ChildProcessSpawner.ChildProcessSpawner> {
  const servePort = input.servePort ?? DEFAULT_TAILSCALE_SERVE_PORT;
  return yield* runTailscaleCommand(["serve", `--https=${servePort}`, "off"], TAILSCALE_SERVE_TIMEOUT);
});

/**
 * Probe the environment-discovery endpoint through Tailscale HTTPS.
 *
 * **Example** (Probe HTTPS base URL)
 *
 * ```ts
 * import { probeTailscaleHttpsEndpoint } from "@beep/tailscale/Tailscale.service"
 *
 * const program = probeTailscaleHttpsEndpoint({ baseUrl: "https://host.tail.ts.net" })
 * console.log(program)
 * ```
 *
 * @effects Performs one HTTP GET request and converts transport failure to `false`.
 * @category clients
 * @since 0.0.0
 */
export const probeTailscaleHttpsEndpoint = Effect.fn("Tailscale.probeHttpsEndpoint")(function* (input: {
  readonly baseUrl: string;
  readonly timeout?: Duration.Input;
}): Effect.fn.Return<boolean, never, HttpClient.HttpClient> {
  const client = yield* HttpClient.HttpClient;
  const response = yield* Effect.gen(function* () {
    const url = new URL("/.well-known/t3/environment", input.baseUrl);
    const request = HttpClientRequest.get(url.toString());
    return yield* client.execute(request);
  }).pipe(
    Effect.timeoutOption(input.timeout ?? TAILSCALE_PROBE_TIMEOUT),
    Effect.orElseSucceed(O.none<HttpClientResponse.HttpClientResponse>)
  );

  return pipe(
    response,
    O.map((httpResponse) => N.between(httpResponse.status, { minimum: 200, maximum: 299 })),
    O.getOrElse(() => false)
  );
});

/**
 * Build the normalized HTTPS origin for a MagicDNS node name.
 *
 * **Example** (Build HTTPS origin URL)
 *
 * ```ts
 * import { buildTailscaleHttpsBaseUrl } from "@beep/tailscale/Tailscale.service"
 *
 * console.log(buildTailscaleHttpsBaseUrl({ magicDnsName: "host.tail.ts.net", servePort: 8443 }))
 * // "https://host.tail.ts.net:8443/"
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export function buildTailscaleHttpsBaseUrl(input: {
  readonly magicDnsName: string;
  readonly servePort?: number | undefined;
}): string {
  const url = new URL(`https://${input.magicDnsName}`);
  const servePort = input.servePort ?? DEFAULT_TAILSCALE_SERVE_PORT;
  if (servePort !== DEFAULT_TAILSCALE_SERVE_PORT) {
    url.port = `${servePort}`;
  }
  url.pathname = "/";
  return url.toString();
}

/**
 * Resolve the local node's Tailscale HTTPS origin from live status.
 *
 * **Example** (Resolve HTTPS from status)
 *
 * ```ts
 * import { resolveTailscaleHttpsBaseUrl } from "@beep/tailscale/Tailscale.service"
 *
 * const program = resolveTailscaleHttpsBaseUrl({ servePort: 8443 })
 * console.log(program)
 * ```
 *
 * @effects Spawns `tailscale status --json` and reads its output.
 * @category services
 * @since 0.0.0
 */
export const resolveTailscaleHttpsBaseUrl = Effect.fn("Tailscale.resolveHttpsBaseUrl")(function* (
  input: { readonly servePort?: number } = {}
): Effect.fn.Return<
  O.Option<string>,
  TailscaleCommandError | TailscaleStatusParseError,
  ChildProcessSpawner.ChildProcessSpawner
> {
  return yield* readTailscaleStatus.pipe(
    Effect.map((status) =>
      status.magicDnsName.pipe(
        O.map((magicDnsName) =>
          buildTailscaleHttpsBaseUrl({
            magicDnsName,
            servePort: input.servePort,
          })
        )
      )
    )
  );
});
