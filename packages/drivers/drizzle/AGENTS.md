# Agent Guide

`@beep/drizzle` is the product-neutral Drizzle execution capability for
server-side adapters: it owns technical Drizzle failures and transaction
boundaries, not product repositories.

`EntityTable.pgTableFrom(entity)` projects `@beep/schema/EntitySchema`
definitions into typed Drizzle `pgTable` metadata. Concrete product tables
belong in table packages, never here. Projection tests may inspect table
metadata; live database execution belongs behind driver/server boundaries.
