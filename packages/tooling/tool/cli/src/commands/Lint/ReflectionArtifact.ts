/**
 * Reflection-artifact inventory and enforcement command.
 *
 * Verifies that completed goal packets carry a schema-valid closeout reflection
 * under `goals/<slug>/history/reflections/<YYYY-MM-DD>-<agent>.md`. Packets that
 * opt in via `reflectionRequired: true` in their manifest record the intent
 * explicitly, but all completed packets are gated once they lack a valid
 * reflection artifact.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { decodeYamlTextAs, LiteralKit } from "@beep/schema";
import { A } from "@beep/utils";
import { Console, Effect, FileSystem, Path, pipe } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { Command } from "effect/unstable/cli";
import { parse } from "jsonc-parser";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.js";
import { optionalProp } from "../../internal/cli/OptionRecord.js";
import { makePolicyFindingLogger } from "../../internal/cli/PolicyFindingLogger.js";
import { GoalStatus } from "../Goals/Goals.schemas.js";

const $I = $RepoCliId.create("commands/Lint/ReflectionArtifact");

const GOALS_DIR = "goals";
const TEMPLATE_SLUG = "_template";
const REFLECTIONS_SUBDIR = ["history", "reflections"] as const;
const REFLECTION_FILE_PATTERN = /^\d{4}-\d{2}-\d{2}-.+\.md$/;
// Derived from the canonical status domain (goals-doctor D7): only
// `completed-retained` gates reflections; `superseded` packets are exempt and
// get a doctor advisory when they carry no supersession pointer.
const COMPLETED_STATUS_TOKENS: ReadonlyArray<string> = [GoalStatus.Enum["completed-retained"]];

const ReflectionConfidence = LiteralKit(["high", "medium", "low"]).pipe(
  $I.annoteSchema("ReflectionConfidence", {
    description: "Confidence tier for a reflection and its individual findings.",
  })
);

const ReflectionTrigger = LiteralKit(["closeout", "on-demand", "todo-codify"]).pipe(
  $I.annoteSchema("ReflectionTrigger", {
    description: "What prompted a reflection artifact to be written.",
  })
);

const ReflectionFindingCategory = LiteralKit([
  "tooling-friction",
  "implementation-improvement",
  "goal-critique",
  "prompt-critique",
  "codification-todo",
]).pipe(
  $I.annoteSchema("ReflectionFindingCategory", {
    description: "Category of an individual reflection finding.",
  })
);

class ReflectionFinding extends S.Class<ReflectionFinding>($I`ReflectionFinding`)(
  {
    category: ReflectionFindingCategory,
    confidence: ReflectionConfidence,
    instruction: S.String,
    explanation: S.String,
  },
  $I.annote("ReflectionFinding", {
    description: "One information-rich reflection finding (what to change plus why).",
  })
) {}

class ReflectionFrontmatter extends S.Class<ReflectionFrontmatter>($I`ReflectionFrontmatter`)(
  {
    goal: S.String,
    agent: S.String,
    date: S.String,
    trigger: ReflectionTrigger,
    confidence: ReflectionConfidence,
    findings: S.Array(ReflectionFinding).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<ReflectionFinding>())),
      S.withDecodingDefault(Effect.succeed(A.empty<ReflectionFinding.Encoded>()))
    ),
    todos: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<string>())),
      S.withDecodingDefault(Effect.succeed(A.empty<string>()))
    ),
  },
  $I.annote("ReflectionFrontmatter", {
    description: "Schema-validated YAML frontmatter for a goal-packet reflection artifact.",
  })
) {}

/**
 * Namespace for {@link ReflectionFinding} companion types.
 *
 * @example
 * ```ts
 * console.log("ReflectionFinding")
 * ```
 * @category models
 * @since 0.0.0
 */
export declare namespace ReflectionFinding {
  /**
   * Encoded representation of {@link ReflectionFinding}.
   *
   * @example
   * ```ts
   * console.log("Encoded")
   * ```
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof ReflectionFinding.Encoded;
}

const ReflectionPolicySeverity = LiteralKit(["warning", "error"]).pipe(
  $I.annoteSchema("ReflectionPolicySeverity", {
    description: "Severity emitted by reflection-artifact lint findings.",
  })
);

class ReflectionPolicyFinding extends S.Class<ReflectionPolicyFinding>($I`ReflectionPolicyFinding`)(
  {
    category: S.Literal("reflection-policy"),
    ruleId: S.Literal("reflection-artifact"),
    severity: ReflectionPolicySeverity,
    goal: S.String,
    file: S.optionalKey(S.String),
    message: S.String,
    remediation: S.String,
  },
  $I.annote("ReflectionPolicyFinding", {
    description: "Machine-readable reflection-artifact lint finding consumed by Yeet quality issue packets.",
  })
) {}

const encodePolicyFinding = S.encodeUnknownEffect(ReflectionPolicyFinding);

const { log: logPolicyFinding } = makePolicyFindingLogger({
  issuePrefix: "[reflection:issue] ",
  encode: encodePolicyFinding,
  renderSummary: (finding: ReflectionPolicyFinding) =>
    `- ${finding.goal}${finding.file !== undefined ? ` :: ${finding.file}` : ""} [${finding.severity}] ${finding.message}`,
});

const decodeFrontmatter = decodeYamlTextAs(ReflectionFrontmatter);

const normalizeFrontmatterNewlines = Str.replace(/\r\n/g, "\n");

const extractFrontmatter = (raw: string): O.Option<string> => {
  const normalized = normalizeFrontmatterNewlines(raw);
  if (!Str.startsWith("---")(normalized)) {
    return O.none();
  }
  const rest = Str.slice(3)(normalized);
  return pipe(
    Str.indexOf("\n---")(rest),
    O.map((endIndex) => Str.trim(Str.slice(0, endIndex)(rest)))
  );
};

const frontmatterIsValid = (raw: string): Effect.Effect<boolean> =>
  O.match(extractFrontmatter(raw), {
    onNone: () => Effect.succeed(false),
    onSome: (yamlText) =>
      decodeFrontmatter(yamlText).pipe(
        Effect.map(() => true),
        Effect.orElseSucceed(() => false)
      ),
  });

/**
 * Whether a raw reflection file's YAML frontmatter decodes as
 * `ReflectionFrontmatter`.
 *
 * Shared with `beep goals doctor`, which validates reflections in every
 * packet (not only completed ones).
 *
 * @param raw - Full reflection file content.
 * @returns Whether the frontmatter block exists and decodes.
 * @example
 * ```ts
 * import { reflectionFrontmatterIsValid } from "@beep/repo-cli/commands/Lint/ReflectionArtifact"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(reflectionFrontmatterIsValid("---\n---\n")))
 * ```
 * @category validation
 * @since 0.0.0
 */
export const reflectionFrontmatterIsValid = frontmatterIsValid;

/**
 * Whether a file name matches the reflection-artifact naming convention
 * (`<YYYY-MM-DD>-<agent>.md`).
 *
 * @param file - File name inside `history/reflections/`.
 * @returns Whether the name is a reflection artifact.
 * @example
 * ```ts
 * import { reflectionFileNameIsArtifact } from "@beep/repo-cli/commands/Lint/ReflectionArtifact"
 *
 * console.log(reflectionFileNameIsArtifact("2026-07-11-claude.md")) // true
 * console.log(reflectionFileNameIsArtifact("_TEMPLATE.md")) // false
 * ```
 * @category validation
 * @since 0.0.0
 */
export const reflectionFileNameIsArtifact = (file: string): boolean => REFLECTION_FILE_PATTERN.test(file);

const readManifestStatus = (manifest: unknown): { readonly status: string; readonly reflectionRequired: boolean } => {
  const record = (manifest ?? {}) as Record<string, unknown>;
  const initiative = (record.initiative ?? {}) as Record<string, unknown>;
  const status = [initiative.status, record.status, record.lifecycle]
    .map((value) => (P.isString(value) ? value : ""))
    .find((value) => value.length > 0);
  const reflectionRequired = record.reflectionRequired === true || initiative.reflectionRequired === true;
  return { status: status ?? "", reflectionRequired };
};

const makeFinding = (
  goal: string,
  severity: "warning" | "error",
  message: string,
  remediation: string,
  file?: string
): ReflectionPolicyFinding =>
  ReflectionPolicyFinding.make({
    category: "reflection-policy",
    ruleId: "reflection-artifact",
    severity,
    goal,
    ...optionalProp("file", O.fromUndefinedOr(file)),
    message,
    remediation,
  });

const REMEDIATION =
  "Write a closeout reflection at goals/<slug>/history/reflections/<YYYY-MM-DD>-<agent>.md via the /reflect skill (copy goals/_template/history/reflections/_TEMPLATE.md); its YAML frontmatter must validate against ReflectionFrontmatter.";

/**
 * Verifies completed goal packets carry a schema-valid closeout reflection.
 *
 * @example
 * ```ts
 * console.log("runReflectionArtifactLint")
 * ```
 * @category commands
 * @since 0.0.0
 */
export const runReflectionArtifactLint = Effect.fn(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const blocking: Array<ReflectionPolicyFinding> = [];
  const advisories: Array<ReflectionPolicyFinding> = [];

  const goalSlugs = yield* fs.readDirectory(GOALS_DIR).pipe(Effect.orElseSucceed(A.empty<string>));

  for (const slug of goalSlugs) {
    if (slug === TEMPLATE_SLUG) {
      continue;
    }
    const manifestPath = path.join(GOALS_DIR, slug, "ops", "manifest.json");
    const manifestRead = yield* fs
      .readFileString(manifestPath)
      .pipe(Effect.map(O.some), Effect.orElseSucceed(O.none<string>));
    if (O.isNone(manifestRead)) {
      continue;
    }
    const manifestJson: unknown = parse(manifestRead.value);
    const { status } = readManifestStatus(manifestJson);
    const completed = COMPLETED_STATUS_TOKENS.includes(status);
    if (!completed) {
      continue;
    }
    // Explicit opt-out only (goals/README.md documents the gate as a
    // reflectionRequired contract): packets closed before the reflection
    // practice carry `reflectionRequired: false`; an absent field still gates.
    if (((manifestJson ?? {}) as Record<string, unknown>).reflectionRequired === false) {
      advisories.push(
        makeFinding(
          slug,
          "warning",
          `Completed goal "${slug}" opted out of the reflection gate (reflectionRequired: false).`,
          "Write a closeout reflection and flip reflectionRequired to true when the packet re-enters the gate."
        )
      );
      continue;
    }

    const reflectionsDir = path.join(GOALS_DIR, slug, ...REFLECTIONS_SUBDIR);
    const reflectionsDirExists = yield* fs.exists(reflectionsDir);
    const reflectionFiles = reflectionsDirExists
      ? (yield* fs.readDirectory(reflectionsDir)).filter((file) => REFLECTION_FILE_PATTERN.test(file))
      : [];

    if (reflectionFiles.length === 0) {
      const finding = makeFinding(
        slug,
        "error",
        `Completed goal "${slug}" (status: ${status}) has no closeout reflection artifact.`,
        REMEDIATION
      );
      blocking.push(finding);
      continue;
    }

    for (const file of reflectionFiles) {
      const raw = yield* fs.readFileString(path.join(reflectionsDir, file));
      const valid = yield* frontmatterIsValid(raw);
      if (!valid) {
        const finding = makeFinding(
          slug,
          "error",
          `Reflection artifact has missing or invalid ReflectionFrontmatter.`,
          REMEDIATION,
          `${reflectionsDir}/${file}`
        );
        blocking.push(finding);
      }
    }
  }

  yield* Console.log(`[reflection] blocking_findings=${blocking.length}`);
  yield* Console.log(`[reflection] advisory_findings=${advisories.length}`);

  if (advisories.length > 0) {
    yield* Console.error("[reflection] advisories (non-fatal):");
    for (const finding of advisories) {
      yield* logPolicyFinding(finding);
    }
  }

  if (blocking.length > 0) {
    yield* Console.error("[reflection] blocking findings:");
    for (const finding of blocking) {
      yield* logPolicyFinding(finding);
    }
    return yield* failWithReportedExit("reflection: required closeout reflection missing or invalid.");
  }
});

/**
 * `bun run beep lint reflection-artifacts` — enforce closeout reflections.
 *
 * @example
 * ```ts
 * console.log("lintReflectionArtifactsCommand")
 * ```
 * @category commands
 * @since 0.0.0
 */
export const lintReflectionArtifactsCommand = Command.make("reflection-artifacts", {}, runReflectionArtifactLint).pipe(
  Command.withDescription("Verify completed goal packets carry a schema-valid closeout reflection")
);
