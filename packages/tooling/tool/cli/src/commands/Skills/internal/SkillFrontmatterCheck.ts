/**
 * Agent Skills frontmatter check over the installed `.claude/skills` tree.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { decodeAgentSkillFrontmatterStrict } from "@beep/ai-sync";
import { FrontmatterSource } from "@beep/markdown/FrontmatterSource";
import { Frontmatter } from "@beep/markdown/MarkdownNode";
import { YamlFrontmatter } from "@beep/markdown/YamlFrontmatter";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as Str from "effect/String";
import {
  SKILL_BODY_LINE_LIMIT,
  SkillBodyAdvisory,
  SkillFrontmatterIssue,
  SkillFrontmatterReport,
} from "../SkillFrontmatter.schemas.ts";
import { SkillsCommandError } from "../Skills.errors.ts";
import type { FrontmatterSourceBlock } from "@beep/markdown/FrontmatterSource";

const countLines = (text: string): number =>
  Str.isEmpty(text) ? 0 : A.length(Str.split(text, "\n")) - (Str.endsWith("\n")(text) ? 1 : 0);

// The YAML engine's own failure (a `YamlParseError`, or a `FrontmatterKeyError` for a duplicate,
// complex or set key) carries the diagnostic text; the decode error's own message names only the format.
const decodeFailureDetail = (cause: unknown): string =>
  P.hasProperty(cause, "message") && P.isString(cause.message) ? cause.message : String(cause);

const blockIssue = (skill: string, block: FrontmatterSourceBlock): Effect.Effect<O.Option<string>> =>
  YamlFrontmatter.decode(Frontmatter.make({ format: block.format, value: block.value })).pipe(
    Effect.flatMap(decodeAgentSkillFrontmatterStrict),
    Effect.map((decoded) =>
      decoded.name === skill
        ? O.none()
        : O.some(`frontmatter name "${decoded.name}" must match the skill directory name "${skill}".`)
    ),
    Effect.catchTags({
      FrontmatterFormatMismatchError: (error) =>
        Effect.succeedSome(`SKILL.md frontmatter is ${error.actual}; the Agent Skills format requires a YAML block.`),
      FrontmatterDecodeError: (error) =>
        Effect.succeedSome(`Invalid YAML frontmatter (${decodeFailureDetail(error.cause)}).`),
      SchemaError: (error) => Effect.succeedSome(error.message),
    })
  );

/**
 * Check every installed skill's `SKILL.md` against the Agent Skills format.
 *
 * **Details**
 *
 * Each skill contributes at most one finding: a missing frontmatter block, a
 * block fenced as JSON or TOML instead of YAML, a frontmatter block that fails
 * strict decoding (unknown keys, bad name
 * grammar, over-long fields, non-string metadata), or a `name` that differs
 * from its directory. A finding on a repo-authored skill is an issue and fails
 * the check. A finding on a skill named in `upstreamNames` (lock-managed
 * upstream mirrors that `skills update` rewrites byte-for-byte) is reported
 * under `upstreamIssues` and never fails: editing the mirror would only drift
 * it, so the fix is upstream or a skills-lock patch. Files longer than
 * {@link SKILL_BODY_LINE_LIMIT} lines contribute an advisory.
 *
 * **Example** (Check two installed skills, one of them an upstream mirror)
 *
 * ```ts
 * import { checkInstalledSkills } from "@beep/repo-cli/test/SharedInternals"
 * import * as Effect from "effect/Effect"
 * import * as HashSet from "effect/HashSet"
 *
 * const program = checkInstalledSkills("/repo/.claude/skills", ["yeet", "grill-me"], HashSet.make("grill-me"))
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @param skillsDir - Absolute path of the installed skills root.
 * @param names - Installed skill directory names to check.
 * @param upstreamNames - Names of lock-managed upstream mirrors whose findings stay advisory.
 * @returns The issues, upstream issues, and advisories collected across every named skill.
 * @category validation
 * @since 0.0.0
 */
export const checkInstalledSkills = Effect.fn("Skills.checkInstalledSkills")(function* (
  skillsDir: string,
  names: ReadonlyArray<string>,
  upstreamNames: HashSet.HashSet<string>
): Effect.fn.Return<SkillFrontmatterReport, SkillsCommandError, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const issues: Array<SkillFrontmatterIssue> = [];
  const upstreamIssues: Array<SkillFrontmatterIssue> = [];
  const advisories: Array<SkillBodyAdvisory> = [];

  for (const skill of names) {
    const skillFile = path.join(skillsDir, skill, "SKILL.md");
    const raw = yield* fs
      .readFileString(skillFile)
      .pipe(SkillsCommandError.mapError(`Failed to read ${skillFile}.`, skillFile, skill));
    const lines = countLines(raw);
    if (lines > SKILL_BODY_LINE_LIMIT) {
      advisories.push(SkillBodyAdvisory.make({ skill, lines, limit: SKILL_BODY_LINE_LIMIT }));
    }
    const issue = yield* O.match(O.fromUndefinedOr(FrontmatterSource.split(raw).frontmatter), {
      onNone: () => Effect.succeedSome("SKILL.md has no YAML frontmatter block."),
      onSome: (block) => blockIssue(skill, block),
    });
    if (O.isSome(issue)) {
      const bucket = HashSet.has(upstreamNames, skill) ? upstreamIssues : issues;
      bucket.push(SkillFrontmatterIssue.make({ skill, message: issue.value }));
    }
  }

  return SkillFrontmatterReport.make({ issues, upstreamIssues, advisories });
});
