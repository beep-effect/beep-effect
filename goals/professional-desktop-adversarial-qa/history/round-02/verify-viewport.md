# Viewport verification

## Raw output

Chat

```json
{"surface":"#chat","documentScrolls":false,"bodyScrolls":false,"scrollHeight":959,"clientHeight":959,"innerScrollers":2,"themeToggleInNav":true}
```

Ontology

```json
{"surface":"#ontology","documentScrolls":false,"bodyScrolls":false,"scrollHeight":959,"clientHeight":959,"innerScrollers":1,"themeToggleInNav":true}
```

Vault sync

```json
{"surface":"#sync","documentScrolls":false,"bodyScrolls":false,"scrollHeight":959,"clientHeight":959,"innerScrollers":0,"themeToggleInNav":true}
```

Home

```json
{"surface":"#home","documentScrolls":false,"bodyScrolls":false,"scrollHeight":959,"clientHeight":959,"innerScrollers":0,"themeToggleInNav":true}
```

(a) The document does not scroll on any surface: Chat false; Ontology false; Vault sync false; Home false.

(b) Inner scrollers: Chat 2; Ontology 1; Vault sync 0; Home 0.

(c) On Chat, the duplicate “Professional Desktop — Chat” title bar is gone: yes.

(d) A theme toggle is reachable from the nav on all four surfaces: yes.

(e) Nothing is clipped or unreachable. Chat’s transcript and thread sidebar remain reachable through their two inner scrollers. Ontology’s lower inspector content remains reachable through its single inner scroller. Vault sync and Home fit without inner scrolling.

## Screenshots

- `verify-viewport-chat.png`
- `verify-viewport-ontology.png`
- `verify-viewport-sync.png`
- `verify-viewport-home.png`
