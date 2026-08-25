/** Local capability-profile proof panel.
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";
import { CapabilityComposer } from "@beep/editor/capability/composer";
import { referenceProfiles } from "@beep/editor/capability/profiles";
import { editorStateToDocument } from "@beep/lexical-schema";
import { Button } from "@beep/ui/components/button";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { pipe, Result } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";
import {
  EditorProofDocumentJson,
  editorProofCanonicalAtom,
  editorProofImportFailureAtom,
  editorProofInitialStateAtom,
  editorProofJsonAtom,
  editorProofProfileIdAtom,
  editorProofRevisionAtom,
} from "./EditorProof.atoms.ts";
import type { SerializedEditorState } from "@beep/lexical-schema";
import type { JSX } from "react";

const formatIssue = SchemaIssue.makeFormatterDefault();
const decodeEditorProofJson = S.decodeUnknownResult(EditorProofDocumentJson);
const encodeEditorProofJson = S.encodeUnknownResult(EditorProofDocumentJson);

/** Renders the local canonical-document and profile-remount proof surface.
 *
 * **Example** (Mount the panel)
 * ```tsx
 * import { EditorProofPanel } from "@/editor-proof/EditorProofPanel"
 * const panel = <EditorProofPanel />
 * console.log(panel.type.name) // "EditorProofPanel"
 * ```
 * @category components
 * @since 0.0.0
 */
export function EditorProofPanel(): JSX.Element {
  const profileId = useAtomValue(editorProofProfileIdAtom);
  const initialState = useAtomValue(editorProofInitialStateAtom);
  const json = useAtomValue(editorProofJsonAtom);
  const failure = useAtomValue(editorProofImportFailureAtom);
  const revision = useAtomValue(editorProofRevisionAtom);
  const setProfileId = useAtomSet(editorProofProfileIdAtom);
  const setDocument = useAtomSet(editorProofCanonicalAtom);
  const setJson = useAtomSet(editorProofJsonAtom);
  const setFailure = useAtomSet(editorProofImportFailureAtom);
  const setRevision = useAtomSet(editorProofRevisionAtom);
  const profile =
    profileId === referenceProfiles.minimal.id ? referenceProfiles.minimal : referenceProfiles.documentProof;
  const importJson = (): void =>
    Result.match(decodeEditorProofJson(json), {
      onFailure: (error) => setFailure(O.some(pipe(error.issue, formatIssue))),
      onSuccess: (next) => {
        setDocument(next);
        setFailure(O.none());
        setRevision((value) => value + 1);
      },
    });
  const capture = (state: SerializedEditorState): void => {
    const next = editorStateToDocument(state);
    setDocument(next);
    Result.match(encodeEditorProofJson(next), {
      onFailure: (error) => setFailure(O.some(pipe(error.issue, formatIssue))),
      onSuccess: setJson,
    });
  };
  return (
    // The editor region keeps a usable floor; when the dock box is shorter than
    // controls + drawer + floor (narrow/touch layouts), the panel scrolls as a
    // whole instead of collapsing the document.
    <section className="flex h-full min-h-0 flex-col overflow-y-auto" data-testid="editor-proof-panel">
      <div className="flex flex-wrap items-center gap-3 border-b p-3">
        <fieldset className="flex gap-3">
          <legend className="sr-only">Capability profile</legend>
          <label>
            <input
              type="radio"
              name="editor-proof-profile"
              checked={profileId === referenceProfiles.minimal.id}
              onChange={() => {
                setProfileId(referenceProfiles.minimal.id);
                setRevision((value) => value + 1);
              }}
            />{" "}
            Minimal
          </label>
          <label>
            <input
              type="radio"
              name="editor-proof-profile"
              checked={profileId === referenceProfiles.documentProof.id}
              onChange={() => {
                setProfileId(referenceProfiles.documentProof.id);
                setRevision((value) => value + 1);
              }}
            />{" "}
            Document proof
          </label>
        </fieldset>
        <Button type="button" onClick={importJson}>
          Import canonical JSON
        </Button>
        <Button type="button" onClick={() => setRevision((value) => value + 1)}>
          Reload from canonical
        </Button>
      </div>
      {O.match(failure, {
        onNone: () => undefined,
        onSome: (message) => (
          <div role="alert" className="m-2 border border-destructive p-2">
            Canonical import failed: {message}
          </div>
        ),
      })}
      <div className="min-h-64 flex-1 overflow-hidden">
        <CapabilityComposer
          key={`${profileId}:${revision}`}
          profile={profile}
          initialState={initialState}
          onSerializedChange={capture}
        />
      </div>
      <details className="shrink-0 border-t p-2">
        <summary>Canonical JSON</summary>
        <textarea
          aria-label="Canonical JSON"
          className="mt-2 h-32 w-full font-mono text-xs"
          value={json}
          onChange={(event) => {
            setJson(event.currentTarget.value);
            setFailure(O.none());
          }}
        />
      </details>
    </section>
  );
}
