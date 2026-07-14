# Running desktop fix verification

Target: `http://127.0.0.1:1421`

## 1. Persisted mermaid diagram

After the model finished and the page was reloaded, the diagram was visible.

Exact probe output:

```json
{"diagrams":1,"svgs":1,"leftoverCode":0}
```

- (a) Is a diagram VISIBLE after reload? yes
- (b) diagrams count: 1
- (c) leftoverCode count: 0

Screenshot: `screenshots/verify-mermaid-fixed.png`

## 2. YouTube block coverage

- (a) Does an embedded player/iframe appear (not a plain link)? yes
- (b) After a reload, is it still an embed? yes
- (c) `document.querySelectorAll('iframe').length`: 1

The iframe was present, but the embedded YouTube player displayed `Video unavailable`. A separate `Watch on YouTube` link was also rendered below the iframe.

Screenshot: `screenshots/verify-youtube-block.png`

## 3. Composer idle send

I typed `hello`, waited 60 seconds without touching the page, and pressed Enter.

- (a) Did it send? yes
- (b) Any red error/toast? No red error or toast appeared.

The sent `hello` message appeared in the thread, followed by the model response `Hello! How can I help you today?`

Screenshot: `screenshots/verify-composer-idle.png`

## 4. Thread selection survives navigation

I selected the older thread titled `plain hello`, clicked `Vault sync`, waited 60 seconds, and clicked `Chat`.

- (a) Are you still in the SAME thread you selected? yes
- (b) Which thread is highlighted? `plain hello` (dated `Jul 12`)

The main chat content after returning showed the selected thread's `plain hello` message and its response.

Screenshot: `screenshots/verify-thread-selection.png`
