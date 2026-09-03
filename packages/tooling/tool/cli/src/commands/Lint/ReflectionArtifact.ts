/**
 * Reflection-artifact inventory and enforcement command.
 *
 * Validates the YAML frontmatter of every reflection artifact under
 * `goals/<slug>/history/reflections/<YYYY-MM-DD>-<agent>.md` in EVERY packet —
 * active or completed — so this lint cannot report a false green that
 * `goals doctor` then fails (the PR #365 YAML traps hid in a completed-only
 * gap). Only the closeout-presence gate is a completed-packet contract:
 * packets that opt out via `reflectionRequired: false` in their manifest get
 * an advisory, and every other completed packet blocks when it lacks a
 * reflection artifact.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { decodeYamlTextAs, LiteralKit } from "@beep/schema";
import { A, thunkFalse } from "@beep/utils";
import { Console, Effect, FileSystem, Path, pipe } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { Command } from "effect/unstable/cli";
import { parse } from "jsonc-parser";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import { optionalProp } from "../../internal/cli/OptionRecord.ts";
import { makePolicyFindingLogger } from "../../internal/cli/PolicyFindingLogger.ts";
import { GoalStatus } from "../Goals/Goals.schemas.ts";

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
 * **Example** (Log ReflectionFinding string)
 *
 * ```ts
 * console.log("ReflectionFinding")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace ReflectionFinding {
  /**
   * Encoded representation of {@link ReflectionFinding}.
   *
   * **Example** (Log Encoded string)
   *
   * ```ts
   * console.log("Encoded")
   * ```
   *
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
        Effect.orElseSucceed(thunkFalse)
      ),
  });

/**
 * Whether a raw reflection file's YAML frontmatter decodes as
 * `ReflectionFrontmatter`.
 *
 * **Details**
 *
 * Shared with `beep goals doctor`; both this lint and the doctor validate
 * reflections in every packet, completed or not.
 *
 * **Example** (Check empty frontmatter validity)
 *
 * ```ts
 * import { reflectionFrontmatterIsValid } from "@beep/repo-cli/commands/Lint/ReflectionArtifact"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(reflectionFrontmatterIsValid("---\n---\n")))
 * ```
 *
 * @param raw - Full reflection file content.
 * @returns Whether the frontmatter block exists and decodes.
 * @category validation
 * @since 0.0.0
 */
export const reflectionFrontmatterIsValid = frontmatterIsValid;

/**
 * Whether a file name matches the reflection-artifact naming convention
 * (`<YYYY-MM-DD>-<agent>.md`).
 *
 * **Example** (Match artifact naming convention)
 *
 * ```ts
 * import { reflectionFileNameIsArtifact } from "@beep/repo-cli/commands/Lint/ReflectionArtifact"
 *
 * console.log(reflectionFileNameIsArtifact("2026-07-11-claude.md")) // true
 * console.log(reflectionFileNameIsArtifact("_TEMPLATE.md")) // false
 * ```
 *
 * @param file - File name inside `history/reflections/`.
 * @returns Whether the name is a reflection artifact.
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
 * Validates reflection frontmatter in every packet and closeout presence in
 * completed ones.
 *
 * **Example** (Log lint runner name)
 *
 * ```ts
 * console.log("runReflectionArtifactLint")
 * ```
 *
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

    // Frontmatter must decode in ANY packet, not only completed ones — the
    // PR #365 YAML traps hid in the completed-only gap, and goals doctor
    // already validates every packet (Doctor.ts carries the same rule).
    // `goals/` entries can be plain files (README.md); probing below one
    // fails with ENOTDIR rather than returning false, so both probes degrade
    // to "no reflections" instead of failing the whole lint.
    const reflectionsDir = path.join(GOALS_DIR, slug, ...REFLECTIONS_SUBDIR);
    const reflectionsDirExists = yield* fs.exists(reflectionsDir).pipe(Effect.orElseSucceed(thunkFalse));
    const reflectionFiles = reflectionsDirExists
      ? (yield* fs.readDirectory(reflectionsDir).pipe(Effect.orElseSucceed(A.empty<string>))).filter(
          reflectionFileNameIsArtifact
        )
      : [];

    for (const file of reflectionFiles) {
      const raw = yield* fs.readFileString(path.join(reflectionsDir, file)).pipe(Effect.orElseSucceed(() => Str.empty));
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

    // The closeout-presence gate and the reflectionRequired opt-out remain
    // completed-packet contracts.
    const manifestPath = path.join(GOALS_DIR, slug, "ops", "manifest.json");
    const manifestRead = yield* fs
      .readFileString(manifestPath)
      .pipe(Effect.asSome, Effect.orElseSucceed(O.none<string>));
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

    if (reflectionFiles.length === 0) {
      const finding = makeFinding(
        slug,
        "error",
        `Completed goal "${slug}" (status: ${status}) has no closeout reflection artifact.`,
        REMEDIATION
      );
      blocking.push(finding);
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
 * **Example** (Log command name)
 *
 * ```ts
 * console.log("lintReflectionArtifactsCommand")
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export const lintReflectionArtifactsCommand = Command.make("reflection-artifacts", {}, runReflectionArtifactLint).pipe(
  Command.withDescription(
    "Validate reflection frontmatter in every goal packet and closeout presence in completed ones"
  )
);
