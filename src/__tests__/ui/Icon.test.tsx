import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { Icon } from "@/components/ui/Icon";

describe("Icon", () => {
  it("renders an SVG with the requested size", () => {
    const { container } = render(<Icon name="search" size={24} />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("width")).toBe("24");
    expect(svg?.getAttribute("height")).toBe("24");
  });

  it("uses currentColor for stroke so it inherits text color", () => {
    const { container } = render(<Icon name="people" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("stroke")).toBe("currentColor");
  });

  it("is marked aria-hidden so screen readers skip it", () => {
    const { container } = render(<Icon name="heart" />);
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("renders the path for the named icon", () => {
    const { container } = render(<Icon name="check" />);
    const path = container.querySelector("svg path");
    expect(path?.getAttribute("d")).toBe("M4 10l3 3 8-8");
  });
});
