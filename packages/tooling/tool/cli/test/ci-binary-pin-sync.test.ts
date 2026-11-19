import { Git } from "@beep/git/Git";
import { BeepCiRelease, ciBinaryPinSyncCommand } from "@beep/repo-cli/commands/Ci/CiBinaryPinSync";
import { runRepoCommandCapture } from "@beep/repo-cli/test/RepoRun";
import { describe, expect, layer } from "@effect/vitest";
import * as A from "effect/Array";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import { NodeTestLayer } from "./support/CommandTest.ts";

// beep-ci-binary.yml runs `beep ci binary-pin-sync` in a detached checkout of the open pin-bump
// branch, then pushes a `merged` head with the pin-bump App token (no force push, so the pull
// request keeps its number and review history). Each fixture is a real repository: `main` and a
// `pin` branch cut from it.

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

// `main` pins OLD; the `pin` branch is cut from it and pins `branchPin`, then `main` takes `advance`.
const fixture = Effect.fn("CiBinaryPinSyncTest.fixture")(function* (branchPin: Pin, advance: O.Option<Commit>) {
  const fs = yield* FileSystem.FileSystem;
  const root = yield* fs.makeTempDirectoryScoped();
  yield* gitOutput(root, ["init", "-q", "-b", "main"]);
  yield* gitOutput(root, ["config", "user.email", "pin-sync@example.test"]);
  yield* gitOutput(root, ["config", "user.name", "Pin Sync Test"]);
  yield* gitOutput(root, ["config", "commit.gpgsign", "false"]);
  yield* gitOutput(root, ["config", "pull.rebase", "false"]);
  yield* commitFile(root, { file: PIN_FILE, text: actionText(OLD), message: "pin OLD" });
  yield* gitOutput(root, ["checkout", "-q", "-b", "pin"]);
  yield* commitFile(root, { file: PIN_FILE, text: actionText(branchPin), message: "bump the pin" });
  yield* gitOutput(root, ["checkout", "-q", "main"]);
  if (O.isSome(advance)) {
    yield* commitFile(root, advance.value);
  }
  yield* gitOutput(root, ["checkout", "-q", "pin"]);
  const scratch = yield* fs.makeTempDirectoryScoped();
  const releases = `${scratch}/releases.json`;
  const rows = yield* decodeReleaseRows(releaseRows);
  const releasesText = yield* encodeReleases(rows);
  yield* fs.writeFileString(releases, releasesText);
  const before = yield* head(root);
  const repo: Repo = { root, releases, output: `${scratch}/output`, before };
  return repo;
});

const sync = Effect.fn("CiBinaryPinSyncTest.sync")(function* (repo: Repo) {
  const fs = yield* FileSystem.FileSystem;
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
  return yield* fs.readFileString(repo.output);
});

const parents = (root: string) =>
  Effect.map(gitOutput(root, ["rev-list", "--parents", "-n", "1", "HEAD"]), (line) => A.drop(Str.split(line, " "), 1));

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
        expect(outcome).toBe("outcome=current\n");
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
        expect(outcome).toBe("outcome=merged\n");
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
        expect(outcome).toBe("outcome=merged\n");
        expect(merge).toStrictEqual([repo.before, main]);
        expect(pin).toBe(actionText(NEW, "moved"));
        expect(status).toBe("");
        // A second run finds the merged head current.
        const again = yield* sync(repo);
        expect(again).toBe("outcome=merged\noutcome=current\n");
      })
    );

    it.effect("a branch pinning a newer release only merges main and keeps its pin", () =>
      Effect.gen(function* () {
        const repo = yield* fixture(NEWER, O.some(mainRepins));
        const outcome = yield* sync(repo);
        const pin = yield* pinFileText(repo);
        expect(outcome).toBe("outcome=merged\n");
        expect(pin).toBe(actionText(NEWER, "moved"));
      })
    );

    it.effect("a branch pinning an older release, or the right tag with another sha256, is stale", () =>
      Effect.gen(function* () {
        const older = yield* fixture(MID, O.some(unrelated));
        const olderOutcome = yield* sync(older);
        const olderHead = yield* head(older.root);
        expect(olderOutcome).toBe("outcome=stale\n");
        expect(olderHead).toBe(older.before);
        const resigned = yield* fixture({ tag: NEW.tag, sha256: MID.sha256 }, O.none());
        const resignedOutcome = yield* sync(resigned);
        expect(resignedOutcome).toBe("outcome=stale\n");
      })
    );

    it.effect("a conflict outside the pin file fails and commits nothing", () =>
      Effect.gen(function* () {
        const repo = yield* fixture(NEW, O.some({ file: "docs/notes.md", text: "# main\n", message: "main notes" }));
        yield* commitFile(repo.root, { file: "docs/notes.md", text: "# branch\n", message: "branch notes" });
        const before = yield* head(repo.root);
        const failure = yield* Effect.flip(sync(repo));
        const after = yield* head(repo.root);
        expect(`${failure}`).toContain("conflicts outside");
        expect(`${failure}`).toContain("docs/notes.md");
        expect(after).toBe(before);
      })
    );
  });
});
