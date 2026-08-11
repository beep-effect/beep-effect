New [FOLIO MCP Server: Use FOLIO in Claude Code, Gemini CLI, and Codex »](https://openlegalstandard.org/resources/folio-mcp)

# FOLIO MCP Server

The FOLIO MCP Server brings the full power of the FOLIO legal ontology — 18,000+ concepts covering areas of law, document types, legal entities, and more — directly into AI coding assistants like Claude Code, Gemini CLI, and OpenAI Codex.

Using the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/), the FOLIO MCP server gives AI assistants real-time access to search, browse, and export legal concepts without leaving the development environment. This enables AI-assisted legal software development, document classification, and ontology-driven workflows.

| Resource | Link |
| --- | --- |
| PyPI Package | [https://pypi.org/project/folio-mcp/](https://pypi.org/project/folio-mcp/) |
| GitHub Repository | [https://github.com/alea-institute/folio-mcp](https://github.com/alea-institute/folio-mcp) |
| FOLIO API (Backend) | [https://folio.openlegalstandard.org/docs](https://folio.openlegalstandard.org/docs) |

## Quick Start

### Prerequisites

- Python 3.10+ and [uv](https://docs.astral.sh/uv/) installed
- One of: Claude Code, Gemini CLI, OpenAI Codex, VS Code, or Cursor

### Claude Code

```
claude mcp add folio -- uvx folio-mcp
```

Or create `.mcp.json` in your project root:

```
{
  "mcpServers": {
    "folio": {
      "command": "uvx",
      "args": ["folio-mcp"]
    }
  }
}
```

### Gemini CLI

```
gemini mcp add folio uvx folio-mcp
```

### OpenAI Codex

```
codex mcp add folio -- uvx folio-mcp
```

### Cursor

Add to `.cursor/mcp.json` in your project:

```
{
  "mcpServers": {
    "folio": {
      "command": "uvx",
      "args": ["folio-mcp"]
    }
  }
}
```

### VS Code

Add to your User Settings (JSON):

```
{
  "mcp": {
    "servers": {
      "folio": {
        "command": "uvx",
        "args": ["folio-mcp"]
      }
    }
  }
}
```

### Remote (Streamable HTTP)

Connect to the hosted endpoint — no installation required:

```
https://folio.openlegalstandard.org/mcp
```

## Available Tools

The FOLIO MCP server provides 12 tools for searching, browsing, and exporting legal concepts:

| Tool | Description |
| --- | --- |
| search\_concepts | Search concepts by label (name) — primary entry point |
| search\_definitions | Search concepts by definition text |
| query\_concepts | Advanced query with composable text and structural filters |
| query\_properties | Query OWL object properties by label, domain, range |
| get\_concept | Get full details for a concept by IRI |
| export\_concept | Export as Markdown, JSON-LD, or OWL XML |
| list\_branches | List all 24 taxonomy branches with concept counts |
| get\_taxonomy\_branch | Get all concepts in a specific branch |
| get\_children | Get child concepts in the taxonomy |
| get\_parents | Get parent concepts in the taxonomy |
| get\_properties | List all OWL object properties |
| find\_connections | Find semantic connections between concepts |

For detailed documentation of each tool including parameters, examples, and rich workflow walkthroughs, see the **[FOLIO MCP Tools Reference](https://openlegalstandard.org/resources/folio-mcp-tools)**.

All tool responses include full concept data when available: **translations** (31% of concepts across 10+ languages including Spanish, French, Japanese, Chinese, Hindi), preferred labels, external identifiers (ISO codes, SALI codes), alternative labels, cross-references, and more.

## Resources

The server also exposes MCP resources for direct context access:

| Resource URI | Description |
| --- | --- |
| `folio://branches` | Index of all 24 taxonomy branches with concept counts |
| `folio://stats` | Ontology statistics — version, class/property counts, license |
| `folio://branch/{name}` | Top-level concepts in a specific branch (on-demand) |

## Prompt Templates

The server includes reusable prompt templates that guide the AI through structured classification workflows:

| Prompt | Description | Argument |
| --- | --- | --- |
| classify-document | Classify a legal document against the FOLIO taxonomy | description |
| identify-area-of-law | Identify applicable areas of law for a situation | situation |
| classify-entity | Classify a legal entity (person, organization, role) | entity |
| classify-industry | Classify the industry sector for a matter or client | description |
| identify-legal-authority | Identify the type of legal authority (statute, regulation, case law, etc.) | authority |
| classify-event | Classify a legal event (dispute, transaction, regulatory action, etc.) | event |
| identify-service-type | Identify the type of legal service needed for a matter | matter |
| identify-forum-venue | Identify the appropriate forum, venue, or governmental body | matter |
| identify-objective | Identify legal objectives for a matter | matter |
| classify-asset | Classify an asset type (tangible, intangible, financial, estate) | asset |
| identify-engagement-terms | Identify engagement terms for a legal services arrangement | arrangement |

## Examples

### Classifying a contract clause

Ask your AI assistant: _“Search FOLIO for assignment clause”_

The assistant will search the ontology and find:

- **Assignment Clause** — provision allowing a party to transfer rights or obligations
- Plus narrower subtypes: Assignment by Buyer Clause, Assignment of Claims Clause, Assignment of Rents Clause, Consent to Assignment Clause, No Assignment Clause, Reassignment Clause

### Navigating the court hierarchy

Ask: _“Show me the U.S. court system in FOLIO”_

The assistant will browse the `forum_venues` branch and find the Dispute Venue hierarchy:

- **U.S. Courts** — Federal Courts, State Courts (all 50 states)
- **Alternative Dispute Resolution Venues** — Arbitration, Mediation
- **Administrative Proceeding Venues** — USPTO, MSPB, and other agencies
- **Legislative Proceedings**

### Browsing areas of law

Ask: _“What areas of law does FOLIO define?”_

The assistant will read the `folio://branches` resource, then browse `areas_of_law` to find all 31 practice areas — from Agriculture Law to Transportation Law — each with definitions and translations in 10+ languages.

### Classifying a document type

```
1. search_concepts("software licensing agreement")
   → Finds: Software License Agreement, License Agreement, ...

2. get_concept(iri)
   → Full details: definition, translations, parent/child concepts

3. get_parents(iri)
   → Taxonomy path: Software License Agreement → License Agreement
     → Contract → Transactional Document → Document Types

4. export_concept(iri, format="jsonld")
   → Machine-readable JSON-LD for integration
```

### Multilingual concept lookup

Many FOLIO concepts include translations in 10+ languages. When you retrieve a concept like “U.S. Postal Service”, you get:

- **es-es**: Servicio Postal de EE. UU.
- **fr-fr**: Service postal des États-Unis
- **ja-jp**: アメリカ合衆国郵便公社
- **zh-cn**: 美国邮政服务
- **hi-in**: यूएस पोस्टल सर्विस

## Architecture

The MCP server supports two modes:

### API Mode (Default)

```
AI Assistant → stdio → folio-mcp → HTTPS → folio.openlegalstandard.org
```

Lightweight client that calls the public FOLIO REST API. No API key required — the FOLIO API is freely available with open CORS.

### Local Mode

```
AI Assistant → stdio → folio-mcp → in-process → FOLIO ontology
```

Loads the full ontology in-process for offline or low-latency use. Requires the `folio-python[search]` package:

```
{
  "mcpServers": {
    "folio-local": {
      "command": "uvx",
      "args": ["folio-mcp", "--local"]
    }
  }
}
```

## Use Cases

- **Legal software development**: Classify documents, entities, and events using FOLIO’s standardized taxonomy
- **Contract analysis**: Map contract types and clauses to FOLIO categories
- **Compliance workflows**: Identify relevant areas of law and regulatory frameworks
- **Legal research**: Explore relationships between legal concepts and their definitions
- **Data interoperability**: Export concepts in JSON-LD or OWL XML for system integration

## Contributing

Contributions are welcome! Visit the [folio-mcp GitHub repository](https://github.com/alea-institute/folio-mcp) to report issues, suggest features, or submit pull requests.

## License

The FOLIO MCP server is released under the MIT License. See the [LICENSE](https://github.com/alea-institute/folio-mcp/blob/main/LICENSE) file for details.

## Support

If you encounter any issues or have questions, please [open an issue on GitHub](https://github.com/alea-institute/folio-mcp/issues) or visit the [FOLIO community forum](https://discourse.openlegalstandard.org/c/folio-technical-discussion/folio-software/7).