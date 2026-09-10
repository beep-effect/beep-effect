# Integrate the inherited package-local law tasks

The operator requested that PR #1068 incorporate main and reach a mergeable
state while remaining in draft. Main PR #1082 added package-local law scanning
and a root native-runtime check. The ordinary merge imports `8cb18e6029`;
`turbo.json` and root `package.json` remain byte-identical to that main commit.

The executable census grows from 1751 to 1892 computations. The reviewed
[delta](./laws-policy-baseline-delta.json) records 140 package `lint:laws` tasks
and `//#lint:native-runtime:roots`. Their inherited definitions bind the law
allowlists and source inputs and depend on the policy-fingerprint task.

Two existing root computations change only their command digest:
`//#lint:jsdoc:root` and `//#lint:policy-fingerprint`. The census hashes the
complete workspace script map, so adding the root native-runtime script changes
both digests. Their command text, configuration and dependency edges are
unchanged. No existing computation is removed, and global configuration is
unchanged.

Accept these inherited tasks and root script-map digests in the legacy
configuration baseline. This records main's existing cache configuration;
it grants no runtime qualification and changes no cache flags.

Retain the identity/types scope, `local-linux-x64-bun1.4.2` profile and
`qualification-v2` epoch. Both pilot computations keep `cache: false`, and the
qualification ledger remains byte-identical. The qualification campaign and
historical runtime matrices remain paused and unchanged.
