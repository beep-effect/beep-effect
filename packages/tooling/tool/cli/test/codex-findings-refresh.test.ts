import { runCodexFindingsIngest } from "@beep/repo-cli/commands/Codex";
import { renderPrettyCommandJson } from "@beep/repo-cli/test/Cli";
import {
  CODEX_CSV_COLUMNS,
  CodexTriageFinding,
  CodexTriageLane,
  CodexTriageLedger,
  CodexTriageMeta,
  CodexTriageRemediation,
  CodexTriageValidation,
  decodeCodexFindingsCapturePayload,
  loadCodexRefreshLedgerSource,
  PacketDocument,
  planPacket,
  priorIdsOfRefreshSource,
  refreshCodexFindingsPacket,
  renderPacketDocuments,
  validateCodexFindingsIngestModes,
  writePacket,
} from "@beep/repo-cli/test/Codex";
import { provideScopedLayer } from "@beep/test-utils";
import { A, O, Str } from "@beep/utils";
import { assert, describe, it } from "@effect/vitest";
import { Effect, FileSystem, Order, PlatformError } from "effect";
import * as S from "effect/Schema";
import { NodeTestLayer, withTempWorkingDirectory } from "./support/CommandTest.ts";
import type { CodexRefreshLedgerSource } from "@beep/repo-cli/test/Codex";
import type { Path } from "effect";

const SLUG = "codex-security-findings-2026-08-04";
const SOURCE_URL = "https://chatgpt.com/codex/cloud/security/findings/";

type CaptureFinding = {
  readonly codexId: string;
  readonly title: string;
  readonly severity: "High" | "Medium" | "Low" | "Informational";
  readonly codexStatus: "Open";
  readonly commit: string;
};

const alpha: CaptureFinding = {
  codexId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  title: "Alpha finding",
  severity: "Medium",
  codexStatus: "Open",
  commit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
};
const beta: CaptureFinding = {
  codexId: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  title: "Beta finding",
  severity: "Low",
  codexStatus: "Open",
  commit: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
};
const arrivingHigh: CaptureFinding = {
  codexId: "cccccccccccccccccccccccccccccccc",
  title: "New high finding",
  severity: "High",
  codexStatus: "Open",
  commit: "cccccccccccccccccccccccccccccccccccccccc",
};
const arrivingInfo: CaptureFinding = {
  codexId: "dddddddddddddddddddddddddddddddd",
  title: "New informational finding",
  severity: "Informational",
  codexStatus: "Open",
  commit: "dddddddddddddddddddddddddddddddddddddddd",
};

const testEffect = <A, E>(effect: Effect.Effect<A, E, FileSystem.FileSystem | Path.Path>) =>
  withTempWorkingDirectory(effect).pipe(provideScopedLayer(NodeTestLayer));

const planFor = (findings: ReadonlyArray<CaptureFinding>, source?: CodexRefreshLedgerSource, expectedCount?: number) =>
  decodeCodexFindingsCapturePayload({
    schemaVersion: "codex-findings-capture/v1",
    capture: {
      capturedAt: "2026-08-04",
      sourceUrl: SOURCE_URL,
      repository: "kriegcloud/beep-effect",
      findingsView: "repo-scoped, status=open",
      expectedCount: findings.length,
      authState: "authenticated",
    },
    findings,
  }).pipe(
    Effect.flatMap((payload) =>
      planPacket(payload, {
        ...(source === undefined ? {} : { priorIds: priorIdsOfRefreshSource(source) }),
        ...(expectedCount === undefined ? {} : { expectedCount }),
      })
    )
  );

const documentsFor = (plan: Effect.Success<ReturnType<typeof planFor>>): ReadonlyArray<PacketDocument> =>
  renderPacketDocuments({
    plan,
    rawPayloadJson: "{}\n",
    rawReports: A.map(plan.records, (record) => ({
      codexId: record.codexId,
      description: `Raw evidence for ${record.id}.`,
      relevantPaths: "packages/example.ts",
      detectedAt: "2026-08-04T12:00:00.000Z",
    })),
  });

const encodeLedger = S.encodeUnknownEffect(S.fromJsonString(CodexTriageLedger));
const encodeLedgerText = Effect.fn("CodexFindingsRefreshTest.encodeLedgerText")(function* (ledger: CodexTriageLedger) {
  return renderPrettyCommandJson(yield* encodeLedger(ledger));
});

const findingEntryWindow = (text: string, id: string, nextId: string): string => {
  const start = new RegExp(`"id"\\s*:\\s*"${id}"`, "u").exec(text);
  const end = new RegExp(`"id"\\s*:\\s*"${nextId}"`, "u").exec(text);
  assert(start !== null);
  assert(end !== null);
  assert(end.index > start.index);
  return Str.slice(start.index, end.index)(text);
};

const csvQuote = (value: string): string => `"${Str.replaceAll('"', '""')(value)}"`;

const csvRow = (finding: CaptureFinding): string =>
  A.join(
    [
      `https://chatgpt.com/codex/cloud/security/findings/${finding.codexId}`,
      "kriegcloud/beep-effect",
      "https://github.com/kriegcloud/beep-effect",
      csvQuote(finding.title),
      csvQuote(`Raw report for ${finding.codexId}.`),
      Str.toLowerCase(finding.severity),
      "open",
      "2026-08-04T16:06:15.518000Z",
      "2026-08-04 12:30:00 -0400",
      "12345678+someuser@users.noreply.github.com",
      "",
      "",
      "false",
      "scan-AbCd:branch-1234567890",
      finding.commit,
      csvQuote("packages/example.ts"),
      "",
    ],
    ","
  );

const csvSnapshot = (findings: ReadonlyArray<CaptureFinding>): string =>
  `${A.join([A.join(CODEX_CSV_COLUMNS, ","), ...A.map(findings, csvRow)], "\n")}\n`;

const bootstrapAuthoredPacket = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.makeDirectory("goals", { recursive: true });
  const plan = yield* planFor([alpha, beta]);
  yield* writePacket({ repoRoot: process.cwd(), slug: SLUG, documents: documentsFor(plan), dryRun: false });

  const source = yield* loadCodexRefreshLedgerSource({ repoRoot: process.cwd(), slug: SLUG });
  const first = source.ledger.findings[0];
  assert(first !== undefined);
  const authoredFirst = CodexTriageFinding.make({
    ...first,
    ownerArea: "AUTHORED OWNER AREA",
    lane: "L1-authored",
    validation: CodexTriageValidation.make({
      ...first.validation,
      status: "complete",
      rationale: "AUTHORED RATIONALE MUST SURVIVE BYTE FOR BYTE",
    }),
    remediation: CodexTriageRemediation.make({
      status: "complete",
      summary: "AUTHORED REMEDIATION SUMMARY MUST SURVIVE BYTE FOR BYTE",
      changedFiles: ["packages/authored.ts"],
      verificationCommands: ["bun run authored-proof"],
    }),
  });
  const authoredLedger = CodexTriageLedger.make({
    ...source.ledger,
    lanes: {
      "L1-authored": CodexTriageLane.make({
        status: "complete",
        findings: ["CSF-001"],
        title: "AUTHORED LANE MUST SURVIVE",
      }),
    },
    findings: [authoredFirst, ...A.drop(source.ledger.findings, 1)],
  });
  const authoredTriageText = yield* encodeLedgerText(authoredLedger);
  yield* fs.writeFileString(`goals/${SLUG}/ops/triage.json`, authoredTriageText);

  const alphaPath = `goals/${SLUG}/findings/CSF-001.md`;
  const alphaText = `${yield* fs.readFileString(alphaPath)}\nAUTHORED CSF PROSE MUST SURVIVE BYTE FOR BYTE\n`;
  yield* fs.writeFileString(alphaPath, alphaText);

  const readmePath = `goals/${SLUG}/README.md`;
  yield* fs.writeFileString(readmePath, `${yield* fs.readFileString(readmePath)}\nAUTHORED PACKET NOTE MUST SURVIVE\n`);

  const manifestPath = `goals/${SLUG}/ops/manifest.json`;
  const manifest = yield* fs.readFileString(manifestPath);
  yield* fs.writeFileString(
    manifestPath,
    Str.replace(
      '"id": "P4",\n      "name": "Remediate",\n      "status": "pending"',
      '"id": "P4",\n      "name": "Remediate",\n      "status": "complete"'
    )(manifest)
  );

  const qualityReviewPath = `goals/${SLUG}/research/QUALITY_REVIEW.md`;
  const qualityReviewText = "# Authored quality review\n\nHistorical proof must remain byte-identical.\n";
  yield* fs.writeFileString(qualityReviewPath, qualityReviewText);
  const rawGitignorePath = `goals/${SLUG}/raw/.gitignore`;
  const rawGitignoreText = `${yield* fs.readFileString(rawGitignorePath)}# AUTHORED IGNORE NOTE\n`;
  yield* fs.writeFileString(rawGitignorePath, rawGitignoreText);

  return {
    alphaText,
    firstTriageEntry: findingEntryWindow(authoredTriageText, "CSF-001", "CSF-002"),
    qualityReviewText,
    rawGitignoreText,
  };
});

const refreshPlan = Effect.fnUntraced(function* () {
  const source = yield* loadCodexRefreshLedgerSource({ repoRoot: process.cwd(), slug: SLUG });
  const plan = yield* planFor([arrivingHigh, alpha, beta, arrivingInfo], source);
  return { source, plan, documents: documentsFor(plan) };
});

const packetSnapshot = Effect.fnUntraced(function* (includeRaw = true) {
  const fs = yield* FileSystem.FileSystem;
  const root = `goals/${SLUG}`;
  const entries = A.sort(yield* fs.readDirectory(root, { recursive: true }), Order.String);
  const files: Array<string> = [];
  for (const entry of entries) {
    if (includeRaw === false && Str.startsWith("raw/")(entry)) {
      continue;
    }
    const info = yield* fs.stat(`${root}/${entry}`);
    if (info.type === "File") {
      files.push(`${entry}\u0000${yield* fs.readFileString(`${root}/${entry}`)}`);
    }
  }
  return A.join(files, "\u0000");
});

const setPacketBranch = Effect.fnUntraced(function* (branch: string) {
  const fs = yield* FileSystem.FileSystem;
  const source = yield* loadCodexRefreshLedgerSource({ repoRoot: process.cwd(), slug: SLUG });
  const ledger = CodexTriageLedger.make({
    ...source.ledger,
    meta: CodexTriageMeta.make({ ...source.ledger.meta, branch }),
  });
  yield* fs.writeFileString(`goals/${SLUG}/ops/triage.json`, yield* encodeLedgerText(ledger));
  const manifestPath = `goals/${SLUG}/ops/manifest.json`;
  const manifest = yield* fs.readFileString(manifestPath);
  yield* fs.writeFileString(
    manifestPath,
    Str.replace('"branch": "security/codex-findings-2026-08-04"', `"branch": "${branch}"`)(manifest)
  );
});

describe("codex findings preservation-safe refresh", () => {
  it.effect("preserves prior authored prose and appends sticky untriaged findings", () =>
    testEffect(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const { alphaText, firstTriageEntry, qualityReviewText, rawGitignoreText } = yield* bootstrapAuthoredPacket();
        const { source, plan, documents } = yield* refreshPlan();

        const outcome = yield* refreshCodexFindingsPacket({
          repoRoot: process.cwd(),
          slug: SLUG,
          source,
          plan,
          documents,
          dryRun: false,
        });

        assert.strictEqual(outcome.committed, true);
        assert.deepStrictEqual(outcome.reconciliation.appendedIds, ["CSF-003", "CSF-004"]);
        assert.strictEqual(yield* fs.readFileString(`goals/${SLUG}/findings/CSF-001.md`), alphaText);
        assert.strictEqual(yield* fs.readFileString(`goals/${SLUG}/research/QUALITY_REVIEW.md`), qualityReviewText);
        assert.strictEqual(yield* fs.readFileString(`goals/${SLUG}/raw/.gitignore`), rawGitignoreText);
        assert.match(yield* fs.readFileString(`goals/${SLUG}/README.md`), /AUTHORED PACKET NOTE MUST SURVIVE/u);

        const refreshed = yield* loadCodexRefreshLedgerSource({ repoRoot: process.cwd(), slug: SLUG });
        assert.strictEqual(findingEntryWindow(refreshed.contents, "CSF-001", "CSF-002"), firstTriageEntry);
        assert.deepStrictEqual(
          A.map(refreshed.ledger.findings, (finding) => finding.id),
          ["CSF-001", "CSF-002", "CSF-003", "CSF-004"]
        );
        assert.strictEqual(
          refreshed.ledger.findings[0]?.validation.rationale,
          "AUTHORED RATIONALE MUST SURVIVE BYTE FOR BYTE"
        );
        assert.strictEqual(refreshed.ledger.findings[0]?.remediation.status, "complete");
        assert.strictEqual(refreshed.ledger.lanes["L1-authored"]?.title, "AUTHORED LANE MUST SURVIVE");
        assert.strictEqual(refreshed.ledger.findings[2]?.disposition, "untriaged");
        assert.strictEqual(refreshed.ledger.findings[2]?.validation.status, "pending");
        assert.strictEqual(refreshed.ledger.findings[2]?.ownerArea, undefined);

        const manifest = yield* fs.readFileString(`goals/${SLUG}/ops/manifest.json`);
        assert.match(manifest, /"capturedCount": 4/u);
        assert.match(manifest, /"id": "P4",\n\s+"name": "Remediate",\n\s+"status": "complete"/u);
        assert.match(manifest, /"id": "P2",\n\s+"name": "Validate",\n\s+"status": "in-progress"/u);
      })
    )
  );

  it.effect("is byte-idempotent when a full snapshot contains no unseen IDs", () =>
    testEffect(
      Effect.gen(function* () {
        yield* bootstrapAuthoredPacket();
        const first = yield* refreshPlan();
        yield* refreshCodexFindingsPacket({
          repoRoot: process.cwd(),
          slug: SLUG,
          ...first,
          dryRun: false,
        });
        const before = yield* packetSnapshot();

        const source = yield* loadCodexRefreshLedgerSource({ repoRoot: process.cwd(), slug: SLUG });
        const plan = yield* planFor([arrivingHigh, alpha, beta, arrivingInfo], source);
        const outcome = yield* refreshCodexFindingsPacket({
          repoRoot: process.cwd(),
          slug: SLUG,
          source,
          plan,
          documents: documentsFor(plan),
          dryRun: false,
        });

        assert.strictEqual(outcome.committed, false);
        assert.strictEqual(outcome.reconciliation.status, "no-new-findings");
        assert.deepStrictEqual(outcome.reconciliation.updatedPaths, []);
        assert.strictEqual(yield* packetSnapshot(), before);
      })
    )
  );

  it.effect("runs full reconciliation in dry-run mode without changing any packet byte", () =>
    testEffect(
      Effect.gen(function* () {
        yield* bootstrapAuthoredPacket();
        const before = yield* packetSnapshot();
        const refresh = yield* refreshPlan();

        const outcome = yield* refreshCodexFindingsPacket({
          repoRoot: process.cwd(),
          slug: SLUG,
          ...refresh,
          dryRun: true,
        });

        assert.strictEqual(outcome.committed, false);
        assert.deepStrictEqual(outcome.reconciliation.appendedIds, ["CSF-003", "CSF-004"]);
        assert.strictEqual(yield* packetSnapshot(), before);
      })
    )
  );

  it.effect(
    "uses existing branch provenance by default and leaves a repeated command plus goals index byte-identical",
    () =>
      testEffect(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          yield* fs.makeDirectory(".git", { recursive: true });
          yield* bootstrapAuthoredPacket();
          const branch = "codex/existing-packet-branch";
          yield* setPacketBranch(branch);
          yield* fs.writeFileString("goals/INDEX.md", "# Authored goals index sentinel\n");
          const csvPath = "codex-security-findings-2026-08-04T16-06-15.518Z.csv";
          yield* fs.writeFileString(csvPath, csvSnapshot([alpha, beta]));
          const options = {
            from: csvPath,
            slug: O.none<string>(),
            date: O.none<string>(),
            branch: O.none<string>(),
            expectedCount: O.none<number>(),
            refresh: true,
            force: false,
            dryRun: false,
            json: false,
          };

          // The first run canonicalizes ignored raw evidence. The second is the
          // exact no-new fixed point whose bytes and global index must not move.
          yield* runCodexFindingsIngest(options);
          const beforePacket = yield* packetSnapshot();
          const beforeIndex = yield* fs.readFileString("goals/INDEX.md");
          yield* runCodexFindingsIngest(options);

          assert.strictEqual(yield* packetSnapshot(), beforePacket);
          assert.strictEqual(yield* fs.readFileString("goals/INDEX.md"), beforeIndex);
          const source = yield* loadCodexRefreshLedgerSource({ repoRoot: process.cwd(), slug: SLUG });
          assert.strictEqual(source.ledger.meta.branch, branch);
        })
      )
  );

  it.effect("refreshes ignored normalized evidence without rewriting tracked packet prose", () =>
    testEffect(
      Effect.gen(function* () {
        yield* bootstrapAuthoredPacket();
        const first = yield* refreshPlan();
        yield* refreshCodexFindingsPacket({
          repoRoot: process.cwd(),
          slug: SLUG,
          ...first,
          dryRun: false,
        });
        const trackedBefore = yield* packetSnapshot(false);
        const source = yield* loadCodexRefreshLedgerSource({ repoRoot: process.cwd(), slug: SLUG });
        const plan = yield* planFor([arrivingHigh, alpha, beta, arrivingInfo], source);
        const documents = A.map(documentsFor(plan), (document) =>
          document.path === "raw/payload.json"
            ? PacketDocument.make({
                ...document,
                contents: '{"schemaVersion":"codex-findings-capture/v1"}\n',
              })
            : document
        );

        const outcome = yield* refreshCodexFindingsPacket({
          repoRoot: process.cwd(),
          slug: SLUG,
          source,
          plan,
          documents,
          dryRun: false,
        });

        assert.strictEqual(outcome.committed, true);
        assert.strictEqual(outcome.reconciliation.status, "no-new-findings");
        assert.deepStrictEqual(outcome.reconciliation.updatedPaths, ["raw/payload.json"]);
        assert.strictEqual(yield* packetSnapshot(false), trackedBefore);
      })
    )
  );

  it.effect("rejects force plus refresh before choosing a destructive mode", () =>
    validateCodexFindingsIngestModes({ force: true, refresh: true }).pipe(
      Effect.map(() => "accepted"),
      Effect.catchTag("CodexFindingsIngestError", (error) => Effect.succeed(error.reason)),
      Effect.map((reason) => assert.strictEqual(reason, "mode-conflict"))
    )
  );

  it.effect("requires an existing packet and a decodable bijective ledger", () =>
    testEffect(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        yield* fs.makeDirectory("goals", { recursive: true });
        const missing = yield* loadCodexRefreshLedgerSource({ repoRoot: process.cwd(), slug: SLUG }).pipe(
          Effect.map(() => "accepted"),
          Effect.catchTag("CodexFindingsIngestError", (error) => Effect.succeed(error.reason))
        );
        assert.strictEqual(missing, "packet-missing");

        yield* fs.makeDirectory(`goals/${SLUG}/ops`, { recursive: true });
        yield* fs.writeFileString(`goals/${SLUG}/ops/triage.json`, "{ malformed");
        const malformed = yield* loadCodexRefreshLedgerSource({ repoRoot: process.cwd(), slug: SLUG }).pipe(
          Effect.map(() => "accepted"),
          Effect.catchTag("CodexFindingsIngestError", (error) => Effect.succeed(error.reason))
        );
        assert.strictEqual(malformed, "ledger-unreadable");
      })
    )
  );

  it.effect("rejects duplicate prior Codex and CSF identity bindings", () =>
    testEffect(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        yield* bootstrapAuthoredPacket();
        const source = yield* loadCodexRefreshLedgerSource({ repoRoot: process.cwd(), slug: SLUG });
        const first = source.ledger.findings[0];
        const second = source.ledger.findings[1];
        assert(first !== undefined);
        assert(second !== undefined);
        const duplicate = CodexTriageFinding.make({ ...second, codexId: first.codexId, id: first.id });
        const ledger = CodexTriageLedger.make({ ...source.ledger, findings: [first, duplicate] });
        yield* fs.writeFileString(`goals/${SLUG}/ops/triage.json`, yield* encodeLedgerText(ledger));

        const reason = yield* loadCodexRefreshLedgerSource({ repoRoot: process.cwd(), slug: SLUG }).pipe(
          Effect.map(() => "accepted"),
          Effect.catchTag("CodexFindingsIngestError", (error) => Effect.succeed(error.reason))
        );
        assert.strictEqual(reason, "refresh-identity-drift");
      })
    )
  );

  it.effect("rejects removals and captured metadata drift", () =>
    testEffect(
      Effect.gen(function* () {
        yield* bootstrapAuthoredPacket();
        const source = yield* loadCodexRefreshLedgerSource({ repoRoot: process.cwd(), slug: SLUG });

        const removalPlan = yield* planFor([alpha], source);
        const removal = yield* refreshCodexFindingsPacket({
          repoRoot: process.cwd(),
          slug: SLUG,
          source,
          plan: removalPlan,
          documents: documentsFor(removalPlan),
          dryRun: true,
        }).pipe(
          Effect.map(() => "accepted"),
          Effect.catchTag("CodexFindingsIngestError", (error) => Effect.succeed(error.reason))
        );
        assert.strictEqual(removal, "refresh-removal");

        const driftPlan = yield* planFor([{ ...alpha, title: "Changed prior title" }, beta], source);
        const drift = yield* refreshCodexFindingsPacket({
          repoRoot: process.cwd(),
          slug: SLUG,
          source,
          plan: driftPlan,
          documents: documentsFor(driftPlan),
          dryRun: true,
        }).pipe(
          Effect.map(() => "accepted"),
          Effect.catchTag("CodexFindingsIngestError", (error) => Effect.succeed(error.reason))
        );
        assert.strictEqual(drift, "refresh-identity-drift");

        const countDriftPlan = yield* planFor([arrivingHigh, alpha, beta, arrivingInfo], source, 3);
        const countDrift = yield* refreshCodexFindingsPacket({
          repoRoot: process.cwd(),
          slug: SLUG,
          source,
          plan: countDriftPlan,
          documents: documentsFor(countDriftPlan),
          dryRun: true,
        }).pipe(
          Effect.map(() => "accepted"),
          Effect.catchTag("CodexFindingsIngestError", (error) => Effect.succeed(error.reason))
        );
        assert.strictEqual(countDrift, "refresh-metadata-drift");
      })
    )
  );

  it.effect("restores the only original copy when staged promotion fails", () =>
    testEffect(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const { alphaText } = yield* bootstrapAuthoredPacket();
        const refresh = yield* refreshPlan();
        const packetDir = `${process.cwd()}/goals/${SLUG}`;
        const failingFileSystem = FileSystem.FileSystem.of({
          ...fs,
          rename: Effect.fn("CodexFindingsRefreshTest.failingRename")((from, to) =>
            Str.includes("-refresh-")(from) && !Str.endsWith("-previous")(from) && Str.equivalence(to, packetDir)
              ? Effect.fail(
                  PlatformError.systemError({
                    _tag: "Unknown",
                    module: "CodexRefreshTest",
                    method: "rename",
                    description: "injected promotion failure",
                  })
                )
              : fs.rename(from, to)
          ),
        });

        const exit = yield* Effect.exit(
          refreshCodexFindingsPacket({
            repoRoot: process.cwd(),
            slug: SLUG,
            ...refresh,
            dryRun: false,
          }).pipe(Effect.provideService(FileSystem.FileSystem, failingFileSystem))
        );

        assert.strictEqual(exit._tag, "Failure");
        assert.strictEqual(yield* fs.readFileString(`goals/${SLUG}/findings/CSF-001.md`), alphaText);
        assert.strictEqual(yield* fs.exists(`goals/${SLUG}`), true);
        assert.deepStrictEqual(
          A.filter(yield* fs.readDirectory("goals"), (entry) => Str.includes("-previous")(entry)),
          []
        );
      })
    )
  );
});
