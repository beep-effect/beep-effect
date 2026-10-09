import { $ScratchpadId } from "@beep/identity/packages";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as R from "effect/Record";

const $I = $ScratchpadId.create("effected/github/TokenPermissions");

/**
 * How much access a permission grants.
 *
 * @public
 */
export const PermissionLevel = S.Literals(["read", "write", "admin"]).pipe($I.annoteSchema("PermissionLevel", { description: "How much access a permission grants." }));

/** How much access a permission grants. @public */
export type PermissionLevel = (typeof PermissionLevel.literals)[number];

/** `read` < `write` < `admin`. */
const RANK: Record<PermissionLevel, number> = { read: 1, write: 2, admin: 3 };

/**
 * A permission the token does not have enough of.
 *
 * @public
 */
export class PermissionGap extends S.Class<PermissionGap>($I`PermissionGap`)({
  /** The permission's name, e.g. `"contents"`. */
  permission: S.String.annotateKey({ description: "The permission's name, e.g. `\"contents\"`." }),
  /** What was asked for. */
  required: PermissionLevel.annotateKey({ description: "What was asked for." }),
  /** What the token has, when it has any at all. */
  granted: S.optionalKey(PermissionLevel).annotateKey({ description: "What the token has, when it has any at all." }),
}, $I.annote("PermissionGap", { description: "A permission the token does not have enough of." })) {
}

/**
 * A permission the token has and did not need.
 *
 * @public
 */
export class ExtraPermission extends S.Class<ExtraPermission>($I`ExtraPermission`)({
  /** The permission's name, e.g. `"contents"`. */
  permission: S.String.annotateKey({ description: "The permission's name, e.g. `\"contents\"`." }),
  /** What the token has. */
  granted: PermissionLevel.annotateKey({ description: "What the token has." }),
  /** What was asked for, when anything was. */
  required: S.optionalKey(PermissionLevel).annotateKey({ description: "What was asked for, when anything was." }),
}, $I.annote("ExtraPermission", { description: "A permission the token has and did not need." })) {
}

/**
 * What comparing a token's permissions against a requirement found.
 *
 * @public
 */
export class PermissionResult extends S.Class<PermissionResult>($I`PermissionResult`)({
  /** Permissions that are missing or too weak. */
  missing: S.Array(PermissionGap).annotateKey({ description: "Permissions that are missing or too weak." }),
  /** Permissions granted beyond what was asked for. */
  extra: S.Array(ExtraPermission).annotateKey({ description: "Permissions granted beyond what was asked for." }),
}, $I.annote("PermissionResult", { description: "What comparing a token's permissions against a requirement found." })) {
  /** Nothing missing. */
  get satisfied(): boolean {
    return this.missing.length === 0;
  }

  /** Nothing missing and nothing spare. */
  get exact(): boolean {
    return this.satisfied && this.extra.length === 0;
  }
}

/**
 * A token asked for access it does not have, or has access it did not ask for.
 *
 * @public
 */
export class TokenPermissionError extends S.TaggedError<TokenPermissionError>($I`TokenPermissionError`)("TokenPermissionError", {
  /** Which assertion failed. */
  kind: S.Literals(["insufficient", "excess"]).annotateKey({ description: "Which assertion failed." }),
  /** The comparison that produced it. */
  result: PermissionResult.annotateKey({ description: "The comparison that produced it." }),
}, $I.annote("TokenPermissionError", { description: "A token asked for access it does not have, or has access it did not ask for." })) {
  override get message(): string {
    return this.kind === "insufficient"
      ? `token is missing ${this.result.missing.map((gap) => `${gap.permission}:${gap.required}`).join(", ")}`
      : `token has unrequested ${this.result.extra.map((extra) => `${extra.permission}:${extra.granted}`).join(", ")}`;
  }
}

/**
 * The permissions a token was granted, and what they satisfy.
 *
 * @remarks
 * **A pure class, not a service.** It compares permission levels
 * (`read < write < admin`), so there is no layer and no test double: a caller
 * holds the permissions GitHub already gave it (`InstallationToken.permissions`)
 * and compares them. The only `Effect`s are the two assertions, which fail with
 * `TokenPermissionError` because failing typed is more useful than returning a
 * boolean.
 *
 * @example
 * ```ts
 * import { TokenPermissions } from "./index.ts";
 * import * as Effect from "effect/Effect";
 *
 * declare const permissions: Record<string, string>;
 *
 * const check = Effect.gen(function* () {
 *   const granted = TokenPermissions.fromGitHub(permissions);
 *   yield* granted.assertSufficient({ contents: "write", pull_requests: "write" });
 * });
 * ```
 *
 * @public
 */
export class TokenPermissions extends S.Class<TokenPermissions>($I`TokenPermissions`)({
  /** Permission name to level. */
  granted: S.Record(S.String, PermissionLevel).annotateKey({ description: "Permission name to level." }),
}, $I.annote("TokenPermissions", { description: "The permissions a token was granted, and what they satisfy." })) {
  /**
   * Read GitHub's permission map, ignoring anything unrecognized.
   *
   * @remarks
   * GitHub adds permission levels over time; a token carrying one this package
   * does not know about is not a reason to fail a comparison about a different
   * permission entirely.
   */
  static fromGitHub(permissions: Readonly<Record<string, string>>): TokenPermissions {
    const granted: Record<string, PermissionLevel> = {};
    for (const [name, level] of R.toEntries(permissions)) {
      if (level === "read" || level === "write" || level === "admin") granted[name] = level;
    }
    return TokenPermissions.make({ granted });
  }

  /** Compare against a requirement. Pure and total. */
  compare(required: Readonly<Record<string, PermissionLevel>>): PermissionResult {
    const missing: Array<PermissionGap> = [];
    const extra: Array<ExtraPermission> = [];
    for (const [permission, want] of R.toEntries(required)) {
      const have = this.granted[permission];
      if (have === undefined) {
        missing.push(PermissionGap.make({ permission, required: want }));
      } else if (RANK[have] < RANK[want]) {
        missing.push(PermissionGap.make({
          permission,
          required: want,
          granted: have,
        }));
      }
    }
    for (const [permission, have] of R.toEntries(this.granted)) {
      const want = required[permission];
      if (want === undefined) {
        extra.push(ExtraPermission.make({ permission, granted: have }));
      } else if (RANK[have] > RANK[want]) {
        extra.push(ExtraPermission.make({
          permission,
          granted: have,
          required: want,
        }));
      }
    }
    return PermissionResult.make({ missing, extra });
  }

  /** Fail unless every required permission is held at least at the level asked for. */
  assertSufficient(required: Readonly<Record<string, PermissionLevel>>): Effect.Effect<void, TokenPermissionError> {
    const result = this.compare(required);
    return result.satisfied ? Effect.void : Effect.fail(TokenPermissionError.make({
      kind: "insufficient",
      result,
    }));
  }

  /**
   * Fail unless the token holds exactly what was asked for.
   *
   * @remarks
   * For the workflow that wants a least-privilege token and treats a broader
   * one as a misconfiguration worth stopping for.
   */
  assertExact(required: Readonly<Record<string, PermissionLevel>>): Effect.Effect<void, TokenPermissionError> {
    const result = this.compare(required);
    if (!result.satisfied) return Effect.fail(TokenPermissionError.make({
      kind: "insufficient",
      result,
    }));
    return result.extra.length === 0 ? Effect.void : Effect.fail(TokenPermissionError.make({
      kind: "excess",
      result,
    }));
  }
}
