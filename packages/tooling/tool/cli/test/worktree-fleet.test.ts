import {
  buildContestedIndex,
  classifyFleetLiveness,
  contestedSwampingNotes,
  FLEET_LIVENESS_WINDOW_SECONDS,
  FleetCheckout,
  FleetContestedPath,
  FleetLivenessReadings,
  parseMergeTreeConflictNames,
  parseProcStatStartTime,
  parseStatusPorcelainZ,
  rankContestedPaths,
  transcriptProjectDirName,
} from "@beep/repo-cli/commands/Worktree";
import { A, O } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";

const FRESH_SECONDS = 30;
const STALE_SECONDS = FLEET_LIVENESS_WINDOW_SECONDS * 2;

/**
 * Complete negatives: a complete process scan with no match, no confirmed
 * registry session (which is silence, not a negative), an absent transcript,
 * and a measured worktree mtime older than the window. This is the only shape
 * that may classify as `dormant`, so every other case overrides one field of
 * it.
 */
const readings = (overrides: Partial<FleetLivenessReadings>): FleetLivenessReadings =>
  FleetLivenessReadings.make({
    processMatches: 0,
    processScanComplete: true,
    sessionMatches: 0,
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

  it("reports live from the claude-session probe alone", () => {
    expect(classifyFleetLiveness(readings({ sessionMatches: 1 }))).toEqual({
      status: "live",
      evidence: ["claude-session"],
    });
  });

  it("records every positive probe in evidence order", () => {
    expect(
      classifyFleetLiveness(
        readings({
          processMatches: 2,
          sessionMatches: 1,
          transcript: { _tag: "measured", ageSeconds: FRESH_SECONDS },
          worktreeMtime: { _tag: "measured", ageSeconds: FRESH_SECONDS },
        })
      )
    ).toEqual({ status: "live", evidence: ["process-cwd", "transcript-mtime", "worktree-mtime", "claude-session"] });
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

  it("treats an explicit undefined window as the curried default form", () => {
    const oneMinuteOld = readings({ worktreeMtime: { _tag: "measured", ageSeconds: 60 } });
    expect(classifyFleetLiveness(undefined)(oneMinuteOld)).toEqual(classifyFleetLiveness(oneMinuteOld));
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

/** Fields 3..21 then starttime at field 22, in the whitespace-joined form `/proc/<pid>/stat` uses after the comm. */
const statTail = (startTime: string): string => A.join(["S", ...A.makeBy(18, () => "0"), startTime, "7"], " ");

describe("parseProcStatStartTime", () => {
  it("parses starttime after the last paren, so a comm with spaces and parens cannot shift fields", () => {
    expect(O.getOrNull(parseProcStatStartTime(`244216 (tmux: server (1)) ${statTail("220635")}`))).toBe("220635");
  });

  it("parses a plain comm", () => {
    expect(O.getOrNull(parseProcStatStartTime(`1 (init) ${statTail("4")}`))).toBe("4");
  });

  it("reads none from a line without a comm paren", () => {
    expect(O.isNone(parseProcStatStartTime("garbage"))).toBe(true);
  });

  it("reads none when the tail is too short to carry field 22", () => {
    expect(O.isNone(parseProcStatStartTime("1 (init) S 0 0"))).toBe(true);
  });
});

/** A checkout row that only carries what the contested display consults: path, liveness, and dirty count. */
const checkoutRow = (path: string, liveness: FleetCheckout["liveness"], dirtyCount: number | null): FleetCheckout =>
  FleetCheckout.make({
    path,
    kind: "clone",
    branch: null,
    detached: null,
    head: null,
    dirtyCount,
    mergeBase: null,
    branchDiffCount: null,
    liveness,
    livenessEvidence: [],
    conflict: "unknown",
    conflictReason: "head-unknown",
    conflictPaths: [],
    policyMovement: "unknown",
    policyReason: "head-unknown",
    policyPaths: [],
  });

const contestedEntry = (path: string, checkouts: ReadonlyArray<string>): FleetContestedPath =>
  FleetContestedPath.make({ path, checkouts });

describe("rankContestedPaths", () => {
  it("ranks rows with more live claimants first, then more claimants, then path", () => {
    const rows = [
      checkoutRow("/fleet/busy", "live", 2),
      checkoutRow("/fleet/other", "live", 1),
      checkoutRow("/fleet/idle", "dormant", 5_133),
    ];
    const ranked = rankContestedPaths(
      [
        contestedEntry("a.ts", ["/fleet/idle", "/fleet/unknown-elsewhere"]),
        contestedEntry("b.ts", ["/fleet/busy", "/fleet/idle"]),
        contestedEntry("c.ts", ["/fleet/busy", "/fleet/other"]),
        contestedEntry("d.ts", ["/fleet/busy", "/fleet/idle", "/fleet/unknown-elsewhere"]),
      ],
      rows
    );
    // c: 2 live; b and d tie at 1 live, d has more claimants; a: 0 live.
    expect(A.map(ranked, (entry) => entry.path)).toEqual(["c.ts", "d.ts", "b.ts", "a.ts"]);
  });

  it("keeps canonical path order when liveness distinguishes nothing", () => {
    const ranked = rankContestedPaths(
      [contestedEntry("b.ts", ["/fleet/x", "/fleet/y"]), contestedEntry("a.ts", ["/fleet/x", "/fleet/y"])],
      []
    );
    expect(A.map(ranked, (entry) => entry.path)).toEqual(["a.ts", "b.ts"]);
  });
});

describe("contestedSwampingNotes", () => {
  // 25 rows: 21 claimed by the high-dirty checkout against rotating neighbors
  // (each neighbor claims 7), 4 contested across live checkouts. Every
  // claimant has a checkout row, as in a real snapshot.
  const swampedContested = () =>
    A.appendAll(
      A.makeBy(21, (index) => contestedEntry(`dirty-${index}.ts`, ["/fleet/dirty", `/fleet/neighbor-${index % 3}`])),
      A.makeBy(4, (index) => contestedEntry(`active-${index}.ts`, ["/fleet/busy", "/fleet/other"]))
    );

  const swampedRows = () => [
    checkoutRow("/fleet/dirty", "live", 5_133),
    checkoutRow("/fleet/neighbor-0", "dormant", 7),
    checkoutRow("/fleet/neighbor-1", "dormant", 7),
    checkoutRow("/fleet/neighbor-2", "dormant", 7),
    checkoutRow("/fleet/busy", "live", 3),
    checkoutRow("/fleet/other", "live", 2),
  ];

  it("flags only the checkout claiming more than half of an overflowing contested list, with its dirty count", () => {
    expect(contestedSwampingNotes(swampedContested(), swampedRows())).toEqual([
      "  note: /fleet/dirty claims 21/25 contested rows (dirty: 5133)",
    ]);
  });

  it("stays silent when the contested list fits the render limit", () => {
    const contested = A.makeBy(20, (index) =>
      contestedEntry(`dirty-${index}.ts`, ["/fleet/dirty", `/fleet/neighbor-${index % 3}`])
    );
    expect(contestedSwampingNotes(contested, swampedRows())).toEqual([]);
  });

  it("stays silent about a checkout claiming exactly half", () => {
    // 22 rows over rotating pairs: each of the four checkouts claims 11 — exactly half, never more.
    const contested = A.makeBy(22, (index) =>
      contestedEntry(`p-${index}.ts`, [`/fleet/spread-${index % 2}`, `/fleet/spread-${2 + (index % 2)}`])
    );
    const rows = A.makeBy(4, (index) => checkoutRow(`/fleet/spread-${index}`, "live", 9));
    expect(contestedSwampingNotes(contested, rows)).toEqual([]);
  });
});
