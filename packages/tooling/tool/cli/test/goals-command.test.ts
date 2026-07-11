import {
  buildBackfillManifestText,
  GOAL_MANIFEST_BACKFILLS,
  GOAL_PHASE_STATUS_MIGRATIONS,
  GOAL_STATUS_MIGRATIONS,
  GoalManifest,
  GoalPacketRecord,
  migrateGoalPhaseStatusToken,
  migrateGoalStatusToken,
  PortfolioIndexRow,
  parseGoalManifestText,
  planGoalPacketMigration,
  readmeLifecycleToken,
  readmeMissionLine,
  renderPortfolioIndex,
  rewriteReadmeLifecycleToken,
} from "@beep/repo-cli/test/Goals";
import { describe, expect, it } from "@effect/vitest";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { parse } from "jsonc-parser";

const decodeManifest = S.decodeUnknownSync(GoalManifest);

const COMPLETION_GATE = {
  operator: "yeet",
  requiresPullRequest: true,
  requiresMergeable: true,
  statement: "Ship via yeet.",
  grandfathered: false,
};

const packetRecord = (input: {
  readonly slug: string;
  readonly manifestText?: string;
  readonly readmeText?: string;
}): GoalPacketRecord =>
  GoalPacketRecord.make({
    slug: input.slug,
    packetPath: `goals/${input.slug}`,
    manifestPath: `goals/${input.slug}/ops/manifest.json`,
    readmePath: `goals/${input.slug}/README.md`,
    ...(input.manifestText === undefined ? {} : { manifestText: input.manifestText }),
    ...(input.readmeText === undefined ? {} : { readmeText: input.readmeText }),
  });

describe("goals status migration mapping", () => {
  it("maps every legacy initiative-status token from the census", () => {
    const expectations: ReadonlyArray<readonly [string, string]> = [
      ["complete", "completed-retained"],
      ["completed", "completed-retained"],
      ["DONE", "completed-retained"],
      ["v1-closed", "completed-retained"],
      ["phase1-complete", "completed-retained"],
      ["p0-p6-implemented-runpod-10-packet-evidence-complete", "completed-retained"],
      ["local-proof-complete", "completed-retained"],
      ["superseded-reference", "superseded"],
      ["pending", "paused"],
      ["PENDING", "paused"],
      ["pending-implementation", "paused"],
      ["bootstrapped-phase-1-pending", "paused"],
      ["implementation_complete_review_pending", "paused"],
      ["local_hardening_and_oip_s3_rename_applied_provider_dns_gates_remaining", "paused"],
      ["v2-active", "active"],
      ["active-p3-ready", "active"],
      ["active-p1d-with-open-p1-windows-proof-debt", "active"],
    ];
    for (const [legacy, canonical] of expectations) {
      expect(O.getOrNull(migrateGoalStatusToken(legacy))).toBe(canonical);
    }
  });

  it("maps canonical statuses to themselves and rejects unknown tokens", () => {
    for (const canonical of ["active", "paused", "completed-retained", "superseded", "reference"]) {
      expect(O.getOrNull(migrateGoalStatusToken(canonical))).toBe(canonical);
      expect(canonical in GOAL_STATUS_MIGRATIONS).toBe(false);
    }
    expect(O.isNone(migrateGoalStatusToken("not-a-status"))).toBe(true);
  });

  it("maps every legacy phase-status token from the census", () => {
    const expectations: ReadonlyArray<readonly [string, string]> = [
      ["completed", "complete"],
      ["complete", "complete"],
      ["done", "complete"],
      ["DONE", "complete"],
      ["pending", "pending"],
      ["PENDING", "pending"],
      ["planned", "pending"],
      ["seeded", "pending"],
      ["in_progress", "in-progress"],
      ["in-progress", "in-progress"],
      ["active", "in-progress"],
      ["selected", "in-progress"],
    ];
    for (const [legacy, canonical] of expectations) {
      expect(O.getOrNull(migrateGoalPhaseStatusToken(legacy))).toBe(canonical);
    }
    expect(O.isNone(migrateGoalPhaseStatusToken("wat"))).toBe(true);
    expect("complete" in GOAL_PHASE_STATUS_MIGRATIONS).toBe(false);
  });
});

describe("planGoalPacketMigration", () => {
  const legacyManifest = `${JSON.stringify(
    {
      schemaVersion: "initiative-manifest/v1",
      initiative: { id: "demo", title: "Demo", status: "complete" },
      packetPath: "goals/demo",
      lifecycle: "complete",
      completionGate: COMPLETION_GATE,
      phases: [
        { id: "P0", status: "done" },
        { id: "P1", status: "seeded" },
      ],
    },
    null,
    2
  )}\n`;
  const legacyReadme = "# Demo\n\n## Status\n\nLifecycle: `complete`\n\n## Mission\n\nShip the demo thing.\n";

  it("rewrites status surfaces mechanically and records the legacy token", () => {
    const plan = planGoalPacketMigration(
      packetRecord({ slug: "demo", manifestText: legacyManifest, readmeText: legacyReadme })
    );
    expect(plan.parked).toBeUndefined();
    expect(plan.manifestText).toBeDefined();
    expect(plan.readmeText).toBeDefined();

    const migrated = decodeManifest(parse(plan.manifestText ?? ""));
    expect(migrated.initiative.status).toBe("completed-retained");
    expect(migrated.lifecycle).toBe("completed-retained");
    expect(migrated.statusNote).toBe("legacy status: complete");
    expect(migrated.mission).toBe("Ship the demo thing.");
    expect(O.getOrNull(readmeLifecycleToken(plan.readmeText ?? ""))).toBe("completed-retained");

    const phases = parse(plan.manifestText ?? "").phases as ReadonlyArray<{ status: string }>;
    expect(phases.map((phase) => phase.status)).toEqual(["complete", "pending"]);
  });

  it("is idempotent: replanning the migrated packet yields zero edits", () => {
    const first = planGoalPacketMigration(
      packetRecord({ slug: "demo", manifestText: legacyManifest, readmeText: legacyReadme })
    );
    const second = planGoalPacketMigration(
      packetRecord({ slug: "demo", manifestText: first.manifestText, readmeText: first.readmeText })
    );
    expect(second.edits).toEqual([]);
    expect(second.manifestText).toBeUndefined();
    expect(second.readmeText).toBeUndefined();
  });

  it("creates an initiative block for bare top-level status manifests", () => {
    const bareManifest = `${JSON.stringify(
      {
        slug: "bare-demo",
        title: "Bare Demo",
        status: "DONE",
        completionGate: COMPLETION_GATE,
        phases: { landed: { name: "Landed", status: "DONE" } },
      },
      null,
      2
    )}\n`;
    const plan = planGoalPacketMigration(packetRecord({ slug: "bare-demo", manifestText: bareManifest }));
    const migratedJson = parse(plan.manifestText ?? "") as Record<string, unknown>;
    expect(migratedJson.status).toBeUndefined();

    const migrated = decodeManifest(migratedJson);
    expect(migrated.initiative.id).toBe("bare-demo");
    expect(migrated.initiative.title).toBe("Bare Demo");
    expect(migrated.initiative.status).toBe("completed-retained");
    expect(migrated.statusNote).toBe("legacy status: DONE");
    const phases = migratedJson.phases as Record<string, { status: string }>;
    expect(phases.landed?.status).toBe("complete");
  });

  it("normalizes an object-shaped supersededBy to a slug plus note", () => {
    const manifest = `${JSON.stringify(
      {
        schemaVersion: "initiative-manifest/v1",
        initiative: { id: "sup-demo", title: "Sup", status: "completed-retained" },
        supersededBy: { packet: "goals/standards-remediation", scope: "remaining ledger", date: "2026-07-07" },
        completionGate: COMPLETION_GATE,
      },
      null,
      2
    )}\n`;
    const plan = planGoalPacketMigration(packetRecord({ slug: "sup-demo", manifestText: manifest }));
    const migrated = decodeManifest(parse(plan.manifestText ?? ""));
    expect(migrated.supersededBy).toBe("standards-remediation");
    expect(migrated.supersededNote).toBe("remaining ledger (2026-07-07)");
  });

  it("parks packets with unmappable status tokens instead of guessing", () => {
    const manifest = `${JSON.stringify(
      {
        initiative: { id: "weird", title: "Weird", status: "quantum-flux" },
        completionGate: COMPLETION_GATE,
      },
      null,
      2
    )}\n`;
    const plan = planGoalPacketMigration(packetRecord({ slug: "weird", manifestText: manifest }));
    expect(plan.parked).toContain("quantum-flux");
    expect(plan.manifestText).toBeUndefined();
  });

  it("backfills v2 manifests for the five recorded manifest-less packets", () => {
    expect(GOAL_MANIFEST_BACKFILLS.map((backfill) => backfill.slug)).toEqual([
      "agentic-cad-patent-tooling",
      "dedup-clone-engine",
      "knowledge-workspace",
      "repo-codegraph-jsdoc",
      "trustgraph-port",
    ]);
    for (const backfill of GOAL_MANIFEST_BACKFILLS) {
      const text = buildBackfillManifestText(backfill, O.some(`# Title Of ${backfill.slug}\n\n## Mission\n\nDo it.\n`));
      const manifest = decodeManifest(parse(text));
      expect(manifest.schemaVersion).toBe("initiative-manifest/v2");
      expect(manifest.initiative.status).toBe(backfill.status);
      expect(manifest.lifecycle).toBe(backfill.status);
      expect(manifest.initiative.title).toBe(`Title Of ${backfill.slug}`);
      expect(manifest.mission).toBe("Do it.");
    }
  });
});

describe("README helpers", () => {
  it("rewrites the Lifecycle line preserving backticks and trailing text", () => {
    const rewritten = rewriteReadmeLifecycleToken("## Status\n\nLifecycle: `active` (see manifest)\n", "paused");
    expect(O.getOrNull(rewritten)).toBe("## Status\n\nLifecycle: `paused` (see manifest)\n");

    const bare = rewriteReadmeLifecycleToken("Lifecycle: active\n", "reference");
    expect(O.getOrNull(bare)).toBe("Lifecycle: reference\n");
  });

  it("refuses READMEs without a recognizable Lifecycle line", () => {
    expect(O.isNone(rewriteReadmeLifecycleToken("## Status\n\nActive\n", "paused"))).toBe(true);
    expect(O.isNone(readmeLifecycleToken("## Status\n\nActive\n"))).toBe(true);
  });

  it("extracts a one-line mission only when cleanly extractable", () => {
    const readme = "# T\n\n## Mission\n\nLine one\nline two.\n\nSecond paragraph.\n\n## Next\n";
    expect(O.getOrNull(readmeMissionLine(readme))).toBe("Line one line two.");
    const long = `# T\n\n## Mission\n\n${"x".repeat(301)}\n`;
    expect(O.isNone(readmeMissionLine(long))).toBe(true);
    expect(O.isNone(readmeMissionLine("# T\n\n## Overview\n\nNo mission.\n"))).toBe(true);
  });
});

describe("renderPortfolioIndex", () => {
  const rows: ReadonlyArray<PortfolioIndexRow> = [
    PortfolioIndexRow.make({
      slug: "zeta",
      title: "Zeta | Pipes",
      status: "active",
      phasesComplete: 1,
      phasesTotal: 3,
      updated: "2026-07-01",
      mission: "Do the | thing",
    }),
    PortfolioIndexRow.make({
      slug: "alpha",
      title: "Alpha",
      status: "active",
      phasesComplete: 0,
      phasesTotal: 0,
    }),
    PortfolioIndexRow.make({
      slug: "omega",
      title: "Omega",
      status: "reference",
      phasesComplete: 2,
      phasesTotal: 2,
    }),
  ];

  it("renders deterministically with slug-sorted rows and canonical group order", () => {
    const first = renderPortfolioIndex(rows, ["broken"]);
    const second = renderPortfolioIndex([...rows].reverse(), ["broken"]);
    expect(first).toBe(second);

    const activeIndex = first.indexOf("## Active (2)");
    const referenceIndex = first.indexOf("## Reference (1)");
    const invalidIndex = first.indexOf("## Invalid or missing manifests (1)");
    expect(activeIndex).toBeGreaterThan(-1);
    expect(referenceIndex).toBeGreaterThan(activeIndex);
    expect(invalidIndex).toBeGreaterThan(referenceIndex);
    expect(first.indexOf("[alpha]")).toBeLessThan(first.indexOf("[zeta]"));
    expect(first).toContain("4 packets: 2 active · 0 paused · 0 completed-retained · 0 superseded · 1 reference.");
    expect(first).toContain("Zeta \\| Pipes");
    expect(first).toContain("Do the \\| thing");
  });
});

describe("parseGoalManifestText", () => {
  it("accepts JSON objects and rejects non-object or broken JSON", () => {
    expect(O.isSome(parseGoalManifestText('{ "a": 1 }'))).toBe(true);
    expect(O.isNone(parseGoalManifestText("[1, 2]"))).toBe(true);
    expect(O.isNone(parseGoalManifestText("not json"))).toBe(true);
  });
});
