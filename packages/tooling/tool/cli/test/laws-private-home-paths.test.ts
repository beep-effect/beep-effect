import {
  applyPrivateHomePathExemption,
  formatPrivateHomePathFinding,
  HomeRouteSegment,
  lawsCommand,
  PlaceholderHomeUser,
  PrivateHomePathExemption,
  PrivateHomePathsOptions,
  privateHomePathExemptions,
  privateHomePathScopedUsers,
  runPrivateHomePaths,
  scanPrivateHomePathText,
} from "@beep/repo-cli/test/Laws";
import { FsUtilsLive } from "@beep/repo-utils";
import { it } from "@beep/test-runner";
import { A } from "@beep/utils";
import { describe, expect } from "@effect/vitest";
import { assertSome, assertTrue } from "@effect/vitest/utils";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as R from "effect/Record";
import * as Str from "effect/String";
import { NodeTestLayer } from "./support/CommandTest.ts";

// Rejected users are assembled at runtime so this file never records a
// non-placeholder home path and the law passes on its own test.
const LEAKED_USER = A.join(["j", "doe"], "");
const posixHome = (root: string, user: string): string => A.join(["", root, user], "/");
const LEAKED_HOME = posixHome("home", LEAKED_USER);
const LEAKED_MAC_HOME = posixHome("Users", LEAKED_USER);

const matchesOf = (content: string): ReadonlyArray<string> =>
  A.map(scanPrivateHomePathText("fixture.md", content), (finding) => finding.match);

const PlatformLayer = FsUtilsLive.pipe(Layer.provideMerge(NodeTestLayer));
const runInProcess = Command.runWith(lawsCommand, { version: "0.0.0" });
const withEmptyConfig = Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({}));

const failureText = <A, E>(exit: Exit.Exit<A, E>): string => (Exit.isFailure(exit) ? String(exit.cause) : "");

const git = Effect.fnUntraced(function* (cwd: string, args: ReadonlyArray<string>) {
  const handle = yield* ChildProcess.make("git", args, { cwd, stdin: "ignore", stdout: "ignore", stderr: "ignore" });
  return yield* handle.exitCode;
});

describe("private home path law", () => {
  describe("scanPrivateHomePathText", () => {
    it.effect("reports a non-placeholder Linux and macOS home with its position", () =>
      Effect.sync(() => {
        const findings = scanPrivateHomePathText(
          "notes.md",
          `intro\ncwd ${LEAKED_HOME}/YeeBois/x and ${LEAKED_MAC_HOME}\n`
        );
        expect(A.map(findings, (finding) => [finding.line, finding.column, finding.match, finding.rule])).toEqual([
          [2, 5, LEAKED_HOME, "private-home-path"],
          [2, 5 + LEAKED_HOME.length + 15, LEAKED_MAC_HOME, "private-home-path"],
        ]);
      })
    );

    it.effect("reports Windows drive forms with forward, single and JSON-escaped separators", () =>
      Effect.sync(() => {
        const content = A.join(
          [
            `C:\\Users\\${LEAKED_USER}\\Desktop`,
            `"D:\\\\Users\\\\${LEAKED_USER}\\\\x"`,
            `E:/Users/${LEAKED_USER}/x`,
            `file://${LEAKED_HOME}/a`,
          ],
          "\n"
        );
        expect(matchesOf(content)).toEqual([
          `C:\\Users\\${LEAKED_USER}`,
          `D:\\\\Users\\\\${LEAKED_USER}`,
          `E:/Users/${LEAKED_USER}`,
          LEAKED_HOME,
        ]);
      })
    );

    it.effect("accepts placeholder users, including service accounts and Windows fixtures", () =>
      Effect.sync(() => {
        const content = A.join(
          [
            "/home/ada/.config",
            "/home/runner/work",
            "/Users/alice/Library",
            "C:/Users/attorney/AppData",
            "C:\\Users\\Ada\\x",
            '"/home/fixture"',
            "/home/lawyer/Box",
          ],
          "\n"
        );
        expect(matchesOf(content)).toEqual([]);
      })
    );

    it.effect("accepts shared profiles, image accounts and documentation placeholders", () =>
      Effect.sync(() => {
        const content = A.join(
          [
            "C:\\Users\\Public\\Documents",
            "C:\\Users\\Default\\NTUSER.DAT",
            "C:\\Users\\All Users\\x",
            "/Users/Shared/x",
            "/home/linuxbrew/.linuxbrew",
            "/home/node/app",
            "/home/vscode/.vscode-server",
            "/home/codespace/x",
            "/home/ubuntu/x",
            "/home/pi/x",
            "/home/USER/x",
            "/home/USERNAME/x",
            "/home/username/x",
            "/home/your-user/x",
            "/home/YOUR_USER/x",
          ],
          "\n"
        );
        expect(matchesOf(content)).toEqual([]);
      })
    );

    it.effect("ignores composed, relative, template and regex shapes", () =>
      Effect.sync(() => {
        const content = A.join(
          [
            "owner/home/root/",
            "${base}/home/.cache",
            "/fixture/home/.codex",
            "/home/<user>/src",
            "/home/${USER}/src",
            "/home/{user}/src",
            "../home/x",
            String.raw`const pattern = /\/home\/[A-Za-z0-9_.-]+/u`,
            "/var/www/home/x",
            "the /users/123 route",
          ],
          "\n"
        );
        expect(matchesOf(content)).toEqual([]);
      })
    );

    it.effect("ends the user at any character outside the name class", () =>
      Effect.sync(() => {
        const content = A.join(
          A.map(
            ["?x", "#L1", "@host", "!", "&a", "+x", "=1", "~", "%2Fx", "\u2019s", "\u2026", "\u2014x"],
            (tail) => `see ${LEAKED_HOME}${tail}`
          ),
          "\n"
        );
        expect(matchesOf(content)).toEqual(A.replicate(LEAKED_HOME, 12));
        const accented = posixHome("home", "jos\u00e9");
        expect(matchesOf(`${accented}/x`)).toEqual([accented]);
        expect(matchesOf("/home/\u00fcser/x and /home/ada@host")).toEqual([]);
      })
    );

    it.effect("reports WSL, Fedora Atomic, automount, lowercase Windows, MSYS and UNC home roots", () =>
      Effect.sync(() => {
        const forms = [
          `/mnt/c/Users/${LEAKED_USER}`,
          `/var/home/${LEAKED_USER}`,
          `c:\\users\\${LEAKED_USER}`,
          `/c/Users/${LEAKED_USER}`,
          `\\\\server\\Users\\${LEAKED_USER}`,
          `\\\\wsl.localhost\\Ubuntu\\home\\${LEAKED_USER}`,
          `\\\\wsl$\\Ubuntu\\home\\${LEAKED_USER}`,
          `//wsl.localhost/Ubuntu/home/${LEAKED_USER}`,
          `//server/Users/${LEAKED_USER}`,
          `C:\\Documents and Settings\\${LEAKED_USER}`,
          `/export/home/${LEAKED_USER}`,
          `/net/home/${LEAKED_USER}`,
        ];
        expect(
          matchesOf(
            A.join(
              A.map(forms, (form) => `${form}/x`),
              "\n"
            )
          )
        ).toEqual(forms);
        // git prints a WSL checkout as `%(prefix)///wsl.localhost/...`; the
        // legacy profile root keeps its shared accounts.
        expect(matchesOf(`safe.directory '%(prefix)///wsl.localhost/Ubuntu/home/${LEAKED_USER}/repo'`)).toEqual([
          `//wsl.localhost/Ubuntu/home/${LEAKED_USER}`,
        ]);
        expect(matchesOf("C:\\Documents and Settings\\All Users\\x")).toEqual([]);
        // A protocol-relative URL and a web URL are not UNC shares.
        expect(
          matchesOf(`src="//cdn.example.com/users/${LEAKED_USER}" and https://example.com/Users/${LEAKED_USER}`)
        ).toEqual([]);
      })
    );

    it.effect("reports escaped, double-escaped, URL-encoded and flag-glued separators", () =>
      Effect.sync(() => {
        const forms = [
          `\\/home\\/${LEAKED_USER}`,
          `C:\\\\\\\\Users\\\\\\\\${LEAKED_USER}`,
          `%2Fhome%2F${LEAKED_USER}`,
          `C%3A%5CUsers%5C${LEAKED_USER}`,
          `%5CUsers%5C${LEAKED_USER}`,
        ];
        expect(
          matchesOf(
            A.join(
              A.map(forms, (form) => `"${form}"`),
              "\n"
            )
          )
        ).toEqual(forms);
        expect(matchesOf(`docker run -v${LEAKED_HOME}:/app`)).toEqual([LEAKED_HOME]);
        const authorities = [
          "file://localhost",
          "vscode://file",
          "vscode-remote://wsl+Ubuntu",
          "vscode-remote://wsl%2Bubuntu",
          "vscode-remote://ssh-remote+devbox",
        ];
        expect(
          matchesOf(
            A.join(
              A.map(authorities, (authority) => `${authority}${LEAKED_HOME}/x`),
              "\n"
            )
          )
        ).toEqual(A.replicate(LEAKED_HOME, authorities.length));
        expect(matchesOf("https://github.com/home/x and https://example.com/Users/x")).toEqual([]);
        // A deep link URL-encodes the Windows cwd; a real login is reported and
        // the placeholder fixture passes.
        expect(matchesOf(`claude-cli://open?cwd=C%3A%5CUsers%5C${LEAKED_USER}%5CReview&amp;q=x`)).toEqual([
          `C%3A%5CUsers%5C${LEAKED_USER}`,
        ]);
        expect(matchesOf("claude-cli://open?cwd=C%3A%5CUsers%5Cattorney%5CReview&amp;q=x")).toEqual([]);
        expect(matchesOf("file:///repo/CC%3A%5Cx")).toEqual([]);
      })
    );

    it.effect("reports home paths after shell expansions, option values, diff markers and truncation", () =>
      Effect.sync(() => {
        const content = A.join(
          [
            `cd "\${HOME:-${LEAKED_HOME}}"`,
            `"\${X:-${LEAKED_MAC_HOME}}"`,
            `\${X:=${LEAKED_HOME}}`,
            `tool --opt=-${LEAKED_HOME}/x`,
            `-${LEAKED_HOME}/x`,
            `+${LEAKED_HOME}/x`,
            `...${LEAKED_HOME}/x`,
          ],
          "\n"
        );
        expect(matchesOf(content)).toEqual([
          LEAKED_HOME,
          LEAKED_MAC_HOME,
          LEAKED_HOME,
          LEAKED_HOME,
          LEAKED_HOME,
          LEAKED_HOME,
          LEAKED_HOME,
        ]);
        // Relative and composed paths stay out of scope.
        const composed = A.join(
          [
            `..${LEAKED_HOME}/x`,
            "owner/home/root/",
            "${base}/home/.cache",
            `X_${LEAKED_HOME}/x`,
            `word-${LEAKED_HOME}/x`,
          ],
          "\n"
        );
        expect(matchesOf(composed)).toEqual([]);
      })
    );

    it.effect("reports home paths behind ssh, sftp, scp and rsync remotes", () =>
      Effect.sync(() => {
        const remotes = [
          `ssh://host${LEAKED_HOME}/repo`,
          `ssh://git@host${LEAKED_HOME}/repo`,
          `ssh://deploy@host.example:2222${LEAKED_HOME}`,
          `sftp://host${LEAKED_HOME}`,
          `scp://host${LEAKED_HOME}/a`,
          `rsync://host${LEAKED_HOME}/a`,
          `git+ssh://host${LEAKED_HOME}/repo.git`,
          `rsync -a host:${LEAKED_HOME}/a .`,
        ];
        expect(matchesOf(A.join(remotes, "\n"))).toEqual(A.replicate(LEAKED_HOME, remotes.length));
        expect(matchesOf("http://host/home/x and https://host/home/x")).toEqual([]);
      })
    );

    it.effect("ignores app routes, route groups, API routes and container homes", () =>
      Effect.sync(() => {
        const content = A.join(
          [
            'router.push("/home/settings")',
            '<Link href="/home/notifications" />',
            "app/(marketing)/home/page.tsx",
            "src/app/(app)/home/layout.tsx",
            "[Home](/home/dashboard)",
            "WORKDIR /home/app",
            "      - ./data:/home/app/data",
            "GET /Users/abc123/profile",
            "DELETE /Users/42",
          ],
          "\n"
        );
        expect(matchesOf(content)).toEqual([]);
        expect(HomeRouteSegment.is.settings("settings")).toBe(true);
        // A route word is not a pass for a real user beneath it, and a
        // markdown link to a local file still reports its home.
        expect(matchesOf(`[notes](${LEAKED_HOME}/notes.md)`)).toEqual([LEAKED_HOME]);
      })
    );

    it.effect("reports the dash-encoded home form agent tooling writes", () =>
      Effect.sync(() => {
        const encoded = A.join(["", "home", LEAKED_USER], "-");
        const windows = A.join(["C-", "Users", LEAKED_USER], "-");
        const content = A.join(
          [
            `/tmp/claude-1000/${encoded}-YeeBois-projects/x`,
            `.claude/projects/${windows}-src`,
            ".claude/projects/-home-ada-YeeBois",
            ".claude/projects/-home-ec2-user-src",
            "fix-workspace-home-paths",
            "use the -home-dir flag or -home-override",
            `projects/${encoded}`,
            `ls ${encoded}/session.jsonl`,
            `dir ${encoded}\\session.jsonl`,
          ],
          "\n"
        );
        expect(matchesOf(content)).toEqual([encoded, windows, encoded, encoded, encoded]);
        // A further encoded segment counts anywhere, so a dash-led word in
        // prose is reported until its first segment joins HomeRouteSegment.
        const dashedWord = A.join(["", "home", "page", "title"], "-");
        expect(matchesOf(`css ${dashedWord}`)).toEqual([A.join(["", "home", "page"], "-")]);
      })
    );

    it.effect("ignores bare encoded branch labels that are not directories", () =>
      Effect.sync(() => {
        const content = A.join(
          [
            "label: beep-effect9-worktrees/-home-paths",
            "worktrees/-home-paths",
            '{"branch":"fix/-home-paths"}',
            '"-home-paths"',
            "myprojects/-home-paths",
            // A string escape after the label ends it; no path continues.
            String.raw`b"label: worktrees/-home-paths\n"`,
            String.raw`"fix/-home-paths\""`,
          ],
          "\n"
        );
        expect(matchesOf(content)).toEqual([]);
      })
    );

    it.effect("accepts a scoped fleet account only in the files its row names", () =>
      Effect.sync(() => {
        expect(A.isReadonlyArrayNonEmpty(privateHomePathScopedUsers)).toBe(true);
        for (const row of privateHomePathScopedUsers) {
          const fleetHome = posixHome("home", row.user);
          for (const file of row.files) {
            expect(scanPrivateHomePathText(file, `${fleetHome}/x`), file).toEqual([]);
          }
          const elsewhere = scanPrivateHomePathText("docs/other.md", `${fleetHome}/x`);
          expect(A.map(elsewhere, (finding) => finding.match)).toEqual([fleetHome]);
        }
      })
    );

    it.effect("drops sentence-ending dots from the user and the match", () =>
      Effect.sync(() => {
        expect(matchesOf("see /home/ada.\n")).toEqual([]);
        expect(matchesOf(`see ${LEAKED_HOME}.\n`)).toEqual([LEAKED_HOME]);
      })
    );

    it.effect("matches placeholder users case-sensitively", () =>
      Effect.sync(() => {
        expect(PlaceholderHomeUser.is.ada("ada")).toBe(true);
        const shouted = posixHome("home", "ADA");
        expect(matchesOf(`${shouted}/x`)).toEqual([shouted]);
      })
    );
  });

  describe("applyPrivateHomePathExemption", () => {
    const row = PrivateHomePathExemption.make({ file: "a.txt", count: 2, reason: "sealed capture" });
    const twice = scanPrivateHomePathText("a.txt", `${LEAKED_HOME}/a\n${LEAKED_HOME}/b\n`);

    it.effect("keeps findings for a file without a row", () =>
      Effect.sync(() => {
        expect(A.length(applyPrivateHomePathExemption(twice, O.none()))).toBe(2);
      })
    );

    it.effect("clears an archive at its exact count", () =>
      Effect.sync(() => {
        expect(applyPrivateHomePathExemption(twice, O.some(row))).toEqual([]);
      })
    );

    it.effect("reports every home path when the count grows or shrinks", () =>
      Effect.sync(() => {
        const thrice = scanPrivateHomePathText("a.txt", `${LEAKED_HOME}/a\n${LEAKED_HOME}/b\n${LEAKED_HOME}/c\n`);
        const grown = applyPrivateHomePathExemption(thrice, O.some(row));
        expect(A.map(grown, (finding) => finding.rule)).toEqual(A.replicate("exemption-count-mismatch", 3));
        expect(grown[0]?.suggestion).toContain("expects exactly 2 home paths, found 3");
        const shrunk = applyPrivateHomePathExemption(A.take(twice, 1), O.some(row));
        expect(A.map(shrunk, (finding) => finding.line)).toEqual([1]);
      })
    );

    it.effect("reports a stale row once when the archive records none", () =>
      Effect.sync(() => {
        const [stale, ...rest] = applyPrivateHomePathExemption([], O.some(row));
        expect(rest).toEqual([]);
        expect([stale?.file, stale?.line, stale?.rule]).toEqual(["a.txt", 1, "exemption-count-mismatch"]);
        expect(stale?.suggestion).toContain("remove the stale exemption row");
      })
    );
  });

  describe("data", () => {
    it.effect("keeps one row per sealed archive with a positive count and a reason", () =>
      Effect.sync(() => {
        expect(A.length(A.dedupe(A.map(privateHomePathExemptions, (row) => row.file)))).toBe(
          A.length(privateHomePathExemptions)
        );
        for (const row of privateHomePathExemptions) {
          expect(row.count, row.file).toBeGreaterThan(0);
          expect(row.reason.length, row.file).toBeGreaterThan(0);
        }
      })
    );

    it.effect("formats a finding as a report line", () =>
      Effect.sync(() => {
        const [finding] = scanPrivateHomePathText("demo.md", `see ${LEAKED_HOME}/x\n`);
        assertSome(
          O.map(O.fromNullishOr(finding), formatPrivateHomePathFinding),
          `demo.md:1:5  ${LEAKED_HOME}  →  record the path relative to ~ (for example ~/YeeBois/...); a path that is not a personal home passes through PrivateHomePaths.model.ts: a PlaceholderHomeUser name (fixtures, docs, service and container accounts), a HomeRouteSegment name (app routes), a privateHomePathScopedUsers row (a fleet account in named files), or a privateHomePathExemptions row with the exact count (a sealed archive)`
        );
      })
    );
  });
});

it.layer(PlatformLayer, { timeout: "120 seconds" })((it) => {
  describe("private-home-paths runner", { concurrent: false }, () => {
    it.effect(
      "passes, checks and emits JSON for the repository tree",
      Effect.fnUntraced(function* () {
        for (const args of [
          ["private-home-paths", "--check"],
          ["private-home-paths", "--json"],
        ]) {
          const exit = yield* runInProcess(args).pipe(withEmptyConfig, Effect.exit);
          assertTrue(Exit.isSuccess(exit), failureText(exit));
        }
      }),
      120_000
    );

    it.effect(
      "fails on a seeded tracked leak, honors sealed counts, skips untracked files and decodes NUL-bearing files",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "private-home-paths-" });
        yield* fs.writeFileString(path.join(root, "bun.lock"), "");
        const initExit = yield* git(root, ["init", "--quiet"]);
        expect(initExit).toBe(0);
        const files = {
          "docs/seed.md": `cwd ${LEAKED_HOME}/YeeBois/x\n`,
          "docs/fixture.md": "cwd /home/ada/x\n",
          "goals/x/history/sealed.txt": `${LEAKED_HOME}/a\n`,
          "docs/untracked.md": `cwd ${LEAKED_HOME}/x\n`,
          "docs/deleted.md": `cwd ${LEAKED_HOME}/x\n`,
        };
        for (const [file, content] of R.toEntries(files)) {
          yield* fs.makeDirectory(path.dirname(path.join(root, file)), { recursive: true });
          yield* fs.writeFileString(path.join(root, file), content);
        }
        yield* fs.writeFile(
          path.join(root, "docs/blob.bin"),
          new Uint8Array([0, ...new TextEncoder().encode(LEAKED_HOME)])
        );
        // A Windows PowerShell 5.1 redirect: UTF-16LE with a byte order mark.
        const utf16 = A.flatMap(A.fromIterable(`cwd ${LEAKED_HOME}\n`), (char) => [
          O.getOrElse(Str.charCodeAt(char, 0), () => 0),
          0,
        ]);
        yield* fs.writeFile(path.join(root, "docs/powershell.log"), new Uint8Array([0xff, 0xfe, ...utf16]));
        // The same UTF-16LE text without a byte order mark, a terminal capture
        // with one stray NUL, and a binary whose NULs hide no home path.
        yield* fs.writeFile(path.join(root, "docs/utf16-nobom.log"), new Uint8Array(utf16));
        yield* fs.writeFile(
          path.join(root, "docs/capture.log"),
          new Uint8Array([...new TextEncoder().encode("$ ls\n"), 0, ...new TextEncoder().encode(`${LEAKED_HOME}/x\n`)])
        );
        yield* fs.writeFile(path.join(root, "docs/image.png"), new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0x0d]));
        const addExit = yield* git(root, [
          "add",
          "--",
          "docs/seed.md",
          "docs/fixture.md",
          "goals/x/history/sealed.txt",
          "docs/deleted.md",
          "docs/blob.bin",
          "docs/powershell.log",
          "docs/utf16-nobom.log",
          "docs/capture.log",
          "docs/image.png",
        ]);
        expect(addExit).toBe(0);
        yield* fs.remove(path.join(root, "docs/deleted.md"));
        const exemptions = [
          PrivateHomePathExemption.make({ file: "goals/x/history/sealed.txt", count: 1, reason: "sealed capture" }),
          PrivateHomePathExemption.make({ file: "goals/x/history/gone.txt", count: 1, reason: "removed capture" }),
        ];

        const strict = yield* runPrivateHomePaths(
          PrivateHomePathsOptions.make({ cwd: root, strictCheck: true, exemptions })
        );
        expect([strict.strictFailure, strict.exemptFiles, strict.skippedBinaryFiles]).toEqual([true, 1, 0]);
        expect(A.map(strict.findings, (finding) => [finding.file, finding.line, finding.rule])).toEqual([
          ["docs/blob.bin", 1, "private-home-path"],
          ["docs/capture.log", 2, "private-home-path"],
          ["docs/powershell.log", 1, "private-home-path"],
          ["docs/seed.md", 1, "private-home-path"],
          ["docs/utf16-nobom.log", 1, "private-home-path"],
          ["goals/x/history/gone.txt", 1, "exemption-count-mismatch"],
        ]);

        const report = yield* runPrivateHomePaths(PrivateHomePathsOptions.make({ cwd: root, exemptions }));
        expect([report.strictFailure, report.findings.length]).toEqual([false, 6]);
      })
    );

    it.effect(
      "fails with the law's execution error when the directory is not a git checkout",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "private-home-paths-" });
        yield* fs.writeFileString(path.join(root, "bun.lock"), "");

        const exit = yield* runPrivateHomePaths(PrivateHomePathsOptions.make({ cwd: root, strictCheck: true })).pipe(
          Effect.exit
        );

        exit.pipe(Exit.isFailure, assertTrue);
        expect(failureText(exit)).toContain("PrivateHomePathsExecutionError");
      })
    );
  });
});
