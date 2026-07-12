import { expect } from "tstyche";
import type * as DomainSyncConflict from "@beep/documents-domain/entities/SyncConflict";
import type * as SyncServer from "@beep/documents-use-cases/aggregates/Sync/server";
import type * as UseCasesPublic from "@beep/documents-use-cases/public";
import type { Effect } from "effect";

declare const mirror: SyncServer.DmsMirrorShape;
declare const engine: SyncServer.VaultSyncEngineShape;
declare const ensureFolder: SyncServer.EnsureFolderInput;
declare const pollEvents: SyncServer.PollEventsInput;
declare const syncOnce: SyncServer.SyncOnceInput;
declare const statusInput: SyncServer.VaultSyncStatusInput;
declare const markReviewed: SyncServer.MarkConflictReviewedInput;

expect(mirror.ensureFolder(ensureFolder)).type.toBe<
  Effect.Effect<SyncServer.DmsRemoteItem, SyncServer.DmsMirrorUnavailable>
>();
expect(mirror.pollEvents(pollEvents)).type.toBe<
  Effect.Effect<SyncServer.DmsEventPage, SyncServer.DmsMirrorUnavailable>
>();

expect(engine.syncOnce(syncOnce)).type.toBe<Effect.Effect<SyncServer.VaultSyncStatus, SyncServer.VaultSyncError>>();
expect(engine.status(statusInput)).type.toBe<Effect.Effect<SyncServer.VaultSyncStatus, SyncServer.VaultSyncError>>();
expect(engine.markConflictReviewed(markReviewed)).type.toBe<
  Effect.Effect<DomainSyncConflict.SyncConflict, SyncServer.VaultSyncError>
>();

expect<SyncServer.DmsMirror["Service"]>().type.toBe<SyncServer.DmsMirrorShape>();
expect<SyncServer.DmsMirrorAvailability["Service"]>().type.toBe<SyncServer.DmsMirrorAvailabilityShape>();
expect<SyncServer.VaultSyncEngine["Service"]>().type.toBe<SyncServer.VaultSyncEngineShape>();

// Server-only ports must not leak through the package public surface.
expect<"DmsMirror">().type.not.toBeAssignableTo<keyof typeof UseCasesPublic>();
expect<"VaultSyncEngine">().type.not.toBeAssignableTo<keyof typeof UseCasesPublic>();
expect<"VaultSyncStatus">().type.toBeAssignableTo<keyof typeof UseCasesPublic>();
expect<"VaultSyncActionError">().type.toBeAssignableTo<keyof typeof UseCasesPublic>();
expect<"VaultSyncRpcs">().type.toBeAssignableTo<keyof typeof UseCasesPublic>();
