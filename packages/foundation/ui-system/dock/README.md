# @beep/dock

Headless, schema-first dock workspace state, commands, events, geometry, persistence, and reactive Atom session.

## Entrypoint and purity

| Entrypoint | Purpose | Purity |
| --- | --- | --- |
| `@beep/dock` | Dock domain algebra, reducer, engine, geometry, policy, and atoms | Framework- and DOM-free |

The package may use the pure `@beep/pretext` root for title measurement contracts. It never imports React, React DOM, `@effect/atom-react`, or `@beep/pretext/browser`.

## Usage

```ts
import { GroupId, Panel, PanelId, PopulatedWorkspace, TabsNode, TextPanelView, validateWorkspace } from "@beep/dock"
import { Effect } from "effect"

const panel = Panel.make({
  id: PanelId.make("panel-one"),
  title: "Panel One",
  view: TextPanelView.make({ text: "one" })
})
const workspace = PopulatedWorkspace.make({
  root: TabsNode.make({ groupId: GroupId.make("group-one"), active: panel })
})
const validated = Effect.runSync(validateWorkspace(workspace))

console.log(validated.root.groupId)
```

## Development

```bash
bun run build
bun run check
bun run test
bun run lint:fix
```

Tests and dtslint files import package source through `@beep/dock` or other `@beep/*` aliases. Relative imports are reserved for local fixtures and internal test-only projections.

## License

MIT
