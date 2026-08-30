import { renderTmpfsReportLinesForTesting } from "@beep/repo-cli/test/Quality";
import { TmpfsReapCandidate, TmpfsReapReport } from "@beep/repo-cli/test/RepoRun";
import { describe, expect, it } from "@effect/vitest";
import { pipe } from "effect";

const report = TmpfsReapReport.make({
  scannedAt: "2026-08-30T12:00:00.000Z",
  tmpRoot: "/tmp",
  tmpRoots: ["/tmp", "/scratch"],
  applied: false,
  candidates: [
    TmpfsReapCandidate.make({
      root: "/scratch",
      path: "/scratch/beep-knowledge-refs-old",
      reapClass: "scoped-temp",
      ageHours: 3.25,
      refCount: 2,
      action: "skip",
      skipReason: "live-fd-ref",
      bytes: 4096,
    }),
  ],
  reapedCount: 0,
  reclaimedBytes: 0,
  warnings: ["fixture warning"],
});

describe("tmpfs reap quality rendering", () => {
  it("renders scratch roots and complete candidate evidence", () => {
    const lines = renderTmpfsReportLinesForTesting(report, false);

    expect(lines).toEqual([
      "TMPFS REAP DRY RUN — nothing will be removed; pass --apply to reap eligible artifacts",
      "scratch roots: /tmp, /scratch",
      "- skip class=scoped-temp root=/scratch age=3.3h refs=2 bytes=4096 reason=live-fd-ref /scratch/beep-knowledge-refs-old",
      "totals: candidates=1 reaped=0 reclaimed-bytes=0",
      "warning: fixture warning",
    ]);
  });

  it("falls back to the legacy root and supports the pipeable apply form", () => {
    const legacy = TmpfsReapReport.make({ ...report, tmpRoots: undefined, candidates: [], warnings: [] });
    const lines = pipe(legacy, renderTmpfsReportLinesForTesting(true));

    expect(lines[0]).toBe("TMPFS REAP APPLY — removing only classified, idle artifacts with zero live references");
    expect(lines[1]).toBe("scratch roots: /tmp");
  });
});
