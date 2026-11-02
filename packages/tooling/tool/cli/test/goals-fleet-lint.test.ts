import { GoalPacketRecord, lintGoalFleet } from "@beep/repo-cli/test/Goals";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const encodeJsonResult = S.encodeUnknownResult(S.fromJsonString(S.Unknown));
const encodeJson = (value: unknown): string => Result.getOrThrow(encodeJsonResult(value));

const record = (slug: string, manifest: Readonly<Record<string, unknown>>): GoalPacketRecord =>
  GoalPacketRecord.make({
    slug,
    packetPath: `goals/${slug}`,
    manifestPath: `goals/${slug}/ops/manifest.json`,
    readmePath: `goals/${slug}/README.md`,
    manifestText: `${encodeJson(manifest)}\n`,
  });

const completionGate = {
  operator: "yeet",
  requiresPullRequest: true,
  requiresMergeable: true,
  statement: "Ship via yeet.",
  grandfathered: false,
};

describe("fleet lint", () => {
  it("reports duplicate identities, dependency cycles, and unreachable references", () => {
    const records = [
      record("a", {
        initiative: { id: "same", status: "active" },
        completionGate,
        blockedBy: ["goals/b", "goals/missing"],
      }),
      record("b", {
        initiative: { id: "same", status: "active" },
        completionGate,
        blockedBy: ["goals/a"],
      }),
    ];
    const kinds = A.map(lintGoalFleet(records), (finding) => finding.kind);
    expect(kinds).toContain("duplicate-slug");
    expect(kinds).toContain("dependency-cycle");
    expect(kinds).toContain("unreachable-packet");
    expect(kinds).toContain("unmigrated-reference");
    expect(
      O.getOrUndefined(A.findFirst(lintGoalFleet(records), (finding) => finding.kind === "unmigrated-reference"))
        ?.severity
    ).toBe("warning");
  });

  it("ignores exploration edges and fully migrated references while skipping malformed records", () => {
    const records = [
      record("a", {
        schemaVersion: "initiative-manifest/v2",
        initiative: { id: "a", status: "active" },
        completionGate,
        blockedBy: ["goals/b#P1", "explorations/idea", 42],
      }),
      record("b", {
        schemaVersion: "initiative-manifest/v2",
        initiative: { id: "b", status: "active" },
        completionGate,
      }),
      GoalPacketRecord.make({
        slug: "missing",
        packetPath: "goals/missing",
        manifestPath: "goals/missing/ops/manifest.json",
        readmePath: "goals/missing/README.md",
      }),
      GoalPacketRecord.make({
        slug: "invalid",
        packetPath: "goals/invalid",
        manifestPath: "goals/invalid/ops/manifest.json",
        readmePath: "goals/invalid/README.md",
        manifestText: "null",
      }),
      record("missing-id", {
        schemaVersion: "initiative-manifest/v2",
        initiative: { status: "active" },
        lifecycle: "active",
        packetPath: "goals/missing-id",
        completionGate,
      }),
    ];
    expect(lintGoalFleet(records)).toStrictEqual([]);
  });

  it("accepts bare packet references when the target exists", () => {
    expect(
      lintGoalFleet([
        record("a", {
          schemaVersion: "initiative-manifest/v2",
          initiative: { id: "a", status: "active" },
          completionGate,
          blockedBy: ["b"],
        }),
        record("b", {
          schemaVersion: "initiative-manifest/v2",
          initiative: { id: "b", status: "active" },
          completionGate,
        }),
      ])
    ).toStrictEqual([]);
  });

  it("excludes exploration-prefixed blockedBy references from dangling-reference findings", () => {
    const findings = lintGoalFleet([
      record("demo", {
        schemaVersion: "initiative-manifest/v2",
        initiative: { id: "demo", status: "active" },
        completionGate,
        blockedBy: ["explorations/ungraduated-idea"],
      }),
    ]);
    expect(A.filter(findings, (finding) => finding.kind === "unreachable-packet")).toStrictEqual([]);
  });

  it("reports a blockedBy slug that is absent from the fleet", () => {
    const findings = lintGoalFleet([
      record("demo", {
        schemaVersion: "initiative-manifest/v2",
        initiative: { id: "demo", status: "active" },
        completionGate,
        blockedBy: ["goals/absent"],
      }),
    ]);
    const dangling = A.filter(findings, (finding) => finding.kind === "unreachable-packet");
    expect(dangling).toHaveLength(1);
    expect(dangling[0]?.related).toStrictEqual(["absent"]);
  });

  it("emits one dependency-cycle finding when duplicate member edges rediscover the same cycle", () => {
    const findings = lintGoalFleet([
      record("a", {
        schemaVersion: "initiative-manifest/v2",
        initiative: { id: "a", status: "active" },
        completionGate,
        blockedBy: ["goals/b"],
      }),
      record("b", {
        schemaVersion: "initiative-manifest/v2",
        initiative: { id: "b", status: "active" },
        completionGate,
        blockedBy: ["goals/a", "goals/a"],
      }),
    ]);
    expect(A.filter(findings, (finding) => finding.kind === "dependency-cycle")).toHaveLength(1);
  });
});
