/** Local capability-profile proof panel.
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";
import { CapabilityComposer } from "@beep/editor/capability/composer";
import { referenceProfiles } from "@beep/editor/capability/profiles";
import { Button } from "@beep/ui/components/button";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import * as O from "effect/Option";
import {
  editorProofActions,
  editorProofImportFailureAtom,
  editorProofInitialStateAtom,
  editorProofJsonAtom,
  editorProofProfileIdAtom,
  editorProofRevisionAtom,
} from "./EditorProof.atoms.ts";
import type { JSX } from "react";

const ProfilePicker = (): JSX.Element => {
  const profileId = useAtomValue(editorProofProfileIdAtom);
  const selectMinimal = useAtomSet(editorProofActions.selectMinimalProfile);
  const selectDocumentProof = useAtomSet(editorProofActions.selectDocumentProofProfile);

  return (
    <fieldset className="flex gap-3">
      <legend className="sr-only">Capability profile</legend>
      <label>
        <input
          type="radio"
          name="editor-proof-profile"
          checked={profileId === referenceProfiles.minimal.id}
          onChange={selectMinimal}
        />{" "}
        Minimal
      </label>
      <label>
        <input
          type="radio"
          name="editor-proof-profile"
          checked={profileId === referenceProfiles.documentProof.id}
          onChange={selectDocumentProof}
        />{" "}
        Document proof
      </label>
    </fieldset>
  );
};

const EditorProofControls = (): JSX.Element => {
  const importCanonicalJson = useAtomSet(editorProofActions.importCanonicalJson);
  const reloadCanonical = useAtomSet(editorProofActions.reloadCanonical);

  return (
    <div className="sticky top-0 z-10 flex shrink-0 flex-wrap items-center gap-3 border-b bg-background p-3">
      <ProfilePicker />
      <Button type="button" onClick={importCanonicalJson}>
        Import canonical JSON
      </Button>
      <Button type="button" onClick={reloadCanonical}>
        Reload from canonical
      </Button>
    </div>
  );
};

const ImportFailureAlert = (): JSX.Element | undefined => {
  const failure = useAtomValue(editorProofImportFailureAtom);
  return O.match(failure, {
    onNone: () => undefined,
    onSome: (message) => (
      <div role="alert" className="m-2 border border-destructive p-2">
        Canonical import failed: {message}
      </div>
    ),
  });
};

const CanonicalJsonDrawer = (): JSX.Element => {
  const json = useAtomValue(editorProofJsonAtom);
  const editCanonicalJson = useAtomSet(editorProofActions.editCanonicalJson);

  return (
    <details className="shrink-0 border-t p-2">
      <summary>Canonical JSON</summary>
      <textarea
        aria-label="Canonical JSON"
        className="mt-2 h-32 w-full font-mono text-xs"
        value={json}
        onChange={(event) => editCanonicalJson(event.currentTarget.value)}
      />
    </details>
  );
};

const EditorProofComposer = (): JSX.Element => {
  const profileId = useAtomValue(editorProofProfileIdAtom);
  const initialState = useAtomValue(editorProofInitialStateAtom);
  const revision = useAtomValue(editorProofRevisionAtom);
  const captureEditorState = useAtomSet(editorProofActions.captureEditorState);
  const profile =
    profileId === referenceProfiles.minimal.id ? referenceProfiles.minimal : referenceProfiles.documentProof;

  return (
    <div className="min-h-64 flex-1 overflow-hidden">
      <CapabilityComposer
        key={`${profileId}:${revision}`}
        profile={profile}
        initialState={initialState}
        onSerializedChange={captureEditorState}
      />
    </div>
  );
};

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
  return (
    // The editor region keeps a usable floor; when the dock box is shorter than
    // controls + drawer + floor (narrow/touch layouts), the panel scrolls as a
    // whole instead of collapsing the document.
    <section className="flex h-full min-h-0 flex-col overflow-y-auto" data-testid="editor-proof-panel">
      {/* Sticky and opaque: focus-driven scrolling must never leave the mode and
          import controls half-hidden under the dock's tab strip. */}
      <EditorProofControls />
      <ImportFailureAlert />
      <EditorProofComposer />
      <CanonicalJsonDrawer />
    </section>
  );
}
