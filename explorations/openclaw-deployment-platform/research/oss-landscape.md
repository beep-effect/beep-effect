# OSS landscape: Effect-native OpenClaw deployment

## 1. Existing TypeScript-native OpenClaw infrastructure as code — 2026-07-24

### Closest existing implementation

The closest public match is
[`pandysp/openclaw-infra`](https://github.com/pandysp/openclaw-infra): it is a
reference deployment for an OpenClaw gateway on Hetzner, provisions with
Pulumi, retains Ansible for host configuration, and runs the gateway as a
`systemd --user` service behind Tailscale
([repository architecture and prerequisites](https://github.com/pandysp/openclaw-infra#architecture)).
Its repository reports 316 commits but no published releases, so it is useful
as source reference rather than as a versioned reusable component
([repository history and releases](https://github.com/pandysp/openclaw-infra)).
The repository itself identifies its license as MIT
([license section](https://github.com/pandysp/openclaw-infra#license)).

This is not yet the target architecture: its Pulumi layer provisions the cloud
host and then invokes Ansible, while the proposed platform needs Pulumi
resources/components to own workstation files, configuration, and service
state directly
([the project explicitly requires Ansible](https://github.com/pandysp/openclaw-infra#prerequisites)).
Nevertheless, its Pulumi-to-host handoff, ordering, verification scripts, and
user-service details make it the highest-value OpenClaw-specific implementation
reference
([repository feature list](https://github.com/pandysp/openclaw-infra#features)).

### Official and first-party deployment surfaces

OpenClaw's recommended interactive path is the hosted installer, which detects
the OS, installs Node and OpenClaw, and starts onboarding; the alternative
`install-cli.sh` path installs Node and OpenClaw beneath a local prefix without
requiring a system-wide Node installation
([official install overview](https://docs.openclaw.ai/install)).
The installer reference says the default method is a global npm install, while
the git method clones, installs dependencies, builds, and creates a wrapper;
the local-prefix installer can also emit NDJSON automation events
([installer internals](https://docs.openclaw.ai/install/installer)).

On Linux, `openclaw gateway install` renders a systemd user unit, and the
official Linux page publishes a minimal unit using `Restart=always`,
`KillMode=control-group`, and `WantedBy=default.target`
([Linux gateway service guidance](https://docs.openclaw.ai/platforms/linux)).
The uninstall contract explicitly disables and removes
`~/.config/systemd/user/openclaw-gateway.service`, which is useful evidence for
the file and lifecycle surface a Pulumi component must own
([official uninstall steps](https://docs.openclaw.ai/install/uninstall)).

The main repository also ships several declarative or semi-declarative hosting
paths:

- Docker is described as optional and intended for isolated or headless
  deployments; the supported setup starts from `scripts/docker/setup.sh`
  ([official Docker guide](https://docs.openclaw.ai/install/docker)).
- Fly.io is driven by a checked-in `fly.toml`, a Docker build, a persistent
  `/data` volume, and `fly deploy`; updates rebuild the image rather than
  mutating a running npm install
  ([official Fly guide](https://docs.openclaw.ai/install/fly)).
- Render uses the repository's `render.yaml` Blueprint to declare the service,
  persistent disk, health check, and environment variables
  ([official Render guide](https://docs.openclaw.ai/install/render)).
- The Kubernetes path uses Kustomize rather than Helm and is explicitly called
  a minimal starting point rather than production-ready; it creates a
  Deployment, Service, PVC, ConfigMap, and Secret
  ([official Kubernetes guide](https://docs.openclaw.ai/install/kubernetes)).

The first-party Nix distribution,
[`openclaw/nix-openclaw`](https://github.com/openclaw/nix-openclaw), is the
strongest existing declaration of host-level OpenClaw state: it provides a
Home Manager module, manages launchd on macOS and a systemd user service on
Linux, and emits schema-typed configuration from
`programs.openclaw.config`/`instances.<name>.config`
([repository README](https://github.com/openclaw/nix-openclaw/blob/main/README.md)).
Its repository license is AGPL-3.0, so it should be studied as clean-room
behavioral prior art unless the target project's licensing analysis approves
reuse
([repository LICENSE](https://github.com/openclaw/nix-openclaw/blob/main/LICENSE)).

The upstream OpenClaw repository is MIT licensed
([repository LICENSE](https://github.com/openclaw/openclaw/blob/main/LICENSE)).
This sweep did not locate a reusable OpenClaw Terraform module, CDK construct,
or standalone Pulumi component/provider beyond the application-specific
`pandysp/openclaw-infra` repository; that negative is a search result, not proof
that none exists.

### Design implication

The greenfield component should treat upstream's local-prefix installer,
systemd user-unit contract, and Nix immutable-config mode as three separate
behavioral inputs rather than invoking the interactive installer wholesale
([installer automation options](https://docs.openclaw.ai/install/installer),
[Linux unit contract](https://docs.openclaw.ai/platforms/linux),
[immutable Nix behavior](https://docs.openclaw.ai/cli/config)).
OpenClaw already supports runtime `SecretRef` resolution through an `op read`
exec provider, so `op://` references can remain public configuration data while
the secret values stay outside `openclaw.json`
([official 1Password integration](https://docs.openclaw.ai/gateway/1password)).

## 2. Pulumi components and providers for host files and systemd — 2026-07-24

### The practical primitive: `@pulumi/command`

The official Command provider executes local or remote commands as stateful
Pulumi resources, supports create/update/delete scripts, and can copy files to
remote hosts
([provider repository](https://github.com/pulumi/pulumi-command)).
`local.Command` runs only when the resource is created or its inputs change,
supports explicit `triggers`, and can suppress logging when outputs may contain
secrets
([local command API](https://www.pulumi.com/registry/packages/command/api-docs/local/command/)).
That makes it a reasonable implementation substrate for a local workstation
component that atomically writes a rendered file, validates it, reloads the
user manager, and enables/restarts the service.

For a later remote-host phase, `remote.CopyToRemote` plus `remote.Command`
supports an explicit dependency edge; connection changes replace both
resources and rerun their operations on the replacement host
([Command provider remote-copy example](https://www.pulumi.com/registry/packages/command/)).
The older `remote.CopyFile` resource is deprecated in favor of
`CopyToRemote`
([CopyFile API notice](https://www.pulumi.com/registry/packages/command/api-docs/remote/copyfile/)).
The Command provider is Apache-2.0 according to its own repository
([repository license metadata](https://github.com/pulumi/pulumi-command)).

### Component shape

Pulumi component resources are the appropriate packaging boundary for a
`UserService` or `OpenClawAgent` abstraction composed from ordinary child
resources
([official component guide](https://www.pulumi.com/docs/iac/using-pulumi/extending-pulumi/build-a-component/)).
A first implementation can therefore wrap:

1. an atomic config-file write command keyed by a content hash;
2. an atomic unit-file write command keyed by a content hash;
3. `systemctl --user daemon-reload`;
4. `systemctl --user enable --now` or reload/restart according to the diff; and
5. read-only validation/health commands.

That ordering is an implementation recommendation inferred from the Command
provider's create/update/delete and dependency semantics
([provider semantics](https://github.com/pulumi/pulumi-command))
and OpenClaw's documented user-unit lifecycle
([Linux service guidance](https://docs.openclaw.ai/platforms/linux)).
Always-on behavior needs an explicit linger decision: upstream systemd's
`loginctl enable-linger` starts a user's manager at boot and keeps it after
logout
([systemd `loginctl` manual](https://www.freedesktop.org/software/systemd/man/252/loginctl.html)).

### Dynamic-provider option and its limits

A TypeScript dynamic provider could model file/service state with
`check`, `diff`, `create`, `update`, and `delete`, providing a cleaner typed
resource surface than shell commands
([dynamic-provider lifecycle](https://www.pulumi.com/docs/iac/concepts/providers/dynamic-providers/)).
However, Pulumi documents several material constraints: dynamic providers are
TypeScript/Python only, `read` is not currently functional, provider functions
are serialized into another process, TypeScript dynamic providers do not
support pnpm, and the Bun runtime is unsupported
([dynamic-provider limitations](https://www.pulumi.com/docs/iac/concepts/providers/dynamic-providers/#limitations)).
Those constraints make a dynamic provider a poor first slice for this Bun
monorepo; a Command-backed component is lower risk, while a native provider is
the later option if refresh/import fidelity becomes essential
([Pulumi's provider-building guide uses a managed file resource to illustrate
full Create/Read/Update/Delete/Check/Diff](https://www.pulumi.com/docs/iac/guides/building-extending/providers/build-a-provider/)).

### What was not found

This sweep did not find a maintained, dedicated Pulumi package for systemd or
`systemd --user`. A Terraform `system` provider does expose separate file and
systemd-service resources, but its documented systemd resource requires the
unit to exist and does not create or delete it
([Terraform provider resource documentation](https://registry.terraform.io/providers/robbert229/system/latest/docs/resources/service_systemd)).
It is useful as API-shape prior art, not a direct solution for user-manager
semantics.

## 3. Pulumi Automation API and Effect prior art — 2026-07-24

### Direct prior art

No public project found in this sweep demonstrably composes Pulumi Automation
API with Effect TS, fp-ts, or ZIO-style typed effects. The official
[`pulumi/automation-api-examples`](https://github.com/pulumi/automation-api-examples)
repository covers TypeScript inline programs, local programs, cross-language
programs, Pulumi-over-HTTP, migrations, tests, and remote deployments, but its
catalog does not include Effect
([Node.js examples index](https://github.com/pulumi/automation-api-examples#nodejs-examples)).

Pulumi Automation API is nevertheless a good boundary for Effect integration:
it exposes stack creation, preview, update, refresh, destroy, configuration,
and workspace operations as a strongly typed SDK, while still requiring the
Pulumi CLI at runtime
([official Automation API overview](https://www.pulumi.com/docs/iac/concepts/automation-api/)).
An Effect adapter can therefore wrap Automation API promises with typed errors,
logging, retries, interruption, and service layers without changing Pulumi's
resource model. This is an architectural inference from Automation API's
programmatic lifecycle
([Automation API use cases and workspaces](https://www.pulumi.com/docs/iac/concepts/automation-api/)),
not an established community pattern found by the sweep.

### Typed configuration boundary

Pulumi's `Config.requireObject<T>` only JSON-parses and trusts the TypeScript
type parameter; the API explicitly says it does not validate the object's
shape
([Node.js Config API](https://www.pulumi.com/docs/reference/pkg/nodejs/pulumi/pulumi/classes/Config.html)).
That leaves a concrete role for Effect Schema: read a plain structured object,
decode it before any resources are constructed, and expose only the decoded
domain value to the Pulumi program. Secrets require a separate boundary because
`requireSecretObject<T>` returns a secret `Output<T>`, not a synchronous plain
object
([secret-object API](https://www.pulumi.com/docs/reference/pkg/nodejs/pulumi/pulumi/classes/Config.html#requireSecretObject)).

For this design, the simplest split is:

- decode non-secret desired state with Effect Schema before constructing the
  component;
- keep `op://` references as validated strings in that desired state; and
- let OpenClaw resolve those references at runtime rather than placing secret
  values in Pulumi config or state.

The split is supported by Pulumi's statement that program config is read-only
during program execution
([configuration lifecycle](https://www.pulumi.com/docs/iac/concepts/config/))
and OpenClaw's documented `op://vault/item/field` exec-provider contract
([OpenClaw 1Password guide](https://docs.openclaw.ai/gateway/1password)).

### Strongest Effect-native IaC analogue

[`alchemy-run/alchemy`](https://github.com/alchemy-run/alchemy) is the most
relevant Effect-native IaC experiment found, although it is an alternative IaC
engine rather than a Pulumi layer. Its current documentation describes
“Infrastructure as Effects,” with stacks expressed as `Effect.gen` programs,
typed `Output` values, Effect/Layers for provider requirements, and
plan/deploy/destroy lifecycle
([Alchemy overview](https://alchemy.run/what-is-alchemy/),
[typed output model](https://v2.alchemy.run/infrastructure-as-code/outputs/)).
Its deploy-time Actions are dependency-aware Effect nodes keyed by input hashes,
but they deliberately have no read, delete, or provider lifecycle
([Actions documentation](https://alchemy.run/infrastructure-as-code/action/)).
That distinction is directly relevant: Effect is excellent for orchestration,
but durable file and service ownership still needs Pulumi resources with
explicit lifecycle semantics.

Alchemy is in beta and warns of breaking changes
([project site](https://alchemy.run/)); its repository license is Apache-2.0
([repository LICENSE](https://github.com/alchemy-run/alchemy/blob/main/LICENSE)).
Its code is the best style reference for mapping Effect errors, Layers,
resource dependencies, and deferred outputs into an IaC engine.

## 4. Comparable declarative agent deployment and migration lessons — 2026-07-24

### Declarative agent stacks

`openclaw/nix-openclaw` is the closest comparison because it owns the same
application and the same Linux user-service scope: Home Manager declares the
package, schema-typed config, plugins, and systemd user service
([repository README](https://github.com/openclaw/nix-openclaw/blob/main/README.md)).
OpenClaw's `OPENCLAW_NIX_MODE=1` then treats `openclaw.json` as immutable and
rejects config writers, directing operators back to the Nix source
([official config CLI behavior](https://docs.openclaw.ai/cli/config)).
This is strong evidence that an explicitly declared “externally managed”
mode is safer than allowing both Pulumi and OpenClaw to write the same file.

[`schemalabz/nix-openclaw`](https://github.com/schemalabz/nix-openclaw) is a
separate NixOS deployment with an OpenClaw Discord gateway as a systemd
service, read-only Nix-managed workspace links, and a distinct mutable state
directory
([repository overview](https://github.com/schemalabz/nix-openclaw)).
Its config layout explicitly distinguishes generated config/workspace content
from sessions, cron data, and agent state
([repository file layout](https://github.com/schemalabz/nix-openclaw)).

Other useful comparisons are container fleet managers rather than host-service
managers. `clawfleet/ClawFleet` runs OpenClaw and Hermes instances in isolated
containers, pins runtime versions, and manages them through a browser
dashboard
([repository overview](https://github.com/clawfleet/ClawFleet)); its repository
license is MIT
([repository LICENSE](https://github.com/clawfleet/ClawFleet/blob/main/LICENSE)).
Docker's `compose-for-agents` is a collection of Docker Compose examples for
open-source models, tools, and agent runtimes
([repository README](https://github.com/docker/compose-for-agents)).
These projects are valuable for multi-instance identity, state-volume,
version-pinning, and health-check ideas, but not for direct host file ownership.

### Ansible-to-Pulumi evidence

Public material found by this sweep mostly advocates coexistence rather than a
task-for-resource rewrite. Pulumi's WordPress example provisions with Pulumi
and invokes Ansible through Command resources, explicitly treating
configuration management and infrastructure provisioning as complementary
([Pulumi/Ansible article](https://www.pulumi.com/blog/deploy-wordpress-aws-pulumi-ansible/)).
The `pandysp/openclaw-infra` reference follows that same split for OpenClaw
([repository prerequisites and architecture](https://github.com/pandysp/openclaw-infra)).

The closest migration case study, Nexxiot, says Ansible remained well suited
to SSH/package-manager operations but conflicted with its desired immutable
cloud model, leading the team toward replaceable infrastructure
([Nexxiot case study](https://www.pulumi.com/case-studies/nexxiot/)).
That lesson should not be over-applied to a persistent workstation: migrate
only operations with a stable desired-state identity into Pulumi resources,
and keep one-shot bootstrap or discovery work as explicit commands until a
reliable read/diff/delete contract exists. This recommendation is inferred
from the case study and Pulumi's distinction between Command resources and
full provider resources
([Command provider trade-offs](https://github.com/pulumi/pulumi-command),
[provider lifecycle guide](https://www.pulumi.com/docs/iac/guides/building-extending/providers/build-a-provider/)).

### Self-mutating configuration

OpenClaw normally provides `config set`, `config patch`, and `config unset`;
writes validate the complete post-change configuration, serialize JSON5 back
as JSON, and may trigger hot reload or a restart
([config CLI reference](https://docs.openclaw.ai/cli/config)).
It also supports single-file includes, allowing an OpenClaw-owned write to
update an included section without rewriting the root file
([configuration guide](https://docs.openclaw.ai/configuration)).

The migration therefore needs an explicit ownership model:

- **Strict declarative mode:** Pulumi owns the complete config and enables
  `OPENCLAW_NIX_MODE=1`-equivalent immutable behavior if upstream exposes a
  distribution-neutral switch.
- **Split ownership:** Pulumi owns a root file plus selected included files,
  while runtime-mutated sections live in separate OpenClaw-owned includes.
- **Seed-only mode:** Pulumi writes initial config only when absent and then
  relinquishes it; this is easiest but cannot promise ongoing drift repair.

These are proposed policies, not existing Pulumi features. The need for them is
grounded in OpenClaw's documented immutable Nix mode and include-aware writer
behavior
([immutable writer refusal](https://docs.openclaw.ai/cli/config),
[include ownership](https://docs.openclaw.ai/configuration)).
For the first greenfield slice, strict declarative ownership is the least
ambiguous; split ownership is the likely migration bridge for an existing
runtime-mutated installation.

## 5. Clone candidates — 2026-07-24

| Repo URL | License (verified/UNVERIFIED) | Why valuable | Suggested local name (under `~/YeeBois/dev/`) |
| --- | --- | --- | --- |
| [`https://github.com/pandysp/openclaw-infra`](https://github.com/pandysp/openclaw-infra) | MIT — verified in the [repository](https://github.com/pandysp/openclaw-infra#license) | Closest TypeScript Pulumi + Ansible + OpenClaw + `systemd --user` implementation; best source for deployment ordering and host verification. | `openclaw-infra-pandysp` |
| [`https://github.com/openclaw/nix-openclaw`](https://github.com/openclaw/nix-openclaw) | AGPL-3.0 — verified in the [repository LICENSE](https://github.com/openclaw/nix-openclaw/blob/main/LICENSE) | Best behavioral reference for schema-typed OpenClaw config, Linux user service, plugins, immutable ownership, and mutable-state separation; clean-room reference because of copyleft. | `nix-openclaw-upstream` |
| [`https://github.com/openclaw/openclaw`](https://github.com/openclaw/openclaw) | MIT — verified in the [repository LICENSE](https://github.com/openclaw/openclaw/blob/main/LICENSE) | Authoritative installer, gateway unit rendering, config/schema writers, SecretRef behavior, plugin lifecycle, and health contracts. | `openclaw-upstream` |
| [`https://github.com/pulumi/pulumi-command`](https://github.com/pulumi/pulumi-command) | Apache-2.0 — verified in the [repository](https://github.com/pulumi/pulumi-command) | Direct implementation substrate for local/remote commands, file transfer, triggers, secret-output handling, and component child-resource patterns. | `pulumi-command` |
| [`https://github.com/pulumi/automation-api-examples`](https://github.com/pulumi/automation-api-examples) | **UNVERIFIED** — no license file or license metadata was visible in the [visited repository](https://github.com/pulumi/automation-api-examples) | Canonical TypeScript examples for inline/local programs, stack lifecycle, config, tests, HTTP control planes, and migrations. | `pulumi-automation-api-examples` |
| [`https://github.com/alchemy-run/alchemy`](https://github.com/alchemy-run/alchemy) | Apache-2.0 — verified in the [repository LICENSE](https://github.com/alchemy-run/alchemy/blob/main/LICENSE) | Strongest Effect-native IaC prior art: Effects/Layers, typed outputs, dependency tracking, typed errors, provider/action lifecycles, and test style. | `alchemy-effect-iac` |
| [`https://github.com/Effect-TS/effect`](https://github.com/Effect-TS/effect) | MIT — verified in the [repository LICENSE](https://github.com/Effect-TS/effect/blob/main/LICENSE) | Canonical source for current Effect Schema, Config, Layer, error, process, filesystem, and testing patterns used by the platform adapter. | `effect-upstream` |
| [`https://github.com/schemalabz/nix-openclaw`](https://github.com/schemalabz/nix-openclaw) | **UNVERIFIED** — license was not confirmed from a repository license file during this sweep | Concrete separation of read-only Nix-managed OpenClaw workspace content from runtime-mutable state, plus systemd service and preview-workspace patterns. | `nix-openclaw-schemalabz` |
| [`https://github.com/clawfleet/ClawFleet`](https://github.com/clawfleet/ClawFleet) | MIT — verified in the [repository LICENSE](https://github.com/clawfleet/ClawFleet/blob/main/LICENSE) | Comparable multi-agent deployment model for runtime pinning, per-instance state/isolation, health, backup, and operator UX. | `clawfleet` |

## Gaps and open questions

- No reusable OpenClaw Pulumi component/provider, Terraform module, or CDK
  construct was established beyond the application-specific
  [`pandysp/openclaw-infra`](https://github.com/pandysp/openclaw-infra);
  repository-index and private-code coverage remain incomplete.
- No public Pulumi + Effect TS or Pulumi + fp-ts/ZIO integration was
  established; [`alchemy-run/alchemy`](https://github.com/alchemy-run/alchemy)
  is adjacent prior art, not proof of compatibility with Pulumi's execution
  model.
- No dedicated Pulumi resource for `systemd --user` was found; the decision
  between a Command-backed component and a native provider still needs a
  prototype measuring preview, refresh, drift, delete, and failure semantics
  against the [documented dynamic-provider limitations](https://www.pulumi.com/docs/iac/concepts/providers/dynamic-providers/#limitations).
- Upstream documentation establishes immutable behavior specifically for
  `OPENCLAW_NIX_MODE=1`
  ([config reference](https://docs.openclaw.ai/cli/config)); it was not
  established whether OpenClaw offers or would accept a distribution-neutral
  externally-managed-config mode.
- The exact set of OpenClaw config paths mutated by onboarding, plugins,
  channels, doctor, and runtime RPCs was not exhaustively mapped; the
  [config writer documentation](https://docs.openclaw.ai/cli/config) establishes
  the mechanisms but not a complete ownership matrix.
- The Automation API examples repository license remains **UNVERIFIED** because
  no license file or license metadata was visible in the
  [visited repository](https://github.com/pulumi/automation-api-examples).
- The systemd execution environment for non-interactive local versus SSH
  deployments still needs live testing, including linger, user-manager
  availability, and teardown behavior; upstream documents linger through
  [`loginctl`](https://www.freedesktop.org/software/systemd/man/252/loginctl.html)
  but not Pulumi-specific invocation behavior.
