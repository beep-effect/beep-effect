# PR 3a cache dependency review

Reviewer: GPT-6.1 Sol, medium, implementation lane (self-review, not an independent panel).

The documents domain and use-cases manifests add the pinned catalog dependency
@alchemy.run/domain. Use-cases adds workspace dev dependencies @beep/alchemy-postgres
and @beep/pglite for the dual-platform scenario tests. tsconfig-sync regenerates the
matching three reference lists, Fallow dependency boundaries and root package projection.

These changes alter dependency-edge fingerprints for the touched workspaces and
their dependents. No task script, cache flag, input/output glob, environment setting,
root Turbo configuration or qualification tuple was edited. No qualification is granted.

The attached request is prepared, not applied. The current checkout has inherited
global root configuration drift (the orchestrator assigned PR #2881). A baseline
re-record here would also need to review unrelated root subjects. Refresh the request's
previous digest and basis hash after integrating that fix; re-run cache-policy and
review the resulting local subjects before applying it. This lane does not approve
or re-stamp the unrelated global configuration drift.
