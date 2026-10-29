import {
  initializeObservationClaims,
  makeObservationClaims,
  ObservationClaimAnchor,
  ObservationClaimPolicy,
} from "@beep/repo-ai-metrics/observation-launch-claims";
import { ObservationLaunchFact } from "@beep/repo-ai-metrics/observation-launch-facts";
import { ObservationLaunchSubmission } from "@beep/repo-ai-metrics/observation-launch-http";
import { it } from "@beep/test-runner";
import { provideScopedLayer } from "@beep/test-utils/Layer";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as PlatformError from "effect/PlatformError";
import * as Ref from "effect/Ref";
import { claimFileFault } from "./fixtures/claim-file-fault.ts";
import {
  claimFixture as fixture,
  claimId as id,
  claimSubmission as submission,
} from "./fixtures/observation-claims.ts";

it.effect("consumes one attempt across service reopen and epochs, even when its operation fails", () =>
  Effect.gen(function* () {
    const f = yield* fixture();
    const claims = yield* makeObservationClaims(f.policy, f.uid);
    const count = yield* Ref.make(0);
    expect(
      yield* claims
        .runOnce(submission(), () =>
          Ref.update(count, (n) => n + 1).pipe(Effect.andThen(Effect.fail("synthetic-operation-failed")))
        )
        .pipe(Effect.flip)
    ).toBe("synthetic-operation-failed");
    const reopened = yield* makeObservationClaims(f.policy, f.uid);
    expect(
      (yield* reopened.runOnce(submission(), () => Ref.update(count, (n) => n + 1)).pipe(Effect.flip)).reason
    ).toBe("claimed");
    expect(
      (yield* reopened
        .runOnce(ObservationLaunchSubmission.make({ ...submission(), evidenceEpoch: 1 }), () => Effect.void)
        .pipe(Effect.flip)).reason
    ).toBe("claimed");
    expect(yield* Ref.get(count)).toBe(1);
    expect((yield* reopened.snapshot)[0]?.submission).toEqual(submission());
  }).pipe(Effect.scoped, provideScopedLayer(NodeServices.layer))
);

it.effect("permits at most one concurrent owner and never exceeds fixed claim capacity", () =>
  Effect.gen(function* () {
    const f = yield* fixture(1);
    const left = yield* makeObservationClaims(f.policy, f.uid);
    const right = yield* makeObservationClaims(f.policy, f.uid);
    const count = yield* Ref.make(0);
    yield* Effect.all(
      [
        left.runOnce(submission(), () => Ref.update(count, (n) => n + 1)).pipe(Effect.exit),
        right.runOnce(submission(), () => Ref.update(count, (n) => n + 1)).pipe(Effect.exit),
      ],
      { concurrency: 2 }
    );
    expect(yield* Ref.get(count)).toBe(1);
    expect((yield* left.snapshot).length).toBe(1);
    expect(
      (yield* right.runOnce(submission("2"), () => Ref.update(count, (n) => n + 1)).pipe(Effect.flip)).reason
    ).toBe("capacity");
    expect(yield* Ref.get(count)).toBe(1);
  }).pipe(Effect.scoped, provideScopedLayer(NodeServices.layer))
);

it.effect("preserves claims when unrelated collector state is replaced with older data", () =>
  Effect.gen(function* () {
    const f = yield* fixture();
    const journal = `${f.policy.journalDirectory}/journal.sqlite`;
    // Storage-separation unit proof; real SQLite restore is qualified separately.
    yield* f.fs.writeFileString(journal, "synthetic-older-collector-state");
    const old = yield* f.fs.readFileString(journal);
    const claims = yield* makeObservationClaims(f.policy, f.uid);
    yield* claims.runOnce(submission(), () => Effect.void);
    yield* f.fs.writeFileString(journal, "synthetic-newer-collector-state");
    yield* f.fs.writeFileString(journal, old);
    const reopened = yield* makeObservationClaims(f.policy, f.uid);
    expect((yield* reopened.runOnce(submission(), () => Effect.die("Duplicate launch")).pipe(Effect.flip)).reason).toBe(
      "claimed"
    );
  }).pipe(Effect.scoped, provideScopedLayer(NodeServices.layer))
);

it.effect("refuses torn claims, exposed files, substituted roots and changed enrollment", () =>
  Effect.gen(function* () {
    const f = yield* fixture();
    const claims = yield* makeObservationClaims(f.policy, f.uid);
    yield* f.fs.writeFileString(`${f.policy.directory}/claim-0.json`, "", { mode: 0o600 });
    expect((yield* claims.runOnce(submission(), () => Effect.die("Unsafe launch")).pipe(Effect.flip)).reason).toBe(
      "integrity"
    );
    yield* f.fs.chmod(`${f.policy.directory}/anchor.json`, 0o644);
    expect((yield* makeObservationClaims(f.policy, f.uid).pipe(Effect.flip)).reason).toBe("integrity");
    yield* f.fs.chmod(`${f.policy.directory}/anchor.json`, 0o600);
    expect(
      (yield* makeObservationClaims(
        ObservationClaimPolicy.make({
          ...f.policy,
          anchor: ObservationClaimAnchor.make({ ...f.policy.anchor, fenceId: id("f") }),
        }),
        f.uid
      ).pipe(Effect.flip)).reason
    ).toBe("configuration");
    yield* f.fs.rename(f.policy.directory, `${f.root}/retained-claims`);
    yield* f.fs.makeDirectory(f.policy.directory, { mode: 0o700 });
    expect((yield* claims.snapshot.pipe(Effect.flip)).reason).toBe("configuration");
    expect((yield* initializeObservationClaims(f.policy, f.uid).pipe(Effect.flip)).reason).toBe("storage");
  }).pipe(Effect.scoped, provideScopedLayer(NodeServices.layer))
);

it.effect("refuses overlapping directories, missing stores and non-Prepared submissions", () =>
  Effect.gen(function* () {
    const f = yield* fixture();
    for (const directory of [f.policy.journalDirectory, `${f.policy.journalDirectory}/nested`, f.root]) {
      expect(
        (yield* makeObservationClaims(ObservationClaimPolicy.make({ ...f.policy, directory }), f.uid).pipe(Effect.flip))
          .reason
      ).toBe("configuration");
    }
    const claims = yield* makeObservationClaims(f.policy, f.uid);
    expect(
      (yield* claims
        .runOnce(
          ObservationLaunchSubmission.make({
            ...submission(),
            fact: ObservationLaunchFact.cases.Started.make({ launchId: id("1"), processInstanceId: id("2") }),
          }),
          () => Effect.die("Unsafe launch")
        )
        .pipe(Effect.flip)).reason
    ).toBe("configuration");
    expect((yield* claims.snapshot).length).toBe(0);
    yield* f.fs.rename(f.policy.directory, `${f.root}/preserved`);
    expect((yield* makeObservationClaims(f.policy, f.uid).pipe(Effect.flip)).reason).toBe("storage");
    expect(yield* f.fs.exists(f.policy.directory)).toBe(false);
  }).pipe(Effect.scoped, provideScopedLayer(NodeServices.layer))
);

for (const phase of ["file", "directory"] as const) {
  it.effect(`does not run an operation after ${phase} synchronization fails and retains the claim`, () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const injected = PlatformError.systemError({
        _tag: "Unknown",
        module: "test",
        method: "sync",
        description: "PRIVATE-SYNC-CANARY",
      });
      const fs: FileSystem.FileSystem = {
        ...f.fs,
        open: (file, options) =>
          f.fs
            .open(file, options)
            .pipe(
              Effect.map((handle) =>
                file === (phase === "file" ? `${f.policy.directory}/claim-0.json` : f.policy.directory)
                  ? claimFileFault({ handle, sync: Effect.fail(injected) })
                  : handle
              )
            ),
      };
      const claims = yield* makeObservationClaims(f.policy, f.uid).pipe(
        Effect.provideService(FileSystem.FileSystem, fs)
      );
      const error = yield* claims
        .runOnce(submission(), () => Effect.die("Unsafe launch"))
        .pipe(Effect.provideService(FileSystem.FileSystem, fs), Effect.flip);
      expect(error.reason).toBe("storage");
      const reopened = yield* makeObservationClaims(f.policy, f.uid);
      expect(
        (yield* reopened.runOnce(submission(), () => Effect.die("Duplicate launch")).pipe(Effect.flip)).reason
      ).toBe("claimed");
    }).pipe(Effect.scoped, provideScopedLayer(NodeServices.layer))
  );
}
