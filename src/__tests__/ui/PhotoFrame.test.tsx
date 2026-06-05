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

  // Regression pin: HEIC profile photos uploaded from iOS render via the
  // Supabase image transform endpoint, not the raw object URL. Without this,
  // every PhotoFrame callsite that passed a raw profilePhotoUrl (family-tree
  // grid, home page "In memory", profile hero portrait) silently rendered the
  // placeholder for HEIC uploads.
  it("routes HEIC Supabase URLs through the render-image endpoint", () => {
    const src =
      "https://abc.supabase.co/storage/v1/object/public/media/people/p1/photo.heic";
    render(<PhotoFrame src={src} alt="HEIC portrait" />);
    const img = screen.getByRole("img", { name: "HEIC portrait" });
    expect(img.getAttribute("src")).toBe(
      "https://abc.supabase.co/storage/v1/render/image/public/media/people/p1/photo.heic?format=jpeg&quality=85",
    );
  });

  it("passes through non-HEIC Supabase URLs unchanged", () => {
    const src =
      "https://abc.supabase.co/storage/v1/object/public/media/people/p1/photo.jpg";
    render(<PhotoFrame src={src} alt="JPG portrait" />);
    const img = screen.getByRole("img", { name: "JPG portrait" });
    expect(img.getAttribute("src")).toBe(src);
  });
});
