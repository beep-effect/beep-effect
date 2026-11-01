import {
  initializeObservationClaims,
  ObservationClaimAnchor,
  ObservationClaimPolicy,
} from "@beep/repo-ai-metrics/observation-launch-claims";
import { ObservationLaunchFact, ObservationLaunchIdentity } from "@beep/repo-ai-metrics/observation-launch-facts";
import { ObservationLaunchSubmission } from "@beep/repo-ai-metrics/observation-launch-http";
import { Sha256Hex } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Str from "effect/String";

export const claimId = (digit: string) => Sha256Hex.make(Str.repeat(64)(digit));
export const claimSubmission = (digit = "1") =>
  ObservationLaunchSubmission.make({
    hostId: claimId("a"),
    namespaceId: claimId("b"),
    evidenceEpoch: 0,
    fact: ObservationLaunchFact.cases.Prepared.make({
      launchId: claimId(digit),
      identity: ObservationLaunchIdentity.make({
        routeId: claimId("c"),
        harness: "codex-cli",
        surface: "cli",
        root: { _tag: "Unknown" },
        repository: { _tag: "Unknown" },
        clone: { _tag: "Unknown" },
        worktree: { _tag: "Unknown" },
        task: { _tag: "Unknown" },
        attempt: { _tag: "Unknown" },
        evidenceId: claimId("d"),
      }),
    }),
  });
export const claimFixture = Effect.fn("ClaimTest.fixture")(function* (maxClaims = 2) {
  const fs = yield* FileSystem.FileSystem;
  const root = yield* fs.makeTempDirectoryScoped({ directory: "/tmp", prefix: "obs-claim-" });
  yield* fs.chmod(root, 0o700);
  const journalDirectory = `${root}/journal`;
  yield* fs.makeDirectory(journalDirectory, { mode: 0o700 });
  const policy = ObservationClaimPolicy.make({
    directory: `${root}/claims`,
    journalDirectory,
    anchor: ObservationClaimAnchor.make({
      fenceId: claimId("e"),
      hostId: claimId("a"),
      namespaceId: claimId("b"),
      maxClaims,
    }),
  });
  const uid = process.geteuid?.() ?? -1;
  yield* initializeObservationClaims(policy, uid);
  return { fs, root, policy, uid };
});
