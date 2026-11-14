/**
 * Human-operated GitHub App registration through the manifest flow.
 *
 * **Details**
 *
 * `serve` starts a loopback server on `127.0.0.1:8787`. Its `/` page POSTs the
 * checked-in manifest to the beep-effect organization's App registration page
 * with a random `state`; `/callback` accepts one request whose `state` matches,
 * converts the code, and stores the credentials through the `op` process's stdin.
 * No secret reaches argv, stdout, stderr, the callback page, or a file.
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
import { GitHubAppManifest, GitHubAppManifestConversion, GitHubAppRegistrationOutcome } from "./Github.schemas.ts";

const $I = $RepoCliId.create("commands/Github/Github.service");

const PORT = 8787;
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

// One safe terminal line and one safe page per callback outcome; never a credential or payload.
interface OutcomeReport {
  readonly body: string;
  readonly line: Effect.Effect<void>;
  readonly status: number;
}

// The per-App divergences of the shared flow, kept exactly as each App's launcher emitted them.
interface AppProfile {
  // Whether `op-doctor` runs before the store-failure line is printed.
  readonly diagnoseBeforeReport: boolean;
  readonly itemTitle: string;
  readonly listening: string;
  // Whether the vault item records the App slug (and the conversion must carry one).
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

const knowledgeMintProfile: AppProfile = {
  itemTitle: mintTitle,
  recordsSlug: true,
  diagnoseBeforeReport: true,
  listening: `[knowledge-mint] Listening. Open http://localhost:${PORT} in Chrome as kriegcloud. The callback never displays credentials. Ctrl-C stops the server.`,
  report: GitHubAppRegistrationOutcome.match({
    Stored: (stored) => ({
      line: Console.log(
        `[knowledge-mint] Stored "${mintTitle}" in BEEP_SECRETS for App ${slugOf(stored.slug)} (app_id ${stored.appId}). Install it, record installation_id, then press Ctrl-C.`
      ),
      body: `Stored in 1Password as "${mintTitle}" (App ${slugOf(stored.slug)}). Install it on beep-effect/beep-effect only, record installation_id, then stop the launcher with Ctrl-C.`,
      status: 200,
    }),
    ConversionFailed: (failed) => ({
      line: Console.error(`[knowledge-mint] Manifest conversion returned HTTP ${failed.status}; nothing was stored.`),
      body: `Manifest conversion returned HTTP ${failed.status}. Nothing was stored. Check the App registration page before starting over.`,
      status: 500,
    }),
    StoreFailed: (failed) => ({
      line: Console.error(
        `[knowledge-mint] App ${slugOf(failed.slug)} was registered, but 1Password item creation exited ${failed.exitCode}; secret diagnostics suppressed. Do not reload the callback.`
      ),
      body: `App ${slugOf(failed.slug)} was registered, but storing it in 1Password failed (exit ${failed.exitCode}). Do not reload this page: the code is single-use. Revoke the new App's generated private key, delete the uninstalled registration, then start the launcher again.`,
      status: 500,
    }),
    Failed: () => ({
      line: Console.error(
        "[knowledge-mint] Conversion or vault write failed; diagnostics suppressed. Do not reload the callback."
      ),
      body: "Conversion or vault write failed. No secret was printed or saved locally. Do not reload this page. Inspect the App settings, revoke any generated key, and delete an uninstalled new registration before retrying.",
      status: 500,
    }),
  }),
};

const infraGithubTitle = "beep-infra-github GitHub App";

// The InfraGithub deploy identity (goals/infra-alchemy-rebuild). After the mint, the operator follows the
// "InfraGithub" section of docs/runbooks/alchemy-infra.md: install, then the infra-github-prod environment.
const infraGithubProfile: AppProfile = {
  itemTitle: infraGithubTitle,
  recordsSlug: true,
  diagnoseBeforeReport: true,
  listening: `[infra-github] Listening. Open http://localhost:${PORT} in Chrome as kriegcloud. The callback never displays credentials. Ctrl-C stops the server.`,
  report: GitHubAppRegistrationOutcome.match({
    Stored: (stored) => ({
      line: Console.log(
        `[infra-github] Stored "${infraGithubTitle}" in BEEP_SECRETS for App ${slugOf(stored.slug)} (app_id ${stored.appId}). Install it on beep-effect/beep-effect only, record installation_id, then press Ctrl-C and continue with the InfraGithub runbook section.`
      ),
      body: `Stored in 1Password as "${infraGithubTitle}" (App ${slugOf(stored.slug)}). Install it on beep-effect/beep-effect only, record installation_id, then stop the launcher with Ctrl-C.`,
      status: 200,
    }),
    ConversionFailed: (failed) => ({
      line: Console.error(`[infra-github] Manifest conversion returned HTTP ${failed.status}; nothing was stored.`),
      body: `Manifest conversion returned HTTP ${failed.status}. Nothing was stored. Check the App registration page before starting over.`,
      status: 500,
    }),
    StoreFailed: (failed) => ({
      line: Console.error(
        `[infra-github] App ${slugOf(failed.slug)} was registered, but 1Password item creation exited ${failed.exitCode}; secret diagnostics suppressed. Do not reload the callback.`
      ),
      body: `App ${slugOf(failed.slug)} was registered, but storing it in 1Password failed (exit ${failed.exitCode}). Do not reload this page: the code is single-use. Revoke the new App's generated private key, delete the uninstalled registration, then start the launcher again.`,
      status: 500,
    }),
    Failed: () => ({
      line: Console.error(
        "[infra-github] Conversion or vault write failed; diagnostics suppressed. Do not reload the callback."
      ),
      body: "Conversion or vault write failed. No secret was printed or saved locally. Do not reload this page. Inspect the App settings, revoke any generated key, and delete an uninstalled new registration before retrying.",
      status: 500,
    }),
  }),
};

const profileOf = GitHubAppName.match({
  "beep-reviewer": () => reviewerProfile,
  "beep-knowledge-mint": () => knowledgeMintProfile,
  "beep-infra-github": () => infraGithubProfile,
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

// No secret in argv, stdout, stderr, the callback page, or a temporary file. The op CLI needs a
// real pipe to detect a JSON template, so cat bridges the in-memory stdin stream into one.
const storeCommand = (template: string) =>
  ChildProcess.make("bash", ["-o", "pipefail", "-c", "cat | op item create --vault BEEP_SECRETS -"], {
    stdin: Stream.make(template).pipe(Stream.encodeText),
    stdout: "ignore",
    stderr: "ignore",
    extendEnv: true,
  });

// One safe, count-only diagnosis for the operator; a missing op-doctor changes nothing.
const diagnose = ChildProcessSpawner.ChildProcessSpawner.use((spawner) =>
  spawner.exitCode(ChildProcess.make("op-doctor", [], { stdout: "inherit", stderr: "ignore", extendEnv: true }))
).pipe(Effect.ignore);

const convertAndStore = Effect.fn("GitHubAppMint.convertAndStore")(function* (profile: AppProfile, code: string) {
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
  const exitCode = yield* spawner.exitCode(storeCommand(template));
  return exitCode === 0
    ? GitHubAppRegistrationOutcome.cases.Stored.make({ slug, appId: converted.id })
    : GitHubAppRegistrationOutcome.cases.StoreFailed.make({ slug, exitCode });
});

// The outcome's line, with op-doctor before or after it on a store failure as the App's launcher did.
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
 *
 * **Example** (Build a handler)
 *
 * ```ts
 * import { makeGitHubAppMintHandler } from "@beep/repo-cli/commands/Github"
 * import * as Effect from "effect/Effect"
 *
 * const program = makeGitHubAppMintHandler({ app: "beep-reviewer", nonce: "state", manifestJson: "{}" })
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param options - The App being registered, the random `state` bound into the form and checked on
 * callback, and the serialized App manifest posted to GitHub.
 * @returns The request handler; the conversion needs the HTTP client and the process spawner.
 * @category constructors
 * @since 0.0.0
 */
export const makeGitHubAppMintHandler = ({
  app,
  nonce,
  manifestJson,
}: {
  readonly app: GitHubAppName;
  readonly nonce: string;
  readonly manifestJson: string;
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
      // Claimed atomically before the first conversion step, so a concurrent second callback is refused.
      if (yield* Ref.getAndSet(attempted, true)) {
        return page("Invalid or already used callback", 400);
      }
      const outcome = yield* convertAndStore(profile, code.value).pipe(
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
  /** Serves the registration flow until interrupted. */
  readonly serve: (app: GitHubAppName) => Effect.Effect<never, GithubCommandError>;
}

/**
 * Owns the human-operated GitHub App manifest registration flow.
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

  const serve: GitHubAppMintShape["serve"] = Effect.fn("GitHubAppMint.serve")(function* (app) {
    const text = yield* manifestText(app);
    // manifestText already decoded this text as a manifest, so re-encoding it cannot fail; a failure is a defect.
    const manifestJson = yield* decodeJson(text).pipe(Effect.flatMap(encodeJson), Effect.orDie);
    const nonce = yield* SecureRandom.SecureRandom.use((random) => random.uuidV4()).pipe(Effect.provide(context));
    const handler = yield* makeGitHubAppMintHandler({ app, nonce, manifestJson });
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
