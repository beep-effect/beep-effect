# Per-module import census and mapping table

Status: complete

This report inventories the current repository import surface and defines the
mechanical source-binding-to-subpath mapping for the future
`goals/per-module-imports` migration.

## Scope and counting method

Snapshot date: 2026-08-23. The code census begins with `rg --files` over the
eight JavaScript/TypeScript extensions `ts`, `tsx`, `mts`, `cts`, `js`, `jsx`,
`mjs`, and `cjs`. Ripgrep's normal ignore rules therefore exclude vendored and
ignored trees such as `node_modules`, `.repos`, `.git`, and hidden scratch
state. The resulting population is **4,330 code files**. TypeScript 6.0.3 then
classifies the ripgrep inventory's top-level `ImportDeclaration` nodes so that
comments, JSDoc examples, and ordinary strings are not mistaken for executable
imports. Those non-code surfaces are counted separately in the edge-case
register.

“Files” below means distinct files containing at least one matching static
import; “statements” means static import declarations. A file may appear once
in both file columns if it mixes barrel and subpath imports. `others` is the
exact remainder after the six named `packages/*` families and `apps/*`; it
therefore includes the other domain/driver/shared/workspace package families,
root scripts, examples, and configuration code.

Reproduction skeleton:

```sh
rg --files \
  -g '*.ts' -g '*.tsx' -g '*.mts' -g '*.cts' \
  -g '*.js' -g '*.jsx' -g '*.mjs' -g '*.cjs'
rg -n "from[[:space:]]+['\"]effect['\"]" --glob '*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}'
rg -n "from[[:space:]]+['\"]effect/" --glob '*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}'
```

The second and third commands are intentionally only audit cross-checks:
plain text hits include comment examples, while the reported executable counts
come from syntax classification of the same ripgrep file set.

## 1. Import census

### Effect root barrel versus per-module paths

| Family | `effect` files | `effect` statements | `effect/*` files | `effect/*` statements |
| --- | ---: | ---: | ---: | ---: |
| `packages/foundation` | 414 | 430 | 639 | 1,568 |
| `packages/ecosystem` | 1 | 1 | 39 | 242 |
| `packages/ontology` | 45 | 45 | 42 | 86 |
| `packages/agents` | 41 | 46 | 55 | 140 |
| `packages/tooling` | 584 | 637 | 650 | 1,826 |
| `packages/_internal` | 12 | 12 | 10 | 28 |
| `apps/*` | 115 | 123 | 126 | 300 |
| `others` | 732 | 795 | 1,071 | 3,122 |
| **Total** | **1,944** | **2,089** | **2,632** | **7,312** |

All 2,089 executable root-barrel imports use named-import syntax. Of them, 150
are statement-level `import type`; an additional set of specifier-level
`type` bindings occurs in mixed imports and is represented in the binding
tables below.

### Foundation root-barrel imports

The inventory uses every package name declared under `packages/foundation/**/package.json`, plus the requested but currently absent `@beep/invariant` name. Exact package-root matches only are counted; existing subpaths such as `@beep/schema/Int` are not barrel hits.

| Foundation barrel | Files | Statements | Distinct named bindings | Other import forms |
| --- | ---: | ---: | ---: | --- |
| `@beep/api-transport` | 9 | 11 | 5 | — |
| `@beep/chalk` | 4 | 6 | 10 | default `chalk` × 2; default `defaultChalk` × 1 |
| `@beep/colors` | 7 | 9 | 5 | default `colors` × 2; default `bc` × 2; default `defaultColors` × 1 |
| `@beep/data` | 5 | 5 | 4 | — |
| `@beep/dock` | 33 | 53 | 99 | — |
| `@beep/dock-react` | 9 | 15 | 7 | — |
| `@beep/editor` | 0 | 0 | 0 | — |
| `@beep/file-processing` | 2 | 2 | 1 | — |
| `@beep/html` | 8 | 10 | 43 | — |
| `@beep/identity` | 585 | 594 | 93 | namespace `Identity` × 1 |
| `@beep/invariant` | 0 | 0 | 0 | — |
| `@beep/langextract` | 0 | 0 | 0 | — |
| `@beep/lexical-schema` | 27 | 32 | 35 | — |
| `@beep/mcp-kit` | 34 | 38 | 36 | — |
| `@beep/md` | 9 | 10 | 6 | — |
| `@beep/nlp` | 0 | 0 | 0 | — |
| `@beep/nlp-processing` | 0 | 0 | 0 | — |
| `@beep/observability` | 40 | 41 | 35 | — |
| `@beep/ontology` | 3 | 4 | 35 | — |
| `@beep/pandoc-ast` | 0 | 0 | 0 | — |
| `@beep/provenance` | 2 | 2 | 1 | — |
| `@beep/rdf` | 48 | 56 | 15 | namespace `RdfRoot` × 1; namespace `CanonicalRdf` × 1 |
| `@beep/schema` | 993 | 1002 | 60 | — |
| `@beep/semantic-web` | 1 | 1 | 0 | namespace `SemanticWeb` × 1 |
| `@beep/types` | 9 | 9 | 2 | — |
| `@beep/ui` | 1 | 1 | 1 | — |
| `@beep/utils` | 917 | 919 | 33 | — |

There are **2,820 foundation-root import statements** in **2,746 package/file incidences** (the file total is intentionally non-distinct across packages). `@beep/invariant` has no package declaration and zero imports in this snapshot. `@beep/chalk` has three default-import occurrences and `@beep/colors` has five; their direct homes are `@beep/chalk/Chalk` and `@beep/colors/Colors`. Namespace-root imports occur once for `@beep/identity`, twice for `@beep/rdf`, and once for `@beep/semantic-web`.

#### Complete foundation named-binding frequency

`Value` and `type` classify the import syntax, not whether the exported symbol has both TypeScript namespaces. Aliases show `local-name:occurrences`; an empty cell means the source name is preserved.

| Package | Source binding | Occurrences | Value | Type-only | Files | Aliases |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| `@beep/api-transport` | `EgressDenied` | 5 | 5 | 0 | 5 |  |
| `@beep/api-transport` | `RateLimitSnapshot` | 4 | 2 | 2 | 4 |  |
| `@beep/api-transport` | `ApiAuth` | 3 | 3 | 0 | 3 |  |
| `@beep/api-transport` | `makeApiTransport` | 2 | 2 | 0 | 2 |  |
| `@beep/api-transport` | `ApiTransportOptions` | 1 | 1 | 0 | 1 |  |
| `@beep/chalk` | `Chalk` | 3 | 2 | 1 | 3 |  |
| `@beep/chalk` | `ColorSupportLevel` | 2 | 1 | 1 | 1 | ColorSupportLevelType:1 |
| `@beep/chalk` | `ChalkConstructorOptions` | 1 | 1 | 0 | 1 |  |
| `@beep/chalk` | `ChalkInstance` | 1 | 0 | 1 | 1 |  |
| `@beep/chalk` | `ChalkOptions` | 1 | 1 | 0 | 1 |  |
| `@beep/chalk` | `chalkStderr` | 1 | 1 | 0 | 1 |  |
| `@beep/chalk` | `ColorInfo` | 1 | 1 | 0 | 1 |  |
| `@beep/chalk` | `ColorName` | 1 | 1 | 0 | 1 |  |
| `@beep/chalk` | `ColorSupport` | 1 | 1 | 0 | 1 |  |
| `@beep/chalk` | `ModifierName` | 1 | 1 | 0 | 1 |  |
| `@beep/colors` | `Colors` | 3 | 1 | 2 | 3 |  |
| `@beep/colors` | `createColors` | 3 | 3 | 0 | 3 |  |
| `@beep/colors` | `isColorSupported` | 1 | 1 | 0 | 1 |  |
| `@beep/colors` | `ProcessLike` | 1 | 1 | 0 | 1 |  |
| `@beep/colors` | `supportsColor` | 1 | 1 | 0 | 1 |  |
| `@beep/data` | `Territories` | 2 | 2 | 0 | 2 | TerritoriesData:2 |
| `@beep/data` | `CurrencyCodes` | 1 | 1 | 0 | 1 | CurrencyCodesData:1 |
| `@beep/data` | `MimeTypesData` | 1 | 1 | 0 | 1 |  |
| `@beep/data` | `Timezones` | 1 | 1 | 0 | 1 | TimezonesData:1 |
| `@beep/dock` | `GroupId` | 23 | 20 | 3 | 23 |  |
| `@beep/dock` | `PanelId` | 23 | 22 | 1 | 23 | PanelIdSchema:1 |
| `@beep/dock` | `TabsNode` | 22 | 21 | 1 | 22 |  |
| `@beep/dock` | `Panel` | 20 | 16 | 4 | 20 |  |
| `@beep/dock` | `DockWorkspace` | 18 | 15 | 3 | 18 |  |
| `@beep/dock` | `SplitId` | 18 | 17 | 1 | 18 |  |
| `@beep/dock` | `SplitNode` | 18 | 17 | 1 | 18 |  |
| `@beep/dock` | `PopulatedWorkspace` | 16 | 16 | 0 | 16 |  |
| `@beep/dock` | `SplitRatio` | 16 | 16 | 0 | 16 |  |
| `@beep/dock` | `DockNode` | 14 | 12 | 2 | 13 | DockNodeOps:1 |
| `@beep/dock` | `TextPanelView` | 14 | 14 | 0 | 14 |  |
| `@beep/dock` | `SplitLayout` | 13 | 13 | 0 | 13 |  |
| `@beep/dock` | `DockBox` | 12 | 10 | 2 | 12 |  |
| `@beep/dock` | `MovePanelCommand` | 11 | 9 | 2 | 10 | MovePanelCommandSchema:1 |
| `@beep/dock` | `TabPlacement` | 9 | 9 | 0 | 9 |  |
| `@beep/dock` | `ActivatePanelCommand` | 8 | 7 | 1 | 8 |  |
| `@beep/dock` | `makeDockAtoms` | 8 | 7 | 1 | 8 |  |
| `@beep/dock` | `OpenPanelCommand` | 8 | 8 | 0 | 8 |  |
| `@beep/dock` | `TopLeftAnchoredBox` | 8 | 8 | 0 | 8 |  |
| `@beep/dock` | `DockEngineLive` | 7 | 7 | 0 | 7 |  |
| `@beep/dock` | `DockMutationOutcome` | 7 | 1 | 6 | 7 |  |
| `@beep/dock` | `HorizontalSplitLayout` | 7 | 7 | 0 | 7 |  |
| `@beep/dock` | `RendererKey` | 7 | 7 | 0 | 7 |  |
| `@beep/dock` | `AnchoredBox` | 6 | 3 | 3 | 6 |  |
| `@beep/dock` | `ComponentPanelView` | 6 | 6 | 0 | 6 |  |
| `@beep/dock` | `DockChanged` | 6 | 1 | 5 | 6 |  |
| `@beep/dock` | `DockEngine` | 6 | 6 | 0 | 6 |  |
| `@beep/dock` | `DockMutationResult` | 6 | 6 | 0 | 6 |  |
| `@beep/dock` | `FloatingMember` | 6 | 6 | 0 | 6 |  |
| `@beep/dock` | `ClosePanelCommand` | 5 | 4 | 1 | 5 |  |
| `@beep/dock` | `CommandId` | 5 | 5 | 0 | 5 |  |
| `@beep/dock` | `DockCommandEnvelope` | 5 | 5 | 0 | 5 |  |
| `@beep/dock` | `GeometryOptions` | 5 | 5 | 0 | 5 |  |
| `@beep/dock` | `ResizeSplitCommand` | 5 | 4 | 1 | 5 |  |
| `@beep/dock` | `RootSplitPlacement` | 5 | 5 | 0 | 5 |  |
| `@beep/dock` | `TabChrome` | 5 | 4 | 1 | 5 |  |
| `@beep/dock` | `DispatchDockCommand` | 4 | 4 | 0 | 4 |  |
| `@beep/dock` | `GroupSplitPlacement` | 4 | 4 | 0 | 4 |  |
| `@beep/dock` | `MaximizeGroupCommand` | 4 | 3 | 1 | 4 |  |
| `@beep/dock` | `MoveGroupCommand` | 4 | 4 | 0 | 4 |  |
| `@beep/dock` | `PanelConstraints` | 4 | 4 | 0 | 4 |  |
| `@beep/dock` | `SplitPlacement` | 4 | 4 | 0 | 4 |  |
| `@beep/dock` | `ApiCommandOrigin` | 3 | 3 | 0 | 3 |  |
| `@beep/dock` | `DockAtomOperation` | 3 | 0 | 3 | 3 |  |
| `@beep/dock` | `DockFloatingGroupCommand` | 3 | 2 | 1 | 3 |  |
| `@beep/dock` | `DockGeometry` | 3 | 2 | 1 | 3 |  |
| `@beep/dock` | `DockSide` | 3 | 2 | 1 | 3 |  |
| `@beep/dock` | `EmptyWorkspace` | 3 | 3 | 0 | 3 |  |
| `@beep/dock` | `FloatGroupCommand` | 3 | 2 | 1 | 3 |  |
| `@beep/dock` | `GroupMetadata` | 3 | 3 | 0 | 3 |  |
| `@beep/dock` | `GroupPatch` | 3 | 3 | 0 | 3 |  |
| `@beep/dock` | `GroupRootSplitPlacement` | 3 | 3 | 0 | 3 |  |
| `@beep/dock` | `makeDockGeometryAtoms` | 3 | 3 | 0 | 3 |  |
| `@beep/dock` | `MoveFloatingGroupCommand` | 3 | 2 | 1 | 3 |  |
| `@beep/dock` | `project` | 3 | 3 | 0 | 3 |  |
| `@beep/dock` | `projectWorkspace` | 3 | 3 | 0 | 3 |  |
| `@beep/dock` | `RestoreMaximizedCommand` | 3 | 2 | 1 | 3 |  |
| `@beep/dock` | `RestoreSnapshotRequest` | 3 | 3 | 0 | 3 |  |
| `@beep/dock` | `RootPlacement` | 3 | 3 | 0 | 3 |  |
| `@beep/dock` | `SaveDockSnapshot` | 3 | 3 | 0 | 3 |  |
| `@beep/dock` | `UpdateGroupCommand` | 3 | 3 | 0 | 3 |  |
| `@beep/dock` | `UserCommandOrigin` | 3 | 3 | 0 | 3 |  |
| `@beep/dock` | `VerticalSplitLayout` | 3 | 3 | 0 | 3 |  |
| `@beep/dock` | `ClearWorkspaceCommand` | 2 | 2 | 0 | 2 |  |
| `@beep/dock` | `DockSnapshot` | 2 | 2 | 0 | 2 |  |
| `@beep/dock` | `makeDockAtomsWith` | 2 | 2 | 0 | 2 |  |
| `@beep/dock` | `makeTitleMinimaAtom` | 2 | 2 | 0 | 2 |  |
| `@beep/dock` | `PanelView` | 2 | 2 | 0 | 2 |  |
| `@beep/dock` | `RestoreDockSnapshot` | 2 | 2 | 0 | 2 |  |
| `@beep/dock` | `BottomRightAnchoredBox` | 1 | 1 | 0 | 1 |  |
| `@beep/dock` | `DispatchUnknownDockCommand` | 1 | 1 | 0 | 1 |  |
| `@beep/dock` | `DockAtomFeedEntry` | 1 | 0 | 1 | 1 |  |
| `@beep/dock` | `DockAtomFeedSuccess` | 1 | 1 | 0 | 1 |  |
| `@beep/dock` | `DockCommand` | 1 | 0 | 1 | 1 |  |
| `@beep/dock` | `DockCommandPolicy` | 1 | 0 | 1 | 1 |  |
| `@beep/dock` | `DockEvent` | 1 | 0 | 1 | 1 |  |
| `@beep/dock` | `DockMoveTarget` | 1 | 1 | 0 | 1 |  |
| `@beep/dock` | `DockMutationCompleted` | 1 | 1 | 0 | 1 |  |
| `@beep/dock` | `DockPersistenceError` | 1 | 1 | 0 | 1 |  |
| `@beep/dock` | `DockPersistenceOperation` | 1 | 0 | 1 | 1 |  |
| `@beep/dock` | `DockSnapshotSaved` | 1 | 1 | 0 | 1 |  |
| `@beep/dock` | `DockSnapshotStore` | 1 | 1 | 0 | 1 |  |
| `@beep/dock` | `DockUnchanged` | 1 | 1 | 0 | 1 |  |
| `@beep/dock` | `GroupMinimaRecord` | 1 | 0 | 1 | 1 |  |
| `@beep/dock` | `GroupUpdatedEvent` | 1 | 1 | 0 | 1 |  |
| `@beep/dock` | `lockedGroupsPolicy` | 1 | 1 | 0 | 1 |  |
| `@beep/dock` | `makeDockSnapshotStoreMemory` | 1 | 1 | 0 | 1 |  |
| `@beep/dock` | `makeMruGroupsAtom` | 1 | 1 | 0 | 1 |  |
| `@beep/dock` | `makePolicyDockEngineLayer` | 1 | 1 | 0 | 1 |  |
| `@beep/dock` | `PanelOpenedEvent` | 1 | 1 | 0 | 1 |  |
| `@beep/dock` | `PanelParameters` | 1 | 0 | 1 | 1 |  |
| `@beep/dock` | `PanelPatch` | 1 | 1 | 0 | 1 |  |
| `@beep/dock` | `resolveAnchoredBox` | 1 | 1 | 0 | 1 |  |
| `@beep/dock` | `titleMinima` | 1 | 1 | 0 | 1 |  |
| `@beep/dock` | `titleWords` | 1 | 1 | 0 | 1 |  |
| `@beep/dock` | `touchedGroups` | 1 | 1 | 0 | 1 |  |
| `@beep/dock` | `touchedGroupsInEvents` | 1 | 1 | 0 | 1 |  |
| `@beep/dock` | `UpdatePanelCommand` | 1 | 1 | 0 | 1 |  |
| `@beep/dock` | `validateWorkspace` | 1 | 1 | 0 | 1 |  |
| `@beep/dock-react` | `DockviewReact` | 7 | 7 | 0 | 7 |  |
| `@beep/dock-react` | `DockAtomGraph` | 4 | 0 | 4 | 4 |  |
| `@beep/dock-react` | `DockPanelProps` | 4 | 0 | 4 | 4 |  |
| `@beep/dock-react` | `DockRenderer` | 3 | 0 | 3 | 3 |  |
| `@beep/dock-react` | `DockviewAdapterApi` | 3 | 0 | 3 | 3 |  |
| `@beep/dock-react` | `DockTabProps` | 1 | 0 | 1 | 1 |  |
| `@beep/dock-react` | `DockviewReactProps` | 1 | 0 | 1 | 1 |  |
| `@beep/file-processing` | `PathSafety` | 2 | 2 | 0 | 2 |  |
| `@beep/html` | `conform` | 5 | 5 | 0 | 5 |  |
| `@beep/html` | `inspectConformance` | 5 | 5 | 0 | 5 |  |
| `@beep/html` | `serialize` | 4 | 4 | 0 | 4 |  |
| `@beep/html` | `enforceSafeHtml` | 3 | 3 | 0 | 3 |  |
| `@beep/html` | `inspectSafeHtml` | 3 | 3 | 0 | 3 |  |
| `@beep/html` | `SafeHtml` | 3 | 1 | 2 | 3 |  |
| `@beep/html` | `serializeSafe` | 3 | 3 | 0 | 3 |  |
| `@beep/html` | `untrustedHtmlValue` | 3 | 3 | 0 | 3 |  |
| `@beep/html` | `BooleanAttribute` | 2 | 2 | 0 | 2 |  |
| `@beep/html` | `ConformantHtml` | 2 | 1 | 1 | 2 |  |
| `@beep/html` | `conformantRoot` | 2 | 2 | 0 | 2 |  |
| `@beep/html` | `ELEMENT_META` | 2 | 2 | 0 | 2 |  |
| `@beep/html` | `GlobalAttributesStruct` | 2 | 2 | 0 | 2 |  |
| `@beep/html` | `HtmlFragment` | 2 | 2 | 0 | 2 |  |
| `@beep/html` | `SafeHtmlAst` | 2 | 1 | 1 | 2 |  |
| `@beep/html` | `safeHtmlValue` | 2 | 2 | 0 | 2 |  |
| `@beep/html` | `AutocompleteAttribute` | 1 | 1 | 0 | 1 |  |
| `@beep/html` | `Comment` | 1 | 1 | 0 | 1 |  |
| `@beep/html` | `DatasetKey` | 1 | 1 | 0 | 1 |  |
| `@beep/html` | `Doctype` | 1 | 1 | 0 | 1 |  |
| `@beep/html` | `HeadingOffset` | 1 | 1 | 0 | 1 |  |
| `@beep/html` | `Html` | 1 | 1 | 0 | 1 |  |
| `@beep/html` | `HTML_ATTRIBUTE_SYNTAXES` | 1 | 1 | 0 | 1 |  |
| `@beep/html` | `HtmlChildNode` | 1 | 0 | 1 | 1 |  |
| `@beep/html` | `HtmlCommentData` | 1 | 1 | 0 | 1 |  |
| `@beep/html` | `HtmlDocument` | 1 | 1 | 0 | 1 |  |
| `@beep/html` | `HtmlElementMeta` | 1 | 1 | 0 | 1 |  |
| `@beep/html` | `HtmlFiniteNumber` | 1 | 1 | 0 | 1 |  |
| `@beep/html` | `HtmlIdValue` | 1 | 1 | 0 | 1 |  |
| `@beep/html` | `HtmlNode` | 1 | 1 | 0 | 1 |  |
| `@beep/html` | `HtmlNonNegativeInteger` | 1 | 1 | 0 | 1 |  |
| `@beep/html` | `HtmlNonNegativeNumber` | 1 | 1 | 0 | 1 |  |
| `@beep/html` | `HtmlPositiveInteger` | 1 | 1 | 0 | 1 |  |
| `@beep/html` | `HtmlPositiveNumber` | 1 | 1 | 0 | 1 |  |
| `@beep/html` | `makeAsciiCaseInsensitiveEnumerated` | 1 | 1 | 0 | 1 |  |
| `@beep/html` | `makeSpaceSeparatedTokenList` | 1 | 1 | 0 | 1 |  |
| `@beep/html` | `Popover` | 1 | 1 | 0 | 1 |  |
| `@beep/html` | `safeHtmlAstConformant` | 1 | 1 | 0 | 1 |  |
| `@beep/html` | `safeHtmlAstRoot` | 1 | 1 | 0 | 1 |  |
| `@beep/html` | `SafeImageUrlAttribute` | 1 | 1 | 0 | 1 |  |
| `@beep/html` | `SafeUrlAttribute` | 1 | 1 | 0 | 1 |  |
| `@beep/html` | `serializeConformant` | 1 | 1 | 0 | 1 |  |
| `@beep/html` | `Text` | 1 | 1 | 0 | 1 |  |
| `@beep/identity` | `$ScratchpadId` | 147 | 147 | 0 | 147 |  |
| `@beep/identity` | `$SchemaId` | 73 | 73 | 0 | 73 |  |
| `@beep/identity` | `$LawPracticeDomainId` | 47 | 47 | 0 | 47 |  |
| `@beep/identity` | `$NlpProcessingId` | 38 | 38 | 0 | 38 |  |
| `@beep/identity` | `$GovinfoId` | 16 | 16 | 0 | 16 |  |
| `@beep/identity` | `$RepoConfigsId` | 15 | 15 | 0 | 15 |  |
| `@beep/identity` | `$NlpId` | 13 | 13 | 0 | 13 |  |
| `@beep/identity` | `CoreVocab` | 12 | 12 | 0 | 12 |  |
| `@beep/identity` | `$FileProcessingId` | 11 | 11 | 0 | 11 |  |
| `@beep/identity` | `$HtmlId` | 11 | 11 | 0 | 11 |  |
| `@beep/identity` | `$LangExtractId` | 11 | 11 | 0 | 11 |  |
| `@beep/identity` | `$UiId` | 11 | 11 | 0 | 11 |  |
| `@beep/identity` | `$WinkId` | 11 | 11 | 0 | 11 |  |
| `@beep/identity` | `$EditorId` | 8 | 8 | 0 | 8 |  |
| `@beep/identity` | `$PacerId` | 8 | 8 | 0 | 8 |  |
| `@beep/identity` | `$ProfessionalDesktopId` | 8 | 8 | 0 | 8 |  |
| `@beep/identity` | `$SharedDomainId` | 8 | 8 | 0 | 8 |  |
| `@beep/identity` | `$AcpId` | 7 | 7 | 0 | 7 |  |
| `@beep/identity` | `$RunpodId` | 7 | 7 | 0 | 7 |  |
| `@beep/identity` | `make` | 7 | 7 | 0 | 7 |  |
| `@beep/identity` | `$AiProviderCliId` | 6 | 6 | 0 | 6 |  |
| `@beep/identity` | `$BoxId` | 6 | 6 | 0 | 6 |  |
| `@beep/identity` | `$NlpMcpId` | 6 | 6 | 0 | 6 |  |
| `@beep/identity` | `$OpenclawId` | 6 | 6 | 0 | 6 |  |
| `@beep/identity` | `$XaiId` | 6 | 6 | 0 | 6 |  |
| `@beep/identity` | `$EcfrId` | 5 | 5 | 0 | 5 |  |
| `@beep/identity` | `$M365Id` | 5 | 5 | 0 | 5 |  |
| `@beep/identity` | `$PandocAstId` | 5 | 5 | 0 | 5 |  |
| `@beep/identity` | `IdentityComposer` | 5 | 0 | 5 | 5 | IdentityComposerType:1 |
| `@beep/identity` | `$LibpffId` | 4 | 4 | 0 | 4 |  |
| `@beep/identity` | `$MdId` | 4 | 4 | 0 | 4 |  |
| `@beep/identity` | `$PhoenixId` | 4 | 4 | 0 | 4 |  |
| `@beep/identity` | `$PostgresId` | 4 | 4 | 0 | 4 |  |
| `@beep/identity` | `$TikaId` | 4 | 4 | 0 | 4 |  |
| `@beep/identity` | `$UsptoId` | 4 | 4 | 0 | 4 |  |
| `@beep/identity` | `$AnthropicId` | 3 | 3 | 0 | 3 |  |
| `@beep/identity` | `$ColorsId` | 3 | 3 | 0 | 3 |  |
| `@beep/identity` | `$DiscordId` | 3 | 3 | 0 | 3 |  |
| `@beep/identity` | `$HubspotId` | 3 | 3 | 0 | 3 |  |
| `@beep/identity` | `$OnepasswordCliId` | 3 | 3 | 0 | 3 |  |
| `@beep/identity` | `$OpenaiCompatId` | 3 | 3 | 0 | 3 |  |
| `@beep/identity` | `$SanityId` | 3 | 3 | 0 | 3 |  |
| `@beep/identity` | `$VeniceAiId` | 3 | 3 | 0 | 3 |  |
| `@beep/identity` | `contractOption` | 3 | 3 | 0 | 3 |  |
| `@beep/identity` | `expandOption` | 3 | 3 | 0 | 3 |  |
| `@beep/identity` | `expandPredicate` | 3 | 3 | 0 | 3 |  |
| `@beep/identity` | `prefixedNameOrIri` | 3 | 3 | 0 | 3 |  |
| `@beep/identity` | `SafePnLocal` | 3 | 3 | 0 | 3 |  |
| `@beep/identity` | `$ApiTransportId` | 2 | 2 | 0 | 2 |  |
| `@beep/identity` | `$DockReactId` | 2 | 2 | 0 | 2 |  |
| `@beep/identity` | `$DrizzleId` | 2 | 2 | 0 | 2 |  |
| `@beep/identity` | `$OipWebId` | 2 | 2 | 0 | 2 |  |
| `@beep/identity` | `$RepoCliId` | 2 | 2 | 0 | 2 |  |
| `@beep/identity` | `$RepoUtilsId` | 2 | 2 | 0 | 2 |  |
| `@beep/identity` | `$TailscaleId` | 2 | 2 | 0 | 2 |  |
| `@beep/identity` | `$WorkspaceServerId` | 2 | 2 | 0 | 2 |  |
| `@beep/identity` | `acceptsEscapedLocal` | 2 | 2 | 0 | 2 |  |
| `@beep/identity` | `Curie` | 2 | 0 | 2 | 2 |  |
| `@beep/identity` | `escapeLocal` | 2 | 2 | 0 | 2 |  |
| `@beep/identity` | `expand` | 2 | 2 | 0 | 2 |  |
| `@beep/identity` | `IdentityAnyAnnotationExtras` | 2 | 0 | 2 | 2 |  |
| `@beep/identity` | `isSafeLocal` | 2 | 2 | 0 | 2 |  |
| `@beep/identity` | `KeyAnnotationExtras` | 2 | 0 | 2 | 2 |  |
| `@beep/identity` | `mergeVocab` | 2 | 2 | 0 | 2 |  |
| `@beep/identity` | `Predicate` | 2 | 0 | 2 | 2 |  |
| `@beep/identity` | `SegmentValue` | 2 | 0 | 2 | 2 |  |
| `@beep/identity` | `unescapeLocal` | 2 | 2 | 0 | 2 |  |
| `@beep/identity` | `VocabShape` | 2 | 0 | 2 | 2 |  |
| `@beep/identity` | `$AgentsClientId` | 1 | 1 | 0 | 1 |  |
| `@beep/identity` | `$AgentsServerId` | 1 | 1 | 0 | 1 |  |
| `@beep/identity` | `$LawPracticeUseCasesId` | 1 | 1 | 0 | 1 |  |
| `@beep/identity` | `$OntologyId` | 1 | 1 | 0 | 1 |  |
| `@beep/identity` | `$PgliteId` | 1 | 1 | 0 | 1 |  |
| `@beep/identity` | `$RepoDocgenId` | 1 | 1 | 0 | 1 |  |
| `@beep/identity` | `BaseIdentityInput` | 1 | 1 | 0 | 1 |  |
| `@beep/identity` | `contract` | 1 | 1 | 0 | 1 |  |
| `@beep/identity` | `CurieFromIdentity` | 1 | 0 | 1 | 1 |  |
| `@beep/identity` | `CurieFromIri` | 1 | 1 | 0 | 1 |  |
| `@beep/identity` | `DeclarationAnnotationExtras` | 1 | 0 | 1 | 1 |  |
| `@beep/identity` | `EscapedPnLocal` | 1 | 1 | 0 | 1 |  |
| `@beep/identity` | `Expand` | 1 | 0 | 1 | 1 |  |
| `@beep/identity` | `HttpApiEncoding` | 1 | 0 | 1 | 1 |  |
| `@beep/identity` | `IdentityString` | 1 | 0 | 1 | 1 |  |
| `@beep/identity` | `IdentitySymbol` | 1 | 0 | 1 | 1 |  |
| `@beep/identity` | `IriFromIdentity` | 1 | 0 | 1 | 1 |  |
| `@beep/identity` | `isSafePrefix` | 1 | 1 | 0 | 1 |  |
| `@beep/identity` | `ModuleSegmentValue` | 1 | 0 | 1 | 1 |  |
| `@beep/identity` | `SafePnPrefix` | 1 | 1 | 0 | 1 |  |
| `@beep/identity` | `SemanticFoundationVocab` | 1 | 1 | 0 | 1 |  |
| `@beep/identity` | `SkosClassification` | 1 | 0 | 1 | 1 | SkosClassificationMarker:1 |
| `@beep/identity` | `SlugFromIdentifier` | 1 | 0 | 1 | 1 |  |
| `@beep/identity` | `TitleFromIdentifier` | 1 | 0 | 1 | 1 |  |
| `@beep/identity` | `VocabRegistry` | 1 | 1 | 0 | 1 |  |
| `@beep/lexical-schema` | `SerializedEditorState` | 13 | 5 | 8 | 13 |  |
| `@beep/lexical-schema` | `documentToEditorState` | 12 | 12 | 0 | 12 |  |
| `@beep/lexical-schema` | `EditorStateFromJson` | 4 | 4 | 0 | 4 |  |
| `@beep/lexical-schema` | `ARTIFACT_URI_PREFIX` | 3 | 3 | 0 | 3 |  |
| `@beep/lexical-schema` | `editorStateToDocument` | 2 | 2 | 0 | 2 |  |
| `@beep/lexical-schema` | `ElementFormat` | 2 | 2 | 0 | 2 |  |
| `@beep/lexical-schema` | `LexicalNode` | 2 | 2 | 0 | 2 |  |
| `@beep/lexical-schema` | `RootNode` | 2 | 2 | 0 | 2 |  |
| `@beep/lexical-schema` | `TextFormatBits` | 2 | 2 | 0 | 2 |  |
| `@beep/lexical-schema` | `TextFormatMask` | 2 | 2 | 0 | 2 |  |
| `@beep/lexical-schema` | `YouTubeNode` | 2 | 2 | 0 | 2 | YouTubeNodeSchema:2 |
| `@beep/lexical-schema` | `analyzeEditorStateCompatibility` | 1 | 1 | 0 | 1 |  |
| `@beep/lexical-schema` | `ArtifactRefNode` | 1 | 1 | 0 | 1 | ArtifactRefNodeSchema:1 |
| `@beep/lexical-schema` | `ArtifactUri` | 1 | 1 | 0 | 1 |  |
| `@beep/lexical-schema` | `blockToLexical` | 1 | 1 | 0 | 1 |  |
| `@beep/lexical-schema` | `decodeEditorStateLossless` | 1 | 1 | 0 | 1 |  |
| `@beep/lexical-schema` | `decodeEditorStateStrict` | 1 | 1 | 0 | 1 |  |
| `@beep/lexical-schema` | `editorStateToPlainText` | 1 | 1 | 0 | 1 |  |
| `@beep/lexical-schema` | `EditorStateWireFromJson` | 1 | 1 | 0 | 1 |  |
| `@beep/lexical-schema` | `hasTextFormat` | 1 | 1 | 0 | 1 |  |
| `@beep/lexical-schema` | `LinkNode` | 1 | 1 | 0 | 1 |  |
| `@beep/lexical-schema` | `ListNode` | 1 | 1 | 0 | 1 |  |
| `@beep/lexical-schema` | `ListTag` | 1 | 1 | 0 | 1 |  |
| `@beep/lexical-schema` | `ListType` | 1 | 1 | 0 | 1 |  |
| `@beep/lexical-schema` | `nodeToBlocks` | 1 | 1 | 0 | 1 |  |
| `@beep/lexical-schema` | `nodeToPlainText` | 1 | 1 | 0 | 1 |  |
| `@beep/lexical-schema` | `SafeUrl` | 1 | 1 | 0 | 1 |  |
| `@beep/lexical-schema` | `SerializedEditorStateWire` | 1 | 1 | 0 | 1 |  |
| `@beep/lexical-schema` | `TableCellHeaderState` | 1 | 0 | 1 | 1 |  |
| `@beep/lexical-schema` | `TableCellNode` | 1 | 1 | 0 | 1 |  |
| `@beep/lexical-schema` | `TableNode` | 1 | 1 | 0 | 1 |  |
| `@beep/lexical-schema` | `TableRowNode` | 1 | 1 | 0 | 1 |  |
| `@beep/lexical-schema` | `TextDetailMask` | 1 | 1 | 0 | 1 |  |
| `@beep/lexical-schema` | `TextNode` | 1 | 1 | 0 | 1 |  |
| `@beep/lexical-schema` | `withTextFormat` | 1 | 1 | 0 | 1 |  |
| `@beep/mcp-kit` | `sanitizedToolkit` | 12 | 12 | 0 | 12 |  |
| `@beep/mcp-kit` | `TierGate` | 7 | 7 | 0 | 7 |  |
| `@beep/mcp-kit` | `annotateFourHints` | 6 | 6 | 0 | 6 |  |
| `@beep/mcp-kit` | `composeGatedLayers` | 6 | 6 | 0 | 6 |  |
| `@beep/mcp-kit` | `gatedLayer` | 6 | 6 | 0 | 6 |  |
| `@beep/mcp-kit` | `CurrentMcpCaller` | 5 | 5 | 0 | 5 |  |
| `@beep/mcp-kit` | `readOnlyToolHints` | 5 | 5 | 0 | 5 |  |
| `@beep/mcp-kit` | `SourceAuthRegistration` | 5 | 5 | 0 | 5 |  |
| `@beep/mcp-kit` | `dispatchWithTierGate` | 4 | 4 | 0 | 4 |  |
| `@beep/mcp-kit` | `FetchableHandle` | 4 | 4 | 0 | 4 |  |
| `@beep/mcp-kit` | `ColumnarEnvelope` | 3 | 3 | 0 | 3 |  |
| `@beep/mcp-kit` | `defineFieldTiers` | 3 | 3 | 0 | 3 |  |
| `@beep/mcp-kit` | `estimateJsonSize` | 3 | 3 | 0 | 3 |  |
| `@beep/mcp-kit` | `FieldTierName` | 3 | 3 | 0 | 3 |  |
| `@beep/mcp-kit` | `McpCallerIdentity` | 3 | 2 | 1 | 3 |  |
| `@beep/mcp-kit` | `projectFieldTier` | 3 | 3 | 0 | 3 |  |
| `@beep/mcp-kit` | `TierGateAuditRecord` | 3 | 3 | 0 | 3 |  |
| `@beep/mcp-kit` | `TierGateSettlement` | 3 | 2 | 1 | 3 |  |
| `@beep/mcp-kit` | `TierGateVerdict` | 3 | 3 | 0 | 3 |  |
| `@beep/mcp-kit` | `toColumnarEnvelope` | 3 | 3 | 0 | 3 |  |
| `@beep/mcp-kit` | `apiKeyRequiredFailure` | 2 | 2 | 0 | 2 |  |
| `@beep/mcp-kit` | `ApiKeyRequiredFailure` | 2 | 2 | 0 | 2 |  |
| `@beep/mcp-kit` | `resolveSourceCredential` | 2 | 2 | 0 | 2 |  |
| `@beep/mcp-kit` | `TierGateShape` | 2 | 0 | 2 | 2 |  |
| `@beep/mcp-kit` | `destructiveWriteToolHints` | 1 | 1 | 0 | 1 |  |
| `@beep/mcp-kit` | `FieldProjectionOutcome` | 1 | 1 | 0 | 1 |  |
| `@beep/mcp-kit` | `FieldTierSet` | 1 | 0 | 1 | 1 |  |
| `@beep/mcp-kit` | `FourHintAnnotations` | 1 | 1 | 0 | 1 |  |
| `@beep/mcp-kit` | `fromApprovedToolsPolicy` | 1 | 1 | 0 | 1 |  |
| `@beep/mcp-kit` | `OversizedFieldProjection` | 1 | 1 | 0 | 1 |  |
| `@beep/mcp-kit` | `projectWithinBudget` | 1 | 1 | 0 | 1 |  |
| `@beep/mcp-kit` | `sanitizeTracerAttributes` | 1 | 1 | 0 | 1 |  |
| `@beep/mcp-kit` | `TierGateDispatchResult` | 1 | 1 | 0 | 1 |  |
| `@beep/mcp-kit` | `TierGatePolicy` | 1 | 1 | 0 | 1 |  |
| `@beep/mcp-kit` | `ToolCallRequest` | 1 | 0 | 1 | 1 |  |
| `@beep/mcp-kit` | `withSanitizedToolSpan` | 1 | 1 | 0 | 1 |  |
| `@beep/md` | `Document` | 4 | 4 | 0 | 4 |  |
| `@beep/md` | `Md` | 3 | 3 | 0 | 3 |  |
| `@beep/md` | `P` | 3 | 3 | 0 | 3 |  |
| `@beep/md` | `Text` | 3 | 3 | 0 | 3 |  |
| `@beep/md` | `decodeSafeDocumentUnsafe` | 2 | 2 | 0 | 2 |  |
| `@beep/md` | `RenderError` | 1 | 0 | 1 | 1 |  |
| `@beep/observability` | `LogRedactedCauseOptions` | 21 | 21 | 0 | 21 |  |
| `@beep/observability` | `logRedactedCause` | 20 | 20 | 0 | 20 |  |
| `@beep/observability` | `observeWorkflow` | 7 | 7 | 0 | 7 |  |
| `@beep/observability` | `redactCauseForClient` | 7 | 7 | 0 | 7 |  |
| `@beep/observability` | `profilePhase` | 5 | 5 | 0 | 5 |  |
| `@beep/observability` | `summarizeCause` | 5 | 5 | 0 | 5 |  |
| `@beep/observability` | `PrettyLoggerConfig` | 4 | 4 | 0 | 4 |  |
| `@beep/observability` | `renderLogBanner` | 4 | 4 | 0 | 4 |  |
| `@beep/observability` | `LoggingConfig` | 2 | 2 | 0 | 2 |  |
| `@beep/observability` | `redactString` | 2 | 2 | 0 | 2 |  |
| `@beep/observability` | `sanitizeSensitiveText` | 2 | 2 | 0 | 2 |  |
| `@beep/observability` | `statusClass` | 2 | 2 | 0 | 2 |  |
| `@beep/observability` | `summarizeExit` | 2 | 2 | 0 | 2 |  |
| `@beep/observability` | `tapRedactedCause` | 2 | 2 | 0 | 2 |  |
| `@beep/observability` | `trackDuration` | 2 | 2 | 0 | 2 |  |
| `@beep/observability` | `classifyCause` | 1 | 1 | 0 | 1 |  |
| `@beep/observability` | `fingerprintCause` | 1 | 1 | 0 | 1 |  |
| `@beep/observability` | `layerMinimumLogLevel` | 1 | 1 | 0 | 1 |  |
| `@beep/observability` | `makeInternalServerError` | 1 | 1 | 0 | 1 |  |
| `@beep/observability` | `makeNotFoundError` | 1 | 1 | 0 | 1 |  |
| `@beep/observability` | `makeTooManyRequestsError` | 1 | 1 | 0 | 1 |  |
| `@beep/observability` | `measureElapsedMillis` | 1 | 1 | 0 | 1 |  |
| `@beep/observability` | `ObservabilityCoreConfig` | 1 | 0 | 1 | 1 |  |
| `@beep/observability` | `ObservedCause` | 1 | 1 | 0 | 1 |  |
| `@beep/observability` | `ObservedExit` | 1 | 1 | 0 | 1 |  |
| `@beep/observability` | `observeHttpRequest` | 1 | 1 | 0 | 1 |  |
| `@beep/observability` | `PhaseProfile` | 1 | 1 | 0 | 1 |  |
| `@beep/observability` | `redactCause` | 1 | 1 | 0 | 1 |  |
| `@beep/observability` | `redactCauseEffect` | 1 | 1 | 0 | 1 |  |
| `@beep/observability` | `RedactCauseOptions` | 1 | 1 | 0 | 1 |  |
| `@beep/observability` | `redactCauseSummary` | 1 | 1 | 0 | 1 |  |
| `@beep/observability` | `RenderLogBannerOptions` | 1 | 1 | 0 | 1 |  |
| `@beep/observability` | `renderObservedCause` | 1 | 1 | 0 | 1 |  |
| `@beep/observability` | `TrackDurationOptions` | 1 | 1 | 0 | 1 |  |
| `@beep/observability` | `VERSION` | 1 | 1 | 0 | 1 |  |
| `@beep/ontology` | `AssembledClass` | 1 | 0 | 1 | 1 |  |
| `@beep/ontology` | `AssembledPredicate` | 1 | 0 | 1 | 1 |  |
| `@beep/ontology` | `DocumentClass` | 1 | 1 | 0 | 1 |  |
| `@beep/ontology` | `FilingSegment` | 1 | 1 | 0 | 1 |  |
| `@beep/ontology` | `fold` | 1 | 1 | 0 | 1 |  |
| `@beep/ontology` | `getOntologyKeyMetadata` | 1 | 1 | 0 | 1 |  |
| `@beep/ontology` | `getOntologyMetadata` | 1 | 1 | 0 | 1 |  |
| `@beep/ontology` | `isFilingSegment` | 1 | 1 | 0 | 1 |  |
| `@beep/ontology` | `isOntologyClassAnnotationDraft` | 1 | 1 | 0 | 1 |  |
| `@beep/ontology` | `isOntologyPredicateAnnotationDraft` | 1 | 1 | 0 | 1 |  |
| `@beep/ontology` | `LibrarianInput` | 1 | 1 | 0 | 1 |  |
| `@beep/ontology` | `Ontology` | 1 | 1 | 0 | 1 |  |
| `@beep/ontology` | `OntologyAssemblyError` | 1 | 1 | 0 | 1 |  |
| `@beep/ontology` | `parseJsonLdOntology` | 1 | 1 | 0 | 1 |  |
| `@beep/ontology` | `projectJsonLdContext` | 1 | 1 | 0 | 1 |  |
| `@beep/ontology` | `projectJsonLdOntology` | 1 | 1 | 0 | 1 |  |
| `@beep/ontology` | `projectMarkdown` | 1 | 1 | 0 | 1 |  |
| `@beep/ontology` | `projectTurtle` | 1 | 1 | 0 | 1 |  |
| `@beep/ontology` | `runLibrarianLoop` | 1 | 1 | 0 | 1 |  |
| `@beep/ontology` | `SemanticFoundationSeed` | 1 | 1 | 0 | 1 |  |
| `@beep/ontology` | `TaxonomyLoader` | 1 | 1 | 0 | 1 |  |
| `@beep/ontology` | `TaxonomyManifestParseError` | 1 | 1 | 0 | 1 |  |
| `@beep/ontology` | `TaxonomyManifestReadError` | 1 | 1 | 0 | 1 |  |
| `@beep/ontology` | `TaxonomySeed` | 1 | 1 | 0 | 1 |  |
| `@beep/ontology` | `toContext` | 1 | 1 | 0 | 1 |  |
| `@beep/ontology` | `toJsonLd` | 1 | 1 | 0 | 1 |  |
| `@beep/ontology` | `toMarkdown` | 1 | 1 | 0 | 1 |  |
| `@beep/ontology` | `toTurtle` | 1 | 1 | 0 | 1 |  |
| `@beep/ontology` | `Triple` | 1 | 0 | 1 | 1 |  |
| `@beep/ontology` | `VendorManifestEntry` | 1 | 1 | 0 | 1 |  |
| `@beep/ontology` | `VendorSliceParseError` | 1 | 1 | 0 | 1 |  |
| `@beep/ontology` | `VendorSlicePathEscape` | 1 | 1 | 0 | 1 |  |
| `@beep/ontology` | `VendorSliceReadError` | 1 | 1 | 0 | 1 |  |
| `@beep/ontology` | `VendorSliceUnvetted` | 1 | 1 | 0 | 1 |  |
| `@beep/ontology` | `VERSION` | 1 | 1 | 0 | 1 |  |
| `@beep/provenance` | `TextAnchor` | 2 | 2 | 0 | 2 |  |
| `@beep/rdf` | `IRI` | 37 | 30 | 7 | 36 | IriValue:1 |
| `@beep/rdf` | `makeNamedNode` | 14 | 14 | 0 | 10 | makeCanonicalNamedNode:4 |
| `@beep/rdf` | `NamedNode` | 9 | 4 | 5 | 9 |  |
| `@beep/rdf` | `ObjectTerm` | 7 | 2 | 5 | 7 |  |
| `@beep/rdf` | `GraphTerm` | 6 | 0 | 6 | 6 |  |
| `@beep/rdf` | `makeLiteral` | 6 | 6 | 0 | 6 |  |
| `@beep/rdf` | `makeQuad` | 6 | 6 | 0 | 6 |  |
| `@beep/rdf` | `Quad` | 6 | 0 | 6 | 6 |  |
| `@beep/rdf` | `Subject` | 6 | 1 | 5 | 6 |  |
| `@beep/rdf` | `IRIReference` | 5 | 5 | 0 | 5 |  |
| `@beep/rdf` | `AbsoluteIRI` | 3 | 3 | 0 | 3 |  |
| `@beep/rdf` | `Literal` | 3 | 0 | 3 | 3 |  |
| `@beep/rdf` | `makeBlankNode` | 2 | 2 | 0 | 2 |  |
| `@beep/rdf` | `BlankNode` | 1 | 0 | 1 | 1 | BlankNodeType:1 |
| `@beep/rdf` | `URI` | 1 | 1 | 0 | 1 |  |
| `@beep/schema` | `SchemaUtils` | 549 | 549 | 0 | 549 |  |
| `@beep/schema` | `LiteralKit` | 465 | 464 | 1 | 464 | LiteralKitSchema:1 |
| `@beep/schema` | `NonNegativeInt` | 293 | 291 | 2 | 293 |  |
| `@beep/schema` | `PosInt` | 71 | 71 | 0 | 71 |  |
| `@beep/schema` | `UnknownRecord` | 32 | 25 | 7 | 32 |  |
| `@beep/schema` | `Sha256Hex` | 31 | 30 | 1 | 31 |  |
| `@beep/schema` | `URLStr` | 25 | 25 | 0 | 25 |  |
| `@beep/schema` | `Fn` | 20 | 20 | 0 | 20 |  |
| `@beep/schema` | `normalizePath` | 17 | 17 | 0 | 17 | normalizeSchemaPath:1 |
| `@beep/schema` | `Sha256HexFromBytes` | 17 | 17 | 0 | 17 |  |
| `@beep/schema` | `MappedLiteralKit` | 9 | 9 | 0 | 9 |  |
| `@beep/schema` | `NonNegNum` | 9 | 9 | 0 | 9 |  |
| `@beep/schema` | `NonEmptyTrimmedStr` | 7 | 7 | 0 | 7 |  |
| `@beep/schema` | `LogLevel` | 6 | 6 | 0 | 6 |  |
| `@beep/schema` | `MimeType` | 6 | 6 | 0 | 6 |  |
| `@beep/schema` | `EmailString` | 5 | 5 | 0 | 5 |  |
| `@beep/schema` | `JsonObject` | 5 | 3 | 2 | 5 |  |
| `@beep/schema` | `SafeObject` | 5 | 5 | 0 | 5 | SafeObjectSchema:1 |
| `@beep/schema` | `ArrayOfStrings` | 4 | 4 | 0 | 4 |  |
| `@beep/schema` | `EffectSchema` | 4 | 4 | 0 | 4 |  |
| `@beep/schema` | `HttpsUrl` | 4 | 4 | 0 | 4 |  |
| `@beep/schema` | `Markdown` | 4 | 3 | 1 | 4 |  |
| `@beep/schema` | `assertAllowedRemoteUrl` | 3 | 3 | 0 | 3 |  |
| `@beep/schema` | `ArrayOfNonEmptyStrings` | 2 | 2 | 0 | 2 |  |
| `@beep/schema` | `FilePath` | 2 | 2 | 0 | 2 |  |
| `@beep/schema` | `HtmlFragment` | 2 | 2 | 0 | 2 |  |
| `@beep/schema` | `KebabCaseStr` | 2 | 2 | 0 | 2 |  |
| `@beep/schema` | `MutableHashMapFromSelf` | 2 | 2 | 0 | 2 |  |
| `@beep/schema` | `PosixPath` | 2 | 2 | 0 | 2 | PosixPathSchema:1 |
| `@beep/schema` | `SemanticVersion` | 2 | 2 | 0 | 2 |  |
| `@beep/schema` | `TrimmedNonEmptyText` | 2 | 2 | 0 | 2 |  |
| `@beep/schema` | `VideoFileExtension` | 2 | 2 | 0 | 2 |  |
| `@beep/schema` | `assertAllowedRemoteHost` | 1 | 1 | 0 | 1 |  |
| `@beep/schema` | `AudioMimeType` | 1 | 1 | 0 | 1 |  |
| `@beep/schema` | `BlockedHostError` | 1 | 1 | 0 | 1 |  |
| `@beep/schema` | `decodeYamlTextAs` | 1 | 1 | 0 | 1 |  |
| `@beep/schema` | `DirectedGraph` | 1 | 1 | 0 | 1 |  |
| `@beep/schema` | `DurationInput` | 1 | 1 | 0 | 1 |  |
| `@beep/schema` | `extractMimeExtensions` | 1 | 1 | 0 | 1 |  |
| `@beep/schema` | `extractMimeTypes` | 1 | 1 | 0 | 1 |  |
| `@beep/schema` | `FileDiff` | 1 | 1 | 0 | 1 |  |
| `@beep/schema` | `HexColor` | 1 | 1 | 0 | 1 |  |
| `@beep/schema` | `HttpStatusCode` | 1 | 1 | 0 | 1 | RootHttpStatusCode:1 |
| `@beep/schema` | `ImageFileExtension` | 1 | 1 | 0 | 1 |  |
| `@beep/schema` | `ImageMimeType` | 1 | 1 | 0 | 1 |  |
| `@beep/schema` | `Int64` | 1 | 1 | 0 | 1 |  |
| `@beep/schema` | `isBlockedRemoteHost` | 1 | 1 | 0 | 1 |  |
| `@beep/schema` | `isPositive` | 1 | 1 | 0 | 1 |  |
| `@beep/schema` | `JSONSchema` | 1 | 1 | 0 | 1 |  |
| `@beep/schema` | `makeStatusCauseError` | 1 | 1 | 0 | 1 |  |
| `@beep/schema` | `NativePathToPosixPath` | 1 | 1 | 0 | 1 |  |
| `@beep/schema` | `NodeIndex` | 1 | 1 | 0 | 1 |  |
| `@beep/schema` | `OptionFromOptionalNullishKey` | 1 | 1 | 0 | 1 |  |
| `@beep/schema` | `PascalCaseStr` | 1 | 1 | 0 | 1 |  |
| `@beep/schema` | `Slug` | 1 | 1 | 0 | 1 |  |
| `@beep/schema` | `SnakeCaseStr` | 1 | 1 | 0 | 1 |  |
| `@beep/schema` | `StatusCauseFields` | 1 | 1 | 0 | 1 |  |
| `@beep/schema` | `StatusCauseInput` | 1 | 0 | 1 | 1 |  |
| `@beep/schema` | `TextMimeType` | 1 | 1 | 0 | 1 |  |
| `@beep/schema` | `YamlTextToUnknown` | 1 | 1 | 0 | 1 |  |
| `@beep/types` | `TUnsafe` | 6 | 0 | 6 | 6 |  |
| `@beep/types` | `TString` | 3 | 0 | 3 | 3 |  |
| `@beep/ui` | `VERSION` | 1 | 1 | 0 | 1 |  |
| `@beep/utils` | `A` | 674 | 673 | 1 | 674 |  |
| `@beep/utils` | `Str` | 398 | 398 | 0 | 398 |  |
| `@beep/utils` | `O` | 274 | 273 | 1 | 274 | OptionUtils:4, OU:1 |
| `@beep/utils` | `P` | 91 | 91 | 0 | 91 |  |
| `@beep/utils` | `thunkFalse` | 59 | 59 | 0 | 59 |  |
| `@beep/utils` | `pipe` | 43 | 43 | 0 | 43 |  |
| `@beep/utils` | `thunkEmptyStr` | 40 | 40 | 0 | 40 |  |
| `@beep/utils` | `R` | 35 | 33 | 2 | 35 |  |
| `@beep/utils` | `Struct` | 30 | 30 | 0 | 30 |  |
| `@beep/utils` | `Err` | 22 | 22 | 0 | 22 |  |
| `@beep/utils` | `N` | 19 | 19 | 0 | 19 |  |
| `@beep/utils` | `Text` | 14 | 14 | 0 | 14 |  |
| `@beep/utils` | `thunkEffectVoid` | 11 | 11 | 0 | 11 |  |
| `@beep/utils` | `thunkTrue` | 11 | 11 | 0 | 11 |  |
| `@beep/utils` | `thunkUndefined` | 11 | 11 | 0 | 11 |  |
| `@beep/utils` | `thunk0` | 10 | 10 | 0 | 10 |  |
| `@beep/utils` | `dual` | 9 | 9 | 0 | 9 |  |
| `@beep/utils` | `thunkNull` | 7 | 7 | 0 | 7 |  |
| `@beep/utils` | `flow` | 6 | 6 | 0 | 6 |  |
| `@beep/utils` | `Eq` | 5 | 5 | 0 | 5 |  |
| `@beep/utils` | `thunk` | 3 | 3 | 0 | 3 |  |
| `@beep/utils` | `thunkEmptyReadonlyArray` | 3 | 3 | 0 | 3 |  |
| `@beep/utils` | `thunkEmptyRecord` | 3 | 3 | 0 | 3 |  |
| `@beep/utils` | `DateTime` | 2 | 2 | 0 | 2 |  |
| `@beep/utils` | `FileSystem` | 2 | 2 | 0 | 2 |  |
| `@beep/utils` | `Html` | 2 | 2 | 0 | 2 |  |
| `@beep/utils` | `Path` | 2 | 2 | 0 | 2 |  |
| `@beep/utils` | `thunkEffectSucceedNull` | 2 | 2 | 0 | 2 |  |
| `@beep/utils` | `thunkEmptyReadonlyRecord` | 2 | 2 | 0 | 2 |  |
| `@beep/utils` | `Bool` | 1 | 1 | 0 | 1 |  |
| `@beep/utils` | `identity` | 1 | 1 | 0 | 1 |  |
| `@beep/utils` | `thunk1` | 1 | 1 | 0 | 1 |  |
| `@beep/utils` | `thunkEffectSucceed` | 1 | 1 | 0 | 1 |  |

## 2. Foundation package export surfaces

Every top-level workspace `exports` value is an unconditional string or `null`; **none uses condition objects**. A wildcard shown as `./* → ./src/*.ts` substitutes the whole matched remainder (including nested path segments) into a `.ts` target. `Explicit N` means the package enumerates N non-null public subpaths instead. Barrel structure is syntax-level: `star` is `export * from`, `ns` is `export * as`, `named` is the number of re-exported specifiers, and `local` is a declaration authored in the root index.

| Package | Root-barrel imports (files/statements; unique named) | Public subpaths | `sideEffects` | Barrel structure | Imported-binding readiness / enabling work | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| `@beep/api-transport` | 9/11; 5 | `./*` → `./src/*.ts` | `[]` | star 2; ns 0; named 0; local 1 | named clean 5/5; ready for named imports | packages/foundation/capability/api-transport/package.json:39; packages/foundation/capability/api-transport/package.json:52 |
| `@beep/chalk` | 4/6; 10 | `./*` → `./src/*.ts` | `[]` | star 1; ns 0; named 1; local 0 | named clean 10/10; ready; defaults → `@beep/chalk/Chalk` | packages/foundation/capability/chalk/package.json:33; packages/foundation/capability/chalk/package.json:52 |
| `@beep/colors` | 7/9; 5 | `./*` → `./src/*.ts` | `[]` | star 1; ns 0; named 1; local 0 | named clean 5/5; ready; defaults → `@beep/colors/Colors` | packages/foundation/capability/colors/package.json:33; packages/foundation/capability/colors/package.json:59 |
| `@beep/file-processing` | 2/2; 1 | `./*` → `./src/*.ts` | `[]` | star 0; ns 7; named 0; local 0 | named clean 1/1; ready for the one named binding | packages/foundation/capability/file-processing/package.json:39; packages/foundation/capability/file-processing/package.json:60 |
| `@beep/langextract` | 0/0; 0 | `./*` → `./src/*.ts` | `[]` | star 0; ns 6; named 0; local 0 | no current root imports | packages/foundation/capability/langextract/package.json:37; packages/foundation/capability/langextract/package.json:56 |
| `@beep/mcp-kit` | 34/38; 36 | `./*` → `./src/*.ts` | `[]` | star 8; ns 0; named 0; local 1 | named clean 36/36; ready for named imports | packages/foundation/capability/mcp-kit/package.json:39; packages/foundation/capability/mcp-kit/package.json:52 |
| `@beep/nlp-processing` | 0/0; 0 | explicit 11 | `[]` | star 0; ns 5; named 0; local 0 | no current root imports | packages/foundation/capability/nlp-processing/package.json:33; packages/foundation/capability/nlp-processing/package.json:56 |
| `@beep/observability` | 40/41; 35 | explicit 3 | `[]` | star 8; ns 0; named 0; local 1 | named clean 0/35; add public leaves for 34 routed symbols; move root-only `VERSION` to a leaf | packages/foundation/capability/observability/package.json:34; packages/foundation/capability/observability/package.json:49 |
| `@beep/semantic-web` | 1/1; 0 | `./*` → `./src/*.ts` | `[]` | star 3; ns 0; named 0; local 0 | one namespace surface-test import has no one-leaf equivalent | packages/foundation/capability/semantic-web/package.json:33; packages/foundation/capability/semantic-web/package.json:46 |
| `@beep/html` | 8/10; 43 | explicit 10 | `[]` | star 0; ns 8; named 74; local 2 | named clean 42/43; 42 named bindings ready; extract root-composed `Html` facade to a leaf | packages/foundation/modeling/html/package.json:39; packages/foundation/modeling/html/package.json:61 |
| `@beep/identity` | 585/594; 93 | `./*` → `./src/*.ts` | `[]` | star 5; ns 0; named 0; local 0 | named clean 93/93; named imports ready; one namespace surface import needs test redesign/waiver | packages/foundation/modeling/identity/package.json:36; packages/foundation/modeling/identity/package.json:56 |
| `@beep/lexical-schema` | 27/32; 35 | explicit 4 | `[]` | star 0; ns 0; named 64; local 1 | named clean 35/35; ready through explicit leaves | packages/foundation/modeling/lexical/package.json:39; packages/foundation/modeling/lexical/package.json:55 |
| `@beep/md` | 9/10; 6 | explicit 7 | `[]` | star 7; ns 0; named 0; local 1 | named clean 6/6; ready through explicit leaves | packages/foundation/modeling/md/package.json:25; packages/foundation/modeling/md/package.json:44 |
| `@beep/nlp` | 0/0; 0 | explicit 16 | `[]` | star 0; ns 9; named 0; local 0 | no current root imports | packages/foundation/modeling/nlp/package.json:33; packages/foundation/modeling/nlp/package.json:61 |
| `@beep/ontology` | 3/4; 35 | `./*` → `./src/*.ts` | `[]` | star 8; ns 1; named 0; local 0 | named clean 25/35; 25 current bindings ready; 10 stale exploration bindings are not exported now | packages/foundation/modeling/ontology/package.json:35; packages/foundation/modeling/ontology/package.json:50 |
| `@beep/pandoc-ast` | 0/0; 0 | explicit 4 | `[]` | star 4; ns 0; named 0; local 1 | no current root imports | packages/foundation/modeling/pandoc-ast/package.json:40; packages/foundation/modeling/pandoc-ast/package.json:56 |
| `@beep/provenance` | 2/2; 1 | `./*` → `./src/*.ts` | `[]` | star 3; ns 0; named 0; local 0 | named clean 1/1; ready | packages/foundation/modeling/provenance/package.json:37; packages/foundation/modeling/provenance/package.json:50 |
| `@beep/rdf` | 48/56; 15 | `./*` → `./src/*.ts` | `[]` | star 7; ns 1; named 0; local 1 | named clean 15/15; named imports ready; two namespace surface imports need test redesign/waiver | packages/foundation/modeling/rdf/package.json:37; packages/foundation/modeling/rdf/package.json:50 |
| `@beep/schema` | 993/1002; 60 | explicit 130 | `[]` | star 76; ns 4; named 19; local 1 | named clean 55/60; 55/60 bindings ready; add `SafeRemoteHost` and `FileDiff` leaves | packages/foundation/modeling/schema/package.json:49; packages/foundation/modeling/schema/package.json:324 |
| `@beep/utils` | 917/919; 33 | `./*` → `./src/*.ts` | `[]` | star 4; ns 17; named 5; local 0 | named clean 33/33; 33/33 bindings ready; four Function combinators go to `effect/Function` | packages/foundation/modeling/utils/package.json:47; packages/foundation/modeling/utils/package.json:60 |
| `@beep/data` | 5/5; 4 | `./*` → `./src/*.ts` | `[]` | star 0; ns 7; named 0; local 0 | named clean 4/4; ready | packages/foundation/primitive/data/package.json:34; packages/foundation/primitive/data/package.json:55 |
| `@beep/types` | 9/9; 2 | `./*` → `./src/*.ts` | `[]` | star 0; ns 4; named 0; local 0 | named clean 2/2; ready | packages/foundation/primitive/types/package.json:35; packages/foundation/primitive/types/package.json:48 |
| `@beep/dock-react` | 9/15; 7 | explicit 1 | `[]` | star 0; ns 0; named 10; local 0 | named clean 0/7; add public leaves for `DockReact.types` and `DockviewReact` | packages/foundation/ui-system/dock-react/package.json:39; packages/foundation/ui-system/dock-react/package.json:52 |
| `@beep/dock` | 33/53; 99 | explicit 1 | `[]` | star 0; ns 0; named 156; local 0 | named clean 0/99; add public leaves for the 17 routed source modules | packages/foundation/ui-system/dock/package.json:38; packages/foundation/ui-system/dock/package.json:50 |
| `@beep/editor` | 0/0; 0 | explicit 24 | `[]` | star 1; ns 0; named 42; local 1 | no current root imports | packages/foundation/ui-system/editor/package.json:39; packages/foundation/ui-system/editor/package.json:76 |
| `@beep/ui` | 1/1; 1 | explicit 14 | `["**/*.css"]` | star 0; ns 0; named 0; local 1 | named clean 0/1; move root-only `VERSION` to a leaf; preserve CSS side-effect marking | packages/foundation/ui-system/ui/package.json:91; packages/foundation/ui-system/ui/package.json:124 |

`@beep/invariant` is neither a workspace package nor an imported package in this snapshot; there is no export surface to enable.

### What the blockers actually require

- `@beep/schema`: two export-map additions only. The root already routes `FileDiff` to `FileDiff.schema.ts` and the four safe-remote-host bindings to `SafeRemoteHost.ts`, but neither file has a public package subpath (`packages/foundation/modeling/schema/src/index.ts:143`, `packages/foundation/modeling/schema/src/index.ts:402`; absence is visible between the adjacent explicit entries at `packages/foundation/modeling/schema/package.json:140-146` and `packages/foundation/modeling/schema/package.json:242-246`).

- `@beep/observability`: add public entries for the existing top-level modules (`CauseDiagnostics`, `CauseRedaction`, `CoreConfig`, `HttpError`, `Logging`, `Metric`, `Observed`, and `PhaseProfiler`) and extract `VERSION` from the root index. The package currently publishes only root/server/web/experimental entrypoints (`packages/foundation/capability/observability/package.json:34-41`).

- `@beep/dock` and `@beep/dock-react`: source modules already exist and the roots are pure named re-export lists, so enabling is export-map work, not a source split (`packages/foundation/ui-system/dock/src/index.ts:8`, `packages/foundation/ui-system/dock-react/src/index.ts:7`). The maps currently expose only the root and `internal/*` (`packages/foundation/ui-system/dock/package.json:38-43`, `packages/foundation/ui-system/dock-react/package.json:39-44`).

- `@beep/html`: most symbols route to existing explicit leaves, but `Html` is assembled in the root from policy/conformance functions and has no leaf. Move that facade declaration to a public module and re-export it (`packages/foundation/modeling/html/src/index.ts:32-68`).

- `@beep/ui`: the only root import is `VERSION`, declared in the root; extract a version leaf. Keep the existing CSS side-effect declaration unchanged (`packages/foundation/ui-system/ui/package.json:124-126`).

- Namespace surface tests for `@beep/identity`, `@beep/rdf`, and `@beep/semantic-web` intentionally inspect `Object.keys(rootNamespace)` or root shape. A per-module codemod cannot preserve that assertion. Rewrite those tests to inspect the package export contract or give only the enforcement test lane a documented exception; ordinary consumers do not need an aggregate replacement (`packages/foundation/capability/semantic-web/test/ServicesAndSurface.test.ts:7-13`, `packages/foundation/capability/semantic-web/test/ServicesAndSurface.test.ts:84-93`).

### Documentation-driven surface blockers

The readiness fractions in the main package table describe executable named
imports. Resolving every foundation binding found in JSDoc and Markdown adds
**260 current root bindings without a public leaf** and **28 stale bindings
that the current root no longer exports**, across the following packages.
Counts are distinct source bindings, not occurrences.

| Package | Current root bindings with no leaf | Stale doc bindings | Enabling / repair |
| --- | ---: | ---: | --- |
| `@beep/api-transport` | 1 | 0 | extract root-local `VERSION` |
| `@beep/file-processing` | 0 | 1 | repair stale `VERSION` example |
| `@beep/mcp-kit` | 1 | 0 | extract root-local `VERSION` |
| `@beep/observability` | 78 | 0 | publish the routed top-level modules and a version leaf |
| `@beep/html` | 2 | 0 | extract `Html` and `VERSION` leaves |
| `@beep/identity` | 0 | 5 | repair stale identity/package examples |
| `@beep/lexical-schema` | 1 | 0 | extract root-local `VERSION` |
| `@beep/md` | 1 | 0 | extract root-local `VERSION` |
| `@beep/ontology` | 0 | 10 | update the prototype/docs that reference the retired surface |
| `@beep/pandoc-ast` | 1 | 0 | extract root-local `VERSION` |
| `@beep/rdf` | 1 | 1 | extract `VERSION`; repair stale `SKOS_EXACT_MATCH` example |
| `@beep/schema` | 6 | 1 | add `SafeRemoteHost`/`FileDiff`, extract `VERSION`, repair `TaggedErrorClass` |
| `@beep/utils` | 0 | 1 | repair stale `VERSION` README example |
| `@beep/data` | 0 | 8 | repair retired MIME/version examples against current data leaves |
| `@beep/types` | 0 | 1 | repair stale `VERSION` example |
| `@beep/dock-react` | 10 | 0 | publish the two routed public source modules |
| `@beep/dock` | 156 | 0 | publish the 17 routed public source modules |
| `@beep/editor` | 1 | 0 | extract root-local `VERSION` |
| `@beep/ui` | 1 | 0 | extract root-local `VERSION` |

This is why documentation migration cannot be deferred until after the import
ratchet: root JSDoc commonly documents a package's own aggregate surface. The
leaf-enabling PRs must either move those examples with the declarations or
teach docgen examples the new leaf at the same time.

### Root-barrel runtime behavior

No foundation root index contains a side-effect-only import or top-level expression statement. Every package declares `sideEffects: []` except `@beep/ui`, which marks only `**/*.css`. The root indices are therefore re-export/facade surfaces rather than initialization gates. The exceptions are pure root-local values/facades such as package `VERSION` constants and `@beep/html`'s `Html` object; they need leaf extraction because importing the root under a disguised `/index` path would violate the settled rule.

## 3. Mechanical mapping table

The import form is part of the mapping. `namespace` means `import * as <preserved-local> from <target>` (or `import type * as` when the original occurrence is type-only). `named` means `import { <source> as <preserved-local> } from <target>`, retaining an alias only when one already exists. A codemod must preserve local names; it must not opportunistically normalize `Schema` to `S`, `Option` to `O`, and so on.

### Effect root barrel: complete source-binding map

| Source binding | Occurrences | Value | Type-only | Files | Existing aliases | Target module | Import form | Status |
| --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- |
| `Effect` | 1439 | 1393 | 46 | 1438 | EffectType:1 | `effect/Effect` | namespace | clean |
| `Layer` | 622 | 615 | 7 | 622 | EffectLayer:1 | `effect/Layer` | namespace | clean |
| `pipe` | 584 | 584 | 0 | 584 |  | `effect/Function` | named | clean |
| `FileSystem` | 378 | 356 | 22 | 378 |  | `effect/FileSystem` | namespace | clean |
| `Path` | 358 | 326 | 32 | 358 | PlatformPath:1 | `effect/Path` | namespace | clean |
| `Result` | 297 | 294 | 3 | 297 | Rs:2 | `effect/Result` | namespace | clean |
| `Context` | 266 | 264 | 2 | 266 |  | `effect/Context` | namespace | clean |
| `Order` | 225 | 224 | 1 | 225 | Ord:1, Order_:2 | `effect/Order` | namespace | clean |
| `flow` | 219 | 219 | 0 | 219 |  | `effect/Function` | named | clean |
| `Match` | 173 | 173 | 0 | 173 |  | `effect/Match` | namespace | clean |
| `Console` | 131 | 131 | 0 | 131 |  | `effect/Console` | namespace | clean |
| `Duration` | 128 | 124 | 4 | 128 | D:1 | `effect/Duration` | namespace | clean |
| `DateTime` | 126 | 125 | 1 | 126 |  | `effect/DateTime` | namespace | clean |
| `Exit` | 121 | 118 | 3 | 121 |  | `effect/Exit` | namespace | clean |
| `Ref` | 116 | 116 | 0 | 116 |  | `effect/Ref` | namespace | clean |
| `Stream` | 105 | 103 | 2 | 105 |  | `effect/Stream` | namespace | clean |
| `Cause` | 99 | 94 | 5 | 99 |  | `effect/Cause` | namespace | clean |
| `HashSet` | 96 | 96 | 0 | 96 | HashSet_:1 | `effect/HashSet` | namespace | clean |
| `Config` | 85 | 81 | 4 | 85 |  | `effect/Config` | namespace | clean |
| `HashMap` | 80 | 80 | 0 | 80 |  | `effect/HashMap` | namespace | clean |
| `Redacted` | 69 | 62 | 7 | 69 | RedactedType:2 | `effect/Redacted` | namespace | clean |
| `SchemaTransformation` | 68 | 68 | 0 | 68 | ST:1 | `effect/SchemaTransformation` | namespace | clean |
| `Number` | 63 | 63 | 0 | 63 | N:50, Num:13 | `effect/Number` | namespace | clean |
| `Clock` | 61 | 61 | 0 | 61 |  | `effect/Clock` | namespace | clean |
| `MutableHashMap` | 59 | 59 | 0 | 59 | MutableHashMap_:1 | `effect/MutableHashMap` | namespace | clean |
| `SchemaGetter` | 57 | 57 | 0 | 57 | Getter:1 | `effect/SchemaGetter` | namespace | clean |
| `Option` | 54 | 53 | 1 | 54 | O:9 | `effect/Option` | namespace | clean |
| `SchemaIssue` | 53 | 50 | 3 | 53 |  | `effect/SchemaIssue` | namespace | clean |
| `MutableHashSet` | 46 | 46 | 0 | 46 | MutableHashSet_:1 | `effect/MutableHashSet` | namespace | clean |
| `Equal` | 44 | 44 | 0 | 44 |  | `effect/Equal` | namespace | clean |
| `Tuple` | 43 | 43 | 0 | 43 |  | `effect/Tuple` | namespace | clean |
| `identity` | 38 | 38 | 0 | 38 |  | `effect/Function` | named | clean |
| `Schedule` | 38 | 36 | 2 | 38 |  | `effect/Schedule` | namespace | clean |
| `Data` | 37 | 37 | 0 | 37 |  | `effect/Data` | namespace | clean |
| `ConfigProvider` | 36 | 36 | 0 | 36 |  | `effect/ConfigProvider` | namespace | clean |
| `Schema` | 35 | 35 | 0 | 35 | S:1 | `effect/Schema` | namespace | clean |
| `Inspectable` | 32 | 32 | 0 | 32 |  | `effect/Inspectable` | namespace | clean |
| `Chunk` | 27 | 27 | 0 | 27 |  | `effect/Chunk` | namespace | clean |
| `Metric` | 26 | 26 | 0 | 26 |  | `effect/Metric` | namespace | clean |
| `Encoding` | 20 | 20 | 0 | 20 |  | `effect/Encoding` | namespace | clean |
| `Deferred` | 19 | 19 | 0 | 19 |  | `effect/Deferred` | namespace | clean |
| `Sink` | 19 | 19 | 0 | 19 |  | `effect/Sink` | namespace | clean |
| `Fiber` | 18 | 17 | 1 | 18 |  | `effect/Fiber` | namespace | clean |
| `Runtime` | 18 | 18 | 0 | 18 |  | `effect/Runtime` | namespace | clean |
| `Crypto` | 15 | 10 | 5 | 15 |  | `effect/Crypto` | namespace | clean |
| `Semaphore` | 15 | 15 | 0 | 15 |  | `effect/Semaphore` | namespace | clean |
| `Random` | 14 | 14 | 0 | 14 |  | `effect/Random` | namespace | clean |
| `Graph` | 13 | 11 | 2 | 13 | G:1, Graph_:5 | `effect/Graph` | namespace | clean |
| `Logger` | 13 | 13 | 0 | 13 |  | `effect/Logger` | namespace | clean |
| `SchemaAST` | 13 | 7 | 6 | 13 |  | `effect/SchemaAST` | namespace | clean |
| `Scope` | 13 | 7 | 6 | 13 |  | `effect/Scope` | namespace | clean |
| `Struct` | 13 | 12 | 1 | 13 | EffectStruct:1 | `effect/Struct` | namespace | clean |
| `PlatformError` | 12 | 6 | 6 | 12 | PlatformErrorNs:1 | `effect/PlatformError` | namespace | clean |
| `Queue` | 9 | 9 | 0 | 9 |  | `effect/Queue` | namespace | clean |
| `References` | 9 | 9 | 0 | 9 |  | `effect/References` | namespace | clean |
| `Brand` | 7 | 5 | 2 | 7 |  | `effect/Brand` | namespace | clean |
| `Cache` | 7 | 7 | 0 | 7 |  | `effect/Cache` | namespace | clean |
| `PubSub` | 7 | 7 | 0 | 7 |  | `effect/PubSub` | namespace | clean |
| `Hash` | 6 | 6 | 0 | 6 |  | `effect/Hash` | namespace | clean |
| `SchemaParser` | 6 | 6 | 0 | 6 |  | `effect/SchemaParser` | namespace | clean |
| `Terminal` | 6 | 2 | 4 | 6 |  | `effect/Terminal` | namespace | clean |
| `MutableRef` | 5 | 5 | 0 | 5 |  | `effect/MutableRef` | namespace | clean |
| `Function` | 4 | 4 | 0 | 4 | F:1, Fn:3 | `effect/Function` | namespace | clean |
| `BigDecimal` | 3 | 3 | 0 | 3 |  | `effect/BigDecimal` | namespace | clean |
| `ErrorReporter` | 3 | 3 | 0 | 3 |  | `effect/ErrorReporter` | namespace | clean |
| `JsonPatch` | 3 | 1 | 2 | 3 |  | `effect/JsonPatch` | namespace | clean |
| `JsonPointer` | 3 | 3 | 0 | 3 |  | `effect/JsonPointer` | namespace | clean |
| `Stdio` | 3 | 3 | 0 | 3 |  | `effect/Stdio` | namespace | clean |
| `ExecutionPlan` | 2 | 2 | 0 | 2 |  | `effect/ExecutionPlan` | namespace | clean |
| `PrimaryKey` | 2 | 2 | 0 | 2 |  | `effect/PrimaryKey` | namespace | clean |
| `Request` | 2 | 2 | 0 | 2 |  | `effect/Request` | namespace | clean |
| `Tracer` | 2 | 2 | 0 | 2 |  | `effect/Tracer` | namespace | clean |
| `BigInt` | 1 | 1 | 0 | 1 | BI:1 | `effect/BigInt` | namespace | clean |
| `cast` | 1 | 1 | 0 | 1 |  | `effect/Function` | named | clean |
| `Equivalence` | 1 | 0 | 1 | 1 |  | `effect/Equivalence` | namespace | clean |
| `FiberMap` | 1 | 1 | 0 | 1 |  | `effect/FiberMap` | namespace | clean |
| `FiberSet` | 1 | 1 | 0 | 1 |  | `effect/FiberSet` | namespace | clean |
| `Iterable` | 1 | 1 | 0 | 1 | I:1 | `effect/Iterable` | namespace | clean |
| `ManagedRuntime` | 1 | 1 | 0 | 1 |  | `effect/ManagedRuntime` | namespace | clean |
| `RegExp` | 1 | 1 | 0 | 1 | Regex:1 | `effect/RegExp` | namespace | clean |
| `RequestResolver` | 1 | 1 | 0 | 1 |  | `effect/RequestResolver` | namespace | clean |
| `TxQueue` | 1 | 1 | 0 | 1 |  | `effect/TxQueue` | namespace | clean |
| `TxRef` | 1 | 1 | 0 | 1 |  | `effect/TxRef` | namespace | clean |
| `Unify` | 1 | 0 | 1 | 1 |  | `effect/Unify` | namespace | clean |

Validation result: **84/84 mappings are clean**. Each target resolves through the installed Effect 4.0.0-rc.111 `./*` export and has both `dist/<Module>.js` and `dist/<Module>.d.ts`. The four flat combinators `cast`, `flow`, `identity`, and `pipe` are the exceptions to namespace form and come from `effect/Function` as named imports.

### @beep/utils root barrel: complete source-binding map

| Source binding | Occurrences | Value | Type-only | Files | Existing aliases | Target module | Import form | Status |
| --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- |
| `A` | 674 | 673 | 1 | 674 |  | `@beep/utils/Array` | namespace | clean |
| `Str` | 398 | 398 | 0 | 398 |  | `@beep/utils/Str` | namespace | clean |
| `O` | 274 | 273 | 1 | 274 | OptionUtils:4, OU:1 | `@beep/utils/Option` | namespace | clean |
| `P` | 91 | 91 | 0 | 91 |  | `@beep/utils/Predicate` | namespace | clean |
| `thunkFalse` | 59 | 59 | 0 | 59 |  | `@beep/utils/thunk` | named | clean |
| `pipe` | 43 | 43 | 0 | 43 |  | `effect/Function` | named | clean |
| `thunkEmptyStr` | 40 | 40 | 0 | 40 |  | `@beep/utils/thunk` | named | clean |
| `R` | 35 | 33 | 2 | 35 |  | `@beep/utils/Record` | namespace | clean |
| `Struct` | 30 | 30 | 0 | 30 |  | `@beep/utils/Struct` | namespace | clean |
| `Err` | 22 | 22 | 0 | 22 |  | `@beep/utils/Errors` | namespace | clean |
| `N` | 19 | 19 | 0 | 19 |  | `@beep/utils/Number` | namespace | clean |
| `Text` | 14 | 14 | 0 | 14 |  | `@beep/utils/Text` | namespace | clean |
| `thunkEffectVoid` | 11 | 11 | 0 | 11 |  | `@beep/utils/thunk` | named | clean |
| `thunkTrue` | 11 | 11 | 0 | 11 |  | `@beep/utils/thunk` | named | clean |
| `thunkUndefined` | 11 | 11 | 0 | 11 |  | `@beep/utils/thunk` | named | clean |
| `thunk0` | 10 | 10 | 0 | 10 |  | `@beep/utils/thunk` | named | clean |
| `dual` | 9 | 9 | 0 | 9 |  | `effect/Function` | named | clean |
| `thunkNull` | 7 | 7 | 0 | 7 |  | `@beep/utils/thunk` | named | clean |
| `flow` | 6 | 6 | 0 | 6 |  | `effect/Function` | named | clean |
| `Eq` | 5 | 5 | 0 | 5 |  | `@beep/utils/Equal` | namespace | clean |
| `thunk` | 3 | 3 | 0 | 3 |  | `@beep/utils/thunk` | named | clean |
| `thunkEmptyReadonlyArray` | 3 | 3 | 0 | 3 |  | `@beep/utils/thunk` | named | clean |
| `thunkEmptyRecord` | 3 | 3 | 0 | 3 |  | `@beep/utils/thunk` | named | clean |
| `DateTime` | 2 | 2 | 0 | 2 |  | `@beep/utils/DateTime` | namespace | clean |
| `FileSystem` | 2 | 2 | 0 | 2 |  | `@beep/utils/FileSystem` | namespace | clean |
| `Html` | 2 | 2 | 0 | 2 |  | `@beep/utils/Html` | namespace | clean |
| `Path` | 2 | 2 | 0 | 2 |  | `@beep/utils/Path` | namespace | clean |
| `thunkEffectSucceedNull` | 2 | 2 | 0 | 2 |  | `@beep/utils/thunk` | named | clean |
| `thunkEmptyReadonlyRecord` | 2 | 2 | 0 | 2 |  | `@beep/utils/thunk` | named | clean |
| `Bool` | 1 | 1 | 0 | 1 |  | `@beep/utils/Bool` | namespace | clean |
| `identity` | 1 | 1 | 0 | 1 |  | `effect/Function` | named | clean |
| `thunk1` | 1 | 1 | 0 | 1 |  | `@beep/utils/thunk` | named | clean |
| `thunkEffectSucceed` | 1 | 1 | 0 | 1 |  | `@beep/utils/thunk` | named | clean |

### @beep/schema root barrel: complete source-binding map

| Source binding | Occurrences | Value | Type-only | Files | Existing aliases | Target module | Import form | Status |
| --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- |
| `SchemaUtils` | 549 | 549 | 0 | 549 |  | `@beep/schema/SchemaUtils` | namespace | clean |
| `LiteralKit` | 465 | 464 | 1 | 464 | LiteralKitSchema:1 | `@beep/schema/LiteralKit` | named | clean |
| `NonNegativeInt` | 293 | 291 | 2 | 293 |  | `@beep/schema/Number` | named | clean |
| `PosInt` | 71 | 71 | 0 | 71 |  | `@beep/schema/Int` | named | clean |
| `UnknownRecord` | 32 | 25 | 7 | 32 |  | `@beep/schema/Record` | named | clean |
| `Sha256Hex` | 31 | 30 | 1 | 31 |  | `@beep/schema/Sha256` | named | clean |
| `URLStr` | 25 | 25 | 0 | 25 |  | `@beep/schema/URL` | named | clean |
| `Fn` | 20 | 20 | 0 | 20 |  | `@beep/schema/Fn` | named | clean |
| `normalizePath` | 17 | 17 | 0 | 17 | normalizeSchemaPath:1 | `@beep/schema/PosixPath` | named | clean |
| `Sha256HexFromBytes` | 17 | 17 | 0 | 17 |  | `@beep/schema/Sha256` | named | clean |
| `MappedLiteralKit` | 9 | 9 | 0 | 9 |  | `@beep/schema/MappedLiteralKit` | named | clean |
| `NonNegNum` | 9 | 9 | 0 | 9 |  | `@beep/schema/Number` | named | clean |
| `NonEmptyTrimmedStr` | 7 | 7 | 0 | 7 |  | `@beep/schema/String` | named | clean |
| `LogLevel` | 6 | 6 | 0 | 6 |  | `@beep/schema/Logs` | named | clean |
| `MimeType` | 6 | 6 | 0 | 6 |  | `@beep/schema/MimeType` | named | clean |
| `EmailString` | 5 | 5 | 0 | 5 |  | `@beep/schema/Email` | named | clean |
| `JsonObject` | 5 | 3 | 2 | 5 |  | `@beep/schema/Json` | named | clean |
| `SafeObject` | 5 | 5 | 0 | 5 | SafeObjectSchema:1 | `@beep/schema/SafeObject` | named | clean |
| `ArrayOfStrings` | 4 | 4 | 0 | 4 |  | `@beep/schema/ArrayOf` | named | clean |
| `EffectSchema` | 4 | 4 | 0 | 4 |  | `@beep/schema/EffectSchema` | named | clean |
| `HttpsUrl` | 4 | 4 | 0 | 4 |  | `@beep/schema/URL` | named | clean |
| `Markdown` | 4 | 3 | 1 | 4 |  | `@beep/schema/Markdown` | named | clean |
| `assertAllowedRemoteUrl` | 3 | 3 | 0 | 3 |  | `@beep/schema/SafeRemoteHost` | named | needs export-map entry |
| `ArrayOfNonEmptyStrings` | 2 | 2 | 0 | 2 |  | `@beep/schema/ArrayOf` | named | clean |
| `FilePath` | 2 | 2 | 0 | 2 |  | `@beep/schema/FilePath` | named | clean |
| `HtmlFragment` | 2 | 2 | 0 | 2 |  | `@beep/schema/Html` | named | clean |
| `KebabCaseStr` | 2 | 2 | 0 | 2 |  | `@beep/schema/KebabStr` | named | clean |
| `MutableHashMapFromSelf` | 2 | 2 | 0 | 2 |  | `@beep/schema/MutableHashMap` | named | clean |
| `PosixPath` | 2 | 2 | 0 | 2 | PosixPathSchema:1 | `@beep/schema/PosixPath` | named | clean |
| `SemanticVersion` | 2 | 2 | 0 | 2 |  | `@beep/schema/SemanticVersion` | named | clean |
| `TrimmedNonEmptyText` | 2 | 2 | 0 | 2 |  | `@beep/schema/CommonTextSchemas` | named | clean |
| `VideoFileExtension` | 2 | 2 | 0 | 2 |  | `@beep/schema/FileExtension` | named | clean |
| `assertAllowedRemoteHost` | 1 | 1 | 0 | 1 |  | `@beep/schema/SafeRemoteHost` | named | needs export-map entry |
| `AudioMimeType` | 1 | 1 | 0 | 1 |  | `@beep/schema/MimeType` | named | clean |
| `BlockedHostError` | 1 | 1 | 0 | 1 |  | `@beep/schema/SafeRemoteHost` | named | needs export-map entry |
| `decodeYamlTextAs` | 1 | 1 | 0 | 1 |  | `@beep/schema/Yaml` | named | clean |
| `DirectedGraph` | 1 | 1 | 0 | 1 |  | `@beep/schema/Graph` | named | clean |
| `DurationInput` | 1 | 1 | 0 | 1 |  | `@beep/schema/Duration` | named | clean |
| `extractMimeExtensions` | 1 | 1 | 0 | 1 |  | `@beep/schema/FileExtension` | named | clean |
| `extractMimeTypes` | 1 | 1 | 0 | 1 |  | `@beep/schema/MimeType` | named | clean |
| `FileDiff` | 1 | 1 | 0 | 1 |  | `@beep/schema/FileDiff` | namespace | needs export-map entry |
| `HexColor` | 1 | 1 | 0 | 1 |  | `@beep/schema/Color` | named | clean |
| `HttpStatusCode` | 1 | 1 | 0 | 1 | RootHttpStatusCode:1 | `@beep/schema/HttpStatus` | named | clean |
| `ImageFileExtension` | 1 | 1 | 0 | 1 |  | `@beep/schema/FileExtension` | named | clean |
| `ImageMimeType` | 1 | 1 | 0 | 1 |  | `@beep/schema/MimeType` | named | clean |
| `Int64` | 1 | 1 | 0 | 1 |  | `@beep/schema/Int` | named | clean |
| `isBlockedRemoteHost` | 1 | 1 | 0 | 1 |  | `@beep/schema/SafeRemoteHost` | named | needs export-map entry |
| `isPositive` | 1 | 1 | 0 | 1 |  | `@beep/schema/Number` | named | clean |
| `JSONSchema` | 1 | 1 | 0 | 1 |  | `@beep/schema/JSONSchema` | namespace | clean |
| `makeStatusCauseError` | 1 | 1 | 0 | 1 |  | `@beep/schema/StatusCauseError` | named | clean |
| `NativePathToPosixPath` | 1 | 1 | 0 | 1 |  | `@beep/schema/PosixPath` | named | clean |
| `NodeIndex` | 1 | 1 | 0 | 1 |  | `@beep/schema/Graph` | named | clean |
| `OptionFromOptionalNullishKey` | 1 | 1 | 0 | 1 |  | `@beep/schema/Options` | named | clean |
| `PascalCaseStr` | 1 | 1 | 0 | 1 |  | `@beep/schema/PascalStr` | named | clean |
| `Slug` | 1 | 1 | 0 | 1 |  | `@beep/schema/Slug` | named | clean |
| `SnakeCaseStr` | 1 | 1 | 0 | 1 |  | `@beep/schema/SnakeStr` | named | clean |
| `StatusCauseFields` | 1 | 1 | 0 | 1 |  | `@beep/schema/StatusCauseError` | named | clean |
| `StatusCauseInput` | 1 | 0 | 1 | 1 |  | `@beep/schema/StatusCauseError` | named | clean |
| `TextMimeType` | 1 | 1 | 0 | 1 |  | `@beep/schema/MimeType` | named | clean |
| `YamlTextToUnknown` | 1 | 1 | 0 | 1 |  | `@beep/schema/Yaml` | named | clean |

`BS` is not an imported source binding or namespace alias for `@beep/schema` anywhere in the current code inventory, so there is no `BS` codemod row. The current high-frequency schema namespace is `SchemaUtils` (549 occurrences), mapping to `@beep/schema/SchemaUtils`.

The five schema rows without a current public home reduce to two package-export changes: add `"./SafeRemoteHost": "./src/SafeRemoteHost.ts"` for four named bindings (six total occurrences), and add `"./FileDiff": "./src/FileDiff.schema.ts"` for the one namespace occurrence. No source-module split is required.

### Documentation-only mapping additions

The executable tables above contain every source binding in static imports.
Parsing JSDoc `**Example**` fences and Markdown/MDX fences adds the following
bindings that have no executable occurrence. These rows are part of the
codemod spec because docgen examples and authored guidance are migration
surface too.

| Source barrel | Source binding | Doc occurrences | Target module | Import form | Status |
| --- | --- | ---: | --- | --- | --- |
| `effect` | `Predicate` | 1 | `effect/Predicate` | namespace | clean |
| `effect` | `TestClock` | 3 | `effect/testing/TestClock` | namespace | clean; the old root binding is already invalid in v4 |
| `effect` | `Types` | 1 | `effect/Types` | namespace | clean |
| `@beep/utils` | `RandomValues` | 1 | `@beep/utils/Random` | named | clean |
| `@beep/utils` | `Stream` | 1 | `@beep/utils/Stream` | namespace | clean |
| `@beep/utils` | `globalValue` | 1 | `@beep/utils/GlobalValue` | named | clean |
| `@beep/utils` | `VERSION` | 1 | — | — | not currently exported; repair stale README example |
| `@beep/schema` | `AnyFn` | 2 | `@beep/schema/Fn` | named | clean |
| `@beep/schema` | `Email` | 3 | `@beep/schema/Email` | named | clean |
| `@beep/schema` | `Glob` | 3 | `@beep/schema/Glob` | named | clean |
| `@beep/schema` | `HttpMethod` | 1 | `@beep/schema/HttpMethod` | namespace | clean |
| `@beep/schema` | `PortFromString` | 1 | `@beep/schema/Port` | named | clean |
| `@beep/schema` | `TaggedErrorClass` | 4 | — | — | not currently exported; manual stale-API rewrite |
| `@beep/schema` | `ThunkOf` | 3 | `@beep/schema/Fn` | named | clean |
| `@beep/schema` | `VERSION` | 1 | proposed `@beep/schema/Version` | named | extract root-local constant |

`TestClock` resolves and loads through the installed wildcard export at
`effect/testing/TestClock`; current Effect source documents that testing
module from `effect/testing` (`node_modules/effect/src/testing/index.ts:15`).
The `@beep/utils` namespace/flat origins are explicit in the barrel
(`packages/foundation/modeling/utils/src/index.ts:234-281`,
`packages/foundation/modeling/utils/src/index.ts:329`). The schema targets are
already explicit public leaves except for the root-local/stale rows
(`packages/foundation/modeling/schema/package.json:182-245`).

## 4. Edge-case register

Counts in this section are syntactic occurrences in the same ripgrep-backed code inventory unless the row explicitly says JSDoc or Markdown. File classes overlap: for example, a generated test under a scratchpad would appear in all applicable rows.

### Re-exports of target barrels

| Form | Files | Statements | Named/star split | Examples |
| --- | ---: | ---: | --- | --- |
| `export … from "effect"` | 0 | 0 | named 0; star 0 | — |
| Foundation-root re-export | 1 | 1 | named 1; star 0 | `packages/foundation/modeling/md/src/Md.html.ts:249` |

The sole executable re-export is `export { safeHtmlValue } from "@beep/html"`; it maps as a named re-export from `@beep/html/Html.serialize` (`packages/foundation/modeling/html/src/Html.serialize.ts:740`). There are no executable `export * from "effect"` or named Effect-root re-exports.

### Type syntax, mixed imports, and aliases

| Edge | Files | Effect statements/bindings | Foundation statements/bindings | Examples |
| --- | ---: | ---: | ---: | --- |
| Statement-level `import type` | 239 | 150 | 104 | `apps/professional-desktop/server/OntologyMcpTransport.ts:38`; `apps/professional-desktop/src/App.tsx:73-74` |
| Specifier-only `import { type X }` statement | 0 | 0 | 0 | — |
| Mixed value + specifier-level `type` | 2 | 1 | 1 | `scratchpad/codemode/openapi/OpenAPI.types.ts:15`; `scratchpad/dockview-demo/src/main.tsx:23` |
| Aliased named bindings | 127 | 104 | 29 | `packages/drivers/box/test/Box.service.test.ts:8`; `packages/drivers/firecrawl/src/Firecrawl.service.ts:9` |

Type-only namespace sources must become `import type * as Local from "module"`; a mixed statement must split by target module while retaining `type` on the affected specifier/import. The mapping tables include every alias frequency, so the codemod can preserve names rather than infer them.

### JSDoc `**Example**` and Markdown/skill fences

| Surface | Files | Matching blocks/fences | Target import statements | Effect root | Foundation roots | Examples |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| JSDoc `**Example**` | 853 | 2932 blocks / 2937 fences | 3215 | 1918 | 1297 | `apps/oip-web/src/app/api/contact/ContactHttpApiRoute.ts:61`; `apps/oip-web/src/contact/ContactSubmission.model.ts:170-171` |
| Markdown/MDX code fences (hidden skills included) | 71 | 197 fences | 234 | 157 | 77 | `.claude/skills/atom-reactivity-specialist/references/service-pattern.md:21`; `.claude/skills/effect-first-development/references/always-never-core.md:99-101` |

The JSDoc count is intentionally restricted to comment blocks containing the titled `**Example**` marker; ordinary comments are excluded. Markdown scanning uses fenced code only and includes hidden `.claude/skills/**` files while excluding `.git`, `node_modules`, `.repos`, and this report directory.

#### Effect binding frequency in documentation fences

This table completes the executable frequency table: `overall` is executable + JSDoc + Markdown. Bindings with zero documentation hits are omitted here but remain in the mechanical table above.

| Source binding | Executable | JSDoc | Markdown | Overall |
| --- | ---: | ---: | ---: | ---: |
| `Effect` | 1439 | 1515 | 117 | 3071 |
| `Result` | 297 | 149 | 3 | 449 |
| `Layer` | 622 | 123 | 18 | 763 |
| `pipe` | 584 | 48 | 12 | 644 |
| `Redacted` | 69 | 36 | 2 | 107 |
| `Duration` | 128 | 24 | 7 | 159 |
| `Cause` | 99 | 23 | 4 | 126 |
| `Stream` | 105 | 26 | 1 | 132 |
| `DateTime` | 126 | 25 | 0 | 151 |
| `Exit` | 121 | 13 | 6 | 140 |
| `Option` | 54 | 14 | 2 | 70 |
| `Context` | 266 | 0 | 12 | 278 |
| `ConfigProvider` | 36 | 11 | 0 | 47 |
| `Graph` | 13 | 11 | 0 | 24 |
| `Ref` | 116 | 8 | 2 | 126 |
| `Chunk` | 27 | 9 | 0 | 36 |
| `Metric` | 26 | 9 | 0 | 35 |
| `Path` | 358 | 9 | 0 | 367 |
| `Config` | 85 | 2 | 6 | 93 |
| `HashMap` | 80 | 8 | 0 | 88 |
| `HashSet` | 96 | 8 | 0 | 104 |
| `Match` | 173 | 0 | 7 | 180 |
| `FileSystem` | 378 | 6 | 0 | 384 |
| `Order` | 225 | 4 | 2 | 231 |
| `Console` | 131 | 3 | 2 | 136 |
| `MutableHashMap` | 59 | 5 | 0 | 64 |
| `Data` | 37 | 0 | 4 | 41 |
| `Tuple` | 43 | 0 | 4 | 47 |
| `Fiber` | 18 | 0 | 3 | 21 |
| `MutableHashSet` | 46 | 3 | 0 | 49 |
| `Schedule` | 38 | 0 | 3 | 41 |
| `TestClock` | 0 | 0 | 3 | 3 |
| `Equal` | 44 | 1 | 1 | 46 |
| `Schema` | 35 | 0 | 2 | 37 |
| `SchemaTransformation` | 68 | 0 | 2 | 70 |
| `Crypto` | 15 | 1 | 0 | 16 |
| `flow` | 219 | 0 | 1 | 220 |
| `Hash` | 6 | 1 | 0 | 7 |
| `Predicate` | 0 | 0 | 1 | 1 |
| `PrimaryKey` | 2 | 1 | 0 | 3 |
| `Runtime` | 18 | 0 | 1 | 19 |
| `Scope` | 13 | 0 | 1 | 14 |
| `Stdio` | 3 | 1 | 0 | 4 |
| `Types` | 0 | 0 | 1 | 1 |

#### Foundation documentation-fence summary

| Package root | JSDoc bindings / occurrences | Markdown bindings / occurrences |
| --- | ---: | ---: |
| `@beep/api-transport` | 7 / 13 | 2 / 2 |
| `@beep/chalk` | 23 / 54 | 3 / 4 |
| `@beep/colors` | 7 / 23 | 2 / 2 |
| `@beep/data` | 14 / 15 | 1 / 1 |
| `@beep/dock` | 156 / 583 | 7 / 7 |
| `@beep/dock-react` | 10 / 10 | 0 / 0 |
| `@beep/editor` | 1 / 1 | 0 / 0 |
| `@beep/file-processing` | 0 / 0 | 1 / 1 |
| `@beep/html` | 18 / 64 | 7 / 7 |
| `@beep/identity` | 171 / 225 | 10 / 15 |
| `@beep/lexical-schema` | 6 / 8 | 3 / 4 |
| `@beep/mcp-kit` | 46 / 81 | 3 / 3 |
| `@beep/md` | 9 / 100 | 2 / 4 |
| `@beep/nlp` | 9 / 9 | 0 / 0 |
| `@beep/observability` | 78 / 130 | 2 / 2 |
| `@beep/ontology` | 36 / 49 | 1 / 1 |
| `@beep/pandoc-ast` | 5 / 5 | 4 / 4 |
| `@beep/rdf` | 8 / 19 | 9 / 13 |
| `@beep/schema` | 27 / 293 | 9 / 42 |
| `@beep/types` | 4 / 16 | 1 / 1 |
| `@beep/ui` | 1 / 2 | 0 / 0 |
| `@beep/utils` | 20 / 116 | 4 / 9 |

The core binding-by-binding codemod maps requested for `@beep/utils` and `@beep/schema` are above, including their documentation-only additions. Other foundation documentation bindings should be resolved through the same root-export-to-public-leaf graph; package blockers in section 2 apply equally to examples.

### File classes and proposed exclusion boundaries

| Class | Files | Effect-root statements | Foundation-root statements | Total | Examples |
| --- | ---: | ---: | ---: | ---: | --- |
| `.d.ts` | 0 | 0 | 0 | 0 | — |
| generated | 21 | 17 | 18 | 35 | `packages/drivers/box/src/_generated/Box.operations.gen.ts:10`; `packages/foundation/modeling/html/src/Html.meta.ts:10-12` |
| test | 640 | 568 | 437 | 1005 | `apps/architecture-lab-proof/test/ArchitectureLabProof.test.ts:5`; `apps/oip-web/test/oip-web.test.tsx:1-6` |
| scratchpad | 303 | 217 | 386 | 603 | `scratchpad/bubbles/Bubble.ts:9`; `scratchpad/claudecode/Frontmatter/Parser.ts:8-9` |
| specs | 0 | 0 | 0 | 0 | — |
| explorations | 10 | 10 | 4 | 14 | `explorations/identity-as-iri/assets/ontology-prototype/src/annotations.ts:1-4`; `explorations/identity-as-iri/assets/ontology-prototype/src/assembly.ts:1` |
| goals/research assets | 15 | 14 | 4 | 18 | `goals/fallow-advisory-ratchets/ops/validate-packet.ts:4-6`; `goals/one-round-loop/ops/codemods/numruns-fcruns.codemod.ts:34` |

Apps, packages, and tests are in scope, so the 1,005 test statements are migration work, not exclusions. Generated sources also remain in scope, but each of the 35 generated statements must be fixed at its generator/template and regenerated; direct edits would be overwritten. The raw census includes scratchpad, exploration, and packet assets under `others`. If the enforcement boundary excludes non-shipping artifacts, encode those path exclusions explicitly: `scratchpad` accounts for 603 statements, `explorations` 14, and goal/research assets 18; nested `specs` currently contributes zero.

### Namespace rewrite collisions and pre-existing target imports

- **New identifier collisions when preserving local names: 0 by construction.** Replacing a named binding with a namespace binding does not invent a local identifier. The 133 existing aliases are preserved verbatim.

- **Pre-existing target-module imports:** Effect contributes 281 source-binding/target-module pairs in 206 files; foundation barrels contribute another 54 pairs in 29 files. The codemod must merge declarations rather than emit a duplicate. Effect examples: `apps/oip-web/src/runtime/OipRuntimeConfig.ts:9-10` and `packages/documents/server/src/aggregates/Sync/VaultSyncEngine.service.ts:76-80`. Foundation examples: `apps/professional-desktop/src/chat/ui/ComposerPolicy.ts:21-23`, `packages/agents/client/src/internal/BrowserHttpUrl.ts:10-12`, and `packages/foundation/modeling/html/test/Html.conformance-hardening.test.ts:1-9`.

- **Do not normalize aliases during this migration:** forcing canonical short aliases would create 9 collisions in 9 files. All measured cases are scratchpad files that import `Option` while already declaring `O`; examples are `scratchpad/effect-ontology/Service/Agent/AgentKit.ts:13` and `scratchpad/effect-ontology/Service/EventBus.ts:12`.

### Dynamic imports, import types, and strings

| Form | Files | Occurrences | Handling | Examples |
| --- | ---: | ---: | --- | --- |
| `import("effect")` | 2 | 3 | split destructured/root-namespace use by target module | `packages/tooling/tool/cli/src/bin-main.ts:29`; `packages/tooling/tool/cli/src/bin-main.ts:93`; `packages/agents/server/test/AnthropicTurnKernel.test.ts:30-36` |
| `import("@beep/<foundation>")` | 1 | 1 | `{ A }` → dynamic `@beep/utils/Array` namespace | `packages/tooling/tool/cli/src/bin-main.ts:28` |
| type-level `import("effect")` | 2 | 3 | rewrite each qualifier to its module | `packages/tooling/tool/cli/src/bin-main.ts:111`; `packages/tooling/tool/cli/src/bin-main.ts:168`; `scratchpad/effect-ontology/Service/Config.ts:438` |
| `require("effect")` or foundation root | 0 | 0 | none | — |
| String/template containing import source code | 10 | 25 string literals | update generator templates/positive fixtures; keep deliberate forbidden-syntax fixtures | `packages/drivers/runpod/scripts/generate.ts:439`; `packages/tooling/policy-pack/lint-rules/test/oxlint-sources.ts:139-161` |
| Other exact `"effect"` string | 29 | 54 | do not rewrite blindly; mostly dependency names, externals, and data | `packages/ecosystem/effect-drizzle/test/bundle-build.ts:12`; `packages/foundation/modeling/md/test/Md.test.ts:1037` |

The CLI dynamic import at `packages/tooling/tool/cli/src/bin-main.ts:93` destructures five Effect namespaces and therefore cannot be transformed into one equivalent module specifier; use parallel module imports or static imports while preserving the bootstrap intent. The mocked root namespace at `packages/agents/server/test/AnthropicTurnKernel.test.ts:30-36` likewise needs a small manual split.

## 5. Risk register and codemod invariants

| Risk | Evidence / consequence | Required mitigation |
| --- | --- | --- |
| Public subpath does not exist | Effect permits `./*` but explicitly forbids `internal/*`, `/index`, and `/*/index` (`node_modules/effect/package.json:28-56`). Several foundation roots lack leaf exports, quantified in section 2. A source-relative deep path may typecheck locally yet fail package resolution or publication. | Generate only targets present in the package `exports` map. Add the section-2 leaves before migrating their consumers. Never target `effect/internal/*`, `effect/index`, `@beep/*/src/*`, or a disguised package `/index`. |
| Workspace and published maps drift | Foundation packages map workspace imports to `src` at top level and separately remap published imports to `dist` under `publishConfig.exports` (`packages/foundation/modeling/schema/package.json:324-338`, `packages/foundation/ui-system/dock/package.json:38-58`). | Every new foundation leaf must be added to both maps, including the correct `.js` dist path and any deliberate null guards. Add a package-export resolution test for source and packed output. |
| Root-only facades/constants have no leaf | `@beep/html.Html`, the documentation-driven `VERSION` surfaces in section 2, and the namespace surface tests cannot be expressed as a simple leaf rename. | Extract durable facades/constants to named leaf modules; redesign root-surface tests or give only that enforcement lane an explicit waiver. Do not “solve” this with `/index`. |
| Barrel initialization or side effects | All foundation roots were syntax-scanned: zero side-effect-only imports and zero top-level expression statements. Package metadata is `sideEffects: []` except `@beep/ui`'s CSS-only marker. This makes broad runtime initialization changes unlikely, but module-level initializers in the selected leaves still run. | Keep the pilot's behavior tests and dev cold-start measurement. Preserve `@beep/ui`'s `**/*.css` marker and do not use import changes to reorder unrelated application initialization. |
| Circular-dependency/evaluation-order changes | There are **100** same-package root imports in **76** foundation package test/story files, but **zero** under foundation `src/**`. Bypassing roots generally removes fan-out and should reduce cycle pressure; it can still expose a latent leaf-to-leaf cycle that a barrel evaluation order happened to mask. | Run package-family cycle checks and package tests after each batch. Treat any new cycle as a leaf dependency design issue; do not restore a root import as a shortcut. |
| Namespace conversion changes type syntax | 254 statement-level type imports, two mixed imports, 133 aliased bindings, 281 pre-existing Effect destination pairs, and 54 foundation destination pairs require more than textual replacement. | Use an AST codemod: preserve local aliases and `type`, emit `import type * as` where appropriate, group by target module, and merge with existing declarations. Format only touched files. |
| Generated output is overwritten | 35 target imports occur in 21 generated files; at least one generator template embeds a root import (`packages/drivers/runpod/scripts/generate.ts:439`). | Patch the owning generator/template first, regenerate, and verify generated diffs. Classify lint-rule negative fixtures separately so intentionally forbidden examples remain test inputs. |
| Documentation silently remains noncompliant | JSDoc and Markdown contribute 3,449 target import statements beyond executable code. Some are already invalid against current v4 (`TestClock` at the root, `TaggedErrorClass`, and two stale `VERSION` examples). | Give the codemod comment/fence modes, then run docgen. Route stale APIs to manual review rather than inventing a subpath. Include `.claude/skills/**` in enforcement or a companion docs audit. |
| Dynamic imports cannot always be one-for-one | Four dynamic root imports and three `import("effect")` type references exist. One CLI statement destructures five modules and one mock treats the Effect root as a namespace. | Split dynamic loads by target module, preferably with `Promise.all` where laziness matters; rewrite import-type qualifiers individually. Keep these in a manual-review output bucket. |
| Bundler externalization may match only the root | The existing effect-drizzle bundle probe explicitly externalizes both `effect` and `effect/*` (`packages/ecosystem/effect-drizzle/test/bundle-build.ts:12`), demonstrating the required pattern. Other bundler/plugin configurations may use exact-root matching. | Audit `external`, `noExternal`, dependency scanners, and transform allowlists for prefix handling. Run the measured pilot bundle before mass migration. |
| Lint/policy rules may encode the old source set | Existing policy rules sometimes list both root and leaf sources, for example schema checks accept `effect` and `effect/Schema` (`packages/tooling/policy-pack/lint-rules/src/rules/no-opaque-instance-fields.ts:24`, `packages/tooling/policy-pack/lint-rules/src/rules/no-inline-schema-compile.ts:56`). | Update source classifiers and their fixtures in the same warn-phase PR as enforcement; retain root recognition until the error ratchet reaches zero. |
| Lockfile/dependency assumptions | Rewriting module specifiers within the same declared packages should not change dependency versions. An unexpected `bun.lock` change would indicate a package/dependency edit, not the import migration itself. | Treat lockfile stability as a batch invariant. Export-map additions change package metadata/artifacts but should not trigger dependency resolution changes. |

### Codemod execution rules distilled from the census

1. Parse code, JSDoc example fences, and Markdown/MDX fences as separate modes;
   never use a global string replacement.
2. Resolve each source binding through the tables above and preserve its local
   alias. Group replacements by target module.
3. For namespace-source bindings, emit namespace imports; for flat
   Function/thunk/schema bindings, emit named imports. Carry type-only syntax
   onto the new declaration.
4. Merge with any existing target-module import in the file. Do not normalize
   namespace aliases as part of this migration.
5. Emit a manual-review record for dynamic root namespaces, root-surface tests,
   missing foundation leaves, stale documentation APIs, and deliberate lint
   fixtures.
6. Fix generators before generated output. Keep tests in scope; apply explicit
   exclusions only to agreed non-shipping scratchpad/exploration/packet paths.
7. Validate every produced module specifier against the installed/package
   export map, then format and run the package-family proof. The pilot measures
   bundle size, typecheck time, and dev cold start before the first mass batch.

## Bottom line

The executable migration starts at **2,089** Effect-root imports and **2,820**
foundation-root imports. Documentation adds **3,449** more import statements.
The Effect executable map is complete at **84/84 clean bindings**, with three
additional documentation-only bindings; `@beep/utils` is mechanically clean
for all 33 executable bindings, while `@beep/schema` needs exactly two new
leaf exports for five executable source bindings. The large remaining
foundation blockers are package-surface work (`@beep/observability`,
`@beep/dock`, and `@beep/dock-react`) plus a small number of root-only facades,
constants, and surface tests. An AST codemod can handle the ordinary majority,
but must produce a manual-review queue for the explicitly registered edge
classes rather than guessing.
