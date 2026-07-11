# @beep/shacl Agent Notes

This package is the driver-level SHACL implementation for the semantic-web
`ShaclValidationService` contract. Keep external SHACL engine imports lazy and
contained in this package; server/use-case packages should depend on the
semantic-web contract plus this Layer, not on engine internals.

