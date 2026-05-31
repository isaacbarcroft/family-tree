import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PhotoFrame } from "@/components/ui/PhotoFrame";

const SUPABASE_URL =
  "https://abc.supabase.co/storage/v1/object/public/media/people/p1/photos/a.jpg";
const SUPABASE_URL_2 =
  "https://abc.supabase.co/storage/v1/object/public/media/people/p1/photos/b.jpg";

describe("PhotoFrame", () => {
  it("renders the placeholder label when no src is provided", () => {
    render(<PhotoFrame label="missing photo" />);
    expect(screen.getByText("missing photo")).toBeInTheDocument();
  });

  it("renders the image when src is provided", () => {
    render(<PhotoFrame src={SUPABASE_URL} alt="Eleanor at 22" />);
    expect(screen.getByRole("img", { name: "Eleanor at 22" })).toBeInTheDocument();
  });

  it("falls back to the placeholder label when the image errors", () => {
    render(
      <PhotoFrame src={SUPABASE_URL} alt="Eleanor at 22" label="photograph" />,
    );
    fireEvent.error(screen.getByRole("img", { name: "Eleanor at 22" }));
    expect(screen.getByText("photograph")).toBeInTheDocument();
  });

  it("retries the new image after a previous src errored (resets failed state on src change)", () => {
    const { rerender } = render(
      <PhotoFrame src={SUPABASE_URL} alt="Eleanor at 22" label="photograph" />,
    );
    fireEvent.error(screen.getByRole("img", { name: "Eleanor at 22" }));
    expect(screen.getByText("photograph")).toBeInTheDocument();

    rerender(
      <PhotoFrame src={SUPABASE_URL_2} alt="Eleanor at 22" label="photograph" />,
    );
    // The retried image is rendered again; the placeholder is gone.
    expect(screen.getByRole("img", { name: "Eleanor at 22" })).toBeInTheDocument();
    expect(screen.queryByText("photograph")).not.toBeInTheDocument();
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

  it("forwards a tuned `sizes` value to the underlying image so the browser picks the right srcset entry", () => {
    render(
      <PhotoFrame
        src={SUPABASE_URL}
        alt="grid tile"
        sizes="(min-width: 1024px) 320px, 50vw"
      />,
    );
    const img = screen.getByRole("img", { name: "grid tile" });
    expect(img.getAttribute("sizes")).toBe("(min-width: 1024px) 320px, 50vw");
  });

  it("defaults `sizes` to `100vw` when the caller does not specify one (full-bleed fallback)", () => {
    render(<PhotoFrame src={SUPABASE_URL} alt="full bleed" />);
    const img = screen.getByRole("img", { name: "full bleed" });
    expect(img.getAttribute("sizes")).toBe("100vw");
  });

  it("opts out of lazy loading when `priority` is set (above-the-fold LCP candidate)", () => {
    render(<PhotoFrame src={SUPABASE_URL} alt="hero" priority />);
    const img = screen.getByRole("img", { name: "hero" });
    // next/image drops the loading attribute entirely when priority=true; the
    // native default is "eager", which is the behavior we want for LCP images.
    expect(img.getAttribute("loading")).toBeNull();
  });

  it("lazy-loads by default (no priority hint)", () => {
    render(<PhotoFrame src={SUPABASE_URL} alt="lazy tile" />);
    const img = screen.getByRole("img", { name: "lazy tile" });
    expect(img.getAttribute("loading")).toBe("lazy");
  });

  it("routes blob: URLs around the Next image optimizer (no hostname to validate)", () => {
    // blob: URLs originate from URL.createObjectURL() and have no hostname, so
    // the `/_next/image` loader would 400 on them. PhotoFrame must mark these
    // as unoptimized so the raw blob URL flows through as-is.
    render(<PhotoFrame src="blob:https://localhost/abc-123" alt="upload preview" />);
    const img = screen.getByRole("img", { name: "upload preview" });
    expect(img.getAttribute("src")).toBe("blob:https://localhost/abc-123");
    // Unoptimized images do not get a srcset attribute set by next/image.
    expect(img.getAttribute("srcset")).toBeNull();
  });

  it("routes data: URLs around the Next image optimizer", () => {
    const dataUri = "data:image/png;base64,iVBORw0KGgo=";
    render(<PhotoFrame src={dataUri} alt="data uri" />);
    const img = screen.getByRole("img", { name: "data uri" });
    expect(img.getAttribute("src")).toBe(dataUri);
    expect(img.getAttribute("srcset")).toBeNull();
  });

  it("emits a srcset for optimized (remote) URLs so the browser can pick a width", () => {
    render(
      <PhotoFrame
        src={SUPABASE_URL}
        alt="optimized"
        sizes="(min-width: 1024px) 320px, 50vw"
      />,
    );
    const img = screen.getByRole("img", { name: "optimized" });
    expect(img.getAttribute("srcset")).toBeTruthy();
  });
});
