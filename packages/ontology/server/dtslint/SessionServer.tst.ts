import { OntologyFileStoreLayer, SessionServerLayer, TurtleCodecLayer } from "@beep/ontology-server/aggregates/Session";
import { expect } from "tstyche";

expect(OntologyFileStoreLayer).type.not.toBe<never>();
expect(TurtleCodecLayer).type.not.toBe<never>();
expect(SessionServerLayer).type.not.toBe<never>();
