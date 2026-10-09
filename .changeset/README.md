# Release policy

Internal workspaces with `private: true` do not require or accumulate changesets.
`beep quality changeset-status` reads that flag; `changeset-graph` rejects notes
naming live private workspaces. A versioned, publish-enabled product workspace
must have an in-branch changeset unless explicitly ignored by the config.
Root configuration and other unowned paths do not independently require notes;
release impact belongs to the affected publish-enabled workspace.

Publication is dormant. The config, Changesets dependencies, and
`scripts/changeset-changelog.cjs` remain for deliberate future activation.
Before activating a package, establish its release/versioning and compatibility
policy, audit external consumers, remove any inappropriate `ignore` exemption,
flip `private: false`, add an approved publication workflow, and restore the
appropriate changeset requirements. Re-add the hosted `changesets/action`
allowlist entry if the activated workflow uses it. `publishConfig` alone does
not activate publication. Private package versioning and tagging are explicitly
disabled by `privatePackages`.

The reset baseline lives in `standards/changesets.reset-baseline.json`. It records
the parent commit and original changeset tree, counts, and recovery commands.
Package versions and historical package changelogs are preserved.

Desktop releases use their separate `professional-desktop-v*` tags. Bump
`apps/professional-desktop/package.json` and `src-tauri/tauri.conf.json` manually
under that release policy; internal changesets do not version the desktop app.
