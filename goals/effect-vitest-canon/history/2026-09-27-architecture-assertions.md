# Architecture-lab assertion phase

Replace the Client, Server and UI view-model Option.none checks with assertNone,
preserving each operand and absence polarity. Keep all fixed metadata, lifecycle,
wire-shape and redaction assertions. All three affected package audits and
docgen pass before the property phase.
