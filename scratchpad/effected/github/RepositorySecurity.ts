import { Context, Effect, Layer } from "effect";
import { GitHubClient } from "./GitHubClient.ts";
import type { GitHubError } from "./GitHubError.ts";
import { Repo } from "./Repo.ts";

/**
 * Read and toggle the three repository security features that have their own
 * endpoints: Dependabot alerts, Dependabot security fixes and private
 * vulnerability reporting.
 *
 * @public
 */
export interface RepositorySecurityShape {
  /** Whether Dependabot vulnerability alerts are on. */
  readonly vulnerabilityAlerts: Effect.Effect<boolean, GitHubError, Repo>;
  /** Turn Dependabot vulnerability alerts on or off. */
  readonly setVulnerabilityAlerts: (enabled: boolean) => Effect.Effect<void, GitHubError, Repo>;

  /** Whether Dependabot security pull requests are on. */
  readonly automatedSecurityFixes: Effect.Effect<boolean, GitHubError, Repo>;
  /** Turn Dependabot security pull requests on or off. */
  readonly setAutomatedSecurityFixes: (enabled: boolean) => Effect.Effect<void, GitHubError, Repo>;

  /** Whether the private vulnerability reporting inbox is on. */
  readonly privateVulnerabilityReporting: Effect.Effect<boolean, GitHubError, Repo>;
  /** Turn the private vulnerability reporting inbox on or off. */
  readonly setPrivateVulnerabilityReporting: (enabled: boolean) => Effect.Effect<void, GitHubError, Repo>;
}

/** What the automated-fixes and private-reporting reads answer with. */
interface EnabledFlag {
  readonly enabled?: boolean;
}

/**
 * Read and toggle Dependabot alerts, Dependabot security fixes and private
 * vulnerability reporting.
 *
 * @remarks
 * These are **not** `security_and_analysis` fields and cannot ride along on the
 * settings `PATCH`. Each is its own pair of endpoints where **the HTTP verb is
 * the value**, which is why every setter branches on `enabled` rather than
 * sending a body.
 *
 * ## Reading them is inconsistent, and the inconsistency is GitHub's
 *
 * Preserved faithfully rather than smoothed over, because smoothing it would
 * mean inventing a behaviour for one of the three:
 *
 * | Feature | Enabled | Disabled |
 * | :--- | :--- | :--- |
 * | `vulnerability-alerts` | `204` | **`404`** |
 * | `automated-security-fixes` | `200 { enabled: true }` | `200 { enabled: false }` |
 * | `private-vulnerability-reporting` | `200 { enabled: true }` | `200 { enabled: false }` |
 *
 * So `vulnerabilityAlerts` maps `notFound` to `false` — and **only** `notFound`;
 * every other failure still fails. A 404 from the other two is a real failure
 * and stays one, which is why the mapping is not applied uniformly.
 *
 * Provide it with {@link RepositorySecurity.layer}, which needs a
 * `GitHubClient`; each method also needs a `Repo` in `R`.
 *
 * @example
 * ```ts
 * import { RepositorySecurity } from "./index.ts";
 * import { Effect } from "effect";
 *
 * const harden = Effect.gen(function* () {
 *   const security = yield* RepositorySecurity;
 *   yield* security.setVulnerabilityAlerts(true);
 *   yield* security.setPrivateVulnerabilityReporting(true);
 *   return yield* security.vulnerabilityAlerts; // true
 * });
 * ```
 *
 * @public
 */
export class RepositorySecurity extends Context.Service<RepositorySecurity, RepositorySecurityShape>()(
  "@beep/scratchpad/effected/github/RepositorySecurity",
) {
  /**
   * The live service, built over a `GitHubClient`.
   *
   * @remarks
   * `(client) => make(client)` rather than `make`: a static initializer runs
   * while the module body is still evaluating, so naming a `const` declared
   * further down throws at import time with a clean typecheck.
   */
  static readonly layer: Layer.Layer<RepositorySecurity, never, GitHubClient> = Layer.effect(
    this,
    Effect.map(GitHubClient, (client) => make(client)),
  );

  /** An in-memory double; unstubbed members die naming themselves. */
  static readonly makeTest = (overrides: Partial<RepositorySecurityShape> = {}): RepositorySecurityShape => ({
    vulnerabilityAlerts: overrides.vulnerabilityAlerts ?? (Effect.suspend(() => unstubbed("vulnerabilityAlerts"))),
    setVulnerabilityAlerts: overrides.setVulnerabilityAlerts ?? (() => unstubbed("setVulnerabilityAlerts")),
    automatedSecurityFixes: overrides.automatedSecurityFixes ?? (Effect.suspend(() => unstubbed("automatedSecurityFixes"))),
    setAutomatedSecurityFixes: overrides.setAutomatedSecurityFixes ?? (() => unstubbed("setAutomatedSecurityFixes")),
    privateVulnerabilityReporting:
      overrides.privateVulnerabilityReporting ?? (Effect.suspend(() => unstubbed("privateVulnerabilityReporting"))),
    setPrivateVulnerabilityReporting:
      overrides.setPrivateVulnerabilityReporting ?? (() => unstubbed("setPrivateVulnerabilityReporting")),
  });

  /** {@link RepositorySecurity.makeTest} behind a `Layer`. */
  static readonly layerTest = (overrides: Partial<RepositorySecurityShape> = {}): Layer.Layer<RepositorySecurity> =>
    Layer.succeed(RepositorySecurity, RepositorySecurity.makeTest(overrides));
}

const unstubbed = (member: string): never => {
  throw new Error(`RepositorySecurity.makeTest: ${member}() was called but not stubbed — pass an override.`);
};

const make = (client: GitHubClient["Service"]): RepositorySecurityShape => {
  const vulnerabilityAlerts = Effect.suspend(Effect.fn("RepositorySecurity.vulnerabilityAlerts")(function* () {
    const { owner, repo } = yield* Repo;
    yield* Effect.annotateCurrentSpan({ owner, repo });

    return yield* client.request("GET /repos/{owner}/{repo}/vulnerability-alerts", {
      owner,
      repo,
    }).pipe(
      Effect.as(true),
      // Disabled is reported as 404 rather than as a payload. Only `notFound`
      // is absorbed; a 403 from a mis-scoped token still fails, which is the
      // distinction a blanket `orElseSucceed(false)` would destroy.
      Effect.catchIf(
        (error) => error.kind === "notFound",
        () => Effect.succeed(false),
      ),
    );
  }));

  const setVulnerabilityAlerts = Effect.fn("RepositorySecurity.setVulnerabilityAlerts")(function* (enabled: boolean) {
    const { owner, repo } = yield* Repo;
    yield* Effect.annotateCurrentSpan({ owner, repo, enabled });

    return yield* enabled ? client.request("PUT /repos/{owner}/{repo}/vulnerability-alerts", {
      owner,
      repo,
    }) : client.request("DELETE /repos/{owner}/{repo}/vulnerability-alerts", {
      owner,
      repo,
    });
  });

  const automatedSecurityFixes = Effect.suspend(Effect.fn("RepositorySecurity.automatedSecurityFixes")(function* () {
    const { owner, repo } = yield* Repo;
    yield* Effect.annotateCurrentSpan({ owner, repo });

    const data = yield* client.request("GET /repos/{owner}/{repo}/automated-security-fixes", {
      owner,
      repo,
    });
    return Boolean((data as EnabledFlag).enabled);
  }));

  const setAutomatedSecurityFixes = Effect.fn("RepositorySecurity.setAutomatedSecurityFixes")(function* (
    enabled: boolean,
  ) {
    const { owner, repo } = yield* Repo;
    yield* Effect.annotateCurrentSpan({ owner, repo, enabled });

    return yield* enabled ? client.request("PUT /repos/{owner}/{repo}/automated-security-fixes", {
      owner,
      repo,
    }) : client.request("DELETE /repos/{owner}/{repo}/automated-security-fixes", {
      owner,
      repo,
    });
  });

  const privateVulnerabilityReporting = Effect.suspend(Effect.fn("RepositorySecurity.privateVulnerabilityReporting")(function* () {
    const { owner, repo } = yield* Repo;
    yield* Effect.annotateCurrentSpan({ owner, repo });

    const data = yield* client.request("GET /repos/{owner}/{repo}/private-vulnerability-reporting", {
      owner,
      repo,
    });
    return Boolean((data as EnabledFlag).enabled);
  }));

  const setPrivateVulnerabilityReporting = Effect.fn("RepositorySecurity.setPrivateVulnerabilityReporting")(function* (
    enabled: boolean,
  ) {
    const { owner, repo } = yield* Repo;
    yield* Effect.annotateCurrentSpan({ owner, repo, enabled });

    return yield* enabled ? client.request("PUT /repos/{owner}/{repo}/private-vulnerability-reporting", {
      owner,
      repo,
    }) : client.request("DELETE /repos/{owner}/{repo}/private-vulnerability-reporting", {
      owner,
      repo,
    });
  });

  return {
    vulnerabilityAlerts,
    setVulnerabilityAlerts,
    automatedSecurityFixes,
    setAutomatedSecurityFixes,
    privateVulnerabilityReporting,
    setPrivateVulnerabilityReporting,
  };
};
