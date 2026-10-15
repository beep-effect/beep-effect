/**
 * The onboarding guide: the steps Claude follows to set up a lawyer's
 * computer, served by `setup_onboarding_guide` and the `onboard_practice`
 * prompt.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PracticeGatewayId } from "@beep/identity/packages";
import * as McpServer from "effect/ai/McpServer";
import * as Context from "effect/Context";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ONBOARDING_SKILL_BODY } from "./OnboardingSkill.generated.ts";

const $I = $PracticeGatewayId.create("OnboardingGuide");

/**
 * Built-in onboarding steps, used until the onboarding skill's text is wired
 * in.
 *
 * **Details**
 *
 * The practice-onboarding skill (`plugin/skills/practice-onboarding/SKILL.md`)
 * replaces this text through {@link OnboardingGuide.layerText} once it lands
 * in the gateway.
 *
 * **Example** (Read the first step)
 *
 * ```ts
 * import { BUILT_IN_ONBOARDING_GUIDE } from "@beep/practice-gateway/OnboardingGuide"
 *
 * console.log(BUILT_IN_ONBOARDING_GUIDE.includes("setup_profile_get")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const BUILT_IN_ONBOARDING_GUIDE = [
  "# Set up this computer for the practice",
  "",
  "1. Call setup_profile_get. If no profile is saved, interview the lawyer in plain language: which documents system (Box Drive), mail and calendar (Microsoft 365) and whether the practice knowledge graph is used, plus whether they have administrator rights and use a proxy. Save the answers with setup_profile_save. Never put passwords, client names or client data in the profile.",
  "2. Call setup_status and relay its summary in plain language.",
  "3. For each requirement listed as repairable, offer the change and call setup_repair; the lawyer approves it in a prompt. If the prompt cannot be shown, ask the lawyer in chat first.",
  "4. Steps only the lawyer can take (signing in, consenting, installing, asking IT) are listed in the report: give them one at a time and wait until the lawyer says they are done.",
  "5. Call setup_status again after each step until setup is complete. After saving a profile or connecting a provider, ask the lawyer to restart Claude so the practice tools appear.",
].join("\n");

/**
 * The body of the `practice-onboarding` skill shipped in
 * `plugin/skills/practice-onboarding/SKILL.md`, without its YAML frontmatter.
 *
 * **Details**
 *
 * One source for both delivery routes: Claude Code loads the skill from the
 * plugin, Claude Desktop chat reads the same text through
 * `setup_onboarding_guide` and the `onboard_practice` prompt. Falls back to
 * {@link BUILT_IN_ONBOARDING_GUIDE} if the file has no body.
 *
 * **Example** (Read the shipped guide)
 *
 * ```ts
 * import { ONBOARDING_GUIDE } from "@beep/practice-gateway/OnboardingGuide"
 *
 * console.log(ONBOARDING_GUIDE.startsWith("# "))
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ONBOARDING_GUIDE: string = Str.isNonEmpty(ONBOARDING_SKILL_BODY)
  ? ONBOARDING_SKILL_BODY
  : BUILT_IN_ONBOARDING_GUIDE;

/**
 * Name of the MCP prompt that serves the onboarding guide.
 *
 * **Example** (Read the prompt name)
 *
 * ```ts
 * import { ONBOARD_PRACTICE_PROMPT } from "@beep/practice-gateway/OnboardingGuide"
 *
 * console.log(ONBOARD_PRACTICE_PROMPT) // "onboard_practice"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ONBOARD_PRACTICE_PROMPT = "onboard_practice";

/**
 * Description shared by the onboarding tool and prompt.
 *
 * **Example** (Read the description)
 *
 * ```ts
 * import { ONBOARDING_GUIDE_DESCRIPTION } from "@beep/practice-gateway/OnboardingGuide"
 *
 * console.log(ONBOARDING_GUIDE_DESCRIPTION.startsWith("Call first")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ONBOARDING_GUIDE_DESCRIPTION =
  "Call first when the lawyer asks to set up this computer, or when setup is incomplete; returns the onboarding steps to follow.";

/**
 * The guide text a gateway serves.
 *
 * **Example** (Wrap a guide)
 *
 * ```ts
 * import { OnboardingGuideText } from "@beep/practice-gateway/OnboardingGuide"
 *
 * console.log(OnboardingGuideText.make({ text: "Step one." }).text)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OnboardingGuideText extends S.Opaque<OnboardingGuideText, { readonly brand: unique symbol }>()(
  S.Struct({
    text: S.NonEmptyString.annotateKey({ description: "The onboarding steps, as Markdown." }),
  }).pipe(
    $I.annoteSchema("OnboardingGuideText", {
      description: "The onboarding steps the practice gateway serves.",
    })
  )
) {}

/**
 * Source of the onboarding guide text.
 *
 * **Example** (Serve a custom guide)
 *
 * ```ts
 * import { OnboardingGuide } from "@beep/practice-gateway/OnboardingGuide"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(OnboardingGuide.layerText("1. Call setup_status.")))
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class OnboardingGuide extends Context.Service<OnboardingGuide, OnboardingGuideText>()($I`OnboardingGuide`) {
  /**
   * Serve the given guide text, such as the onboarding skill's `SKILL.md`
   * imported `with { type: "text" }`.
   *
   * **Example** (Serve a guide)
   *
   * ```ts
   * import { OnboardingGuide } from "@beep/practice-gateway/OnboardingGuide"
   *
   * console.log(typeof OnboardingGuide.layerText("1. Call setup_status."))
   * ```
   *
   * @param text - The guide, as Markdown.
   * @category layers
   * @since 0.0.0
   */
  static readonly layerText = (text: string) =>
    Layer.succeed(OnboardingGuide, OnboardingGuideText.make({ text: S.NonEmptyString.make(text) }));

  /**
   * The shipped onboarding skill ({@link ONBOARDING_GUIDE}).
   *
   * **Example** (Compose the built-in guide)
   *
   * ```ts
   * import { OnboardingGuide } from "@beep/practice-gateway/OnboardingGuide"
   * import * as Layer from "effect/Layer"
   *
   * console.log(Layer.isLayer(OnboardingGuide.layer))
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer = OnboardingGuide.layerText(ONBOARDING_GUIDE);
}

/**
 * The `onboard_practice` MCP prompt: the onboarding guide as a prompt the
 * lawyer can pick in Claude.
 *
 * **Example** (Compose the prompt)
 *
 * ```ts
 * import { OnboardingPromptLayer } from "@beep/practice-gateway/OnboardingGuide"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(OnboardingPromptLayer))
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const OnboardingPromptLayer = McpServer.prompt({
  name: ONBOARD_PRACTICE_PROMPT,
  description: ONBOARDING_GUIDE_DESCRIPTION,
  content: () => OnboardingGuide.useSync((guide) => guide.text),
});
