import { ObservationInventory, summarizeObservationInventory } from "@beep/repo-ai-metrics/observation-inventory";
import {
  ObservationRootDeclaration,
  ObservationRootProbeResult,
  probeObservationRoots,
  readObservationRootDeclaration,
} from "@beep/repo-ai-metrics/observation-root-probe";
import { hashPrivateIdentifier, hashPublicTextSha256 } from "@beep/repo-ai-metrics/privacy";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as PlatformError from "effect/PlatformError";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";

const salt = Redacted.make("synthetic-root-probe-salt");
const start = DateTime.makeUnsafe("2026-10-27T10:00:00Z");
const end = DateTime.makeUnsafe("2026-10-27T11:00:00Z");
const declaration = (roots: ObservationRootDeclaration["roots"], hostKey = "synthetic-host-private-label") =>
  ObservationRootDeclaration.make({ hostKey, roots, populationWindowStart: start, populationWindowEnd: end });
const temp = FileSystem.FileSystem.use((fs) =>
  Effect.acquireRelease(fs.makeTempDirectory(), (directory) =>
    fs.remove(directory, { recursive: true, force: true }).pipe(Effect.orDie)
  )
);
const git = Effect.fn("RootProbeTest.git")(function* (cwd: string, args: ReadonlyArray<string>) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  expect(
    yield* spawner.exitCode(
      ChildProcess.make("git", ["-c", "commit.gpgsign=false", "-c", "core.hooksPath=/dev/null", ...args], {
        cwd,
        stdout: "ignore",
        stderr: "ignore",
        env: { GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" },
      })
    )
  ).toBe(0);
});
const init = Effect.fn("RootProbeTest.init")(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.makeDirectory(root);
  yield* git(root, ["init", "-q", "."]);
  yield* git(root, [
    "-c",
    "user.name=Fixture",
    "-c",
    "user.email=fixture@example.invalid",
    "commit",
    "--allow-empty",
    "-qm",
    "fixture",
  ]);
  yield* git(root, [
    "remote",
    "add",
    "origin",
    "https://synthetic-user:synthetic-secret@example.invalid/project.git?access=synthetic-token",
  ]);
});
const failureText = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(Effect.matchCause({ onFailure: Cause.pretty, onSuccess: () => "unexpected success" }));

it.layer(NodeServices.layer, { concurrent: false, timeout: "20 seconds" })("declared root inventory producer", (it) => {
  it.effect("observes clones and worktrees with evidence while all harness populations stay unknown", () =>
    Effect.gen(function* () {
      yield* end.pipe(DateTime.toEpochMillis, TestClock.setTime);
      const directory = yield* temp;
      const primary = `${directory}/clone`;
      const independent = `${directory}/independent`;
      const linked = `${directory}/linked`;
      yield* init(primary);
      yield* init(independent);
      yield* git(primary, ["worktree", "add", "-q", "--detach", linked]);
      const result = yield* probeObservationRoots(
        declaration([
          { path: primary, state: "inspect" },
          { path: linked, state: "inspect" },
          { path: independent, state: "inspect" },
          { path: `${directory}/retired`, state: "retired" },
          { path: `${directory}/missing`, state: "inspect" },
        ]),
        salt
      );
      const [a, b, c, retired, missing] = result.inventory.roots;
      expect(a?.rootId).toBe(`root-${yield* hashPrivateIdentifier(primary, O.some(Redacted.value(salt)))}`);
      expect(a?.cloneId._tag).toBe("Verified");
      if (a?.cloneId._tag !== "Verified" || b?.cloneId._tag !== "Verified" || c?.cloneId._tag !== "Verified")
        throw new Error("Expected verified fixture identities");
      expect(a.cloneId.id).toBe(b.cloneId.id);
      expect(a.cloneId.id).not.toBe(c.cloneId.id);
      expect(a.repositoryId).toMatchObject({ _tag: "Verified" });
      if (a.repositoryId._tag !== "Verified" || c.repositoryId._tag !== "Verified")
        throw new Error("Expected repository identity");
      expect(a.repositoryId.id).toBe(c.repositoryId.id);
      expect(a.worktreeId).not.toEqual(b.worktreeId);
      expect(retired?.availability).toBe("retired");
      expect(missing?.availability).toBe("unreachable");
      expect(retired?.cloneId._tag).toBe("Unknown");
      expect(missing?.cloneId._tag).toBe("Unknown");
      for (const receipt of result.rootReceipts) {
        const encoded = yield* S.encodeEffect(S.fromJsonString(S.Unknown))(receipt.observation);
        expect(receipt.evidenceId).toBe(yield* hashPublicTextSha256(encoded));
      }
      const counts = summarizeObservationInventory(result.inventory);
      expect(counts).toMatchObject({
        hosts: 1,
        roots: 5,
        declaredRoutes: 7,
        supportedRoutes: 0,
        knownLaunches: 0,
        unknownLaunchRoutes: 7,
        expectedEvents: 0,
        unknownEventRoutes: 7,
      });
      expect(
        A.every(result.inventory.routes, (route) => route.transport === "unknown" && route.root._tag === "Unknown")
      ).toBe(true);
      const encoded = yield* S.encodeEffect(S.fromJsonString(ObservationRootProbeResult))(result);
      for (const privateValue of [
        directory,
        "synthetic-host-private-label",
        "synthetic-root-probe-salt",
        "synthetic-secret",
        "synthetic-token",
        "example.invalid",
      ])
        expect(encoded).not.toContain(privateValue);
      yield* S.decodeEffect(S.fromJsonString(ObservationInventory))(
        yield* S.encodeEffect(S.fromJsonString(ObservationInventory))(result.inventory)
      );
    })
  );
  it.effect("never accesses retired paths and keeps non-Git and permission failures explicit", () =>
    Effect.gen(function* () {
      yield* end.pipe(DateTime.toEpochMillis, TestClock.setTime);
      const fs = yield* FileSystem.FileSystem;
      const directory = yield* temp;
      const accesses = yield* Ref.make<ReadonlyArray<string>>([]);
      const result = yield* probeObservationRoots(
        declaration([
          { path: `${directory}/retired`, state: "retired" },
          { path: directory, state: "inspect" },
          { path: `${directory}/denied`, state: "inspect" },
        ]),
        salt
      ).pipe(
        Effect.provideService(
          FileSystem.FileSystem,
          FileSystem.make({
            ...fs,
            stat: (path) =>
              Ref.update(accesses, A.append(path)).pipe(
                Effect.andThen(
                  Str.endsWith("/denied")(path)
                    ? Effect.fail(
                        PlatformError.systemError({
                          _tag: "PermissionDenied",
                          module: "FileSystem",
                          method: "stat",
                          description: "Synthetic denial",
                        })
                      )
                    : fs.stat(path)
                )
              ),
          })
        )
      );
      expect(yield* Ref.get(accesses)).not.toContain(`${directory}/retired`);
      expect(result.inventory.roots[0]?.availability).toBe("retired");
      expect(result.inventory.roots[1]?.availability).toBe("present");
      expect(result.inventory.roots[1]?.cloneId._tag).toBe("Unknown");
      expect(result.inventory.roots[2]?.availability).toBe("unreachable");
    })
  );
  it.effect("rejects relative/duplicate roots, future windows and blank salts without exposing input", () =>
    Effect.gen(function* () {
      yield* end.pipe(DateTime.toEpochMillis, TestClock.setTime);
      for (const roots of [
        [{ path: "synthetic-private-relative", state: "inspect" }],
        [
          { path: "/synthetic-private/../root", state: "retired" },
          { path: "/root", state: "retired" },
        ],
      ] satisfies ReadonlyArray<ObservationRootDeclaration["roots"]>) {
        const failure = yield* failureText(probeObservationRoots(declaration(roots), salt));
        expect(failure).not.toBe("unexpected success");
        expect(failure).not.toContain("synthetic-private");
      }
      const missingSalt = yield* failureText(probeObservationRoots(declaration([]), Redacted.make(" ")));
      expect(missingSalt).toContain("nonblank identity hash salt");
      yield* start.pipe(DateTime.toEpochMillis, TestClock.setTime);
      expect(yield* failureText(probeObservationRoots(declaration([]), salt))).not.toBe("unexpected success");
    })
  );
  it.effect("keeps host identities stable and scopes equal checkout paths across hosts", () =>
    Effect.gen(function* () {
      yield* end.pipe(DateTime.toEpochMillis, TestClock.setTime);
      const roots = [
        { path: "/synthetic-retired-root", state: "retired" },
      ] satisfies ObservationRootDeclaration["roots"];
      const first = yield* probeObservationRoots(declaration(roots, "host-a"), salt);
      const again = yield* probeObservationRoots(declaration(roots, "host-a"), salt);
      const second = yield* probeObservationRoots(declaration(roots, "host-b"), salt);
      expect(first.inventory.hosts).toEqual(again.inventory.hosts);
      expect(first.inventory.hosts).not.toEqual(second.inventory.hosts);
      expect(first.inventory.roots[0]?.rootId).toBe(second.inventory.roots[0]?.rootId);
      expect(first.inventory.roots[0]?.hostId).not.toBe(second.inventory.roots[0]?.hostId);
    })
  );
  it.effect("bounds and validates the private declaration before probing", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const directory = yield* temp;
      const path = `${directory}/private.json`;
      yield* fs.writeFileString(path, Str.repeat(65_537)("x"));
      expect(yield* failureText(readObservationRootDeclaration(path))).toContain("exceeds its byte limit");
      yield* fs.writeFile(path, new Uint8Array([0xff]));
      expect(yield* failureText(readObservationRootDeclaration(path))).toContain("Invalid root declaration encoding");
      const original = yield* S.encodeEffect(S.fromJsonString(ObservationRootDeclaration))(declaration([]));
      yield* fs.writeFileString(path, Str.replace('"roots":[]', '"roots":[],"private":"synthetic-secret"')(original));
      const rejected = yield* failureText(readObservationRootDeclaration(path));
      expect(rejected).toContain("Invalid root declaration");
      expect(rejected).not.toContain("synthetic-secret");
      expect(rejected).not.toContain(directory);
    })
  );
});
