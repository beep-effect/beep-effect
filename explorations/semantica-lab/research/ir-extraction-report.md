# Semantica IR extraction report

Source: read-only `danklocal` at `add1c006cd8c502f6f2981e251e9e9a0f774870d`.

## Result

- Records: 6,105 from 354 Python files.
- Validation: 0 violations; 0 parse failures.
- Public symbols with docstrings: 3,271 / 3,933 (83.2%).
- Symbols with parsed sections: 2,287 / 6,105 (37.5%); 48.3% of 4,735 docstring-bearing symbols.
- Output SHA-256: `0d7fe014c3588327aac12a9e4219468fa425ad6b381f38103c0b5012834f353e`.
- Kinds: 493 class, 496 constant, 176 dataclass, 994 function, 3,838 method,
  4 protocol, 104 Pydantic model.

## Records per layer

| Layer | Records |
| --- | ---: |
| input | 1,104 |
| core | 1,233 |
| storage | 1,023 |
| qa | 228 |
| context_memory | 771 |
| output | 1,015 |
| utilities | 731 |

## Records per module family

Root files include `semantica`, `cli`, `server`, and `worker`.

| Module family | Records | Module family | Records |
| --- | ---: | --- | ---: |
| semantica (root) | 284 | semantica.change_management | 116 |
| semantica.conflicts | 117 | semantica.context | 541 |
| semantica.core | 115 | semantica.deduplication | 111 |
| semantica.embeddings | 108 | semantica.evals | 0 |
| semantica.explorer | 427 | semantica.export | 306 |
| semantica.graph_store | 304 | semantica.ingest | 543 |
| semantica.kg | 429 | semantica.llms | 39 |
| semantica.mcp_server | 23 | semantica.normalize | 182 |
| semantica.ontology | 293 | semantica.parse | 256 |
| semantica.pipeline | 144 | semantica.provenance | 114 |
| semantica.reasoning | 146 | semantica.seed | 17 |
| semantica.semantic_extract | 365 | semantica.split | 123 |
| semantica.triplet_store | 210 | semantica.utils | 253 |
| semantica.vector_store | 401 | semantica.visualization | 138 |

Top 10: ingest 543; context 541; kg 429; explorer 427; vector_store 401;
semantic_extract 365; export 306; graph_store 304; ontology 293; parse 256.

## Gaps and parse notes

- No file was skipped. The extractor stripped a UTF-8 BOM from
  `semantica/explorer/routes/decisions.py`, `graph.py`, and `vocabulary.py` before parsing.
- Constant extraction covers uppercase module/class assignments and `Final` annotations.
- `raises` and `registry_names` are syntax-only. Dynamic names and indirect raises are not inferred.
- Registry scanning accepts literal strings in register/registry calls; computed values are omitted.
- The doc parser supports only the six contracted sections. A repeated section keeps its last body.
- Class kind detection recognizes direct `dataclass`, `BaseModel`, and `Protocol` syntax, not aliases.

## Sample records

```jsonl
{"bases":["Enum"],"decorators":[],"docstring":{"raw":"","sections":{},"summary":""},"end_lineno":137,"file":"semantica/change_management/change_log.py","is_public":true,"kind":"class","layer":"context_memory","lineno":132,"module":"semantica.change_management.change_log","params":[],"qualname":"Severity","raises":[],"registry_names":[],"returns":null,"signature":"class Severity(Enum)"}
{"bases":[],"decorators":[],"docstring":{"raw":"Public API for generating impact reports from diffs.","sections":{},"summary":"Public API for generating impact reports from diffs."},"end_lineno":279,"file":"semantica/change_management/change_log.py","is_public":true,"kind":"function","layer":"context_memory","lineno":276,"module":"semantica.change_management.change_log","params":[{"annotation":"Dict[str, Any]","default":null,"name":"diff"}],"qualname":"generate_change_report","raises":[],"registry_names":[],"returns":"Dict[str, Any]","signature":"(diff: Dict[str, Any]) -> Dict[str, Any]"}
{"bases":[],"decorators":[],"docstring":{"raw":"","sections":{},"summary":""},"end_lineno":165,"file":"semantica/change_management/change_log.py","is_public":true,"kind":"method","layer":"context_memory","lineno":155,"module":"semantica.change_management.change_log","params":[{"annotation":null,"default":null,"name":"self"}],"qualname":"ImpactReport.to_dict","raises":[],"registry_names":[],"returns":"Dict[str, Any]","signature":"(self) -> Dict[str, Any]"}
```
