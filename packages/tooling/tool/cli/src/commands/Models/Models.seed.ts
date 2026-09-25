/**
 * The manifest `beep models init` writes when none exists yet.
 *
 * **Details**
 *
 * The seed is the census made executable: every binding is a routing concept
 * the surface census named, and every target is a file the repo census or the
 * `$HOME` sweep found holding a model id. It encodes the effort the *operator*
 * ratified — `medium` for `codex.heavy` — which is why the very first `check`
 * run is expected to report the `xhigh` and `high` copies as `stale` rather
 * than silently adopting them.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A } from "@beep/utils";
import * as DateTime from "effect/DateTime";
import * as O from "effect/Option";
import {
  BindingFilter,
  LocatorBinding,
  ModelBinding,
  ModelSyncTarget,
  ModelsManifest,
  SupersededModel,
} from "./Models.manifest.schemas.ts";
import type { EffortLevel, ModelId } from "./Models.catalog.schemas.ts";
import type {
  Locator,
  LocatorField,
  LocatorRender,
  RoutingRole,
  RoutingSurface,
  TargetId,
  TargetRoot,
} from "./Models.manifest.schemas.ts";

const modelId = (value: string): ModelId => value as ModelId;
const targetId = (value: string): TargetId => value as TargetId;

const verbatim: LocatorRender = { _tag: "verbatim" };

const jetBrainsEffortLabels: LocatorRender = {
  _tag: "effort-display-label",
  labels: [
    { effort: "low", label: "Low" },
    { effort: "medium", label: "Medium" },
    { effort: "high", label: "High" },
    { effort: "xhigh", label: "Extra High" },
    { effort: "max", label: "Max" },
    { effort: "ultra", label: "Ultra" },
  ],
};

const binding = (
  role: RoutingRole,
  surface: RoutingSurface,
  id: string,
  effort: O.Option<EffortLevel>,
  supersedes: ReadonlyArray<string> = []
): ModelBinding =>
  ModelBinding.make({
    role,
    surface,
    modelId: modelId(id),
    effort,
    supersedes: A.map(supersedes, modelId),
    note: O.none(),
  });

const at = (role: RoutingRole, surface: RoutingSurface, field: LocatorField): LocatorBinding =>
  LocatorBinding.make({ role, surface, field });

const block = (blockId: string, filter: BindingFilter, includeSuperseded: boolean): Locator => ({
  _tag: "md-generated-block",
  blockId,
  filter,
  includeSuperseded,
});

const tomlKey = (key: string, bindingRef: LocatorBinding, render: LocatorRender = verbatim): Locator => ({
  _tag: "toml-top-level-key",
  binding: bindingRef,
  render,
  key,
});

const target = (
  id: string,
  root: TargetRoot,
  path: string,
  optional: boolean,
  locators: ReadonlyArray<Locator>
): ModelSyncTarget =>
  ModelSyncTarget.make({
    id: targetId(id),
    root,
    path,
    optional,
    locators,
  });

const codexPluginSeat = (id: string, root: TargetRoot, path: string): ModelSyncTarget =>
  target(id, root, path, true, [
    tomlKey("model", at("codex.heavy", "codex-plugin", "model")),
    tomlKey("model_reasoning_effort", at("codex.heavy", "codex-plugin", "effort")),
  ]);

const codexConfig = (id: string, root: TargetRoot, path: string): ModelSyncTarget =>
  target(id, root, path, true, [
    tomlKey("model", at("codex.heavy", "codex-cli", "model")),
    tomlKey("model_reasoning_effort", at("codex.heavy", "codex-cli", "effort")),
    tomlKey("plan_mode_reasoning_effort", at("codex.plan", "codex-cli", "effort")),
  ]);

const doctrineEffort: Locator = {
  _tag: "line-value",
  binding: at("codex.heavy", "codex-cli", "effort"),
  render: verbatim,
  linePrefix: "",
  before: 'model_reasoning_effort="',
  after: '"',
};

const exampleModels = (id: string, path: string, role: RoutingRole): ModelSyncTarget =>
  target(id, "repo", `packages/tooling/tool/cli/src/commands/${path}`, false, [
    {
      _tag: "line-value",
      binding: at(role, "codex-plugin", "model"),
      render: verbatim,
      linePrefix: " *",
      before: 'model: "',
      after: '"',
    },
  ]);

const codexLauncher = (id: string, path: string): ModelSyncTarget =>
  target(id, "home", path, true, [
    {
      _tag: "xml-attribute",
      binding: at("codex.heavy", "jetbrains-codex", "model"),
      render: verbatim,
      elementSelector: 'option[name="model"]',
      attribute: "value",
    },
    {
      _tag: "xml-attribute",
      binding: at("codex.heavy", "jetbrains-codex", "effort"),
      render: jetBrainsEffortLabels,
      elementSelector: 'option[name="modelReasoningEffort"]',
      attribute: "value",
    },
  ]);

const agentRollout = (id: string, path: string): ModelSyncTarget =>
  target(id, "home", path, true, [
    {
      _tag: "xml-escaped-json-attribute",
      binding: at("child.lightweight", "proxy-workflow", "model"),
      render: verbatim,
      elementSelector: 'option[name="options"]',
      attribute: "value",
      jsonPointer: ["0", "model"],
    },
  ]);

const seedBindings: ReadonlyArray<ModelBinding> = [
  binding("codex.heavy", "codex-cli", "gpt-6-astra", O.some("medium"), ["gpt-5.6-sol"]),
  binding("codex.heavy", "codex-plugin", "gpt-6-astra", O.some("medium"), ["gpt-5.6-sol"]),
  binding("codex.heavy", "proxy-workflow", "gpt-6-astra", O.some("medium"), ["gpt-5.6-sol"]),
  binding("codex.heavy", "jetbrains-codex", "gpt-6-astra", O.some("medium"), ["gpt-5.6-sol"]),
  binding("codex.plan", "codex-cli", "gpt-6-astra", O.some("xhigh")),
  binding("child.lightweight", "proxy-workflow", "gpt-5.6-luna", O.none()),
  binding("research.web", "grok-cli", "grok-4.6", O.some("xhigh"), ["grok-4.5"]),
  binding("research.web", "proxy-workflow", "grok-4.6", O.none(), ["grok-4.5"]),
  binding("orchestrator", "claude-code", "claude-fable-5-1", O.none()),
  binding("cursor.volume", "cursor-seat", "composer-2.5", O.none()),
  binding("cursor.review", "cursor-seat", "claude-opus-5-thinking-high", O.none()),
  binding("cursor.mechanical", "cursor-seat", "composer-2.5", O.none()),
  binding("qa.judge", "codex-plugin", "gpt-6-astra", O.some("medium")),
  binding("graft.deep", "proxy-workflow", "claude-opus-5", O.none()),
  binding("jsdoc.migrate-titles", "grok-cli", "grok-4.6", O.none(), ["grok-4.5"]),
  binding("deprecated.routable", "proxy-workflow", "gpt-daybreak-blue-latest", O.none()),
];

const retiredAt = DateTime.makeUnsafe("2026-09-22T00:00:00Z");

const seedSuperseded: ReadonlyArray<SupersededModel> = [
  SupersededModel.make({
    id: modelId("gpt-5.6-sol"),
    retiredAt,
    replacedBy: O.some(modelId("gpt-6-astra")),
    note: O.some("Superseded as the token-heavy Codex default on 2026-09-08."),
  }),
  SupersededModel.make({
    id: modelId("grok-4.5"),
    retiredAt,
    replacedBy: O.some(modelId("grok-4.6")),
    note: O.none(),
  }),
  SupersededModel.make({
    id: modelId("gpt-5.4"),
    retiredAt,
    replacedBy: O.none(),
    note: O.none(),
  }),
  SupersededModel.make({
    id: modelId("gpt-5.4-mini"),
    retiredAt,
    replacedBy: O.none(),
    note: O.none(),
  }),
];

const allBindings = BindingFilter.make({ roles: [], surfaces: [] });
const cursorSeats = BindingFilter.make({ roles: [], surfaces: ["cursor-seat"] });
const onlyRoles = (roles: ReadonlyArray<RoutingRole>): BindingFilter => BindingFilter.make({ roles, surfaces: [] });

const seedTargets: ReadonlyArray<ModelSyncTarget> = [
  // ── Repo doctrine and skills (R9) ─────────────────────────────────────────
  target("repo.agents-md", "repo", "AGENTS.md", false, [block("volume-pools", allBindings, true), doctrineEffort]),
  target("repo.docs.agent-pools", "repo", "docs/runbooks/agent-pools.md", false, [
    block("cursor-seats", cursorSeats, true),
  ]),
  target("repo.docs.graft-local-recovery", "repo", "docs/runbooks/graft-local-recovery.md", false, [
    block("graft-deep", onlyRoles(["graft.deep"]), false),
  ]),
  target("repo.skills.browser-qa-loop", "repo", ".claude/skills/browser-qa-loop/SKILL.md", false, [
    block("qa-judge", onlyRoles(["qa.judge"]), false),
  ]),
  target(
    "repo.skills.browser-qa-loop.judge-prompt",
    "repo",
    ".claude/skills/browser-qa-loop/resources/judge-prompt.md",
    false,
    [block("qa-judge", onlyRoles(["qa.judge"]), false)]
  ),
  target("repo.skills.oracle", "repo", ".claude/skills/oracle/SKILL.md", false, [
    block("codex-heavy", onlyRoles(["codex.heavy"]), false),
  ]),
  codexPluginSeat(
    "repo.skills.impeccable.finish-reviewer",
    "repo",
    ".claude/skills/impeccable/agents/impeccable_finish_reviewer.toml"
  ),
  codexPluginSeat(
    "repo.skills.impeccable.documenter",
    "repo",
    ".claude/skills/impeccable/agents/impeccable_documenter.toml"
  ),
  codexPluginSeat(
    "repo.skills.impeccable.asset-producer",
    "repo",
    ".claude/skills/impeccable/agents/impeccable_asset_producer.toml"
  ),
  codexPluginSeat(
    "repo.skills.impeccable.manual-edit-applier",
    "repo",
    ".claude/skills/impeccable/agents/impeccable_manual_edit_applier.toml"
  ),
  target(
    "repo.code.jsdoc-migrate-titles",
    "repo",
    "packages/tooling/tool/cli/src/commands/Quality/internal/JSDocMigrateTitles.ts",
    false,
    [
      {
        _tag: "ts-literal",
        binding: at("jsdoc.migrate-titles", "grok-cli", "model"),
        render: verbatim,
        symbol: "defaultJSDocMigrateTitlesModel",
      },
    ]
  ),

  // ── Home doctrine (R7 + home sweep) ───────────────────────────────────────
  target("home.claude.doctrine", "home", "$HOME/.claude/CLAUDE.md", true, [
    block("routing-doctrine", allBindings, true),
  ]),
  target("home.claude.rules.working-style", "home", "$HOME/.claude/rules/working-style.md", true, [
    block("codex-delegation", onlyRoles(["codex.heavy", "codex.plan"]), false),
    doctrineEffort,
  ]),
  target("home.codex.agents-md", "home", "$HOME/.codex/AGENTS.md", true, [
    block("codex-lane", onlyRoles(["codex.heavy", "codex.plan"]), false),
    doctrineEffort,
  ]),
  target("home.cliproxyapi.dankstation", "home", "$HOME/YeeBois/workstation-apps/CLIProxyAPI/DANKSTATION.md", true, [
    block("deprecated-routable", onlyRoles(["deprecated.routable"]), true),
  ]),

  // ── Home configuration (R7 + home sweep) ──────────────────────────────────
  codexConfig("home.codex.config", "home", "$HOME/.codex/config.toml"),
  codexConfig("home.jetbrains.air.codex.config", "home", "$HOME/.config/JetBrains/Air/.codex/config.toml"),
  target("home.grok.config", "home", "$HOME/.grok/config.toml", true, [
    {
      _tag: "toml-table-key",
      binding: at("research.web", "grok-cli", "model"),
      render: verbatim,
      table: "models",
      key: "default",
    },
    {
      _tag: "toml-table-key",
      binding: at("research.web", "grok-cli", "effort"),
      render: verbatim,
      table: "models",
      key: "default_reasoning_effort",
    },
  ]),
  target("home.claude.settings", "home", "$HOME/.claude/settings.json", true, [
    {
      _tag: "json-key",
      binding: at("orchestrator", "claude-code", "model"),
      render: verbatim,
      pointer: ["model"],
    },
  ]),
  target("home.beep-graft.env", "home", "$HOME/.config/beep-graft/env", true, [
    {
      _tag: "env-key",
      binding: at("graft.deep", "proxy-workflow", "model"),
      render: verbatim,
      key: "GRAFT_MODEL",
    },
  ]),
  target("home.zshrc", "home", "$HOME/.zshrc", true, [
    {
      _tag: "shell-assign",
      binding: at("codex.heavy", "proxy-workflow", "model-effort-suffix"),
      render: verbatim,
      variable: "--model",
      within: O.some("claudex"),
    },
    {
      _tag: "shell-assign",
      binding: at("research.web", "proxy-workflow", "model"),
      render: verbatim,
      variable: "--model",
      within: O.some("claudeg"),
    },
    {
      _tag: "shell-assign",
      binding: at("orchestrator", "claude-code", "model"),
      render: verbatim,
      variable: "--model",
      within: O.some("claudep"),
    },
    {
      _tag: "shell-assign",
      binding: at("child.lightweight", "proxy-workflow", "model"),
      render: verbatim,
      variable: "ANTHROPIC_DEFAULT_HAIKU_MODEL",
      within: O.none(),
    },
  ]),
  codexLauncher(
    "home.jetbrains.webstorm-2026-3.codex-launcher",
    "$HOME/.config/JetBrains/WebStorm2026.3/options/CodexLauncher.xml"
  ),
  codexLauncher(
    "home.jetbrains.webstorm-2026-2.codex-launcher",
    "$HOME/.config/JetBrains/WebStorm2026.2/options/CodexLauncher.xml"
  ),
  agentRollout(
    "home.jetbrains.rustrover-2026-2.agent-rollout",
    "$HOME/.config/JetBrains/RustRover2026.2/options/DefaultAgentRollout.xml"
  ),
  agentRollout(
    "home.jetbrains.rustrover-2026-1.agent-rollout",
    "$HOME/.config/JetBrains/RustRover2026.1/options/DefaultAgentRollout.xml"
  ),
  codexPluginSeat(
    "home.agents.impeccable.finish-reviewer",
    "home",
    "$HOME/.agents/skills/impeccable/agents/impeccable_finish_reviewer.toml"
  ),
  codexPluginSeat(
    "home.agents.impeccable.documenter",
    "home",
    "$HOME/.agents/skills/impeccable/agents/impeccable_documenter.toml"
  ),
  codexPluginSeat(
    "home.agents.impeccable.asset-producer",
    "home",
    "$HOME/.agents/skills/impeccable/agents/impeccable_asset_producer.toml"
  ),
  codexPluginSeat(
    "home.agents.impeccable.manual-edit-applier",
    "home",
    "$HOME/.agents/skills/impeccable/agents/impeccable_manual_edit_applier.toml"
  ),
  exampleModels("repo.examples.qa-inventory", "Qa/Inventory.schemas.ts", "qa.judge"),
  exampleModels("repo.examples.qa-judge-check", "Qa/JudgeCheck.ts", "qa.judge"),
  exampleModels("repo.examples.qa-render", "Qa/Qa.render.ts", "qa.judge"),
  exampleModels("repo.examples.yeet-provenance", "Yeet/internal/Provenance.ts", "codex.heavy"),
  exampleModels("repo.examples.yeet-resume", "Yeet/internal/Resume.ts", "codex.heavy"),
  exampleModels("repo.examples.docgen-worker", "Docgen/internal/QualityWorkerEval.ts", "codex.heavy"),
  target("repo.code.qa-judge-pack", "repo", "packages/tooling/tool/cli/src/commands/Qa/JudgePack.ts", false, [
    {
      _tag: "line-value",
      binding: at("qa.judge", "codex-plugin", "model"),
      render: verbatim,
      linePrefix: "",
      before: "task --model ",
      after: " --effort ",
    },
    {
      _tag: "line-value",
      binding: at("qa.judge", "codex-plugin", "effort"),
      render: verbatim,
      linePrefix: "",
      before: " --effort ",
      after: " --prompt-file ",
    },
  ]),
];

/**
 * The manifest `beep models init` writes into an empty slot.
 *
 * **Details**
 *
 * Sixteen bindings cover the routing concepts the census named; the targets
 * are the repo rows of ruling 9 plus the home rows of ruling 7 and the
 * `$HOME` sweep. Home paths are written `$HOME/…` rather than absolute, so the
 * file stays portable and safe to read aloud.
 *
 * **Example** (Count the seeded bindings)
 *
 * ```ts
 * import { seedModelsManifest } from "@beep/repo-cli/commands/Models"
 *
 * console.log(seedModelsManifest.version) // "beep-models/v1"
 * console.log(seedModelsManifest.bindings.length) // 16
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const seedModelsManifest: ModelsManifest = ModelsManifest.make({
  version: "beep-models/v1",
  bindings: seedBindings,
  targets: seedTargets,
  superseded: seedSuperseded,
});
