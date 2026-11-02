import { fcRuns } from "@beep/fc-runs";
import { ReferenceWorkspaceManifest, RefsRefreshStatus } from "@beep/repo-cli/commands/Refs";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { ReferenceFixture, referenceFixtureLayer, workspace, writeExecutable } from "./refs-test-utils.ts";

// JSON normalizes -0 to 0; schema equivalence compares their numeric value.
const refreshStatusEquivalent = S.toEquivalence(RefsRefreshStatus);
const manifestEquivalent = S.toEquivalence(ReferenceWorkspaceManifest);

const gitStub = `#!/bin/sh
printf 'git %s %s\\n' "\${PWD##*/}" "$*" >> "$HOME/commands.log"
case "$1" in
  status) [ ! -f dirty ] || printf '?? dirty\\n' ;;
  branch) if [ -f current-branch ]; then cat current-branch; elif [ -f off-main ]; then printf 'topic\\n'; else printf 'main\\n'; fi ;;
  rev-parse) [ ! -f rev-parse-fail ] || { printf 'fatal: bad object HEAD\\n' >&2; exit 128; }
    if [ -f advanced ]; then printf 'new-head\\n'; else printf 'old-head\\n'; fi ;;
  pull) [ ! -f pull-fail ] || exit 7; [ ! -f advance ] || touch advanced ;;
  *) exit 99 ;;
esac
exit 0
`;

const prepare = Effect.fn("RefsTest.prepare")(function* () {
  const f = yield* ReferenceFixture;
  yield* writeExecutable(f.path.join(f.bin, "git"), gitStub);
  yield* writeExecutable(
    f.path.join(f.bin, "notify-send"),
    '#!/bin/sh\nprintf "%s\\n" "$*" >> "$HOME/notifications.log"\n'
  );
  return f;
});

describe("reference planning and refresh", () => {
  it.effect.prop(
    "round-trips manifests through the JSON codec",
    [Arbitrary.schema(ReferenceWorkspaceManifest)],
    Effect.fnUntraced(function* ([manifest]) {
      const encoded = yield* ReferenceWorkspaceManifest.encodeJson(manifest);
      const decoded = yield* ReferenceWorkspaceManifest.decodeJson(encoded);
      expect(manifestEquivalent(decoded, manifest)).toBe(true);
    }),
    { arbitrary: fcRuns(100) }
  );

  it.effect(
    "rejects undeclared manifest and member keys through decode",
    Effect.fnUntraced(function* () {
      const manifest = {
        schemaVersion: "beep-references/v1",
        theme: "effect",
        rootDefault: "$HOME/refs",
        workspaceLink: ".repos/effect-workspace",
        members: [{ name: "effect", url: "upstream" }],
      };
      expect((yield* ReferenceWorkspaceManifest.decode(manifest).pipe(Effect.result))._tag).toBe("Success");
      expect(
        (yield* ReferenceWorkspaceManifest.decode({ ...manifest, branch: "topic" }).pipe(Effect.result))._tag
      ).toBe("Failure");
      expect(
        (yield* ReferenceWorkspaceManifest.decode({
          ...manifest,
          members: [{ name: "effect", url: "upstream", revision: "topic" }],
        }).pipe(Effect.result))._tag
      ).toBe("Failure");
    })
  );

  it.effect.prop(
    "round-trips refresh status through the JSON codec",
    [Arbitrary.schema(RefsRefreshStatus)],
    Effect.fnUntraced(function* ([status]) {
      const encoded = yield* RefsRefreshStatus.encodeJson(status);
      const decoded = yield* RefsRefreshStatus.decodeJson(encoded);
      expect(refreshStatusEquivalent(decoded, status)).toBe(true);
    }),
    { arbitrary: fcRuns(100) }
  );

  it.layer(referenceFixtureLayer, { timeout: "30 seconds" })(
    "plans absent members without creating the root or links",
    (it) => {
      it.effect(
        "plans absent members without creating the root or links",
        Effect.fnUntraced(function* () {
          const f = yield* ReferenceFixture;
          const missing = f.path.join(f.temp, "absent");
          const plan = yield* workspace.use((service) => service.plan(f.home, missing));
          expect(plan).toEqual([
            `Reference workspace: ${missing}`,
            `clone git@github.com:Effect-TS/effect.git --branch main -> ${f.path.join(missing, "effect")}`,
            `link ${f.path.join(f.owner, ".repos", "effect")} -> ${f.path.join(missing, "effect")}`,
            `clone git@github.com:Effect-TS/tsgo.git --branch main -> ${f.path.join(missing, "effect-tsgo")}`,
            `link ${f.path.join(f.owner, ".repos", "effect-tsgo")} -> ${f.path.join(missing, "effect-tsgo")}`,
            `link ${f.path.join(f.owner, ".repos/effect-workspace")} -> ${missing}`,
          ]);
          expect(yield* f.fs.exists(missing)).toBe(false);
          expect(yield* f.fs.exists(f.path.join(f.owner, ".repos"))).toBe(false);
        })
      );
    }
  );

  it.layer(referenceFixtureLayer, { timeout: "30 seconds" })(
    "skips dirty and off-main members without pulling either",
    (it) => {
      it.effect(
        "skips dirty and off-main members without pulling either",
        Effect.fnUntraced(function* () {
          const f = yield* prepare();
          for (const [name, marker] of [
            ["effect", "dirty"],
            ["effect-tsgo", "off-main"],
          ]) {
            const directory = f.path.join(f.root, name ?? "");
            yield* f.fs.makeDirectory(f.path.join(directory, ".git"), { recursive: true });
            yield* f.fs.writeFileString(f.path.join(directory, marker ?? ""), "preserve");
          }
          const status = yield* workspace.use((service) => service.refresh(f.home, f.root));
          expect(A.map(status.members, (report) => report.outcome)).toEqual(["skipped-dirty", "skipped-off-branch"]);
          const log = yield* f.fs.readFileString(f.path.join(f.home, "commands.log"));
          expect(log).not.toContain("pull");
          const saved = yield* RefsRefreshStatus.decodeJson(
            yield* f.fs.readFileString(f.path.join(f.home, ".local/state/beep/refs/last-refresh.json"))
          );
          expect(saved.schemaVersion).toBe("beep-refs-refresh/v2");
          expect(saved.members).toEqual(status.members);
          // Skips are policy, not failure: no critical notification fires for them.
          expect(yield* f.fs.exists(f.path.join(f.home, "notifications.log"))).toBe(false);
          // Refresh never writes exclude entries into a member's Git metadata.
          expect(yield* f.fs.exists(f.path.join(f.root, "effect", ".git", "info"))).toBe(false);
        })
      );
    }
  );

  it.layer(referenceFixtureLayer, { timeout: "30 seconds" })(
    "pulls the manifest branch explicitly and preserves a checkout on another branch",
    (it) => {
      it.effect(
        "pulls the manifest branch explicitly and preserves a checkout on another branch",
        Effect.fnUntraced(function* () {
          const f = yield* prepare();
          const manifestFile = f.path.join(f.owner, "scripts/references.json");
          const manifest = yield* ReferenceWorkspaceManifest.decodeJson(yield* f.fs.readFileString(manifestFile));
          const pinned = ReferenceWorkspaceManifest.make({
            ...manifest,
            members: A.map(manifest.members, (member) => ({ ...member, branch: "v2" })),
          });
          yield* f.fs.writeFileString(manifestFile, yield* ReferenceWorkspaceManifest.encodeJson(pinned));
          const absentPlan = A.join(yield* workspace.use((service) => service.plan(f.home, f.root)), "\n");
          expect(absentPlan).toContain("--branch v2");
          for (const member of pinned.members)
            yield* f.fs.makeDirectory(f.path.join(f.root, member.name, ".git"), { recursive: true });
          yield* f.fs.writeFileString(f.path.join(f.root, "effect", "current-branch"), "v2\n");
          const plan = A.join(yield* workspace.use((service) => service.plan(f.home, f.root)), "\n");
          expect(plan).toContain("pull --ff-only origin v2 only if clean and on v2");
          const status = yield* workspace.use((service) => service.refresh(f.home, f.root));
          expect(A.map(status.members, (report) => report.outcome)).toEqual(["unchanged", "skipped-off-branch"]);
          const log = yield* f.fs.readFileString(f.path.join(f.home, "commands.log"));
          expect(log).toContain("git effect pull --ff-only origin v2");
          expect(log).not.toContain("git effect-tsgo pull");
          expect(log).not.toContain("git effect checkout");
          expect(log).not.toContain("git effect-tsgo checkout");
        })
      );
    }
  );

  it.layer(referenceFixtureLayer, { timeout: "30 seconds" })(
    "reports pulled when HEAD advances and unchanged otherwise, without notifying",
    (it) => {
      it.effect(
        "reports pulled when HEAD advances and unchanged otherwise, without notifying",
        Effect.fnUntraced(function* () {
          const f = yield* prepare();
          for (const name of ["effect", "effect-tsgo"])
            yield* f.fs.makeDirectory(f.path.join(f.root, name, ".git"), { recursive: true });
          yield* f.fs.writeFileString(f.path.join(f.root, "effect", "advance"), "");
          const status = yield* workspace.use((service) => service.refresh(f.home, f.root));
          expect(A.map(status.members, (report) => report.outcome)).toEqual(["pulled", "unchanged"]);
          for (const report of status.members) assertNone(report.detail);
          const log = yield* f.fs.readFileString(f.path.join(f.home, "commands.log"));
          expect(log).toBe(
            A.join(
              [
                "git effect status --porcelain --untracked-files=all",
                "git effect branch --show-current",
                "git effect rev-parse HEAD",
                "git effect pull --ff-only origin main",
                "git effect rev-parse HEAD",
                "git effect-tsgo status --porcelain --untracked-files=all",
                "git effect-tsgo branch --show-current",
                "git effect-tsgo rev-parse HEAD",
                "git effect-tsgo pull --ff-only origin main",
                "git effect-tsgo rev-parse HEAD",
                "",
              ],
              "\n"
            )
          );
          const receipt = yield* f.fs.readFileString(f.path.join(f.home, ".local/state/beep/refs/last-refresh.json"));
          const saved = yield* RefsRefreshStatus.decodeJson(receipt);
          expect(refreshStatusEquivalent(saved, status)).toBe(true);
          expect(saved.root).toBe(f.root);
          expect(yield* f.fs.exists(f.path.join(f.home, "notifications.log"))).toBe(false);
        })
      );
    }
  );

  it.layer(referenceFixtureLayer, { timeout: "30 seconds" })(
    "never lets Git walk upward when a member has no Git metadata",
    (it) => {
      it.effect(
        "never lets Git walk upward when a member has no Git metadata",
        Effect.fnUntraced(function* () {
          const f = yield* prepare();
          for (const name of ["effect", "effect-tsgo"]) yield* f.fs.makeDirectory(f.path.join(f.root, name));
          const status = yield* workspace.use((service) => service.refresh(f.home, f.root));
          expect(A.map(status.members, (report) => report.outcome)).toEqual(["pull-failed", "pull-failed"]);
          expect(O.getOrElse(status.members[0]?.detail ?? O.none(), () => "")).toContain("No Git metadata at");
          expect(yield* f.fs.exists(f.path.join(f.home, "commands.log"))).toBe(false);
          expect(yield* f.fs.readFileString(f.path.join(f.home, "notifications.log"))).toContain("--urgency=critical");
        })
      );
    }
  );

  it.layer(referenceFixtureLayer, { timeout: "30 seconds" })(
    "records a pull failure, keeps later reports, and notifies once",
    (it) => {
      it.effect(
        "records a pull failure, keeps later reports, and notifies once",
        Effect.fnUntraced(function* () {
          const f = yield* prepare();
          for (const name of ["effect", "effect-tsgo"])
            yield* f.fs.makeDirectory(f.path.join(f.root, name, ".git"), { recursive: true });
          yield* f.fs.writeFileString(f.path.join(f.root, "effect", "pull-fail"), "");
          const status = yield* workspace.use((service) => service.refresh(f.home, f.root));
          expect(A.map(status.members, (report) => report.outcome)).toEqual(["pull-failed", "unchanged"]);
          assertSome(status.members[0]?.detail ?? O.none(), "git pull --ff-only origin main exited 7");
          const statusPath = f.path.join(f.home, ".local/state/beep/refs/last-refresh.json");
          expect(yield* f.fs.readFileString(f.path.join(f.home, "notifications.log"))).toBe(
            `--urgency=critical beep refs refresh failed See ${statusPath}\n`
          );
        })
      );
    }
  );

  it.layer(referenceFixtureLayer, { timeout: "30 seconds" })(
    "keeps a failed git probe's stderr in the member detail",
    (it) => {
      it.effect(
        "keeps a failed git probe's stderr in the member detail",
        Effect.fnUntraced(function* () {
          const f = yield* prepare();
          for (const name of ["effect", "effect-tsgo"])
            yield* f.fs.makeDirectory(f.path.join(f.root, name, ".git"), { recursive: true });
          yield* f.fs.writeFileString(f.path.join(f.root, "effect", "rev-parse-fail"), "");
          const status = yield* workspace.use((service) => service.refresh(f.home, f.root));
          expect(A.map(status.members, (report) => report.outcome)).toEqual(["pull-failed", "unchanged"]);
          assertSome(status.members[0]?.detail ?? O.none(), "git rev-parse HEAD exited 128: fatal: bad object HEAD");
          expect(yield* f.fs.readFileString(f.path.join(f.home, "commands.log"))).not.toContain("git effect pull");
        })
      );
    }
  );

  it.layer(referenceFixtureLayer, { timeout: "30 seconds" })(
    "records a git that cannot start as a pull failure and still writes the receipt",
    (it) => {
      it.effect(
        "records a git that cannot start as a pull failure and still writes the receipt",
        Effect.fnUntraced(function* () {
          const f = yield* prepare();
          // With git absent from a stub-only PATH the spawn itself fails; nothing exits non-zero.
          yield* f.fs.remove(f.path.join(f.bin, "git"));
          for (const name of ["effect", "effect-tsgo"])
            yield* f.fs.makeDirectory(f.path.join(f.root, name, ".git"), { recursive: true });
          const status = yield* workspace
            .use((service) => service.refresh(f.home, f.root))
            .pipe(
              Effect.provideService(
                ConfigProvider.ConfigProvider,
                ConfigProvider.fromUnknown({ ...f.configValues, PATH: f.bin })
              )
            );
          expect(A.map(status.members, (report) => report.outcome)).toEqual(["pull-failed", "pull-failed"]);
          assertSome(status.members[0]?.detail ?? O.none(), "git failed to run.");
          expect(yield* f.fs.exists(f.path.join(f.home, ".local/state/beep/refs/last-refresh.json"))).toBe(true);
          expect(yield* f.fs.readFileString(f.path.join(f.home, "notifications.log"))).toContain("--urgency=critical");
        })
      );
    }
  );

  it.layer(referenceFixtureLayer, { timeout: "30 seconds" })(
    "resolves the root from the flag, the override, then the manifest default",
    (it) => {
      it.effect(
        "resolves the root from the flag, the override, then the manifest default",
        Effect.fnUntraced(function* () {
          const f = yield* ReferenceFixture;
          const flag = f.path.join(f.temp, "flag-root");
          expect(yield* workspace.use((service) => service.resolveRoot(f.home, O.some(flag)))).toBe(flag);
          expect(yield* workspace.use((service) => service.resolveRoot(f.home, O.none()))).toBe(f.root);
          const fallback = yield* workspace
            .use((service) => service.resolveRoot(f.home, O.none()))
            .pipe(
              Effect.provideService(
                ConfigProvider.ConfigProvider,
                ConfigProvider.fromUnknown({ ...f.configValues, BEEP_REFERENCES_ROOT: "" })
              )
            );
          expect(fallback).toBe(f.path.join(f.home, "YeeBois/references/effect"));
        })
      );
    }
  );

  it.layer(referenceFixtureLayer, { timeout: "30 seconds" })(
    "links members idempotently, replaces stale links, and preserves real files",
    (it) => {
      it.effect(
        "links members idempotently, replaces stale links, and preserves real files",
        Effect.fnUntraced(function* () {
          const f = yield* ReferenceFixture;
          const checkout = f.path.join(f.temp, "checkout");
          const repos = f.path.join(checkout, ".repos");
          yield* f.fs.makeDirectory(repos, { recursive: true });
          yield* f.fs.symlink(f.path.join(f.temp, "stale"), f.path.join(repos, "effect"));
          yield* f.fs.writeFileString(f.path.join(repos, "effect-tsgo"), "operator file");
          const first = yield* workspace.use((service) => service.linkInto(checkout, f.root));
          expect(first).toEqual([
            `.repos/effect -> ${f.path.join(f.root, "effect")}`,
            "warning: .repos/effect-tsgo exists and is not a symlink; preserved",
            `.repos/effect-workspace -> ${f.root}`,
          ]);
          expect(yield* f.fs.readLink(f.path.join(repos, "effect"))).toBe(f.path.join(f.root, "effect"));
          expect(yield* f.fs.readFileString(f.path.join(repos, "effect-tsgo"))).toBe("operator file");
          const second = yield* workspace.use((service) => service.linkInto(checkout, f.root));
          expect(second).toEqual(first);
        })
      );
    }
  );

  it.layer(referenceFixtureLayer, { timeout: "30 seconds" })(
    "refuses a missing root and a symlinked .repos directory",
    (it) => {
      it.effect(
        "refuses a missing root and a symlinked .repos directory",
        Effect.fnUntraced(function* () {
          const f = yield* ReferenceFixture;
          const checkout = f.path.join(f.temp, "checkout");
          yield* f.fs.makeDirectory(checkout, { recursive: true });
          const missing = f.path.join(f.temp, "absent");
          const noRoot = yield* workspace.use((service) => service.linkInto(checkout, missing)).pipe(Effect.flip);
          expect(noRoot.message).toContain(`Reference root is missing: ${missing}`);
          yield* f.fs.makeDirectory(f.path.join(f.temp, "elsewhere"));
          yield* f.fs.symlink(f.path.join(f.temp, "elsewhere"), f.path.join(checkout, ".repos"));
          const redirected = yield* workspace.use((service) => service.linkInto(checkout, f.root)).pipe(Effect.flip);
          expect(redirected.message).toBe("Refusing a symlinked .repos directory.");
          expect(yield* f.fs.readDirectory(f.path.join(f.temp, "elsewhere"))).toEqual([]);
        })
      );
    }
  );

  it.layer(referenceFixtureLayer, { timeout: "30 seconds" })(
    "refuses redirected provisioning before creating a root or starting Git",
    (it) => {
      it.effect(
        "refuses redirected provisioning before creating a root or starting Git",
        Effect.fnUntraced(function* () {
          const f = yield* prepare();
          const checkout = f.path.join(f.temp, "checkout");
          const redirected = f.path.join(f.temp, "redirected");
          const missingRoot = f.path.join(f.temp, "not-provisioned");
          yield* f.fs.makeDirectory(checkout);
          yield* f.fs.makeDirectory(redirected);
          yield* f.fs.symlink(redirected, f.path.join(checkout, ".repos"));
          const error = yield* workspace
            .use((service) => service.provision(f.home, checkout, missingRoot))
            .pipe(Effect.flip);
          expect(error.message).toBe("Refusing a symlinked .repos directory.");
          expect(error.path).toBe(checkout);
          expect(yield* f.fs.exists(missingRoot)).toBe(false);
          expect(yield* f.fs.exists(f.path.join(f.home, "commands.log"))).toBe(false);
          expect(yield* f.fs.readDirectory(redirected)).toEqual([]);
        })
      );
    }
  );

  it.layer(referenceFixtureLayer, { timeout: "30 seconds" })(
    "reports receipt storage failures without replacing the operator's colliding file",
    (it) => {
      it.effect(
        "reports receipt storage failures without replacing the operator's colliding file",
        Effect.fnUntraced(function* () {
          const f = yield* prepare();
          for (const name of ["effect", "effect-tsgo"])
            yield* f.fs.makeDirectory(f.path.join(f.root, name, ".git"), { recursive: true });
          const state = f.path.join(f.home, ".local", "state");
          yield* f.fs.makeDirectory(f.path.dirname(state), { recursive: true });
          yield* f.fs.writeFileString(state, "operator state file");
          const error = yield* workspace.use((service) => service.refresh(f.home, f.root)).pipe(Effect.flip);
          expect(error.message).toBe("Cannot complete reference refresh.");
          expect(error.path).toBe(f.path.join(f.owner, "scripts", "references.json"));
          expect(error.cause).toBeDefined();
          expect(yield* f.fs.readFileString(state)).toBe("operator state file");
          expect(yield* f.fs.exists(f.path.join(f.home, "notifications.log"))).toBe(false);
          const commands = yield* f.fs.readFileString(f.path.join(f.home, "commands.log"));
          expect(commands).toContain("git effect pull --ff-only origin main");
          expect(commands).toContain("git effect-tsgo pull --ff-only origin main");
        })
      );
    }
  );

  it.layer(referenceFixtureLayer, { timeout: "30 seconds" })(
    "preserves written units and the command error when timer activation fails",
    (it) => {
      it.effect(
        "preserves written units and the command error when timer activation fails",
        Effect.fnUntraced(function* () {
          const f = yield* ReferenceFixture;
          yield* writeExecutable(
            f.path.join(f.bin, "systemctl"),
            '#!/bin/sh\nprintf "%s\\n" "$*" >> "$HOME/systemctl.log"\n[ "$2" != "enable" ] || { printf "activation refused\\n"; exit 5; }\n'
          );
          const error = yield* workspace
            .use((service) => service.installTimer(f.home, f.root, "*-*-* 03:30:00", "/bin/bun"))
            .pipe(Effect.flip);
          expect(error.message).toBe("systemctl exited 5: activation refused");
          expect(error.path).toBe(f.home);
          const directory = f.path.join(f.home, ".config", "systemd", "user");
          expect(yield* f.fs.readFileString(f.path.join(directory, "beep-refs-refresh.service"))).toContain(
            `--root "${f.root}"`
          );
          expect(yield* f.fs.readFileString(f.path.join(directory, "beep-refs-refresh.timer"))).toContain(
            "OnCalendar=*-*-* 03:30:00"
          );
          expect(yield* f.fs.readFileString(f.path.join(f.home, "systemctl.log"))).toBe(
            "--user daemon-reload\n--user enable --now beep-refs-refresh.timer\n"
          );
        })
      );
    }
  );

  it.layer(referenceFixtureLayer, { timeout: "30 seconds" })(
    "uninstalls an absent timer without calling systemctl or creating directories",
    (it) => {
      it.effect(
        "uninstalls an absent timer without calling systemctl or creating directories",
        Effect.fnUntraced(function* () {
          const f = yield* ReferenceFixture;
          yield* writeExecutable(
            f.path.join(f.bin, "systemctl"),
            '#!/bin/sh\nprintf "unexpected\\n" >> "$HOME/systemctl.log"\nexit 7\n'
          );
          expect(yield* workspace.use((service) => service.uninstallTimer(f.home))).toEqual([]);
          expect(yield* f.fs.exists(f.path.join(f.home, "systemctl.log"))).toBe(false);
          expect(yield* f.fs.exists(f.path.join(f.home, ".config"))).toBe(false);
        })
      );
    }
  );
});
