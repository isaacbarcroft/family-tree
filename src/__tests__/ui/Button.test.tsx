import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Button } from "@/components/ui/Button";

describe("Button", () => {
  it("renders children", () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("defaults to primary variant", () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole("button", { name: "Go" })).toHaveAttribute("data-variant", "primary");
  });

  it("renders ghost and quiet variants when requested", () => {
    const { rerender } = render(<Button variant="ghost">G</Button>);
    expect(screen.getByRole("button", { name: "G" })).toHaveAttribute("data-variant", "ghost");
    rerender(<Button variant="quiet">Q</Button>);
    expect(screen.getByRole("button", { name: "Q" })).toHaveAttribute("data-variant", "quiet");
  });

  it("renders an icon when icon prop is provided", () => {
    const { container } = render(<Button icon="plus">Add</Button>);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);
    fireEvent.click(screen.getByRole("button", { name: "Click" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("defaults type to button (not submit) so it doesn't submit forms by accident", () => {
    render(<Button>Hi</Button>);
    expect(screen.getByRole("button", { name: "Hi" })).toHaveAttribute("type", "button");
  });

  it("respects size prop", () => {
    render(<Button size="lg">Big</Button>);
    expect(screen.getByRole("button", { name: "Big" })).toHaveAttribute("data-size", "lg");
  });
});
