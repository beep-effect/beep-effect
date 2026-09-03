/**
 * Deterministic proof-key and epoch-digest derivation.
 *
 * **Details**
 *
 * Every digest uses Effect's platform `Crypto` service. Components are UTF-8
 * encoded, separated by a NUL byte, and hashed in contract field order so
 * adjacent variable-length values cannot collide by concatenation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { Crypto, Effect, Encoding, FileSystem, Path } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { concatBytes } from "../../../internal/cli/Bytes.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import { ProofEpoch } from "./ProofFact.ts";
import type { ProofInputDigest } from "./ProofFact.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/ProofDigest");
const textEncoder = new TextEncoder();
const componentSeparator = new Uint8Array([0]);

class PolicyPackManifest extends S.Class<PolicyPackManifest>($I`PolicyPackManifest`)(
  { version: S.NonEmptyString },
  $I.annote("PolicyPackManifest", {
    description: "Policy-pack package manifest fields that participate in the proof epoch.",
  })
) {}

const decodePolicyPackManifest = S.decodeUnknownEffect(S.fromJsonString(PolicyPackManifest));

const digestBytes = Effect.fn("Yeet.ProofDigest.digestBytes")(function* (
  bytes: Uint8Array,
  label: string
): Effect.fn.Return<string, YeetCommandError, Crypto.Crypto> {
  const crypto = yield* Crypto.Crypto;
  const digest = yield* crypto
    .digest("SHA-256", bytes)
    .pipe(YeetCommandError.mapError(`Failed to hash ${label} for the proof epoch.`));
  return Encoding.encodeHex(digest);
});

const digestComponents = Effect.fn("Yeet.ProofDigest.digestComponents")(function* (
  components: ReadonlyArray<string>,
  label: string
): Effect.fn.Return<string, YeetCommandError, Crypto.Crypto> {
  const framed = pipeComponents(components);
  return yield* digestBytes(framed, label);
});

const pipeComponents = (components: ReadonlyArray<string>): Uint8Array =>
  concatBytes(
    A.intersperse(
      A.map(components, (component) => textEncoder.encode(component)),
      componentSeparator
    )
  );

const readFileBytes = Effect.fn("Yeet.ProofDigest.readFileBytes")(function* (
  filePath: string,
  label: string
): Effect.fn.Return<Uint8Array, YeetCommandError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs
    .readFile(filePath)
    .pipe(Effect.mapError(YeetCommandError.new(`Failed to read ${label} for the proof epoch.`, { file: filePath })));
});

const readPin = Effect.fn("Yeet.ProofDigest.readPin")(function* (
  filePath: string,
  label: string
): Effect.fn.Return<string, YeetCommandError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const value = yield* fs
    .readFileString(filePath)
    .pipe(
      Effect.map(Str.trim),
      Effect.mapError(YeetCommandError.new(`Failed to read ${label} for the proof epoch.`, { file: filePath }))
    );
  return yield* S.decodeEffect(S.NonEmptyString)(value).pipe(
    Effect.mapError(YeetCommandError.new(`The ${label} proof-epoch pin is empty.`, { file: filePath }))
  );
});

/**
 * Fields from {@link ProofInputDigest} that form its tier-independent key.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ProofInputKeyComponents = Pick<
  ProofInputDigest,
  "laneId" | "commandDigest" | "envProfile" | "inputDigest" | "epochDigest"
>;

/**
 * Fields from {@link ProofEpoch} combined into the epoch digest.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ProofEpochComponents = Pick<
  ProofEpoch,
  "lockfileDigest" | "bunVersion" | "nodeVersion" | "rootTurboConfigDigest" | "rootTsconfigDigest" | "policyPackVersion"
>;

/**
 * Derive a tier-independent proof input key from its five identity fields.
 *
 * **Example** (Derive a proof key effect)
 *
 * ```ts
 * import { proofInputKey } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const key = proofInputKey({
 *   laneId: "coverage",
 *   commandDigest: "command",
 *   envProfile: "local",
 *   inputDigest: "inputs",
 *   epochDigest: "epoch"
 * })
 * console.log(Effect.isEffect(key)) // true
 * ```
 *
 * @param digest - Lane, command, environment, input, and epoch identity in contract order.
 * @returns Lowercase hexadecimal SHA-256 digest.
 * @category utilities
 * @since 0.0.0
 */
export const proofInputKey = Effect.fn("Yeet.proofInputKey")(function* (
  digest: ProofInputKeyComponents
): Effect.fn.Return<string, YeetCommandError, Crypto.Crypto> {
  return yield* digestComponents(
    [digest.laneId, digest.commandDigest, digest.envProfile, digest.inputDigest, digest.epochDigest],
    "proof input key"
  );
});

/**
 * Combine the six ordered epoch components into one invalidation digest.
 *
 * **Example** (Derive an epoch digest effect)
 *
 * ```ts
 * import { proofEpochDigest } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const digest = proofEpochDigest({
 *   lockfileDigest: "lock",
 *   bunVersion: "1.4.0",
 *   nodeVersion: "24",
 *   rootTurboConfigDigest: "turbo",
 *   rootTsconfigDigest: "tsconfig",
 *   policyPackVersion: "0.1.0"
 * })
 * console.log(Effect.isEffect(digest)) // true
 * ```
 *
 * @param components - Lockfile, toolchain, root-config, and policy-pack components in contract order.
 * @returns Lowercase hexadecimal SHA-256 digest for the epoch.
 * @category utilities
 * @since 0.0.0
 */
export const proofEpochDigest = Effect.fn("Yeet.proofEpochDigest")(function* (
  components: ProofEpochComponents
): Effect.fn.Return<string, YeetCommandError, Crypto.Crypto> {
  return yield* digestComponents(
    [
      components.lockfileDigest,
      components.bunVersion,
      components.nodeVersion,
      components.rootTurboConfigDigest,
      components.rootTsconfigDigest,
      components.policyPackVersion,
    ],
    "proof epoch"
  );
});

/**
 * Collect the current checkout's six proof-epoch components without caching.
 *
 * **Details**
 *
 * File contents are read on every call. Large configuration inputs contribute
 * their content digests, while canonical toolchain and policy manifests
 * contribute their decoded version pins. The Node pin follows this repository's
 * `.nvmrc` source of truth.
 *
 * **Example** (Build an epoch collection effect)
 *
 * ```ts
 * import { collectProofEpoch } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(collectProofEpoch("/repo"))) // true
 * ```
 *
 * @param repoRoot - Checkout root containing the epoch source files.
 * @returns Current component values plus their combined digest.
 * @category services
 * @since 0.0.0
 */
export const collectProofEpoch = Effect.fn("Yeet.collectProofEpoch")(function* (
  repoRoot: string
): Effect.fn.Return<ProofEpoch, YeetCommandError, Crypto.Crypto | FileSystem.FileSystem | Path.Path> {
  const path = yield* Path.Path;
  const lockfilePath = path.join(repoRoot, "bun.lock");
  const bunVersionPath = path.join(repoRoot, ".bun-version");
  const nodeVersionPath = path.join(repoRoot, ".nvmrc");
  const turboConfigPath = path.join(repoRoot, "turbo.json");
  const tsconfigPath = path.join(repoRoot, "tsconfig.base.json");
  const policyPackManifestPath = path.join(
    repoRoot,
    "packages",
    "tooling",
    "policy-pack",
    "lint-rules",
    "package.json"
  );

  const [lockfileBytes, bunVersion, nodeVersion, turboConfigBytes, tsconfigBytes, policyPackManifestText] =
    yield* Effect.all(
      [
        readFileBytes(lockfilePath, "bun.lock"),
        readPin(bunVersionPath, ".bun-version"),
        readPin(nodeVersionPath, ".nvmrc"),
        readFileBytes(turboConfigPath, "turbo.json"),
        readFileBytes(tsconfigPath, "tsconfig.base.json"),
        readPin(policyPackManifestPath, "policy-pack package.json"),
      ],
      { concurrency: 6 }
    );
  const policyPackManifest = yield* decodePolicyPackManifest(policyPackManifestText).pipe(
    Effect.mapError(
      YeetCommandError.new("Failed to decode the policy-pack package.json for the proof epoch.", {
        file: policyPackManifestPath,
      })
    )
  );
  const [lockfileDigest, rootTurboConfigDigest, rootTsconfigDigest] = yield* Effect.all(
    [
      digestBytes(lockfileBytes, "bun.lock"),
      digestBytes(turboConfigBytes, "turbo.json"),
      digestBytes(tsconfigBytes, "tsconfig.base.json"),
    ],
    { concurrency: 3 }
  );
  const components: ProofEpochComponents = {
    lockfileDigest,
    bunVersion,
    nodeVersion,
    rootTurboConfigDigest,
    rootTsconfigDigest,
    policyPackVersion: policyPackManifest.version,
  };
  const digest = yield* proofEpochDigest(components);
  return ProofEpoch.make({ ...components, digest });
});
