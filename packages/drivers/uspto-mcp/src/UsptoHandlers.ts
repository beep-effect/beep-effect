/**
 * USPTO MCP toolkit handlers.
 *
 * Each handler first resolves the shared `USPTO_API_KEY` credential via the
 * kit's `SourceAuth` registry; when absent, it returns the `api_key_required`
 * envelope directly, without calling `@beep/uspto` at all (Q6 — no live
 * network dependency for the absent-credential path). When present, it
 * delegates to the real `@beep/uspto` driver and maps driver failures to
 * {@link UsptoToolError}.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { apiKeyRequiredFailure, FetchableHandle, resolveSourceCredential } from "@beep/mcp-kit";
import { Uspto } from "@beep/uspto";
import { DateTime, Effect, Random } from "effect";
import * as O from "effect/Option";
import {
  MintFetchableHandle,
  ProjectDocumentsWithinBudgetOptions,
  projectDocumentsWithinBudget,
} from "./UsptoDocumentTiers.ts";
import { UsptoSourceAuthRegistration } from "./UsptoSourceAuth.ts";
import { UsptoGetDocumentsTool, UsptoSearchApplicationsTool, UsptoToolError, UsptoToolkit } from "./UsptoTools.ts";
import type { UsptoError } from "@beep/uspto";
import type * as Layer from "effect/Layer";
import type * as Tool from "effect/unstable/ai/Tool";
import type { UsptoGetDocumentsParams } from "./UsptoTools.ts";

const toUsptoToolError =
  (tool: string) =>
  (error: UsptoError): UsptoToolError =>
    UsptoToolError.make({
      message: `USPTO ${tool} failed: ${error.reason}`,
      reason: error.reason === "config" ? "transport" : error.reason,
      tool,
    });

const requireCredential = Effect.fn("UsptoMcp.requireCredential")(function* (tool: string) {
  const credential = yield* resolveSourceCredential(UsptoSourceAuthRegistration).pipe(
    Effect.mapError(() =>
      UsptoToolError.make({ message: "Failed to resolve USPTO_API_KEY", reason: "transport", tool })
    )
  );
  if (O.isNone(credential)) {
    return yield* Effect.fail(apiKeyRequiredFailure({ registration: UsptoSourceAuthRegistration, tool }));
  }
});

/**
 * Builds a diagnostic-handle minter for a `documentBag` projection too large
 * for even the `minimal` tier. This thin proving host has no out-of-band
 * payload store, so the handle is diagnostic only — callers cannot yet fetch
 * it back; a real store is a consumer concern the kit intentionally leaves
 * open (`FieldTier.ts` module doc). `handleId`/`expiresAt` are resolved via
 * `Random`/`DateTime` (Effect-injected, testable) ahead of the plain
 * synchronous mint callback `projectDocumentsWithinBudget` expects, rather
 * than calling `crypto.randomUUID()`/`Date.now()` directly.
 */
const makeDiagnosticFetchableHandleMinter = Effect.fn("UsptoMcp.makeDiagnosticFetchableHandleMinter")(function* () {
  const random = yield* Random.nextInt;
  const expiresAt = yield* DateTime.now.pipe(
    Effect.map(DateTime.addDuration("1 minute")),
    Effect.map(DateTime.formatIso)
  );
  const handleId = `uspto-doc-${Math.abs(random).toString(16)}`;

  return MintFetchableHandle.implementSync(
    (oversized): FetchableHandle =>
      FetchableHandle.make({
        handleId,
        expiresAt,
        sizeBytes: oversized.sizeBytes,
        tier: "minimal",
      })
  );
});

/**
 * Live handler layer for the USPTO MCP toolkit.
 *
 * @category layers
 * @since 0.0.0
 */
export const UsptoToolkitHandlersLive: Layer.Layer<
  Tool.HandlersFor<typeof UsptoToolkit.tools>,
  never,
  Uspto
> = UsptoToolkit.toLayer(
  Effect.gen(function* () {
    const uspto = yield* Uspto;

    return UsptoToolkit.of({
      uspto_search_applications: Effect.fn("UsptoMcp.uspto_search_applications")(function* (request: {
        readonly query: string;
      }) {
        yield* requireCredential(UsptoSearchApplicationsTool.name);
        return yield* uspto
          .searchApplications(request.query)
          .pipe(Effect.mapError(toUsptoToolError(UsptoSearchApplicationsTool.name)));
      }),
      uspto_get_documents: Effect.fn("UsptoMcp.uspto_get_documents")(function* (request: UsptoGetDocumentsParams) {
        yield* requireCredential(UsptoGetDocumentsTool.name);
        const documents = yield* uspto
          .getDocuments(request.applicationNumber)
          .pipe(Effect.mapError(toUsptoToolError(UsptoGetDocumentsTool.name)));
        const mintFetchableHandle = yield* makeDiagnosticFetchableHandleMinter();
        return projectDocumentsWithinBudget(
          documents,
          ProjectDocumentsWithinBudgetOptions.make({
            budgetBytes: request.budgetBytes,
            mintFetchableHandle,
          })
        );
      }),
    });
  })
);
