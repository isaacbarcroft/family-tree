import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Avatar } from "@/components/ui/Avatar";

describe("Avatar", () => {
  it("renders initials when no src is provided", () => {
    render(<Avatar name="Eleanor Barcroft" />);
    expect(screen.getByText("EB")).toBeInTheDocument();
  });

  it("renders the image when src is provided and loads", () => {
    render(<Avatar name="Eleanor Barcroft" src="https://example.com/x.jpg" />);
    const img = screen.getByRole("img", { name: "Eleanor Barcroft" });
    expect(img).toBeInTheDocument();
    expect(img.getAttribute("src")).toBe("https://example.com/x.jpg");
  });

  it("falls back to initials when the image errors", () => {
    render(<Avatar name="Margaret Doe" src="https://example.com/missing.jpg" />);
    const img = screen.getByRole("img", { name: "Margaret Doe" });
    fireEvent.error(img);
    expect(screen.getByText("MD")).toBeInTheDocument();
  });

  it("caps initials at two characters", () => {
    render(<Avatar name="Mary Lou Catherine Smith" />);
    expect(screen.getByText("ML")).toBeInTheDocument();
  });

  it("respects size", () => {
    const { container } = render(<Avatar name="A B" size={64} />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.width).toBe("64px");
    expect(wrapper.style.height).toBe("64px");
  });
});
