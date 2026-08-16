# Agent Guide

`@beep/drizzle` is the product-neutral Drizzle execution capability for
server-side adapters: it owns technical Drizzle failures and transaction
boundaries, not product repositories.

Entity-to-table projection lives in `@beep/effect-drizzle`; concrete product
tables belong in table packages, never here. This driver remains limited to
execution, transactions, and technical error normalization behind
driver/server boundaries.
