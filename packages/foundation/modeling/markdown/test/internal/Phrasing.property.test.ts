import { parsePhrasingText } from "@beep/markdown/internal/phrasing";
import { Paragraph, Root } from "@beep/markdown/MarkdownNode";
import * as Effect from "effect/Effect";
import { describePropertyFloor } from "./inlines/propertyFloor.ts";

describePropertyFloor({
  name: "phrasing fragment, round-tripped as one paragraph's inline content under a root,",
  templates: ["  {w}  ", "{w}\n\nnext", "[{w}](/url)", "~~{w}~~", "\\*{w}\\*"],
  parse: (source, dialect) =>
    Effect.sync(() => Root.make({ children: [Paragraph.make({ children: [...parsePhrasingText(source, dialect)] })] })),
});
