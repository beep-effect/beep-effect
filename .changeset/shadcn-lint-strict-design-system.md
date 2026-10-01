---
"@beep/ui": patch
"@beep/editor": patch
"@beep/dock-react": patch
"@beep/brand": patch
"@beep/graph-3d": patch
"@beep/epistemic-ui": patch
"@beep/ontology-ui": patch
"@beep/oip-web": patch
"@beep/todox": patch
"@beep/professional-desktop": patch
"@beep/storybook": patch
---

Adopt the strict `@shadcn/lint` design-system policy and fix every finding. Raw palette
colors and arbitrary values become theme tokens, inline styles become classes or CSS custom
properties, and consumer restyling moves to component props (`Button` `disabledTone`,
`CardHeader` `bordered`, `Textarea` `variant` and `font`, `Input` `font`, `Skeleton` `shape`,
`Avatar` `size` and `shape`, `ContentEditable` `variant`). `@beep/dock-react` now ships
`@beep/dock-react/dock.css`, which hosts must import: geometry is written as `--dock-*`
custom properties. `@beep/ui/components/chart` drops the `ChartStyle` export in favor of
`chartColorProperties`. Every UI workspace declares a `components.json` naming its Tailwind
entry stylesheet.
