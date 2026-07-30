import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ProfessionalAtomProvider } from "@/runtime/ProfessionalAtomProvider";

afterEach(cleanup);

describe("ProfessionalAtomProvider", () => {
  it("renders children inside the desktop atom registry", () => {
    const { getByText } = render(
      <ProfessionalAtomProvider>
        <main>Professional workspace</main>
      </ProfessionalAtomProvider>
    );

    expect(getByText("Professional workspace")).toBeInTheDocument();
  });
});
