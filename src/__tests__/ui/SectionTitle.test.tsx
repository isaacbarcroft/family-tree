import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SectionTitle } from "@/components/ui/SectionTitle";

describe("SectionTitle", () => {
  it("renders the title as an h2 by default", () => {
    render(<SectionTitle title="Chapters of a life" />);
    const heading = screen.getByRole("heading", { level: 2, name: "Chapters of a life" });
    expect(heading).toBeInTheDocument();
  });

  it("renders the title as an h1 when level=1", () => {
    render(<SectionTitle title="Eleanor" level={1} />);
    expect(screen.getByRole("heading", { level: 1, name: "Eleanor" })).toBeInTheDocument();
  });

  it("renders the eyebrow when provided", () => {
    render(<SectionTitle eyebrow="A LIFE · VOLUME I" title="Eleanor" />);
    expect(screen.getByText("A LIFE · VOLUME I")).toBeInTheDocument();
  });

  it("renders the subtitle when provided", () => {
    render(<SectionTitle title="People" subtitle="62 in the family" />);
    expect(screen.getByText("62 in the family")).toBeInTheDocument();
  });

  it("renders the action when provided", () => {
    render(<SectionTitle title="People" action={<button type="button">Add</button>} />);
    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
  });
});
