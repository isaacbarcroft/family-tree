import { describe, expect, it } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
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

  it("retries loading the image when src changes after a prior load failure", () => {
    // Regression test for the React 19 set-state-in-effect refactor: when
    // the caller swaps `src`, the failed flag must reset so the new image
    // gets a chance to render. Previously this used useEffect; it now syncs
    // during render via a prevSrc tracker (matches MemoryImage / ProfileAvatar).
    const { rerender } = render(
      <PhotoFrame src="https://example.com/old.jpg" alt="photo" label="placeholder" />,
    );

    act(() => {
      fireEvent.error(screen.getByAltText("photo"));
    });
    expect(screen.queryByAltText("photo")).not.toBeInTheDocument();
    expect(screen.getByText("placeholder")).toBeInTheDocument();

    rerender(
      <PhotoFrame src="https://example.com/new.jpg" alt="photo" label="placeholder" />,
    );

    const retried = screen.getByAltText("photo") as HTMLImageElement;
    expect(retried.getAttribute("src")).toBe("https://example.com/new.jpg");
  });
});
