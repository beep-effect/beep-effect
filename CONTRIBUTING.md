# Contributing

This repository is a **public laboratory and publication**, not a community
support project. Issues are not a help desk. Unsolicited feature requests
and drive-by refactors are not accepted.

## If you still open a pull request

1. Read [`standards/architecture/13-onboarding-the-minimum-viable-slice.md`](standards/architecture/13-onboarding-the-minimum-viable-slice.md)
   and [`AGENTS.md`](AGENTS.md).
2. Work on a feature branch. `main` is PR-only.
3. Do not add empty workspace packages to reserve a name. Recreate a driver
   only in the same PR as its first real surface.
4. Use `bun run beep create-package` / `bun run beep architecture` instead of
   hand-authoring topology.
5. Publish through Yeet: `bun run beep yeet publish --message "type(scope): summary"`.
6. Keep commit and squash-merge bodies wrapped under 100 characters
   (commitlint applies to GitHub merge messages too).
7. Hosted required checks are the merge gate. Unresolved review threads are
   a hard stop.

Do not commit secrets, `.env` files, or `docs/_internal/`.
