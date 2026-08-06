/**
 * Renders a resolved capture plan into the complete set of packet documents.
 *
 * Every renderer here is pure and total: planning is the last stage that can
 * fail on data, so rendering cannot. That split is what makes a dry run
 * meaningful — the documents a dry run reports are byte-identical to the ones a
 * real ingest would promote.
 *
 * Judgment is never fabricated. A freshly generated packet carries capture
 * metadata and explicit `_pending_` markers where a triage agent must write, so
 * no reader can mistake generated scaffolding for a decision someone made.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { escapeMarkdownText } from "@beep/md/Md.escape";
import { A, O } from "@beep/utils";
import * as R from "effect/Record";
import { CodexFindingSeverity } from "./Findings.capture.schemas.ts";
import {
  CodexTriageFinding,
  CodexTriageLedger,
  CodexTriageMeta,
  CodexTriageRemediation,
  CodexTriageValidation,
  encodeCodexTriageLedger,
} from "./Findings.triage.schemas.ts";
import { PacketDocument } from "./Findings.write.ts";
import type { CodexFindingRecord, CodexPacketPlan, CodexSeverityCounts } from "./Findings.schemas.ts";

/**
 * Marker written wherever a phase must supply judgment the capture cannot.
 *
 * @param phase - Packet phase that will supply the missing judgment.
 * @returns The italic pending marker for that phase.
 */
const pendingIn = (phase: string): string => `_pending ${phase}_`;

const VALIDATION_PHASE = "P2";
const REMEDIATION_PHASE = "P4";

const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

const lines = (value: ReadonlyArray<string>): string => `${A.join(value, "\n")}\n`;

/**
 * Severities carrying at least one finding, in canonical declaration order.
 *
 * @param counts - Per-severity totals.
 * @returns Present severities paired with their totals.
 */
const presentSeverities = (counts: CodexSeverityCounts): ReadonlyArray<readonly [string, number]> =>
  A.map(
    A.filter(CodexFindingSeverity.Options, (severity) => (counts[severity] ?? 0) > 0),
    (severity) => [severity, counts[severity] ?? 0] as const
  );

/**
 * Renders `13 Medium, 7 Low, 7 Informational`.
 *
 * @param counts - Per-severity totals.
 * @returns A comma-joined summary, or `"no"` when the capture was empty.
 */
const severityPhrase = (counts: CodexSeverityCounts): string => {
  const present = presentSeverities(counts);
  return A.isReadonlyArrayNonEmpty(present)
    ? A.join(
        A.map(present, ([severity, total]) => `${total} ${severity}`),
        ", "
      )
    : "no";
};

const manifestDocument = (plan: CodexPacketPlan): PacketDocument => {
  const capturedCount = A.length(plan.records);
  const title = `Codex Security Findings (${plan.capturedAt})`;

  return PacketDocument.make({
    path: "ops/manifest.json",
    tracked: true,
    contents: json({
      schemaVersion: "initiative-manifest/v2",
      initiative: {
        id: plan.slug,
        title,
        status: "active",
        created: plan.capturedAt,
        updated: plan.capturedAt,
        packetAnchorDocument: "SPEC.md",
      },
      packetPath: `goals/${plan.slug}`,
      lifecycle: "active",
      mission: `Remediate and close the ${capturedCount} Codex Cloud security findings captured on ${plan.capturedAt}.`,
      executionCapable: true,
      reflectionRequired: true,
      completionGate: {
        operator: "yeet",
        requiresPullRequest: true,
        requiresMergeable: true,
        statement: `Not achieved until the work ships as a Yeet-driven mergeable PR, is merged, and the exact ${capturedCount} Codex findings are resolved with zero packet-applicable open findings.`,
        grandfathered: false,
      },
      branch: plan.branch,
      currentSourceOfTruth: [
        "AGENTS.md",
        "CLAUDE.md",
        `goals/${plan.slug}/README.md`,
        `goals/${plan.slug}/SPEC.md`,
        `goals/${plan.slug}/PLAN.md`,
        `goals/${plan.slug}/GOAL.md`,
        `goals/${plan.slug}/research/SOURCES.md`,
      ],
      researchReports: ["research/SOURCES.md"],
      agentLaunchers: [
        {
          kind: "codex-goal",
          path: "GOAL.md",
          targetChars: 3500,
          maxChars: 4000,
          command: `/goal follow the instructions in goals/${plan.slug}/GOAL.md`,
        },
      ],
      source: {
        provider: "Codex Cloud Security UI",
        repository: plan.repository,
        url: plan.sourceUrl,
        capturedAt: plan.capturedAt,
        captureMethodPolicy: "signed-in-csv-export",
        rawCaptureRoot: `goals/${plan.slug}/raw`,
        rawCaptureTracked: false,
      },
      catalog: {
        expectedCount: plan.expectedCount,
        capturedCount,
        severityCountsKnown: true,
        severityCounts: R.fromEntries(presentSeverities(plan.severityCounts)),
        dispositionCounts: {
          remediate: 0,
          "already-fixed": 0,
          "false-positive": 0,
          "out-of-scope": 0,
          untriaged: capturedCount,
        },
        note: `Generated by \`beep codex findings ingest\`. Every finding is untriaged until ${VALIDATION_PHASE} records a current-HEAD verdict.`,
      },
      closeoutPolicy: {
        fixed: "Already fixed",
        alreadyFixed: "Already fixed",
        dismissedInvalid: "False positive",
        outOfScope: "False positive",
        acceptedRisk: "not allowed",
      },
      dispositionPolicy: {
        default: "remediate",
        acceptedRiskAllowed: false,
        falsePositiveThreshold:
          "strict current-HEAD proof that affected code is absent, unreachable, non-shipped, already fixed, or materially misunderstood",
        fixPhilosophy:
          "minimal shared-root fixes with focused regression proof; reuse canonical repo helpers after live source and barrel discovery",
      },
      sanitation: {
        trackedRawFindingContent: false,
        rawCaptureLocation: `goals/${plan.slug}/raw`,
        commitsOnlySanitizedMarkdown: true,
        codexPatchTextTracked: false,
        publicFindingPolicy:
          "Tracked records contain title, severity, Codex ID, source commit, public summary, decisions, changed files, and verification only.",
      },
      phases: [
        { id: "P0", name: "Bootstrap", status: "complete" },
        { id: "P1", name: "Capture", status: "complete" },
        { id: "P2", name: "Validate", status: "pending" },
        { id: "P3", name: "Lane partition", status: "pending" },
        { id: "P4", name: "Remediate", status: "pending" },
        { id: "P5", name: "Repo proof", status: "pending" },
        { id: "P6", name: "Publish", status: "pending" },
        { id: "P7", name: "Monitor", status: "pending" },
        { id: "P8", name: "Merge and close findings", status: "pending" },
        { id: "P9", name: "Close", status: "pending" },
      ],
      verificationCommands: [
        `test "$(wc -m < goals/${plan.slug}/GOAL.md)" -le 4000`,
        `jq . goals/${plan.slug}/ops/manifest.json`,
        `jq . goals/${plan.slug}/ops/triage.json`,
        `test "$(find goals/${plan.slug}/findings -maxdepth 1 -name 'CSF-*.md' | wc -l | tr -d ' ')" = ${capturedCount}`,
        `git diff --check -- goals/${plan.slug}`,
        // Advisory rather than a CLI gate: this repository squash-merges, so a
        // finding's source commit is often absent from the branch even when the
        // finding is entirely valid. The executing agent reads the output.
        `jq -r '.findings[].commit' goals/${plan.slug}/ops/triage.json | while read -r c; do git merge-base --is-ancestor "$c" HEAD || echo "not-an-ancestor: $c"; done`,
        "bun run beep lint reflection-artifacts",
      ],
      stopConditions: [
        "The signed-in CSV export cannot be produced from the findings page.",
        "Tracked evidence contains secrets, auth values, signed URLs, email addresses, or raw developer-local paths.",
        "A remediation requires an architecture or product decision outside packet scope.",
        "The same blocker repeats after reasonable investigation.",
      ],
    }),
  });
};

const triageDocument = (plan: CodexPacketPlan): PacketDocument => {
  const ledger = CodexTriageLedger.make({
    meta: CodexTriageMeta.make({
      schemaVersion: "codex-triage/v1",
      repository: plan.repository,
      findingsView: plan.findingsView,
      branch: plan.branch,
      expectedCount: plan.expectedCount,
      capturedCount: A.length(plan.records),
      capturedAt: plan.capturedAt,
      captureMethod: "signed-in-csv-export",
      note: `Generated skeleton. ownerArea, verdict, and lane are absent until ${VALIDATION_PHASE} assigns them.`,
    }),
    // Lanes are a P3 partition over confirmed findings; inventing them at
    // capture time would assert a root-cause grouping nobody has established.
    lanes: {},
    findings: A.map(plan.records, (record) =>
      CodexTriageFinding.make({
        id: record.id,
        codexId: record.codexId,
        title: record.title,
        severity: record.severity,
        codexStatus: record.codexStatus,
        commit: record.commit,
        disposition: "untriaged",
        validation: CodexTriageValidation.make({ status: "pending" }),
        remediation: CodexTriageRemediation.make({
          status: "pending",
          changedFiles: [],
          verificationCommands: [],
        }),
      })
    ),
  });

  return PacketDocument.make({
    path: "ops/triage.json",
    tracked: true,
    contents: json(encodeCodexTriageLedger(ledger)),
  });
};

const findingDocument = (record: CodexFindingRecord): PacketDocument =>
  PacketDocument.make({
    path: `findings/${record.id}.md`,
    tracked: true,
    contents: lines([
      `# ${record.id}: ${escapeMarkdownText(record.title)}`,
      "",
      `- Severity: ${record.severity}`,
      `- Codex ID: \`${record.codexId}\``,
      `- Source commit: \`${record.commit}\``,
      `- Owner: ${pendingIn(VALIDATION_PHASE)}`,
      "- Status: captured; validation pending",
      "",
      "## Public Summary",
      "",
      // The CSV description is unsanitized report text and stays in ignored
      // raw/. Writing a summary is a judgment step, not a copy step.
      `${pendingIn(VALIDATION_PHASE)} — write a sanitized summary from the raw report.`,
      "",
      "## Current-HEAD Validation",
      "",
      `${pendingIn(VALIDATION_PHASE)} — record verdict, disposition, and rationale.`,
      "",
      "## Remediation",
      "",
      pendingIn(REMEDIATION_PHASE),
      "",
      "Changed files:",
      "",
      `- ${pendingIn(REMEDIATION_PHASE)}`,
      "",
      "## Verification",
      "",
      `- ${pendingIn(REMEDIATION_PHASE)}`,
    ]),
  });

const findingsIndexDocument = (plan: CodexPacketPlan): PacketDocument =>
  PacketDocument.make({
    path: "findings/INDEX.md",
    tracked: true,
    contents: lines([
      `# Codex Security Findings Index (${plan.capturedAt})`,
      "",
      `Captured from the authenticated Codex Cloud Security view for`,
      `\`${plan.repository}\` on ${plan.capturedAt} through the signed-in CSV export.`,
      "Full reports remain ignored under `raw/`; tracked records omit signed URLs,",
      "auth values, email addresses, and raw local paths.",
      "",
      "## Severity Summary",
      "",
      "| Severity | Count |",
      "| --- | ---: |",
      ...A.map(presentSeverities(plan.severityCounts), ([severity, total]) => `| ${severity} | ${total} |`),
      "",
      "## Findings",
      "",
      "| ID | Severity | Status | Title | Owner area |",
      "| --- | --- | --- | --- | --- |",
      ...A.map(
        plan.records,
        (record) =>
          `| [${record.id}](./${record.id}.md) | ${record.severity} | captured | ${escapeMarkdownText(record.title)} | ${pendingIn(VALIDATION_PHASE)} |`
      ),
      "",
      "## Closeout Mapping",
      "",
      "- `remediate` or `already-fixed` -> close as `Already fixed` after merge.",
      "- Strictly proven invalid -> close as `False positive` with evidence recorded.",
      "- Accepted risk / `Won't fix` is unavailable.",
    ]),
  });

const readmeDocument = (plan: CodexPacketPlan): PacketDocument => {
  const capturedCount = A.length(plan.records);
  return PacketDocument.make({
    path: "README.md",
    tracked: true,
    contents: lines([
      `# Codex Security Findings (${plan.capturedAt})`,
      "",
      "## Status",
      "",
      "Lifecycle: `active`",
      "",
      "Source: [`ops/manifest.json`](./ops/manifest.json)",
      "",
      "## Mission",
      "",
      "Capture, validate, remediate, and close every open Codex Cloud security finding",
      `for \`${plan.repository}\` in the ${capturedCount}-finding batch captured on ${plan.capturedAt}.`,
      "Ship the fixes through one Yeet-driven PR, close the exact captured findings, and",
      "leave no packet-applicable finding open.",
      "",
      "## Launch",
      "",
      "```text",
      `/goal follow the instructions in goals/${plan.slug}/GOAL.md`,
      "```",
      "",
      "`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.",
      "",
      "## Read This First",
      "",
      "1. [`GOAL.md`](./GOAL.md)",
      "2. [`SPEC.md`](./SPEC.md)",
      "3. [`PLAN.md`](./PLAN.md)",
      "4. [`ops/manifest.json`](./ops/manifest.json)",
      "5. [`ops/triage.json`](./ops/triage.json)",
      "6. [`findings/INDEX.md`](./findings/INDEX.md)",
      "",
      "## Current Phase",
      "",
      `\`P2 validate\` - all ${capturedCount} findings are captured and untriaged. Reproduce each`,
      "report at current HEAD, then record a verdict, disposition, and owner surface.",
      "",
      "## Findings at a glance",
      "",
      `${severityPhrase(plan.severityCounts)} findings. Accepted risk is unavailable; each item must be`,
      "fixed or closed only with strict proof that the report is already fixed or",
      "materially invalid.",
      "",
      "## Notes",
      "",
      "- Raw report bodies remain untracked under `raw/`; tracked files are sanitized.",
      "- Do not use Codex's Create PR or patch-apply controls.",
      "- Browser closure is post-merge and must match the captured Codex ID allowlist.",
    ]),
  });
};

const goalDocument = (plan: CodexPacketPlan): PacketDocument => {
  const capturedCount = A.length(plan.records);
  return PacketDocument.make({
    path: "GOAL.md",
    tracked: true,
    contents: lines([
      `# Codex Security Findings (${plan.capturedAt})`,
      "",
      "Repo root: the current working directory. Do not assume an absolute path.",
      "",
      // Deliberately a count, never a per-finding list: GOAL.md has a hard
      // 4000-char doctor gate and a list would breach it on a large batch.
      `Outcome: fix and close the ${capturedCount} Codex Cloud security findings captured on`,
      `${plan.capturedAt} for \`${plan.repository}\`: ${severityPhrase(plan.severityCounts)}.`,
      "Ship one Yeet-driven PR to mergeable, merge it, then resolve the exact captured",
      "Codex IDs until no packet-applicable finding remains open.",
      "",
      "Read first:",
      "",
      `- \`goals/${plan.slug}/README.md\``,
      `- \`goals/${plan.slug}/SPEC.md\``,
      `- \`goals/${plan.slug}/PLAN.md\``,
      `- \`goals/${plan.slug}/ops/manifest.json\``,
      `- \`goals/${plan.slug}/ops/triage.json\``,
      `- \`goals/${plan.slug}/findings/INDEX.md\``,
      "",
      "Then read `AGENTS.md`, required skills, and standards governing each target.",
      "Repo law outranks packet prose.",
      "",
      "Scope:",
      "",
      "- In: sanitized packet evidence, current-HEAD validation, minimal root-cause",
      "  remediation, focused regression checks, Yeet proof/publication/monitoring,",
      "  merge, and post-merge Chrome closure.",
      "- Out: accepted risk, raw evidence in git, Codex Create PR/patch buttons,",
      "  unrelated cleanup, weakened quality/security gates.",
      "",
      "Rules:",
      "",
      "1. Default every item to `remediate`; use `already-fixed` or `false-positive`",
      "   only with strict current-HEAD proof in the finding and triage ledger.",
      "2. Apply Effect-first and schema-first repo law. Search live source and barrels",
      "   before adding helpers; reuse canonical path-safety and bounds primitives.",
      "3. Fix shared causes once. Add one focused regression check per executable-code",
      "   finding, merging tests only where the same root cause is exercised.",
      "4. Keep raw report bodies ignored under `raw/`. Tracked records may contain only",
      "   sanitized metadata, summaries, decisions, changed files, and proof.",
      "5. Run focused tests, affected package checks, packet validation, then Yeet",
      "   repair/verify. Publish one intentional PR and monitor through mergeable.",
      `6. After merge, close only the exact ${capturedCount}-ID allowlist in Codex as Already fixed`,
      "   (or the evidence-backed invalid reason) and verify zero packet-open findings.",
      "",
      "Stop if the signed-in CSV export is unavailable, tracked evidence contains secret",
      "or raw-path material, a fix needs an out-of-packet architecture decision, or the",
      "same blocker repeats after reasonable investigation.",
    ]),
  });
};

const planDocument = (plan: CodexPacketPlan): PacketDocument => {
  const capturedCount = A.length(plan.records);
  return PacketDocument.make({
    path: "PLAN.md",
    tracked: true,
    contents: lines([
      `# Codex Security Findings (${plan.capturedAt}) Plan`,
      "",
      "## Status",
      "",
      "Status: `active`. The batch is captured and untriaged; validation is next.",
      "",
      "## Phases",
      "",
      "| Phase | Status | Goal | Exit criteria |",
      "| --- | --- | --- | --- |",
      "| P0 bootstrap | complete | Create feature branch and packet scaffold. | Branch and launcher exist; packet JSON parses. |",
      `| P1 capture | complete | Capture all live findings via the signed-in CSV export. | ${capturedCount} IDs reconcile: ${severityPhrase(plan.severityCounts)}. |`,
      "| P2 validate | pending | Reproduce each report at current HEAD. | Every item has strict verdict, disposition, rationale, and owner surface. |",
      "| P3 lane-partition | pending | Group shared root causes and disjoint paths. | Lanes recorded without overlapping file ownership. |",
      "| P4 remediate | pending | Fix all real findings with focused checks. | Changed files and passing targeted proof recorded per finding. |",
      "| P5 repo-proof | pending | Run packet validation and Yeet repair/verify. | No packet drift; local proof green. |",
      "| P6 publish | pending | Publish one intentional PR through Yeet. | Exact branch head pushed and PR opened. |",
      "| P7 monitor | pending | Close hosted checks and actionable reviews. | PR green and mergeable. |",
      `| P8 merge-and-close | pending | Merge and close captured findings. | PR merged; all ${capturedCount} IDs resolved. |`,
      "| P9 close | pending | Record evidence, reflection, and lifecycle. | Packet set to `completed-retained` in the same closeout PR state. |",
      "",
      "## Execution Rules",
      "",
      "- Validate before repairing; classify failures as introduced, inherited,",
      "  unrelated, or environment-only.",
      "- Prefer one shared root-cause fix when multiple reports traverse the same code.",
      "- Keep global files and ledgers serialized.",
      "- Use focused tests first, then package checks, then Yeet.",
      "- Never stage ignored raw evidence.",
      "",
      "## Packet Verification",
      "",
      "```sh",
      `test "$(wc -m < goals/${plan.slug}/GOAL.md)" -le 4000`,
      `jq . goals/${plan.slug}/ops/manifest.json`,
      `jq . goals/${plan.slug}/ops/triage.json`,
      `test "$(find goals/${plan.slug}/findings -maxdepth 1 -name 'CSF-*.md' | wc -l | tr -d ' ')" = ${capturedCount}`,
      `git diff --check -- goals/${plan.slug}`,
      "```",
    ]),
  });
};

const specDocument = (plan: CodexPacketPlan): PacketDocument => {
  const capturedCount = A.length(plan.records);
  return PacketDocument.make({
    path: "SPEC.md",
    tracked: true,
    contents: lines([
      `# Codex Security Findings (${plan.capturedAt}) Spec`,
      "",
      "## Objective",
      "",
      "Remediate every open Codex Cloud security finding visible at",
      `\`${plan.sourceUrl}\` for`,
      `\`${plan.repository}\` in the ${capturedCount}-finding batch captured on ${plan.capturedAt}. Publish`,
      "the work through Yeet, reach mergeable hosted state, merge, then resolve the",
      "exact captured findings until no packet-applicable finding remains open.",
      "",
      "## Non-Goals",
      "",
      "- No accepted-risk or `Won't fix` disposition.",
      "- No raw report bodies, signed artifact URLs, auth headers, cookie values,",
      "  email addresses, secret material, or developer-local absolute paths in tracked",
      "  files.",
      "- No Codex Create PR or patch-apply actions.",
      "- No unrelated refactors, dependency churn, or broad formatting.",
      "- No weakening of quality, security, CI, or review gates.",
      "",
      "## Source Hierarchy",
      "",
      "1. The user objective that created this packet.",
      "2. `AGENTS.md`, `CLAUDE.md`, and required skills.",
      "3. Governing architecture and package standards.",
      "4. This `SPEC.md`.",
      "5. `PLAN.md`.",
      "6. `GOAL.md`.",
      "7. Supporting `research/`, `ops/`, `findings/`, and `history/` files.",
      "",
      "## Target Surfaces",
      "",
      `- \`goals/${plan.slug}/**\`.`,
      `- Gitignored raw evidence under \`goals/${plan.slug}/raw/**\`.`,
      "- Maintained repo paths named by `findings/INDEX.md` after current-HEAD validation.",
      "",
      "## Constraints",
      "",
      "- Default disposition is `remediate`. `already-fixed` or `false-positive`",
      "  requires strict current-HEAD proof recorded in the finding and triage ledger.",
      "- Minimal root-cause fixes plus one focused regression check per executable-code",
      "  finding. Reuse canonical path-safety, schema, and bounds helpers after live",
      "  source/barrel discovery.",
      "- Schema-first and Effect-first laws govern all production changes.",
      "- Security controls may not be simplified away for diff size.",
      "- Full reports stay in ignored `raw/`; tracked records contain only sanitized",
      "  metadata, summaries, validation, decisions, changed files, and proof.",
      `- Browser closure happens after merge, against the exact ${capturedCount}-ID allowlist.`,
      "- Preserve unrelated work and stage only reviewed packet intent.",
      "",
      "## Acceptance Criteria",
      "",
      `- [ ] All ${capturedCount} findings have sanitized tracked CSF records with Codex ID, severity,`,
      "      title, source commit, and public summary.",
      "- [ ] Every finding has a current-HEAD verdict, disposition, lane, rationale,",
      "      remediation state, changed-file set, and verification evidence.",
      "- [ ] Every real finding is fixed at the shared root cause with a focused",
      "      regression check where executable behavior changes.",
      "- [ ] Packet counts, manifest, triage ledger, launcher size, sanitation, and",
      "      whitespace checks pass.",
      "- [ ] Yeet repair and verify are green on the complete remediation scope.",
      "- [ ] The branch is published, hosted checks and reviews are closed, and the PR",
      "      is mergeable and merged.",
      `- [ ] All ${capturedCount} captured Codex findings are resolved after merge and the live view`,
      "      shows zero packet-applicable open findings.",
      "",
      "## Verification Matrix",
      "",
      "| Check | Command or evidence | Required result |",
      "| --- | --- | --- |",
      `| Launcher size | \`test "$(wc -m < goals/${plan.slug}/GOAL.md)" -le 4000\` | Pass |`,
      "| JSON shape | `jq .` over both files in `ops/` | Pass |",
      `| Finding count | CSF file count equals ${capturedCount} | Pass |`,
      `| Severity count | ${severityPhrase(plan.severityCounts)} | Pass |`,
      "| Raw ignored | `git status --short -- .../raw` | Only `.gitignore` tracked |",
      "| Sanitization | tracked packet secret/path pattern scan | No matches |",
      "| Per-finding proof | command recorded in finding and triage ledger | Pass |",
      "| Repo proof | `bun run beep yeet verify` | Green |",
      "| Hosted proof | Yeet monitor and review closeout | Green and mergeable |",
      "| Final closure | signed-in Chrome findings view | Zero packet-open |",
      "",
      "## Stop Conditions",
      "",
      "- The signed-in CSV export cannot be produced from the findings page.",
      "- Tracked evidence contains a secret, signed URL, auth value, email address, or",
      "  raw local path.",
      "- A fix requires a product or architecture decision outside this packet.",
      "- A proposed security control would rely on a platform-specific fail-open path.",
      "- The same blocking condition repeats after reasonable investigation.",
      "",
      "## Exception Ledger",
      "",
      "| Exception | Scope | Owner | Rationale | Removal condition |",
      "| --- | --- | --- | --- | --- |",
      "| None | N/A | N/A | N/A | N/A |",
    ]),
  });
};

const sourcesDocument = (plan: CodexPacketPlan): PacketDocument => {
  const capturedCount = A.length(plan.records);
  return PacketDocument.make({
    path: "research/SOURCES.md",
    tracked: true,
    contents: lines([
      "# Sources",
      "",
      "## Repo Sources",
      "",
      "- `AGENTS.md` / `CLAUDE.md` - repository law and tool routing.",
      "- `goals/README.md` - packet standard and completion gate.",
      "- `goals/codex-security-findings-2026-08-04/**` - prior packet structure,",
      "  sanitation, triage, and post-merge closure precedent.",
      "- `standards/ARCHITECTURE.md` and `standards/architecture/**` - ownership and",
      "  shared-kernel doctrine.",
      "- Live source and package barrels named by each finding - current-HEAD truth.",
      "",
      "## External Source",
      "",
      "- Codex Cloud Security UI:",
      `  \`${plan.sourceUrl}\`, captured on ${plan.capturedAt}`,
      "  through the operator's signed-in Chrome session.",
      `- The UI's signed-in \`Export findings as CSV\` control supplied the ${capturedCount}-record`,
      "  batch. `beep codex findings ingest` normalized it; the export itself was never",
      "  copied into the repository.",
      "",
      "## Notes",
      "",
      "- Full report bodies are local ignored evidence under `raw/`.",
      "- Tracked CSF files intentionally omit signed artifact URLs, raw developer-local",
      "  paths, author email addresses, auth values, and unsanitized report text.",
    ]),
  });
};

/**
 * Report bodies, one file per finding, under ignored `raw/reports/`.
 *
 * The body is written verbatim beneath a `CSF-NNN` heading so P2 can validate
 * against exactly what Codex reported. It is never escaped or merged into a
 * tracked document: these files exist because the tracked records deliberately
 * carry only sanitized metadata.
 *
 * @param plan - The resolved plan supplying assigned identities.
 * @param reports - Report bodies keyed by Codex identity.
 * @returns One untracked document per finding that has a report body.
 */
const rawReportDocuments = (
  plan: CodexPacketPlan,
  reports: ReadonlyArray<{
    readonly codexId: string;
    readonly description: string;
    readonly relevantPaths: string;
    readonly detectedAt: string;
  }>
): ReadonlyArray<PacketDocument> => {
  const recordFor = (codexId: string) => A.findFirst(plan.records, (record) => record.codexId === codexId);

  return A.map(
    A.filter(reports, (report) => O.isSome(recordFor(report.codexId))),
    (report) => {
      // Safe by the filter above; the plan and the reports come from the same
      // decode, so every report has exactly one assigned record.
      const record = O.getOrElse(recordFor(report.codexId), () => plan.records[0]!);
      return PacketDocument.make({
        path: `raw/reports/${record.id}.md`,
        tracked: false,
        // Report text is external prose that legitimately quotes local paths;
        // hits are surfaced to the operator rather than refusing the ingest.
        scan: "report",
        contents: lines([
          `# ${record.id}: ${record.title}`,
          "",
          `- Codex ID: \`${record.codexId}\``,
          `- Severity: ${record.severity}`,
          `- Source commit: \`${record.commit}\``,
          `- Detected at: ${report.detectedAt}`,
          `- Relevant paths: ${report.relevantPaths}`,
          "",
          "## Report",
          "",
          report.description,
        ]),
      });
    }
  );
};

const rawGitignoreDocument = (): PacketDocument =>
  PacketDocument.make({
    path: "raw/.gitignore",
    tracked: true,
    contents: lines(["# Ignore all raw Codex evidence; only sanitized markdown is tracked.", "*", "!.gitignore"]),
  });

/**
 * Render a resolved plan into every document a generated packet contains.
 *
 * **When to use**
 *
 * Use as the only bridge between planning and writing. The result is handed
 * straight to `writePacket`, which scans it before anything reaches disk.
 *
 * **Details**
 *
 * Document order is stable and the content is a pure function of the plan, so
 * ingesting one capture twice produces byte-identical output. `raw/payload.json`
 * carries the normalized capture and `raw/reports/CSF-NNN.md` the report bodies
 * P2 validates against — never the CSV export itself, which also holds author
 * email addresses.
 *
 * **Gotchas**
 *
 * `GOAL.md` is under a hard 4000-character doctor gate, so it reports severity
 * counts and points at `findings/INDEX.md` rather than listing findings. Adding
 * a per-finding line here would breach the gate on a large batch.
 *
 * Everything under `raw/` is untracked by construction. Report bodies are
 * external prose that legitimately quotes developer-local paths, so they are
 * written there and never merged into a tracked document.
 *
 * **Example** (Rendering a packet for an empty capture)
 *
 * ```ts
 * import { CodexPacketPlan } from "@beep/repo-cli/commands/Codex/Findings.schemas"
 * import { renderPacketDocuments } from "@beep/repo-cli/commands/Codex/Findings.packet"
 *
 * const plan = CodexPacketPlan.make({
 *   slug: "codex-security-findings-2026-08-04",
 *   branch: "security/codex-findings-2026-08-04",
 *   capturedAt: "2026-08-04",
 *   repository: "kriegcloud/beep-effect",
 *   sourceUrl: "https://chatgpt.com/codex/cloud/security/findings/",
 *   findingsView: "repo-scoped, status=open",
 *   expectedCount: 0,
 *   records: [],
 *   severityCounts: {},
 * })
 *
 * const documents = renderPacketDocuments({ plan, rawPayloadJson: "{}\n" })
 *
 * console.log(documents[0]?.path) // "README.md"
 * ```
 *
 * @param options - The resolved plan and the normalized raw payload text.
 * @returns Every document the packet contains, in stable order.
 * @category use-cases
 * @since 0.0.0
 */
export const renderPacketDocuments = (options: {
  readonly plan: CodexPacketPlan;
  readonly rawPayloadJson: string;
  /** Report bodies keyed by Codex identity, written only under ignored `raw/`. */
  readonly rawReports?: ReadonlyArray<{
    readonly codexId: string;
    readonly description: string;
    readonly relevantPaths: string;
    readonly detectedAt: string;
  }>;
}): ReadonlyArray<PacketDocument> =>
  A.appendAll(
    [
      readmeDocument(options.plan),
      goalDocument(options.plan),
      specDocument(options.plan),
      planDocument(options.plan),
      sourcesDocument(options.plan),
      manifestDocument(options.plan),
      triageDocument(options.plan),
      findingsIndexDocument(options.plan),
      rawGitignoreDocument(),
      PacketDocument.make({
        path: "raw/payload.json",
        tracked: false,
        contents: options.rawPayloadJson,
      }),
    ],
    A.appendAll(
      A.map(options.plan.records, findingDocument),
      rawReportDocuments(options.plan, options.rawReports ?? A.empty())
    )
  );
