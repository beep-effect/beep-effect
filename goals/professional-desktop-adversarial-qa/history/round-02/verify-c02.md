# C02 persisted Mermaid verification

Claim reproduced in Chrome at `http://127.0.0.1:1421` after creating a new
thread, waiting for the response to finish, and reloading the page to force the
persisted viewer.

## Exact probe output

```json
{
  "count": 1,
  "out": [
    {
      "hidden": true,
      "codeText": "graph TD  A[Start] --> B[End]",
      "nextTag": null,
      "nextAttrs": null,
      "nextHTML": null,
      "parentHTML": "<div aria-autocomplete=\"none\" aria-readonly=\"true\" class=\"relative block focus:outline-none\" contenteditable=\"false\" role=\"textbox\" spellcheck=\"true\" style=\"user-select: text; white-space: pre-wrap; word-break: break-word;\" data-lexical-editor=\"true\"><code class=\"EditorTheme__code\" spellcheck=\"false\" data-language=\"mermaid\" dir=\"auto\" hidden=\"\"><span data-lexical-text=\"true\">graph TD</span><br><sp"
    }
  ],
  "anyDiagram": 0
}
```

## Required answers

(a) Is the mermaid `<code>` hidden? **yes**

(b) Does a sibling portal container exist? **no**

(c) If it exists, is it empty? **no** — not applicable because no sibling
portal container exists.

(d) How many `[data-testid="mermaid-diagram"]` elements are on the page?
**0**

(e) Is the diagram VISIBLE to a user? **no**

There is no sibling container `div` next to the hidden `<code>`. Consequently,
there is no rendered diagram, pending box, or error box mounted there.

## Console errors

Every console error matching `mermaid|Mermaid|Error`: **none** (`[]`).

## Screenshot

`goals/professional-desktop-adversarial-qa/history/round-02/screenshots/verify-c02-mermaid.png`
