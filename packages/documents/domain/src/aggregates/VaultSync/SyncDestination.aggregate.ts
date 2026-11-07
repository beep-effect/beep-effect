/**
 * Vault sync declarations for the event-sourced documents slice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Domain from "@alchemy.run/domain";
import * as H from "effect/HashMap";
import * as O from "effect/Option";
import * as Struct from "effect/Struct";
import * as C from "./SyncDestination.command.ts";
import { SyncRuleViolation } from "./SyncRuleViolation.rejection.ts";
import * as V from "./Values.ts";

const refused = (rule: string) => SyncRuleViolation.make({ rule, evidence: "destination state" });
/**
 * SyncDestination vault sync contract.
 *
 * **Example** (Address one aggregate stream)
 * ```ts
 * import * as V from "@beep/documents-domain/aggregates/VaultSync";
 * const ref=V.SyncDestination.ref(V.DestinationId.make("vault"));
 * console.log(ref.id);
 * ```
 * @category aggregates
 * @since 0.0.0
 */
export class SyncDestination extends Domain.Aggregate("SyncDestination", {
  id: V.DestinationId,
  state: C.DestinationState,
  initial: { _tag: "Unregistered" },
  commands: [
    C.RegisterDestination,
    C.RenameDestination,
    C.ResolveDestinationRoot,
    C.PauseDestination,
    C.ResumeDestination,
    C.RecordDestinationPoll,
    C.ClaimItemPath,
    C.ReleaseItemPath,
  ],
  decide: {
    RegisterDestination: (s, c) =>
      s._tag === "Unregistered"
        ? [C.DestinationRegistered.make(Struct.omit(c, ["_tag"]))]
        : s.orgId === c.orgId && s.workspaceId === c.workspaceId && s.name === c.name
          ? []
          : refused("already-registered"),
    RenameDestination: (s, c) =>
      s._tag !== "Registered"
        ? refused("not-registered")
        : s.orgId !== c.orgId || s.workspaceId !== c.workspaceId
          ? refused("destination-scope")
          : s.name === c.name
            ? []
            : s.name !== c.previousName
              ? refused("stale-name")
              : [C.DestinationRenamed.make(Struct.omit(c, ["_tag"]))],
    ResolveDestinationRoot: (s, c) =>
      s._tag === "Registered" ? [C.RootFolderResolved.make(Struct.omit(c, ["_tag"]))] : refused("not-registered"),
    PauseDestination: (s) =>
      s._tag === "Registered" ? (s.paused ? [] : [C.DestinationPaused.make({})]) : refused("not-registered"),
    ResumeDestination: (s) => (s._tag === "Registered" ? [C.DestinationConnected.make({})] : refused("not-registered")),
    RecordDestinationPoll: (s, c) =>
      s._tag !== "Registered"
        ? refused("not-registered")
        : c.error !== null
          ? [C.CursorFailed.make({ reason: c.error })]
          : c.position !== null
            ? [C.CursorAdvanced.make({ position: c.position })]
            : refused("poll-result"),
    ClaimItemPath: (s, c) => {
      if (s._tag !== "Registered") return refused("not-registered");
      const owner = H.get(s.paths, c.path);
      return O.isSome(owner)
        ? owner.value === c.itemId
          ? []
          : refused("path-held")
        : [C.ItemPathClaimed.make(Struct.omit(c, ["_tag"]))];
    },
    ReleaseItemPath: (s, c) =>
      s._tag === "Registered" && O.contains(c.itemId)(H.get(s.paths, c.path))
        ? [C.ItemPathReleased.make(Struct.omit(c, ["_tag"]))]
        : [],
  },
  evolve: {
    DestinationRegistered: (_, e): C.DestinationState => ({
      _tag: "Registered",
      orgId: e.orgId,
      workspaceId: e.workspaceId,
      name: e.name,
      provider: "box",
      rootId: null,
      cursor: null,
      cursorError: null,
      paused: false,
      paths: H.empty(),
    }),
    DestinationRenamed: (s, e): C.DestinationState => (s._tag === "Registered" ? { ...s, name: e.name } : s),
    RootFolderResolved: (s, e): C.DestinationState => (s._tag === "Registered" ? { ...s, rootId: e.rootId } : s),
    DestinationPaused: (s): C.DestinationState => (s._tag === "Registered" ? { ...s, paused: true } : s),
    DestinationConnected: (s): C.DestinationState => (s._tag === "Registered" ? { ...s, paused: false } : s),
    CursorAdvanced: (s, e): C.DestinationState =>
      s._tag === "Registered" ? { ...s, cursor: e.position, cursorError: null } : s,
    CursorFailed: (s, e): C.DestinationState => (s._tag === "Registered" ? { ...s, cursorError: e.reason } : s),
    ItemPathClaimed: (s, e): C.DestinationState =>
      s._tag === "Registered" ? { ...s, paths: H.set(s.paths, e.path, e.itemId) } : s,
    ItemPathReleased: (s, e): C.DestinationState =>
      s._tag === "Registered" ? { ...s, paths: H.remove(s.paths, e.path) } : s,
  },
}) {}
