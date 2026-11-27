/**
 * Human-operated GitHub App registration through the manifest flow.
 *
 * **Details**
 *
 * `serve` starts a loopback server on `127.0.0.1:8787`. Its `/` page POSTs the
 * checked-in manifest to the beep-effect organization's App registration page
 * with a random `state`; `/callback` accepts one request whose `state` matches,
 * converts the code, and stores the credentials through the vault writer's stdin.
 * No secret reaches argv, stdout, stderr, the callback page, or a file.
 *
 * The vault writer is a human-capable 1Password CLI (`op-human` when it is on
 * `PATH`, else `op`, or the `--op-cli` override). Before the server listens, a
 * startup access check creates and deletes a throwaway item in the vault. It makes
 * a lost key unlikely, not impossible: 1Password access can still expire, or the
 * operator can reject a later approval, between the check and the callback's write.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { GitHubAppName, gitHubAppManifestPath } from "@beep/repo-configs/PolicyData";
import { findRepoRoot } from "@beep/repo-utils";
import * as BunHttpServer from "@effect/platform-bun/BunHttpServer";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Context from "effect/Context";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { constant, pipe } from "effect/Function";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpServer from "effect/http/HttpServer";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Url from "effect/http/Url";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { GithubCommandError } from "./Github.errors.ts";
import {
  GitHubAppManifest,
  GitHubAppManifestConversion,
  GitHubAppRegistrationOutcome,
  GitHubAppVaultWriter,
} from "./Github.schemas.ts";

const $I = $RepoCliId.create("commands/Github/Github.service");

const PORT = 8787;
const VAULT = "BEEP_SECRETS";
const ALLOWED_HOSTS = [`localhost:${PORT}`, `127.0.0.1:${PORT}`];
const Json = S.fromJsonString(S.Unknown);
const encodeJson = S.encodeEffect(Json);
const decodeJson = S.decodeUnknownEffect(Json);
const decodeManifest = S.decodeUnknownEffect(GitHubAppManifest);
const decodeConversion = S.decodeUnknownEffect(GitHubAppManifestConversion);
const pageHeaders = {
  "cache-control": "no-store",
  "referrer-policy": "no-referrer",
  "content-type": "text/html; charset=utf-8",
  "content-security-policy": "default-src 'none'; form-action https://github.com; frame-ancestors 'none'",
};
const page = (body: string, status = 200) => HttpServerResponse.text(body, { status, headers: pageHeaders });

type Outcome = GitHubAppRegistrationOutcome;

interface OutcomeReport {
  readonly body: string;
  readonly line: Effect.Effect<void>;
  readonly status: number;
}

interface AppProfile {
  readonly diagnoseBeforeReport: boolean;
  readonly itemTitle: string;
  readonly listening: string;
  readonly recordsSlug: boolean;
  readonly report: (outcome: Outcome) => OutcomeReport;
}

const reviewerFailure =
  "Conversion or vault write failed. No secret was printed or saved locally. Inspect the App settings and revoke the generated key before retrying.";

const reviewerProfile: AppProfile = {
  itemTitle: "beep-reviewer GitHub App",
  recordsSlug: false,
  diagnoseBeforeReport: false,
  listening: `Open http://localhost:${PORT} as kriegcloud. The callback never displays credentials. Ctrl-C stops the server.`,
  report: GitHubAppRegistrationOutcome.match({
    Stored: () => ({
      line: Effect.void,
      body: "Stored in 1Password. Stop this server, install the App on beep-effect/beep-effect only, then record installation_id.",
      status: 200,
    }),
    ConversionFailed: (failed) => ({
      line: Console.error(`[reviewer-bootstrap] Manifest conversion returned HTTP ${failed.status}.`),
      body: reviewerFailure,
      status: 500,
    }),
    StoreFailed: (failed) => ({
      line: Console.error(
        `[reviewer-bootstrap] 1Password item creation exited ${failed.exitCode}; secret diagnostics suppressed.`
      ),
      body: reviewerFailure,
      status: 500,
    }),
    Failed: () => ({ line: Effect.void, body: reviewerFailure, status: 500 }),
  }),
};

const mintTitle = "beep-knowledge-mint GitHub App";
const constEmpty = constant(Str.empty);
const slugOf = (slug: O.Option<string>) => O.getOrElse(slug, constEmpty);

const sluggedProfile = (tag: string, itemTitle: string, storedNext: string): AppProfile => ({
  itemTitle,
  recordsSlug: true,
  diagnoseBeforeReport: true,
  listening: `[${tag}] Listening. Open http://localhost:${PORT} in Chrome as kriegcloud. The callback never displays credentials. Ctrl-C stops the server.`,
  report: GitHubAppRegistrationOutcome.match({
    Stored: (stored) => ({
      line: Console.log(
        `[${tag}] Stored "${itemTitle}" in BEEP_SECRETS for App ${slugOf(stored.slug)} (app_id ${stored.appId}). ${storedNext}`
      ),
      body: `Stored in 1Password as "${itemTitle}" (App ${slugOf(stored.slug)}). Install it on beep-effect/beep-effect only, record installation_id, then stop the launcher with Ctrl-C.`,
      status: 200,
    }),
    ConversionFailed: (failed) => ({
      line: Console.error(`[${tag}] Manifest conversion returned HTTP ${failed.status}; nothing was stored.`),
      body: `Manifest conversion returned HTTP ${failed.status}. Nothing was stored. Check the App registration page before starting over.`,
      status: 500,
    }),
    StoreFailed: (failed) => ({
      line: Console.error(
        `[${tag}] App ${slugOf(failed.slug)} was registered, but 1Password item creation exited ${failed.exitCode}; secret diagnostics suppressed. Do not reload the callback.`
      ),
      body: `App ${slugOf(failed.slug)} was registered, but storing it in 1Password failed (exit ${failed.exitCode}). Do not reload this page: the code is single-use. Revoke the new App's generated private key, delete the uninstalled registration, then start the launcher again.`,
      status: 500,
    }),
    Failed: () => ({
      line: Console.error(
        `[${tag}] Conversion or vault write failed; diagnostics suppressed. Do not reload the callback.`
      ),
      body: "Conversion or vault write failed. No secret was printed or saved locally. Do not reload this page. Inspect the App settings, revoke any generated key, and delete an uninstalled new registration before retrying.",
      status: 500,
    }),
  }),
});

const knowledgeMintProfile = sluggedProfile(
  "knowledge-mint",
  mintTitle,
  "Install it, record installation_id, then press Ctrl-C."
);

const infraGithubProfile = sluggedProfile(
  "infra-github",
  "beep-infra-github GitHub App",
  "Install it on beep-effect/beep-effect only, record installation_id, then press Ctrl-C and continue with the InfraGithub runbook section."
);

const fleetWatchProfile = sluggedProfile(
  "fleet-watch",
  "beep-fleet-watch GitHub App",
  'Install it: on the App\'s page click "Install App" in the left sidebar, then "Install" beside beep-effect, choose "Only select repositories", pick beep-effect/beep-effect and click "Install". Then press Ctrl-C.'
);

const profileOf = GitHubAppName.match({
  "beep-reviewer": () => reviewerProfile,
  "beep-knowledge-mint": () => knowledgeMintProfile,
  "beep-infra-github": () => infraGithubProfile,
  "beep-fleet-watch": () => fleetWatchProfile,
});

const vaultTemplate = (profile: AppProfile, converted: GitHubAppManifestConversion, slug: O.Option<string>) =>
  encodeJson({
    title: profile.itemTitle,
    category: "API_CREDENTIAL",
    fields: [
      { id: "app_id", label: "app_id", type: "STRING", value: `${converted.id}` },
      { id: "client_id", label: "client_id", type: "STRING", value: converted.client_id },
      { id: "installation_id", label: "installation_id", type: "STRING", value: "" },
      ...(profile.recordsSlug ? [{ id: "slug", label: "slug", type: "STRING", value: slugOf(slug) }] : []),
      { id: "private_key", label: "private_key", type: "CONCEALED", value: Redacted.value(converted.pem) },
    ],
  });

// decision: github-app-credentials-reach-op-through-a-pipe
const storeCommand = (writer: GitHubAppVaultWriter, template: string) =>
  ChildProcess.make(
    "bash",
    ["-o", "pipefail", "-c", `cat | "$1" item create --vault ${VAULT} -`, "github-app-mint", writer.command],
    {
      stdin: Stream.make(template).pipe(Stream.encodeText),
      stdout: "ignore",
      stderr: "ignore",
      extendEnv: true,
    }
  );

const exitCodeOf = (command: ChildProcess.Command) =>
  ChildProcessSpawner.ChildProcessSpawner.use((spawner) => spawner.exitCode(command)).pipe(
    Effect.orElseSucceed(constant(127))
  );

const hasOpHuman = Effect.map(
  exitCodeOf(
    ChildProcess.make("sh", ["-c", "command -v op-human"], { stdout: "ignore", stderr: "ignore", extendEnv: true })
  ),
  (exitCode) => exitCode === 0
);

/**
 * Chooses the 1Password CLI that stores a minted App's credentials.
 *
 * **Details**
 *
 * A non-empty override wins. Otherwise `op-human`, the operator's
 * desktop-approved CLI, is chosen when it is on `PATH`, and `op` is the
 * fallback. The mint is always operator-attended, so a human-capable CLI is
 * the right writer; on agent workstations `op` is a service-account shim that
 * cannot create items.
 *
 * **Example** (Resolve with an explicit override)
 *
 * ```ts
 * import { resolveGitHubAppVaultWriter } from "@beep/repo-cli/commands/Github"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * const program = resolveGitHubAppVaultWriter(O.some("/usr/bin/op"))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param override - The operator's `--op-cli` value, if any.
 * @returns The chosen writer and the reason it was chosen.
 * @category constructors
 * @since 0.0.0
 */
export const resolveGitHubAppVaultWriter = (
  override: O.Option<string>
): Effect.Effect<GitHubAppVaultWriter, never, ChildProcessSpawner.ChildProcessSpawner> =>
  O.match(O.filter(override, Str.isNonEmpty), {
    onSome: (command) => Effect.succeed(GitHubAppVaultWriter.make({ command, source: "override" })),
    onNone: () =>
      Effect.map(hasOpHuman, (found) =>
        found
          ? GitHubAppVaultWriter.make({ command: "op-human", source: "op-human" })
          : GitHubAppVaultWriter.make({ command: "op", source: "op" })
      ),
  });

const preflightTemplate = (title: string) =>
  encodeJson({
    title,
    category: "SECURE_NOTE",
    fields: [
      {
        id: "notesPlain",
        label: "notesPlain",
        type: "STRING",
        purpose: "NOTES",
        value: "Throwaway write check from beep github app mint; safe to delete.",
      },
    ],
  });

/**
 * Proves the vault writer can create and delete an item in the target vault.
 *
 * **Details**
 *
 * The check creates a throwaway secure note through the same stdin pipe the
 * credential write uses, then deletes it by its unique title. Either step
 * failing refuses the mint before the loopback server listens. This is a startup
 * access check: it makes a lost private key unlikely, not impossible, because
 * 1Password access can expire, or the operator can reject the later approval,
 * after it passes. The callback still reports a failed write with recovery steps.
 *
 * **Example** (Build the preflight)
 *
 * ```ts
 * import { GitHubAppVaultWriter, preflightGitHubAppVaultWriter } from "@beep/repo-cli/commands/Github"
 * import * as Effect from "effect/Effect"
 *
 * const writer = GitHubAppVaultWriter.make({ command: "op-human", source: "op-human" })
 * console.log(Effect.isEffect(preflightGitHubAppVaultWriter(writer, "nonce"))) // true
 * ```
 *
 * @param writer - The CLI that will store the credentials.
 * @param nonce - A unique suffix for the throwaway item's title.
 * @returns Nothing on success; a refusal naming the failed step otherwise.
 * @category constructors
 * @since 0.0.0
 */
export const preflightGitHubAppVaultWriter = Effect.fn("GitHubAppMint.preflight")(function* (
  writer: GitHubAppVaultWriter,
  nonce: string
) {
  const title = `beep github app mint preflight ${nonce}`;
  const refuse = (message: string) =>
    GithubCommandError.make({ path: `${writer.command} (${writer.source}) -> ${VAULT}`, message });
  const template = yield* Effect.orDie(preflightTemplate(title));
  const created = yield* exitCodeOf(storeCommand(writer, template));
  if (created !== 0) {
    return yield* refuse(
      `${writer.command} cannot create items in ${VAULT} (exit ${created}); refusing to start before any App is registered. Sign in a human-capable 1Password CLI (op-human) or pass --op-cli <command>.`
    );
  }
  const deleted = yield* exitCodeOf(
    ChildProcess.make(writer.command, ["item", "delete", title, "--vault", VAULT], {
      stdout: "ignore",
      stderr: "ignore",
      extendEnv: true,
    })
  );
  if (deleted !== 0) {
    return yield* refuse(
      `${writer.command} created the preflight item "${title}" in ${VAULT} but could not delete it (exit ${deleted}); refusing to start. Delete that item by hand before retrying.`
    );
  }
});

const diagnose = ChildProcessSpawner.ChildProcessSpawner.use((spawner) =>
  spawner.exitCode(ChildProcess.make("op-doctor", [], { stdout: "inherit", stderr: "ignore", extendEnv: true }))
).pipe(Effect.ignore);

const convertAndStore = Effect.fn("GitHubAppMint.convertAndStore")(function* (
  profile: AppProfile,
  writer: GitHubAppVaultWriter,
  code: string
) {
  const client = yield* HttpClient.HttpClient;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const response = yield* client.execute(
    HttpClientRequest.post(`https://api.github.com/app-manifests/${encodeURIComponent(code)}/conversions`).pipe(
      HttpClientRequest.setHeaders({ accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" })
    )
  );
  if (response.status !== 201) {
    return GitHubAppRegistrationOutcome.cases.ConversionFailed.make({ status: response.status });
  }
  const converted = yield* Effect.flatMap(response.json, decodeConversion);
  const slug = O.fromUndefinedOr(converted.slug);
  if (profile.recordsSlug && O.isNone(slug)) {
    return GitHubAppRegistrationOutcome.cases.Failed.make({});
  }
  const template = yield* vaultTemplate(profile, converted, slug);
  const exitCode = yield* spawner.exitCode(storeCommand(writer, template));
  return exitCode === 0
    ? GitHubAppRegistrationOutcome.cases.Stored.make({ slug, appId: converted.id })
    : GitHubAppRegistrationOutcome.cases.StoreFailed.make({ slug, exitCode });
});

const reportOutcome = (profile: AppProfile, outcome: Outcome) => {
  const { line, body, status } = profile.report(outcome);
  const diagnosed = profile.diagnoseBeforeReport ? Effect.andThen(diagnose, line) : Effect.andThen(line, diagnose);
  const announce = GitHubAppRegistrationOutcome.guards.StoreFailed(outcome) ? diagnosed : line;
  return Effect.as(announce, page(body, status));
};

const escapeAttribute = (value: string) =>
  pipe(value, Str.replaceAll("&", "&amp;"), Str.replaceAll('"', "&quot;"), Str.replaceAll("<", "&lt;"));

/**
 * Builds the loopback request handler for one registration attempt.
 *
 * **Details**
 *
 * `/` serves a form that POSTs the manifest to the beep-effect organization's App
 * registration page with `state` set to `nonce`. `/callback` accepts exactly one
 * GET whose `state` matches, exchanges the code, and stores the credentials. Any
 * other host, method, path, state, or a second callback is rejected with 400.
 * The credentials go through `writer`, which `serve` has already preflighted.
 *
 * **Gotchas**
 *
 * Each callback outcome prints one terminal line and serves one page, and neither ever
 * carries a credential or payload.
 *
 * **Example** (Build a handler)
 *
 * ```ts
 * import { GitHubAppVaultWriter, makeGitHubAppMintHandler } from "@beep/repo-cli/commands/Github"
 * import * as Effect from "effect/Effect"
 *
 * const writer = GitHubAppVaultWriter.make({ command: "op-human", source: "op-human" })
 * const program = makeGitHubAppMintHandler({ app: "beep-reviewer", nonce: "state", manifestJson: "{}", writer })
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param options - The App being registered, the random `state` bound into the form and checked on
 * callback, the serialized App manifest posted to GitHub, and the vault writer that stores the
 * credentials.
 * @returns The request handler; the conversion needs the HTTP client and the process spawner.
 * @category constructors
 * @since 0.0.0
 */
export const makeGitHubAppMintHandler = ({
  app,
  nonce,
  manifestJson,
  writer,
}: {
  readonly app: GitHubAppName;
  readonly nonce: string;
  readonly manifestJson: string;
  readonly writer: GitHubAppVaultWriter;
}): Effect.Effect<
  Effect.Effect<
    HttpServerResponse.HttpServerResponse,
    never,
    HttpServerRequest.HttpServerRequest | HttpClient.HttpClient | ChildProcessSpawner.ChildProcessSpawner
  >
> =>
  Effect.map(Ref.make(false), (attempted) => {
    const profile = profileOf(app);
    const form = `<form method="POST" action="https://github.com/organizations/beep-effect/settings/apps/new?state=${nonce}"><input type="hidden" name="manifest" value="${escapeAttribute(manifestJson)}"><button>Create ${app} in beep-effect</button></form>`;
    const handleCallback = Effect.fnUntraced(function* (url: URL) {
      const code = O.fromNullishOr(url.searchParams.get("code"));
      if (url.pathname !== "/callback" || url.searchParams.get("state") !== nonce || O.isNone(code)) {
        return page("Invalid or already used callback", 400);
      }
      if (yield* Ref.getAndSet(attempted, true)) {
        return page("Invalid or already used callback", 400);
      }
      const outcome = yield* convertAndStore(profile, writer, code.value).pipe(
        Effect.catchCause(() => Effect.succeed(GitHubAppRegistrationOutcome.cases.Failed.make({})))
      );
      return yield* reportOutcome(profile, outcome);
    });
    return Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest;
      const url = pipe(
        Url.fromString(request.originalUrl),
        Result.getSuccess,
        O.filter((value) => A.contains(ALLOWED_HOSTS, value.host))
      );
      if (request.method !== "GET" || O.isNone(url)) {
        return page("Rejected", 400);
      }
      return url.value.pathname === "/" ? page(form) : yield* handleCallback(url.value);
    }).pipe(Effect.catchCause(() => Effect.succeed(page("Registration failed; secret diagnostics suppressed.", 500))));
  });

/**
 * GitHub App registration operations bound to one checkout.
 *
 * @category models
 * @since 0.0.0
 */
export interface GitHubAppMintShape {
  /** Reads, validates, and returns the App manifest exactly as checked in. */
  readonly manifestText: (app: GitHubAppName) => Effect.Effect<string, GithubCommandError>;
  /**
   * Preflights the vault writer (the override, else `op-human` on `PATH`, else `op`), then serves
   * the registration flow until interrupted.
   */
  readonly serve: (app: GitHubAppName, opCli: O.Option<string>) => Effect.Effect<never, GithubCommandError>;
}

/**
 * Owns the human-operated GitHub App manifest registration flow.
 *
 * **Details**
 *
 * The per-App divergences of the shared flow (log tag, vault item title, the Stored line's
 * closing instruction, and whether `op-doctor` runs before or after a store-failure line) are
 * kept exactly as each App's launcher emitted them.
 *
 * **Example** (Print a manifest)
 *
 * ```ts
 * import { GitHubAppMint } from "@beep/repo-cli/commands/Github"
 * import * as Effect from "effect/Effect"
 *
 * const program = GitHubAppMint.use((mint) => mint.manifestText("beep-reviewer"))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class GitHubAppMint extends Context.Service<GitHubAppMint, GitHubAppMintShape>()($I`GitHubAppMint`) {}

const makeGitHubAppMint = Effect.fn("GitHubAppMint.make")(function* (owner: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const context = yield* Effect.context<
    HttpClient.HttpClient | ChildProcessSpawner.ChildProcessSpawner | SecureRandom.SecureRandom
  >();

  const manifestText: GitHubAppMintShape["manifestText"] = Effect.fn("GitHubAppMint.manifestText")(function* (app) {
    const file = path.join(owner, gitHubAppManifestPath(app));
    const text = yield* fs
      .readFileString(file)
      .pipe(
        Effect.mapError((cause) =>
          GithubCommandError.make({ path: file, message: "Cannot read the App manifest.", cause })
        )
      );
    yield* decodeJson(text).pipe(
      Effect.flatMap(decodeManifest),
      Effect.mapError((cause) => GithubCommandError.make({ path: file, message: "Invalid App manifest.", cause }))
    );
    return text;
  });

  const serve: GitHubAppMintShape["serve"] = Effect.fn("GitHubAppMint.serve")(function* (app, opCli) {
    const text = yield* manifestText(app);
    const manifestJson = yield* decodeJson(text).pipe(Effect.flatMap(encodeJson), Effect.orDie);
    const nonce = yield* SecureRandom.SecureRandom.use((random) => random.uuidV4()).pipe(Effect.provide(context));
    const writer = yield* resolveGitHubAppVaultWriter(opCli).pipe(Effect.provide(context));
    yield* preflightGitHubAppVaultWriter(writer, nonce).pipe(Effect.provide(context));
    yield* Console.log(`Vault writer ${writer.command} (${writer.source}) can create and delete items in ${VAULT}.`);
    const handler = yield* makeGitHubAppMintHandler({ app, nonce, manifestJson, writer });
    const server = HttpServer.serve(Effect.provide(handler, context)).pipe(
      Layer.provide(BunHttpServer.layer({ hostname: "127.0.0.1", port: PORT }))
    );
    return yield* Layer.build(server).pipe(
      Effect.andThen(Console.log(profileOf(app).listening)),
      Effect.andThen(Effect.never),
      Effect.scoped,
      Effect.mapError((cause) =>
        GithubCommandError.make({ path: `127.0.0.1:${PORT}`, message: "Cannot start the registration server.", cause })
      )
    );
  });

  return GitHubAppMint.of({ manifestText, serve });
});

/**
 * Binds GitHub App registration to the checkout that owns the repo-configs App manifests.
 *
 * **Example** (Prepare an isolated owner)
 *
 * ```ts
 * import { gitHubAppMintLayer } from "@beep/repo-cli/commands/Github"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(gitHubAppMintLayer("/checkout"))) // true
 * ```
 *
 * @param owner - Checkout whose policy data holds the App manifests.
 * @returns A layer providing the registration service for that checkout.
 * @category layers
 * @since 0.0.0
 */
export const gitHubAppMintLayer = (
  owner: string
): Layer.Layer<
  GitHubAppMint,
  never,
  | FileSystem.FileSystem
  | Path.Path
  | HttpClient.HttpClient
  | ChildProcessSpawner.ChildProcessSpawner
  | SecureRandom.SecureRandom
> => Layer.effect(GitHubAppMint, makeGitHubAppMint(owner));

/**
 * Resolves the CLI checkout and binds GitHub App registration to it.
 *
 * **Example** (Inspect the live layer)
 *
 * ```ts
 * import { GitHubAppMintLive } from "@beep/repo-cli/commands/Github"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(GitHubAppMintLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const GitHubAppMintLive = Layer.effect(GitHubAppMint, Effect.flatMap(findRepoRoot(), makeGitHubAppMint));
