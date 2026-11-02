import {
  AI_METRICS_LOCAL_INSECURE_HASH_SALT,
  HookPulseNamespaceProjection,
  hashPrivateIdentifier,
  hookPulseNamespace,
  hookPulseNamespaceCutoverMillis,
  hookPulseNamespaceProjectionPath,
  hookPulseNamespaceSalts,
  resolveAiMetricsHashSaltValue,
} from "@beep/repo-ai-metrics";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";

const CUTOVER = "2026-11-02T04:00:00.000Z";
const PROJECTION_SALT = "projection-fixture-salt";

const encodeJson = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));
const decodeJson = S.decodeUnknownEffect(S.fromJsonString(S.Unknown));
const projectionDocument = (overrides: Record<string, unknown> = {}) => ({
  version: 1,
  cutoverUtc: CUTOVER,
  hashSalt: PROJECTION_SALT,
  previousRegime: "library-default",
  ...overrides,
});
const projectionJson = (overrides: Record<string, unknown> = {}) => encodeJson(projectionDocument(overrides));

const withEnv = <A, E, R>(env: Record<string, string>, effect: Effect.Effect<A, E, R>) =>
  Effect.provideService(effect, ConfigProvider.ConfigProvider, ConfigProvider.fromEnv({ env }));

// A scoped projection file; the resolver is pointed at it through the explicit
// path variable so the ambient cache home is never read.
const writeProjection = Effect.fnUntraced(function* (text: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const dir = yield* fs.makeTempDirectoryScoped({ prefix: "hook-pulse-namespace-" });
  const file = path.join(dir, "namespace-projection.json");
  yield* fs.writeFileString(file, text);
  return { dir, file };
});

it.layer(NodeServices.layer, { timeout: "30 seconds", excludeTestServices: true })((it) => {
  describe("hookPulseNamespaceProjectionPath", () => {
    it.effect("defaults to the XDG cache home and honours the explicit override", () =>
      Effect.gen(function* () {
        assertSome(
          yield* withEnv({ HOME: "/home/ada" }, hookPulseNamespaceProjectionPath),
          "/home/ada/.cache/beep/telemetry/namespace-projection.json"
        );
        assertSome(
          yield* withEnv({ HOME: "/home/ada", XDG_CACHE_HOME: "/var/cache/ada" }, hookPulseNamespaceProjectionPath),
          "/var/cache/ada/beep/telemetry/namespace-projection.json"
        );
        assertSome(
          yield* withEnv(
            { HOME: "/home/ada", BEEP_HOOK_PULSE_NAMESPACE_PROJECTION: "/fixtures/p.json" },
            hookPulseNamespaceProjectionPath
          ),
          "/fixtures/p.json"
        );
        assertNone(yield* withEnv({}, hookPulseNamespaceProjectionPath));
      })
    );
  });

  describe("hookPulseNamespace", () => {
    it.effect("falls through to the library default when nothing is configured", () =>
      Effect.gen(function* () {
        const namespace = yield* withEnv({}, hookPulseNamespace);
        expect(namespace.source).toBe("library-default");
        assertNone(namespace.hashSalt);
        assertNone(namespace.projection);
        expect(A.length(hookPulseNamespaceSalts(namespace))).toBe(1);
        assertNone(hookPulseNamespaceCutoverMillis(namespace));
      })
    );

    it.effect("reads the projection and joins under both regimes", () =>
      Effect.gen(function* () {
        const { file } = yield* writeProjection(yield* projectionJson());
        const namespace = yield* withEnv(
          { BEEP_HOOK_PULSE_NAMESPACE_PROJECTION: file, BEEP_AI_METRICS_HASH_SALT: "repo-wide" },
          hookPulseNamespace
        );
        expect(namespace.source).toBe("projection");
        assertSome(namespace.hashSalt, PROJECTION_SALT);
        const salts = hookPulseNamespaceSalts(namespace);
        expect(A.map(salts, (salt) => salt.regime)).toEqual(["current", "previous"]);
        assertSome(A.getUnsafe(salts, 0).hashSalt, PROJECTION_SALT);
        assertNone(A.getUnsafe(salts, 1).hashSalt);
        expect(resolveAiMetricsHashSaltValue(A.getUnsafe(salts, 1).hashSalt)).toBe(AI_METRICS_LOCAL_INSECURE_HASH_SALT);
        assertSome(hookPulseNamespaceCutoverMillis(namespace), DateTime.toEpochMillis(DateTime.makeUnsafe(CUTOVER)));
        // The previous-regime digest is the one an unconfigured writer produced.
        expect(yield* hashPrivateIdentifier("value", A.getUnsafe(salts, 1).hashSalt)).toBe(
          yield* hashPrivateIdentifier("value", O.none())
        );
      })
    );

    it.effect("keeps the instrument override above the projection and the projection above the repo-wide salt", () =>
      Effect.gen(function* () {
        const { file } = yield* writeProjection(yield* projectionJson());
        const overridden = yield* withEnv(
          { BEEP_HOOK_PULSE_NAMESPACE_PROJECTION: file, BEEP_HOOK_PULSE_HASH_SALT: "instrument" },
          hookPulseNamespace
        );
        expect(overridden.source).toBe("hook-pulse-env");
        assertSome(overridden.hashSalt, "instrument");
        assertTrue(overridden.projection.pipe(O.isSome));
        const blankOverride = yield* withEnv(
          { BEEP_HOOK_PULSE_NAMESPACE_PROJECTION: file, BEEP_HOOK_PULSE_HASH_SALT: "   " },
          hookPulseNamespace
        );
        expect(blankOverride.source).toBe("projection");
        const repoWide = yield* withEnv({ BEEP_AI_METRICS_HASH_SALT: "repo-wide" }, hookPulseNamespace);
        expect(repoWide.source).toBe("ai-metrics-env");
        assertSome(repoWide.hashSalt, "repo-wide");
      })
    );

    it.effect("fails closed on a malformed, blank-salt, or symlinked projection", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const malformed = yield* writeProjection("{not json");
        const malformedExit = yield* withEnv(
          { BEEP_HOOK_PULSE_NAMESPACE_PROJECTION: malformed.file },
          hookPulseNamespace
        ).pipe(Effect.flip);
        expect(malformedExit._tag).toBe("HookPulseNamespaceError");

        const blank = yield* writeProjection(yield* projectionJson({ hashSalt: "  " }));
        const blankExit = yield* withEnv({ BEEP_HOOK_PULSE_NAMESPACE_PROJECTION: blank.file }, hookPulseNamespace).pipe(
          Effect.flip
        );
        expect(blankExit._tag).toBe("HookPulseNamespaceError");

        const wrongVersion = yield* writeProjection(yield* projectionJson({ version: 2 }));
        const versionExit = yield* withEnv(
          { BEEP_HOOK_PULSE_NAMESPACE_PROJECTION: wrongVersion.file },
          hookPulseNamespace
        ).pipe(Effect.flip);
        expect(versionExit._tag).toBe("HookPulseNamespaceError");

        const linked = yield* writeProjection(yield* projectionJson());
        const link = path.join(linked.dir, "link.json");
        yield* fs.symlink(linked.file, link);
        const linkExit = yield* withEnv({ BEEP_HOOK_PULSE_NAMESPACE_PROJECTION: link }, hookPulseNamespace).pipe(
          Effect.flip
        );
        expect(linkExit._tag).toBe("HookPulseNamespaceError");
        expect(linkExit.message).toContain("symlink");
      })
    );

    it.effect("round-trips the projection document", () =>
      Effect.gen(function* () {
        const decoded = yield* HookPulseNamespaceProjection.decodeJsonEffect(yield* projectionJson());
        expect(decoded.version).toBe(1);
        expect(decoded.hashSalt).toBe(PROJECTION_SALT);
        expect(decoded.previousRegime).toBe("library-default");
        const encoded = yield* HookPulseNamespaceProjection.encodeJsonEffect(decoded);
        expect(yield* decodeJson(encoded)).toEqual(projectionDocument());
      })
    );
  });
});
