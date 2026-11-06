/** Explicit fake deployment identities; no claim of attesting a deployed build.
 * @internal @packageDocumentation @since 0.0.0
 */
import { CitationEngineBuildIdentity } from "@beep/law-practice-server/internal/Citation/EngineArtifact";
import { Sha256Hex } from "@beep/schema";
import * as Str from "effect/String";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";

/** Supply the installer's build/port role for connected replay.
 * @internal @category testing @since 0.0.0
 */
export const citationFixtureEngineBuild = (kind: CitationNativeRuntimeKind) =>
  CitationEngineBuildIdentity.make({
    implementation: Sha256Hex.make(Str.repeat(64)("a")),
    runtime: { kind, version: "test-runtime/v1" },
    cleaner: Sha256Hex.make(Str.repeat(64)("b")),
    tokenizer: Sha256Hex.make(Str.repeat(64)("c")),
  });
