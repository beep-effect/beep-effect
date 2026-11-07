import * as Domain from "@alchemy.run/domain";
import { scenarios } from "./scenarios.ts";

scenarios({ name: "Domain.InMemory", platform: Domain.InMemory });
