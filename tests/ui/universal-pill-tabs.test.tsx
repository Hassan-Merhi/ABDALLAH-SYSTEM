import React from "react";
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { useGlobalScrollKeys } from "@/app/useGlobalScrollKeys";
import { PillTabButton, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * Behaviour of the shared pill tabs (client/src/components/ui/tabs.tsx) that every ERP, Factory,
 * POS, Payroll, Properties and Settings tab strip now relies on: ARIA wiring, keyboard roving
 * focus in both reading directions, hidden-tab skipping, and selected-tab reveal on resize.
 */

// jsdom has no layout, so every element reports zero client rects. Treat elements as rendered
// unless they (or an ancestor) carry the `hidden` attribute, which is what `display: none` means
// for the keyboard filter.
let rectsSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  rectsSpy = vi.spyOn(HTMLElement.prototype, "getClientRects").mockImplementation(function (this: HTMLElement) {
    return (this.closest("[hidden]") ? [] : [{}]) as unknown as DOMRectList;
  });
});

afterEach(() => {
  rectsSpy.mockRestore();
  document.documentElement.removeAttribute("dir");
  cleanup();
});

function ControlledTabs({ initial = "one", hideTwo = false }: { initial?: string; hideTwo?: boolean }) {
  const [value, setValue] = React.useState(initial);
  return (
    <Tabs value={value} onValueChange={setValue}>
      <TabsList aria-label="Sections">
        <TabsTrigger value="one">One</TabsTrigger>
        <TabsTrigger value="two" hidden={hideTwo}>
          Two
        </TabsTrigger>
        <TabsTrigger value="three">Three</TabsTrigger>
        <TabsTrigger value="four" disabled>
          Four
        </TabsTrigger>
      </TabsList>
      <TabsContent value="one">Panel one</TabsContent>
      <TabsContent value="two">Panel two</TabsContent>
      <TabsContent value="three">Panel three</TabsContent>
    </Tabs>
  );
}

describe("shared pill tabs", () => {
  it("links the selected tab and its panel and renders only the selected panel", () => {
    render(<ControlledTabs />);
    const list = screen.getByRole("tablist", { name: "Sections" });
    expect(list).toHaveAttribute("aria-orientation", "horizontal");

    const one = screen.getByRole("tab", { name: "One" });
    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveTextContent("Panel one");
    expect(one).toHaveAttribute("aria-controls", panel.id);
    expect(panel).toHaveAttribute("aria-labelledby", one.id);
    expect(one).toHaveAttribute("tabindex", "0");

    // Inactive panels are unmounted, so inactive tabs must not point at a missing element.
    const three = screen.getByRole("tab", { name: "Three" });
    expect(three).not.toHaveAttribute("aria-controls");
    expect(three).toHaveAttribute("tabindex", "-1");
    expect(screen.queryByText("Panel three")).toBeNull();
  });

  it("moves focus and selection with arrow keys, Home and End, skipping disabled tabs", () => {
    render(<ControlledTabs />);
    const one = screen.getByRole("tab", { name: "One" });
    one.focus();

    fireEvent.keyDown(one, { key: "ArrowRight" });
    const two = screen.getByRole("tab", { name: "Two" });
    expect(two).toHaveFocus();
    expect(two).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Panel two");

    fireEvent.keyDown(two, { key: "End" });
    const three = screen.getByRole("tab", { name: "Three" });
    expect(three).toHaveFocus();
    expect(three).toHaveAttribute("aria-selected", "true");

    // Wraps past the disabled fourth tab back to the first.
    fireEvent.keyDown(three, { key: "ArrowRight" });
    expect(one).toHaveFocus();
    expect(one).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(one, { key: "ArrowLeft" });
    expect(three).toHaveFocus();

    fireEvent.keyDown(three, { key: "Home" });
    expect(one).toHaveFocus();
  });

  it("keeps arrow keys for the tabs when the app-wide scroll-key handler is active", () => {
    // The shell's capture-phase handler scrolls the nearest scrollable container on arrows.
    // With a sideways-scrollable region on the page it used to swallow every tab arrow key.
    renderHook(() => useGlobalScrollKeys(vi.fn()));
    render(
      <>
        <ControlledTabs />
        <div data-testid="wide-table" style={{ overflowX: "auto" }} />
      </>
    );
    const wide = screen.getByTestId("wide-table");
    Object.defineProperty(wide, "scrollWidth", { configurable: true, value: 2000 });
    Object.defineProperty(wide, "clientWidth", { configurable: true, value: 300 });
    vi.spyOn(wide, "getBoundingClientRect").mockReturnValue({ width: 300, height: 100 } as DOMRect);

    const one = screen.getByRole("tab", { name: "One" });
    one.focus();
    fireEvent.keyDown(one, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Two" })).toHaveFocus();
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Panel two");
    expect(wide.scrollLeft).toBe(0);
  });

  it("never lands on a tab that is not rendered", () => {
    render(<ControlledTabs hideTwo />);
    const one = screen.getByRole("tab", { name: "One" });
    one.focus();
    fireEvent.keyDown(one, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Three" })).toHaveFocus();
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Panel three");
  });

  it("reverses arrow keys for right-to-left (Arabic) layouts", () => {
    render(
      <Tabs defaultValue="one">
        <TabsList aria-label="RTL sections" style={{ direction: "rtl" }}>
          <TabsTrigger value="one">One</TabsTrigger>
          <TabsTrigger value="two">Two</TabsTrigger>
        </TabsList>
      </Tabs>
    );
    const one = screen.getByRole("tab", { name: "One" });
    const two = screen.getByRole("tab", { name: "Two" });
    one.focus();
    // In RTL the next tab sits to the left.
    fireEvent.keyDown(one, { key: "ArrowLeft" });
    expect(two).toHaveFocus();
    expect(two).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(two, { key: "ArrowRight" });
    expect(one).toHaveFocus();
  });

  it("ignores arrow keys while focus is not on a tab", () => {
    const onKeyDown = vi.fn();
    render(
      <Tabs value="a">
        <TabsList aria-label="Pages" onKeyDown={onKeyDown}>
          <TabsTrigger value="a">A</TabsTrigger>
          <TabsTrigger value="b">B</TabsTrigger>
        </TabsList>
        <input aria-label="outside" />
      </Tabs>
    );
    const input = screen.getByLabelText("outside");
    input.focus();
    fireEvent.keyDown(screen.getByRole("tablist"), { key: "ArrowRight" });
    expect(onKeyDown).toHaveBeenCalled();
    expect(input).toHaveFocus();
    expect(screen.getByRole("tab", { name: "A" })).toHaveAttribute("aria-selected", "true");
  });

  it("lets PillTabButton strips keep their own click handlers and selection", () => {
    const onSelect = vi.fn();
    render(
      <TabsList aria-label="Direct panels">
        <PillTabButton selected onClick={() => onSelect("list")}>
          Batches
        </PillTabButton>
        <PillTabButton selected={false} onClick={() => onSelect("reports")}>
          Reports
        </PillTabButton>
      </TabsList>
    );
    const [batches, reports] = screen.getAllByRole("tab");
    expect(batches).toHaveAttribute("aria-selected", "true");
    expect(batches).toHaveAttribute("data-state", "active");
    expect(reports).toHaveAttribute("aria-selected", "false");
    expect(batches.className).toMatch(/\bwhitespace-nowrap\b/);
    expect(batches.className).toMatch(/\bshrink-0\b/);

    batches.focus();
    fireEvent.keyDown(batches, { key: "ArrowRight" });
    expect(reports).toHaveFocus();
    expect(onSelect).toHaveBeenCalledWith("reports");
  });

  it("re-reveals the selected tab on a width change but not on a height-only resize", () => {
    let tabLeft = 420;
    const rects = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
      this: HTMLElement
    ) {
      const box =
        this.getAttribute("role") === "tablist" ? { left: 0, right: 300 } : { left: tabLeft, right: tabLeft + 100 };
      return { top: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, ...box } as DOMRect;
    });
    Object.defineProperty(HTMLElement.prototype, "scrollWidth", { configurable: true, get: () => 600 });
    Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => 300 });
    const originalWidth = window.innerWidth;
    try {
      render(
        <Tabs defaultValue="far">
          <TabsList>
            <TabsTrigger value="near">Near</TabsTrigger>
            <TabsTrigger value="far">Far</TabsTrigger>
          </TabsList>
        </Tabs>
      );
      const list = screen.getByRole("tablist");
      const revealed = list.scrollLeft;
      expect(revealed).toBeGreaterThan(0);

      // The user swipes the strip back to the start; the mock keeps the tab off-screen.
      list.scrollLeft = 0;
      act(() => {
        window.dispatchEvent(new Event("resize"));
      });
      expect(list.scrollLeft).toBe(0);

      tabLeft = 420;
      act(() => {
        Object.defineProperty(window, "innerWidth", { configurable: true, value: originalWidth - 100 });
        window.dispatchEvent(new Event("resize"));
      });
      expect(list.scrollLeft).toBe(revealed);
    } finally {
      rects.mockRestore();
      Object.defineProperty(window, "innerWidth", { configurable: true, value: originalWidth });
      delete (HTMLElement.prototype as unknown as Record<string, unknown>).scrollWidth;
      delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth;
    }
  });
});
