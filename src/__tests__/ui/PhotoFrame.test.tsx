import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PhotoFrame } from "@/components/ui/PhotoFrame";

const SUPABASE_PREFIX =
  "https://example.supabase.co/storage/v1/object/public/media/people/p/memories";

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
    expect(img.getAttribute("src")).toBe("https://example.com/replacement.jpg");
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

  it("lazy-loads the image by default", () => {
    render(<PhotoFrame src="https://example.com/photo.jpg" alt="Eleanor at 22" />);
    const img = screen.getByRole("img", { name: "Eleanor at 22" }) as HTMLImageElement;
    expect(img.getAttribute("loading")).toBe("lazy");
  });

  it("sets referrerPolicy=no-referrer so the Supabase URL is not leaked via the Referer header", () => {
    render(<PhotoFrame src="https://example.com/photo.jpg" alt="Eleanor at 22" />);
    const img = screen.getByRole("img", { name: "Eleanor at 22" }) as HTMLImageElement;
    expect(img.getAttribute("referrerpolicy")).toBe("no-referrer");
  });

  it("routes Supabase HEIC URLs through the render-image endpoint for cross-browser display", () => {
    render(
      <PhotoFrame
        src={`${SUPABASE_PREFIX}/photo.heic`}
        alt="HEIC memory"
      />,
    );
    const img = screen.getByRole("img", { name: "HEIC memory" }) as HTMLImageElement;
    expect(img.getAttribute("src")).toBe(
      `${SUPABASE_PREFIX.replace(
        "/storage/v1/object/public/",
        "/storage/v1/render/image/public/",
      )}/photo.heic?format=jpeg&quality=85`,
    );
  });

  it("passes non-HEIC URLs through unchanged", () => {
    render(
      <PhotoFrame src={`${SUPABASE_PREFIX}/photo.jpg`} alt="JPEG memory" />,
    );
    const img = screen.getByRole("img", { name: "JPEG memory" }) as HTMLImageElement;
    expect(img.getAttribute("src")).toBe(`${SUPABASE_PREFIX}/photo.jpg`);
  });

  it("passes blob: object URLs through unchanged (used by upload previews)", () => {
    render(<PhotoFrame src="blob:https://app/abc-123" alt="preview" />);
    const img = screen.getByRole("img", { name: "preview" }) as HTMLImageElement;
    expect(img.getAttribute("src")).toBe("blob:https://app/abc-123");
  });
});
