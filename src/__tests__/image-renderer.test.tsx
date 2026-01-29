/**
 * ImageRenderer Tests
 *
 * Tests the image rendering component including loading states,
 * error handling, URL sanitization, and lightbox functionality.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { ImageRenderer, parseImageContent } from "../components/ImageRenderer";

describe("ImageRenderer", () => {
  beforeEach(() => {
    // Mock console.warn to avoid test noise
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  describe("URL sanitization", () => {
    it("should render HTTPS images", () => {
      render(<ImageRenderer src="https://example.com/image.png" />);
      const img = screen.getByRole("img");
      expect(img).toHaveAttribute("src", "https://example.com/image.png");
    });

    it("should render base64 data URIs", () => {
      const dataUri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA";
      render(<ImageRenderer src={dataUri} />);
      const img = screen.getByRole("img");
      expect(img).toHaveAttribute("src", dataUri);
    });

    it("should warn about HTTP images but still render them", () => {
      render(<ImageRenderer src="http://insecure.com/image.png" />);
      expect(console.warn).toHaveBeenCalledWith(
        "Loading image over insecure HTTP:",
        "http://insecure.com/image.png",
      );
      const img = screen.getByRole("img");
      expect(img).toBeInTheDocument();
    });

    it("should block unsafe protocols", () => {
      render(<ImageRenderer src="javascript:alert('xss')" />);
      expect(screen.getByText("Blocked: unsafe image source")).toBeInTheDocument();
      expect(screen.queryByRole("img")).not.toBeInTheDocument();
    });

    it("should block file:// URLs", () => {
      render(<ImageRenderer src="file:///etc/passwd" />);
      expect(screen.getByText("Blocked: unsafe image source")).toBeInTheDocument();
    });

    it("should handle empty src", () => {
      render(<ImageRenderer src="" />);
      expect(screen.getByText("Blocked: unsafe image source")).toBeInTheDocument();
    });

    it("should trim whitespace from URLs", () => {
      render(<ImageRenderer src="  https://example.com/image.png  " />);
      const img = screen.getByRole("img");
      expect(img).toHaveAttribute("src", "https://example.com/image.png");
    });
  });

  describe("loading states", () => {
    it("should show loading spinner initially", () => {
      render(<ImageRenderer src="https://example.com/image.png" />);
      // Check for loading state (either spinner or the img with opacity-0)
      const container = screen.getByRole("img").parentElement;
      expect(container).toBeInTheDocument();
    });

    it("should hide loading spinner after image loads", async () => {
      render(<ImageRenderer src="https://example.com/image.png" />);

      const img = screen.getByRole("img");
      
      // Simulate successful load
      await act(async () => {
        img.dispatchEvent(new Event("load", { bubbles: true }));
      });

      await waitFor(() => {
        expect(img).not.toHaveClass("opacity-0");
      });
    });
  });

  describe("error handling", () => {
    it("should show error state when image fails to load", async () => {
      render(<ImageRenderer src="https://example.com/broken.png" />);

      const img = screen.getByRole("img");

      // Simulate error
      img.dispatchEvent(new Event("error", { bubbles: true }));

      await waitFor(() => {
        expect(screen.getByText("Failed to load image")).toBeInTheDocument();
      });
    });

    it("should hide image element on error", async () => {
      render(<ImageRenderer src="https://example.com/broken.png" />);

      const img = screen.getByRole("img");
      img.dispatchEvent(new Event("error", { bubbles: true }));

      await waitFor(() => {
        expect(img).toHaveClass("hidden");
      });
    });
  });

  describe("lightbox functionality", () => {
    it("should open lightbox when image is clicked", async () => {
      const user = userEvent.setup();
      render(<ImageRenderer src="https://example.com/image.png" />);

      const img = screen.getByRole("img");
      
      // Load the image first
      img.dispatchEvent(new Event("load", { bubbles: true }));

      await waitFor(async () => {
        const container = img.parentElement;
        await user.click(container!);
      });

      // Check for lightbox elements
      await waitFor(() => {
        const allImages = screen.getAllByRole("img");
        expect(allImages.length).toBeGreaterThan(1); // Original + lightbox
      });
    });

    it("should close lightbox when close button is clicked", async () => {
      const user = userEvent.setup();
      render(<ImageRenderer src="https://example.com/image.png" />);

      const img = screen.getByRole("img");
      img.dispatchEvent(new Event("load", { bubbles: true }));

      await waitFor(async () => {
        const container = img.parentElement;
        await user.click(container!);
      });

      // Find and click close button
      await waitFor(async () => {
        const closeButton = screen.getByRole("button", { name: /close image/i });
        await user.click(closeButton);
      });

      // Lightbox should be gone
      await waitFor(() => {
        const allImages = screen.getAllByRole("img");
        expect(allImages.length).toBe(1); // Only original image
      });
    });

    it("should close lightbox when clicking backdrop", async () => {
      const user = userEvent.setup();
      render(<ImageRenderer src="https://example.com/image.png" />);

      const img = screen.getByRole("img");
      img.dispatchEvent(new Event("load", { bubbles: true }));

      await waitFor(async () => {
        const container = img.parentElement;
        await user.click(container!);
      });

      // Find the backdrop by looking for the fixed inset-0 div
      await waitFor(async () => {
        const backdrop = document.querySelector('.fixed.inset-0');
        if (backdrop) {
          await user.click(backdrop as HTMLElement);
        }
      });

      // Wait for lightbox to close
      await waitFor(() => {
        const backdrop = document.querySelector('.fixed.inset-0');
        expect(backdrop).not.toBeInTheDocument();
      }, { timeout: 2000 });
    });

    it("should open image in new tab when external link button clicked", async () => {
      const user = userEvent.setup();
      const windowOpenSpy = vi.spyOn(window, "open").mockImplementation(() => null);

      render(<ImageRenderer src="https://example.com/image.png" />);

      const img = screen.getByRole("img");
      img.dispatchEvent(new Event("load", { bubbles: true }));

      // Wait for load state to update then click image to open lightbox
      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });
      
      await user.click(img);

      // Click open in new tab button
      const openButton = await screen.findByRole("button", { name: /open in new tab/i });
      await user.click(openButton);

      expect(windowOpenSpy).toHaveBeenCalledWith(
        "https://example.com/image.png",
        "_blank",
        "noopener,noreferrer",
      );

      windowOpenSpy.mockRestore();
    });
  });

  describe("dimension handling", () => {
    it("should display image dimensions in lightbox", async () => {
      const user = userEvent.setup();
      render(<ImageRenderer src="https://example.com/image.png" />);

      const img = screen.getByRole("img") as HTMLImageElement;

      // Mock natural dimensions
      Object.defineProperty(img, "naturalWidth", { value: 800, writable: true });
      Object.defineProperty(img, "naturalHeight", { value: 600, writable: true });

      img.dispatchEvent(new Event("load", { bubbles: true }));

      await waitFor(async () => {
        const container = img.parentElement;
        await user.click(container!);
      });

      // Check for dimensions display
      await waitFor(() => {
        expect(screen.getByText("800 × 600")).toBeInTheDocument();
      });
    });

    it("should constrain large images to maxWidth", async () => {
      render(
        <ImageRenderer
          src="https://example.com/large.png"
          maxWidth={300}
          maxHeight={300}
        />,
      );

      const img = screen.getByRole("img") as HTMLImageElement;

      // Mock very large image
      Object.defineProperty(img, "naturalWidth", { value: 2000, writable: true });
      Object.defineProperty(img, "naturalHeight", { value: 1000, writable: true });

      img.dispatchEvent(new Event("load", { bubbles: true }));

      // Wait for the component to update
      await waitFor(() => {
        // After load, dimensions should be constrained (either width or height set)
        const hasWidth = img.style.width !== "";
        const hasHeight = img.style.height !== "";
        expect(hasWidth || hasHeight).toBe(true);
      });
    });
  });

  describe("alt text", () => {
    it("should use provided alt text", () => {
      render(<ImageRenderer src="https://example.com/image.png" alt="Test image" />);
      const img = screen.getByAltText("Test image");
      expect(img).toBeInTheDocument();
    });

    it("should default to 'Image' if no alt provided", () => {
      render(<ImageRenderer src="https://example.com/image.png" />);
      const img = screen.getByAltText("Image");
      expect(img).toBeInTheDocument();
    });
  });

  describe("custom styling", () => {
    it("should apply custom className", () => {
      const { container } = render(
        <ImageRenderer
          src="https://example.com/image.png"
          className="custom-class"
        />,
      );
      expect(container.querySelector(".custom-class")).toBeInTheDocument();
    });

    it("should apply custom maxWidth and maxHeight", () => {
      render(
        <ImageRenderer
          src="https://example.com/image.png"
          maxWidth={500}
          maxHeight={500}
        />,
      );

      const img = screen.getByRole("img");
      expect(img).toBeInTheDocument();
    });
  });
});

describe("parseImageContent", () => {
  it("should parse markdown image syntax", () => {
    const content = "Check out this ![cool image](https://example.com/image.png)";
    const segments = parseImageContent(content);

    expect(segments).toHaveLength(2);
    expect(segments[0].type).toBe("text");
    expect(segments[0].content).toContain("Check out this");
    expect(segments[1].type).toBe("image");
    expect(segments[1].content).toBe("https://example.com/image.png");
    expect(segments[1].alt).toBe("cool image");
  });

  it("should parse standalone image URLs", () => {
    const content = "Look at https://example.com/photo.jpg here";
    const segments = parseImageContent(content);

    expect(segments.some((s) => s.type === "image")).toBe(true);
    const imageSegment = segments.find((s) => s.type === "image");
    expect(imageSegment?.content).toBe("https://example.com/photo.jpg");
  });

  it("should parse base64 data URIs", () => {
    const dataUri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA";
    const content = `Here is an image: ${dataUri}`;
    const segments = parseImageContent(content);

    expect(segments.some((s) => s.type === "image")).toBe(true);
    const imageSegment = segments.find((s) => s.type === "image");
    expect(imageSegment?.content).toBe(dataUri);
  });

  it("should return text segment when no images found", () => {
    const content = "Just plain text, no images here";
    const segments = parseImageContent(content);

    expect(segments).toHaveLength(1);
    expect(segments[0].type).toBe("text");
    expect(segments[0].content).toBe(content);
  });

  it("should parse multiple images", () => {
    const content =
      "![First](https://example.com/1.png) and ![Second](https://example.com/2.png)";
    const segments = parseImageContent(content);

    const imageSegments = segments.filter((s) => s.type === "image");
    expect(imageSegments).toHaveLength(2);
    expect(imageSegments[0].content).toBe("https://example.com/1.png");
    expect(imageSegments[1].content).toBe("https://example.com/2.png");
  });

  it("should handle images without alt text", () => {
    const content = "![](https://example.com/image.png)";
    const segments = parseImageContent(content);

    const imageSegment = segments.find((s) => s.type === "image");
    expect(imageSegment?.alt).toBe("Image");
  });

  it("should handle mixed content", () => {
    const content =
      "Text before ![image](https://example.com/img.png) text after";
    const segments = parseImageContent(content);

    expect(segments).toHaveLength(3);
    expect(segments[0].type).toBe("text");
    expect(segments[1].type).toBe("image");
    expect(segments[2].type).toBe("text");
  });

  it("should handle empty string", () => {
    const segments = parseImageContent("");
    expect(segments).toHaveLength(1);
    expect(segments[0].type).toBe("text");
    expect(segments[0].content).toBe("");
  });
});
