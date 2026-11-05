/**
 * Read-only permission census over an explicitly selected set of records.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { flow, pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ModelsLocatorReader, ModelsLocatorReaderLive } from "../Models/Models.locator.service.ts";
import { LocatorBinding } from "../Models/Models.manifest.schemas.ts";
import { ModelsTargetFile } from "../Models/Models.paths.ts";
import { ContinuityInput, ContinuityObservation, PermissionTuple } from "./Continuity.schemas.ts";
import { SessionLedgerError } from "./Session.errors.ts";

const $I = $RepoCliId.create("commands/Session/Continuity.service");
const optionalText = S.OptionFromOptionalKey(S.NonEmptyString);
const Envelope = S.Struct({ type: S.String, timestamp: S.optionalKey(S.Unknown), payload: S.Unknown });
const Meta = S.Struct({ id: S.NonEmptyString, session_id: optionalText });
const Turn = S.Struct({
  approval_policy: S.NonEmptyString,
  sandbox_policy: S.Struct({ type: S.NonEmptyString }),
  permission_profile: S.Struct({ type: S.NonEmptyString }),
});
const Settings = S.Struct({ type: S.tag("thread_settings_applied") });
const ClaudeApp = S.Struct({ permissionMode: optionalText, cliSessionId: optionalText });
const ClaudeLine = S.Struct({
  type: S.String,
  sessionId: optionalText,
  permissionMode: optionalText,
});
const decodeEnvelope = S.decodeUnknownOption(S.fromJsonString(Envelope));
const decodeMeta = S.decodeUnknownOption(Meta);
const decodeTimestamp = S.decodeUnknownOption(S.DateTimeUtcFromString);
const decodeTuple = flow(
  S.decodeUnknownOption(Turn),
  O.map((value) =>
    PermissionTuple.make({
      approval: value.approval_policy,
      sandbox: value.sandbox_policy.type,
      profile: value.permission_profile.type,
    })
  )
);
const isSettings = S.is(Settings);
const decodeClaudeLine = S.decodeUnknownOption(S.fromJsonString(ClaudeLine));
const decodeContinuityInput = S.decodeUnknownEffect(S.fromJsonString(ContinuityInput));
const decodeClaudeApp = S.decodeUnknownEffect(S.fromJsonString(ClaudeApp));
const equivalentPolicy = S.toEquivalence(PermissionTuple);
const tupleText = (tuple: PermissionTuple): string => `${tuple.approval}/${tuple.sandbox}/${tuple.profile}`;
const lines = (text: string) => A.filter(A.map(Str.split(text, "\n"), Str.trim), Str.isNonEmpty);
const failure = (message: string) => SessionLedgerError.make({ reason: "decode", message });

class ObservationEvent extends S.Opaque<ObservationEvent, { readonly brand: unique symbol }>()(
  S.Struct({
    at: S.Finite,
    position: S.Int,
    segment: S.Int,
    boundary: S.Boolean,
    tuple: S.Option(PermissionTuple),
  }).pipe(
    $I.annoteSchema("ObservationEvent", {
      description: "Projected effective turn or settings boundary, without transcript content.",
    })
  )
) {}
class ThreadHistory extends S.Opaque<ThreadHistory, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.String,
    family: S.String,
    incomplete: S.Boolean,
    segments: S.Int,
    events: S.Array(ObservationEvent),
    policies: S.Array(PermissionTuple),
  }).pipe(
    $I.annoteSchema("ThreadHistory", {
      description: "Thread-keyed projected history across selected rollout segments.",
    })
  )
) {}

/**
 * Read-only census contract. It has no mutation, launch, resume, or approval operation.
 *
 * **Example** (Compose a read)
 * ```ts import.meta.vitest name="Compose a read"
 * import { PermissionContinuity } from "@beep/repo-cli/test/Session"
 * import * as Effect from "effect/Effect"
 * const read = PermissionContinuity.use((service) => service.read("fixture.json"))
 * Effect.isEffect(read) // => true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class PermissionContinuity extends Context.Service<
  PermissionContinuity,
  {
    readonly read: (manifest: string) => Effect.Effect<ReadonlyArray<ContinuityObservation>, SessionLedgerError>;
  }
>()($I`PermissionContinuity`) {}

const precedes = (left: ObservationEvent, right: ObservationEvent) =>
  left.at < right.at || (left.at === right.at && left.segment === right.segment && left.position < right.position);

const readCodex = (contents: ReadonlyArray<string>, expected: PermissionTuple) => {
  const threads = MutableHashMap.empty<string, ThreadHistory>();
  let orphaned = A.empty<ContinuityObservation>();
  A.forEach(contents, (content, segment) => {
    const raw = lines(content);
    const envelopes = A.map(raw, (line) => decodeEnvelope(line));
    const policies = A.getSomes(
      A.map(A.getSomes(envelopes), (row) => (row.type === "turn_context" ? decodeTuple(row.payload) : O.none()))
    );
    const first = A.findFirst(A.getSomes(envelopes), (row) => row.type === "session_meta");
    const meta = O.flatMap(first, (row) => decodeMeta(row.payload));
    if (O.isNone(meta)) {
      orphaned = A.append(
        orphaned,
        ContinuityObservation.make({
          app: "codex",
          id: `unidentified-${segment}`,
          family: "unknown",
          verdict: A.some(policies, (tuple) => !equivalentPolicy(tuple, expected)) ? "unsatisfied" : "unknown",
          tuples: A.dedupe(A.map(policies, tupleText)),
          boundaries: 0,
          detail: "Missing or invalid first session metadata; any decoded effective tuples are retained",
        })
      );
      return;
    }
    const id = meta.value.id;
    const family = O.getOrElse(meta.value.session_id, () => id);
    const previous = MutableHashMap.get(threads, id);
    let incomplete = A.some(envelopes, O.isNone) || O.isNone(meta.value.session_id);
    let events = A.empty<ObservationEvent>();
    A.forEach(A.getSomes(envelopes), (row, position) => {
      const boundary = row.type === "thread_settings_applied" || (row.type === "event_msg" && isSettings(row.payload));
      if (row.type !== "turn_context" && !boundary) return;
      const timestamp = decodeTimestamp(row.timestamp);
      if (O.isNone(timestamp)) {
        incomplete = true;
        return;
      }
      const tuple = boundary ? O.none<PermissionTuple>() : decodeTuple(row.payload);
      if (!boundary && O.isNone(tuple)) incomplete = true;
      events = A.append(
        events,
        ObservationEvent.make({ at: DateTime.toEpochMillis(timestamp.value), position, segment, boundary, tuple })
      );
    });
    MutableHashMap.set(
      threads,
      id,
      ThreadHistory.make({
        id,
        family,
        incomplete: incomplete || O.exists(previous, (row) => row.incomplete || row.family !== family),
        segments: O.match(previous, { onNone: () => 1, onSome: (row) => row.segments + 1 }),
        events: [...O.match(previous, { onNone: A.empty<ObservationEvent>, onSome: (row) => row.events }), ...events],
        policies: [
          ...O.match(previous, { onNone: A.empty<PermissionTuple>, onSome: (row) => row.policies }),
          ...policies,
        ],
      })
    );
  });
  return [
    ...orphaned,
    ...A.map(pipe(threads, MutableHashMap.values, A.fromIterable), (thread) => {
      const events = A.sort(
        thread.events,
        Order.combineAll([
          Order.mapInput(Order.Number, (event: ObservationEvent) => event.at),
          Order.mapInput(Order.Number, (event: ObservationEvent) => event.segment),
          Order.mapInput(Order.Number, (event: ObservationEvent) => event.position),
        ])
      );
      const turns = thread.policies;
      const effective = A.filter(events, (row) => O.isSome(row.tuple));
      const orderedPolicies = A.getSomes(A.map(events, (row) => row.tuple));
      const tuples = A.dedupe(A.map([...orderedPolicies, ...turns], tupleText));
      const settings = A.filter(events, (row) => row.boundary);
      // A settings event without an effective turn on each side cannot prove continuity.
      const openBoundary = A.some(
        settings,
        (boundary) =>
          !A.some(effective, (row) => precedes(row, boundary)) || !A.some(effective, (row) => precedes(boundary, row))
      );
      const mismatch = A.some(turns, (tuple) => !equivalentPolicy(tuple, expected));
      const incomplete =
        thread.incomplete ||
        openBoundary ||
        !A.isReadonlyArrayNonEmpty(turns) ||
        (thread.segments > 1 && A.length(A.dedupe(A.map(effective, (row) => row.segment))) < thread.segments);
      return ContinuityObservation.make({
        app: "codex",
        id: thread.id,
        family: thread.family,
        verdict: mismatch ? "unsatisfied" : incomplete ? "unknown" : "verified",
        tuples,
        boundaries: thread.segments - 1 + A.length(settings),
        detail: mismatch
          ? "Effective tuple differs from chosen policy; stop this fixture"
          : incomplete
            ? "Incomplete identity, turn or boundary evidence"
            : "Supplied metadata agrees; behavioural route verification remains separate",
      });
    }),
  ];
};

/**
 * Live census layer using filesystem reads and the existing owned-field locator reader.
 *
 * **Example** (Provide the census)
 * ```ts import.meta.vitest name="Provide the census"
 * import { PermissionContinuity, PermissionContinuityLive } from "@beep/repo-cli/test/Session"
 * import * as Effect from "effect/Effect"
 * const read = PermissionContinuity.use((service) => service.read("fixture.json")).pipe(Effect.provide(PermissionContinuityLive))
 * Effect.isEffect(read) // => true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const PermissionContinuityLive = Layer.effect(
  PermissionContinuity,
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const locator = yield* ModelsLocatorReader;
    const readText = (file: string) =>
      fs
        .readFileString(file)
        .pipe(Effect.mapError(() => failure("Cannot read a selected census file; no content was emitted")));
    return PermissionContinuity.of({
      read: Effect.fn("PermissionContinuity.read")(function* (manifest) {
        const input = yield* readText(manifest).pipe(
          Effect.flatMap(decodeContinuityInput),
          Effect.mapError(() => failure("Cannot decode the continuity manifest"))
        );
        const resolve = (file: string) => path.resolve(path.dirname(path.resolve(manifest)), file);
        const contents = yield* Effect.forEach(A.dedupe(input.rollouts), (file) => readText(resolve(file)), {
          concurrency: 1,
        });
        const codex = readCodex(contents, input.expected);
        const configs = yield* Effect.forEach(
          A.dedupe(input.configs),
          Effect.fnUntraced(function* (file, index) {
            const target = ModelsTargetFile.make({
              root: "home",
              absolutePath: resolve(file),
              content: yield* readText(resolve(file)),
            });
            const readKey = (key: string) =>
              locator
                .read(target, {
                  _tag: "toml-top-level-key",
                  key,
                  binding: LocatorBinding.make({ role: "codex.heavy", surface: "codex-cli", field: "model" }),
                  render: { _tag: "verbatim" },
                })
                .pipe(Effect.mapError(() => failure("Cannot inspect selected config keys")));
            const profile = yield* readKey("default_permissions");
            const legacy = yield* readKey("sandbox_mode");
            return ContinuityObservation.make({
              app: "config",
              id: `config-${index}`,
              family: "config",
              verdict: O.isSome(profile) && O.isSome(legacy) ? "unsatisfied" : "unknown",
              tuples: [],
              boundaries: 0,
              detail:
                O.isSome(profile) && O.isSome(legacy)
                  ? "default_permissions and legacy sandbox_mode coexist; use F's owned-field writer"
                  : "No profile/legacy collision observed; this is not resolved-policy proof",
            });
          }),
          { concurrency: 1 }
        );
        const claude = yield* Effect.forEach(
          input.claude,
          Effect.fnUntraced(function* (pair) {
            const app = yield* readText(resolve(pair.app)).pipe(
              Effect.flatMap(decodeClaudeApp),
              Effect.mapError(() => failure("Cannot decode selected Claude app record"))
            );
            const readText1 = yield* readText(resolve(pair.transcript));
            const transcript = lines(readText1);
            const decoded = A.map(transcript, (line) => decodeClaudeLine(line));
            const rows = A.getSomes(decoded);
            const modeRow = A.findLast(rows, (row) => row.type === "user" && O.isSome(row.permissionMode));
            const latest = O.flatMap(modeRow, (row) => row.permissionMode);
            const modeIdentity = O.flatMap(modeRow, (row) => row.sessionId);
            const mismatch =
              O.exists(app.permissionMode, (mode) => mode !== pair.expectedMode) ||
              O.exists(latest, (mode) => mode !== pair.expectedMode);
            const wrongPair = O.exists(app.cliSessionId, (appId) =>
              A.some(rows, (row) => O.exists(row.sessionId, (id) => id !== appId))
            );
            // A paired mode row already guarantees both a mode and a transcript identity.
            const incomplete =
              wrongPair ||
              A.some(decoded, O.isNone) ||
              O.isNone(app.permissionMode) ||
              !O.exists(app.cliSessionId, (appId) => O.exists(modeIdentity, (id) => id === appId));
            return ContinuityObservation.make({
              app: "claude",
              id: pair.id,
              family: pair.id,
              verdict: mismatch ? "unsatisfied" : incomplete ? "unknown" : "verified",
              tuples: A.getSomes([app.permissionMode, latest]),
              boundaries: 0,
              detail: mismatch
                ? "App or last CLI permissionMode differs from chosen mode; stop this fixture"
                : incomplete
                  ? "Missing, corrupt or mismatched app/transcript identity or mode"
                  : "App and last CLI mode agree; freshness and behavioural route verification remain separate",
            });
          }),
          { concurrency: 1 }
        );
        return [...codex, ...configs, ...claude];
      }),
    });
  })
).pipe(Layer.provide(ModelsLocatorReaderLive));
