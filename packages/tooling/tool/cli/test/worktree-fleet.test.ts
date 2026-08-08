import {
  buildContestedIndex,
  classifyFleetLiveness,
  FLEET_LIVENESS_WINDOW_SECONDS,
  FleetLivenessReadings,
  parseMergeTreeConflictNames,
  parseStatusPorcelainZ,
  transcriptProjectDirName,
} from "@beep/repo-cli/commands/Worktree";
import { describe, expect, it } from "@effect/vitest";

const FRESH_SECONDS = 30;
const STALE_SECONDS = FLEET_LIVENESS_WINDOW_SECONDS * 2;

/**
 * Complete negatives: a complete process scan with no match, an absent
 * transcript, and a measured worktree mtime older than the window. This is the
 * only shape that may classify as `dormant`, so every other case overrides one
 * field of it.
 */
const readings = (overrides: Partial<FleetLivenessReadings>): FleetLivenessReadings =>
  FleetLivenessReadings.make({
    processMatches: 0,
    processScanComplete: true,
    transcript: { _tag: "absent" },
    worktreeMtime: { _tag: "measured", ageSeconds: STALE_SECONDS },
    ...overrides,
  });

describe("classifyFleetLiveness", () => {
  it("reports unknown, never dormant, when an unreadable /proc entry left the scan incomplete", () => {
    expect(classifyFleetLiveness(readings({ processScanComplete: false }))).toEqual({
      status: "unknown",
      evidence: [],
    });
  });

  it("reports dormant only when every probe measured a negative", () => {
    expect(classifyFleetLiveness(readings({}))).toEqual({ status: "dormant", evidence: [] });
  });

  it("reports live from the process-cwd probe alone", () => {
    expect(classifyFleetLiveness(readings({ processMatches: 1 }))).toEqual({
      status: "live",
      evidence: ["process-cwd"],
    });
  });

  it("reports live from the transcript-mtime probe alone", () => {
    expect(classifyFleetLiveness(readings({ transcript: { _tag: "measured", ageSeconds: FRESH_SECONDS } }))).toEqual({
      status: "live",
      evidence: ["transcript-mtime"],
    });
  });

  it("reports live from the worktree-mtime probe alone", () => {
    expect(classifyFleetLiveness(readings({ worktreeMtime: { _tag: "measured", ageSeconds: FRESH_SECONDS } }))).toEqual(
      { status: "live", evidence: ["worktree-mtime"] }
    );
  });

  it("records every positive probe in evidence order", () => {
    expect(
      classifyFleetLiveness(
        readings({
          processMatches: 2,
          transcript: { _tag: "measured", ageSeconds: FRESH_SECONDS },
          worktreeMtime: { _tag: "measured", ageSeconds: FRESH_SECONDS },
        })
      )
    ).toEqual({ status: "live", evidence: ["process-cwd", "transcript-mtime", "worktree-mtime"] });
  });

  it("reports unknown when the transcript probe failed, even with every other negative measured", () => {
    expect(classifyFleetLiveness(readings({ transcript: { _tag: "failed" } }))).toEqual({
      status: "unknown",
      evidence: [],
    });
  });

  it("reports unknown when the worktree-mtime probe failed", () => {
    expect(classifyFleetLiveness(readings({ worktreeMtime: { _tag: "failed" } }))).toEqual({
      status: "unknown",
      evidence: [],
    });
  });

  it("treats the liveness window as exclusive at its boundary", () => {
    const atWindow = readings({
      worktreeMtime: { _tag: "measured", ageSeconds: FLEET_LIVENESS_WINDOW_SECONDS },
    });
    const insideWindow = readings({
      worktreeMtime: { _tag: "measured", ageSeconds: FLEET_LIVENESS_WINDOW_SECONDS - 1 },
    });
    expect(classifyFleetLiveness(atWindow).status).toBe("dormant");
    expect(classifyFleetLiveness(insideWindow).status).toBe("live");
  });

  it("honors an injected window instead of the default", () => {
    const oneMinuteOld = readings({ worktreeMtime: { _tag: "measured", ageSeconds: 60 } });
    expect(classifyFleetLiveness(oneMinuteOld, 30).status).toBe("dormant");
    expect(classifyFleetLiveness(oneMinuteOld, 120).status).toBe("live");
  });
});

describe("parseStatusPorcelainZ", () => {
  it("counts a rename as one entry and keeps both of its paths", () => {
    expect(parseStatusPorcelainZ("R  new.ts\0old.ts\0")).toEqual({
      entryCount: 1,
      paths: ["new.ts", "old.ts"],
    });
  });

  it("counts a copy as one entry and keeps both of its paths", () => {
    expect(parseStatusPorcelainZ("C  copy.ts\0source.ts\0")).toEqual({
      entryCount: 1,
      paths: ["copy.ts", "source.ts"],
    });
  });

  it("keeps spaces in untracked paths, because -z records are never C-quoted", () => {
    expect(parseStatusPorcelainZ("?? a b.txt\0")).toEqual({ entryCount: 1, paths: ["a b.txt"] });
  });

  it("reads an empty status as zero entries", () => {
    expect(parseStatusPorcelainZ("")).toEqual({ entryCount: 0, paths: [] });
  });

  it("resumes normal records after a rename's origin field", () => {
    expect(parseStatusPorcelainZ("R  new.ts\0old.ts\0?? fresh.ts\0 M tracked.ts\0")).toEqual({
      entryCount: 3,
      paths: ["new.ts", "old.ts", "fresh.ts", "tracked.ts"],
    });
  });
});

describe("parseMergeTreeConflictNames", () => {
  it("skips the tree OID line and stops before the informational messages", () => {
    const names = parseMergeTreeConflictNames(
      [
        "df76511529ca37ffd9e887e628954239fb22a302",
        "README.md",
        "turbo.json",
        "",
        "Auto-merging README.md",
        "CONFLICT (content): Merge conflict in README.md",
        "",
      ].join("\n")
    );
    expect(names).toEqual(["README.md", "turbo.json"]);
  });

  it("dedupes a file named once per conflicting stage", () => {
    expect(parseMergeTreeConflictNames("abc123\nREADME.md\nREADME.md\n\nCONFLICT (content)\n")).toEqual(["README.md"]);
  });

  it("reads a clean merge-tree output as no conflicts", () => {
    expect(parseMergeTreeConflictNames("996bfa97d8d9dcb0a316726745f16fe6f5b0f109\n")).toEqual([]);
  });
});

describe("buildContestedIndex", () => {
  it("keeps only paths claimed by two or more checkouts, sorted, with sorted checkout lists", () => {
    const contested = buildContestedIndex([
      ["/fleet/beta", ["shared.ts", "beta-only.ts", "alpha.ts"]],
      ["/fleet/alpha", ["shared.ts", "alpha.ts"]],
      ["/fleet/gamma", ["shared.ts"]],
    ]);

    expect(contested.map((entry) => entry.path)).toEqual(["alpha.ts", "shared.ts"]);
    expect(contested[0]?.checkouts).toEqual(["/fleet/alpha", "/fleet/beta"]);
    expect(contested[1]?.checkouts).toEqual(["/fleet/alpha", "/fleet/beta", "/fleet/gamma"]);
  });

  it("excludes vendored, dependency, and git-internal prefixes even when several checkouts claim them", () => {
    const contested = buildContestedIndex([
      ["/fleet/alpha", [".repos/effect-v4/pin.txt", "node_modules/pkg/index.js", ".git/index", "real.ts"]],
      ["/fleet/beta", [".repos/effect-v4/pin.txt", "node_modules/pkg/index.js", ".git/index", "real.ts"]],
    ]);

    expect(contested.map((entry) => entry.path)).toEqual(["real.ts"]);
  });

  it("reports nothing when no path is claimed twice", () => {
    expect(
      buildContestedIndex([
        ["/fleet/alpha", ["a.ts"]],
        ["/fleet/beta", ["b.ts"]],
      ])
    ).toEqual([]);
  });
});

describe("transcriptProjectDirName", () => {
  it("mangles separators, underscores, and dots into hyphens", () => {
    expect(transcriptProjectDirName("/a/b_c.d")).toBe("-a-b-c-d");
    expect(transcriptProjectDirName("/home/user/projects/beep_effect")).toBe("-home-user-projects-beep-effect");
  });
});
