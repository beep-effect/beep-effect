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

const decodeWorkspaceIdValue = S.decodeUnknownSync(WorkspaceIdentity.WorkspaceId);

/**
 * Decode an unknown value into a validated {@link WorkspaceIdentity.WorkspaceId}
 * for use in fixture data.
 *
 * **Example** (Decode workspace ID)
 *
 * ```ts
 * import { decodeWorkspaceId } from "@/chat/ChatFixtures"
 *
 * const id = decodeWorkspaceId(1)
 * console.log(id)
 * ```
 *
 * @category fixtures
 * @since 0.0.0
 */
export const decodeWorkspaceId = (input: unknown): WorkspaceIdentity.WorkspaceId => decodeWorkspaceIdValue(input);

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
