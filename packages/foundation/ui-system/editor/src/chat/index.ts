/**
 * Feature-flagged chat composer surface for `@beep/editor`: the generic
 * mechanism (config, commands, toolbar, slash/mention typeahead menus,
 * attachment capture, send/character-count) that an app configures and injects
 * product meaning into. The bare `EditorComposer` remains for non-chat
 * consumers.
 *
 * @packageDocumentation \@beep/editor/chat
 * @since 0.0.0
 */

/**
 * Chat state atoms for the feature-flagged composer.
 *
 * @category atoms
 * @since 0.0.0
 */
export {
  /**
   * @deprecated Import {@link anyMenuOpenAtom} from `@beep/editor/chat/atoms`.
   * @since 0.0.0
   */
  anyMenuOpenAtom,
  /**
   * @deprecated Import {@link attachmentFailureAtom} from `@beep/editor/chat/atoms`.
   * @since 0.0.0
   */
  attachmentFailureAtom,
  /**
   * @deprecated Import {@link attachmentsAtom} from `@beep/editor/chat/atoms`.
   * @since 0.0.0
   */
  attachmentsAtom,
  /**
   * @deprecated Import {@link captureAttachmentsFn} from `@beep/editor/chat/atoms`.
   * @since 0.0.0
   */
  captureAttachmentsFn,
  /**
   * @deprecated Import {@link characterCountAtom} from `@beep/editor/chat/atoms`.
   * @since 0.0.0
   */
  characterCountAtom,
  /**
   * @deprecated Import {@link composerRuntime} from `@beep/editor/chat/atoms`.
   * @since 0.0.0
   */
  composerRuntime,
  /**
   * @deprecated Import {@link featuresAtom} from `@beep/editor/chat/atoms`.
   * @since 0.0.0
   */
  featuresAtom,
  /**
   * @deprecated Import {@link isTypeaheadMenuVisible} from `@beep/editor/chat/atoms`.
   * @since 0.0.0
   */
  isTypeaheadMenuVisible,
  /**
   * @deprecated Import {@link logEditorErrorFn} from `@beep/editor/chat/atoms`.
   * @since 0.0.0
   */
  logEditorErrorFn,
  /**
   * @deprecated Import {@link maxAttachmentBytesAtom} from `@beep/editor/chat/atoms`.
   * @since 0.0.0
   */
  maxAttachmentBytesAtom,
  /**
   * @deprecated Import {@link menusOpenAtom} from `@beep/editor/chat/atoms`.
   * @since 0.0.0
   */
  menusOpenAtom,
  /**
   * @deprecated Import {@link onAttachAtom} from `@beep/editor/chat/atoms`.
   * @since 0.0.0
   */
  onAttachAtom,
  /**
   * @deprecated Import {@link onSendAtom} from `@beep/editor/chat/atoms`.
   * @since 0.0.0
   */
  onSendAtom,
  /**
   * @deprecated Import {@link removeAttachmentFn} from `@beep/editor/chat/atoms`.
   * @since 0.0.0
   */
  removeAttachmentFn,
  /**
   * @deprecated Import {@link SendHandlerBox} from `@beep/editor/chat/atoms`.
   * @since 0.0.0
   */
  type SendHandlerBox,
  /**
   * @deprecated Import {@link sendBlockedAtom} from `@beep/editor/chat/atoms`.
   * @since 0.0.0
   */
  sendBlockedAtom,
  /**
   * @deprecated Import {@link sendCommandBindingAtom} from `@beep/editor/chat/atoms`.
   * @since 0.0.0
   */
  sendCommandBindingAtom,
  /**
   * @deprecated Import {@link sendKeyBindingAtom} from `@beep/editor/chat/atoms`.
   * @since 0.0.0
   */
  sendKeyBindingAtom,
  /**
   * @deprecated Import {@link TYPEAHEAD_MENU_ATTRIBUTE} from `@beep/editor/chat/atoms`.
   * @since 0.0.0
   */
  TYPEAHEAD_MENU_ATTRIBUTE,
  /**
   * @deprecated Import {@link typeaheadActiveDescendant} from `@beep/editor/chat/atoms`.
   * @since 0.0.0
   */
  typeaheadActiveDescendant,
  /**
   * @deprecated Import {@link typeaheadMenuMarker} from `@beep/editor/chat/atoms`.
   * @since 0.0.0
   */
  typeaheadMenuMarker,
  /**
   * @deprecated Import {@link typeaheadOptionId} from `@beep/editor/chat/atoms`.
   * @since 0.0.0
   */
  typeaheadOptionId,
  /**
   * @deprecated Import {@link unboundSend} from `@beep/editor/chat/atoms`.
   * @since 0.0.0
   */
  unboundSend,
} from "./atoms.ts";
/**
 * The pure attachment model and capture-time validation for the chat composer.
 *
 * @category models
 * @since 0.0.0
 */
export {
  /**
   * @deprecated Import {@link AttachmentFailure} from `@beep/editor/chat/attachment-model`.
   * @since 0.0.0
   */
  AttachmentFailure,
  /**
   * @deprecated Import {@link AttachmentInvalidMimeType} from `@beep/editor/chat/attachment-model`.
   * @since 0.0.0
   */
  AttachmentInvalidMimeType,
  /**
   * @deprecated Import {@link AttachmentPortFailed} from `@beep/editor/chat/attachment-model`.
   * @since 0.0.0
   */
  AttachmentPortFailed,
  /**
   * @deprecated Import {@link AttachmentRejection} from `@beep/editor/chat/attachment-model`.
   * @since 0.0.0
   */
  AttachmentRejection,
  /**
   * @deprecated Import {@link AttachmentTooLarge} from `@beep/editor/chat/attachment-model`.
   * @since 0.0.0
   */
  AttachmentTooLarge,
  /**
   * @deprecated Import {@link ComposerAttachment} from `@beep/editor/chat/attachment-model`.
   * @since 0.0.0
   */
  ComposerAttachment,
  /**
   * @deprecated Import {@link DEFAULT_MAX_ATTACHMENT_BYTES} from `@beep/editor/chat/attachment-model`.
   * @since 0.0.0
   */
  DEFAULT_MAX_ATTACHMENT_BYTES,
  /**
   * @deprecated Import {@link fileToAttachment} from `@beep/editor/chat/attachment-model`.
   * @since 0.0.0
   */
  fileToAttachment,
  /**
   * @deprecated Import {@link IMAGE_MIME_TYPES} from `@beep/editor/chat/attachment-model`.
   * @since 0.0.0
   */
  IMAGE_MIME_TYPES,
  /**
   * @deprecated Import {@link ImageAttachmentMimeType} from `@beep/editor/chat/attachment-model`.
   * @since 0.0.0
   */
  ImageAttachmentMimeType,
  /**
   * @deprecated Import {@link isImageAttachment} from `@beep/editor/chat/attachment-model`.
   * @since 0.0.0
   */
  isImageAttachment,
  /**
   * @deprecated Import {@link revokeAttachment} from `@beep/editor/chat/attachment-model`.
   * @since 0.0.0
   */
  revokeAttachment,
} from "./attachment-model.ts";
/**
 * Attachment capture plugins and the chip/thumbnail strip UI for the chat composer.
 *
 * @category components
 * @since 0.0.0
 */
export {
  /**
   * @deprecated Import {@link AttachmentChips} from `@beep/editor/chat/attachments`.
   * @since 0.0.0
   */
  AttachmentChips,
  /**
   * @deprecated Import {@link AttachmentFailureNotice} from `@beep/editor/chat/attachments`.
   * @since 0.0.0
   */
  AttachmentFailureNotice,
  /**
   * @deprecated Import {@link AttachmentPlugin} from `@beep/editor/chat/attachments`.
   * @since 0.0.0
   */
  AttachmentPlugin,
} from "./attachments.tsx";
/**
 * The feature-flagged `ChatComposer` chat input surface built on the v1 Lexical vocabulary.
 *
 * @category components
 * @since 0.0.0
 */
export {
  /**
   * @deprecated Import {@link ChatComposer} from `@beep/editor/chat/chat-composer`.
   * @since 0.0.0
   */
  ChatComposer,
  /**
   * @deprecated Import {@link ChatComposerMountConfig} from `@beep/editor/chat/chat-composer`.
   * @since 0.0.0
   */
  type ChatComposerMountConfig,
  /**
   * @deprecated Import {@link ChatComposerProps} from `@beep/editor/chat/chat-composer`.
   * @since 0.0.0
   */
  type ChatComposerProps,
} from "./chat-composer.tsx";
/**
 * The markdown code-fence gesture, in a composer whose Enter key already means send.
 *
 * @category commands
 * @since 0.0.0
 */
export {
  /**
   * @deprecated Import `$isInsideCodeBlock` from `@beep/editor/chat/code-fence`; see {@link ChatComposer}.
   * @since 0.0.0
   */
  $isInsideCodeBlock,
  /**
   * @deprecated Import `$openCodeFence` from `@beep/editor/chat/code-fence`; see {@link ChatComposer}.
   * @since 0.0.0
   */
  $openCodeFence,
} from "./code-fence.ts";
/**
 * Lexical commands the chat composer dispatches so consumers can wire send and stop.
 *
 * @category constants
 * @since 0.0.0
 */
export {
  /**
   * @deprecated Import {@link SEND_MESSAGE_COMMAND} from `@beep/editor/chat/commands`.
   * @since 0.0.0
   */
  SEND_MESSAGE_COMMAND,
  /**
   * @deprecated Import {@link STOP_MESSAGE_COMMAND} from `@beep/editor/chat/commands`.
   * @since 0.0.0
   */
  STOP_MESSAGE_COMMAND,
} from "./commands.ts";
/**
 * Schema-first UI configuration models for the feature-flagged chat composer.
 *
 * @category schemas
 * @since 0.0.0
 */
export {
  /**
   * @deprecated Import {@link AttachmentPort} from `@beep/editor/chat/config`.
   * @since 0.0.0
   */
  type AttachmentPort,
  /**
   * @deprecated Import {@link ComposerFeatures} from `@beep/editor/chat/config`.
   * @since 0.0.0
   */
  ComposerFeatures,
  /**
   * @deprecated Import {@link EditorEffect} from `@beep/editor/chat/config`.
   * @since 0.0.0
   */
  type EditorEffect,
  /**
   * @deprecated Import {@link MentionOption} from `@beep/editor/chat/config`.
   * @since 0.0.0
   */
  MentionOption,
  /**
   * @deprecated Import {@link MentionOptions} from `@beep/editor/chat/config`.
   * @since 0.0.0
   */
  MentionOptions,
  /**
   * @deprecated Import {@link MentionSource} from `@beep/editor/chat/config`.
   * @since 0.0.0
   */
  MentionSource,
  /**
   * @deprecated Import {@link SendOn} from `@beep/editor/chat/config`.
   * @since 0.0.0
   */
  SendOn,
  /**
   * @deprecated Import {@link SendPort} from `@beep/editor/chat/config`.
   * @since 0.0.0
   */
  type SendPort,
  /**
   * @deprecated Import {@link SlashItem} from `@beep/editor/chat/config`.
   * @since 0.0.0
   */
  SlashItem,
  /**
   * @deprecated Import {@link SlashItems} from `@beep/editor/chat/config`.
   * @since 0.0.0
   */
  SlashItems,
} from "./config.ts";
/**
 * Enter-to-send key handling and the live character count for the chat composer.
 *
 * @category components
 * @since 0.0.0
 */
export {
  /**
   * @deprecated Import {@link SendPlugin} from `@beep/editor/chat/send`.
   * @since 0.0.0
   */
  SendPlugin,
  /**
   * @deprecated Import {@link useCharacterCount} from `@beep/editor/chat/send`.
   * @since 0.0.0
   */
  useCharacterCount,
} from "./send.tsx";
/**
 * The default `/` slash command set covering baseline formatting and block insertion.
 *
 * @category constants
 * @since 0.0.0
 */
export {
  /**
   * @deprecated Import {@link defaultChatSlashItems} from `@beep/editor/chat/slash-items`.
   * @since 0.0.0
   */
  defaultChatSlashItems,
} from "./slash-items.tsx";
/**
 * The fixed formatting toolbar mounted above the chat composer editable surface.
 *
 * @category components
 * @since 0.0.0
 */
export {
  /**
   * @deprecated Import `$selectionBlockType` from `@beep/editor/chat/toolbar`; see {@link FixedToolbarPlugin}.
   * @since 0.0.0
   */
  $selectionBlockType,
  /**
   * @deprecated Import {@link BlockType} from `@beep/editor/chat/toolbar`.
   * @since 0.0.0
   */
  BlockType,
  /**
   * @deprecated Import {@link FixedToolbarPlugin} from `@beep/editor/chat/toolbar`.
   * @since 0.0.0
   */
  FixedToolbarPlugin,
} from "./toolbar.tsx";
/**
 * The `/` slash and `@` mention typeahead menus for the chat composer.
 *
 * @category components
 * @since 0.0.0
 */
export {
  /**
   * @deprecated Import {@link ComboboxAriaPlugin} from `@beep/editor/chat/typeahead`.
   * @since 0.0.0
   */
  ComboboxAriaPlugin,
  /**
   * @deprecated Import {@link MentionPlugin} from `@beep/editor/chat/typeahead`.
   * @since 0.0.0
   */
  MentionPlugin,
  /**
   * @deprecated Import {@link SlashPlugin} from `@beep/editor/chat/typeahead`.
   * @since 0.0.0
   */
  SlashPlugin,
  /**
   * @deprecated Import {@link shouldOpenUpward} from `@beep/editor/chat/typeahead`.
   * @since 0.0.0
   */
  shouldOpenUpward,
  /**
   * @deprecated Import {@link typeaheadMenuPosition} from `@beep/editor/chat/typeahead`.
   * @since 0.0.0
   */
  typeaheadMenuPosition,
} from "./typeahead.tsx";
