import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PhotoFrame } from "@/components/ui/PhotoFrame";

describe("PhotoFrame", () => {
  it("renders the placeholder label when no src is provided", () => {
    render(<PhotoFrame label="missing photo" />);
    expect(screen.getByText("missing photo")).toBeInTheDocument();
  });

  it("renders the image when src is provided", () => {
    render(<PhotoFrame src="https://example.com/photo.jpg" alt="Eleanor at 22" />);
    expect(screen.getByRole("img", { name: "Eleanor at 22" })).toBeInTheDocument();
  });

  it("falls back to the placeholder label when the image errors", () => {
    render(
      <PhotoFrame
        src="https://example.com/missing.jpg"
        alt="Eleanor at 22"
        label="photograph"
      />,
    );
    fireEvent.error(screen.getByRole("img", { name: "Eleanor at 22" }));
    expect(screen.getByText("photograph")).toBeInTheDocument();
  });

  it("retries the new image after a previous src errored (resets failed state on src change)", () => {
    const { rerender } = render(
      <PhotoFrame src="https://example.com/missing.jpg" alt="Eleanor at 22" label="photograph" />,
    );
    fireEvent.error(screen.getByRole("img", { name: "Eleanor at 22" }));
    expect(screen.getByText("photograph")).toBeInTheDocument();

    rerender(
      <PhotoFrame src="https://example.com/replacement.jpg" alt="Eleanor at 22" label="photograph" />,
    );
    const img = screen.getByRole("img", { name: "Eleanor at 22" });
    // next/image rewrites the src through the /_next/image optimizer; the
    // original URL is preserved as the `url=` query param.
    expect(img.getAttribute("src")).toContain(
      encodeURIComponent("https://example.com/replacement.jpg"),
    );
  });

  it("applies the requested aspect ratio", () => {
    const { container } = render(<PhotoFrame ratio="3 / 2" />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.aspectRatio).toBe("3 / 2");
  });

  it("adds a 1px hairline + shadow when frame is true", () => {
    const { container } = render(<PhotoFrame frame />);
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.border).toContain("1px solid");
    expect(wrapper.style.boxShadow).toContain("var(--shadow-sm)");
  });

  it("passes the sizes hint through to next/image", () => {
    render(
      <PhotoFrame
        src="https://example.com/photo.jpg"
        alt="grid tile"
        sizes="(min-width: 1024px) 33vw, 100vw"
      />,
    );
    const img = screen.getByRole("img", { name: "grid tile" });
    expect(img.getAttribute("sizes")).toBe("(min-width: 1024px) 33vw, 100vw");
  });

  it("renders inside a position:relative parent (required by next/image fill)", () => {
    const { container } = render(<PhotoFrame src="https://example.com/photo.jpg" alt="t" />);
    const wrapper = container.firstElementChild as HTMLElement;
    // The Tailwind `relative` class gives the fill-mode image a valid CSS
    // containing block. JSDOM doesn't compute the cascade, so assert on the
    // class instead of getComputedStyle.
    expect(wrapper.className).toContain("relative");
  });
});
