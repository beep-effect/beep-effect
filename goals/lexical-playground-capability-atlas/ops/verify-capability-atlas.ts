import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { CompatibilityFormat, EditorCapabilityAtlas } from "./CapabilityAtlas.schemas.ts";

const atlasPath = Bun.fileURLToPath(new URL("../research/capability-atlas.json", import.meta.url));
const evidenceGapsPath = Bun.fileURLToPath(new URL("../research/p0-evidence-gaps.md", import.meta.url));
const repoRoot = Bun.fileURLToPath(new URL("../../../", import.meta.url));
const expectedCommit = "a933222c489e7025d87b9217c2489d309fc8a3cf";
const expectedVersion = "0.49.0";

const expectedRootNodes = [
  ["node.heading", "HeadingNode"],
  ["node.list", "ListNode"],
  ["node.list-item", "ListItemNode"],
  ["node.quote", "QuoteNode"],
  ["node.code", "CodeNode"],
  ["node.table", "TableNode"],
  ["node.table-cell", "TableCellNode"],
  ["node.table-row", "TableRowNode"],
  ["node.hashtag", "HashtagNode"],
  ["node.code-highlight", "CodeHighlightNode"],
  ["node.auto-link", "AutoLinkNode"],
  ["node.link", "LinkNode"],
  ["node.overflow", "OverflowNode"],
  ["node.poll", "PollNode"],
  ["node.sticky", "StickyNode"],
  ["node.image", "ImageNode"],
  ["node.mention", "MentionNode"],
  ["node.emoji", "EmojiNode"],
  ["node.excalidraw", "ExcalidrawNode"],
  ["node.equation", "EquationNode"],
  ["node.keyword", "KeywordNode"],
  ["node.horizontal-rule", "HorizontalRuleNode"],
  ["node.tweet", "TweetNode"],
  ["node.youtube", "YouTubeNode"],
  ["node.figma", "FigmaNode"],
  ["node.mark", "MarkNode"],
  ["node.collapsible-container", "CollapsibleContainerNode"],
  ["node.collapsible-content", "CollapsibleContentNode"],
  ["node.collapsible-title", "CollapsibleTitleNode"],
  ["node.page-break", "PageBreakNode"],
  ["node.layout-container", "LayoutContainerNode"],
  ["node.layout-item", "LayoutItemNode"],
  ["node.special-text", "SpecialTextNode"],
  ["node.date-time", "DateTimeNode"],
  ["node.card", "CardNode"],
  ["node.slot-container", "SlotContainerNode"],
  ["node.review", "ReviewNode"],
  ["node.pull-quote", "PullQuoteNode"],
] as const;

const expectedEffectiveNodes = [
  ...expectedRootNodes,
  ["node.page", "PageNode"],
  ["node.page-content", "PageContentNode"],
  ["node.ruby", "RubyNode"],
] as const;

const expectedSettingIds = [
  "setting.empty-editor",
  "setting.fit-nested-tables",
  "setting.link-attributes",
  "setting.nested-tables",
  "setting.autocomplete",
  "setting.char-limit-utf16",
  "setting.char-limit-utf8",
  "setting.code-highlighted",
  "setting.code-shiki",
  "setting.collaboration",
  "setting.max-length",
  "setting.rich-text",
  "setting.shadow-dom",
  "setting.visible-non-printing",
  "setting.list-strict-indent",
  "setting.measure-typing-perf",
  "setting.block-selection",
  "setting.retain-selection",
  "setting.bracket-special-text",
  "setting.checklist-focus",
  "setting.preserve-markdown-newlines",
  "setting.lexical-context-menu",
  "setting.nested-editor-tree-view",
  "setting.table-of-contents",
  "setting.tree-view",
  "setting.table-cell-background",
  "setting.table-cell-merge",
  "setting.table-horizontal-scroll",
  "setting.collaboration-v2",
] as const;

const expectedScreenshotPaths = [
  "01-overview-full.png",
  "02-block-type-menu.png",
  "03-font-family-menu.png",
  "04-text-color-picker.png",
  "05-background-highlight-color-picker.png",
  "06-additional-text-styles.png",
  "07-page-setup-dialog.png",
  "08-page-orientation.png",
  "08a-page-setup-closed-after-margins-probe.png",
  "09-insert-node-menu.png",
  "10-alignment-menu.png",
  "11-keyboard-shortcuts-dialog.png",
  "12-settings-feature-gates.png",
  "13-text-selection-floating-toolbar.png",
  "14-applied-text-highlight.png",
  "15-highlight-result.png",
  "16-slash-command-menu.png",
].map((name) => `explorations/full-document-editor/assets/${name}`);

const expectedTopLevelRegistrationNames = [
  "AutoFocusPlugin",
  "ClearEditorPlugin",
  "HistoryExtension",
  "KeywordsPlugin",
  "HashtagPlugin",
  "DateTimePlugin",
  "EmojisPlugin",
  "MentionsPlugin",
  "LinkPlugin",
  "AutoLinkPlugin",
  "MaxLengthPlugin",
  "SpecialTextPlugin",
  "DragDropPastePlugin",
  "SelectionAlwaysOnDisplay",
  "BlockWithAlignableContents",
  "HTMLPlugin",
  "ClickAfterLastBlockPlugin",
  "AutocompletePlugin",
  "NonPrintingCharactersPlugin",
  "FocusPlugin",
  "TabFocusPlugin",
  "RovingTabIndexPlugin",
  "ToolbarPlugin",
  "FloatingTextFormatToolbarPlugin",
  "ComponentPickerPlugin",
  "DraggableBlockPlugin",
  "ShortcutsPlugin",
  "ActionsPlugin",
  "FindReplacePlugin",
  "TablePlugin",
  "TableActionMenuPlugin",
  "TableCellActionMenuPlugin",
  "TableCellResizer",
  "TableHoverActionsPlugin",
  "ImagesPlugin",
  "HorizontalRulePlugin",
  "PageBreakPlugin",
  "TwitterPlugin",
  "YouTubePlugin",
  "FigmaPlugin",
  "CollapsiblePlugin",
  "CodeHighlightPlugin",
  "ListPlugin",
  "CheckListPlugin",
  "MarkdownShortcutPlugin",
  "PagesExtension",
  "PagesReactExtension",
  "PollPlugin",
  "EquationsPlugin",
  "LayoutPlugin",
  "ExcalidrawPlugin",
  "CardPlugin",
  "ReviewPlugin",
  "PullQuotePlugin",
  "RubyExtension",
  "TabIndentationPlugin",
  "CharacterLimitPlugin",
  "UTF8CharacterLimitPlugin",
  "LinkAttributesPlugin",
  "CommentsPlugin",
  "CollaborationPlugin",
  "SpeechToTextPlugin",
  "TreeViewPlugin",
  "NestedEditorTreeViewPlugin",
  "TableOfContentsPlugin",
  "ContextMenuPlugin",
  "TypingPerfPlugin",
  "DocsPlugin",
  "PasteLogPlugin",
  "TestRecorderPlugin",
  "SplitScreenPlugin",
  "PlainTextExtension",
  "QueryParameterSettingsOverride",
] as const;

const expectedMarkdownTransformerNames = [
  "TABLE",
  "HORIZONTAL_RULE",
  "IMAGE",
  "EMOJI",
  "EQUATION",
  "INLINE_EQUATION",
  "TWEET",
  "CHECK_LIST",
  "HEADING",
  "QUOTE",
  "UNORDERED_LIST",
  "ORDERED_LIST",
  "CODE",
  "INLINE_CODE",
  "BOLD_ITALIC_STAR",
  "BOLD_ITALIC_UNDERSCORE",
  "BOLD_STAR",
  "BOLD_UNDERSCORE",
  "HIGHLIGHT",
  "ITALIC_STAR",
  "ITALIC_UNDERSCORE",
  "STRIKETHROUGH",
  "LINK",
] as const;

const expectedActivationSurfaces = [
  "toolbar",
  "floating-toolbar",
  "block-menu",
  "insert-menu",
  "slash-menu",
  "markdown-shortcut",
  "keyboard",
  "context-menu",
  "paste-drop",
  "importer",
  "programmatic",
  "settings-panel",
  "query-parameter",
  "document-action",
  "typeahead",
  "selection",
  "draggable-block",
  "automatic",
  "browser-api",
  "read-only",
] as const;

const expectedDocumentActionIds = [
  "document.import-lexical-json",
  "document.export-lexical-json",
  "document.share-url",
  "document.clear",
  "document.read-only",
  "document.markdown-source",
  "document.html-source",
  "document.export-dom",
  "document.time-travel",
  "document.comments-panel",
  "document.speech-to-text",
] as const;

const expectedKeybindings = [
  ["node.paragraph", "Normal", "Ctrl+Alt+0", "Cmd+Option+0"],
  ["node.heading", "Heading 1", "Ctrl+Alt+1", "Cmd+Option+1"],
  ["node.heading", "Heading 2", "Ctrl+Alt+2", "Cmd+Option+2"],
  ["node.heading", "Heading 3", "Ctrl+Alt+3", "Cmd+Option+3"],
  ["node.list", "Numbered list", "Ctrl+Shift+7", "Cmd+Shift+7"],
  ["node.list", "Bullet list", "Ctrl+Shift+8", "Cmd+Shift+8"],
  ["node.list", "Check list", "Ctrl+Shift+9", "Cmd+Shift+9"],
  ["node.code", "Code block", "Ctrl+Alt+C", "Cmd+Option+C"],
  ["node.quote", "Quote", "Ctrl+Shift+Q", "Control+Shift+Q"],
  ["node.mark", "Add comment", "Ctrl+Alt+M", "Cmd+Option+M"],
  ["style.font-size", "Increase font size", "Ctrl+Shift+.", "Cmd+Shift+."],
  ["style.font-size", "Decrease font size", "Ctrl+Shift+,", "Cmd+Shift+,"],
  ["format.inline-code", "Inline code", "Ctrl+Shift+C", "Cmd+Shift+C"],
  ["format.strikethrough", "Strikethrough", "Ctrl+Shift+X", "Cmd+Shift+X"],
  ["format.lowercase", "Lowercase", "Ctrl+Shift+1", "Control+Shift+1"],
  ["format.uppercase", "Uppercase", "Ctrl+Shift+2", "Control+Shift+2"],
  ["format.capitalize", "Capitalize", "Ctrl+Shift+3", "Control+Shift+3"],
  ["layout.align-center", "Center align", "Ctrl+Shift+E", "Cmd+Shift+E"],
  ["layout.align-justify", "Justify align", "Ctrl+Shift+J", "Cmd+Shift+J"],
  ["layout.align-left", "Left align", "Ctrl+Shift+L", "Cmd+Shift+L"],
  ["layout.align-right", "Right align", "Ctrl+Shift+R", "Cmd+Shift+R"],
  ["format.subscript", "Subscript", "Ctrl+,", "Cmd+,"],
  ["format.superscript", "Superscript", "Ctrl+.", "Cmd+."],
  ["layout.indent", "Indent", "Ctrl+]", "Cmd+]"],
  ["layout.outdent", "Outdent", "Ctrl+[", "Cmd+["],
  ["format.clear", "Clear formatting", "Ctrl+\\", "Cmd+\\"],
  ["authoring.redo", "Redo", "Ctrl+Y", "Cmd+Shift+Z"],
  ["authoring.undo", "Undo", "Ctrl+Z", "Cmd+Z"],
  ["format.bold", "Bold", "Ctrl+B", "Cmd+B"],
  ["format.italic", "Italic", "Ctrl+I", "Cmd+I"],
  ["format.underline", "Underline", "Ctrl+U", "Cmd+U"],
  ["node.link", "Insert link", "Ctrl+K", "Cmd+K"],
] as const;

let failureCount = 0;

const writeLine = (message: string): void => {
  process.stdout.write(`${message}\n`);
};

const writeError = (message: string): void => {
  process.stderr.write(`${message}\n`);
};

const fail = (message: string): void => {
  failureCount += 1;
  writeError(`atlas error: ${message}`);
};

const duplicateValues = (values: ReadonlyArray<string>): ReadonlyArray<string> => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  }
  return [...duplicates].sort();
};

const compareExactInventory = (label: string, actual: ReadonlyArray<string>, expected: ReadonlyArray<string>): void => {
  const duplicates = duplicateValues(actual);
  if (duplicates.length > 0) {
    fail(`${label} contains duplicates: ${duplicates.join(", ")}`);
  }
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  const missing = expected.filter((value) => !actualSet.has(value));
  const unexpected = actual.filter((value) => !expectedSet.has(value));
  if (missing.length > 0) {
    fail(`${label} is missing: ${missing.join(", ")}`);
  }
  if (unexpected.length > 0) {
    fail(`${label} has unexpected values: ${unexpected.join(", ")}`);
  }
};

const validateRepoPath = async (label: string, relativePath: string): Promise<void> => {
  if (relativePath.startsWith("/") || relativePath.split("/").includes("..")) {
    fail(`${label} must be a repo-relative path without parent traversal: ${relativePath}`);
    return;
  }
  if (!(await Bun.file(`${repoRoot}${relativePath}`).exists())) {
    fail(`${label} does not resolve: ${relativePath}`);
  }
};

const rawAtlas = await Bun.file(atlasPath).text();
if (/\b(?:TODO|TBD|FIXME|PLACEHOLDER)\b/i.test(rawAtlas)) {
  fail("artifact contains placeholder text");
}

let atlas: EditorCapabilityAtlas | undefined;
try {
  atlas = await Effect.runPromise(S.decodeUnknownEffect(S.fromJsonString(EditorCapabilityAtlas))(rawAtlas));
} catch (error) {
  fail(`schema decode failed: ${String(error)}`);
}

if (atlas === undefined) {
  writeError(`editor-capability-atlas/v1 INVALID: ${failureCount} error(s)`);
  process.exit(1);
}

if (atlas.upstream.packageVersion !== expectedVersion || atlas.upstream.commit !== expectedCommit) {
  fail(`upstream baseline must be Lexical ${expectedVersion} at ${expectedCommit}`);
}

const capabilityIds = atlas.capabilities.map((capability) => capability.id);
const duplicateCapabilityIds = duplicateValues(capabilityIds);
if (duplicateCapabilityIds.length > 0) {
  fail(`duplicate capability IDs: ${duplicateCapabilityIds.join(", ")}`);
}

const stableIdPattern = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const capabilityById = new Map(atlas.capabilities.map((capability) => [capability.id, capability]));
for (const capability of atlas.capabilities) {
  if (!stableIdPattern.test(capability.id) || capability.id.endsWith(".") || capability.id.endsWith("-")) {
    fail(`incomplete or unstable capability ID: ${capability.id}`);
  }
  if (capability.upstream.packageVersion !== expectedVersion || capability.upstream.commit !== expectedCommit) {
    fail(`${capability.id} does not carry the pinned upstream identity`);
  }
  if (capability.upstreamEvidence.source.length + capability.upstreamEvidence.live.length === 0) {
    fail(`${capability.id} has no source or live evidence`);
  }
  if (capability.evidenceStatus === "verified-live" && capability.upstreamEvidence.live.length === 0) {
    fail(`${capability.id} is verified-live without live evidence`);
  }
  if (capability.evidenceStatus === "verified-source" && capability.upstreamEvidence.source.length === 0) {
    fail(`${capability.id} is verified-source without source evidence`);
  }
  if (capability.evidenceStatus === "unverified" && capability.proofGaps.length === 0) {
    fail(`${capability.id} is unverified without a concrete proof gap`);
  }
  if (
    capability.disposition.kind === "reject" &&
    (capability.profileEligibility.length !== 1 || capability.profileEligibility[0] !== "ineligible")
  ) {
    fail(`${capability.id} is rejected but remains profile-eligible`);
  }
  if (
    capability.disposition.kind === "development-only" &&
    capability.profileEligibility.some((profile) => profile !== "development-reference")
  ) {
    fail(`${capability.id} is development-only but escapes the development-reference profile`);
  }
  if (
    capability.disposition.kind === "defer" &&
    capability.profileEligibility.some((profile) =>
      ["minimal", "document-proof", "production-single-user"].includes(profile)
    )
  ) {
    fail(`${capability.id} is deferred but remains eligible for a production profile`);
  }
  for (const dependency of capability.dependencies) {
    if (!capabilityById.has(dependency)) {
      fail(`${capability.id} has unknown dependency ${dependency}`);
    }
    if (dependency === capability.id) {
      fail(`${capability.id} depends on itself`);
    }
  }
  for (const conflict of capability.conflicts) {
    if (!capabilityById.has(conflict)) {
      fail(`${capability.id} has unknown conflict ${conflict}`);
    }
    if (conflict === capability.id) {
      fail(`${capability.id} conflicts with itself`);
    }
  }
  const formats = capability.compatibility.map((item) => item.format);
  compareExactInventory(`${capability.id} compatibility formats`, formats, CompatibilityFormat.Options);
  for (const command of capability.commands) {
    if (!stableIdPattern.test(command.id)) {
      fail(`${capability.id} has incomplete command ID ${command.id}`);
    }
  }
  for (const item of capability.upstreamEvidence.source) {
    await validateRepoPath(`${capability.id} source audit`, item.auditPath);
  }
  for (const item of capability.upstreamEvidence.live) {
    await validateRepoPath(`${capability.id} live audit`, item.auditPath);
    for (const screenshot of item.screenshots) {
      if (!atlas.evidence.screenshots.some((item) => item.path === screenshot)) {
        fail(`${capability.id} cites screenshot outside the pinned inventory: ${screenshot}`);
      }
      await validateRepoPath(`${capability.id} screenshot`, screenshot);
    }
  }
}

const commandIds = atlas.capabilities.flatMap((capability) => capability.commands.map((command) => command.id));
const duplicateCommandIds = duplicateValues(commandIds);
if (duplicateCommandIds.length > 0) {
  fail(`duplicate command IDs: ${duplicateCommandIds.join(", ")}`);
}

const visiting = new Set<string>();
const visited = new Set<string>();
const dependencyPath: Array<string> = [];
const visitDependencies = (id: string): void => {
  if (visited.has(id)) return;
  if (visiting.has(id)) {
    const cycleStart = dependencyPath.indexOf(id);
    fail(`dependency cycle: ${[...dependencyPath.slice(cycleStart), id].join(" -> ")}`);
    return;
  }
  visiting.add(id);
  dependencyPath.push(id);
  for (const dependency of capabilityById.get(id)?.dependencies ?? []) {
    visitDependencies(dependency);
  }
  dependencyPath.pop();
  visiting.delete(id);
  visited.add(id);
};
for (const id of capabilityIds) visitDependencies(id);

const requireCapability = (
  id: string,
  predicate: (capability: EditorCapabilityAtlas["capabilities"][number]) => boolean,
  requirement: string
): void => {
  const capability = capabilityById.get(id);
  if (capability === undefined) {
    fail(`required policy entry is missing: ${id}`);
  } else if (!predicate(capability)) {
    fail(`${id} violates binding policy: ${requirement}`);
  }
};

for (const id of ["node.tweet", "node.youtube", "node.figma"]) {
  requireCapability(
    id,
    (capability) => capability.networkSecurity.egress === "none" && !capability.networkSecurity.opensRemoteContent,
    "D14 requires remote embeds to remain network-inert on open"
  );
}
requireCapability(
  "sidecar.poll-responses",
  (capability) =>
    capability.disposition.kind === "defer" && capability.ownership.ownerPackage === "owning product slice",
  "the D13 note keeps responses and voter identity slice-owned"
);
requireCapability(
  "sidecar.review-lifecycle",
  (capability) =>
    capability.disposition.kind === "defer" && capability.ownership.ownerPackage === "owning product slice",
  "D12 and D13 keep system authorship and review lifecycle slice-owned"
);
for (const id of ["comments.threads", "collaboration.realtime"]) {
  requireCapability(
    id,
    (capability) => capability.disposition.kind === "defer",
    "D10 and D11 exclude collaboration and comments from production defaults"
  );
}
requireCapability(
  "integration.analytics",
  (capability) => capability.disposition.kind === "reject" && capability.networkSecurity.egress === "rejected",
  "Playground host analytics are not editor capability behavior"
);

await validateRepoPath("source audit", atlas.evidence.sourceAuditPath);
await validateRepoPath("live audit", atlas.evidence.liveAuditPath);
await validateRepoPath("capability reference", atlas.evidence.capabilityReferencePath);
await validateRepoPath("decisions", atlas.evidence.decisionsPath);
for (const screenshot of atlas.evidence.screenshots) {
  await validateRepoPath("screenshot inventory", screenshot.path);
}

compareExactInventory(
  "root-registered node inventory",
  atlas.evidence.inventories.rootRegisteredNodeIds,
  expectedRootNodes.map(([id]) => id)
);
compareExactInventory(
  "effective rich-text node inventory",
  atlas.evidence.inventories.effectiveRichTextNodeIds,
  expectedEffectiveNodes.map(([id]) => id)
);
compareExactInventory("settings inventory", atlas.evidence.inventories.settingIds, expectedSettingIds);
compareExactInventory(
  "screenshot inventory",
  atlas.evidence.screenshots.map((item) => item.path),
  expectedScreenshotPaths
);
compareExactInventory(
  "top-level registration inventory",
  atlas.evidence.inventories.topLevelRegistrations.map((item) => item.name),
  expectedTopLevelRegistrationNames
);
compareExactInventory(
  "Markdown transformer inventory",
  atlas.evidence.inventories.markdownTransformers.map((item) => item.name),
  expectedMarkdownTransformerNames
);
compareExactInventory(
  "activation-surface inventory",
  atlas.evidence.inventories.activationSurfaces,
  expectedActivationSurfaces
);
compareExactInventory(
  "document-action inventory",
  atlas.evidence.inventories.documentActionIds,
  expectedDocumentActionIds
);

for (const [id, nodeClass] of expectedEffectiveNodes) {
  const capability = capabilityById.get(id);
  if (capability === undefined) {
    fail(`node inventory references missing capability ${id}`);
  } else if (!capability.registrations.nodes.includes(nodeClass)) {
    fail(`${id} does not register expected node class ${nodeClass}`);
  }
}
for (const id of expectedSettingIds) {
  const capability = capabilityById.get(id);
  if (capability === undefined || capability.category !== "setting") {
    fail(`settings inventory does not resolve to a setting entry: ${id}`);
  }
}
for (const item of atlas.evidence.inventories.topLevelRegistrations) {
  const capability = capabilityById.get(item.capabilityId);
  if (capability === undefined) {
    fail(`${item.name} maps to unknown capability ${item.capabilityId}`);
  } else if (!capability.registrations.extensions.includes(item.name)) {
    fail(`${item.name} maps to ${item.capabilityId}, which does not register that extension`);
  }
}
for (const item of atlas.evidence.inventories.markdownTransformers) {
  const capability = capabilityById.get(item.capabilityId);
  if (capability === undefined) {
    fail(`${item.name} maps to unknown capability ${item.capabilityId}`);
  } else if (!capability.registrations.transformers.includes(item.name)) {
    fail(`${item.name} maps to ${item.capabilityId}, which does not register that transformer`);
  }
}
for (const id of atlas.evidence.inventories.documentActionIds) {
  const capability = capabilityById.get(id);
  if (capability === undefined || !["document-action", "diagnostic"].includes(capability.category)) {
    fail(`document-action inventory does not resolve to an action entry: ${id}`);
  }
}

const actualActivationSurfaces = new Set(
  atlas.capabilities.flatMap((capability) => capability.activationPaths.map((path) => path.surface))
);
for (const surface of expectedActivationSurfaces) {
  if (!actualActivationSurfaces.has(surface)) {
    fail(`no capability uses required activation surface ${surface}`);
  }
}

const actualKeybindings = atlas.evidence.inventories.observedKeybindings.map((item) =>
  [item.capabilityId, item.action, item.windowsLinux, item.apple].join("\u0000")
);
const pinnedKeybindings = expectedKeybindings.map((item) => item.join("\u0000"));
compareExactInventory("observed keybinding inventory", actualKeybindings, pinnedKeybindings);
for (const item of atlas.evidence.inventories.observedKeybindings) {
  const capability = capabilityById.get(item.capabilityId);
  const matchingCommand = capability?.commands.find((command) => command.label === item.action);
  if (matchingCommand === undefined) {
    fail(`${item.capabilityId} lacks the inventoried command label ${item.action}`);
    continue;
  }
  const windowsLinux = matchingCommand.keybindings.find((binding) => binding.platform === "windows-linux")?.chord;
  const apple = matchingCommand.keybindings.find((binding) => binding.platform === "apple")?.chord;
  if (windowsLinux !== item.windowsLinux || apple !== item.apple) {
    fail(`${item.capabilityId}/${item.action} command bindings do not match the pinned inventory`);
  }
}

const counts = atlas.evidence.inventories.expectedCounts;
const actualCounts = {
  rootRegisteredNodes: atlas.evidence.inventories.rootRegisteredNodeIds.length,
  effectiveRichTextNodes: atlas.evidence.inventories.effectiveRichTextNodeIds.length,
  settings: atlas.evidence.inventories.settingIds.length,
  screenshots: atlas.evidence.screenshots.length,
  topLevelRegistrations: atlas.evidence.inventories.topLevelRegistrations.length,
  markdownTransformers: atlas.evidence.inventories.markdownTransformers.length,
  observedKeybindings: atlas.evidence.inventories.observedKeybindings.length,
  documentActions: atlas.evidence.inventories.documentActionIds.length,
};
for (const key of Object.keys(actualCounts) as Array<keyof typeof actualCounts>) {
  if (counts[key] !== actualCounts[key]) {
    fail(`expectedCounts.${key}=${counts[key]} but reconciled inventory has ${actualCounts[key]}`);
  }
}
if (counts.rootRegisteredNodes !== 38 || counts.effectiveRichTextNodes !== 41) {
  fail("pinned node evidence checks must remain 38 root registrations and 41 effective rich-text registrations");
}
if (counts.settings !== 29 || counts.screenshots !== 17 || counts.observedKeybindings !== 32) {
  fail("pinned settings, screenshot, and observed-keybinding counts must remain 29, 17, and 32");
}

const evidenceGaps = await Bun.file(evidenceGapsPath).text();
const recordedGapIds = [...evidenceGaps.matchAll(/^\| `([^`]+)` \|/gm)].map((match) => match[1]);
compareExactInventory(
  "P0 evidence-gap ledger",
  recordedGapIds,
  atlas.capabilities.filter((item) => item.evidenceStatus === "unverified").map((item) => item.id)
);
if (/\b(?:TODO|TBD|FIXME|PLACEHOLDER)\b/i.test(evidenceGaps)) {
  fail("P0 evidence-gap ledger contains placeholder text");
}
if (!evidenceGaps.includes("P0 is not complete.")) {
  fail("P0 evidence-gap ledger must state that P0 is not complete");
}

const summarize = (select: (capability: EditorCapabilityAtlas["capabilities"][number]) => string) => {
  const summary = new Map<string, number>();
  for (const capability of atlas.capabilities) {
    const key = select(capability);
    summary.set(key, (summary.get(key) ?? 0) + 1);
  }
  return [...summary.entries()].sort(([left], [right]) => left.localeCompare(right));
};

if (failureCount > 0) {
  writeError(`editor-capability-atlas/v1 INVALID: ${failureCount} error(s)`);
  process.exit(1);
}

writeLine(`editor-capability-atlas/v1 OK: ${atlas.capabilities.length} stable capability entries`);
writeLine(
  `evidence checks: ${counts.rootRegisteredNodes} root nodes; ${counts.effectiveRichTextNodes} effective rich-text nodes; ${counts.settings} settings; ${counts.topLevelRegistrations} top-level registrations; ${counts.markdownTransformers} Markdown transformers; ${counts.observedKeybindings} observed keybindings; ${counts.documentActions} document actions; ${counts.screenshots} screenshots`
);
writeLine(
  `category counts: ${summarize((item) => item.category)
    .map(([key, value]) => `${key}=${value}`)
    .join(", ")}`
);
writeLine(
  `disposition counts: ${summarize((item) => item.disposition.kind)
    .map(([key, value]) => `${key}=${value}`)
    .join(", ")}`
);
writeLine(
  `evidenceStatus counts: ${summarize((item) => item.evidenceStatus)
    .map(([key, value]) => `${key}=${value}`)
    .join(", ")}`
);
const unverifiedCount = atlas.capabilities.filter((item) => item.evidenceStatus === "unverified").length;
writeLine(
  unverifiedCount === 0
    ? "P0 evidence gate: complete"
    : `P0 evidence gate: OPEN (${unverifiedCount} entries still require live exercise or user-approved waivers)`
);
