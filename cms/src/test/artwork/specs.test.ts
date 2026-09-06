/**
 * Tests for the client-side artwork spec validation.
 */
import { describe, expect, it } from "vitest";

import {
  ARTWORK_SPECS,
  validateArtworkClient,
} from "../../artwork/specs";

function makeFile(opts: { type?: string; sizeBytes: number }): File {
  // Create a File of a specific size by padding the contents.
  const content = new Uint8Array(opts.sizeBytes);
  const file = new File([content], "test.bin", {
    type: opts.type ?? "image/jpeg",
  });
  return file;
}

describe("ARTWORK_SPECS", () => {
  it("poster: 600x900, 2:3, <=200KB", () => {
    const s = ARTWORK_SPECS.poster;
    expect(s.target).toEqual({ w: 600, h: 900 });
    expect(s.aspectLabel).toBe("2:3");
    expect(s.maxBytes).toBe(200 * 1024);
  });

  it("banner: 1280x720, 16:9, <=200KB", () => {
    const s = ARTWORK_SPECS.banner;
    expect(s.target).toEqual({ w: 1280, h: 720 });
    expect(s.aspectLabel).toBe("16:9");
    expect(s.maxBytes).toBe(200 * 1024);
  });

  it("thumbnail: 640x360, 16:9, <=200KB", () => {
    const s = ARTWORK_SPECS.thumbnail;
    expect(s.target).toEqual({ w: 640, h: 360 });
    expect(s.aspectLabel).toBe("16:9");
    expect(s.maxBytes).toBe(200 * 1024);
  });
});

describe("validateArtworkClient", () => {
  it("accepts a valid JPEG with correct dimensions and size", () => {
    const file = makeFile({ type: "image/jpeg", sizeBytes: 150 * 1024 });
    const result = validateArtworkClient("poster", file, {
      width: 600,
      height: 900,
    });
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("rejects an image larger than the size limit", () => {
    const file = makeFile({ type: "image/jpeg", sizeBytes: 250 * 1024 });
    const result = validateArtworkClient("poster", file, {
      width: 600,
      height: 900,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/KB/);
  });

  it("rejects an image with wrong dimensions", () => {
    const file = makeFile({ type: "image/jpeg", sizeBytes: 100 * 1024 });
    const result = validateArtworkClient("banner", file, {
      width: 1280,
      height: 800,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/1280\u00d7720/);
  });

  it("rejects an image with wrong aspect ratio", () => {
    const file = makeFile({ type: "image/jpeg", sizeBytes: 100 * 1024 });
    const result = validateArtworkClient("poster", file, {
      width: 800,
      height: 600,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/2:3/);
  });

  it("rejects a file with a non-image MIME type", () => {
    const file = makeFile({ type: "application/pdf", sizeBytes: 100 * 1024 });
    const result = validateArtworkClient("poster", file, {
      width: 600,
      height: 900,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/jpeg|png|webp/i);
  });

  it("rejects an empty file", () => {
    const file = makeFile({ type: "image/jpeg", sizeBytes: 0 });
    const result = validateArtworkClient("poster", file, {
      width: 600,
      height: 900,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/empty/);
  });

  it("returns no error when dimensions are not provided (e.g. for non-image files)", () => {
    const file = makeFile({ type: "image/jpeg", sizeBytes: 100 * 1024 });
    const result = validateArtworkClient("poster", file);
    // Without dims, the validator can't check dimensions, but other
    // checks should still pass.
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });
});
