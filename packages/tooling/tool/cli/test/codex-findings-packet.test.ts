import { GOAL_MD_MAX_CHARS } from "@beep/repo-cli/commands/Goals/Doctor";
import { decodeGoalManifest } from "@beep/repo-cli/commands/Goals/Goals.schemas";
import {
  CodexFindingRecord,
  CodexPacketPlan,
  decodeCodexTriageLedger,
  renderPacketDocuments,
  scanSensitiveText,
} from "@beep/repo-cli/test/Codex";
import { A, Str } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as S from "effect/Schema";
import type { PacketDocument } from "@beep/repo-cli/test/Codex";

// The repo forbids bare JSON.* ; decode through the schema codec instead.
const parseJson = S.decodeUnknownSync(S.fromJsonString(S.Unknown));

const SEVERITIES = ["Medium", "Low", "Informational"] as const;

const recordAt = (ordinal: number, title?: string) =>
  CodexFindingRecord.make({
    id: `CSF-${Str.padStart(3, "0")(`${ordinal}`)}`,
    codexId: Str.padStart(32, "0")(`${ordinal}`),
    title: title ?? `Synthetic finding ${ordinal}`,
    severity: SEVERITIES[ordinal % 3]!,
    codexStatus: "New",
    commit: Str.padStart(40, "a")(`${ordinal}`),
  });

const planWith = (records: ReadonlyArray<CodexFindingRecord>) =>
  CodexPacketPlan.make({
    slug: "codex-security-findings-2026-08-06",
    branch: "security/codex-findings-2026-08-06",
    capturedAt: "2026-08-06",
    repository: "kriegcloud/beep-effect",
    sourceUrl: "https://chatgpt.com/codex/cloud/security/findings/",
    findingsView: "repo-scoped, status=open",
    expectedCount: A.length(records),
    records,
    severityCounts: A.reduce(records, {} as Record<string, number>, (counts, record) => ({
      ...counts,
      [record.severity]: (counts[record.severity] ?? 0) + 1,
    })),
  });

const render = (count: number, title?: string) =>
  renderPacketDocuments({
    plan: planWith(A.map(A.range(1, count), (ordinal) => recordAt(ordinal, ordinal === 1 ? title : undefined))),
    rawPayloadJson: '{"findings":[]}\n',
  });

// The subset of the generated manifest these assertions read. Decoding it
// rather than casting keeps the test honest: a renamed field fails here.
const ManifestSubset = S.Struct({
  initiative: S.Struct({ status: S.String }),
  lifecycle: S.String,
  phases: S.Array(S.Struct({ status: S.String })),
  source: S.Struct({ captureMethodPolicy: S.String, rawCaptureTracked: S.Boolean }),
  catalog: S.Struct({
    capturedCount: S.Int,
    dispositionCounts: S.Struct({ untriaged: S.Int, remediate: S.Int }),
  }),
});

const decodeManifest = S.decodeUnknownSync(ManifestSubset);

const manifestOf = (documents: ReadonlyArray<PacketDocument>) =>
  decodeManifest(parseJson(at(documents, "ops/manifest.json").contents));

const at = (documents: ReadonlyArray<PacketDocument>, path: string): PacketDocument => {
  const found = A.findFirst(documents, (document) => document.path === path);
  if (found._tag === "None") throw new Error(`no document at ${path}`);
  return found.value;
};

describe("codex findings packet clears the goals doctor gates", () => {
  const documents = render(27);

  it.effect("emits a manifest that decodes as a GoalManifest", () =>
    Effect.gen(function* () {
      // Deliberately the raw parse, not the narrowed subset: GoalManifest is the
      // real gate contract and needs every key the packet actually writes.
      const manifest = parseJson(at(documents, "ops/manifest.json").contents);

      expect(yield* decodeGoalManifest(manifest)).toBeDefined();
    })
  );

  it("keeps initiative.status and lifecycle identical", () => {
    const manifest = manifestOf(documents);

    expect(manifest.initiative.status).toBe("active");
    expect(manifest.lifecycle).toBe("active");
  });

  it("carries a README lifecycle line matching the manifest status", () => {
    expect(at(documents, "README.md").contents).toContain("Lifecycle: `active`");
  });

  it("leaves post-capture phases pending so an active packet is not terminal", () => {
    const manifest = manifestOf(documents);
    const pending = A.filter(manifest.phases, (phase) => phase.status === "pending");

    // All-complete phases on an active packet is a blocking doctor finding.
    expect(A.length(pending)).toBeGreaterThan(0);
    expect(A.map(A.take(manifest.phases, 2), (phase) => phase.status)).toEqual(["complete", "complete"]);
  });

  it("declares the CSV export as the capture method, never a pasted snippet", () => {
    const manifest = manifestOf(documents);

    expect(manifest.source.captureMethodPolicy).toBe("signed-in-csv-export");
    expect(manifest.source.rawCaptureTracked).toBe(false);
  });
});

describe("codex findings packet launcher budget", () => {
  // The launcher reports counts and points at findings/INDEX.md; if it ever
  // grew a per-finding line this is the test that would catch it.
  for (const count of [26, 200]) {
    it(`keeps GOAL.md within the doctor budget at ${count} findings`, () => {
      const goal = at(render(count), "GOAL.md").contents;

      expect([...goal].length).toBeLessThanOrEqual(GOAL_MD_MAX_CHARS);
    });
  }

  it("does not grow GOAL.md proportionally to the finding count", () => {
    const small = [...at(render(26), "GOAL.md").contents].length;
    const large = [...at(render(200), "GOAL.md").contents].length;

    expect(large - small).toBeLessThan(20);
  });
});

describe("codex findings packet renders no fabricated judgment", () => {
  const documents = render(3);

  it("marks every judgment section pending rather than inventing prose", () => {
    const finding = at(documents, "findings/CSF-001.md").contents;

    expect(finding).toContain("_pending P2_");
    expect(finding).toContain("_pending P4_");
    expect(finding).toContain("- Status: captured; validation pending");
  });

  it.effect("leaves every triage entry untriaged with no verdict, owner, or lane", () =>
    Effect.gen(function* () {
      const ledger = yield* decodeCodexTriageLedger(parseJson(at(documents, "ops/triage.json").contents));

      expect(A.length(ledger.findings)).toBe(3);
      for (const entry of ledger.findings) {
        expect(entry.disposition).toBe("untriaged");
        expect(entry.verdict).toBeUndefined();
        expect(entry.ownerArea).toBeUndefined();
        expect(entry.lane).toBeUndefined();
      }
      expect(ledger.lanes).toEqual({});
    })
  );

  it("reports counts that match the rendered finding documents", () => {
    const manifest = manifestOf(documents);
    const findingDocs = A.filter(documents, (document) => Str.startsWith("findings/CSF-")(document.path));

    expect(manifest.catalog.capturedCount).toBe(A.length(findingDocs));
    expect(manifest.catalog.dispositionCounts.untriaged).toBe(A.length(findingDocs));
    expect(manifest.catalog.dispositionCounts.remediate).toBe(0);
  });
});

describe("codex findings packet neutralizes hostile titles", () => {
  const HOSTILE = "Evil | ](https://evil.example) <img src=x onerror=1>";
  const documents = render(3, HOSTILE);

  it("keeps the INDEX row column count despite pipes in a title", () => {
    const row = A.findFirst(Str.split(at(documents, "findings/INDEX.md").contents, "\n"), (line) =>
      Str.includes("CSF-001")(line)
    );
    if (row._tag === "None") throw new Error("no CSF-001 row");

    // Only unescaped pipes delimit cells. A 5-column row has exactly 6 of them,
    // and the title's own pipe must survive as an escaped literal instead.
    expect(A.length(row.value.match(/(?<!\\)\|/g) ?? [])).toBe(6);
    expect(row.value).toContain("\\|");
  });

  it("does not emit a live link from a title", () => {
    expect(at(documents, "findings/INDEX.md").contents).not.toContain("](https://evil.example)");
    expect(at(documents, "findings/CSF-001.md").contents).not.toContain("](https://evil.example)");
  });
});

describe("codex findings packet is deterministic and scan-clean", () => {
  it("renders byte-identical output for the same plan", () => {
    const first = render(27);
    const second = render(27);

    expect(A.map(first, (document) => `${document.path} :: ${document.contents}`)).toEqual(
      A.map(second, (document) => `${document.path} :: ${document.contents}`)
    );
  });

  it("passes the reject-scan on every generated document", () => {
    const hits = A.flatMap(render(27), (document) => scanSensitiveText(document.path, document.contents));

    expect(hits).toEqual([]);
  });

  it("ignores the raw directory and never copies the CSV export", () => {
    const documents = render(3);
    const gitignore = at(documents, "raw/.gitignore").contents;

    expect(gitignore).toContain("*");
    expect(gitignore).toContain("!.gitignore");
    expect(at(documents, "raw/payload.json").tracked).toBe(false);
    expect(A.filter(documents, (document) => Str.endsWith(".csv")(document.path))).toEqual([]);
  });
});
