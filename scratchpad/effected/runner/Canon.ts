/**
 * The S3 checks the vitest run cannot prove by itself: the effect-vitest canon
 * detectors (EV001-EV015) over a module's tests, and per-file 100 percent
 * coverage read back from the coverage summary so an `include` that matched
 * nothing cannot pass.
 *
 * **Details**
 *
 * `beep lint effect-vitest` scopes itself to `apps/**`, `packages/**` and
 * `infra/**` (effect-vitest-canon D9), so the gate drives the exported
 * detectors directly over the lab's test files.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { detectEffectVitestFindings } from "@beep/repo-cli/commands/Lint";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { Project } from "ts-morph";
import { ManifestInvalid } from "./Audit.errors.ts";
import { listTsFiles } from "./Copy.ts";
import type { AuditTarget } from "./Ledger.schema.ts";
import { labPaths, type RunnerConfig } from "./Paths.ts";

/**
 * A ledgered canon exception: the detector finding id and why the finding is
 * accepted (effect-vitest-canon D1: judgment findings are fixed or ledgered).
 *
 * **Example** (Decode an exception file)
 *
 * ```ts
 * import { CanonExceptions } from "@beep/scratchpad/effected/runner/Canon"
 * import * as S from "effect/Schema"
 *
 * const rows = S.decodeUnknownSync(CanonExceptions)('[{"id":"EV009:a.ts:1:it.live@0#1","reason":"needs the live clock"}]')
 * console.log(rows[0]?.reason) // "needs the live clock"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CanonExceptions = S.Struct({ id: S.NonEmptyString, reason: S.NonEmptyString }).pipe(
  S.Array,
  S.fromJsonString
);

const decodeExceptions = S.decodeUnknownEffect(CanonExceptions);

/**
 * The canon verdict for one target: open findings, excepted findings with
 * their reasons, and exception rows that no longer match a finding.
 *
 * @category type-level
 * @since 0.0.0
 */
export interface CanonVerdict {
  readonly open: ReadonlyArray<string>;
  readonly excepted: ReadonlyArray<string>;
  readonly stale: ReadonlyArray<string>;
}

/**
 * Every canon finding over a target's test files, as `file:line ruleId class`.
 *
 * **Example** (Scan a module's tests)
 *
 * ```ts
 * import { canonFindings } from "@beep/scratchpad/effected/runner/Canon"
 * import { RunnerConfig } from "@beep/scratchpad/effected/runner/Paths"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(canonFindings(RunnerConfig.make({ repoRoot: "/repo", upstreamRoot: "/up" }), "jsonc"))) // true
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export const canonFindings = Effect.fn("Canon.findings")(function* (config: RunnerConfig, target: AuditTarget) {
  const path = yield* Path.Path;
  const lab = labPaths(target);
  const files = yield* listTsFiles(config.repoRoot, lab.testDir);
  const project = new Project({ skipAddingFilesFromTsConfig: true });
  const findings = yield* Effect.forEach(files, (file) =>
    detectEffectVitestFindings(project.addSourceFileAtPath(path.join(config.repoRoot, file)), file, "@beep/scratchpad")
  );
  const all = A.flatten(findings);
  const fs = yield* FileSystem.FileSystem;
  const exceptionsFile = path.join(config.repoRoot, lab.sourceDir, ".canon-exceptions.json");
  const exceptions = (yield* fs.exists(exceptionsFile))
    ? yield* decodeExceptions(yield* fs.readFileString(exceptionsFile)).pipe(
        Effect.mapError((issue) => ManifestInvalid.make({ path: `${lab.sourceDir}/.canon-exceptions.json`, detail: String(issue) }))
      )
    : [];
  const reasonFor = (id: string) => O.map(A.findFirst(exceptions, (row) => row.id === id), (row) => row.reason);
  const render = (finding: (typeof all)[number]) => `${finding.file}:${finding.line} ${finding.ruleId} ${finding.class} [${finding.id}]`;
  const verdict: CanonVerdict = {
    open: A.map(A.filter(all, (finding) => O.isNone(reasonFor(finding.id))), render),
    excepted: A.filterMap(all, (finding) =>
      O.match(reasonFor(finding.id), {
        onNone: () => Result.failVoid,
        onSome: (reason) => Result.succeed(`${render(finding)}: ${reason}`),
      })
    ),
    stale: A.map(
      A.filter(exceptions, (row) => !A.some(all, (finding) => finding.id === row.id)),
      (row) => `${row.id} (no matching finding)`
    ),
  };
  return verdict;
});

const Metric = S.Struct({ pct: S.Finite });
const FileSummary = S.Struct({ statements: Metric, branches: Metric, functions: Metric, lines: Metric });
const CoverageSummary = S.fromJsonString(S.Record(S.String, FileSummary));
const decodeSummary = S.decodeUnknownEffect(CoverageSummary);

/**
 * Source files missing from the coverage summary or below 100 percent on any
 * metric, as `file metric=pct` lines; empty when coverage is complete.
 *
 * **Example** (Check a module's coverage summary)
 *
 * ```ts
 * import { coverageGaps } from "@beep/scratchpad/effected/runner/Canon"
 * import { RunnerConfig } from "@beep/scratchpad/effected/runner/Paths"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(coverageGaps(RunnerConfig.make({ repoRoot: "/repo", upstreamRoot: "/up" }), "jsonc"))) // true
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export const coverageGaps = Effect.fn("Canon.coverageGaps")(function* (config: RunnerConfig, target: AuditTarget) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const lab = labPaths(target);
  const summaryFile = path.join(config.repoRoot, lab.coverageDir, "coverage-summary.json");
  if (!(yield* fs.exists(summaryFile))) {
    return [`${lab.coverageDir}/coverage-summary.json missing`];
  }
  const summary = yield* decodeSummary(yield* fs.readFileString(summaryFile)).pipe(
    Effect.mapError((issue) => ManifestInvalid.make({ path: `${lab.coverageDir}/coverage-summary.json`, detail: String(issue) }))
  );
  const sources = yield* listTsFiles(config.repoRoot, lab.sourceDir);
  return A.flatMap(sources, (file) =>
    O.match(R.get(summary, path.join(config.repoRoot, file)), {
      onNone: () => [`${file} absent from the coverage summary`],
      onSome: (entry) =>
        A.flatMap(
          [
            ["statements", entry.statements.pct],
            ["branches", entry.branches.pct],
            ["functions", entry.functions.pct],
            ["lines", entry.lines.pct],
          ] as const,
          ([metric, pct]) => (pct < 100 ? [`${file} ${metric}=${pct}`] : [])
        ),
    })
  );
});
