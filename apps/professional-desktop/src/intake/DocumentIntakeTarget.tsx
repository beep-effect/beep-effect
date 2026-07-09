/**
 * App-level document intake drag-and-drop target.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

"use client";

import { slugVaultSegment } from "@beep/documents-domain/values/Taxonomy";
import { Button } from "@beep/ui/components/button";
import { useAtomMount, useAtomSet, useAtomValue } from "@effect/atom-react";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { AsyncResult } from "effect/unstable/reactivity";
import { useState } from "react";
import {
  ConfigureWorkspaceVaultInput,
  configureWorkspaceVaultAtom,
  DEFAULT_WORKSPACE_ID,
  DroppedDocumentInput,
  intakeDroppedDocumentAtom,
  workspaceVaultConfigAtom,
} from "./Intake.atoms.js";
import type { DragEvent, JSX, ReactNode } from "react";

const hasTauriRuntime = (): boolean => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const pickVaultDirectory: Effect.Effect<string | null> = Effect.suspend(() =>
  hasTauriRuntime()
    ? Effect.tryPromise(() =>
        import("@tauri-apps/api/core").then(({ invoke }) => invoke<string | null>("select_vault_directory"))
      ).pipe(Effect.orElseSucceed(() => null))
    : Effect.sync(() => window.prompt("Workspace vault path"))
);

const droppedFiles = (event: DragEvent<HTMLElement>): ReadonlyArray<File> => A.fromIterable(event.dataTransfer.files);

const batchIdFor = (files: ReadonlyArray<File>): string =>
  `batch-${files.length}-${slugVaultSegment(files[0]?.name ?? "drop")}`;

/**
 * Full-screen drag-and-drop boundary that onboards a workspace vault and intakes dropped documents.
 *
 * @example
 * ```ts
 * import { DocumentIntakeTarget } from "@/intake/DocumentIntakeTarget"
 * import { createElement } from "react"
 *
 * const element = createElement(DocumentIntakeTarget, { children: null })
 * console.log(element.type)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function DocumentIntakeTarget({ children }: { readonly children: ReactNode }): JSX.Element {
  const vaultConfig = useAtomValue(workspaceVaultConfigAtom(DEFAULT_WORKSPACE_ID));
  const configureVault = useAtomSet(configureWorkspaceVaultAtom);
  const intakeDroppedDocument = useAtomSet(intakeDroppedDocumentAtom);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useAtomMount(configureWorkspaceVaultAtom);
  useAtomMount(intakeDroppedDocumentAtom);

  const configured = AsyncResult.isSuccess(vaultConfig) && O.isSome(vaultConfig.value.vaultRootPath);
  const needsOnboarding = AsyncResult.isSuccess(vaultConfig) && O.isNone(vaultConfig.value.vaultRootPath);

  const chooseVault = Effect.gen(function* () {
    const selected = yield* pickVaultDirectory;
    if (selected === null || selected.trim().length === 0) return;
    const input = yield* S.decodeUnknownEffect(ConfigureWorkspaceVaultInput)({
      vaultRootPath: selected,
      workspaceId: DEFAULT_WORKSPACE_ID,
    }).pipe(Effect.orDie);
    yield* Effect.sync(() => {
      configureVault(input);
      setStatus("Saving workspace vault");
    });
  });

  const intakeFiles = Effect.fnUntraced(function* (files: ReadonlyArray<File>) {
    if (files.length === 0) return;
    const intakeBatchId = batchIdFor(files);
    yield* Effect.sync(() => setStatus(`Filing ${files.length} document${files.length === 1 ? "" : "s"}`));
    yield* Effect.forEach(files, (file) =>
      Effect.tryPromise(() => file.arrayBuffer()).pipe(
        Effect.map((buffer) => new Uint8Array(buffer)),
        Effect.flatMap(
          Effect.fnUntraced(function* (content: Uint8Array) {
            const input = yield* S.decodeUnknownEffect(DroppedDocumentInput)({
              content,
              intakeBatchId,
              originalFileName: file.name || "document",
              workspaceId: DEFAULT_WORKSPACE_ID,
            }).pipe(Effect.orDie);
            yield* Effect.sync(() => intakeDroppedDocument(input));
          })
        ),
        Effect.orDie
      )
    );
  });

  if (needsOnboarding) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background text-foreground">
        <section className="w-full max-w-md rounded-md border bg-card p-5 shadow-sm" data-testid="vault-onboarding">
          <h1 className="text-lg font-semibold">Choose workspace vault</h1>
          <p className="mt-2 text-sm text-muted-foreground">Select the local folder where filed documents will land.</p>
          <div className="mt-4 flex items-center gap-3">
            <Button type="button" onClick={() => void Effect.runPromise(chooseVault)} data-testid="vault-choose">
              Choose folder
            </Button>
            {status === null ? null : <span className="text-sm text-muted-foreground">{status}</span>}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div
      className="relative h-screen w-full"
      onDragEnter={(event) => {
        if (!configured) return;
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragOver={(event) => {
        if (!configured) return;
        event.preventDefault();
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        setIsDragging(false);
      }}
      onDrop={(event) => {
        if (!configured) return;
        event.preventDefault();
        setIsDragging(false);
        void Effect.runPromise(intakeFiles(droppedFiles(event)));
      }}
      data-testid="document-intake-target"
    >
      {children}
      {isDragging ? (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center border-2 border-dashed border-primary bg-background/80 text-sm font-medium text-foreground backdrop-blur">
          Drop documents to file
        </div>
      ) : null}
      {status === null ? null : (
        <div className="absolute right-4 top-16 z-40 rounded-md border bg-card px-3 py-2 text-sm shadow-sm">
          {status}
        </div>
      )}
    </div>
  );
}
