/**
 * Pure renderers for the skills update train: replay reports, relock
 * receipts, the pull-request comment, and the batch tracking issue.
 *
 * **Details**
 *
 * The replay comment a workflow posts on an update pull request carries a
 * hidden, machine-readable copy of its report (the diff left out) after the
 * `beep-skills-replay/v1:` marker, base64url-encoded so no report text can end
 * the HTML comment early. The scheduled batch run reads that marker back from
 * `gh pr list --json comments` output to build the parent tracking issue, so
 * the issue never re-runs a replay.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import * as Base64Url from "effect/encoding/Base64Url";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { renderPrettyCommandJson } from "../../internal/cli/Json.ts";
import {
  SkillRelockReceipt,
  SkillReplayBatch,
  SkillReplayReport,
  SkillTrainBatchIssue,
} from "./SkillsRelock.schemas.ts";
import type {
  SkillHunkReport,
  SkillHunkStatus,
  SkillTrainPullRequest,
  SkillTrainPullRequestComment,
} from "./SkillsRelock.schemas.ts";

const encodeReplayBatchJson = S.encodeResult(S.fromJsonString(SkillReplayBatch));
const decodeReplayBatchJson = S.decodeUnknownResult(S.fromJsonString(SkillReplayBatch));
const encodeRelockReceiptJson = S.encodeResult(S.fromJsonString(SkillRelockReceipt));

const MARKER_PREFIX = "beep-skills-replay/v1:";
const MARKER_PATTERN = /<!-- beep-skills-replay\/v1:([A-Za-z0-9_-]+) -->/gu;
const replayHeadMarker = (head: string): string => `<!-- beep-skills-replay-head:${head} -->`;
const DIFF_BUDGET = 40_000;

/**
 * The first line of every replay comment, used to find and update it in place.
 *
 * **Example** (Find a replay comment)
 *
 * ```ts
 * import { SKILL_REPLAY_COMMENT_TAG } from "@beep/repo-cli/commands/Skills/SkillsRelock.render"
 *
 * console.log("<!-- beep-skills-replay -->\n## ...".startsWith(SKILL_REPLAY_COMMENT_TAG)) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SKILL_REPLAY_COMMENT_TAG = "<!-- beep-skills-replay -->";

/**
 * Renders a replay batch as two-space formatted JSON with a trailing newline.
 *
 * **Example** (Render an empty batch)
 *
 * ```ts
 * import { renderSkillReplayJson } from "@beep/repo-cli/commands/Skills/SkillsRelock.render"
 * import { SkillReplayBatch } from "@beep/repo-cli/commands/Skills/SkillsRelock.schemas"
 *
 * console.log(renderSkillReplayJson(SkillReplayBatch.make({ reports: [] })).includes("skills-replay/v1")) // true
 * ```
 *
 * @param batch - The replay reports to render.
 * @returns The JSON text.
 * @category formatting
 * @since 0.0.0
 */
export const renderSkillReplayJson = (batch: SkillReplayBatch): string =>
  encodeReplayBatchJson(batch).pipe(Result.getOrThrow, renderPrettyCommandJson);

/**
 * Renders a relock receipt as two-space formatted JSON with a trailing newline.
 *
 * **Details**
 *
 * The workflow reads `planDigest` from this JSON and passes it back as
 * `--expect`, the same two-step review the lock migration write uses.
 *
 * **Example** (Inspect the renderer)
 *
 * ```ts
 * import { renderSkillRelockReceiptJson } from "@beep/repo-cli/commands/Skills/SkillsRelock.render"
 *
 * console.log(typeof renderSkillRelockReceiptJson) // "function"
 * ```
 *
 * @param receipt - The receipt `skills relock` returned.
 * @returns The JSON text.
 * @category formatting
 * @since 0.0.0
 */
export const renderSkillRelockReceiptJson = (receipt: SkillRelockReceipt): string =>
  encodeRelockReceiptJson(receipt).pipe(Result.getOrThrow, renderPrettyCommandJson);

const countOf = (rows: ReadonlyArray<SkillHunkReport>, status: SkillHunkStatus): number =>
  A.length(A.filter(rows, (row) => row.status === status));

const hunkCounts = (report: SkillReplayReport): string =>
  `${countOf(report.hunks, "applied")} applied, ${countOf(report.hunks, "fuzz-applied")} fuzz-applied, ${countOf(
    report.hunks,
    "conflicted"
  )} conflicted`;

const shortRevision = Str.slice(0, 12);

const describeReport = (report: SkillReplayReport): string => {
  const recorded = report.recorded ? "recorded" : "relock needed";
  const license = report.licenseMatches ? "" : "; license changed";
  const strikes = A.isReadonlyArrayEmpty(report.promoteCandidates)
    ? ""
    : `; ${A.length(report.promoteCandidates)} promote-candidate (two strikes)`;
  return `  ${report.skill}: ${report.status} at ${shortRevision(report.sourceRevision)} (${hunkCounts(
    report
  )}; ${recorded}${license}${strikes})`;
};

/**
 * Renders a replay batch as a headline plus one line per skill.
 *
 * **Example** (Render an empty batch)
 *
 * ```ts
 * import { renderSkillReplaySummary } from "@beep/repo-cli/commands/Skills/SkillsRelock.render"
 * import { SkillReplayBatch } from "@beep/repo-cli/commands/Skills/SkillsRelock.schemas"
 *
 * console.log(renderSkillReplaySummary(SkillReplayBatch.make({ reports: [] })))
 * // "skills replay: 0 clean, 0 fuzz-only, 0 conflicted"
 * ```
 *
 * @param batch - The replay reports to summarize.
 * @returns The headline followed by one line per skill.
 * @category formatting
 * @since 0.0.0
 */
export const renderSkillReplaySummary = (batch: SkillReplayBatch): string => {
  const count = (status: SkillReplayReport["status"]): string =>
    `${A.length(A.filter(batch.reports, (report) => report.status === status))} ${status}`;
  return A.join(
    [
      `skills replay: ${A.join([count("clean"), count("fuzz-only"), count("conflicted")], ", ")}`,
      ...A.map(batch.reports, describeReport),
    ],
    "\n"
  );
};

const escapeCell = (value: string): string => Str.replaceAll("|", "\\|")(Str.replaceAll("\n", " ")(value));

// B4: a second strike is flagged where the reviewer reads the hunk.
const strikeNote = (candidates: ReadonlyArray<string>, row: SkillHunkReport): string =>
  A.contains(candidates, row.hunkHash) ? " (two strikes: promote-candidate)" : "";

const hunkRow =
  (candidates: ReadonlyArray<string>) =>
  (row: SkillHunkReport): string =>
    `| \`${row.patch}\` | \`${row.file}\` | ${row.hunk === 0 ? "section" : `${row.hunk}`} | ${row.status}${strikeNote(
      candidates,
      row
    )} | \`${shortRevision(row.hunkHash)}\` | ${escapeCell(row.detail)} |`;

const diffBlock = (report: SkillReplayReport, budget: number): ReadonlyArray<string> => {
  if (Str.isEmpty(report.diff)) {
    return [`_${report.skill}: the replayed tree equals the pristine upstream tree._`];
  }
  const truncated = Str.length(report.diff) > budget;
  const shown = truncated ? Str.slice(0, budget)(report.diff) : report.diff;
  return [
    `<details><summary>Upstream-vs-effective diff: ${report.skill}${truncated ? " (truncated; see the job artifact)" : ""}</summary>`,
    "",
    "```diff",
    Str.trimEnd(shown),
    "```",
    "",
    "</details>",
  ];
};

const reportSection = (report: SkillReplayReport, budget: number): ReadonlyArray<string> => [
  `### ${report.skill} — ${report.status}`,
  "",
  `\`${report.repository}\` at \`${report.sourceRevision}\`: ${hunkCounts(report)}.${
    report.licenseMatches ? "" : " **The license bytes changed at this pin.**"
  }`,
  "",
  ...(A.isReadonlyArrayEmpty(report.hunks)
    ? ["_No patch series: the pristine tree is the effective tree._"]
    : [
        "| Patch | File | Hunk | Status | Identity | Detail |",
        "| --- | --- | --- | --- | --- | --- |",
        ...A.map(report.hunks, hunkRow(report.promoteCandidates)),
      ]),
  "",
  ...diffBlock(report, budget),
  "",
];

const markerOf = (batch: SkillReplayBatch): string => {
  const compact = SkillReplayBatch.make({
    reports: A.map(batch.reports, (report) => SkillReplayReport.make({ ...report, diff: "" })),
  });
  return `<!-- ${MARKER_PREFIX}${encodeReplayBatchJson(compact).pipe(Result.getOrThrow, Base64Url.encode)} -->`;
};

/**
 * Renders a replay batch as the pull-request comment the workflow posts.
 *
 * **Details**
 *
 * The comment opens with {@link SKILL_REPLAY_COMMENT_TAG}, lists every skill
 * with its verdict, its per-hunk table (`applied`, `fuzz-applied`,
 * `conflicted`, each keyed by the first 12 characters of the hunk identity),
 * and its upstream-vs-effective diff inside a collapsed block, and ends with
 * the hidden machine-readable marker the batch issue reads. Diffs share a
 * 40,000-character budget; the full diff is always in the job artifact.
 *
 * **Example** (Render an empty batch)
 *
 * ```ts
 * import { renderSkillReplayMarkdown, SKILL_REPLAY_COMMENT_TAG } from "@beep/repo-cli/commands/Skills/SkillsRelock.render"
 * import { SkillReplayBatch } from "@beep/repo-cli/commands/Skills/SkillsRelock.schemas"
 *
 * console.log(renderSkillReplayMarkdown(SkillReplayBatch.make({ reports: [] })).startsWith(SKILL_REPLAY_COMMENT_TAG)) // true
 * ```
 *
 * @param batch - The replay reports to render.
 * @returns The comment body.
 * @category formatting
 * @since 0.0.0
 */
export const renderSkillReplayMarkdown = (batch: SkillReplayBatch): string => {
  const budget = Math.floor(DIFF_BUDGET / Math.max(1, A.length(batch.reports)));
  const clean = A.every(batch.reports, (report) => report.status === "clean");
  return A.join(
    [
      SKILL_REPLAY_COMMENT_TAG,
      "## Skills update train: replay",
      "",
      clean
        ? "Every hunk applied exactly at the new pin. The workflow relocks the hashes and runs `materialize --check`."
        : "At least one hunk did not apply exactly at the new pin. The lock is untouched and this PR waits for the review ritual (`beep skills review`, B-6). A `fuzz-applied` hunk is a report classification only; strict apply never fuzzes (B27).",
      "",
      "| Skill | Pin | Replay | Hunks |",
      "| --- | --- | --- | --- |",
      ...A.map(
        batch.reports,
        (report) =>
          `| ${report.skill} | \`${shortRevision(report.sourceRevision)}\` | ${report.status} | ${hunkCounts(report)} |`
      ),
      "",
      ...A.flatMap(batch.reports, (report) => reportSection(report, budget)),
      markerOf(batch),
      "",
    ],
    "\n"
  );
};

/**
 * Reads the replay report back from a comment body, or `None` when it carries no valid marker.
 *
 * **Details**
 *
 * When a body carries several markers, the last one wins. A marker that does
 * not decode as base64url `skills-replay/v1` JSON is ignored rather than
 * failing, because comment text is untrusted input.
 *
 * **Example** (Round-trip a rendered comment)
 *
 * ```ts
 * import { readSkillReplayMarker, renderSkillReplayMarkdown } from "@beep/repo-cli/commands/Skills/SkillsRelock.render"
 * import { SkillReplayBatch } from "@beep/repo-cli/commands/Skills/SkillsRelock.schemas"
 * import * as O from "effect/Option"
 *
 * const body = renderSkillReplayMarkdown(SkillReplayBatch.make({ reports: [] }))
 * console.log(O.isSome(readSkillReplayMarker(body))) // true
 * ```
 *
 * @param body - A pull-request comment body.
 * @returns The decoded replay batch, without diffs.
 * @category parsing
 * @since 0.0.0
 */
export const readSkillReplayMarker = (body: string): O.Option<SkillReplayBatch> =>
  A.findLast(
    A.map(A.fromIterable(Str.matchAll(MARKER_PATTERN)(body)), (match) =>
      O.flatMap(O.fromUndefinedOr(match[1]), (payload) =>
        O.flatMap(Result.getSuccess(Base64Url.decodeString(payload)), (json) =>
          Result.getSuccess(decodeReplayBatchJson(json))
        )
      )
    ),
    O.isSome
  ).pipe(O.flatten);

type PullRequestReplay = { readonly pr: SkillTrainPullRequest; readonly replay: O.Option<SkillReplayBatch> };

const latestReplay = (pr: SkillTrainPullRequest): PullRequestReplay => ({
  pr,
  replay: A.findLast(
    A.map(
      A.sortWith(
        A.filter(
          pr.comments,
          (comment) =>
            comment.author !== null &&
            comment.author.login === "github-actions" &&
            Str.includes(replayHeadMarker(pr.headRefOid))(comment.body)
        ),
        (comment: SkillTrainPullRequestComment) => comment.createdAt,
        Str.Order
      ),
      (comment) => readSkillReplayMarker(comment.body)
    ),
    O.isSome
  ).pipe(O.flatten),
});

const replayVerdict = (replay: O.Option<SkillReplayBatch>): string =>
  O.match(replay, {
    onNone: () => "pending",
    onSome: (batch) =>
      A.some(batch.reports, (report) => report.status === "conflicted")
        ? "conflicted"
        : A.some(batch.reports, (report) => report.status === "fuzz-only")
          ? "fuzz-only"
          : "clean",
  });

const unresolvedOf = (
  replay: O.Option<SkillReplayBatch>
): ReadonlyArray<readonly [string, SkillHunkReport, ReadonlyArray<string>]> =>
  O.match(replay, {
    onNone: A.empty,
    onSome: (batch) =>
      A.flatMap(batch.reports, (report) =>
        A.map(
          A.filter(report.hunks, (row) => row.status !== "applied"),
          (row) => [report.skill, row, report.promoteCandidates] as const
        )
      ),
  });

const skillsOf = (entry: PullRequestReplay): string =>
  O.match(entry.replay, {
    onNone: () => "—",
    onSome: (batch) =>
      A.join(
        A.map(batch.reports, (report) => report.skill),
        ", "
      ),
  });

const unresolvedSection = (entry: PullRequestReplay): ReadonlyArray<string> => {
  const unresolved = unresolvedOf(entry.replay);
  return A.isReadonlyArrayEmpty(unresolved)
    ? A.empty()
    : [
        `### #${entry.pr.number} ${escapeCell(entry.pr.title)}`,
        "",
        ...A.map(
          unresolved,
          ([skill, row, candidates]) =>
            `- ${skill}: \`${row.patch}\` \`${row.file}\` hunk ${row.hunk === 0 ? "section" : row.hunk} — ${row.status}${strikeNote(
              candidates,
              row
            )} — \`${shortRevision(row.hunkHash)}\`${Str.isEmpty(row.detail) ? "" : ` — ${escapeCell(row.detail)}`}`
        ),
        "",
      ];
};

/**
 * Renders the parent tracking issue for one scheduled batch of skill updates (contract 9).
 *
 * **Details**
 *
 * One row per open update pull request: its skills, its replay verdict read
 * from the latest replay comment (`pending` until the workflow has posted
 * one), and its count of unresolved hunks, followed by every unresolved hunk
 * by identity. The title is stable per batch, so a re-run edits the same
 * issue. The issue never blocks a pull request: each one clears on its own.
 *
 * **Example** (Render an empty batch)
 *
 * ```ts
 * import { renderSkillTrainBatchIssue } from "@beep/repo-cli/commands/Skills/SkillsRelock.render"
 *
 * console.log(renderSkillTrainBatchIssue("2026-W42", []).title) // "Skills update train 2026-W42"
 * ```
 *
 * @param batch - The batch identifier, such as the ISO week of the scheduled run.
 * @param prs - The open update pull requests with their comments.
 * @returns The issue's stable title and rendered body.
 * @category formatting
 * @since 0.0.0
 */
export const renderSkillTrainBatchIssue: {
  (prs: ReadonlyArray<SkillTrainPullRequest>): (batch: string) => SkillTrainBatchIssue;
  (batch: string, prs: ReadonlyArray<SkillTrainPullRequest>): SkillTrainBatchIssue;
} = dual(2, (batch: string, prs: ReadonlyArray<SkillTrainPullRequest>): SkillTrainBatchIssue => {
  const entries = A.map(
    A.sortWith(prs, (pr) => pr.number, Order.Number),
    latestReplay
  );
  const verdicts = A.map(entries, (entry) => replayVerdict(entry.replay));
  const count = (verdict: string): string => `${A.length(A.filter(verdicts, (value) => value === verdict))} ${verdict}`;
  const body = A.join(
    [
      `<!-- beep-skills-train-batch:${batch} -->`,
      `# Skills update train ${batch}`,
      "",
      "Parent tracking issue for this batch's per-skill update pull requests. Each pull request clears on its own: a clean replay is relocked and merges through the normal gate, and a conflicted one waits for the review ritual (`beep skills review`, B-6) without stalling the others.",
      "",
      `${A.length(entries)} pull request(s): ${A.join(
        [count("clean"), count("fuzz-only"), count("conflicted"), count("pending")],
        ", "
      )}.`,
      "",
      ...(A.isReadonlyArrayEmpty(entries)
        ? ["_No open skill update pull requests in this batch._"]
        : [
            "| Pull request | Skills | Replay | Unresolved hunks |",
            "| --- | --- | --- | --- |",
            ...A.map(
              entries,
              (entry) =>
                `| [#${entry.pr.number}](${entry.pr.url}) ${escapeCell(entry.pr.title)} | ${skillsOf(entry)} | ${entry.replay.pipe(replayVerdict)} | ${entry.replay.pipe(unresolvedOf, A.length)} |`
            ),
          ]),
      "",
      ...(A.some(entries, (entry) => entry.replay.pipe(unresolvedOf, A.isReadonlyArrayNonEmpty))
        ? ["## Unresolved hunks", "", ...A.flatMap(entries, unresolvedSection)]
        : A.empty<string>()),
    ],
    "\n"
  );
  return SkillTrainBatchIssue.make({ batch, title: `Skills update train ${batch}`, body });
});
