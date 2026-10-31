/**
 * Reviewed source and runtime identities for the protected cache supervisor.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { GitObjectId } from "@beep/schema/Conformance";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { CacheProducerAdapterLaunch } from "./Cache.adapter.schemas.ts";
import { CacheConformanceBearers, CacheConformanceTarget } from "./Cache.conformance.schemas.ts";
import { CacheProducerBundle, CacheProducerEnvelope } from "./Cache.producer.schemas.ts";
import { CacheCensusSource, CacheLinkedFile, CacheToolchainSnapshot } from "./Cache.schemas.ts";

const $I = $RepoCliId.create("commands/Cache/Cache.workflow.schemas");
/**
 * Source bytes, permission bits and an optional source alias target.
 *
 * **Example** (Inspect source bindings)
 * ```ts
 * import { CacheProducerWorkflowFile } from "@beep/repo-cli/test/Cache"
 * console.assert("linkTarget" in CacheProducerWorkflowFile.fields)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CacheProducerWorkflowFile extends S.Opaque<CacheProducerWorkflowFile, { readonly brand: unique symbol }>()(
  S.Struct({
    ...CacheCensusSource.fields,
    mode: S.Natural,
    linkTarget: S.OptionFromOptionalKey(S.NonEmptyString),
  }).pipe(
    $I.annoteSchema("CacheProducerWorkflowFile", {
      description: "Exact bytes and resolution of one declared supervisor source file.",
    })
  )
) {}
/**
 * Bounded declared supervisor source inventory and independently observed runtime.
 *
 * **Details**
 * This identity is a prerequisite for approval, not approval itself. The execution
 * profile requires clean declared sources without ignored executable overrides
 * or workspace-local dependency directories, plus a separately bound root dependency tree.
 *
 * **Example** (Inspect workflow identity components)
 * ```ts
 * import { CacheProducerWorkflow } from "@beep/repo-cli/test/Cache"
 * console.assert("toolchain" in CacheProducerWorkflow.fields)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CacheProducerWorkflow extends S.Opaque<CacheProducerWorkflow, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("cache-producer-workflow/v2"),
    executionProfile: S.tag("clean-declared-sources/root-dependencies/v1"),
    revision: GitObjectId,
    files: S.Array(CacheProducerWorkflowFile).check(S.isMinLength(1), S.isMaxLength(20000)),
    toolchain: CacheToolchainSnapshot,
    inspectionTools: S.Array(CacheLinkedFile).check(S.isMinLength(6), S.isMaxLength(7)),
  }).pipe(
    $I.annoteSchema("CacheProducerWorkflow", {
      description:
        "Declared supervisor source, installed dependencies, runtime and inspection-tool identities; no approval authority.",
    })
  )
) {}

/**
 * One owned execution and its authenticated producer envelope, without promotion authority.
 *
 * **Example** (Inspect authenticated observation fields)
 * ```ts
 * import { CacheProducerObservation } from "@beep/repo-cli/test/Cache"
 * console.assert("envelope" in CacheProducerObservation.fields)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CacheProducerObservation extends S.Opaque<CacheProducerObservation, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("cache-producer-observation/v2"),
    authority: S.tag("authenticated-observation-only"),
    observation: CacheProducerBundle,
    envelope: CacheProducerEnvelope,
  }).pipe(
    $I.annoteSchema("CacheProducerObservation", {
      description:
        "Owned complete pilot and conformance execution authenticated by a pre-provisioned issuer; qualification evidence and profile closure remain separate gates.",
    })
  )
) {}

/**
 * Supervisor-only target and credentials for an independently approved upload.
 *
 * **Details**
 * Never serialize this runtime value. Only the target descriptor is hashed into
 * independent approval; bearer and artifact-key values stay redacted and are
 * delivered to the owned worker through its restricted environment.
 *
 * **Example** (Inspect the runtime boundary)
 * ```ts
 * import { CacheProducerUploadRuntime } from "@beep/repo-cli/test/Cache"
 * console.assert("signing" in CacheProducerUploadRuntime.fields)
 * ```
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export class CacheProducerUploadRuntime extends S.Opaque<
  CacheProducerUploadRuntime,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    target: CacheConformanceTarget,
    bearers: CacheConformanceBearers,
    signing: S.Redacted(S.NonEmptyString),
    adapter: S.OptionFromOptionalKey(CacheProducerAdapterLaunch).pipe(S.withConstructorDefault(Effect.succeedNone)),
  }).pipe(
    $I.annoteSchema("CacheProducerUploadRuntime", {
      description: "Unserialized parent-owned upload target, role bearers and native signing capability.",
    })
  )
) {}

/**
 * Nonsecret execution settings installed beside a pre-provisioned issuer.
 *
 * **Details**
 * The supervisor selects this private record independently of experiment
 * requests. Its target must match the destination digest fixed in the issuer's
 * approval. Credentials are loaded separately and never belong in this record.
 *
 * **Example** (Require an approved destination)
 * ```ts
 * import { CacheProducerExecutionProfile } from "@beep/repo-cli/test/Cache"
 * import * as S from "effect/Schema"
 * console.assert(!S.is(CacheProducerExecutionProfile)({ adapterExecutable: "/adapter" }))
 * ```
 *
 * @internal
 * @category configuration
 * @since 0.0.0
 */
export class CacheProducerExecutionProfile extends S.Opaque<
  CacheProducerExecutionProfile,
  { readonly brand: unique symbol }
>()(
  S.Struct({ target: CacheConformanceTarget, adapterExecutable: S.NonEmptyString }).pipe(
    $I.annoteSchema("CacheProducerExecutionProfile", {
      description: "Private nonsecret destination and executable selection for an independently approved producer.",
    })
  )
) {}
