# FOLIO MCP — original research notes

Source: https://openlegalstandard.org/resources/folio-mcp/

Captured: 2026-08-11. The upstream page's redistribution terms were not
verified, so this file records original notes rather than a page copy. Treat
the linked page and repository as authoritative.

## What matters for this packet

- The server exposes the FOLIO legal taxonomy to MCP clients through search,
  browse, relationship, and export operations.
- The documented client pattern is a local stdio server launched with
  `uvx folio-mcp`; a hosted streamable-HTTP mode also exists.
- The page describes API-backed and local-data modes. The local mode is the
  relevant pattern for this repo's no-live-external-runtime-dependency rule.
- The useful design donor is the navigational tool shape, not a new runtime:
  beep-effect already has a governed ontology MCP surface and should extend
  that surface with read-only taxonomy browsing.
- Examples emphasize classification, hierarchy navigation, branch browsing,
  document-type lookup, and multilingual concept lookup.

## Linked upstream artifacts

- Server repository: https://github.com/alea-institute/folio-mcp
- Package: https://pypi.org/project/folio-mcp/
- FOLIO API documentation: https://folio.openlegalstandard.org/docs
- MCP specification: https://modelcontextprotocol.io/

## Provenance and use

The page is a reference-only product description until its redistribution
terms are established. Software and ontology-data licenses must be verified
from their respective repositories before copying code or data. The packet's
central disposition is maintained in [`../SOURCES.md`](../SOURCES.md).
