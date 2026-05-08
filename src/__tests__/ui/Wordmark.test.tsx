import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Wordmark } from "@/components/ui/Wordmark";

describe("Wordmark", () => {
  it("renders the brand text", () => {
    render(<Wordmark />);
    expect(screen.getByText("Family Legacy")).toBeInTheDocument();
  });

  it("renders the SVG mark", () => {
    const { container } = render(<Wordmark />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("scales SVG with the size prop", () => {
    const { container } = render(<Wordmark size={32} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("38");
  });
});
