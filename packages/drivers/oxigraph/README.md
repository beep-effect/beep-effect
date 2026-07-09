# @beep/oxigraph

Driver-level SPARQL query service backed by Oxigraph's WebAssembly package.

The package implements `@beep/semantic-web/services/sparql-query` through a
lazy live Layer. Importing `@beep/oxigraph` does not initialize WebAssembly;
the `oxigraph` package is loaded only when a query executes.
