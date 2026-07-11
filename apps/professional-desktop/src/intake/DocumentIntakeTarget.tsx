/**
 * App-level document intake drag-and-drop target.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

"use client";

import { FilingOutcome } from "@beep/documents-domain/aggregates/Document";
import { IntakeBatchId } from "@beep/documents-domain/aggregates/IntakeBatch";
import { slugVaultSegment } from "@beep/documents-domain/values/Taxonomy";
import { Button } from "@beep/ui/components/button";
import { useAtomMount, useAtomSet, useAtomValue } from "@effect/atom-react";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { AsyncResult } from "effect/unstable/reactivity";
import { Fragment, useState } from "react";
import {
  ConfigureWorkspaceVaultInput,
  configureWorkspaceVaultAtom,
  DEFAULT_WORKSPACE_ID,
  DroppedDocumentInput,
  intakeDroppedDocumentAtom,
  workspaceVaultConfigAtom,
} from "./Intake.atoms.js";
import type { Document } from "@beep/documents-domain/aggregates/Document";
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

const failureMessageOr =
  (fallback: string) =>
  (cause: unknown): string =>
    P.isError(cause) && cause.message.length > 0
      ? cause.message
      : P.isObject(cause) && P.hasProperty(cause, "message") && P.isString(cause.message) && cause.message.length > 0
        ? cause.message
        : fallback;

const vaultConfigurationFailureMessage = failureMessageOr("Unable to save workspace vault.");

const intakeFailureMessage = failureMessageOr("Intake failed.");

type IntakeResultEntry =
  | { readonly kind: "document"; readonly document: Document }
  | { readonly kind: "failure"; readonly fileName: string; readonly message: string };

const intakeResultRow = (entry: IntakeResultEntry): JSX.Element =>
  entry.kind === "failure" ? (
    <li className="rounded-sm border border-destructive/40 p-2" data-testid="intake-result-failure">
      <span className="font-medium">{entry.fileName}</span>
      <p className="mt-1 text-xs text-destructive">{entry.message}</p>
    </li>
  ) : (
    FilingOutcome.match(entry.document.filing, {
      filed: (filed) => (
        <li className="rounded-sm border p-2" data-testid="intake-result-filed">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-medium">{entry.document.originalFileName}</span>
            <span className="rounded-sm bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
              {filed.taxonomyConceptId}
            </span>
          </div>
          <p className="mt-1 break-all text-xs text-muted-foreground">{entry.document.vaultPath.relativePath}</p>
          <p className="mt-1 text-xs text-muted-foreground">{filed.rationale}</p>
        </li>
      ),
      inboxed: (inboxed) => (
        <li className="rounded-sm border border-amber-500/40 p-2" data-testid="intake-result-inboxed">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-medium">{entry.document.originalFileName}</span>
            <span className="rounded-sm bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-600">inbox</span>
          </div>
          <p className="mt-1 break-all text-xs text-muted-foreground">{entry.document.vaultPath.relativePath}</p>
          <p className="mt-1 text-xs text-muted-foreground">{inboxed.rationale}</p>
        </li>
      ),
    })
  );

const VaultOnboarding = ({
  onChoose,
  status,
}: {
  readonly onChoose: () => void;
  readonly status: string | null;
}): JSX.Element => (
  <div className="flex h-screen w-full items-center justify-center bg-background text-foreground">
    <section className="w-full max-w-md rounded-md border bg-card p-5 shadow-sm" data-testid="vault-onboarding">
      <h1 className="text-lg font-semibold">Choose workspace vault</h1>
      <p className="mt-2 text-sm text-muted-foreground">Select the local folder where filed documents will land.</p>
      <div className="mt-4 flex items-center gap-3">
        <Button type="button" onClick={onChoose} data-testid="vault-choose">
          Choose folder
        </Button>
        {status === null ? null : <span className="text-sm text-muted-foreground">{status}</span>}
      </div>
    </section>
  </div>
);

const IntakeBusyBadge = ({ activeBatches }: { readonly activeBatches: number }): JSX.Element | null =>
  activeBatches === 0 ? null : (
    <div
      className="absolute right-4 top-16 z-40 rounded-md border bg-card px-3 py-2 text-sm shadow-sm"
      data-testid="intake-busy"
    >
      Filing {activeBatches === 1 ? "documents" : `${activeBatches} batches`}
    </div>
  );

const IntakeResultsPanel = ({
  onClear,
  results,
}: {
  readonly onClear: () => void;
  readonly results: ReadonlyArray<IntakeResultEntry>;
}): JSX.Element | null =>
  results.length === 0 ? null : (
    <div
      className="absolute bottom-4 right-4 z-40 max-h-80 w-96 overflow-y-auto rounded-md border bg-card p-3 text-sm shadow-sm"
      data-testid="intake-results"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">Filed documents</h2>
        <Button type="button" variant="ghost" size="sm" onClick={onClear} data-testid="intake-results-clear">
          Clear
        </Button>
      </div>
      <ul className="mt-2 space-y-2">
        {results.map((entry, index) => (
          <Fragment key={`${index}-${entry.kind === "document" ? entry.document.contentDigest : entry.fileName}`}>
            {intakeResultRow(entry)}
          </Fragment>
        ))}
      </ul>
    </div>
  );

/**
 * Persist one selected workspace vault path and reflect success/failure in UI status.
 *
 * @example
 * ```ts
 * import { configureSelectedWorkspaceVault } from "@/intake/DocumentIntakeTarget"
 * import { Effect } from "effect"
 *
 * const statuses: Array<string | null> = []
 * Effect.runPromise(configureSelectedWorkspaceVault("/tmp/vault", async () => undefined, (status) => statuses.push(status)))
 * ```
 *
 * @category effects
 * @since 0.0.0
 */
export const configureSelectedWorkspaceVault = Effect.fn("configureSelectedWorkspaceVault")(function* (
  selected: string | null,
  configureVault: (input: ConfigureWorkspaceVaultInput) => Promise<unknown>,
  setStatus: (status: string | null) => void
) {
  if (selected === null || selected.trim().length === 0) return;
  const input = yield* S.decodeUnknownEffect(ConfigureWorkspaceVaultInput)({
    vaultRootPath: selected,
    workspaceId: DEFAULT_WORKSPACE_ID,
  }).pipe(Effect.mapError(() => "Invalid workspace vault path."));

  yield* Effect.sync(() => setStatus("Saving workspace vault"));
  yield* Effect.tryPromise({
    try: () => configureVault(input),
    catch: vaultConfigurationFailureMessage,
  }).pipe(
    Effect.matchEffect({
      onFailure: (message) => Effect.sync(() => setStatus(message)),
      onSuccess: () => Effect.sync(() => setStatus(null)),
    })
  );
});

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
  const configureVault = useAtomSet(configureWorkspaceVaultAtom, { mode: "promise" });
  const intakeDroppedDocument = useAtomSet(intakeDroppedDocumentAtom, { mode: "promise" });
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [activeBatches, setActiveBatches] = useState(0);
  const [results, setResults] = useState<ReadonlyArray<IntakeResultEntry>>([]);

  useAtomMount(configureWorkspaceVaultAtom);
  useAtomMount(intakeDroppedDocumentAtom);

  const configured = AsyncResult.isSuccess(vaultConfig) && O.isSome(vaultConfig.value.vaultRootPath);
  const needsOnboarding = AsyncResult.isSuccess(vaultConfig) && O.isNone(vaultConfig.value.vaultRootPath);

  const chooseVault = Effect.gen(function* () {
    const selected = yield* pickVaultDirectory;
    yield* configureSelectedWorkspaceVault(selected, configureVault, setStatus);
  });

  const appendResult = (entry: IntakeResultEntry): void => setResults((current) => [...current, entry]);

  const intakeFiles = Effect.fnUntraced(function* (files: ReadonlyArray<File>) {
    if (files.length === 0) return;
    const intakeBatchId = yield* S.decodeUnknownEffect(IntakeBatchId)(batchIdFor(files)).pipe(Effect.orDie);
    // Each drop is an independent batch; a shared counter keeps the busy
    // indicator up until the LAST in-flight batch settles.
    yield* Effect.sync(() => setActiveBatches((count) => count + 1));
    yield* Effect.forEach(files, (file) => {
      const fileName = file.name || "document";
      return Effect.tryPromise(() => file.arrayBuffer()).pipe(
        Effect.map((buffer) => new Uint8Array(buffer)),
        Effect.flatMap((content) =>
          Effect.tryPromise(() =>
            intakeDroppedDocument(
              DroppedDocumentInput.make({
                content,
                intakeBatchId,
                originalFileName: fileName,
                workspaceId: DEFAULT_WORKSPACE_ID,
              })
            )
          )
        ),
        Effect.matchEffect({
          onFailure: (cause) =>
            Effect.sync(() => appendResult({ kind: "failure", fileName, message: intakeFailureMessage(cause) })),
          onSuccess: (document) => Effect.sync(() => appendResult({ kind: "document", document })),
        })
      );
    }).pipe(Effect.ensuring(Effect.sync(() => setActiveBatches((count) => count - 1))));
  });

  if (needsOnboarding) {
    return <VaultOnboarding onChoose={() => void Effect.runPromise(chooseVault)} status={status} />;
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
      <IntakeBusyBadge activeBatches={activeBatches} />
      <IntakeResultsPanel results={results} onClear={() => setResults([])} />
    </div>
  );
}
