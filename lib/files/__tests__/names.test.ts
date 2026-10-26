import { describe, expect, it } from "vitest";
import { canPreview, cleanName, fileCategory, folderPath, formatBytes, MULTIPART_THRESHOLD, partPlan, uniqueName } from "../names";

const MB = 1024 * 1024;
const GB = 1024 * MB;

describe("partPlan", () => {
  it("sends small files in one request", () => {
    expect(partPlan(10 * MB)).toEqual({ multipart: false, partSize: 10 * MB, count: 1 });
    expect(partPlan(MULTIPART_THRESHOLD).multipart).toBe(false);
    expect(partPlan(0).count).toBe(1);
  });

  it("splits big files into 16 MB parts", () => {
    const plan = partPlan(100 * MB);
    expect(plan).toEqual({ multipart: true, partSize: 16 * MB, count: 7 });
  });

  it("grows parts so huge files stay within 10,000 parts", () => {
    const plan = partPlan(1000 * GB);
    expect(plan.count).toBeLessThanOrEqual(10_000);
    expect(plan.partSize * plan.count).toBeGreaterThanOrEqual(1000 * GB);
    expect(plan.partSize % MB).toBe(0);
  });
});

describe("uniqueName", () => {
  it("keeps a free name", () => {
    expect(uniqueName("a.pdf", ["b.pdf"])).toBe("a.pdf");
  });
  it("numbers clashes before the extension, ignoring case", () => {
    expect(uniqueName("Report.pdf", ["report.PDF"])).toBe("Report (1).pdf");
    expect(uniqueName("Report.pdf", ["Report.pdf", "Report (1).pdf"])).toBe("Report (2).pdf");
  });
  it("handles names without an extension and already-numbered names", () => {
    expect(uniqueName("Photos", ["Photos"])).toBe("Photos (1)");
    expect(uniqueName("a (1).txt", ["a (1).txt"])).toBe("a (2).txt");
    expect(uniqueName(".env", [".env"])).toBe(".env (1)");
  });
});

describe("cleanName / folderPath", () => {
  it("strips slashes and control characters", () => {
    expect(cleanName(" a/b\\c\u0001.txt ")).toBe("a-b-c.txt");
    expect(cleanName("..")).toBe("Untitled");
    expect(cleanName("   ")).toBe("Untitled");
  });
  it("takes the folders from a relative path", () => {
    expect(folderPath("Trip/Day 1/IMG_1.jpg")).toEqual(["Trip", "Day 1"]);
    expect(folderPath("../x/./y.txt")).toEqual(["x"]);
    expect(folderPath("file.txt")).toEqual([]);
    expect(folderPath(undefined)).toEqual([]);
  });
});

describe("fileCategory / canPreview", () => {
  it("goes by extension, then content type", () => {
    expect(fileCategory("a.HEIC", null)).toBe("image");
    expect(fileCategory("notes", "text/plain")).toBe("text");
    expect(fileCategory("budget.xlsx", "application/octet-stream")).toBe("spreadsheet");
    expect(fileCategory("blob", null)).toBe("other");
  });
  it("only previews what browsers can show", () => {
    expect(canPreview("a.jpg", "image/jpeg")).toBe(true);
    expect(canPreview("a.heic", "image/heic")).toBe(false);
    expect(canPreview("a.pdf", "application/pdf")).toBe(true);
    expect(canPreview("a.docx", null)).toBe(false);
    expect(canPreview("a.mkv", "video/x-matroska")).toBe(false);
  });
});

describe("formatBytes", () => {
  it("formats sizes", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(3 * GB)).toBe("3 GB");
    expect(formatBytes(250 * MB)).toBe("250 MB");
  });
});
