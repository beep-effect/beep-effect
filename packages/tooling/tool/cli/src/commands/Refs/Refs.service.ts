/**
 * Pull-only reference workspace operations and nightly scheduling.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot } from "@beep/repo-utils";
import { Config, Effect } from "effect";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import { CapturedStep, OutputBound, runCaptured } from "../../internal/process/StepExec.ts";
import {
  readInstalledSystemdUnit,
  resolveOperatorPath,
  resolveUnitBunPath,
  systemdUnitDirective,
  systemdUserUnitDir,
} from "../../internal/systemd/index.ts";
import { parseDeepCoverage } from "../Graft/Graft.schemas.ts";
import { ReferenceWorkspaceError } from "./Refs.errors.ts";
import {
  MemberRefreshReport,
  ReferenceWorkspaceCheck,
  ReferenceWorkspaceManifest,
  RefsRefreshStatus,
  RefsTimerOptions,
  RefsTimerUnit,
} from "./Refs.schemas.ts";
import type * as Crypto from "effect/Crypto";
import type { ChildProcessSpawner } from "effect/process";
import type { ReferenceMember } from "./Refs.schemas.ts";

const isPositiveInteger = S.is(S.Int.check(S.isGreaterThan(0)));

/** Untracked artifacts graft leaves in a member; excluded per clone, never via .gitignore (R3). */
const GRAFT_EXCLUDE_ENTRIES: ReadonlyArray<string> = ["graft/", ".graft/", ".ignore"];

/** Result of bringing one member to origin/main: skipped by policy, failed, or synced. */
type MemberSync =
  | { readonly _tag: "skipped"; readonly outcome: "skipped-dirty" | "skipped-off-branch" }
  | { readonly _tag: "failed" }
  | { readonly _tag: "synced"; readonly changed: boolean };
const MemberSync = {
  failed: { _tag: "failed" } as const satisfies MemberSync,
  skipped: (outcome: "skipped-dirty" | "skipped-off-branch"): MemberSync => ({ _tag: "skipped", outcome }),
  synced: (changed: boolean): MemberSync => ({ _tag: "synced", changed }),
};

const $I = $RepoCliId.create("commands/Refs/Refs.service");

/**
 * Read-only planning, pull-only refresh, checkout linking, and unit rendering.
 * @category services
 * @since 0.0.0
 */
export interface ReferenceWorkspaceShape {
  readonly installTimer: (
    home: string,
    root: string,
    calendar: string,
    bunPath: string
  ) => Effect.Effect<ReadonlyArray<string>, ReferenceWorkspaceError>;
  readonly linkInto: (
    checkoutRoot: string,
    root: string
  ) => Effect.Effect<ReadonlyArray<string>, ReferenceWorkspaceError>;
  readonly plan: (home: string, root: string) => Effect.Effect<ReadonlyArray<string>, ReferenceWorkspaceError>;
  readonly refresh: (
    home: string,
    root: string,
    jobs: number
  ) => Effect.Effect<RefsRefreshStatus, ReferenceWorkspaceError>;
  readonly refreshTimer: (
    home: string,
    bunPath: O.Option<string>
  ) => Effect.Effect<ReadonlyArray<string>, ReferenceWorkspaceError>;
  readonly renderTimerUnits: (
    home: string,
    root: string,
    calendar: string,
    bunPath: string
  ) => Effect.Effect<ReadonlyArray<RefsTimerUnit>, ReferenceWorkspaceError>;
  readonly resolveRoot: (home: string, root: O.Option<string>) => Effect.Effect<string, ReferenceWorkspaceError>;
  readonly uninstallTimer: (home: string) => Effect.Effect<ReadonlyArray<string>, ReferenceWorkspaceError>;
}

/**
 * Owns manifest-defined reference operations; construction performs no writes.
 *
 * **Example** (Prepare a read-only plan)
 * ```ts
 * import { ReferenceWorkspace } from "@beep/repo-cli/commands/Refs"
 * import { Effect } from "effect"
 * Effect.isEffect(ReferenceWorkspace.use((workspace) => workspace.plan("/home/op", "/refs"))) // => true
 * ```
 * @category services
 * @since 0.0.0
 */
export class ReferenceWorkspace extends Context.Service<ReferenceWorkspace, ReferenceWorkspaceShape>()(
  $I`ReferenceWorkspace`
) {}

const unitBase = "beep-refs-refresh";
const unitPath = "%h/.local/share/mise/shims:%h/.local/bin:%h/.bun/bin:/usr/local/bin:/usr/bin:/bin";
const outputBound = OutputBound.make({ maxChars: 8 * 1024 * 1024, truncatedNotice: "\n[beep refs] output truncated" });
const ioError = (path: string, message: string) => (cause: unknown) =>
  ReferenceWorkspaceError.make({ path, message, cause });
const buildArgs = (member: ReferenceMember, jobs: number): ReadonlyArray<string> => [
  "build",
  ...(member.tier === "deep" ? ["--deep", "--allow-partial", "-j", `${jobs}`] : []),
  ...A.flatMap(
    O.getOrElse(member.onlyDir, () => []),
    (directory) => ["--only-dir", directory]
  ),
];

const makeReferenceWorkspace = Effect.fn("ReferenceWorkspace.make")(function* (owner: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const context = yield* Effect.context<Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner>();
  const manifestPath = path.join(owner, "scripts", "references.json");
  const readManifest = Effect.fn("ReferenceWorkspace.readManifest")(
    function* () {
      const text = yield* fs.readFileString(manifestPath);
      return yield* ReferenceWorkspaceManifest.decodeJson(text);
    },
    Effect.mapError(ioError(manifestPath, "Cannot decode scripts/references.json."))
  );

  const resolveRoot: ReferenceWorkspaceShape["resolveRoot"] = Effect.fn("ReferenceWorkspace.resolveRoot")(
    function* (home, root) {
      const manifest = yield* readManifest();
      const override = yield* Config.String("BEEP_REFERENCES_ROOT").pipe(
        Config.option,
        Effect.mapError(ioError(manifestPath, "Cannot read root override."))
      );
      const chosen = O.getOrElse(
        O.orElse(root, () => O.filter(override, Str.isNonEmpty)),
        () => `${home}/${Str.slice(6)(manifest.rootDefault)}`
      );
      return resolveOperatorPath(chosen, home, path.resolve);
    }
  );

  // Maintenance commands receive no model/provider secrets. Only deep builds
  // and the desktop notifier inherit the unit environment (R4, R9).
  const step = Effect.fn("ReferenceWorkspace.step")(function* (
    home: string,
    cwd: string,
    command: string,
    args: ReadonlyArray<string>,
    deep = false,
    stdout = false
  ) {
    const ambientPath = yield* Config.String("PATH").pipe(
      Config.withDefault("/usr/bin:/bin"),
      Effect.mapError(ioError(cwd, "Cannot read process PATH."))
    );
    return yield* runCaptured({
      command,
      args,
      cwd,
      bound: outputBound,
      source: stdout === true ? "stdout" : "merge",
      trim: true,
      tee: false,
      extendEnv: deep === true || command === "notify-send" || command === "systemctl",
      env: { HOME: home, PATH: ambientPath, CI: "true", GRAFT_NO_GITIGNORE: "1" },
      timeout: deep === true ? "5 hours" : "15 minutes",
      forceKillAfter: "30 seconds",
    }).pipe(Effect.provide(context), Effect.mapError(ioError(cwd, `${command} failed to run.`)));
  });
  const mustRun = Effect.fn("ReferenceWorkspace.mustRun")(function* (
    home: string,
    cwd: string,
    command: string,
    args: ReadonlyArray<string>
  ) {
    const result = yield* step(home, cwd, command, args);
    if (result.exitCode !== 0)
      return yield* ReferenceWorkspaceError.make({
        path: cwd,
        message: `${command} exited ${result.exitCode}: ${result.output}`,
      });
    return result;
  });
  const capturedFailure = (error: ReferenceWorkspaceError) =>
    Effect.succeed(CapturedStep.make({ exitCode: 1, output: error.message, truncated: false }));

  const plan: ReferenceWorkspaceShape["plan"] = Effect.fn("ReferenceWorkspace.plan")(function* (_home, root) {
    const manifest = yield* readManifest();
    const lines = yield* Effect.forEach(
      manifest.members,
      Effect.fnUntraced(function* (member) {
        const memberRoot = path.join(root, member.name);
        const present = yield* fs
          .exists(path.join(memberRoot, ".git"))
          .pipe(Effect.mapError(ioError(memberRoot, "Cannot inspect reference member.")));
        return [
          present
            ? `keep ${memberRoot}; pull --ff-only only if clean and on main`
            : `clone ${member.url} -> ${memberRoot}`,
          `link ${path.join(owner, ".repos", member.name)} -> ${memberRoot}`,
          `build ${memberRoot}: GRAFT_NO_GITIGNORE=1 graft ${A.join(buildArgs(member, 16), " ")}`,
        ];
      })
    );
    return [
      `Reference workspace: ${root}`,
      ...A.flatten(lines),
      `link ${path.join(owner, manifest.workspaceLink)} -> ${root}`,
      `build ${root}: GRAFT_NO_GITIGNORE=1 graft build`,
      `check: graft check ${root}`,
    ];
  });

  const linkInto: ReferenceWorkspaceShape["linkInto"] = Effect.fn("ReferenceWorkspace.linkInto")(
    function* (checkoutRoot, root) {
      const manifest = yield* readManifest();
      if (!(yield* fs.exists(root)))
        return yield* ReferenceWorkspaceError.make({
          path: root,
          message: `Reference root is missing: ${root}; run scripts/setup-effect-ref.sh to provision it.`,
        });
      const repos = path.join(checkoutRoot, ".repos");
      // Never follow a redirected .repos directory when repairing its children.
      const reposLink = yield* fs.readLink(repos).pipe(Effect.option);
      if (O.isSome(reposLink))
        return yield* ReferenceWorkspaceError.make({ path: repos, message: "Refusing a symlinked .repos directory." });
      yield* fs.makeDirectory(repos, { recursive: true });
      const links = [
        ...A.map(manifest.members, (member) =>
          Tuple.make(path.join(".repos", member.name), path.join(root, member.name))
        ),
        Tuple.make(manifest.workspaceLink, root),
      ];
      return yield* Effect.forEach(
        links,
        Effect.fnUntraced(function* ([relative, target]) {
          const link = path.join(checkoutRoot, relative);
          const current = yield* fs.readLink(link).pipe(Effect.option);
          if (O.isSome(current)) {
            if (current.value === target) return `${relative} -> ${target}`;
            yield* fs.remove(link);
          } else if (yield* fs.exists(link)) {
            return `warning: ${relative} exists and is not a symlink; preserved`;
          }
          yield* fs.symlink(target, link);
          return `${relative} -> ${target}`;
        })
      );
    },
    Effect.mapError((cause) =>
      ReferenceWorkspaceError.is(cause) ? cause : ioError(manifestPath, "Cannot link reference workspace.")(cause)
    )
  );

  const refresh: ReferenceWorkspaceShape["refresh"] = Effect.fn("ReferenceWorkspace.refresh")(
    function* (home, root, jobs) {
      if (!isPositiveInteger(jobs))
        return yield* ReferenceWorkspaceError.make({ path: root, message: "--jobs must be a positive integer." });
      const manifest = yield* readManifest();
      const ensureGraftExcludes = Effect.fnUntraced(function* (cwd: string) {
        const gitDir = path.join(cwd, ".git");
        const gitInfo = yield* fs
          .stat(gitDir)
          .pipe(Effect.mapError(ioError(cwd, "Cannot inspect member Git metadata.")));
        // A linked worktree keeps a .git file; its exclude file lives elsewhere, so skip it.
        if (gitInfo.type !== "Directory") return;
        const infoDir = path.join(gitDir, "info");
        const excludeFile = path.join(infoDir, "exclude");
        yield* fs
          .makeDirectory(infoDir, { recursive: true })
          .pipe(Effect.mapError(ioError(cwd, "Cannot create .git/info.")));
        const existing = yield* fs.readFileString(excludeFile).pipe(Effect.orElseSucceed(() => ""));
        const present = HashSet.fromIterable(Str.split(existing, "\n"));
        const missing = A.filter(GRAFT_EXCLUDE_ENTRIES, (entry) => !HashSet.has(present, entry));
        if (!A.isReadonlyArrayNonEmpty(missing)) return;
        const separator = Str.isEmpty(existing) || Str.endsWith("\n")(existing) ? "" : "\n";
        yield* fs
          .writeFileString(excludeFile, `${existing}${separator}${A.join(missing, "\n")}\n`)
          .pipe(Effect.mapError(ioError(cwd, "Cannot write .git/info/exclude.")));
      });
      let reports = HashMap.empty<string, MemberRefreshReport>();
      for (const member of manifest.members) {
        const cwd = path.join(root, member.name);
        const git = (args: ReadonlyArray<string>) => step(home, cwd, "git", args, false, true);
        // A git call that either yields its trimmed stdout or none when it exited non-zero.
        const gitOutput = Effect.fnUntraced(function* (args: ReadonlyArray<string>) {
          const result = yield* git(args);
          return result.exitCode === 0 ? O.some(result.output) : O.none<string>();
        });
        // Bring the member to origin/main without ever rewriting local state (R9): a dirty or
        // off-main member is skipped, a failing git call fails the member, else it is synced.
        const syncMember = Effect.fnUntraced(function* () {
          const dirty = yield* gitOutput(["status", "--porcelain", "--untracked-files=all"]);
          if (O.isNone(dirty)) return MemberSync.failed;
          if (Str.isNonEmpty(dirty.value)) return MemberSync.skipped("skipped-dirty");
          const branch = yield* gitOutput(["branch", "--show-current"]);
          if (O.isNone(branch)) return MemberSync.failed;
          if (branch.value !== "main") return MemberSync.skipped("skipped-off-branch");
          const before = yield* gitOutput(["rev-parse", "HEAD"]);
          if (O.isNone(before)) return MemberSync.failed;
          const pulled = yield* gitOutput(["pull", "--ff-only"]);
          const after = yield* gitOutput(["rev-parse", "HEAD"]);
          return O.isNone(pulled) || O.isNone(after)
            ? MemberSync.failed
            : MemberSync.synced(before.value !== after.value);
        });
        const memberRun = Effect.fn("ReferenceWorkspace.refreshMember")(function* () {
          const report = (outcome: MemberRefreshReport["outcome"]) =>
            MemberRefreshReport.make({ name: member.name, outcome, coverage: O.none() });
          // A missing member must not let Git walk upward into a different checkout.
          const hasGit = yield* fs
            .exists(path.join(cwd, ".git"))
            .pipe(Effect.mapError(ioError(cwd, "Cannot inspect member Git metadata.")));
          if (!hasGit) return report("pull-failed");
          // graft writes graft/, .graft/ and .ignore into the member; keep them out of the
          // cleanliness check without touching the member's tracked .gitignore (R3).
          yield* ensureGraftExcludes(cwd);
          const sync = yield* syncMember();
          if (sync._tag !== "synced") return report(sync._tag === "skipped" ? sync.outcome : "pull-failed");
          const build = yield* step(home, cwd, "graft", buildArgs(member, jobs), member.tier === "deep").pipe(
            Effect.catchTag("ReferenceWorkspaceError", capturedFailure)
          );
          return MemberRefreshReport.make({
            name: member.name,
            outcome: build.exitCode !== 0 ? "build-failed" : sync.changed ? "pulled" : "unchanged",
            coverage: member.tier === "deep" ? parseDeepCoverage(build.output) : O.none(),
          });
        });
        const report = yield* memberRun().pipe(
          Effect.catchTag("ReferenceWorkspaceError", () =>
            Effect.succeed(MemberRefreshReport.make({ name: member.name, outcome: "pull-failed", coverage: O.none() }))
          )
        );
        reports = HashMap.set(reports, member.name, report);
      }
      const build = yield* step(home, root, "graft", ["build"]).pipe(
        Effect.catchTag("ReferenceWorkspaceError", capturedFailure)
      );
      const check = yield* step(home, root, "graft", ["check", root]).pipe(
        Effect.catchTag("ReferenceWorkspaceError", capturedFailure)
      );
      const status = RefsRefreshStatus.make({
        schemaVersion: "beep-refs-refresh/v1",
        timestamp: DateTime.formatIso(yield* DateTime.now),
        root,
        members: A.getSomes(A.map(manifest.members, (member) => HashMap.get(reports, member.name))),
        workspaceCheck: ReferenceWorkspaceCheck.make({
          buildExitCode: build.exitCode,
          exitCode: check.exitCode,
          output: check.output,
        }),
      });
      const stateDir = path.join(home, ".local", "state", "beep", "refs");
      const statusPath = path.join(stateDir, "last-refresh.json");
      const encoded = yield* RefsRefreshStatus.encodeJson(status);
      yield* fs.makeDirectory(stateDir, { recursive: true });
      const temporary = yield* fs.makeTempFile({ directory: stateDir, prefix: ".refresh-" });
      yield* fs.writeFileString(temporary, `${encoded}\n`);
      yield* fs.rename(temporary, statusPath);
      // Intentional skips (dirty or off-main members are never reset, R9) are recorded in the
      // status file but do not page: critical notification is reserved for pull/build failures,
      // a deep member that built without coverage, and a failed workspace build or check.
      const reachedBuild = (report: MemberRefreshReport) =>
        report.outcome === "pulled" || report.outcome === "unchanged";
      const degraded = A.some(
        status.members,
        (report) =>
          report.outcome === "pull-failed" ||
          report.outcome === "build-failed" ||
          O.exists(report.coverage, (coverage) => coverage.covered < coverage.total || coverage.failedFiles > 0)
      );
      const missingCoverage = A.some(
        manifest.members,
        (member) =>
          member.tier === "deep" &&
          O.exists(HashMap.get(reports, member.name), (report) => reachedBuild(report) && O.isNone(report.coverage))
      );
      if (degraded || missingCoverage || build.exitCode !== 0 || check.exitCode !== 0) {
        yield* Effect.ignore(
          step(home, home, "notify-send", [
            "--urgency=critical",
            "beep refs refresh failed or degraded",
            `See ${statusPath}`,
          ])
        );
      }
      return status;
    },
    Effect.mapError((cause) =>
      ReferenceWorkspaceError.is(cause) ? cause : ioError(manifestPath, "Cannot complete reference refresh.")(cause)
    )
  );

  const renderFor = Effect.fn("ReferenceWorkspace.renderFor")(function* (input: RefsTimerOptions) {
    const options = yield* RefsTimerOptions.decode(input).pipe(
      Effect.mapError(ioError(owner, "Invalid systemd unit values."))
    );
    return [
      RefsTimerUnit.make({
        fileName: `${unitBase}.service`,
        text: A.join(
          [
            "[Unit]",
            "Description=beep reference workspace refresh",
            "",
            "[Service]",
            "Type=oneshot",
            `WorkingDirectory=${options.owner}`,
            `Environment=PATH=${unitPath}`,
            "Environment=CI=true",
            `EnvironmentFile=${path.join(options.home, ".config", "beep-graft", "env")}`,
            `ExecStartPre=/usr/bin/env -i "HOME=%h" "PATH=${unitPath}" CI=true "${options.bunPath}" install --frozen-lockfile --ignore-scripts`,
            `ExecStart="${options.bunPath}" run beep refs refresh --root "${options.root}" --jobs 16`,
            "TimeoutStartSec=12h",
            "TimeoutStopSec=90",
            "KillMode=mixed",
            "Nice=10",
            "Slice=background.slice",
            "",
          ],
          "\n"
        ),
      }),
      RefsTimerUnit.make({
        fileName: `${unitBase}.timer`,
        text: A.join(
          [
            "[Unit]",
            "Description=Timer for beep reference workspace refresh",
            "",
            "[Timer]",
            `OnCalendar=${options.calendar}`,
            "Persistent=true",
            "RandomizedDelaySec=600",
            "",
            "[Install]",
            "WantedBy=timers.target",
            "",
          ],
          "\n"
        ),
      }),
    ];
  });
  const timerOptions = (home: string, root: string, calendar: string, bunPath: string) =>
    RefsTimerOptions.decode({ home, root, calendar, bunPath, owner }).pipe(
      Effect.mapError(ioError(owner, "Invalid systemd unit values."))
    );
  const renderTimerUnits: ReferenceWorkspaceShape["renderTimerUnits"] = Effect.fn(
    "ReferenceWorkspace.renderTimerUnits"
  )(function* (home, root, calendar, bunPath) {
    return yield* renderFor(yield* timerOptions(home, root, calendar, bunPath));
  });
  const installFor = Effect.fn("ReferenceWorkspace.installFor")(
    function* (options: RefsTimerOptions) {
      const units = yield* renderFor(options);
      const envFile = path.join(options.home, ".config", "beep-graft", "env");
      yield* fs.access(envFile).pipe(Effect.mapError(ioError(envFile, "The graft environment file is required.")));
      const directory = systemdUserUnitDir(path, options.home);
      yield* fs.makeDirectory(directory, { recursive: true });
      const paths = yield* Effect.forEach(
        units,
        Effect.fnUntraced(function* (unit) {
          const file = path.join(directory, unit.fileName);
          yield* fs.writeFileString(file, unit.text);
          return file;
        })
      );
      yield* mustRun(options.home, options.home, "systemctl", ["--user", "daemon-reload"]);
      yield* mustRun(options.home, options.home, "systemctl", ["--user", "enable", "--now", `${unitBase}.timer`]);
      return paths;
    },
    Effect.mapError((cause) =>
      ReferenceWorkspaceError.is(cause) ? cause : ioError(owner, "Cannot install reference timer.")(cause)
    )
  );
  const installTimer: ReferenceWorkspaceShape["installTimer"] = Effect.fn("ReferenceWorkspace.installTimer")(
    function* (home, root, calendar, bunPath) {
      return yield* installFor(yield* timerOptions(home, root, calendar, bunPath));
    }
  );
  const refreshTimer: ReferenceWorkspaceShape["refreshTimer"] = Effect.fn("ReferenceWorkspace.refreshTimer")(
    function* (home, pinned) {
      const platform = Context.make(FileSystem.FileSystem, fs).pipe(Context.add(Path.Path, path));
      const service = yield* readInstalledSystemdUnit({ home, fileName: `${unitBase}.service` }).pipe(
        Effect.provide(platform)
      );
      const timer = yield* readInstalledSystemdUnit({ home, fileName: `${unitBase}.timer` }).pipe(
        Effect.provide(platform)
      );
      const recordedOwner = O.flatMap(service, systemdUnitDirective("WorkingDirectory"));
      const calendar = O.flatMap(timer, systemdUnitDirective("OnCalendar"));
      const root = O.flatMap(O.flatMap(service, systemdUnitDirective("ExecStart")), (line) =>
        O.flatMap(Str.match(/--root "([^"]+)"/u)(line), (match) => O.fromUndefinedOr(match[1]))
      );
      if (O.isNone(recordedOwner) || O.isNone(calendar) || O.isNone(root))
        return yield* ReferenceWorkspaceError.make({
          path: home,
          message: "--refresh requires installed beep-refs-refresh units with recorded owner, root, and calendar.",
        });
      const bunPath = yield* resolveUnitBunPath({ home, pinned }).pipe(Effect.provide(platform));
      const options = yield* RefsTimerOptions.decode({
        home,
        owner: recordedOwner.value,
        root: root.value,
        calendar: calendar.value,
        bunPath,
      });
      return yield* installFor(options);
    },
    Effect.mapError((cause) =>
      ReferenceWorkspaceError.is(cause) ? cause : ioError(owner, "Cannot refresh installed reference timer.")(cause)
    )
  );
  const uninstallTimer: ReferenceWorkspaceShape["uninstallTimer"] = Effect.fn("ReferenceWorkspace.uninstallTimer")(
    function* (home) {
      const directory = systemdUserUnitDir(path, home);
      const existing = yield* Effect.filter([`${unitBase}.service`, `${unitBase}.timer`], (file) =>
        fs.exists(path.join(directory, file))
      );
      if (A.isReadonlyArrayEmpty(existing)) return [];
      yield* mustRun(home, home, "systemctl", ["--user", "disable", "--now", `${unitBase}.timer`]);
      const removed = yield* Effect.forEach(
        existing,
        Effect.fnUntraced(function* (file) {
          const target = path.join(directory, file);
          yield* fs.remove(target);
          return target;
        })
      );
      yield* mustRun(home, home, "systemctl", ["--user", "daemon-reload"]);
      return removed;
    },
    Effect.mapError((cause) =>
      ReferenceWorkspaceError.is(cause) ? cause : ioError(owner, "Cannot uninstall reference timer.")(cause)
    )
  );
  return ReferenceWorkspace.of({
    resolveRoot,
    plan,
    refresh,
    linkInto,
    renderTimerUnits,
    installTimer,
    refreshTimer,
    uninstallTimer,
  });
});

/**
 * Binds reference operations to the checkout that owns scripts/references.json.
 *
 * **Example** (Prepare an isolated owner)
 * ```ts
 * import { referenceWorkspaceLayer } from "@beep/repo-cli/commands/Refs"
 * import * as Layer from "effect/Layer"
 * Layer.isLayer(referenceWorkspaceLayer("/checkout")) // => true
 * ```
 * @category layers
 * @since 0.0.0
 */
export const referenceWorkspaceLayer = (
  owner: string
): Layer.Layer<
  ReferenceWorkspace,
  never,
  FileSystem.FileSystem | Path.Path | Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner
> => Layer.effect(ReferenceWorkspace, makeReferenceWorkspace(owner));

/**
 * Resolves the CLI checkout without reading or writing the reference root.
 *
 * **Example** (Inspect the live layer)
 * ```ts
 * import { ReferenceWorkspaceLive } from "@beep/repo-cli/commands/Refs"
 * import * as Layer from "effect/Layer"
 * Layer.isLayer(ReferenceWorkspaceLive) // => true
 * ```
 * @category layers
 * @since 0.0.0
 */
export const ReferenceWorkspaceLive = Layer.effect(
  ReferenceWorkspace,
  Effect.flatMap(findRepoRoot(), makeReferenceWorkspace)
);
