import { getDependencyReleaseLine, getReleaseLine } from "@beep/repo-cli/ChangesetChangelog";
import { expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Str from "effect/String";
import { vi } from "vitest";
import type githubChangelog from "@changesets/changelog-github";

// Both Changesets formatters are replaced, so no GitHub request runs: each case scripts what
// the GitHub formatter resolves or rejects with and checks when the plain formatter takes over.
const formatters = vi.hoisted(() => ({
  github: { getReleaseLine: vi.fn(), getDependencyReleaseLine: vi.fn() },
  fallback: { getReleaseLine: vi.fn(), getDependencyReleaseLine: vi.fn() },
}));
vi.mock("@changesets/changelog-github", () => ({ default: formatters.github }));
vi.mock("@changesets/cli/changelog", () => ({ default: formatters.fallback }));

type ReleaseLineArgs = Parameters<typeof githubChangelog.getReleaseLine>;
type DependencyReleaseLineArgs = Parameters<typeof githubChangelog.getDependencyReleaseLine>;

const changeset: ReleaseLineArgs[0] = {
  id: "quiet-cats",
  summary: "Fix the changelog fallback",
  releases: [{ name: "@beep/repo-cli", type: "patch" }],
};
const options: ReleaseLineArgs[2] = { repo: "beep-effect/beep-effect" };
const dependencies: DependencyReleaseLineArgs[1] = [];

const scripted = (outcomes: {
  readonly github: (...args: ReadonlyArray<unknown>) => Promise<string>;
  readonly fallback?: (...args: ReadonlyArray<unknown>) => Promise<string>;
}) =>
  Effect.sync(() => {
    for (const method of ["getReleaseLine", "getDependencyReleaseLine"] as const) {
      formatters.github[method].mockReset().mockImplementation(outcomes.github);
      formatters.fallback[method].mockReset().mockImplementation(outcomes.fallback ?? (() => Promise.resolve("plain")));
    }
    return vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

it.effect("renders the GitHub line in data-first and data-last form", () =>
  Effect.gen(function* () {
    yield* scripted({ github: () => Promise.resolve("- enriched") });
    const lines = yield* Effect.promise(() =>
      Promise.all([
        getReleaseLine(changeset, "patch", options),
        getReleaseLine("patch", options)(changeset),
        getDependencyReleaseLine([changeset], dependencies, options),
        getDependencyReleaseLine(dependencies, options)([changeset]),
      ])
    );
    expect(lines).toEqual(["- enriched", "- enriched", "- enriched", "- enriched"]);
    expect(formatters.github.getReleaseLine).toHaveBeenCalledWith(changeset, "patch", options);
    expect(formatters.github.getDependencyReleaseLine).toHaveBeenCalledWith([changeset], dependencies, options);
    expect(formatters.fallback.getReleaseLine).not.toHaveBeenCalled();
  })
);

it.effect("falls back to the plain line after a transient GitHub failure and warns once per line", () =>
  Effect.gen(function* () {
    const stderr = yield* scripted({ github: () => Promise.reject(new Error("Timeout on validation of query")) });
    const release = yield* Effect.promise(() => getReleaseLine(changeset, "patch", options));
    // A non-Error rejection is rendered with String(...) before matching.
    formatters.github.getDependencyReleaseLine.mockImplementation(() =>
      Promise.reject(
        "Please create a GitHub personal access token at https://github.com/settings/tokens/new with `read:user` and `repo:status` permissions and add it as the GITHUB_TOKEN environment variable"
      )
    );
    const dependency = yield* Effect.promise(() => getDependencyReleaseLine([changeset], dependencies, options));
    expect([release, dependency]).toEqual(["plain", "plain"]);
    expect(formatters.fallback.getReleaseLine).toHaveBeenCalledWith(changeset, "patch", options);
    expect(formatters.fallback.getDependencyReleaseLine).toHaveBeenCalledWith([changeset], dependencies, options);
    expect(A.map(stderr.mock.calls, ([line]) => A.headNonEmpty(Str.split(`${line}`, "\n")))).toEqual([
      "[changeset-changelog] GitHub changelog enrichment failed during release line generation; using plain changelog fallback.",
      "[changeset-changelog] GitHub changelog enrichment failed during dependency release line generation; using plain changelog fallback.",
    ]);
    stderr.mockRestore();
  })
);

it.effect("rejects with exactly the formatter's value for a non-transient failure", () =>
  Effect.gen(function* () {
    const failure = new Error("Could not find commit for changeset quiet-cats");
    const stderr = yield* scripted({ github: () => Promise.reject(failure) });
    const rejected = yield* Effect.promise(() =>
      getReleaseLine(changeset, "patch", options).then(
        () => "resolved",
        (reason: unknown) => reason
      )
    );
    expect(rejected).toBe(failure);
    // A transient failure whose fallback also rejects surfaces the fallback's value.
    const plainFailure = new Error("plain formatter failed");
    yield* scripted({
      github: () => Promise.reject(new Error("Failed to parse data from GitHub")),
      fallback: () => Promise.reject(plainFailure),
    });
    const fallbackRejected = yield* Effect.promise(() =>
      getDependencyReleaseLine([changeset], dependencies, options).then(
        () => "resolved",
        (reason: unknown) => reason
      )
    );
    expect(fallbackRejected).toBe(plainFailure);
    expect(formatters.fallback.getReleaseLine).not.toHaveBeenCalled();
    stderr.mockRestore();
  })
);
