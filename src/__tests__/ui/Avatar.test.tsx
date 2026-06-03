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
    // next/image rewrites the src through the /_next/image optimizer; the
    // original URL is preserved as the `url=` query param.
    expect(img.getAttribute("src")).toContain(encodeURIComponent("https://example.com/x.jpg"));
  });

  it("falls back to initials when the image errors", () => {
    render(<Avatar name="Margaret Doe" src="https://example.com/missing.jpg" />);
    const img = screen.getByRole("img", { name: "Margaret Doe" });
    fireEvent.error(img);
    expect(screen.getByText("MD")).toBeInTheDocument();
  });

  it("retries the new image after a previous src errored (resets failed state on src change)", () => {
    const { rerender } = render(
      <Avatar name="Margaret Doe" src="https://example.com/missing.jpg" />,
    );
    fireEvent.error(screen.getByRole("img", { name: "Margaret Doe" }));
    expect(screen.getByText("MD")).toBeInTheDocument();

    rerender(<Avatar name="Margaret Doe" src="https://example.com/replacement.jpg" />);
    const img = screen.getByRole("img", { name: "Margaret Doe" });
    expect(img.getAttribute("src")).toContain(
      encodeURIComponent("https://example.com/replacement.jpg"),
    );
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

  it("passes the size through to next/image width and height attributes", () => {
    render(<Avatar name="Henry Wells" src="https://example.com/h.jpg" size={56} />);
    const img = screen.getByRole("img", { name: "Henry Wells" });
    expect(img.getAttribute("width")).toBe("56");
    expect(img.getAttribute("height")).toBe("56");
  });
});
