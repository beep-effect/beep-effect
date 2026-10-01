/**
 * Reviewed source and runtime identities for the protected cache supervisor.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { GitObjectId } from "@beep/schema/Conformance";
import * as S from "effect/Schema";
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
export class CacheProducerWorkflowFile extends S.Class<CacheProducerWorkflowFile>($I`CacheProducerWorkflowFile`)(
  { ...CacheCensusSource.fields, mode: S.Natural, linkTarget: S.OptionFromOptionalKey(S.NonEmptyString) },
  $I.annote("CacheProducerWorkflowFile", {
    description: "Exact bytes and resolution of one declared supervisor source file.",
  })
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
export class CacheProducerWorkflow extends S.Class<CacheProducerWorkflow>($I`CacheProducerWorkflow`)(
  {
    schemaVersion: S.tag("cache-producer-workflow/v2"),
    executionProfile: S.tag("clean-declared-sources/root-dependencies/v1"),
    revision: GitObjectId,
    files: S.Array(CacheProducerWorkflowFile).check(S.isMinLength(1), S.isMaxLength(20000)),
    toolchain: CacheToolchainSnapshot,
    inspectionTools: S.Array(CacheLinkedFile).check(S.isMinLength(6), S.isMaxLength(6)),
  },
  $I.annote("CacheProducerWorkflow", {
    description:
      "Declared supervisor source, installed dependencies, runtime and inspection-tool identities; no approval authority.",
  })
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
export class CacheProducerObservation extends S.Class<CacheProducerObservation>($I`CacheProducerObservation`)(
  {
    schemaVersion: S.tag("cache-producer-observation/v2"),
    authority: S.tag("authenticated-observation-only"),
    observation: CacheProducerBundle,
    envelope: CacheProducerEnvelope,
  },
  $I.annote("CacheProducerObservation", {
    description:
      "Owned complete pilot and conformance execution authenticated by a pre-provisioned issuer; qualification evidence and profile closure remain separate gates.",
  })
) {}
