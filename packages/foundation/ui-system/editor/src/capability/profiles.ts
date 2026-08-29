/**
 * Compatibility and reference proof profiles shipped by `@beep/editor`.
 *
 * @packageDocumentation \@beep/editor/capability/profiles
 * @since 0.0.0
 */

import { Result } from "effect";
import * as S from "effect/Schema";
import { EditorProfile } from "./schemas.ts";

const decodeProfile = S.decodeUnknownResult(EditorProfile);

/**
 * Production profile that preserves the pre-capability `EditorComposer` plugin set.
 *
 * **Details**
 *
 * The profile intentionally omits toolbar, slash, and shortcut-help projections,
 * so Lexical-native keyboard behavior remains unchanged. Its Markdown transformer
 * set matches `TRANSFORMERS`, which excludes `CHECK_LIST`.
 *
 * **Example** (Inspect the compatibility profile)
 *
 * ```ts import.meta.vitest name="Inspect the compatibility profile"
 * import { compatibilityProfile } from "@beep/editor/capability/profiles"
 *
 * compatibilityProfile.kind // => "production"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const compatibilityProfile: EditorProfile = Result.getOrThrow(
  decodeProfile({
    id: "beep-editor.compatibility",
    kind: "production",
    capabilities: [
      "extension.history",
      "node.list",
      "node.list-item",
      "node.link",
      "interchange.markdown",
      "format.bold",
      "format.italic",
      "format.strikethrough",
      "format.inline-code",
      "format.semantic-highlight",
      "node.heading",
      "node.quote",
      "node.code",
      "transformer.heading",
      "transformer.quote",
      "transformer.code-block",
      "transformer.unordered-list",
      "transformer.ordered-list",
      "transformer.inline-code",
      "transformer.strong",
      "transformer.emphasis",
      "transformer.strong-emphasis",
      "transformer.strikethrough",
      "transformer.highlight",
      "transformer.link",
    ],
    keybindingOverrides: [],
  })
);

const minimalProfile = Result.getOrThrow(
  decodeProfile({
    id: "beep-editor.reference.minimal",
    kind: "production",
    capabilities: [
      "format.bold",
      "format.italic",
      "extension.history",
      "authoring.undo",
      "authoring.redo",
      "extension.toolbar",
      "extension.shortcut-help",
    ],
    keybindingOverrides: [],
  })
);

const documentProofProfile = Result.getOrThrow(
  decodeProfile({
    id: "beep-editor.reference.document-proof",
    kind: "production",
    capabilities: [
      "format.bold",
      "format.italic",
      "extension.history",
      "authoring.undo",
      "authoring.redo",
      "extension.toolbar",
      "extension.shortcut-help",
      "format.strikethrough",
      "format.inline-code",
      "format.clear",
      "node.paragraph",
      "node.heading",
      "node.quote",
      "node.code",
      "node.list",
      "node.list-item",
      "node.link",
      "extension.slash-picker",
      "interchange.markdown",
      "interchange.canonical-json",
      "transformer.heading",
      "transformer.quote",
      "transformer.code-block",
      "transformer.unordered-list",
      "transformer.ordered-list",
      "transformer.check-list",
      "transformer.inline-code",
      "transformer.strong",
      "transformer.emphasis",
      "transformer.strong-emphasis",
      "transformer.strikethrough",
      "transformer.link",
    ],
    keybindingOverrides: [],
  })
);

/**
 * Shared minimal and document-proof fixtures for Storybook and app integration.
 *
 * **Gotchas**
 *
 * These are proof fixtures rather than product modes; applications own their
 * production profile definitions.
 *
 * **Example** (Select the document proof fixture)
 *
 * ```ts
 * import { referenceProfiles } from "@beep/editor/capability/profiles"
 *
 * console.log(referenceProfiles.documentProof.id) // "beep-editor.reference.document-proof"
 * ```
 *
 * @category fixtures
 * @since 0.0.0
 */
export const referenceProfiles = {
  minimal: minimalProfile,
  documentProof: documentProofProfile,
};
