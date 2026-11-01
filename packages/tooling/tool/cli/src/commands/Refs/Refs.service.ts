/**
 * Pull-only reference workspace operations and nightly scheduling.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot } from "@beep/repo-utils";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import { OutputBound, runCaptured, runCapturedStreams } from "../../internal/process/StepExec.ts";
import {
  readInstalledSystemdUnit,
  resolveOperatorPath,
  resolveUnitBunPath,
  systemdUnitDirective,
  systemdUserUnitDir,
} from "../../internal/systemd/index.ts";
import { ReferenceWorkspaceError } from "./Refs.errors.ts";
import {
  MEMBER_REFRESH_DETAIL_MAX_CHARS,
  MemberRefreshReport,
  ReferenceWorkspaceManifest,
  RefsRefreshStatus,
  RefsTimerOptions,
  RefsTimerUnit,
} from "./Refs.schemas.ts";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";

/** Result of bringing one member to origin/main: skipped by policy or synced; git failures fail. */
type MemberSync =
  | { readonly _tag: "skipped"; readonly outcome: "skipped-dirty" | "skipped-off-branch" }
  | { readonly _tag: "synced"; readonly changed: boolean };
const MemberSync = {
  skipped: (outcome: "skipped-dirty" | "skipped-off-branch"): MemberSync => ({ _tag: "skipped", outcome }),
  synced: (changed: boolean): MemberSync => ({ _tag: "synced", changed }),
};

const $I = $RepoCliId.create("commands/Refs/Refs.service");

/**
 * Planning, missing-member provisioning, pull-only refresh, checkout linking, and unit rendering.
 *
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
  readonly provision: (
    home: string,
    checkoutRoot: string,
    root: string
  ) => Effect.Effect<ReadonlyArray<string>, ReferenceWorkspaceError>;
  /**
   * Fast-forwards every clean member on its configured branch, then writes the receipt.
   *
   * **Details**
   * Dirty and off-branch members are skipped, never reset. Only a failed pull
   * raises a critical desktop notification.
   */
  readonly refresh: (home: string, root: string) => Effect.Effect<RefsRefreshStatus, ReferenceWorkspaceError>;
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
 * import * as Effect from "effect/Effect";
 * Effect.isEffect(ReferenceWorkspace.use((workspace) => workspace.plan("/home/op", "/refs"))) // => true
 * ```
 *
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
const makeReferenceWorkspace = Effect.fn("ReferenceWorkspace.make")(function* (owner: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const context = yield* Effect.context<SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner>();
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

  const readAmbientPath = (cwd: string) =>
    Config.String("PATH").pipe(
      Config.withDefault("/usr/bin:/bin"),
      Effect.mapError(ioError(cwd, "Cannot read process PATH."))
    );
  // Maintenance commands run with an allowlisted environment; only the desktop
  // notifier and systemctl inherit the unit environment (R4, R9).
  const step = Effect.fn("ReferenceWorkspace.step")(function* (
    home: string,
    cwd: string,
    command: string,
    args: ReadonlyArray<string>
  ) {
    const ambientPath = yield* readAmbientPath(cwd);
    return yield* runCaptured({
      command,
      args,
      cwd,
      bound: outputBound,
      source: "merge",
      trim: true,
      tee: false,
      extendEnv: command === "notify-send" || command === "systemctl",
      env: { HOME: home, PATH: ambientPath, CI: "true" },
      timeout: "15 minutes",
      forceKillAfter: "30 seconds",
    }).pipe(Effect.provide(context), Effect.mapError(ioError(cwd, `${command} failed to run.`)));
  });
  // Git keeps stdout and stderr apart: stdout is parsed, stderr explains a failure. Same
  // environment allowlist, output bound, and deadline as a maintenance `step`.
  const gitStep = Effect.fn("ReferenceWorkspace.gitStep")(function* (
    home: string,
    cwd: string,
    args: ReadonlyArray<string>
  ) {
    const ambientPath = yield* readAmbientPath(cwd);
    return yield* runCapturedStreams({
      command: "git",
      args,
      cwd,
      bound: outputBound,
      trim: true,
      extendEnv: false,
      env: { HOME: home, PATH: ambientPath, CI: "true" },
      forceKillAfter: "30 seconds",
    }).pipe(Effect.timeout("15 minutes"), Effect.provide(context), Effect.mapError(ioError(cwd, "git failed to run.")));
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
  // Receipts keep only the tail of a failing step: the last lines name the error.
  const detailOf = (text: string) => O.some(Str.slice(-MEMBER_REFRESH_DETAIL_MAX_CHARS)(text));

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
            ? `keep ${memberRoot}; pull --ff-only origin ${member.branch} only if clean and on ${member.branch}`
            : `clone ${member.url} --branch ${member.branch} -> ${memberRoot}`,
          `link ${path.join(owner, ".repos", member.name)} -> ${memberRoot}`,
        ];
      })
    );
    return [
      `Reference workspace: ${root}`,
      ...A.flatten(lines),
      `link ${path.join(owner, manifest.workspaceLink)} -> ${root}`,
    ];
  });

  const linkInto: ReferenceWorkspaceShape["linkInto"] = Effect.fn("ReferenceWorkspace.linkInto")(
    function* (checkoutRoot, root) {
      const manifest = yield* readManifest();
      if (!(yield* fs.exists(root)))
        return yield* ReferenceWorkspaceError.make({
          path: root,
          message: `Reference root is missing: ${root}; run bun run beep refs provision to provision it.`,
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

  const provision: ReferenceWorkspaceShape["provision"] = Effect.fn("ReferenceWorkspace.provision")(
    function* (home, checkoutRoot, root) {
      const manifest = yield* readManifest();
      // Refuse redirected links before cloning anything into the reference root.
      if (O.isSome(yield* fs.readLink(path.join(checkoutRoot, ".repos")).pipe(Effect.option)))
        return yield* ReferenceWorkspaceError.make({
          path: checkoutRoot,
          message: "Refusing a symlinked .repos directory.",
        });
      yield* fs.makeDirectory(root, { recursive: true });
      const canonicalRoot = yield* fs.realPath(root);
      const reports = yield* Effect.forEach(
        manifest.members,
        Effect.fnUntraced(function* (member) {
          const memberRoot = path.join(canonicalRoot, member.name);
          if (yield* fs.exists(path.join(memberRoot, ".git"))) return `keep ${memberRoot}; existing checkout preserved`;
          yield* mustRun(home, canonicalRoot, "git", [
            "clone",
            "--quiet",
            "--branch",
            member.branch,
            "--",
            member.url,
            memberRoot,
          ]);
          return `cloned ${member.name}`;
        })
      );
      return [...reports, ...(yield* linkInto(checkoutRoot, canonicalRoot))];
    },
    Effect.mapError((cause) =>
      ReferenceWorkspaceError.is(cause) ? cause : ioError(owner, "Cannot provision reference workspace.")(cause)
    )
  );

  const refresh: ReferenceWorkspaceShape["refresh"] = Effect.fn("ReferenceWorkspace.refresh")(
    function* (home, root) {
      const manifest = yield* readManifest();
      let reports = HashMap.empty<string, MemberRefreshReport>();
      for (const member of manifest.members) {
        const cwd = path.join(root, member.name);
        // A git call that yields its trimmed stdout, or fails the member with git's stderr.
        const gitOutput = Effect.fnUntraced(function* (args: ReadonlyArray<string>) {
          const result = yield* gitStep(home, cwd, args);
          if (result.exitCode !== 0)
            return yield* ReferenceWorkspaceError.make({
              path: cwd,
              message: `git ${A.join(args, " ")} exited ${result.exitCode}${Str.isNonEmpty(result.stderr) ? `: ${result.stderr}` : ""}`,
            });
          return result.stdout;
        });
        // Follow the manifest branch without rewriting local state: dirty or off-branch
        // members are skipped; a failing git call fails the member, otherwise it is synced.
        const syncMember = Effect.fnUntraced(function* () {
          const dirty = yield* gitOutput(["status", "--porcelain", "--untracked-files=all"]);
          if (Str.isNonEmpty(dirty)) return MemberSync.skipped("skipped-dirty");
          const branch = yield* gitOutput(["branch", "--show-current"]);
          if (branch !== member.branch) return MemberSync.skipped("skipped-off-branch");
          const before = yield* gitOutput(["rev-parse", "HEAD"]);
          yield* gitOutput(["pull", "--ff-only", "origin", member.branch]);
          const after = yield* gitOutput(["rev-parse", "HEAD"]);
          return MemberSync.synced(before !== after);
        });
        const report = (outcome: MemberRefreshReport["outcome"], detail: O.Option<string> = O.none()) =>
          MemberRefreshReport.make({ name: member.name, outcome, detail });
        const memberRun = Effect.fn("ReferenceWorkspace.refreshMember")(function* () {
          // A missing member must not let Git walk upward into a different checkout.
          const hasGit = yield* fs
            .exists(path.join(cwd, ".git"))
            .pipe(Effect.mapError(ioError(cwd, "Cannot inspect member Git metadata.")));
          if (!hasGit) return report("pull-failed", detailOf(`No Git metadata at ${path.join(cwd, ".git")}.`));
          const sync = yield* syncMember();
          if (sync._tag === "skipped") return report(sync.outcome);
          return report(sync.changed ? "pulled" : "unchanged");
        });
        const memberReport = yield* memberRun().pipe(
          Effect.catchTag("ReferenceWorkspaceError", (error) =>
            Effect.succeed(report("pull-failed", detailOf(error.message)))
          )
        );
        reports = HashMap.set(reports, member.name, memberReport);
      }
      const status = RefsRefreshStatus.make({
        schemaVersion: "beep-refs-refresh/v2",
        timestamp: DateTime.formatIso(yield* DateTime.now),
        root,
        members: A.getSomes(A.map(manifest.members, (member) => HashMap.get(reports, member.name))),
      });
      const stateDir = path.join(home, ".local", "state", "beep", "refs");
      const statusPath = path.join(stateDir, "last-refresh.json");
      const encoded = yield* RefsRefreshStatus.encodeJson(status);
      yield* fs.makeDirectory(stateDir, { recursive: true });
      const temporary = yield* fs.makeTempFile({ directory: stateDir, prefix: ".refresh-" });
      yield* fs.writeFileString(temporary, `${encoded}\n`);
      yield* fs.rename(temporary, statusPath);
      // Intentional skips (dirty or off-branch members are never reset, R9) are recorded in the
      // status file but do not page: critical notification is reserved for pull failures.
      if (A.some(status.members, (report) => report.outcome === "pull-failed")) {
        yield* Effect.ignore(
          step(home, home, "notify-send", ["--urgency=critical", "beep refs refresh failed", `See ${statusPath}`])
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
            `ExecStartPre=/usr/bin/env -i "HOME=%h" "PATH=${unitPath}" CI=true "${options.bunPath}" install --frozen-lockfile --ignore-scripts`,
            `ExecStart="${options.bunPath}" run beep refs refresh --root "${options.root}"`,
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
    provision,
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
 *
 * @param owner - Checkout containing the reference manifest used by these operations.
 * @returns A layer providing reference operations for the supplied checkout.
 * @category layers
 * @since 0.0.0
 */
export const referenceWorkspaceLayer = (
  owner: string
): Layer.Layer<
  ReferenceWorkspace,
  never,
  FileSystem.FileSystem | Path.Path | SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner
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
 *
 * @category layers
 * @since 0.0.0
 */
export const ReferenceWorkspaceLive = Layer.effect(
  ReferenceWorkspace,
  Effect.flatMap(findRepoRoot(), makeReferenceWorkspace)
);
