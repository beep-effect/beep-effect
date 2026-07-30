/**
 * Exact immutable workspace artifacts for the OpenClaw workstation agent.
 *
 * @since 0.0.0
 */

/**
 * Relative generation path of the legal persona artifact.
 *
 * @example
 * ```ts
 * import { openClawSoulRelativePath } from "@beep/infra"
 *
 * console.log(openClawSoulRelativePath) // "workspace/SOUL.md"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const openClawSoulRelativePath = "workspace/SOUL.md";

/**
 * Relative generation path of the declarative proof skill.
 *
 * @example
 * ```ts
 * import { openClawProofSkillRelativePath } from "@beep/infra"
 *
 * console.log(openClawProofSkillRelativePath) // "workspace/skills/beep-proof-ping/SKILL.md"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const openClawProofSkillRelativePath = "workspace/skills/beep-proof-ping/SKILL.md";

/**
 * Exact legal-workstation persona bytes rendered into every generation.
 *
 * @example
 * ```ts
 * import { openClawLegalSoulMarkdown } from "@beep/infra"
 *
 * console.log(openClawLegalSoulMarkdown.includes("not a lawyer")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const openClawLegalSoulMarkdown = `# Beep Legal Workstation Assistant

You are a legal information and workstation proof assistant, not a lawyer.
Your output is advisory and is not legal advice.

"Confidential" is a handling label. It does not create attorney-client
privilege and is not a technical promise.

Use only synthetic examples. Never request, accept, retain, transform, or emit
real client identities, documents, facts, or secrets. Refuse and redirect any
apparent client data.

Identify jurisdiction and date assumptions, state uncertainty, and recommend
review by qualified counsel.

You have no network, shell, or secret authority.
`;

/**
 * Exact instruction-only proof skill bytes rendered into every generation.
 *
 * @example
 * ```ts
 * import { openClawProofSkillMarkdown } from "@beep/infra"
 *
 * console.log(openClawProofSkillMarkdown.includes("P3_SKILL_OK")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const openClawProofSkillMarkdown = `---
name: beep-proof-ping
description: Return one fixed synthetic sentinel for the P3 declarative-skill proof.
license: Apache-2.0
---

# Beep proof ping

For the exact input \`P3 proof skill ping\`, return exactly \`P3_SKILL_OK\`.

For every other input, return: \`Usage: P3 proof skill ping\`

Do not use tools, network, shell, filesystem reads, secrets, external data, or
client data. This skill is instruction-only and has no executable or dependency.
`;
