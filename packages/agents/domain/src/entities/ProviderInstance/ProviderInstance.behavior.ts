/**
 * Pure behavior for provider CLI instances: user-facing login guidance
 * derived from provider kind and the latest auth-probe snapshot.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { dual } from "effect/Function";
import { AuthSnapshot, ProviderKind } from "./ProviderInstance.values.ts";

/**
 * User-facing guidance for one provider kind and auth-probe outcome.
 *
 * **Details**
 *
 * Total and exhaustive: dispatches on the {@link AuthSnapshot} `status` tag via
 * the schema-derived match, then on {@link ProviderKind} via its LiteralKit
 * `$match`, so adding a snapshot variant or provider kind is a type error
 * until guidance exists for it. Unauthenticated instances are told the exact
 * login command; failed probes are pointed at the binary path.
 *
 * **Example** (Unauthenticated Claude login guidance)
 *
 * ```ts
 * import { loginGuidance, UnauthenticatedSnapshot } from "@beep/agents-domain/entities/ProviderInstance"
 * import * as S from "effect/Schema"
 *
 * const snapshot = S.decodeUnknownSync(UnauthenticatedSnapshot)({
 *   status: "unauthenticated",
 *   probedAt: "2026-07-11T00:00:00.000Z",
 * })
 * console.log(loginGuidance("claude", snapshot))
 * // Run `claude auth login` in your terminal, then probe again.
 * ```
 *
 * @param kind - Provider CLI kind the instance delegates to.
 * @param snapshot - Latest auth-probe snapshot for the instance.
 * @returns User-facing guidance string for the given kind and snapshot.
 * @category mapping
 * @since 0.0.0
 */
export const loginGuidance: {
  (kind: ProviderKind, snapshot: AuthSnapshot): string;
  (snapshot: AuthSnapshot): (kind: ProviderKind) => string;
} = dual(2, (kind: ProviderKind, snapshot: AuthSnapshot): string =>
  AuthSnapshot.match(snapshot, {
    authenticated: () =>
      ProviderKind.$match(kind, {
        claude: () => "The Claude CLI is authenticated; no action needed.",
        codex: () => "The Codex CLI is authenticated; no action needed.",
      }),
    unauthenticated: () =>
      ProviderKind.$match(kind, {
        claude: () => "Run `claude auth login` in your terminal, then probe again.",
        codex: () => "Run `codex login` in your terminal, then probe again.",
      }),
    "probe-failed": () =>
      ProviderKind.$match(kind, {
        claude: () =>
          "The Claude CLI probe failed before reporting auth status. Check that the instance binary path points at a runnable `claude` binary, then probe again.",
        codex: () =>
          "The Codex CLI probe failed before reporting auth status. Check that the instance binary path points at a runnable `codex` binary, then probe again.",
      }),
  })
);
