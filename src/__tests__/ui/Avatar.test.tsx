import { describe, expect, it } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
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

  it("retries loading the image when src changes after a prior load failure", () => {
    // Regression test for the React 19 set-state-in-effect refactor: when
    // the caller swaps `src`, the failed flag must reset so the new image
    // gets a chance to render. Previously this used useEffect; it now syncs
    // during render via a prevSrc tracker (matches MemoryImage / ProfileAvatar).
    const { rerender } = render(
      <Avatar name="Eleanor Barcroft" src="https://example.com/old.jpg" />,
    );

    act(() => {
      fireEvent.error(screen.getByAltText("Eleanor Barcroft"));
    });
    expect(screen.queryByAltText("Eleanor Barcroft")).not.toBeInTheDocument();
    expect(screen.getByText("EB")).toBeInTheDocument();

    rerender(<Avatar name="Eleanor Barcroft" src="https://example.com/new.jpg" />);

    const retried = screen.getByAltText("Eleanor Barcroft") as HTMLImageElement;
    expect(retried.getAttribute("src")).toBe("https://example.com/new.jpg");
  });
});
