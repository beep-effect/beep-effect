import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { InstalledConsumer, LayerEdge, LayeringReport, LayerPolicy, LayerPolicyError, Offence, PackageManagerName, PackageNotFoundError, PackedInstallError, PackedInstallResult, PublishConfig, SourceScan, WorkspaceDiscoveryError, WorkspaceInfo, WorkspaceManifestError, WorkspacePackage, WorkspacePatternError, WorkspaceRootNotFoundError } from "../../effected/workspaces/testing.ts";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(`${name}: encoded values decode successfully to equivalent values`, [Arbitrary.schema(schema)], ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(schema)(value);
    const decoded = yield* S.decodeEffect(schema)(encoded);
    assert.isTrue(S.toEquivalence(schema)(decoded, value));
    assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
  }), runs);
};

describe("testing entrypoint schema property floor", () => {
  roundTrips("InstalledConsumer", InstalledConsumer);
  roundTrips("LayerEdge", LayerEdge);
  roundTrips("LayeringReport", LayeringReport);
  roundTrips("LayerPolicy", LayerPolicy);
  roundTrips("LayerPolicyError", LayerPolicyError);
  roundTrips("Offence", Offence);
  roundTrips("PackageManagerName", PackageManagerName);
  roundTrips("PackageNotFoundError", PackageNotFoundError);
  roundTrips("PackedInstallError", PackedInstallError);
  roundTrips("PackedInstallResult", PackedInstallResult);
  roundTrips("PublishConfig", PublishConfig);
  roundTrips("SourceScan", SourceScan);
  roundTrips("WorkspaceDiscoveryError", WorkspaceDiscoveryError);
  roundTrips("WorkspaceInfo", WorkspaceInfo);
  roundTrips("WorkspaceManifestError", WorkspaceManifestError);
  roundTrips("WorkspacePackage", WorkspacePackage);
  roundTrips("WorkspacePatternError", WorkspacePatternError);
  roundTrips("WorkspaceRootNotFoundError", WorkspaceRootNotFoundError);
});
