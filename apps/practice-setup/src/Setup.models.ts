/**
 * Data of the Windows bootstrapper: its steps, their outcomes, the run
 * report, the pinned Claude Desktop installer, the onboarding hand-off link,
 * and the read-only views of Claude Desktop's own state files its probes use.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PracticeSetupId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { dual, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $PracticeSetupId.create("Setup.models");

// The bootstrapper's steps, in the order it runs them.
const SetupStep = LiteralKit(["claude-desktop", "claude-sign-in", "gateway-extension", "onboarding-handoff"]).pipe(
  $I.annoteSchema("SetupStep", {
    description: "One bootstrapper step: install Claude, sign in, install the gateway, hand off to onboarding.",
  })
);

/**
 * One bootstrapper step, in run order: `claude-desktop`, `claude-sign-in`,
 * `gateway-extension`, `onboarding-handoff`.
 *
 * **Example** (Type a step)
 *
 * ```ts
 * import type { SetupStep } from "@/Setup.models"
 *
 * const step: SetupStep = "gateway-extension"
 * console.log(step)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SetupStep = typeof SetupStep.Type;

/**
 * How Claude Desktop is installed for this Windows account, if at all.
 *
 * **Details**
 *
 * `per-user` is Claude Setup's per-user install (the `AnthropicClaude`
 * uninstall key or `%LOCALAPPDATA%\AnthropicClaude\claude.exe`); `msix` is the
 * `Claude_pzs8sxrjxfjjc` package an administrator or MDM deploys.
 *
 * **Example** (Check an install kind)
 *
 * ```ts
 * import { ClaudeInstall } from "@/Setup.models"
 *
 * console.log(ClaudeInstall.is.missing("missing")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ClaudeInstall = LiteralKit(["per-user", "msix", "missing"]).pipe(
  $I.annoteSchema("ClaudeInstall", {
    description: "How Claude Desktop is installed for this Windows account, if at all.",
  })
);

/**
 * Decoded type of {@link ClaudeInstall}.
 *
 * **Example** (Type an install kind)
 *
 * ```ts
 * import type { ClaudeInstall } from "@/Setup.models"
 *
 * const install: ClaudeInstall = "per-user"
 * console.log(install)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ClaudeInstall = typeof ClaudeInstall.Type;

const StepDetail = S.NonEmptyString.annotateKey({ description: "What happened, in plain language." });

/**
 * A step that ran and did its job.
 *
 * **Example** (A finished step)
 *
 * ```ts
 * import { StepDone } from "@/Setup.models"
 *
 * console.log(StepDone.make({ step: "claude-desktop", detail: "Claude Desktop is installed." }).outcome) // "done"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StepDone extends S.Opaque<StepDone, { readonly brand: unique symbol }>()(
  S.Struct({ outcome: S.tag("done"), step: SetupStep, detail: StepDetail }).pipe(
    $I.annoteSchema("StepDone", { description: "A bootstrapper step that ran and did its job." })
  )
) {}

/**
 * A step with nothing to do, such as Claude Desktop already installed.
 *
 * **Example** (A skipped step)
 *
 * ```ts
 * import { StepSkipped } from "@/Setup.models"
 *
 * console.log(StepSkipped.make({ step: "claude-desktop", detail: "Already installed." }).outcome) // "skipped"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StepSkipped extends S.Opaque<StepSkipped, { readonly brand: unique symbol }>()(
  S.Struct({ outcome: S.tag("skipped"), step: SetupStep, detail: StepDetail }).pipe(
    $I.annoteSchema("StepSkipped", { description: "A bootstrapper step with nothing to do." })
  )
) {}

/**
 * A step that failed; the run stops after it.
 *
 * **Example** (A failed step)
 *
 * ```ts
 * import { StepFailed } from "@/Setup.models"
 *
 * console.log(StepFailed.make({ step: "gateway-extension", detail: "The gateway file is missing." }).outcome) // "failed"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StepFailed extends S.Opaque<StepFailed, { readonly brand: unique symbol }>()(
  S.Struct({ outcome: S.tag("failed"), step: SetupStep, detail: StepDetail }).pipe(
    $I.annoteSchema("StepFailed", { description: "A bootstrapper step that failed; later steps do not run." })
  )
) {}

/**
 * The outcome of one bootstrapper step.
 *
 * **Example** (Match an outcome)
 *
 * ```ts
 * import { StepDone, StepOutcome } from "@/Setup.models"
 *
 * const outcome = StepDone.make({ step: "onboarding-handoff", detail: "Claude is open." })
 * console.log(StepOutcome.guards.done(outcome)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const StepOutcome = S.Union([StepDone, StepSkipped, StepFailed]).pipe(
  S.toTaggedUnion("outcome"),
  $I.annoteSchema("StepOutcome", { description: "The outcome of one bootstrapper step." })
);

/**
 * Decoded type of {@link StepOutcome}.
 *
 * **Example** (Type an outcome)
 *
 * ```ts
 * import { StepSkipped } from "@/Setup.models"
 * import type { StepOutcome } from "@/Setup.models"
 *
 * const outcome: StepOutcome = StepSkipped.make({ step: "claude-desktop", detail: "Already installed." })
 * console.log(outcome.step)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type StepOutcome = typeof StepOutcome.Type;

/**
 * The evidence one bootstrapper run leaves behind: every step's outcome, in
 * order, and whether the run reached the onboarding hand-off.
 *
 * **Example** (A complete run)
 *
 * ```ts
 * import { SetupReport, StepDone } from "@/Setup.models"
 * import * as DateTime from "effect/DateTime"
 *
 * const report = SetupReport.make({
 *   outcomes: [StepDone.make({ step: "onboarding-handoff", detail: "Claude is open." })],
 *   complete: true,
 *   finishedAt: DateTime.makeUnsafe(0),
 * })
 * console.log(report.complete) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SetupReport extends S.Opaque<SetupReport, { readonly brand: unique symbol }>()(
  S.Struct({
    outcomes: S.Array(StepOutcome).annotateKey({ description: "Each step's outcome in run order." }),
    complete: S.Boolean.annotateKey({ description: "True when the run reached the onboarding hand-off." }),
    finishedAt: S.DateTimeUtcFromMillis.annotateKey({ description: "When the run ended." }),
  }).pipe(
    $I.annoteSchema("SetupReport", {
      description: "The structured result of one bootstrapper run, written beside its state for the evidence bundle.",
    })
  )
) {}

/**
 * A Claude Desktop installer pinned by URL and SHA-256.
 *
 * **Example** (Pin an installer)
 *
 * ```ts
 * import { PinnedInstaller } from "@/Setup.models"
 *
 * const installer = PinnedInstaller.make({
 *   version: "1.0.0",
 *   url: "https://example.com/Claude.exe",
 *   sha256: "0".repeat(64),
 *   silentArgs: ["--silent"],
 * })
 * console.log(installer.version)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PinnedInstaller extends S.Opaque<PinnedInstaller, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.NonEmptyString.annotateKey({ description: "Claude Desktop version the installer installs." }),
    url: S.NonEmptyString.annotateKey({ description: "Official download URL of the installer." }),
    sha256: S.String.check(S.isPattern(/^[0-9a-f]{64}$/)).annotateKey({
      description: "Lower-case hex SHA-256 of the installer, checked before it runs.",
    }),
    silentArgs: S.Array(S.String).annotateKey({ description: "Arguments that run the installer without UI." }),
  }).pipe(
    $I.annoteSchema("PinnedInstaller", {
      description: "A Claude Desktop installer pinned by URL and SHA-256.",
    })
  )
) {}

/**
 * The Claude Desktop per-user installer the bootstrapper downloads.
 *
 * **Details**
 *
 * Pinned from the `Anthropic.Claude` 2.9939.4 winget manifest (x64 EXE,
 * `Scope: user`, silent switch `--silent`): no administrator prompt, and
 * Claude updates itself after the first install. Refresh the pin from a newer
 * manifest when it ages; the hash is checked before the installer runs.
 *
 * **Example** (Read the pinned version)
 *
 * ```ts
 * import { ClaudeDesktopInstaller } from "@/Setup.models"
 *
 * console.log(ClaudeDesktopInstaller.version) // "2.9939.4"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ClaudeDesktopInstaller = PinnedInstaller.make({
  version: "2.9939.4",
  url: "https://downloads.claude.ai/releases/win32/x64/2.9939.4/Claude-a166d8a7c640e65ad825ebfb99d74ccbb9c8940d.exe",
  sha256: "b233f34379ed8e9ced2c765d29aecfd35ed4d773bcf12cf5a7bb588825170590",
  silentArgs: ["--silent"],
});

/**
 * The message the hand-off prefills in a new Claude chat. The lawyer presses
 * send; the gateway's onboarding guide takes it from there.
 *
 * **Example** (Read the first message)
 *
 * ```ts
 * import { ONBOARDING_FIRST_MESSAGE } from "@/Setup.models"
 *
 * console.log(ONBOARDING_FIRST_MESSAGE.length > 0) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ONBOARDING_FIRST_MESSAGE = "Please set up this computer for my practice with the Practice Gateway.";

/**
 * The `claude://` link that opens a new Claude Desktop chat with `message`
 * prefilled.
 *
 * **Details**
 *
 * Claude Desktop documents `claude://claude.ai/new?q=` with a URL-encoded
 * value, truncated at about 14,000 characters, and never sends it
 * automatically (support article 14729294, checked 2026-10-14). The first VM
 * run opened Claude without the text, so the hand-off also copies the message
 * to the clipboard.
 *
 * **Example** (Link the first message)
 *
 * ```ts
 * import { newChatLink } from "@/Setup.models"
 *
 * console.log(newChatLink("Set up my practice")) // "claude://claude.ai/new?q=Set%20up%20my%20practice"
 * ```
 *
 * @param message - Text to prefill.
 * @category constructors
 * @since 0.0.0
 */
export const newChatLink = (message: string): string => `claude://claude.ai/new?q=${encodeURIComponent(message)}`;

/**
 * The link that brings Claude Desktop to the front on a new chat, for the
 * sign-in step.
 *
 * **Example** (Read the link)
 *
 * ```ts
 * import { OPEN_CLAUDE_LINK } from "@/Setup.models"
 *
 * console.log(OPEN_CLAUDE_LINK) // "claude://claude.ai/new"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const OPEN_CLAUDE_LINK = "claude://claude.ai/new";

/**
 * Whether Claude Desktop has a signed-in account: `signed-in`, `signed-out`,
 * or `unknown` when its state file cannot be read or decoded.
 *
 * **Example** (Check a sign-in state)
 *
 * ```ts
 * import { SignInState } from "@/Setup.models"
 *
 * console.log(SignInState.is["signed-in"]("signed-in")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SignInState = LiteralKit(["signed-in", "signed-out", "unknown"]).pipe(
  $I.annoteSchema("SignInState", {
    description: "Whether Claude Desktop has a signed-in account; unknown when its files cannot tell.",
  })
);

/**
 * Decoded type of {@link SignInState}.
 *
 * **Example** (Type a sign-in state)
 *
 * ```ts
 * import type { SignInState } from "@/Setup.models"
 *
 * const state: SignInState = "unknown"
 * console.log(state)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SignInState = typeof SignInState.Type;

/**
 * Whether Claude Desktop lists the practice gateway extension: `current`
 * (the embedded bundle's version), `outdated` (another version), `missing`,
 * or `unknown` when its registry cannot be read or decoded.
 *
 * **Example** (Check a gateway state)
 *
 * ```ts
 * import { GatewayInstallState } from "@/Setup.models"
 *
 * console.log(GatewayInstallState.is.outdated("outdated")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GatewayInstallState = LiteralKit(["current", "outdated", "missing", "unknown"]).pipe(
  $I.annoteSchema("GatewayInstallState", {
    description: "Whether Claude Desktop lists the practice gateway, at which version; unknown when it cannot tell.",
  })
);

/**
 * Decoded type of {@link GatewayInstallState}.
 *
 * **Example** (Type a gateway state)
 *
 * ```ts
 * import type { GatewayInstallState } from "@/Setup.models"
 *
 * const state: GatewayInstallState = "missing"
 * console.log(state)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type GatewayInstallState = typeof GatewayInstallState.Type;

// The one field read from Claude Desktop's config.json (an undocumented internal):
// `lastKnownAccountUuid` appears once an account has signed in. Unknown fields are
// ignored; only the key's presence matters and its value is never logged.
class ClaudeAccountConfig extends S.Opaque<ClaudeAccountConfig, { readonly brand: unique symbol }>()(
  S.Struct({
    lastKnownAccountUuid: S.optionalKey(S.String).annotateKey({
      description: "Account id Claude Desktop keeps once someone has signed in.",
    }),
  }).pipe(
    $I.annoteSchema("ClaudeAccountConfig", {
      description: "The sign-in marker read from Claude Desktop's config.json; other fields are ignored.",
    })
  )
) {}

// Claude Desktop's extension registry, extensions-installations.json (an undocumented
// internal), keyed by extension id. Entries stay unknown so one odd entry of another
// extension cannot hide the gateway's, which is decoded on its own.
class ExtensionInstallations extends S.Opaque<ExtensionInstallations, { readonly brand: unique symbol }>()(
  S.Struct({
    extensions: S.Record(S.String, S.Unknown).annotateKey({ description: "Installed extensions by extension id." }),
  }).pipe(
    $I.annoteSchema("ExtensionInstallations", {
      description: "Claude Desktop's registry of installed extensions; other fields are ignored.",
    })
  )
) {}

// One entry of the extension registry; only its version is read.
class InstalledExtension extends S.Opaque<InstalledExtension, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.String.annotateKey({ description: "Version of the installed extension." }),
  }).pipe(
    $I.annoteSchema("InstalledExtension", {
      description: "One installed Claude Desktop extension; other fields are ignored.",
    })
  )
) {}

/**
 * The id Claude Desktop records the practice gateway under, derived by
 * Claude from the manifest's author and name.
 *
 * **Example** (Read the id)
 *
 * ```ts
 * import { GATEWAY_EXTENSION_ID } from "@/Setup.models"
 *
 * console.log(GATEWAY_EXTENSION_ID.startsWith("local.mcpb.")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const GATEWAY_EXTENSION_ID = "local.mcpb.beep-effect-contributors.beep-practice-gateway";

const decodeAccountConfig = S.decodeUnknownOption(S.fromJsonString(ClaudeAccountConfig));
const decodeInstallations = S.decodeUnknownOption(S.fromJsonString(ExtensionInstallations));
const decodeInstalledExtension = S.decodeUnknownOption(InstalledExtension);

/**
 * Read the sign-in state from the text of Claude Desktop's `config.json`.
 *
 * **Details**
 *
 * Text that is not a JSON object of the expected shape is `unknown`, never
 * `signed-out`, so the bootstrapper falls back to asking the lawyer.
 *
 * **Example** (Read a config)
 *
 * ```ts
 * import { signInStateOf } from "@/Setup.models"
 *
 * console.log(signInStateOf('{"lastKnownAccountUuid":"a"}')) // "signed-in"
 * console.log(signInStateOf("{}")) // "signed-out"
 * console.log(signInStateOf("not json")) // "unknown"
 * ```
 *
 * @param text - Contents of `config.json`.
 * @category utilities
 * @since 0.0.0
 */
export const signInStateOf = (text: string): SignInState =>
  O.match(decodeAccountConfig(text), {
    onNone: () => SignInState.Enum.unknown,
    onSome: (config) =>
      pipe(O.fromUndefinedOr(config.lastKnownAccountUuid), O.exists(Str.isNonEmpty))
        ? SignInState.Enum["signed-in"]
        : SignInState.Enum["signed-out"],
  });

// State of the gateway's registry entry: unknown when undecodable, current when
// no version is expected or the versions match, outdated otherwise.
const installedEntryState =
  (expected: O.Option<string>) =>
  (entry: unknown): GatewayInstallState =>
    pipe(
      decodeInstalledExtension(entry),
      O.map(({ version }) =>
        pipe(
          expected,
          O.filter((wanted) => wanted !== version),
          O.isNone
        )
          ? GatewayInstallState.Enum.current
          : GatewayInstallState.Enum.outdated
      ),
      O.getOrElse(() => GatewayInstallState.Enum.unknown)
    );

/**
 * Read the gateway's install state from the text of Claude Desktop's
 * `extensions-installations.json`.
 *
 * **Details**
 *
 * With no `expected` version (a bootstrapper run without the version stamped
 * in), any listed version counts as `current`.
 *
 * **Example** (Read a registry)
 *
 * ```ts
 * import { GATEWAY_EXTENSION_ID, gatewayInstallStateOf } from "@/Setup.models"
 * import * as O from "effect/Option"
 *
 * const text = JSON.stringify({ extensions: { [GATEWAY_EXTENSION_ID]: { version: "0.1.0" } } })
 * console.log(gatewayInstallStateOf(text, O.some("0.1.0"))) // "current"
 * console.log(gatewayInstallStateOf(text, O.some("0.2.0"))) // "outdated"
 * console.log(gatewayInstallStateOf(O.none())(text)) // "current"
 * ```
 *
 * @param text - Contents of `extensions-installations.json`.
 * @param expected - Version of the bundle the bootstrapper carries, if known.
 * @category utilities
 * @since 0.0.0
 */
export const gatewayInstallStateOf: {
  (expected: O.Option<string>): (text: string) => GatewayInstallState;
  (text: string, expected: O.Option<string>): GatewayInstallState;
} = dual(
  2,
  (text: string, expected: O.Option<string>): GatewayInstallState =>
    pipe(
      decodeInstallations(text),
      O.map((registry) =>
        pipe(
          R.get(registry.extensions, GATEWAY_EXTENSION_ID),
          O.map(installedEntryState(expected)),
          O.getOrElse(() => GatewayInstallState.Enum.missing)
        )
      ),
      O.getOrElse(() => GatewayInstallState.Enum.unknown)
    )
);

/**
 * The one field the build reads from the gateway `.mcpb`'s `manifest.json`.
 *
 * **Example** (Decode a manifest)
 *
 * ```ts
 * import { GatewayBundleManifest } from "@/Setup.models"
 * import * as S from "effect/Schema"
 *
 * console.log(S.decodeUnknownSync(GatewayBundleManifest)({ name: "g", version: "0.1.0" }).version) // "0.1.0"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GatewayBundleManifest extends S.Opaque<GatewayBundleManifest, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.NonEmptyString.annotateKey({ description: "Version Claude Desktop records for the extension." }),
  }).pipe(
    $I.annoteSchema("GatewayBundleManifest", {
      description: "The version field of the gateway bundle's manifest; other fields are ignored.",
    })
  )
) {}

/**
 * The gateway `.mcpb` a packaged bootstrapper carries: its path in Bun's
 * embedded file system and the manifest version the build read from it.
 *
 * **Example** (Describe an embedded bundle)
 *
 * ```ts
 * import { EmbeddedGateway } from "@/Setup.models"
 *
 * const embedded = EmbeddedGateway.make({ bundle: "B:/~BUN/root/practice-gateway.mcpb", version: "0.1.0" })
 * console.log(embedded.version) // "0.1.0"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EmbeddedGateway extends S.Opaque<EmbeddedGateway, { readonly brand: unique symbol }>()(
  S.Struct({
    bundle: S.NonEmptyString.annotateKey({ description: "Path of the embedded gateway `.mcpb`." }),
    version: S.NonEmptyString.annotateKey({ description: "Manifest version of the embedded gateway." }),
  }).pipe(
    $I.annoteSchema("EmbeddedGateway", {
      description: "The gateway bundle a packaged bootstrapper carries, with its manifest version.",
    })
  )
) {}
