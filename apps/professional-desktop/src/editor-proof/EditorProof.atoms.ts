/** Atom-owned local state for the editor capability proof panel.
 * @packageDocumentation
 * @since 0.0.0
 */
import { referenceProfiles } from "@beep/editor/capability/profiles";
import { $ProfessionalDesktopId } from "@beep/identity/packages";
import { documentToEditorState, editorStateToDocument } from "@beep/lexical-schema/Lexical.codec";
import * as Md from "@beep/md/Md.model";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";
import { Atom } from "effect/unstable/reactivity";
import type { SerializedEditorState } from "@beep/lexical-schema/Lexical.model";

const text = (value: string) => Md.Text.make({ value });
const $I = $ProfessionalDesktopId.create("editor-proof/EditorProof.atoms");

// App-local canonical proof fixture, independent from Storybook source files.
const editorProofDocument = Md.Document.make({
  children: [
    Md.Heading.make({ level: 1, children: [text("Capability proof")] }),
    Md.P.make({
      children: [
        Md.Strong.make({ children: [text("Bold")] }),
        text(" "),
        Md.Em.make({ children: [text("italic")] }),
        text(" "),
        Md.Del.make({ children: [text("struck")] }),
        text(" "),
        Md.Code.make({ value: "inline()" }),
        text(" "),
        Md.A.make({ href: "https://example.com", children: [text("proof link")] }),
      ],
    }),
    Md.Ul.make({
      children: [Md.Li.make({ children: [text("First item")] }), Md.Li.make({ children: [text("Second item")] })],
    }),
    Md.TaskList.make({ children: [Md.TaskItem.make({ checked: true, children: [text("Checked task")] })] }),
    Md.BlockQuote.make({ children: [Md.P.make({ children: [text("Quoted proof")] })] }),
    Md.Pre.make({ value: "const proof = true", language: O.some("typescript") }),
    Md.Table.make({
      headerRow: true,
      children: [
        Md.TableRow.make({
          children: [Md.TableCell.make({ children: [text("A1")] }), Md.TableCell.make({ children: [text("B1")] })],
        }),
        Md.TableRow.make({
          children: [Md.TableCell.make({ children: [text("A2")] }), Md.TableCell.make({ children: [text("B2")] })],
        }),
      ],
    }),
  ],
});

// Canonical JSON codec for the proof document (encode for the drawer, decode on import).
const EditorProofDocumentJson = S.fromJsonString(Md.Document).pipe(
  $I.annoteSchema("EditorProofDocumentJson", {
    description: "Canonical JSON text for the local editor proof document.",
  })
);

const encodeEditorProofJson = S.encodeUnknownResult(EditorProofDocumentJson);
const decodeEditorProofJson = S.decodeUnknownResult(EditorProofDocumentJson);
const formatIssue = SchemaIssue.makeFormatterDefault();
const nextRevision = (revision: number): number => revision + 1;

/** Selected app reference-profile identifier.
 *
 * **Example** (Reference the atom)
 * ```ts
 * import { editorProofProfileIdAtom } from "@/editor-proof/EditorProof.atoms"
 * console.log(editorProofProfileIdAtom)
 * ```
 * @category atoms
 * @since 0.0.0
 */
export const editorProofProfileIdAtom = Atom.make(referenceProfiles.minimal.id);
// The canonical document the composer is remounted over.
const editorProofCanonicalAtom = Atom.make(editorProofDocument);
/** Serialized editor state derived from the canonical atom for each remount.
 *
 * **Example** (Reference the atom)
 * ```ts
 * import { editorProofInitialStateAtom } from "@/editor-proof/EditorProof.atoms"
 * console.log(editorProofInitialStateAtom)
 * ```
 * @category atoms
 * @since 0.0.0
 */
export const editorProofInitialStateAtom = Atom.readable((get) =>
  Effect.runSync(documentToEditorState(get(editorProofCanonicalAtom)))
);
/** Editable canonical JSON source text.
 *
 * **Example** (Reference the atom)
 * ```ts
 * import { editorProofJsonAtom } from "@/editor-proof/EditorProof.atoms"
 * console.log(editorProofJsonAtom)
 * ```
 * @category atoms
 * @since 0.0.0
 */
export const editorProofJsonAtom = Atom.make(Result.getOrThrow(encodeEditorProofJson(editorProofDocument)));
/** Latest typed canonical import failure, when present.
 *
 * **Example** (Reference the atom)
 * ```ts
 * import { editorProofImportFailureAtom } from "@/editor-proof/EditorProof.atoms"
 * console.log(editorProofImportFailureAtom)
 * ```
 * @category atoms
 * @since 0.0.0
 */
export const editorProofImportFailureAtom = Atom.make<O.Option<string>>(O.none());
/** Monotonic remount revision for explicit canonical reloads.
 *
 * **Example** (Reference the atom)
 * ```ts
 * import { editorProofRevisionAtom } from "@/editor-proof/EditorProof.atoms"
 * console.log(editorProofRevisionAtom)
 * ```
 * @category atoms
 * @since 0.0.0
 */
export const editorProofRevisionAtom = Atom.make(0);

const selectMinimalProfileAtom = Atom.fnSync<unknown>()((_event, ctx) => {
  ctx.set(editorProofProfileIdAtom, referenceProfiles.minimal.id);
  ctx.set(editorProofRevisionAtom, nextRevision(ctx(editorProofRevisionAtom)));
});

const selectDocumentProofProfileAtom = Atom.fnSync<unknown>()((_event, ctx) => {
  ctx.set(editorProofProfileIdAtom, referenceProfiles.documentProof.id);
  ctx.set(editorProofRevisionAtom, nextRevision(ctx(editorProofRevisionAtom)));
});

const importCanonicalJsonAtom = Atom.fnSync<unknown>()((_event, ctx) =>
  Result.match(decodeEditorProofJson(ctx(editorProofJsonAtom)), {
    onFailure: (error) => ctx.set(editorProofImportFailureAtom, O.some(pipe(error.issue, formatIssue))),
    onSuccess: (next) => {
      ctx.set(editorProofCanonicalAtom, next);
      ctx.set(editorProofImportFailureAtom, O.none());
      ctx.set(editorProofRevisionAtom, nextRevision(ctx(editorProofRevisionAtom)));
    },
  })
);

const reloadCanonicalAtom = Atom.fnSync<unknown>()((_event, ctx) =>
  ctx.set(editorProofRevisionAtom, nextRevision(ctx(editorProofRevisionAtom)))
);

const editCanonicalJsonAtom = Atom.fnSync<string>()((json, ctx) => {
  ctx.set(editorProofJsonAtom, json);
  ctx.set(editorProofImportFailureAtom, O.none());
});

const captureEditorStateAtom = Atom.fnSync<SerializedEditorState>()((state, ctx) => {
  const next = editorStateToDocument(state);
  ctx.set(editorProofCanonicalAtom, next);
  Result.match(encodeEditorProofJson(next), {
    onFailure: (error) => ctx.set(editorProofImportFailureAtom, O.some(pipe(error.issue, formatIssue))),
    onSuccess: (json) => ctx.set(editorProofJsonAtom, json),
  });
});

/** Atom-owned actions for profile selection, canonical import, capture, editing, and reload.
 *
 * **Example** (Reference the actions)
 * ```ts
 * import { editorProofActions } from "@/editor-proof/EditorProof.atoms"
 * console.log(editorProofActions.importCanonicalJson)
 * ```
 * @category atoms
 * @since 0.0.0
 */
export const editorProofActions = {
  selectMinimalProfile: selectMinimalProfileAtom,
  selectDocumentProofProfile: selectDocumentProofProfileAtom,
  importCanonicalJson: importCanonicalJsonAtom,
  reloadCanonical: reloadCanonicalAtom,
  editCanonicalJson: editCanonicalJsonAtom,
  captureEditorState: captureEditorStateAtom,
} as const;
