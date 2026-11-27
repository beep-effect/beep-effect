/**
 * Token permission levels and the comparison between what a token holds and
 * what a caller requires.
 *
 * **Details**
 *
 * GitHub reports an installation token's grants as a map of permission names
 * to `read`, `write` or `admin`. `TokenPermissions` compares that map against a
 * requirement and reports the gaps and the surplus, and its two assertions
 * fail with `TokenPermissionError`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $GithubId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";

const $I = $GithubId.create("TokenPermissions");

/**
 * **Example** (Validate a supported permission level)
 *
 * ```ts
 * import { PermissionLevel } from "@beep/github/TokenPermissions";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(PermissionLevel)("write")); // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const PermissionLevel = LiteralKit(["read", "write", "admin"]).pipe(
  $I.annoteSchema("PermissionLevel", { description: "How much access a permission grants." })
);

/**
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type PermissionLevel = typeof PermissionLevel.Type;

const isPermissionLevel = S.is(PermissionLevel);

const RANK: Record<PermissionLevel, number> = { read: 1, write: 2, admin: 3 };

/**
 * **Example** (Record a permission below the required level)
 *
 * ```ts
 * import { PermissionGap } from "@beep/github/TokenPermissions";
 *
 * const gap = PermissionGap.make({ permission: "contents", required: "write", granted: "read" });
 * console.log(gap.required); // write
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class PermissionGap extends S.Opaque<PermissionGap, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The permission's name, e.g. `"contents"`. */
    permission: S.String.pipe(
      $I.annoteKey("PermissionGap.permission", { description: 'The permission\'s name, e.g. `"contents"`.' })
    ),
    /** What was asked for. */
    required: PermissionLevel.pipe($I.annoteKey("PermissionGap.required", { description: "What was asked for." })),
    /** What the token has, when it has any at all. */
    granted: S.optionalKey(PermissionLevel).pipe(
      $I.annoteKey("PermissionGap.granted", { description: "What the token has, when it has any at all." })
    ),
  }).pipe($I.annoteSchema("PermissionGap", { description: "A permission the token does not have enough of." }))
) {}

/**
 * **Example** (Record an unrequested permission)
 *
 * ```ts
 * import { ExtraPermission } from "@beep/github/TokenPermissions";
 *
 * const extra = ExtraPermission.make({ permission: "issues", granted: "write" });
 * console.log(extra.granted); // write
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class ExtraPermission extends S.Opaque<ExtraPermission, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The permission's name, e.g. `"contents"`. */
    permission: S.String.pipe(
      $I.annoteKey("ExtraPermission.permission", { description: 'The permission\'s name, e.g. `"contents"`.' })
    ),
    /** What the token has. */
    granted: PermissionLevel.pipe($I.annoteKey("ExtraPermission.granted", { description: "What the token has." })),
    /** What was asked for, when anything was. */
    required: S.optionalKey(PermissionLevel).pipe(
      $I.annoteKey("ExtraPermission.required", { description: "What was asked for, when anything was." })
    ),
  }).pipe($I.annoteSchema("ExtraPermission", { description: "A permission the token has and did not need." }))
) {}

/**
 * **Example** (Inspect an exact permission match)
 *
 * ```ts
 * import { PermissionResult } from "@beep/github/TokenPermissions";
 *
 * const result = PermissionResult.make({ missing: [], extra: [] });
 * console.log(result.exact); // true
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class PermissionResult extends S.Class<PermissionResult, { readonly brand: unique symbol }>(
  $I`PermissionResult`
)(
  {
    /** Permissions that are missing or too weak. */
    missing: S.Array(PermissionGap).pipe(
      $I.annoteKey("PermissionResult.missing", { description: "Permissions that are missing or too weak." })
    ),
    /** Permissions granted beyond what was asked for. */
    extra: S.Array(ExtraPermission).pipe(
      $I.annoteKey("PermissionResult.extra", { description: "Permissions granted beyond what was asked for." })
    ),
  },
  $I.annote("PermissionResult", { description: "What comparing a token's permissions against a requirement found." })
) {
  /**
   * Nothing missing.
   *
   * **Example** (Check that no permissions are missing)
   *
   * ```ts
   * import { PermissionResult } from "@beep/github/TokenPermissions";
   *
   * console.log(PermissionResult.make({ missing: [], extra: [] }).satisfied); // true
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  get satisfied(): boolean {
    return this.missing.length === 0;
  }

  /**
   * Nothing missing and nothing spare.
   *
   * **Example** (Detect surplus permissions)
   *
   * ```ts
   * import { ExtraPermission, PermissionResult } from "@beep/github/TokenPermissions";
   *
   * const result = PermissionResult.make({
   *   missing: [],
   *   extra: [ExtraPermission.make({ permission: "issues", granted: "read" })],
   * });
   * console.log(result.exact); // false
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  get exact(): boolean {
    return this.satisfied && this.extra.length === 0;
  }
}

/**
 * **Example** (Describe a missing permission)
 *
 * ```ts
 * import { PermissionGap, PermissionResult, TokenPermissionError } from "@beep/github/TokenPermissions";
 *
 * const result = PermissionResult.make({
 *   missing: [PermissionGap.make({ permission: "contents", required: "write" })],
 *   extra: [],
 * });
 * const error = TokenPermissionError.make({ kind: "insufficient", result });
 * console.log(error.message); // token is missing contents:write
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class TokenPermissionError extends S.TaggedError<TokenPermissionError, { readonly brand: unique symbol }>(
  $I`TokenPermissionError`
)(
  "TokenPermissionError",
  {
    /** Which assertion failed. */
    kind: S.Literals(["insufficient", "excess"]).pipe(
      $I.annoteKey("TokenPermissionError.kind", { description: "Which assertion failed." })
    ),
    /** The comparison that produced it. */
    result: PermissionResult.pipe(
      $I.annoteKey("TokenPermissionError.result", { description: "The comparison that produced it." })
    ),
  },
  $I.annoteError<TokenPermissionError>("TokenPermissionError", {
    description: "A token asked for access it does not have, or has access it did not ask for.",
  })
) {
  /**
   * Describes the missing or unrequested permissions that caused the assertion to fail.
   *
   * **Example** (Describe surplus access)
   *
   * ```ts
   * import { ExtraPermission, PermissionResult, TokenPermissionError } from "@beep/github/TokenPermissions";
   *
   * const result = PermissionResult.make({
   *   missing: [],
   *   extra: [ExtraPermission.make({ permission: "issues", granted: "write" })],
   * });
   * console.log(TokenPermissionError.make({ kind: "excess", result }).message); // token has unrequested issues:write
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  override get message(): string {
    return this.kind === "insufficient"
      ? `token is missing ${pipe(
          this.result.missing,
          A.map((gap) => `${gap.permission}:${gap.required}`),
          A.join(", ")
        )}`
      : `token has unrequested ${pipe(
          this.result.extra,
          A.map((extra) => `${extra.permission}:${extra.granted}`),
          A.join(", ")
        )}`;
  }
}

/**
 * **Details**
 *
 * **A pure class, not a service.** It compares permission levels
 * (`read < write < admin`), so there is no layer and no test double: a caller
 * holds the permissions GitHub already gave it (`InstallationToken.permissions`)
 * and compares them. The only `Effect`s are the two assertions, which fail with
 * `TokenPermissionError` because failing typed is more useful than returning a
 * boolean.
 *
 * **Example** (Assert write permissions for contents and pull requests)
 *
 * ```ts
 * import { TokenPermissions } from "@beep/github/TokenPermissions";
 * import * as Effect from "effect/Effect";
 *
 * const permissions = { contents: "write", pull_requests: "write" };
 *
 * const check = Effect.gen(function* () {
 *   const granted = TokenPermissions.fromGitHub(permissions);
 *   yield* granted.assertSufficient({ contents: "write", pull_requests: "write" });
 *   return "permissions sufficient";
 * });
 *
 * console.log(Effect.runSync(check)); // permissions sufficient
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class TokenPermissions extends S.Class<TokenPermissions, { readonly brand: unique symbol }>(
  $I`TokenPermissions`
)(
  {
    /** Permission name to level. */
    granted: S.Record(S.String, PermissionLevel).pipe(
      $I.annoteKey("TokenPermissions.granted", { description: "Permission name to level." })
    ),
  },
  $I.annote("TokenPermissions", { description: "The permissions a token was granted, and what they satisfy." })
) {
  /**
   * Read GitHub's permission map, ignoring anything unrecognized.
   *
   * **Details**
   *
   * GitHub adds permission levels over time; a token carrying one this package
   * does not know about is not a reason to fail a comparison about a different
   * permission entirely.
   *
   * **Example** (Ignore an unknown permission level)
   *
   * ```ts
   * import { TokenPermissions } from "@beep/github/TokenPermissions";
   * import * as R from "effect/Record";
   *
   * const token = TokenPermissions.fromGitHub({ contents: "write", future: "custom" });
   * console.log(R.has(token.granted, "future")); // false
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static fromGitHub(permissions: Readonly<Record<string, string>>): TokenPermissions {
    const granted = R.fromEntries(
      A.flatMap(R.toEntries(permissions), ([name, level]) => (isPermissionLevel(level) ? [[name, level] as const] : []))
    );
    return TokenPermissions.make({ granted });
  }

  /**
   * Compare against a requirement. Pure and total.
   *
   * **Example** (Compare read access against a write requirement)
   *
   * ```ts
   * import { TokenPermissions } from "@beep/github/TokenPermissions";
   *
   * const token = TokenPermissions.fromGitHub({ contents: "read" });
   * console.log(token.compare({ contents: "write" }).missing.length); // 1
   * ```
   *
   * @category utilities
   * @since 0.0.0
   */
  compare(required: Readonly<Record<string, PermissionLevel>>): PermissionResult {
    const missing: Array<PermissionGap> = [];
    const extra: Array<ExtraPermission> = [];
    for (const [permission, want] of R.toEntries(required)) {
      const have = R.get(this.granted, permission);
      if (O.isNone(have)) {
        missing.push(PermissionGap.make({ permission, required: want }));
      } else if (RANK[have.value] < RANK[want]) {
        missing.push(
          PermissionGap.make({
            permission,
            required: want,
            granted: have.value,
          })
        );
      }
    }
    for (const [permission, have] of R.toEntries(this.granted)) {
      const want = R.get(required, permission);
      if (O.isNone(want)) {
        extra.push(ExtraPermission.make({ permission, granted: have }));
      } else if (RANK[have] > RANK[want.value]) {
        extra.push(
          ExtraPermission.make({
            permission,
            granted: have,
            required: want.value,
          })
        );
      }
    }
    return PermissionResult.make({ missing, extra });
  }

  /**
   * Fail unless every required permission is held at least at the level asked for.
   *
   * **Example** (Accept permissions above the required level)
   *
   * ```ts
   * import { TokenPermissions } from "@beep/github/TokenPermissions";
   * import * as Effect from "effect/Effect";
   *
   * const token = TokenPermissions.fromGitHub({ contents: "admin" });
   * const check = token.assertSufficient({ contents: "write" }).pipe(Effect.map(() => "sufficient"));
   * console.log(Effect.runSync(check)); // sufficient
   * ```
   *
   * @category assertions
   * @since 0.0.0
   */
  assertSufficient(required: Readonly<Record<string, PermissionLevel>>): Effect.Effect<void, TokenPermissionError> {
    const result = this.compare(required);
    return result.satisfied
      ? Effect.void
      : Effect.fail(
          TokenPermissionError.make({
            kind: "insufficient",
            result,
          })
        );
  }

  /**
   * Fail unless the token holds exactly what was asked for.
   *
   * **Details**
   *
   * For the workflow that wants a least-privilege token and treats a broader
   * one as a misconfiguration worth stopping for.
   *
   * **Example** (Accept a least-privilege permission match)
   *
   * ```ts
   * import { TokenPermissions } from "@beep/github/TokenPermissions";
   * import * as Effect from "effect/Effect";
   *
   * const token = TokenPermissions.fromGitHub({ contents: "write" });
   * const check = token.assertExact({ contents: "write" }).pipe(Effect.map(() => "exact"));
   * console.log(Effect.runSync(check)); // exact
   * ```
   *
   * @category assertions
   * @since 0.0.0
   */
  assertExact(required: Readonly<Record<string, PermissionLevel>>): Effect.Effect<void, TokenPermissionError> {
    const result = this.compare(required);
    if (!result.satisfied)
      return Effect.fail(
        TokenPermissionError.make({
          kind: "insufficient",
          result,
        })
      );
    return result.extra.length === 0
      ? Effect.void
      : Effect.fail(
          TokenPermissionError.make({
            kind: "excess",
            result,
          })
        );
  }
}
