# Graph and ontology navigation verification

Target: `http://127.0.0.1:1421`

## 1. Ontology graph

(a) Graph backend badge: `pending`

(b) Is a graph/diagram actually visible (nodes rendered on the canvas)? **no**

The page reports `nodes 12` and `edges 10`, but no graph nodes are visibly rendered. The graph area is blank and the Turtle source content occupies the main panel.

(c) Verbatim evaluation result:

```json
{"pending":false,"canvas":0,"text":["pending","nodes","edges"]}
```

Evidence: `screenshots/verify-graph-fixed.png`

This fix is still broken: the backend badge remains `pending`, there are zero `canvas` elements, and no node diagram is visible after waiting approximately 15 seconds.

## 2. Ontology navigation persistence

Applied edit before navigation:

- Subject: `https://example.org/pizza#Pizza`
- Predicate: `http://www.w3.org/2000/01/rdf-schema#label`
- Literal value: `Navigation persistence QA`
- State before leaving Ontology: `1 applied`, `Dirty`

Then clicked Chat, waited 60 seconds, and clicked Ontology.

(d) Is the same document still open (not "no file open")? **yes**

The path remained `tmp/ontology-workbench/pizza-tutorial.ttl`.

(e) Is the applied edit still in the change log / is the dirty badge still as left? **yes**

After returning, the page still showed the `Navigation persistence QA` resource, the change log showed `1 applied` with `addQuad`, and the badge remained `Dirty`.

Evidence: `screenshots/verify-ontology-nav.png`
