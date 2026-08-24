import { MarkerEvent, RoundLayout } from "@beep/qa-capture";
import {
  CitedArtifactExistsGate,
  CitedArtifactExistsInput,
  CitedArtifactExistsVerdict,
  citedArtifactVerdictToCrossCheck,
  crossCheckAgainstRound,
  crossCheckEvidence,
  evaluateCitedArtifactExists,
  QaEventLog,
  QaFindingId,
  QaInventory,
  QaJudgeRef,
  raiseCrossCheckFailure,
  renderCrossCheckFailure,
} from "@beep/repo-cli/commands/Qa";
import { provideScopedLayer } from "@beep/test-utils";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit, FileSystem, HashSet, Layer, Path } from "effect";
import * as O from "effect/Option";

const PlatformLayer = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);

const withTempDir = <A, E, R>(use: (dir: string) => Effect.Effect<A, E, R>) =>
  Effect.acquireUseRelease(
    Effect.flatMap(FileSystem.FileSystem, (fs) => fs.makeTempDirectory({ prefix: "beep-qa-gate-parity-" })),
    use,
    (dir) => Effect.flatMap(FileSystem.FileSystem, (fs) => fs.remove(dir, { recursive: true }).pipe(Effect.orDie))
  ).pipe(provideScopedLayer(PlatformLayer));

const layoutFor = (root: string): RoundLayout =>
  RoundLayout.make({
    clipsDir: `${root}/clips`,
    eventsPath: `${root}/events.ndjson`,
    framesDir: `${root}/frames`,
    reportPath: `${root}/report.md`,
    root,
    round: 1,
    sessionPath: `${root}/session.json`,
    sheetsDir: `${root}/sheets`,
    videoDir: `${root}/video`,
  });

const missingPathsOf = (verdict: CitedArtifactExistsVerdict): ReadonlyArray<string> =>
  CitedArtifactExistsVerdict.match(verdict, {
    allowed: () => [],
    denied: ({ audit }) => audit.detail.missingPaths,
  });

describe("commands/Qa cited-artifact typed gate parity", () => {
  it.effect("accepts absolute in-root files and rejects aliases, escapes, non-files, and missing leaves", () =>
    withTempDir(
      Effect.fnUntraced(function* (parent) {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const roundRoot = path.join(parent, "round-1");
        const framesDir = path.join(roundRoot, "frames");
        const realFile = path.join(framesDir, "real.png");
        const inRootAlias = path.join(framesDir, "alias.png");
        const outsideFile = path.join(parent, "outside.png");
        const escapingAlias = path.join(framesDir, "escape.png");
        yield* fs.makeDirectory(framesDir, { recursive: true });
        yield* fs.makeDirectory(path.join(framesDir, "directory.png"));
        yield* fs.writeFileString(realFile, "frame");
        yield* fs.writeFileString(outsideFile, "outside");
        yield* fs.symlink(realFile, inRootAlias);
        yield* fs.symlink(outsideFile, escapingAlias);

        const input = CitedArtifactExistsInput.make({
          citedPaths: ["frames/alias.png", realFile, "frames/directory.png", "frames/escape.png", "frames/missing.png"],
          roundRoot,
        });
        const exit = yield* Effect.exit(evaluateCitedArtifactExists(input));
        const verdict = yield* evaluateCitedArtifactExists(input);

        expect(Exit.isSuccess(exit)).toBe(true);
        expect(verdict.verdict).toBe("denied");
        expect(verdict.audit.detail.checkedPaths).toEqual(input.citedPaths);
        expect(missingPathsOf(verdict)).toEqual([
          "frames/alias.png",
          "frames/directory.png",
          "frames/escape.png",
          "frames/missing.png",
        ]);
      })
    )
  );

  it.effect("falls back to the lexical root and returns denial when the canonical root cannot resolve", () =>
    withTempDir(
      Effect.fnUntraced(function* (parent) {
        const path = yield* Path.Path;
        const root = path.join(parent, "missing-round");
        const input = CitedArtifactExistsInput.make({
          citedPaths: ["frames/ghost.png"],
          roundRoot: root,
        });
        const exit = yield* Effect.exit(evaluateCitedArtifactExists(input));
        const verdict = yield* evaluateCitedArtifactExists(input);

        expect(Exit.isSuccess(exit)).toBe(true);
        expect(verdict.verdict).toBe("denied");
        expect(missingPathsOf(verdict)).toEqual(["frames/ghost.png"]);
      })
    )
  );

  it.effect("matches the legacy aggregate, citation ordering, renderer, and error channel", () =>
    withTempDir(
      Effect.fnUntraced(function* (root) {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        yield* fs.makeDirectory(path.join(root, "frames"), { recursive: true });
        yield* fs.writeFileString(path.join(root, "frames", "real.png"), "frame");
        const inventory = QaInventory.make({
          findings: [
            {
              evidence: [
                { eventIds: [9, 2], frameRange: O.none(), kind: "strip", path: "frames/z-missing.png" },
                { eventIds: [2], frameRange: O.none(), kind: "frame", path: "frames/real.png" },
              ],
              fix: "Capture the missing artifact.",
              id: QaFindingId.make("R1-01"),
              lens: "selection-smear",
              repro: "Drag the sash.",
              resolvedInRound: O.none(),
              severity: "P0",
              title: "Missing evidence",
            },
            {
              evidence: [
                { eventIds: [7, 9], frameRange: O.none(), kind: "sheet", path: "frames/a-missing.png" },
                { eventIds: [9], frameRange: O.none(), kind: "strip", path: "frames/z-missing.png" },
              ],
              fix: "Capture the other artifact.",
              id: QaFindingId.make("R1-02"),
              lens: "drag-ghost",
              repro: "Drag again.",
              resolvedInRound: O.none(),
              severity: "P2",
              title: "Other missing evidence",
            },
          ],
          judge: QaJudgeRef.make({ effort: "high", model: "gpt-5.6-sol" }),
          requiredCount: 1,
          round: 1,
          schemaVersion: "qa-inventory/v1",
          sessionRef: "session.json",
        });
        const eventLog = QaEventLog.make({
          events: [
            MarkerEvent.make({
              kind: "marker",
              label: "scenario:parity",
              seq: 2,
              tEpochMs: 1_754_000_000_000,
            }),
          ],
          rejectedCount: 0,
        });
        const legacy = crossCheckEvidence(inventory, HashSet.make("frames/real.png"), HashSet.make(2));
        const projected = yield* crossCheckAgainstRound(layoutFor(root), inventory, eventLog);
        const rendered = renderCrossCheckFailure(1, projected);
        const error = yield* raiseCrossCheckFailure(1, projected).pipe(Effect.flip);

        expect(projected).toEqual(legacy);
        expect(projected.missingPaths).toEqual(["frames/z-missing.png", "frames/a-missing.png"]);
        expect(projected.missingEventIds).toEqual([9, 7]);
        expect(rendered).toBe(
          "qa judge inventory for round 1 cites evidence the round cannot back up.\n" +
            "  missing artifact: frames/z-missing.png\n" +
            "  missing artifact: frames/a-missing.png\n" +
            "  missing event id: 9\n" +
            "  missing event id: 7"
        );
        expect(error.message).toBe(rendered);
      })
    )
  );

  it("projects allowed and denied verdicts without audit-field loss affecting the legacy shape", () => {
    const gateId = CitedArtifactExistsGate.id;
    const allowed = CitedArtifactExistsVerdict.cases.allowed.make({
      audit: {
        detail: { checkedPaths: ["frames/real.png"] },
        evaluator: "qa",
        gateId,
        occurredAt: "2026-08-24T00:00:00.000Z",
        outcome: "allowed",
        reason: "The artifact exists.",
      },
    });
    const denied = CitedArtifactExistsVerdict.cases.denied.make({
      audit: {
        detail: { checkedPaths: ["frames/ghost.png"], missingPaths: ["frames/ghost.png"] },
        evaluator: "qa",
        gateId,
        occurredAt: "2026-08-24T00:00:00.000Z",
        outcome: "denied",
        reason: "The artifact is missing.",
      },
    });

    expect(citedArtifactVerdictToCrossCheck(allowed, [5])).toEqual({ missingEventIds: [5], missingPaths: [] });
    expect(citedArtifactVerdictToCrossCheck([5])(denied)).toEqual({
      missingEventIds: [5],
      missingPaths: ["frames/ghost.png"],
    });
  });
});
