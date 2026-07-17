# @beep/dock-react

React adapter for the `@beep/dock` workspace kernel.

## Entrypoint and boundary

| Entrypoint | Purpose | Dependency direction |
| --- | --- | --- |
| `@beep/dock-react` | React rendering, portal keep-alive, pointer gestures, and adapter API | One-way to the headless `@beep/dock` kernel |

The public surface is the `DockviewReact` component, its renderer and option
types, and the `DockviewAdapterApi` exposed through `onReady`. Internal role
modules are available to workspace tests and follow-on package work but are
not published entrypoints.

The adapter keeps `PretextCaptureLive` from `@beep/pretext/browser` only as the
overridable default title-measurement layer. The kernel remains DOM- and
framework-free; browser capture does not flow back into `@beep/dock`.

## Development

```bash
bun run build
bun run check
bun run test
bun run lint:fix
bun run docgen
```

Tests import package source through `@beep/dock-react` and `@beep/dock`.

## License

MIT
