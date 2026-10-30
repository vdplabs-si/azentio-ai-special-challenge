import { describe, expect, it } from "bun:test";
import {
  contentDisposition,
  contentMatchesKind,
  isInlineSafeImage,
  kindFromFilename,
  precheckFile,
  sanitizeFilename,
} from "../../../src/components/portal/collab/file-rules";

const bytes = (...b: number[]) => new Uint8Array(b);
const text = (s: string) => new TextEncoder().encode(s);

describe("sanitizeFilename", () => {
  it("keeps only the basename", () => {
    expect(sanitizeFilename("../../etc/passwd.txt")).toBe("passwd.txt");
    expect(sanitizeFilename("C:\\Users\\me\\report.pdf")).toBe("report.pdf");
  });

  it("strips control and bidi-override characters", () => {
    const rlo = String.fromCharCode(0x202e);
    const nul = String.fromCharCode(0);
    expect(sanitizeFilename(`inv${nul}oice${rlo}fdp.exe.txt`)).toBe("invoicefdp.exe.txt");
  });

  it("removes leading dots and reserved characters, and falls back to 'file'", () => {
    expect(sanitizeFilename(".hidden.csv")).toBe("hidden.csv");
    expect(sanitizeFilename('a<b>:"c"|?*.txt')).toBe("a_b___c____.txt");
    expect(sanitizeFilename("...")).toBe("file");
  });

  it("truncates to 150 characters while keeping the extension", () => {
    const out = sanitizeFilename(`${"x".repeat(300)}.docx`);
    expect(out.length).toBe(150);
    expect(out.endsWith(".docx")).toBe(true);
  });
});

describe("kindFromFilename", () => {
  it("maps the allow-list case-insensitively", () => {
    expect(kindFromFilename("A.PDF")).toBe("pdf");
    expect(kindFromFilename("photo.jpeg")).toBe("jpeg");
    expect(kindFromFilename("photo.JPG")).toBe("jpeg");
    expect(kindFromFilename("deck.pptx")).toBe("pptx");
  });

  it("rejects anything not on the allow-list", () => {
    for (const name of ["x.exe", "x.html", "x.svg", "x.js", "x.docm", "noextension", "x.pdf.exe"]) {
      expect(kindFromFilename(name)).toBeNull();
    }
  });
});

describe("contentMatchesKind", () => {
  it("checks magic bytes for binary types", () => {
    expect(contentMatchesKind("pdf", text("%PDF-1.7\n..."))).toBe(true);
    expect(contentMatchesKind("pdf", text("<html>"))).toBe(false);
    expect(contentMatchesKind("png", bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe(true);
    expect(contentMatchesKind("png", bytes(0xff, 0xd8, 0xff))).toBe(false);
    expect(contentMatchesKind("jpeg", bytes(0xff, 0xd8, 0xff, 0xe0))).toBe(true);
    expect(contentMatchesKind("docx", bytes(0x50, 0x4b, 0x03, 0x04, 0x14))).toBe(true);
    expect(contentMatchesKind("xlsx", text("%PDF-"))).toBe(false);
  });

  it("requires valid UTF-8 without NUL bytes for text types", () => {
    expect(contentMatchesKind("csv", text("a,b\n1,ü\n"))).toBe(true);
    expect(contentMatchesKind("txt", bytes(0x68, 0x00, 0x69))).toBe(false);
    expect(contentMatchesKind("txt", bytes(0xc3, 0x28))).toBe(false); // invalid UTF-8 sequence
    expect(contentMatchesKind("txt", bytes(0x50, 0x4b, 0x03, 0x04, 0x00))).toBe(false); // binary disguised as text
  });

  it("rejects empty content for binary types", () => {
    expect(contentMatchesKind("pdf", bytes())).toBe(false);
  });
});

describe("download headers", () => {
  it("encodes RFC 5987 filenames with an ASCII fallback", () => {
    const h = contentDisposition('Résumé "final".pdf');
    expect(h.startsWith("attachment; ")).toBe(true);
    expect(h).toContain(`filename="R_sum_ _final_.pdf"`);
    expect(h).toContain("filename*=UTF-8''R%C3%A9sum%C3%A9%20%22final%22.pdf");
  });

  it("only treats png/jpeg as inline-safe", () => {
    expect(isInlineSafeImage("image/png")).toBe(true);
    expect(isInlineSafeImage("image/jpeg")).toBe(true);
    expect(isInlineSafeImage("application/pdf")).toBe(false);
    expect(isInlineSafeImage("text/plain")).toBe(false);
  });
});

describe("precheckFile", () => {
  it("returns messages for empty, oversized and unsupported files", () => {
    expect(precheckFile({ name: "a.pdf", size: 0 }, 5)).toContain("empty");
    expect(precheckFile({ name: "a.pdf", size: 6 * 1024 * 1024 }, 5)).toContain("5 MB");
    expect(precheckFile({ name: "a.exe", size: 10 }, 5)).toContain("Unsupported");
    expect(precheckFile({ name: "a.csv", size: 10 }, 5)).toBeNull();
  });
});
