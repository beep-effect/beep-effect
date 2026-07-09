import { OpenOntologyFileCommand, SessionUseCases, WorkerCommand } from "@beep/ontology-use-cases/aggregates/Session";
import { expect } from "tstyche";

expect(OpenOntologyFileCommand).type.not.toBe<never>();
expect(SessionUseCases).type.not.toBe<never>();
expect(WorkerCommand).type.not.toBe<never>();
