# Release policy

Internal workspaces with `private: true` do not require or accumulate changesets.
`beep quality changeset-status` reads that flag; `changeset-graph` rejects notes
naming live private workspaces. A changed, versioned, publish-enabled product workspace
must have an in-branch changeset unless explicitly ignored by the config.
Root configuration and other unowned paths do not independently require notes;
release impact belongs to the affected publish-enabled workspace.

Publication is dormant. The config, Changesets dependencies, and
`scripts/changeset-changelog.cjs` remain for deliberate future activation.
Before activating a package, establish its release/versioning and compatibility
policy, audit external consumers, remove any inappropriate `ignore` exemption,
flip `private: false`, reconcile public access/provenance, add an approved publication workflow,
and restore the
appropriate changeset requirements. If E-19 has removed the hosted `changesets/action` allowlist entry, restore it
when the activated workflow uses that action. `publishConfig` alone does
not activate publication. Private package versioning and tagging are explicitly
disabled by `privatePackages`.

The reset baseline lives in `standards/changesets.reset-baseline.json`. It records
the parent commit and original changeset tree, counts, and recovery commands.
Package versions and historical package changelogs are preserved.

Desktop releases use their separate `professional-desktop-v*` tags. Bump
`apps/professional-desktop/package.json` and `src-tauri/tauri.conf.json` manually
under that release policy; internal changesets do not version the desktop app.

The full-directory recovery command also restores the historical config and
README. Use it with a revert of this reset policy PR, including the private-note
graph guard; restoring notes alone under the current guard intentionally fails.
For historical inspection without changing the checkout, use the baseline's
`git ls-tree` and `git show` commands.
