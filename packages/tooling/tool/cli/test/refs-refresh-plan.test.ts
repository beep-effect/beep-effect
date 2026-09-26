import { fcRuns } from "@beep/fc-runs";
import { GraftDeepCoverage } from "@beep/repo-cli/commands/Graft";
import { ReferenceWorkspaceManifest, RefsRefreshStatus } from "@beep/repo-cli/commands/Refs";
import { NonNegativeInt } from "@beep/schema/Number";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import { ReferenceFixture, referenceFixtureLayer, workspace, writeExecutable } from "./refs-test-utils.ts";

// JSON normalizes -0 to 0; schema equivalence compares their numeric value.
const refreshStatusEquivalent = S.toEquivalence(RefsRefreshStatus);
const manifestEquivalent = S.toEquivalence(ReferenceWorkspaceManifest);

const gitStub = `#!/bin/sh
printf 'git %s %s\\n' "\${PWD##*/}" "$*" >> "$HOME/commands.log"
case "$1" in
  status) [ ! -f dirty ] || printf '?? dirty\\n' ;;
  branch) if [ -f off-main ]; then printf 'topic\\n'; else printf 'main\\n'; fi ;;
  rev-parse) if [ -f advanced ]; then printf 'new-head\\n'; else printf 'old-head\\n'; fi ;;
  pull) [ ! -f pull-fail ] || exit 7; [ ! -f advance ] || touch advanced ;;
  *) exit 99 ;;
esac
exit 0
`;
const graftStub = `#!/bin/sh
printf 'graft %s %s env=%s\\n' "\${PWD##*/}" "$*" "$GRAFT_NO_GITIGNORE" >> "$HOME/commands.log"
[ ! -f build-fail ] || exit 8
printf 'meaning coverage: 9/10 symbols\\n1 file(s) failed to summarize\\n'
`;

const prepare = Effect.fn("RefsTest.prepare")(function* () {
  const f = yield* ReferenceFixture;
  yield* writeExecutable(f.path.join(f.bin, "git"), gitStub);
  yield* writeExecutable(f.path.join(f.bin, "graft"), graftStub);
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
        members: [{ name: "effect", url: "upstream", tier: "deep" }],
      };
      expect((yield* ReferenceWorkspaceManifest.decode(manifest).pipe(Effect.result))._tag).toBe("Success");
      expect(
        (yield* ReferenceWorkspaceManifest.decode({ ...manifest, branch: "topic" }).pipe(Effect.result))._tag
      ).toBe("Failure");
      expect(
        (yield* ReferenceWorkspaceManifest.decode({
          ...manifest,
          members: [{ name: "effect", url: "upstream", tier: "deep", branch: "topic" }],
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
          expect(A.join(plan, "\n")).toContain("clone git@github.com:Effect-TS/effect.git");
          expect(A.join(plan, "\n")).toContain("--deep --allow-partial -j 16");
          expect(yield* f.fs.exists(missing)).toBe(false);
          expect(yield* f.fs.exists(f.path.join(f.owner, ".repos"))).toBe(false);
        })
      );
    }
  );

  it.layer(referenceFixtureLayer, { timeout: "30 seconds" })(
    "skips dirty and off-main members without pulling or explicitly building either",
    (it) => {
      it.effect(
        "skips dirty and off-main members without pulling or explicitly building either",
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
          const status = yield* workspace.use((service) => service.refresh(f.home, f.root, 3));
          expect(status.members.map((report) => report.outcome)).toEqual(["skipped-dirty", "skipped-off-branch"]);
          const log = yield* f.fs.readFileString(f.path.join(f.home, "commands.log"));
          expect(log).not.toContain("pull");
          expect(log).not.toContain("graft effect ");
          expect(log).not.toContain("graft effect-tsgo ");
          expect(log).toContain("graft references build env=1");
          expect(log).toContain(`check ${f.root}`);
          const saved = yield* RefsRefreshStatus.decodeJson(
            yield* f.fs.readFileString(f.path.join(f.home, ".local/state/beep/refs/last-refresh.json"))
          );
          expect(saved.members).toEqual(status.members);
          // Skips are policy, not failure: no critical notification fires for them.
          expect(yield* f.fs.exists(f.path.join(f.home, "notifications.log"))).toBe(false);
        })
      );
    }
  );

  it.layer(referenceFixtureLayer, { timeout: "30 seconds" })(
    "expands onlyDir, distinguishes deep and structural args, and retains coverage",
    (it) => {
      it.effect(
        "expands onlyDir, distinguishes deep and structural args, and retains coverage",
        Effect.fnUntraced(function* () {
          const f = yield* prepare();
          const manifestFile = f.path.join(f.owner, "scripts/references.json");
          const manifest = yield* ReferenceWorkspaceManifest.decode({
            schemaVersion: "beep-references/v1",
            theme: "effect",
            rootDefault: "$HOME/refs",
            workspaceLink: ".repos/effect-workspace",
            members: [
              { name: "effect", url: "upstream", tier: "deep", onlyDir: ["packages/effect", "packages/platform"] },
              { name: "effect-tsgo", url: "upstream", tier: "structural", onlyDir: ["src"] },
            ],
          });
          yield* f.fs.writeFileString(manifestFile, yield* ReferenceWorkspaceManifest.encodeJson(manifest));
          for (const member of manifest.members)
            yield* f.fs.makeDirectory(f.path.join(f.root, member.name, ".git"), { recursive: true });
          yield* f.fs.writeFileString(f.path.join(f.root, "effect", "advance"), "");
          const status = yield* workspace.use((service) => service.refresh(f.home, f.root, 3));
          expect(status.members.map((report) => report.outcome)).toEqual(["pulled", "unchanged"]);
          const exclude = yield* f.fs.readFileString(f.path.join(f.root, "effect", ".git", "info", "exclude"));
          expect(exclude).toBe("graft/\n.graft/\n.ignore\n");
          const log = yield* f.fs.readFileString(f.path.join(f.home, "commands.log"));
          expect(log).toContain(
            "graft effect build --deep --allow-partial -j 3 --only-dir packages/effect --only-dir packages/platform env=1"
          );
          expect(log).toContain("graft effect-tsgo build --only-dir src env=1");
          assertSome(
            status.members[0]?.coverage ?? O.none(),
            GraftDeepCoverage.make({
              covered: NonNegativeInt.make(9),
              total: NonNegativeInt.make(10),
              failedFiles: NonNegativeInt.make(1),
            })
          );
          assertNone(status.members[1]?.coverage ?? O.none());
          expect(yield* f.fs.readFileString(f.path.join(f.home, "notifications.log"))).toContain("--urgency=critical");
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
          const status = yield* workspace.use((service) => service.refresh(f.home, f.root, 2));
          expect(status.members.map((report) => report.outcome)).toEqual(["pull-failed", "pull-failed"]);
          expect(yield* f.fs.readFileString(f.path.join(f.home, "commands.log"))).not.toContain("git ");
        })
      );
    }
  );

  it.layer(referenceFixtureLayer, { timeout: "30 seconds" })(
    "records pull and build failures without losing later reports",
    (it) => {
      it.effect(
        "records pull and build failures without losing later reports",
        Effect.fnUntraced(function* () {
          const f = yield* prepare();
          for (const [name, marker] of [
            ["effect", "pull-fail"],
            ["effect-tsgo", "build-fail"],
          ]) {
            yield* f.fs.makeDirectory(f.path.join(f.root, name ?? "", ".git"), { recursive: true });
            yield* f.fs.writeFileString(f.path.join(f.root, name ?? "", marker ?? ""), "");
          }
          const status = yield* workspace.use((service) => service.refresh(f.home, f.root, 2));
          expect(status.members.map((report) => report.outcome)).toEqual(["pull-failed", "build-failed"]);
          expect(yield* f.fs.exists(f.path.join(f.home, "notifications.log"))).toBe(true);
        })
      );
    }
  );
});
