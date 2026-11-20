import { Git } from "@beep/git/Git";
import { BeepCiRelease, ciBinaryPinSyncCommand, withHooksPath } from "@beep/repo-cli/commands/Ci/CiBinaryPinSync";
import { runRepoCommandCapture } from "@beep/repo-cli/test/RepoRun";
import { afterAll, beforeAll, describe, expect, it, layer, vi } from "@effect/vitest";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import { NodeTestLayer } from "./support/CommandTest.ts";

// beep-ci-binary.yml runs `beep ci binary-pin-sync` in a detached checkout of the open pin-bump
// branch, then pushes a `merged` head with the pin-bump App token (no force push, so the pull
// request keeps its number and review history). Each fixture is a real repository: `main` and a
// `pin` branch cut from it.

// Hermetic git: no global or system config (a global pull.ff=only, hooks path or signing setup would
// change the merges under test). Every git process here, the command's included, inherits this.
beforeAll(() => {
  vi.stubEnv("GIT_CONFIG_GLOBAL", "/dev/null");
  vi.stubEnv("GIT_CONFIG_NOSYSTEM", "1");
});
afterAll(() => {
  vi.unstubAllEnvs();
});

const testLayer = Layer.mergeAll(NodeTestLayer, TestConsole.layer);
const runSync = Command.runWith(ciBinaryPinSyncCommand, { version: "0.0.0" });

interface Pin {
  readonly sha256: string;
  readonly tag: string;
}

interface Commit {
  readonly file: string;
  readonly message: string;
  readonly text: string;
}

interface Repo {
  readonly before: string;
  readonly output: string;
  readonly releases: string;
  readonly root: string;
}

const PIN_FILE = ".github/actions/fetch-beep-ci/action.yml";
const OLD: Pin = { tag: "beep-ci-a56516d6d309", sha256: A.join(A.replicate("01", 32), "") };
const MID: Pin = { tag: "beep-ci-1111111111aa", sha256: A.join(A.replicate("02", 32), "") };
const NEW: Pin = { tag: "beep-ci-0123456789ab", sha256: A.join(A.replicate("ab", 32), "") };
const NEWER: Pin = { tag: "beep-ci-fedcba987654", sha256: A.join(A.replicate("cd", 32), "") };

const decodeReleaseRows = S.decodeUnknownEffect(S.Array(BeepCiRelease));
const encodeReleases = S.encodeUnknownEffect(S.fromJsonString(S.Array(BeepCiRelease)));
const releaseRows = [
  { tagName: OLD.tag, createdAt: "2026-11-01T00:00:00Z" },
  { tagName: MID.tag, createdAt: "2026-11-05T00:00:00Z" },
  { tagName: NEW.tag, createdAt: "2026-11-10T00:00:00Z" },
  { tagName: NEWER.tag, createdAt: "2026-11-15T00:00:00Z" },
];

const actionText = (pin: Pin, note = "fetch") =>
  A.join(
    [
      "runs:",
      "  using: composite",
      "  steps:",
      `    - name: Fetch and verify the pinned beep CI binary (${note})`,
      "      env:",
      `        BEEP_CI_RELEASE_TAG: ${pin.tag}`,
      `        BEEP_CI_SHA256: ${pin.sha256}`,
      "",
    ],
    "\n"
  );

const gitOutput = (root: string, args: ReadonlyArray<string>) =>
  runRepoCommandCapture("git", args, root).pipe(
    Effect.flatMap((captured) =>
      captured.exitCode === 0
        ? Effect.succeed(Str.trim(captured.output))
        : Effect.die(new Error(`git ${A.join(args, " ")} exited with ${captured.exitCode}: ${captured.output}`))
    )
  );

const head = (root: string) => gitOutput(root, ["rev-parse", "HEAD"]);

const commitFile = Effect.fn("CiBinaryPinSyncTest.commitFile")(function* (root: string, commit: Commit) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const git = yield* Git;
  yield* fs.makeDirectory(path.dirname(path.join(root, commit.file)), { recursive: true });
  yield* fs.writeFileString(path.join(root, commit.file), commit.text);
  yield* git.add(root, [commit.file]);
  yield* git.commit(root, commit.message, { noVerify: true });
});

const unrelated: Commit = { file: "docs/notes.md", text: "# notes\n", message: "unrelated" };
// main took another pin (and touched the step name) after the branch was cut.
const mainRepins: Commit = { file: PIN_FILE, text: actionText(MID, "moved"), message: "pin MID" };
// main changed a workflow file after the branch was cut.
const mainWorkflow: Commit = { file: ".github/workflows/ci.yml", text: "on: push\n", message: "workflow change" };

// `main` pins OLD; the `pin` branch is cut from it and pins `branchPin`, then `main` takes `advance`.
const fixture = Effect.fn("CiBinaryPinSyncTest.fixture")(function* (
  branchPin: Pin,
  advance: O.Option<Commit>,
  listed: ReadonlyArray<{ readonly tagName: string; readonly createdAt: string }> = releaseRows,
  branchText: O.Option<string> = O.none()
) {
  const fs = yield* FileSystem.FileSystem;
  const root = yield* fs.makeTempDirectoryScoped();
  yield* gitOutput(root, ["init", "-q", "-b", "main"]);
  yield* gitOutput(root, ["config", "user.email", "pin-sync@example.test"]);
  yield* gitOutput(root, ["config", "user.name", "Pin Sync Test"]);
  yield* gitOutput(root, ["config", "commit.gpgsign", "false"]);
  yield* gitOutput(root, ["config", "pull.rebase", "false"]);
  yield* commitFile(root, { file: PIN_FILE, text: actionText(OLD), message: "pin OLD" });
  yield* gitOutput(root, ["checkout", "-q", "-b", "pin"]);
  yield* commitFile(root, {
    file: PIN_FILE,
    text: O.getOrElse(branchText, () => actionText(branchPin)),
    message: "bump the pin",
  });
  yield* gitOutput(root, ["checkout", "-q", "main"]);
  if (O.isSome(advance)) {
    yield* commitFile(root, advance.value);
  }
  yield* gitOutput(root, ["checkout", "-q", "pin"]);
  const scratch = yield* fs.makeTempDirectoryScoped();
  const releases = `${scratch}/releases.json`;
  const rows = yield* decodeReleaseRows(listed);
  const releasesText = yield* encodeReleases(rows);
  yield* fs.writeFileString(releases, releasesText);
  const before = yield* head(root);
  const repo: Repo = { root, releases, output: `${scratch}/output`, before };
  return repo;
});

const syncLines = Effect.fn("CiBinaryPinSyncTest.syncLines")(function* (repo: Repo) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.remove(repo.output, { force: true });
  yield* runSync([
    "--cwd",
    repo.root,
    "--base",
    "main",
    "--tag",
    NEW.tag,
    "--sha256",
    NEW.sha256,
    "--releases",
    repo.releases,
    "--output",
    repo.output,
  ]);
  const text = yield* fs.readFileString(repo.output);
  return A.filter(Str.split(text, "\n"), Str.isNonEmpty);
});

// The decision lines without the trailing `pin_only=` record, which tests assert on its own.
const sync = Effect.fn("CiBinaryPinSyncTest.sync")(function* (repo: Repo) {
  const lines = yield* syncLines(repo);
  return A.filter(lines, (line) => !Str.startsWith("pin_only=")(line));
});

// The output lines of one run: the outcome, then the pin the branch keeps.
const decided = (outcome: string, pin: O.Option<Pin>) => [
  `outcome=${outcome}`,
  ...O.match(pin, { onNone: () => [], onSome: (kept) => [`tag=${kept.tag}`, `sha256=${kept.sha256}`] }),
];

const parents = (root: string) =>
  Effect.map(gitOutput(root, ["rev-list", "--parents", "-n", "1", "HEAD"]), (line) => A.drop(Str.split(line, " "), 1));

const mergeInProgress = Effect.fn("CiBinaryPinSyncTest.mergeInProgress")(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.exists(`${root}/.git/MERGE_HEAD`);
});

const pinFileText = Effect.fn("CiBinaryPinSyncTest.pinFileText")(function* (repo: Repo) {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.readFileString(`${repo.root}/${PIN_FILE}`);
});

layer(testLayer, { timeout: "60 seconds" })("ci binary-pin-sync", (it) => {
  describe("the pin-bump branch against main", () => {
    it.effect("a clean branch that contains main and pins the newest release is current; nothing changes", () =>
      Effect.gen(function* () {
        const repo = yield* fixture(NEW, O.none());
        const outcome = yield* sync(repo);
        const after = yield* head(repo.root);
        expect(outcome).toStrictEqual(decided("current", O.some(NEW)));
        expect(after).toBe(repo.before);
      })
    );

    it.effect("a branch behind main merges main without touching the pin; main is now an ancestor", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const repo = yield* fixture(NEW, O.some(unrelated));
        const main = yield* gitOutput(repo.root, ["rev-parse", "main"]);
        const outcome = yield* sync(repo);
        const merge = yield* parents(repo.root);
        const pin = yield* pinFileText(repo);
        const notes = yield* fs.readFileString(`${repo.root}/docs/notes.md`);
        const status = yield* gitOutput(repo.root, ["status", "--porcelain"]);
        expect(outcome).toStrictEqual(decided("merged", O.some(NEW)));
        expect(merge).toStrictEqual([repo.before, main]);
        expect(pin).toBe(actionText(NEW));
        expect(notes).toBe("# notes\n");
        expect(status).toBe("");
      })
    );

    it.effect("a branch in conflict with main merges main and sets only the two pinned lines on main's text", () =>
      Effect.gen(function* () {
        const repo = yield* fixture(NEW, O.some(mainRepins));
        const main = yield* gitOutput(repo.root, ["rev-parse", "main"]);
        const outcome = yield* sync(repo);
        const merge = yield* parents(repo.root);
        const pin = yield* pinFileText(repo);
        const status = yield* gitOutput(repo.root, ["status", "--porcelain"]);
        expect(outcome).toStrictEqual(decided("merged", O.some(NEW)));
        expect(merge).toStrictEqual([repo.before, main]);
        expect(pin).toBe(actionText(NEW, "moved"));
        expect(status).toBe("");
        // A second run finds the merged head current.
        const again = yield* sync(repo);
        expect(again).toStrictEqual(decided("current", O.some(NEW)));
      })
    );

    it.effect("a branch pinning a newer release only merges main and keeps its pin", () =>
      Effect.gen(function* () {
        const repo = yield* fixture(NEWER, O.some(mainRepins));
        const outcome = yield* sync(repo);
        const pin = yield* pinFileText(repo);
        const merge = yield* parents(repo.root);
        const status = yield* gitOutput(repo.root, ["status", "--porcelain"]);
        const main = yield* gitOutput(repo.root, ["rev-parse", "main"]);
        expect(outcome).toStrictEqual(decided("merged", O.some(NEWER)));
        expect(pin).toBe(actionText(NEWER, "moved"));
        expect(merge).toStrictEqual([repo.before, main]);
        expect(status).toBe("");
      })
    );

    it.effect("a branch pinning an older release, or the right tag with another sha256, is stale", () =>
      Effect.gen(function* () {
        const older = yield* fixture(MID, O.some(unrelated));
        const olderOutcome = yield* sync(older);
        const olderHead = yield* head(older.root);
        expect(olderOutcome).toStrictEqual(decided("stale", O.none()));
        expect(olderHead).toBe(older.before);
        const resigned = yield* fixture({ tag: NEW.tag, sha256: MID.sha256 }, O.none());
        const resignedOutcome = yield* sync(resigned);
        expect(resignedOutcome).toStrictEqual(decided("stale", O.none()));
      })
    );

    it.effect("a conflict outside the pin file is blocked, resets the checkout and commits nothing", () =>
      Effect.gen(function* () {
        const repo = yield* fixture(NEW, O.some({ file: "docs/notes.md", text: "# main\n", message: "main notes" }));
        yield* commitFile(repo.root, { file: "docs/notes.md", text: "# branch\n", message: "branch notes" });
        const before = yield* head(repo.root);
        const outcome = yield* sync(repo);
        const after = yield* head(repo.root);
        const status = yield* gitOutput(repo.root, ["status", "--porcelain"]);
        expect(A.take(outcome, 3)).toStrictEqual(decided("blocked", O.some(NEW)));
        expect(outcome[3]).toBe(
          "reason=merging main conflicts outside .github/actions/fetch-beep-ci/action.yml: docs/notes.md"
        );
        const merging = yield* mergeInProgress(repo.root);
        expect(after).toBe(before);
        expect(status).toBe("");
        expect(merging).toBe(false);
      })
    );

    // A human edit to the pin file outside the two pinned lines must never be overwritten by the merge
    // resolution or deleted by a supersede: the branch's pin file is compared with its merge-base version.
    it.effect("merged path: a pin file edited outside the pin lines is blocked and changes nothing", () =>
      Effect.gen(function* () {
        const stray = `${actionText(NEW)}# a human edit on the branch\n`;
        const repo = yield* fixture(NEW, O.some(unrelated), releaseRows, O.some(stray));
        const outcome = yield* sync(repo);
        const after = yield* head(repo.root);
        const pin = yield* pinFileText(repo);
        expect(outcome).toStrictEqual([
          ...decided("blocked", O.some(NEW)),
          `reason=${PIN_FILE} differs from its merge-base version outside the two pinned lines`,
        ]);
        expect(after).toBe(repo.before);
        expect(pin).toBe(stray);
      })
    );

    it.effect("supersede path: a pin file edited outside the pin lines is blocked and changes nothing", () =>
      Effect.gen(function* () {
        const stray = `${actionText(NEW)}# a human edit on the branch\n`;
        const repo = yield* fixture(NEW, O.some(mainWorkflow), releaseRows, O.some(stray));
        const outcome = yield* sync(repo);
        const after = yield* head(repo.root);
        expect(A.take(outcome, 3)).toStrictEqual(decided("blocked", O.some(NEW)));
        expect(outcome[3]).toContain("differs from its merge-base version outside the two pinned lines");
        expect(after).toBe(repo.before);
      })
    );

    // A bot branch whose pin lines do not parse is stale: create-pull-request would update it too.
    it.effect("an unparseable branch pin with a workflow-carrying update supersedes to the newest release", () =>
      Effect.gen(function* () {
        const pending = Str.replace(OLD.tag, "beep-ci-PENDING")(actionText(OLD));
        const repo = yield* fixture(OLD, O.some(mainWorkflow), releaseRows, O.some(pending));
        const outcome = yield* sync(repo);
        expect(outcome).toStrictEqual(decided("supersede", O.some(NEW)));
      })
    );

    it.effect("a branch pin file missing its pin lines is blocked, with or without workflow changes", () =>
      Effect.gen(function* () {
        const lineless = "runs:\n  using: composite\n";
        const quiet = yield* fixture(OLD, O.some(unrelated), releaseRows, O.some(lineless));
        const quietOutcome = yield* sync(quiet);
        expect(A.take(quietOutcome, 1)).toStrictEqual(decided("blocked", O.none()));
        expect(quietOutcome[1]).toContain(`a newer release ${NEW.tag} is waiting`);
        const loud = yield* fixture(OLD, O.some(mainWorkflow), releaseRows, O.some(lineless));
        const loudOutcome = yield* sync(loud);
        expect(A.take(loudOutcome, 1)).toStrictEqual(decided("blocked", O.none()));
        expect(loudOutcome[1]).toContain("differs from its merge-base version outside the two pinned lines");
      })
    );

    it.effect("refuses a checkout with local changes and touches nothing", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const repo = yield* fixture(NEW, O.some(mainRepins));
        const edited = `${actionText(NEW)}# uncommitted\n`;
        yield* fs.writeFileString(`${repo.root}/${PIN_FILE}`, edited);
        const failure = yield* Effect.flip(sync(repo));
        const after = yield* head(repo.root);
        const pin = yield* pinFileText(repo);
        expect(`${failure}`).toContain("has local changes");
        expect(after).toBe(repo.before);
        expect(pin).toBe(edited);
      })
    );

    it.effect("a failure after the merge started restores the pre-merge head with no MERGE_HEAD", () =>
      Effect.gen(function* () {
        // main deleted the pin file: the merge stops on it, and resolving it finds no base text.
        const repo = yield* fixture(NEW, O.none());
        yield* gitOutput(repo.root, ["checkout", "-q", "main"]);
        yield* gitOutput(repo.root, ["rm", "-q", PIN_FILE]);
        yield* gitOutput(repo.root, ["commit", "-q", "--no-verify", "-m", "drop the pin file"]);
        yield* gitOutput(repo.root, ["checkout", "-q", "pin"]);
        const failure = yield* Effect.flip(sync(repo));
        const after = yield* head(repo.root);
        const status = yield* gitOutput(repo.root, ["status", "--porcelain"]);
        const merging = yield* mergeInProgress(repo.root);
        expect(`${failure}`).toContain(`main has no ${PIN_FILE}`);
        expect(after).toBe(repo.before);
        expect(status).toBe("");
        expect(merging).toBe(false);
      })
    );

    it.effect("a branch tag the release list does not hold fails and changes nothing", () =>
      Effect.gen(function* () {
        const unlisted = A.filter(releaseRows, (row) => row.tagName !== NEWER.tag);
        const repo = yield* fixture(NEWER, O.some(mainRepins), unlisted);
        const failure = yield* Effect.flip(sync(repo));
        const after = yield* head(repo.root);
        expect(`${failure}`).toContain(`${NEWER.tag} is not in the release list`);
        expect(after).toBe(repo.before);
      })
    );

    it.effect("a branch release created at the same time as the newest fails and changes nothing", () =>
      Effect.gen(function* () {
        const tied = A.map(releaseRows, (row) =>
          row.tagName === NEWER.tag ? { tagName: row.tagName, createdAt: "2026-11-10T00:00:00Z" } : row
        );
        const repo = yield* fixture(NEWER, O.some(mainRepins), tied);
        const failure = yield* Effect.flip(sync(repo));
        const after = yield* head(repo.root);
        expect(`${failure}`).toContain("shares its creation time");
        expect(after).toBe(repo.before);
      })
    );

    it.effect("without --output it only logs the outcome", () =>
      Effect.gen(function* () {
        const repo = yield* fixture(NEW, O.none());
        yield* runSync([
          "--cwd",
          repo.root,
          "--base",
          "main",
          "--tag",
          NEW.tag,
          "--sha256",
          NEW.sha256,
          "--releases",
          repo.releases,
        ]);
        const lines = yield* TestConsole.logLines;
        expect(lines).toStrictEqual([`${repo.root}: pin-bump branch sync against main: current.`]);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect.each([
      ["a missing release list", O.none<string>(), "Failed to read"],
      ["an invalid release list", O.some('[{"tagName": 1}]'), "Invalid release list"],
    ] as const)("refuses %s and changes nothing", ([, text, message]) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const repo = yield* fixture(NEW, O.some(unrelated));
        const releases = `${repo.releases}.broken`;
        if (O.isSome(text)) {
          yield* fs.writeFileString(releases, text.value);
        }
        const failure = yield* Effect.flip(
          runSync(["--cwd", repo.root, "--tag", NEW.tag, "--sha256", NEW.sha256, "--releases", releases])
        );
        const after = yield* head(repo.root);
        expect(`${failure}`).toContain(message);
        expect(after).toBe(repo.before);
      })
    );

    // A stale branch is bumped by create-pull-request, which force-updates it to main plus the pin
    // commit; when main changed a workflow file since the branch was cut, the App cannot push that.
    it.effect("a stale pin-only branch whose update carries workflow changes supersedes to the newest release", () =>
      Effect.gen(function* () {
        const repo = yield* fixture(MID, O.some(mainWorkflow));
        const outcome = yield* sync(repo);
        const after = yield* head(repo.root);
        expect(outcome).toStrictEqual(decided("supersede", O.some(NEW)));
        expect(after).toBe(repo.before);
      })
    );

    it.effect("a stale branch with an extra commit is blocked, names the waiting release, and changes nothing", () =>
      Effect.gen(function* () {
        const repo = yield* fixture(MID, O.some(mainWorkflow));
        yield* commitFile(repo.root, { file: "docs/fix.md", text: "# a hand fix\n", message: "hand fix" });
        const before = yield* head(repo.root);
        const outcome = yield* sync(repo);
        const after = yield* head(repo.root);
        expect(A.take(outcome, 1)).toStrictEqual(decided("blocked", O.none()));
        expect(outcome[1]).toContain(`reason=a newer release ${NEW.tag} is waiting`);
        expect(outcome[1]).toContain("holds changes besides the pin (docs/fix.md), which bumping it would discard");
        expect(after).toBe(before);
      })
    );

    // Revised ruling: a stale branch holding anything beyond the pin is blocked even when its update
    // carries no workflow file, because the create-pull-request rebuild would discard it.
    it.effect("a stale branch with an extra commit and no workflow change is blocked and changes nothing", () =>
      Effect.gen(function* () {
        const repo = yield* fixture(MID, O.some(unrelated));
        yield* commitFile(repo.root, { file: "docs/fix.md", text: "# a hand fix\n", message: "hand fix" });
        const before = yield* head(repo.root);
        const outcome = yield* sync(repo);
        const after = yield* head(repo.root);
        expect(A.take(outcome, 1)).toStrictEqual(decided("blocked", O.none()));
        expect(outcome[1]).toContain(`reason=a newer release ${NEW.tag} is waiting`);
        expect(outcome[1]).toContain("docs/fix.md");
        expect(after).toBe(before);
      })
    );

    it.effect("a stale branch with a pin-file edit outside the pin lines and no workflow change is blocked", () =>
      Effect.gen(function* () {
        const stray = `${actionText(MID)}# a human edit\n`;
        const repo = yield* fixture(MID, O.some(unrelated), releaseRows, O.some(stray));
        const outcome = yield* sync(repo);
        const after = yield* head(repo.root);
        expect(A.take(outcome, 1)).toStrictEqual(decided("blocked", O.none()));
        expect(outcome[1]).toContain("differs from its merge-base version outside the two pinned lines");
        expect(after).toBe(repo.before);
      })
    );

    it.effect("a stale branch whose pin file differs beyond the pinned lines is blocked", () =>
      Effect.gen(function* () {
        const stray = `${actionText(MID)}# a stray line on the branch\n`;
        const repo = yield* fixture(MID, O.some(mainWorkflow), releaseRows, O.some(stray));
        const outcome = yield* sync(repo);
        expect(A.take(outcome, 1)).toStrictEqual(decided("blocked", O.none()));
        expect(outcome[1]).toContain("differs from its merge-base version outside the two pinned lines");
      })
    );

    it.effect("a stale branch that created the pin file itself is blocked", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped();
        yield* gitOutput(root, ["init", "-q", "-b", "main"]);
        yield* gitOutput(root, ["config", "user.email", "pin-sync@example.test"]);
        yield* gitOutput(root, ["config", "user.name", "Pin Sync Test"]);
        yield* gitOutput(root, ["config", "commit.gpgsign", "false"]);
        yield* commitFile(root, unrelated);
        yield* gitOutput(root, ["checkout", "-q", "-b", "pin"]);
        yield* commitFile(root, { file: PIN_FILE, text: actionText(MID), message: "add the pin" });
        yield* gitOutput(root, ["checkout", "-q", "main"]);
        yield* commitFile(root, mainWorkflow);
        yield* gitOutput(root, ["checkout", "-q", "pin"]);
        const scratch = yield* fs.makeTempDirectoryScoped();
        const rows = yield* decodeReleaseRows(releaseRows);
        const releasesText = yield* encodeReleases(rows);
        yield* fs.writeFileString(`${scratch}/releases.json`, releasesText);
        const before = yield* head(root);
        const outcome = yield* sync({
          root,
          releases: `${scratch}/releases.json`,
          output: `${scratch}/output`,
          before,
        });
        expect(A.take(outcome, 1)).toStrictEqual(decided("blocked", O.none()));
        expect(outcome[1]).toContain("differs from its merge-base version outside the two pinned lines");
      })
    );

    // The merge base already pinned the newest release R2 and main then moved its pin lines back to R1:
    // the clean merge takes main's lines, so the sync rewrites them to R2 instead of pushing R1 under a
    // pull request titled for R2.
    it.effect("a clean merge that takes main's older pin lines is rewritten to the branch's release", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped();
        yield* gitOutput(root, ["init", "-q", "-b", "main"]);
        yield* gitOutput(root, ["config", "user.email", "pin-sync@example.test"]);
        yield* gitOutput(root, ["config", "user.name", "Pin Sync Test"]);
        yield* gitOutput(root, ["config", "commit.gpgsign", "false"]);
        yield* gitOutput(root, ["config", "pull.rebase", "false"]);
        yield* commitFile(root, { file: PIN_FILE, text: actionText(NEW), message: "pin R2" });
        yield* gitOutput(root, ["branch", "pin"]);
        yield* commitFile(root, { file: PIN_FILE, text: actionText(MID), message: "pin R1" });
        yield* gitOutput(root, ["checkout", "-q", "pin"]);
        const scratch = yield* fs.makeTempDirectoryScoped();
        const rows = yield* decodeReleaseRows(releaseRows);
        const releasesText = yield* encodeReleases(rows);
        yield* fs.writeFileString(`${scratch}/releases.json`, releasesText);
        const before = yield* head(root);
        const repo = { root, releases: `${scratch}/releases.json`, output: `${scratch}/output`, before };
        const outcome = yield* sync(repo);
        const pin = yield* pinFileText(repo);
        const contains = yield* gitOutput(root, ["merge-base", "--is-ancestor", "main", "HEAD"]);
        const status = yield* gitOutput(root, ["status", "--porcelain"]);
        expect(outcome).toStrictEqual(decided("merged", O.some(NEW)));
        expect(pin).toBe(actionText(NEW));
        expect(contains).toBe("");
        expect(status).toBe("");
      })
    );

    // An existing bot branch whose pin file was deleted or emptied is the pin, broken: stale, and when its
    // update carries workflow files it is superseded with the newest release (it holds nothing else).
    it.effect(
      "an existing branch with a deleted pin file is stale, or supersedes when the update carries workflows",
      () =>
        Effect.gen(function* () {
          const quiet = yield* fixture(MID, O.some(unrelated));
          yield* gitOutput(quiet.root, ["rm", "-q", PIN_FILE]);
          yield* gitOutput(quiet.root, ["commit", "-q", "--no-verify", "-m", "drop the pin file"]);
          const quietOutcome = yield* sync(quiet);
          expect(quietOutcome).toStrictEqual(decided("stale", O.none()));
          const loud = yield* fixture(MID, O.some(mainWorkflow));
          yield* gitOutput(loud.root, ["rm", "-q", PIN_FILE]);
          yield* gitOutput(loud.root, ["commit", "-q", "--no-verify", "-m", "drop the pin file"]);
          const loudOutcome = yield* sync(loud);
          expect(loudOutcome).toStrictEqual(decided("supersede", O.some(NEW)));
        })
    );

    it.effect("an existing branch with an empty pin file supersedes when the update carries workflows", () =>
      Effect.gen(function* () {
        const repo = yield* fixture(OLD, O.some(mainWorkflow), releaseRows, O.some(""));
        const outcome = yield* sync(repo);
        expect(outcome).toStrictEqual(decided("supersede", O.some(NEW)));
      })
    );

    // CodeRabbit round on 1455ed30cb97.
    it.effect("an exact pin match still requires the resolved release in the release list", () =>
      Effect.gen(function* () {
        const repo = yield* fixture(NEW, O.some(unrelated), []);
        const failure = yield* Effect.flip(sync(repo));
        const after = yield* head(repo.root);
        expect(`${failure}`).toContain(`${NEW.tag} is not in the release list`);
        expect(after).toBe(repo.before);
      })
    );

    it.effect("a ./-prefixed --file names the same pin file, so a pin-only branch still supersedes", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const repo = yield* fixture(MID, O.some(mainWorkflow));
        yield* runSync([
          "--cwd",
          repo.root,
          "--base",
          "main",
          "--tag",
          NEW.tag,
          "--sha256",
          NEW.sha256,
          "--releases",
          repo.releases,
          "--file",
          `./${PIN_FILE}`,
          "--output",
          repo.output,
        ]);
        const text = yield* fs.readFileString(repo.output);
        expect(A.take(A.filter(Str.split(text, "\n"), Str.isNonEmpty), 3)).toStrictEqual(
          decided("supersede", O.some(NEW))
        );
      })
    );

    it.effect("refuses an ignored file at a path the merge would add, and keeps it", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const repo = yield* fixture(NEW, O.some(unrelated));
        yield* fs.writeFileString(`${repo.root}/.git/info/exclude`, "docs/\n");
        yield* fs.makeDirectory(`${repo.root}/docs`, { recursive: true });
        yield* fs.writeFileString(`${repo.root}/docs/notes.md`, "LOCAL\n");
        const failure = yield* Effect.flip(sync(repo));
        const kept = yield* fs.readFileString(`${repo.root}/docs/notes.md`);
        const after = yield* head(repo.root);
        expect(`${failure}`).toContain("untracked or ignored files at paths the merge would add (docs/notes.md)");
        expect(kept).toBe("LOCAL\n");
        expect(after).toBe(repo.before);
      })
    );

    it.effect("refuses an ignored file at the destination of a file main renamed, and keeps it", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped();
        yield* gitOutput(root, ["init", "-q", "-b", "main"]);
        yield* gitOutput(root, ["config", "user.email", "pin-sync@example.test"]);
        yield* gitOutput(root, ["config", "user.name", "Pin Sync Test"]);
        yield* gitOutput(root, ["config", "commit.gpgsign", "false"]);
        yield* gitOutput(root, ["config", "pull.rebase", "false"]);
        yield* commitFile(root, { file: PIN_FILE, text: actionText(OLD), message: "pin OLD" });
        yield* commitFile(root, { file: "src/old.md", text: "# moved later\n", message: "a file main moves" });
        yield* gitOutput(root, ["checkout", "-q", "-b", "pin"]);
        yield* commitFile(root, { file: PIN_FILE, text: actionText(NEW), message: "bump the pin" });
        yield* gitOutput(root, ["checkout", "-q", "main"]);
        yield* fs.makeDirectory(`${root}/docs`, { recursive: true });
        yield* gitOutput(root, ["mv", "src/old.md", "docs/notes.md"]);
        yield* gitOutput(root, ["commit", "-q", "--no-verify", "-m", "rename"]);
        yield* gitOutput(root, ["checkout", "-q", "pin"]);
        yield* fs.writeFileString(`${root}/.git/info/exclude`, "docs/\n");
        yield* fs.makeDirectory(`${root}/docs`, { recursive: true });
        yield* fs.writeFileString(`${root}/docs/notes.md`, "LOCAL\n");
        const scratch = yield* fs.makeTempDirectoryScoped();
        const rows = yield* decodeReleaseRows(releaseRows);
        const releasesText = yield* encodeReleases(rows);
        yield* fs.writeFileString(`${scratch}/releases.json`, releasesText);
        const before = yield* head(root);
        const repo = { root, releases: `${scratch}/releases.json`, output: `${scratch}/output`, before };
        const failure = yield* Effect.flip(sync(repo));
        const kept = yield* fs.readFileString(`${root}/docs/notes.md`);
        const after = yield* head(root);
        expect(`${failure}`).toContain("untracked or ignored files at paths the merge would add (docs/notes.md)");
        expect(kept).toBe("LOCAL\n");
        expect(after).toBe(before);
      })
    );

    // The workflow's real shape (Beep CI Binary run 44479791618): a depth-1 clone of this run's main
    // commit with no stored credentials, the pin step's own unshallow fetch of main and the bot branch,
    // and a DETACHED LINKED worktree of the bot branch configured as the step configures it.
    it.effect("syncs in the workflow's shape: depth-1 clone, unshallow fetch, detached linked worktree", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const source = yield* fs.makeTempDirectoryScoped();
        yield* gitOutput(source, ["init", "-q", "-b", "main"]);
        yield* gitOutput(source, ["config", "user.email", "pin-sync@example.test"]);
        yield* gitOutput(source, ["config", "user.name", "Pin Sync Test"]);
        yield* gitOutput(source, ["config", "commit.gpgsign", "false"]);
        yield* commitFile(source, { file: PIN_FILE, text: actionText(OLD), message: "pin OLD" });
        yield* gitOutput(source, ["checkout", "-q", "-b", "ci/beep-ci-pin-bump"]);
        yield* commitFile(source, { file: PIN_FILE, text: actionText(NEW), message: "bump the pin" });
        const botHead = yield* head(source);
        yield* gitOutput(source, ["checkout", "-q", "main"]);
        yield* commitFile(source, unrelated);
        const mainCommit = yield* head(source);
        // actions/checkout: a depth-1 fetch of the run's commit, persist-credentials false (none stored).
        const clone = yield* fs.makeTempDirectoryScoped();
        yield* gitOutput(clone, ["init", "-q", "-b", "main"]);
        yield* gitOutput(clone, ["remote", "add", "origin", `file://${source}`]);
        yield* gitOutput(clone, [
          "-c",
          "protocol.version=2",
          "fetch",
          "-q",
          "--no-tags",
          "--depth=1",
          "origin",
          "+refs/heads/main:refs/remotes/origin/main",
        ]);
        yield* gitOutput(clone, ["checkout", "-q", "--force", "-B", "main", "refs/remotes/origin/main"]);
        const shallow = yield* gitOutput(clone, ["rev-parse", "--is-shallow-repository"]);
        expect(shallow).toBe("true");
        // The pin step: unshallow main and the bot branch, then a detached linked worktree of the branch.
        yield* gitOutput(clone, [
          "fetch",
          "-q",
          "--no-tags",
          "--unshallow",
          "origin",
          "+refs/heads/main:refs/remotes/origin/main",
          "+refs/heads/ci/beep-ci-pin-bump:refs/remotes/origin/ci/beep-ci-pin-bump",
        ]);
        const fetchedBot = yield* gitOutput(clone, ["rev-parse", "refs/remotes/origin/ci/beep-ci-pin-bump"]);
        expect(fetchedBot).toBe(botHead);
        const scratch = yield* fs.makeTempDirectoryScoped();
        const worktree = `${scratch}/pin-bump-branch`;
        yield* gitOutput(clone, ["worktree", "add", "-q", "--detach", worktree, botHead]);
        yield* gitOutput(worktree, ["config", "user.name", "beep-ci-pin-bump"]);
        yield* gitOutput(worktree, ["config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"]);
        yield* gitOutput(worktree, ["config", "pull.rebase", "false"]);
        yield* gitOutput(worktree, ["config", "commit.gpgsign", "false"]);
        const rows = yield* decodeReleaseRows(releaseRows);
        const releasesText = yield* encodeReleases(rows);
        yield* fs.writeFileString(`${scratch}/releases.json`, releasesText);
        yield* runSync([
          "--cwd",
          worktree,
          "--base",
          mainCommit,
          "--tag",
          NEW.tag,
          "--sha256",
          NEW.sha256,
          "--releases",
          `${scratch}/releases.json`,
          "--output",
          `${scratch}/out`,
        ]);
        const text = yield* fs.readFileString(`${scratch}/out`);
        const merge = yield* gitOutput(worktree, ["rev-list", "--parents", "-n", "1", "HEAD"]);
        const status = yield* gitOutput(worktree, ["status", "--porcelain"]);
        expect(A.take(A.filter(Str.split(text, "\n"), Str.isNonEmpty), 3)).toStrictEqual(
          decided("merged", O.some(NEW))
        );
        expect(A.drop(Str.split(merge, " "), 1)).toStrictEqual([botHead, mainCommit]);
        expect(status).toBe("");
      })
    );

    it.effect("a merge failure whose restore also fails reports both", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const repo = yield* fixture(NEW, O.some(mainRepins));
        // A held index lock fails the merge, and then the reset that would restore the head.
        yield* fs.writeFileString(`${repo.root}/.git/index.lock`, "");
        const failure = yield* Effect.flip(sync(repo));
        expect(`${failure}`).toContain(`Restoring ${repo.before} also failed`);
        // The failure names the git command and carries git's own stderr (the held lock), not a bare "git failed".
        expect(`${failure}`).toContain("index.lock");
      })
    );

    it.effect("a failed --output write after a merge restores the pre-merge head", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const repo = yield* fixture(NEW, O.some(unrelated));
        const directory = `${repo.output}.d`;
        yield* fs.makeDirectory(directory, { recursive: true });
        const failure = yield* Effect.flip(
          runSync([
            "--cwd",
            repo.root,
            "--base",
            "main",
            "--tag",
            NEW.tag,
            "--sha256",
            NEW.sha256,
            "--releases",
            repo.releases,
            "--output",
            directory,
          ])
        );
        const after = yield* head(repo.root);
        const merging = yield* mergeInProgress(repo.root);
        expect(`${failure}`).toContain(`Failed to write ${directory}`);
        expect(after).toBe(repo.before);
        expect(merging).toBe(false);
      })
    );

    it.effect("reports pin_only: true for a pin-only branch, false when it holds another change", () =>
      Effect.gen(function* () {
        const clean = yield* fixture(NEW, O.none());
        const cleanLines = yield* syncLines(clean);
        expect(cleanLines).toContain("pin_only=true");
        const extra = yield* fixture(NEW, O.some(unrelated));
        yield* commitFile(extra.root, { file: "docs/fix.md", text: "# a hand fix\n", message: "hand fix" });
        const extraLines = yield* syncLines(extra);
        expect(extraLines).toStrictEqual([...decided("merged", O.some(NEW)), "pin_only=false"]);
      })
    );

    // GitHub refuses a push by the pin-bump App (no `workflows` permission) that updates an existing
    // branch with workflow-file changes, so such a merge cannot be pushed. A branch that holds nothing
    // but the pin is superseded by a fresh pull request from main; anything more stops.
    it.effect("a workflow-carrying merge onto a pin-only branch supersedes and resets the checkout", () =>
      Effect.gen(function* () {
        const repo = yield* fixture(NEW, O.some(mainWorkflow));
        const outcome = yield* sync(repo);
        const after = yield* head(repo.root);
        const status = yield* gitOutput(repo.root, ["status", "--porcelain"]);
        expect(outcome).toStrictEqual(decided("supersede", O.some(NEW)));
        expect(after).toBe(repo.before);
        expect(status).toBe("");
      })
    );

    it.effect("a workflow-carrying merge onto a branch pinning a newer release supersedes with that pin", () =>
      Effect.gen(function* () {
        const repo = yield* fixture(NEWER, O.some(mainWorkflow));
        const outcome = yield* sync(repo);
        expect(outcome).toStrictEqual(decided("supersede", O.some(NEWER)));
      })
    );

    it.effect("a workflow-carrying merge onto a branch with an extra commit is blocked and changes nothing", () =>
      Effect.gen(function* () {
        const repo = yield* fixture(NEW, O.some(mainWorkflow));
        yield* commitFile(repo.root, { file: "docs/fix.md", text: "# a hand fix\n", message: "hand fix" });
        const before = yield* head(repo.root);
        const outcome = yield* sync(repo);
        const after = yield* head(repo.root);
        expect(A.take(outcome, 3)).toStrictEqual(decided("blocked", O.some(NEW)));
        expect(outcome[3]).toContain("carries workflow changes (.github/workflows/ci.yml)");
        expect(outcome[3]).toContain("holds changes besides the pin (docs/fix.md)");
        expect(after).toBe(before);
      })
    );
  });

  // Beep CI Binary run 44657799060: the sync ran in a separate checkout of the bot branch, where the
  // repository's lefthook commit-msg hook (commitlint, which needs that checkout's own node_modules)
  // failed, so git printed "Not committing merge" and the branch never took main. These hooks fail the
  // same way, in the shared `.git/hooks` lefthook installs into, and record that they ran.
  describe("the bot checkout under failing repository hooks", () => {
    const HOOKS = ["commit-msg", "pre-merge-commit", "post-merge", "pre-push"] as const;

    const installFailingHooks = Effect.fn("CiBinaryPinSyncTest.installFailingHooks")(function* (
      root: string,
      marks: string
    ) {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      yield* Effect.forEach(
        HOOKS,
        (hook) =>
          Effect.gen(function* () {
            const file = path.join(root, ".git", "hooks", hook);
            yield* fs.makeDirectory(path.dirname(file), { recursive: true });
            yield* fs.writeFileString(file, `#!/bin/sh\necho ran > "${marks}/${hook}"\nexit 1\n`);
            yield* fs.chmod(file, 0o755);
          }),
        { concurrency: 1 }
      );
    });

    const ranHooks = Effect.fn("CiBinaryPinSyncTest.ranHooks")(function* (marks: string) {
      const fs = yield* FileSystem.FileSystem;
      return yield* Effect.filter(HOOKS, (hook) => fs.exists(`${marks}/${hook}`));
    });

    it.effect("the sync merges main and the workflow's push lands without force; no hook runs", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const repo = yield* fixture(NEW, O.some(unrelated));
        const main = yield* gitOutput(repo.root, ["rev-parse", "main"]);
        // The CI shape: a remote holding the bot branch, which refuses a non-fast-forward push, and a
        // detached worktree of the branch head beside the main checkout.
        const scratch = yield* fs.makeTempDirectoryScoped();
        const remote = path.join(scratch, "remote.git");
        const checkout = path.join(scratch, "pin-bump-branch");
        const marks = path.join(scratch, "marks");
        yield* fs.makeDirectory(marks);
        yield* gitOutput(scratch, ["init", "-q", "--bare", remote]);
        yield* gitOutput(remote, ["config", "receive.denyNonFastForwards", "true"]);
        yield* gitOutput(repo.root, ["push", "-q", remote, "pin:refs/heads/ci/beep-ci-pin-bump"]);
        yield* gitOutput(repo.root, ["worktree", "add", "-q", "--detach", checkout, repo.before]);
        yield* installFailingHooks(repo.root, marks);

        // Before the fix: the sync's own `git pull . <base>`, with the checkout's hooks, does not commit.
        const plain = yield* runRepoCommandCapture("git", ["pull", "--no-edit", ".", "main"], checkout);
        const mergeMessage = yield* gitOutput(checkout, ["rev-parse", "--git-path", "MERGE_MSG"]).pipe(
          Effect.flatMap((file) => fs.readFileString(path.resolve(checkout, file)))
        );
        expect(plain.exitCode).not.toBe(0);
        expect(plain.output).toContain("Not committing merge");
        const ranOnPlainPull = yield* ranHooks(marks);
        expect(ranOnPlainPull).not.toStrictEqual([]);
        yield* gitOutput(checkout, ["reset", "-q", "--hard", repo.before]);
        yield* Effect.forEach(HOOKS, (hook) => fs.remove(`${marks}/${hook}`, { force: true }), { concurrency: 1 });

        // The sync: a merge commit with git's own message, no hook run.
        yield* fs.remove(repo.output, { force: true });
        yield* runSync([
          "--cwd",
          checkout,
          "--base",
          "main",
          "--tag",
          NEW.tag,
          "--sha256",
          NEW.sha256,
          "--releases",
          repo.releases,
          "--output",
          repo.output,
        ]);
        const output = yield* fs.readFileString(repo.output);
        const lines = A.filter(Str.split(output, "\n"), Str.isNonEmpty);
        const merged = yield* head(checkout);
        const message = yield* gitOutput(checkout, ["log", "-1", "--format=%s"]);
        expect(A.take(lines, 3)).toStrictEqual(decided("merged", O.some(NEW)));
        const mergeParents = yield* parents(checkout);
        expect(mergeParents).toStrictEqual([repo.before, main]);
        expect(message).toBe(Str.split(mergeMessage, "\n")[0]);
        const ranOnSync = yield* ranHooks(marks);
        expect(ranOnSync).toStrictEqual([]);

        // The workflow's push, verbatim but for the URL: no force, no hook.
        yield* gitOutput(checkout, [
          "-c",
          "core.hooksPath=/dev/null",
          "push",
          "-q",
          remote,
          "HEAD:refs/heads/ci/beep-ci-pin-bump",
        ]);
        const pushed = yield* gitOutput(remote, ["rev-parse", "refs/heads/ci/beep-ci-pin-bump"]);
        const ranOnPush = yield* ranHooks(marks);
        expect(pushed).toBe(merged);
        expect(ranOnPush).toStrictEqual([]);
      })
    );
  });
});

// The spawner decorator the sync runs its `Git` under: a `git` command gains the empty hooks path ahead of
// its own argv; anything else the spawner is handed passes through untouched.
describe("withHooksPath", () => {
  const hooked = withHooksPath("/tmp/no-hooks");

  it("prefixes a git command's argv with the empty hooks path and keeps its options", () => {
    const command = hooked(ChildProcess.make("git", ["pull", ".", "main"], { cwd: "/repo" }));
    expect(ChildProcess.isStandardCommand(command)).toBe(true);
    expect(command).toMatchObject({
      command: "git",
      args: ["-c", "core.hooksPath=/tmp/no-hooks", "pull", ".", "main"],
      options: { cwd: "/repo" },
    });
  });

  it("leaves a command that is not git, and a pipeline, unchanged", () => {
    const other = ChildProcess.make("bun", ["--version"]);
    const piped = ChildProcess.pipeTo(ChildProcess.make("git", ["log"]), ChildProcess.make("head", ["-n", "1"]));
    expect(hooked(other)).toBe(other);
    expect(hooked(piped)).toBe(piped);
  });
});
