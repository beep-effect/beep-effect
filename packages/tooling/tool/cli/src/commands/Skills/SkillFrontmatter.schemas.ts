/**
 * Report models for the Agent Skills frontmatter check that
 * `beep skills update` runs over every installed `.claude/skills/<name>/SKILL.md`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Skills/SkillFrontmatter.schemas");

/**
 * Line count above which a `SKILL.md` earns an advisory.
 *
 * **Details**
 *
 * The Agent Skills specification recommends keeping the activated file under
 * 500 lines and moving detail into `references/`, because the whole file is
 * loaded on every activation. The check reports, it does not fail.
 *
 * **Example** (Read the limit)
 *
 * ```ts
 * import { SKILL_BODY_LINE_LIMIT } from "@beep/repo-cli/commands/Skills"
 *
 * console.log(SKILL_BODY_LINE_LIMIT) // 500
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SKILL_BODY_LINE_LIMIT = 500;

const LineCount = S.Int.check(S.isGreaterThanOrEqualTo(0));

/**
 * One frontmatter violation in an installed skill.
 *
 * **Example** (Describe a non-spec key)
 *
 * ```ts
 * import { SkillFrontmatterIssue } from "@beep/repo-cli/commands/Skills"
 *
 * const issue = SkillFrontmatterIssue.make({ skill: "yeet", message: "Unexpected key \"version\"" })
 * console.log(issue.skill) // "yeet"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillFrontmatterIssue extends S.Class<SkillFrontmatterIssue>($I`SkillFrontmatterIssue`)(
  {
    skill: S.String,
    message: S.String,
  },
  $I.annote("SkillFrontmatterIssue", {
    title: "Skill Frontmatter Issue",
    description: "A SKILL.md frontmatter block that violates the Agent Skills format or the Claude Code extensions.",
  })
) {}

/**
 * Advisory for a `SKILL.md` whose line count exceeds {@link SKILL_BODY_LINE_LIMIT}.
 *
 * **Example** (Report an oversized skill file)
 *
 * ```ts
 * import { SkillBodyAdvisory } from "@beep/repo-cli/commands/Skills"
 *
 * const advisory = SkillBodyAdvisory.make({ skill: "yeet", lines: 1190, limit: 500 })
 * console.log(advisory.lines > advisory.limit) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillBodyAdvisory extends S.Class<SkillBodyAdvisory>($I`SkillBodyAdvisory`)(
  {
    skill: S.String,
    lines: LineCount,
    limit: LineCount,
  },
  $I.annote("SkillBodyAdvisory", {
    title: "Skill Body Advisory",
    description: "A SKILL.md longer than the Agent Skills progressive-disclosure recommendation.",
  })
) {}

/**
 * Outcome of checking every installed skill: blocking issues on repo-authored
 * skills, advisory issues on lock-managed upstream mirrors, and body-length
 * advisories.
 *
 * **Example** (An empty report is a clean tree)
 *
 * ```ts
 * import { SkillFrontmatterReport } from "@beep/repo-cli/commands/Skills"
 *
 * const report = SkillFrontmatterReport.make({ issues: [], upstreamIssues: [], advisories: [] })
 * console.log(report.issues.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SkillFrontmatterReport extends S.Class<SkillFrontmatterReport>($I`SkillFrontmatterReport`)(
  {
    issues: S.Array(SkillFrontmatterIssue),
    upstreamIssues: S.Array(SkillFrontmatterIssue),
    advisories: S.Array(SkillBodyAdvisory),
  },
  $I.annote("SkillFrontmatterReport", {
    title: "Skill Frontmatter Report",
    description:
      "Frontmatter issues that fail the skills check (repo-authored skills), the same findings on upstream mirrors (advisory), and body-length advisories.",
  })
) {}
