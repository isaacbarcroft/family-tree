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
    // next/image rewrites the src through `/_next/image?url=...`, so assert
    // the rendered img reflects the new source URL (encoded).
    expect(img.getAttribute("src")).toContain(encodeURIComponent("https://example.com/replacement.jpg"));
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

  it("forwards the sizes prop to next/image (lets callers tune responsive variants)", () => {
    render(
      <PhotoFrame
        src="https://example.com/photo.jpg"
        alt="Eleanor at 22"
        sizes="(min-width: 1024px) 320px, 50vw"
      />,
    );
    const img = screen.getByRole("img", { name: "Eleanor at 22" });
    expect(img.getAttribute("sizes")).toBe("(min-width: 1024px) 320px, 50vw");
  });

  it("lazy-loads by default and only marks priority images eager", () => {
    const { rerender } = render(
      <PhotoFrame src="https://example.com/lazy.jpg" alt="lazy" />,
    );
    expect(screen.getByRole("img", { name: "lazy" }).getAttribute("loading")).toBe("lazy");

    rerender(<PhotoFrame src="https://example.com/hero.jpg" alt="hero" priority />);
    expect(screen.getByRole("img", { name: "hero" }).getAttribute("loading")).not.toBe("lazy");
  });

  it("skips the next/image optimizer for blob URLs (upload preview)", () => {
    render(<PhotoFrame src="blob:http://localhost/abc-123" alt="upload preview" />);
    const img = screen.getByRole("img", { name: "upload preview" });
    // Unoptimized mode passes the original src straight through instead of
    // routing it via `/_next/image?url=...`.
    expect(img.getAttribute("src")).toBe("blob:http://localhost/abc-123");
  });

  it("skips the next/image optimizer for Supabase render-image URLs (preserves HEIC format params)", () => {
    const renderUrl = "https://abc.supabase.co/storage/v1/render/image/public/memories/photo.heic?format=jpeg&quality=85";
    render(<PhotoFrame src={renderUrl} alt="HEIC memory" />);
    const img = screen.getByRole("img", { name: "HEIC memory" });
    expect(img.getAttribute("src")).toBe(renderUrl);
  });
});
