/**
 * Fallow CI workflow contract diagnostics.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A } from "@beep/utils";
import { pipe } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const decodeUnknownRecordOption = S.decodeUnknownOption(S.Record(S.String, S.Unknown));
const decodeUnknownArrayOption = S.decodeUnknownOption(S.Array(S.Unknown));

const csvValues = (value: string): ReadonlyArray<string> =>
  pipe(Str.split(value, ","), A.map(Str.trim), A.filter(Str.isNonEmpty));

const unknownRecordProperty = (value: unknown, key: string): O.Option<unknown> =>
  pipe(
    decodeUnknownRecordOption(value),
    O.flatMap((record) => O.fromUndefinedOr(record[key]))
  );

const unknownStringProperty = (value: unknown, key: string): O.Option<string> =>
  pipe(unknownRecordProperty(value, key), O.filter(P.isString));

const unknownArrayProperty = (value: unknown, key: string): O.Option<ReadonlyArray<unknown>> =>
  pipe(unknownRecordProperty(value, key), O.flatMap(decodeUnknownArrayOption));

const nonCommentLines = (text: string): ReadonlyArray<string> =>
  pipe(
    Str.split(text, "\n"),
    A.map(Str.trim),
    A.filter(Str.isNonEmpty),
    A.filter((line) => !Str.startsWith("#")(line))
  );

const stepStringValues = (steps: ReadonlyArray<unknown>, key: string): ReadonlyArray<string> =>
  pipe(
    steps,
    A.flatMap((step) => O.toArray(unknownStringProperty(step, key)))
  );

const uploadWithString = (step: unknown, key: string): O.Option<string> =>
  pipe(
    unknownRecordProperty(step, "with"),
    O.flatMap((withRecord) => unknownStringProperty(withRecord, key))
  );

const uploadWithStringEquals = (step: unknown, key: string, expected: string): boolean =>
  pipe(
    uploadWithString(step, key),
    O.match({
      onNone: () => false,
      onSome: (actual) => Str.Equivalence(actual, expected),
    })
  );

const missingDiagnostic = (condition: boolean, diagnostic: string): ReadonlyArray<string> =>
  condition ? A.empty() : A.of(diagnostic);

const presentDiagnostic = (condition: boolean, diagnostic: string): ReadonlyArray<string> =>
  condition ? A.of(diagnostic) : A.empty();

const laneEnvelopeDiagnostics = (
  lanes: ReadonlyArray<string>,
  jobRunBody: string,
  hasLaneEnvelopeTemplate: boolean,
  expectedPath: (lane: string) => string,
  message: (lane: string) => string
): ReadonlyArray<string> =>
  A.flatMap(lanes, (lane) =>
    missingDiagnostic(hasLaneEnvelopeTemplate || Str.includes(expectedPath(lane))(jobRunBody), message(lane))
  );

const laneNameDiagnostics = (
  lanes: ReadonlyArray<string>,
  jobRunBody: string,
  message: (lane: string) => string
): ReadonlyArray<string> =>
  A.flatMap(lanes, (lane) => missingDiagnostic(Str.includes(lane)(jobRunBody), message(lane)));

const fallowCiRequiredTextDiagnostics = (
  jobRunBody: string,
  blockingLanes: ReadonlyArray<string>,
  advisory: boolean,
  delegated: boolean
): ReadonlyArray<string> => [
  ...missingDiagnostic(
    delegated || Str.includes("bun run beep quality fallow")(jobRunBody),
    "missing repo-cli Fallow envelope invocation"
  ),
  ...presentDiagnostic(
    Str.includes("bun run fallow:audit")(jobRunBody),
    "CI must not use raw fallow:audit pilot command"
  ),
  ...missingDiagnostic(
    Str.includes("beep quality fallow envelope-check")(jobRunBody),
    "missing hard envelope-check validation step"
  ),
  ...missingDiagnostic(Str.includes("--expect-subcommand")(jobRunBody), "missing envelope-check subcommand assertion"),
  ...missingDiagnostic(Str.includes("--expect-report-path")(jobRunBody), "missing envelope-check reportPath assertion"),
  ...missingDiagnostic(Str.includes("--require-raw-output")(jobRunBody), "missing envelope-check raw output proof"),
  ...missingDiagnostic(
    Str.includes("|| fetch_status=$?")(jobRunBody) && Str.includes("base_fetch_status")(jobRunBody),
    "base fetch must be best-effort so Fallow wrappers can emit base-resolution envelopes"
  ),
  ...missingDiagnostic(
    delegated || A.isReadonlyArrayEmpty(blockingLanes) || Str.includes("--check")(jobRunBody),
    "missing blocking Fallow --check invocation"
  ),
  ...missingDiagnostic(
    delegated || !advisory || Str.includes("--advisory")(jobRunBody),
    "missing advisory Fallow invocation"
  ),
];

const fallowCiUploadDiagnostics = (
  requireUpload: boolean,
  jobUsesValues: ReadonlyArray<string>,
  uploadArtifactSteps: ReadonlyArray<unknown>,
  expectOutDir: string,
  ifNoFilesFound: string
): ReadonlyArray<string> => [
  ...missingDiagnostic(
    !requireUpload || A.some(uploadArtifactSteps, (step) => uploadWithStringEquals(step, "path", `${expectOutDir}/**`)),
    `missing upload of complete Fallow output tree: ${expectOutDir}/**`
  ),
  ...presentDiagnostic(
    requireUpload && !A.some(jobUsesValues, Str.includes("actions/upload-artifact")),
    "missing actions/upload-artifact step"
  ),
  ...presentDiagnostic(
    requireUpload &&
      !A.some(uploadArtifactSteps, (step) => uploadWithStringEquals(step, "if-no-files-found", ifNoFilesFound)),
    `missing if-no-files-found: ${ifNoFilesFound}`
  ),
];

const fallowCiLaneDiagnostics = (
  lanes: ReadonlyArray<string>,
  blockingLanes: ReadonlyArray<string>,
  expectOutDir: string,
  jobRunBody: string,
  jobRunLines: ReadonlyArray<string>,
  hasLaneEnvelopeTemplate: boolean,
  delegated: boolean
): ReadonlyArray<string> => {
  const expectedLaneLoop = `for lane in ${A.join(lanes, " ")}; do`;
  const expectedBlockingLaneLoop = `for lane in ${A.join(blockingLanes, " ")}; do`;

  return [
    ...missingDiagnostic(
      delegated || A.length(A.filter(jobRunLines, (line) => Str.Equivalence(line, expectedLaneLoop))) >= 2,
      `missing run and validation loops over expected Fallow lanes: ${expectedLaneLoop}`
    ),
    ...missingDiagnostic(
      A.isReadonlyArrayEmpty(blockingLanes) ||
        delegated ||
        A.length(A.filter(jobRunLines, (line) => Str.Equivalence(line, expectedBlockingLaneLoop))) >= 2,
      `missing run and validation loops over expected promoted blocking Fallow lanes: ${expectedBlockingLaneLoop}`
    ),
    ...laneEnvelopeDiagnostics(
      lanes,
      jobRunBody,
      hasLaneEnvelopeTemplate,
      (lane) => `${expectOutDir}/${lane}.${A.contains(blockingLanes, lane) ? "check" : "advisory"}.json`,
      (lane) =>
        `missing CI envelope path for ${lane}: ${expectOutDir}/${lane}.${A.contains(blockingLanes, lane) ? "check" : "advisory"}.json`
    ),
    ...laneEnvelopeDiagnostics(
      blockingLanes,
      jobRunBody,
      hasLaneEnvelopeTemplate,
      (lane) => `${expectOutDir}/${lane}.check.json`,
      (lane) => `missing CI envelope path for promoted blocking lane ${lane}: ${expectOutDir}/${lane}.check.json`
    ),
    ...laneNameDiagnostics(lanes, jobRunBody, (lane) => `missing CI advisory lane name ${lane}`),
    ...laneNameDiagnostics(blockingLanes, jobRunBody, (lane) => `missing promoted blocking CI lane name ${lane}`),
  ];
};

/**
 * Fallow CI workflow contract options.
 *
 * **Example** (Annotate a value as FallowCiContractDiagnosticOptions)
 *
 * ```ts
 * import type { FallowCiContractDiagnosticOptions } from "@beep/repo-cli/test/Quality"
 *
 * const options: FallowCiContractDiagnosticOptions = {
 *   expectLanes: "audit",
 *   expectBlockingLanes: "",
 *   expectOutDir: ".beep/fallow",
 *   requireUpload: false,
 *   ifNoFilesFound: "error",
 *   advisory: true
 * }
 * console.log(options.expectOutDir)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
type FallowCiContractDiagnosticOptions = {
  readonly expectLanes: string;
  readonly expectBlockingLanes: string;
  readonly expectOutDir: string;
  readonly requireUpload: boolean;
  readonly ifNoFilesFound: string;
  readonly advisory: boolean;
};

/**
 * Return Fallow CI upload diagnostics for contract tests.
 *
 * **Example** (Collect upload diagnostics)
 *
 * ```ts
 * import { fallowCiUploadDiagnosticsForTesting } from "@beep/repo-cli/commands/Quality/FallowQuality.command"
 *
 * const diagnostics = fallowCiUploadDiagnosticsForTesting(false, [], [], ".beep/fallow", "error")
 * console.log(diagnostics) // example value
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const fallowCiUploadDiagnosticsForTesting: {
  (
    jobUsesValues: ReadonlyArray<string>,
    uploadArtifactSteps: ReadonlyArray<unknown>,
    expectOutDir: string,
    ifNoFilesFound: string
  ): (requireUpload: boolean) => ReadonlyArray<string>;
  (
    requireUpload: boolean,
    jobUsesValues: ReadonlyArray<string>,
    uploadArtifactSteps: ReadonlyArray<unknown>,
    expectOutDir: string,
    ifNoFilesFound: string
  ): ReadonlyArray<string>;
} = dual(5, fallowCiUploadDiagnostics);

/**
 * Validate the parsed Fallow CI workflow contract.
 *
 * **Example** (Diagnose an empty CI contract)
 *
 * ```ts
 * import { fallowCiContractDiagnostics } from "@beep/repo-cli/test/Quality"
 *
 * console.log(fallowCiContractDiagnostics({}, {
 *   expectLanes: "",
 *   expectBlockingLanes: "",
 *   expectOutDir: ".beep/fallow",
 *   requireUpload: false,
 *   ifNoFilesFound: "error",
 *   advisory: true
 * }))
 * ```
 *
 * @param workflow - Parsed workflow document.
 * @param options - CI lane and artifact expectations.
 * @returns Diagnostics for every violated Fallow CI invariant.
 * @category validation
 * @since 0.0.0
 */
export const fallowCiContractDiagnostics: {
  (workflow: unknown, options: FallowCiContractDiagnosticOptions): ReadonlyArray<string>;
  (options: FallowCiContractDiagnosticOptions): (workflow: unknown) => ReadonlyArray<string>;
} = dual(2, (workflow: unknown, options: FallowCiContractDiagnosticOptions): ReadonlyArray<string> => {
  const fallowJob = pipe(
    unknownRecordProperty(workflow, "jobs"),
    O.flatMap((jobs) => unknownRecordProperty(jobs, "fallow-advisory"))
  );
  const fallowSteps = pipe(
    fallowJob,
    O.flatMap((job) => unknownArrayProperty(job, "steps")),
    O.getOrElse(A.empty<unknown>)
  );
  const jobRunText = A.join(stepStringValues(fallowSteps, "run"), "\n");
  const jobRunLines = nonCommentLines(jobRunText);
  const jobRunBody = A.join(jobRunLines, "\n");
  const jobUsesValues = stepStringValues(fallowSteps, "uses");
  const uploadArtifactSteps = A.filter(fallowSteps, (step) => {
    const uses = unknownStringProperty(step, "uses");
    return O.isSome(uses) && Str.includes("actions/upload-artifact")(uses.value);
  });
  const lanes = csvValues(options.expectLanes);
  const blockingLanes = csvValues(options.expectBlockingLanes);
  const hasLaneEnvelopeTemplate =
    (Str.includes(`${options.expectOutDir}/\${lane}.advisory.json`)(jobRunBody) &&
      Str.includes(`${options.expectOutDir}/\${lane}.check.json`)(jobRunBody)) ||
    (Str.includes(`${options.expectOutDir}/$lane.advisory.json`)(jobRunBody) &&
      Str.includes(`${options.expectOutDir}/$lane.check.json`)(jobRunBody));
  const delegatesLaneExecution = Str.includes("bun run beep ci lane fallow")(jobRunBody);

  return [
    ...missingDiagnostic(O.isSome(fallowJob), "missing fallow-advisory workflow job id"),
    ...fallowCiLaneDiagnostics(
      lanes,
      blockingLanes,
      options.expectOutDir,
      jobRunBody,
      jobRunLines,
      hasLaneEnvelopeTemplate,
      delegatesLaneExecution
    ),
    ...fallowCiRequiredTextDiagnostics(jobRunBody, blockingLanes, options.advisory, delegatesLaneExecution),
    ...fallowCiUploadDiagnostics(
      options.requireUpload,
      jobUsesValues,
      uploadArtifactSteps,
      options.expectOutDir,
      options.ifNoFilesFound
    ),
  ];
});
