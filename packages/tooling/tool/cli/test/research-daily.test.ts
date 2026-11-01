import {
  pullResearchNotionLinks,
  ResearchCognifyOptions,
  ResearchCommandServiceLive,
  ResearchDailyOptions,
  ResearchNotionPullOptions,
} from "@beep/repo-cli/commands/Research";
import {
  COGNEE_API_URL_INSECURE,
  COGNEE_CREDENTIALS_MISSING,
  CogneeApiUrl,
  cogneeLogin,
  cognifyImpl,
  commitVault,
  dailyImpl,
  readCogneeSettings,
  VAULT_DIRS,
} from "@beep/repo-cli/test/Research";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { expect, layer } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";

// Nothing in this suite may reach a Cognee server: the one URL used points at
// the loopback discard port so the login request is refused immediately.
const UNREACHABLE_COGNEE_URL = "http://127.0.0.1:9";
const isCogneeApiUrl = S.is(CogneeApiUrl);

const testLayer = Layer.mergeAll(
  ResearchCommandServiceLive.pipe(
    Layer.provideMerge(
      FetchHttpClient.layer.pipe(Layer.provideMerge(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer)))
    )
  ),
  Layer.mergeAll(NodeServices.layer, NodeCrypto.layer)
);

// A stand-in Cognee that answers every request with a redirect off the loopback
// host, the shape a downgrade or a moved login endpoint would take. The test scope
// owns the server, so it stops when the one test using it ends.
const redirectingCognee = Effect.acquireRelease(
  Effect.sync(() =>
    Bun.serve({
      fetch: () =>
        new Response(null, {
          headers: { location: "http://cognee.example.com/api/v1/auth/login" },
          status: 302,
        }),
      hostname: "127.0.0.1",
      port: 0,
    })
  ),
  (server) => Effect.promise(() => server.stop(true))
).pipe(Effect.map((server) => `http://127.0.0.1:${server.port}`));

// Per-test configuration is a pure provider value, so it is provided as a
// service instead of rebuilding a layer for every test.
const withConfig = (env: Readonly<Record<string, string>>) =>
  Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(env));

// Real git, run through the Effect spawner so the suite loads on Node and Bun
// alike; the enclosing test scope owns the process handle.
const git = Effect.fn("ResearchDailyTest.git")(function* (cwd: string, args: ReadonlyArray<string>) {
  const handle = yield* ChildProcess.make("git", [...args], {
    cwd,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "ignore",
  });
  const output = yield* handle.stdout.pipe(Stream.decodeText(), Stream.mkString);
  const exitCode = yield* handle.exitCode;
  expect(exitCode).toBe(0);
  return Str.trim(output);
});

const encodeLinksFile = S.encodeEffect(S.fromJsonString(S.Unknown));

// Seed one card pending cognify through the local notion-pull links-file seam;
// the links file lives outside the vault so the vault tree stays untouched.
const seedPendingCard = Effect.fn("ResearchDailyTest.seedPendingCard")(function* (vaultRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const linksRoot = yield* fs.makeTempDirectoryScoped({ prefix: "research-links-" });
  const linksFile = path.join(linksRoot, "links.json");
  yield* fs.writeFileString(
    linksFile,
    yield* encodeLinksFile([{ title: "Pending Card", url: "https://example.com/pending" }])
  );
  const summary = yield* pullResearchNotionLinks(
    ResearchNotionPullOptions.make({ database: "Reading List", linksFile, vaultRoot })
  );
  expect(summary.cardsWritten).toBe(1);
});

const STATE_FILE = `${VAULT_DIRS.state}/index.txt`;
const NOTE_FILE = `${VAULT_DIRS.inbox}/note.md`;

// A vault repository holding one note plus machine state; `ignoreState` mirrors
// the real vault's `.gitignore`, which lists the state directory.
const initVault = Effect.fn("ResearchDailyTest.initVault")(function* (options: { readonly ignoreState: boolean }) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const vaultRoot = yield* fs.makeTempDirectoryScoped({ prefix: "research-vault-" });
  yield* git(vaultRoot, ["init", "-q", "-b", "main"]);
  yield* git(vaultRoot, ["config", "user.email", "research-daily@example.test"]);
  yield* git(vaultRoot, ["config", "user.name", "Research Daily Test"]);
  // Mirror the workstation: every commit is SSH-signed through a desktop helper
  // that a headless unit cannot reach. `/bin/false` stands in for that helper,
  // so a capture commit that tried to sign would fail exactly as it did nightly.
  yield* git(vaultRoot, ["config", "commit.gpgsign", "true"]);
  yield* git(vaultRoot, ["config", "gpg.format", "ssh"]);
  yield* git(vaultRoot, [
    "config",
    "user.signingkey",
    "key::ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIPlaceholderPlaceholderPlaceholderPlaceholderPlac",
  ]);
  yield* git(vaultRoot, ["config", "gpg.ssh.program", "/bin/false"]);
  if (options.ignoreState) {
    yield* fs.writeFileString(path.join(vaultRoot, ".gitignore"), `${VAULT_DIRS.state}/\n`);
  }
  yield* fs.makeDirectory(path.join(vaultRoot, VAULT_DIRS.state), { recursive: true });
  yield* fs.writeFileString(path.join(vaultRoot, STATE_FILE), "rebuildable machine state\n");
  yield* fs.makeDirectory(path.join(vaultRoot, VAULT_DIRS.inbox), { recursive: true });
  yield* fs.writeFileString(path.join(vaultRoot, NOTE_FILE), "# note\n");
  return vaultRoot;
});

layer(testLayer, { timeout: "30 seconds" })("research daily commit", (it) => {
  it.effect("commits the vault when its .gitignore already ignores the state directory", () =>
    Effect.gen(function* () {
      const vaultRoot = yield* initVault({ ignoreState: true });

      yield* commitVault(vaultRoot);

      const tracked = yield* git(vaultRoot, ["ls-files"]);
      expect(tracked).toContain(NOTE_FILE);
      expect(tracked).toContain(".gitignore");
      expect(tracked).not.toContain(VAULT_DIRS.state);
      const subject = yield* git(vaultRoot, ["log", "-1", "--format=%s"]);
      expect(Str.startsWith("capture ")(subject)).toBe(true);
      // Machine captures are committed unsigned; a signing attempt would have failed above.
      expect(yield* git(vaultRoot, ["log", "-1", "--format=%G?"])).toBe("N");

      // A second run finds the vault clean and adds no commit.
      yield* commitVault(vaultRoot);
      expect(yield* git(vaultRoot, ["rev-list", "--count", "HEAD"])).toBe("1");
    })
  );

  it.effect("keeps the state directory out of the commit when the vault does not ignore it", () =>
    Effect.gen(function* () {
      const vaultRoot = yield* initVault({ ignoreState: false });

      yield* commitVault(vaultRoot);

      const tracked = yield* git(vaultRoot, ["ls-files"]);
      expect(tracked).toContain(NOTE_FILE);
      expect(tracked).not.toContain(VAULT_DIRS.state);
      expect(yield* git(vaultRoot, ["rev-list", "--count", "HEAD"])).toBe("1");
      // The state directory stays untracked on disk rather than being deleted or staged.
      const status = yield* git(vaultRoot, ["status", "--porcelain"]);
      expect(status).toContain(`?? ${VAULT_DIRS.state}/`);
    })
  );

  it.effect("fails with the check-ignore exit code when the vault is not a git repository", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const notARepo = yield* fs.makeTempDirectoryScoped({ prefix: "research-not-a-repo-" });

      const error = yield* Effect.flip(commitVault(notARepo));

      expect(error.message).toContain(`git check-ignore -q ${VAULT_DIRS.state} exited with 128`);
    })
  );
});

layer(testLayer, { timeout: "30 seconds" })("research daily cognify gate", (it) => {
  it.effect("skips cognify with the EnvironmentFile hint and still commits the vault", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const vaultRoot = yield* initVault({ ignoreState: true });
      // An empty HOME means history-sift finds no browser profiles.
      const home = yield* fs.makeTempDirectoryScoped({ prefix: "research-home-" });

      const summary = yield* dailyImpl(
        ResearchDailyOptions.make({
          browser: "all",
          commit: true,
          sinceDays: S.Natural.make(1),
          vaultRoot,
        })
      ).pipe(withConfig({ HOME: home }));

      expect(summary.ran).toEqual(["history-sift", "digest", "commit"]);
      expect(summary.skipped).toEqual(["notion-pull (no --page)", `cognify (${COGNEE_CREDENTIALS_MISSING})`]);
      expect(summary.failed).toEqual([]);
      expect(COGNEE_CREDENTIALS_MISSING).toContain("COGNEE_API_URL in $HOME/.config/beep-research/env");

      const tracked = yield* git(vaultRoot, ["ls-files"]);
      expect(tracked).toContain(`${VAULT_DIRS.digest}/`);
      expect(tracked).not.toContain(VAULT_DIRS.state);
    })
  );

  it.effect("fails an explicit cognify with the same hint when cards are pending and no URL is set", () =>
    Effect.gen(function* () {
      const vaultRoot = yield* initVault({ ignoreState: true });
      yield* seedPendingCard(vaultRoot);

      const error = yield* Effect.flip(
        cognifyImpl(ResearchCognifyOptions.make({ dryRun: false, vaultRoot })).pipe(withConfig({}))
      );

      expect(error.message).toBe(COGNEE_CREDENTIALS_MISSING);
    })
  );

  it.effect("names the Cognee URL when the login request cannot connect", () =>
    Effect.gen(function* () {
      const vaultRoot = yield* initVault({ ignoreState: true });
      yield* seedPendingCard(vaultRoot);

      const error = yield* Effect.flip(
        cognifyImpl(ResearchCognifyOptions.make({ dryRun: false, vaultRoot })).pipe(
          withConfig({ COGNEE_API_URL: UNREACHABLE_COGNEE_URL })
        )
      );

      expect(Str.startsWith(`Cognee login request to ${UNREACHABLE_COGNEE_URL} failed: `)(error.message)).toBe(true);
    })
  );

  it.effect("reports invalid Cognee settings as a failed cognify step without aborting the run", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const vaultRoot = yield* initVault({ ignoreState: true });
      const home = yield* fs.makeTempDirectoryScoped({ prefix: "research-home-" });

      const summary = yield* dailyImpl(
        ResearchDailyOptions.make({
          browser: "all",
          commit: false,
          sinceDays: S.Natural.make(1),
          vaultRoot,
        })
      ).pipe(withConfig({ COGNEE_API_EMAIL: "not-an-email", COGNEE_API_URL: UNREACHABLE_COGNEE_URL, HOME: home }));

      expect(summary.failed).toEqual(["cognify"]);
      expect(summary.ran).toEqual(["history-sift", "digest"]);
      expect(summary.skipped).toEqual(["notion-pull (no --page)"]);
    })
  );

  it.effect("fails an explicit cognify without credentials even when nothing is pending", () =>
    Effect.gen(function* () {
      const vaultRoot = yield* initVault({ ignoreState: true });

      const error = yield* Effect.flip(
        cognifyImpl(ResearchCognifyOptions.make({ dryRun: false, vaultRoot })).pipe(withConfig({}))
      );

      expect(error.message).toBe(COGNEE_CREDENTIALS_MISSING);
    })
  );

  it.effect("keeps a dry-run cognify credential-free on an empty vault", () =>
    Effect.gen(function* () {
      const vaultRoot = yield* initVault({ ignoreState: true });

      const summary = yield* cognifyImpl(ResearchCognifyOptions.make({ dryRun: true, vaultRoot })).pipe(withConfig({}));

      expect(summary.cardsPushed).toBe(0);
      expect(summary.dryRun).toBe(true);
    })
  );

  it.effect("rejects a cleartext Cognee URL off the loopback host and accepts https or loopback http", () =>
    Effect.gen(function* () {
      const insecure = yield* Effect.flip(
        readCogneeSettings.pipe(withConfig({ COGNEE_API_URL: "http://cognee.example.com" }))
      );
      expect(insecure.message).toBe(COGNEE_API_URL_INSECURE);

      const secure = yield* readCogneeSettings.pipe(withConfig({ COGNEE_API_URL: "https://cognee.example.com" }));
      assertSome(
        O.map(secure, (settings) => settings.apiUrl),
        "https://cognee.example.com"
      );

      const loopback = yield* readCogneeSettings.pipe(withConfig({ COGNEE_API_URL: UNREACHABLE_COGNEE_URL }));
      assertSome(
        O.map(loopback, (settings) => settings.apiUrl),
        UNREACHABLE_COGNEE_URL
      );
      expect(isCogneeApiUrl("http://localhost:8010")).toBe(true);
      expect(isCogneeApiUrl("http://127.0.0.1:8010")).toBe(true);
      expect(isCogneeApiUrl("http://127.255.255.254")).toBe(true);
      expect(isCogneeApiUrl("http://127.example.com")).toBe(false);
      expect(isCogneeApiUrl("http://127.0.0.256")).toBe(false);
      expect(isCogneeApiUrl("not a url")).toBe(false);
    })
  );

  it.effect("refuses to follow a redirect from the Cognee login endpoint", () =>
    Effect.gen(function* () {
      const baseUrl = yield* redirectingCognee;
      const settings = yield* readCogneeSettings.pipe(withConfig({ COGNEE_API_URL: baseUrl }));
      const error = yield* Effect.flip(
        O.match(settings, {
          onNone: () => Effect.die(new Error("Cognee settings were expected for a loopback URL")),
          onSome: cogneeLogin,
        })
      );

      expect(error.message).toContain(`Cognee login at ${baseUrl} answered with a redirect (302)`);
    })
  );
});
