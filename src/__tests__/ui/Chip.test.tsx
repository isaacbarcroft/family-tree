import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Chip } from "@/components/ui/Chip";

describe("Chip", () => {
  it("renders children", () => {
    render(<Chip>Eldest</Chip>);
    expect(screen.getByText("Eldest")).toBeInTheDocument();
  });

  it("uses sage tokens for the sage tone", () => {
    render(<Chip tone="sage">Sage</Chip>);
    const chip = screen.getByText("Sage");
    expect(chip.style.background).toContain("--sage-tint");
    expect(chip.style.color).toContain("--sage-deep");
  });

  it("uses clay tokens for the clay tone", () => {
    render(<Chip tone="clay">Birthday</Chip>);
    const chip = screen.getByText("Birthday");
    expect(chip.style.background).toContain("--clay-tint");
  });

  it("renders an icon when provided", () => {
    const { container } = render(<Chip icon="cake">Birthday</Chip>);
    expect(container.querySelector("svg")).not.toBeNull();
  });
});
