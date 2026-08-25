/** Atom-owned local state for the editor capability proof panel.
 * @packageDocumentation
 * @since 0.0.0
 */
import { referenceProfiles } from "@beep/editor/capability/profiles";
import { $ProfessionalDesktopId } from "@beep/identity/packages";
import { documentToEditorState } from "@beep/lexical-schema";
import * as Md from "@beep/md/Md.model";
import { Effect, Result } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { Atom } from "effect/unstable/reactivity";

const text = (value: string) => Md.Text.make({ value });
const $I = $ProfessionalDesktopId.create("editor-proof/EditorProof.atoms");

/** App-local canonical proof fixture, independent from Storybook source files.
 *
 * **Example** (Inspect the heading)
 * ```ts
 * import { editorProofDocument } from "@/editor-proof/EditorProof.atoms"
 * console.log(editorProofDocument.children[0]?._tag) // "Heading"
 * ```
 * @category fixtures
 * @since 0.0.0
 */
export const editorProofDocument = Md.Document.make({
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

/** Canonical JSON text codec for the proof document.
 *
 * **Example** (Reference the codec)
 * ```ts
 * import { EditorProofDocumentJson } from "@/editor-proof/EditorProof.atoms"
 * console.log(typeof EditorProofDocumentJson) // "function"
 * ```
 * @category codecs
 * @since 0.0.0
 */
export const EditorProofDocumentJson = S.fromJsonString(Md.Document).pipe(
  $I.annoteSchema("EditorProofDocumentJson", {
    description: "Canonical JSON text for the local editor proof document.",
  })
);

const encodeEditorProofJson = S.encodeUnknownResult(EditorProofDocumentJson);

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
/** Latest canonical document transaction state.
 *
 * **Example** (Reference the atom)
 * ```ts
 * import { editorProofCanonicalAtom } from "@/editor-proof/EditorProof.atoms"
 * console.log(editorProofCanonicalAtom)
 * ```
 * @category atoms
 * @since 0.0.0
 */
export const editorProofCanonicalAtom = Atom.make(editorProofDocument);
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
