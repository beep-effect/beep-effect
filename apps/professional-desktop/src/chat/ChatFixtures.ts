/**
 * Shared chat fixture builders for desktop smoke and contract paths.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as Md from "@beep/md/Md.model";
import { SafeDocument } from "@beep/md/Md.safe";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import type * as Effect from "effect/Effect";

/**
 * Decode an unknown fixture value into a validated {@link WorkspaceIdentity.WorkspaceId},
 * keeping validation failures in the Effect error channel.
 *
 * **Example** (Decode workspace ID)
 *
 * ```ts
 * import { decodeWorkspaceId } from "@/chat/ChatFixtures"
 * import * as Effect from "effect/Effect"
 *
 * const id = await Effect.runPromise(decodeWorkspaceId(1))
 * console.log(id) // 1
 * ```
 *
 * @category fixtures
 * @since 0.0.0
 */
export const decodeWorkspaceId: (input: unknown) => Effect.Effect<WorkspaceIdentity.WorkspaceId, S.SchemaError> =
  S.decodeUnknownEffect(WorkspaceIdentity.WorkspaceId);

/**
 * Build a single-paragraph `@beep/md` {@link Md.Document.Type} fixture from a
 * plain string, for chat smoke and contract-test message content.
 *
 * **Example** (Build single-paragraph document)
 *
 * ```ts
 * import { userDocument } from "@/chat/ChatFixtures"
 *
 * const document = userDocument("Hello world")
 * console.log(document.children.length) // 1
 * ```
 *
 * @category fixtures
 * @since 0.0.0
 */
export const userDocument = (text: string): SafeDocument =>
  SafeDocument.make(Md.Document.make({ children: [Md.P.make({ children: [Md.Text.make({ value: text })] })] }));

/**
 * Build a multi-paragraph `@beep/md` {@link Md.Document.Type} fixture, one
 * paragraph per input string, for chat smoke and contract-test message content.
 *
 * **Example** (Build multi-paragraph document)
 *
 * ```ts
 * import { userParagraphDocument } from "@/chat/ChatFixtures"
 *
 * const document = userParagraphDocument(["First paragraph", "Second paragraph"])
 * console.log(document.children.length) // 2
 * ```
 *
 * @category fixtures
 * @since 0.0.0
 */
export const userParagraphDocument = (paragraphs: ReadonlyArray<string>): SafeDocument =>
  SafeDocument.make(
    Md.Document.make({
      children: A.map(paragraphs, (text) => Md.P.make({ children: [Md.Text.make({ value: text })] })),
    })
  );
