import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PhotoFrame } from "@/components/ui/PhotoFrame";

const SUPABASE_PREFIX =
  "https://abc.supabase.co/storage/v1/object/public/media/people/p1/memories";

describe("PhotoFrame", () => {
  it("renders the placeholder label when no src is provided", () => {
    render(<PhotoFrame label="missing photo" />);
    expect(screen.getByText("missing photo")).toBeInTheDocument();
  });

  it("renders the image when src is provided", () => {
    render(
      <PhotoFrame src={`${SUPABASE_PREFIX}/photo.jpg`} alt="Eleanor at 22" />,
    );
    expect(screen.getByRole("img", { name: "Eleanor at 22" })).toBeInTheDocument();
  });

  it("falls back to the placeholder label when the image errors", () => {
    render(
      <PhotoFrame
        src={`${SUPABASE_PREFIX}/missing.jpg`}
        alt="Eleanor at 22"
        label="photograph"
      />,
    );
    fireEvent.error(screen.getByRole("img", { name: "Eleanor at 22" }));
    expect(screen.getByText("photograph")).toBeInTheDocument();
  });

  it("retries the new image after a previous src errored (resets failed state on src change)", () => {
    const { rerender } = render(
      <PhotoFrame
        src={`${SUPABASE_PREFIX}/missing.jpg`}
        alt="Eleanor at 22"
        label="photograph"
      />,
    );
    fireEvent.error(screen.getByRole("img", { name: "Eleanor at 22" }));
    expect(screen.getByText("photograph")).toBeInTheDocument();

    rerender(
      <PhotoFrame
        src={`${SUPABASE_PREFIX}/replacement.jpg`}
        alt="Eleanor at 22"
        label="photograph"
      />,
    );
    const img = screen.getByRole("img", { name: "Eleanor at 22" });
    expect(img.getAttribute("src")).toBe(`${SUPABASE_PREFIX}/replacement.jpg`);
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

  // Supabase Storage URLs already pass through a CDN (and HEICs go through
  // Supabase's render endpoint via toDisplayImageUrl), so running them through
  // the Next.js image optimizer is overhead without payoff. Match the
  // ProfileAvatar opt-out: render the raw URL via a native <img>.
  it("renders a native <img> with the raw URL for Supabase Storage sources", () => {
    render(
      <PhotoFrame
        src={`${SUPABASE_PREFIX}/photo.jpg`}
        alt="Supabase memory"
      />,
    );
    const img = screen.getByAltText("Supabase memory") as HTMLImageElement;
    expect(img.tagName).toBe("IMG");
    expect(img.getAttribute("src")).toBe(`${SUPABASE_PREFIX}/photo.jpg`);
    expect(img.getAttribute("loading")).toBe("lazy");
    // No next/image srcset
    expect(img.getAttribute("srcset")).toBeNull();
  });

  // blob: URLs are local browser objects; next/image can't optimize them, so
  // they have to go through a native <img>.
  it("renders a native <img> with the raw URL for blob: sources", () => {
    render(<PhotoFrame src="blob:https://localhost/abc-123" alt="upload preview" />);
    const img = screen.getByAltText("upload preview") as HTMLImageElement;
    expect(img.tagName).toBe("IMG");
    expect(img.getAttribute("src")).toBe("blob:https://localhost/abc-123");
    expect(img.getAttribute("srcset")).toBeNull();
  });

  // For all other URLs (legacy Firebase storage, etc.) route through
  // next/image: the rendered <img> goes through the Next image optimizer
  // route and emits a responsive srcset.
  it("routes non-Supabase, non-blob URLs through next/image", () => {
    render(
      <PhotoFrame
        src="https://firebasestorage.googleapis.com/v0/b/bucket/photo.jpg"
        alt="legacy memory"
        sizes="320px"
      />,
    );
    const img = screen.getByAltText("legacy memory") as HTMLImageElement;
    expect(img.tagName).toBe("IMG");
    // next/image rewrites src through the /_next/image optimizer URL
    expect(img.getAttribute("src")).toContain("/_next/image");
    expect(img.getAttribute("src")).toContain(
      encodeURIComponent("https://firebasestorage.googleapis.com/v0/b/bucket/photo.jpg"),
    );
    expect(img.getAttribute("srcset")).not.toBeNull();
    // sizes is forwarded so the browser picks the right candidate
    expect(img.getAttribute("sizes")).toBe("320px");
  });
});
