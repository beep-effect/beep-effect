/**
 * Deterministic v1 JSDoc quality rubric.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, Str } from "@beep/utils";
import { Match, pipe } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import { boundedText } from "../../../../internal/cli/Timing.ts";
import { DocgenQualityFinding, DocgenQualityReview } from "./Quality.schemas.ts";
import type { DocgenQualityFindingCode, DocgenQualitySubject, DocgenQualityTier } from "./Quality.schemas.ts";

const hasTag = (tags: Record<string, ReadonlyArray<string>>, tagName: string): boolean =>
  R.has(tags, Str.replace(/^@/, "")(tagName));

const exampleHasFencedCode = (example: string): boolean => /```(?:ts|tsx|typescript)?\s*[\s\S]*?```/i.test(example);

const exampleCodeText = (example: string): string => {
  const match = /```(?:ts|tsx|typescript)?\s*([\s\S]*?)```/i.exec(example);
  return match?.[1] ?? example;
};

const exampleIsTooTrivial = (example: string): boolean => {
  const code = pipe(
    Str.split(/\r?\n/)(exampleCodeText(example)),
    A.map(Str.trim),
    A.filter(Str.isNonEmpty),
    A.filter((line) => !Str.startsWith("//")(line))
  );
  return code.length <= 1;
};

const OBSERVABLE_EXAMPLE_RESULT_PATTERN =
  /expect\s*\(|assert|return\s+|(?:Console|console)\.|Effect\.run|S\.decode|Schema\.decode|Equal\.|\.pipe\(/;
const TYPE_EVIDENCE_EXAMPLE_PATTERN =
  /\btype\s+[A-Z_a-z]\w*\s*=|\binterface\s+[A-Z_a-z]\w*|\bsatisfies\b|\bExpect<|\bEqual\.|expectTypeOf\s*\(/;
const STANDALONE_VOID_DISCARD_PATTERN = /^\s*void\s+[A-Za-z_$][\w$]*\s*;?\s*$/m;
const EMPTY_EFFECT_GEN_BODY_PATTERN =
  /Effect\.gen\s*\(\s*function\*\s*\([^)]*\)\s*\{\s*(?:\/\*[\s\S]*?\*\/\s*|\/\/[^\n\r]*(?:\r?\n|$)\s*)*\}\s*\)/m;
const EXCESSIVE_EXAMPLE_BLANK_LINES_PATTERN = /(?:^|\r?\n)(?:[ \t]*\r?\n){3,}/m;
const SYMBOL_HANDLE_METADATA_PROPERTIES_PATTERN =
  /(?:ast|Encoded|fields|identifier|Type|TypeId|annotations|annotationsFromSelf)/;

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const exampleOnlyVoidsResult = (example: string): boolean => {
  const code = exampleCodeText(example);
  return STANDALONE_VOID_DISCARD_PATTERN.test(code) && !OBSERVABLE_EXAMPLE_RESULT_PATTERN.test(code);
};

const exampleDiscardsResult = (example: string): boolean =>
  STANDALONE_VOID_DISCARD_PATTERN.test(exampleCodeText(example));

const exampleHasEmptyEffectGenBody = (example: string): boolean =>
  EMPTY_EFFECT_GEN_BODY_PATTERN.test(exampleCodeText(example));

const exampleHasExcessiveBlankLines = (example: string): boolean =>
  EXCESSIVE_EXAMPLE_BLANK_LINES_PATTERN.test(exampleCodeText(example));

const exampleHasObservableResult = (example: string): boolean =>
  OBSERVABLE_EXAMPLE_RESULT_PATTERN.test(exampleCodeText(example));

const exampleHasTypeEvidence = (example: string): boolean =>
  TYPE_EVIDENCE_EXAMPLE_PATTERN.test(exampleCodeText(example));

const exampleLogsExportSymbolHandle = (subject: DocgenQualitySubject, example: string): boolean => {
  const exportName = escapeRegExp(subject.exportName);
  const symbolHandlePattern = new RegExp(
    String.raw`\b(?:Console|console)\.(?:debug|dir|error|info|log|warn)\s*\(\s*${exportName}(?:\s*\.\s*${SYMBOL_HANDLE_METADATA_PROPERTIES_PATTERN.source})?\s*\)`,
    "m"
  );
  return symbolHandlePattern.test(exampleCodeText(example));
};

const isTypeOnlySubject = (subject: DocgenQualitySubject): boolean =>
  subject.declarationKind === "type" || subject.declarationKind === "interface";

const exampleOnlyVoidsSubjectResult = (subject: DocgenQualitySubject, example: string): boolean =>
  isTypeOnlySubject(subject) && exampleHasTypeEvidence(example) ? false : exampleOnlyVoidsResult(example);

const exampleHasSubjectEvidence = (subject: DocgenQualitySubject, example: string): boolean =>
  exampleHasObservableResult(example) || (isTypeOnlySubject(subject) && exampleHasTypeEvidence(example));

const addFinding = (
  findings: ReadonlyArray<DocgenQualityFinding>,
  finding: DocgenQualityFinding
): ReadonlyArray<DocgenQualityFinding> => A.append(findings, finding);

const makeFinding = ({
  code,
  evidence,
  message,
  remediation,
  scoreImpact,
  tier,
}: {
  readonly code: DocgenQualityFindingCode;
  readonly evidence: ReadonlyArray<string>;
  readonly message: string;
  readonly remediation: string;
  readonly scoreImpact: number;
  readonly tier: DocgenQualityTier;
}): DocgenQualityFinding =>
  DocgenQualityFinding.make({
    code,
    evidence,
    message,
    remediation,
    scoreImpact,
    tier,
  });

type ExampleFindingRule = {
  readonly when: (subject: DocgenQualitySubject, example: string) => boolean;
  readonly code: DocgenQualityFindingCode;
  readonly evidence: (example: string) => ReadonlyArray<string>;
  readonly message: string;
  readonly remediation: string;
  readonly scoreImpact: number;
  readonly tier: DocgenQualityTier;
};

const exampleCodeEvidence = (example: string): ReadonlyArray<string> => [boundedText(exampleCodeText(example), 160)];

// Per-example checks as a data catalog: a new rule is one array entry, folded over
// parsedExamples in order — not another imperative `if (...) findings = addFinding(...)` block.
const EXAMPLE_FINDING_RULES: ReadonlyArray<ExampleFindingRule> = [
  {
    when: (_subject, example) => !exampleHasFencedCode(example),
    code: "example-not-code-fenced",
    evidence: (example) => [boundedText(example, 160)],
    message: "@example should include a fenced TypeScript code block.",
    remediation: "Wrap the example in a ```ts fenced block so docgen can validate it.",
    scoreImpact: 1,
    tier: "warn",
  },
  {
    when: (_subject, example) => exampleIsTooTrivial(example),
    code: "example-too-trivial",
    evidence: exampleCodeEvidence,
    message: "@example is too small to teach meaningful use.",
    remediation: "Show a realistic call site with setup, input, and an observable result.",
    scoreImpact: 2,
    tier: "warn",
  },
  {
    when: (subject, example) => exampleOnlyVoidsSubjectResult(subject, example),
    code: "example-only-voids-result",
    evidence: exampleCodeEvidence,
    message: "@example only silences the result instead of showing what matters.",
    remediation: "Replace `void result` with an assertion, returned value, or visible decoded value.",
    scoreImpact: 2,
    tier: "warn",
  },
  {
    when: (_subject, example) => exampleDiscardsResult(example),
    code: "example-discards-result",
    evidence: exampleCodeEvidence,
    message: "@example discards a value with a standalone `void` line.",
    remediation: "Remove the standalone `void` discard and show a visible result, assertion, or type-level evidence.",
    scoreImpact: 2,
    tier: "warn",
  },
  {
    when: (subject, example) => exampleLogsExportSymbolHandle(subject, example),
    code: "example-logs-export-symbol",
    evidence: exampleCodeEvidence,
    message: "@example logs the exported symbol handle instead of demonstrating behavior.",
    remediation:
      "Replace symbol-handle logging with construction, decoding, Effect execution, type evidence, or an observable domain result.",
    scoreImpact: 2,
    tier: "warn",
  },
  {
    when: (_subject, example) => exampleHasEmptyEffectGenBody(example),
    code: "example-empty-effect-gen",
    evidence: exampleCodeEvidence,
    message: "@example contains an empty Effect.gen block.",
    remediation: "Replace the empty generator body with a real yielded operation or use a simpler non-Effect example.",
    scoreImpact: 2,
    tier: "warn",
  },
  {
    when: (_subject, example) => exampleHasExcessiveBlankLines(example),
    code: "example-too-many-blank-lines",
    evidence: exampleCodeEvidence,
    message: "@example contains three or more consecutive blank lines.",
    remediation: "Remove empty padding so the fenced code block stays compact and readable.",
    scoreImpact: 1,
    tier: "warn",
  },
];

const exampleFindings = (subject: DocgenQualitySubject): ReadonlyArray<DocgenQualityFinding> =>
  A.flatMap(subject.parsedExamples, (example) =>
    A.flatMap(EXAMPLE_FINDING_RULES, (rule) =>
      rule.when(subject, example)
        ? [
            makeFinding({
              code: rule.code,
              evidence: rule.evidence(example),
              message: rule.message,
              remediation: rule.remediation,
              scoreImpact: rule.scoreImpact,
              tier: rule.tier,
            }),
          ]
        : A.empty<DocgenQualityFinding>()
    )
  );

/**
 * Score one exported-symbol JSDoc subject with the deterministic v1 rubric.
 *
 * @param subject - Subject packet collected from package source.
 * @returns Review result with score, tier, findings, and rationale.
 * @example
 * ```ts
 * import { scoreSubject } from "@beep/repo-cli/commands/Docgen/internal/quality/Quality.rubric"
 * import { DocgenQualitySubject } from "@beep/repo-cli/commands/Docgen/internal/quality/Quality.schemas"
 *
 * const subject = DocgenQualitySubject.make({
 *   packageName: "@beep/repo-cli",
 *   packagePath: "packages/tooling/tool/cli",
 *   filePath: "src/index.ts",
 *   repoPath: "packages/tooling/tool/cli/src/index.ts",
 *   sourceAnchor: "packages/tooling/tool/cli/src/index.ts:1",
 *   exportName: "docgenCommand",
 *   declarationKind: "const",
 *   signature: "export const docgenCommand = Command.make(...)",
 *   declarationSource: "export const docgenCommand = Command.make(...)",
 *   rawJsDoc: "/** Docgen command.\\n * @category cli-commands\\n * @example\\n * ```ts\\n * console.log('docgen')\\n * ```\\n * @since 0.0.0\\n * /",
 *   description: "Docgen command.",
 *   tags: { category: ["cli-commands"], example: ["```ts\\nconsole.log('docgen')\\n```"], since: ["0.0.0"] },
 *   parsedExamples: ["```ts\\nconsole.log('docgen')\\n```"],
 *   generatedDocSnippet: null,
 *   stableIdentity: "subject:abc123",
 *   contentHash: "abc123",
 *   diagnostics: [],
 *   relatedSymbols: [],
 *   deterministicMissingTags: [],
 *   categoryValues: ["cli-commands"],
 *   categoryIssues: []
 * })
 * console.log(scoreSubject(subject).tier)
 * ```
 * @category validation
 * @since 0.0.0
 */
export const scoreSubject = (subject: DocgenQualitySubject): DocgenQualityReview => {
  let findings: ReadonlyArray<DocgenQualityFinding> = A.empty();

  if (subject.description === null || Str.trim(subject.description).length === 0) {
    findings = addFinding(
      findings,
      makeFinding({
        code: "missing-description",
        evidence: [subject.sourceAnchor],
        message: "JSDoc is missing a useful description.",
        remediation: "Add a short description that explains the exported symbol's purpose.",
        scoreImpact: 3,
        tier: "fail",
      })
    );
  }

  for (const tag of subject.deterministicMissingTags) {
    const code = Match.value(tag).pipe(
      Match.when("@example", () => "missing-example" as const),
      Match.when("@category", () => "missing-category" as const),
      Match.orElse(() => "missing-since" as const)
    );
    findings = addFinding(
      findings,
      makeFinding({
        code,
        evidence: [subject.sourceAnchor],
        message: `JSDoc is missing required ${tag}.`,
        remediation:
          tag === "@example"
            ? "Add a realistic @example that shows meaningful input and observable output."
            : `Add ${tag} using the repo's documented JSDoc conventions.`,
        scoreImpact: tag === "@example" ? 4 : 3,
        tier: "fail",
      })
    );
  }

  for (const issue of subject.categoryIssues) {
    findings = addFinding(
      findings,
      makeFinding({
        code: "invalid-category",
        evidence: [issue],
        message: issue,
        remediation: "Use one canonical @category value from the repo taxonomy.",
        scoreImpact: 3,
        tier: "fail",
      })
    );
  }

  findings = A.appendAll(findings, exampleFindings(subject));

  if (
    subject.parsedExamples.length > 0 &&
    !A.some(subject.parsedExamples, (example) => exampleHasSubjectEvidence(subject, example))
  ) {
    findings = addFinding(
      findings,
      makeFinding({
        code: "example-lacks-observable-result",
        evidence: [subject.sourceAnchor],
        message: "@example does not show an observable result or assertion.",
        remediation: "Make the example demonstrate the output, assertion, Effect execution, or decoded value.",
        scoreImpact: 2,
        tier: "warn",
      })
    );
  }

  if (/Effect([.<])/.test(subject.signature) && !hasTag(subject.tags, "@effects")) {
    findings = addFinding(
      findings,
      makeFinding({
        code: "missing-effects-for-effectful-symbol",
        evidence: [subject.signature],
        message: "Effectful API lacks an @effects note.",
        remediation: "Add @effects to name required services, expected failures, or execution behavior.",
        scoreImpact: 1,
        tier: "warn",
      })
    );
  }

  const score = Math.max(1, 10 - A.reduce(findings, 0, (total, finding) => total + finding.scoreImpact));
  const tier: DocgenQualityTier = pipe(
    [
      pipe(
        A.some(findings, (finding) => finding.tier === "fail"),
        O.liftPredicate(P.isTruthy),
        O.as("fail" as const)
      ),
      pipe(score < 8 || A.isReadonlyArrayNonEmpty(findings), O.liftPredicate(P.isTruthy), O.as("warn" as const)),
    ] satisfies ReadonlyArray<O.Option<DocgenQualityTier>>,
    O.firstSomeOf,
    O.getOrElse(() => "pass" as const)
  );
  const rationale =
    findings.length === 0
      ? "JSDoc block supplies the required tags, useful description, and a meaningful example."
      : A.join(
          pipe(
            findings,
            A.take(3),
            A.map((finding) => finding.message)
          ),
          " "
        );

  return DocgenQualityReview.make({
    subjectId: subject.stableIdentity,
    tier,
    score,
    findings,
    rationale,
  });
};
