/**
 * Document upload rules — pure and shared. The client uses them for a fast pre-check;
 * the server re-applies every rule (extension allow-list, magic bytes, UTF-8 text, size)
 * and stores the canonical MIME type for the detected kind, never the client-declared one.
 */

export type FileKind = "pdf" | "png" | "jpeg" | "txt" | "csv" | "docx" | "xlsx" | "pptx";

interface KindRule {
  mime: string;
  extensions: string[];
  label: string;
  signature: "pdf" | "png" | "jpeg" | "zip" | "text";
}

export const FILE_KINDS: Record<FileKind, KindRule> = {
  pdf: { mime: "application/pdf", extensions: ["pdf"], label: "PDF", signature: "pdf" },
  png: { mime: "image/png", extensions: ["png"], label: "PNG image", signature: "png" },
  jpeg: { mime: "image/jpeg", extensions: ["jpg", "jpeg"], label: "JPEG image", signature: "jpeg" },
  txt: { mime: "text/plain", extensions: ["txt"], label: "Text", signature: "text" },
  csv: { mime: "text/csv", extensions: ["csv"], label: "CSV", signature: "text" },
  docx: {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    extensions: ["docx"],
    label: "Word document",
    signature: "zip",
  },
  xlsx: {
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    extensions: ["xlsx"],
    label: "Excel workbook",
    signature: "zip",
  },
  pptx: {
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    extensions: ["pptx"],
    label: "PowerPoint presentation",
    signature: "zip",
  },
};

export const ALLOWED_EXTENSIONS = Object.values(FILE_KINDS).flatMap((k) => k.extensions);
/** Value for <input type="file" accept>. */
export const ACCEPT_ATTRIBUTE = ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(",");
export const ALLOWED_SUMMARY = "PDF, PNG, JPEG, TXT, CSV, DOCX, XLSX, PPTX";

const MAX_FILENAME = 150;

function isUnsafeChar(code: number) {
  return (
    code < 0x20 || // C0 controls
    (code >= 0x7f && code <= 0x9f) || // DEL + C1 controls
    (code >= 0x202a && code <= 0x202e) || // bidi embedding / override
    (code >= 0x2066 && code <= 0x2069) || // bidi isolates
    code === 0x200e ||
    code === 0x200f ||
    code === 0xfeff
  );
}

/** Basename only, no control/bidi characters, no reserved characters, ≤150 chars (extension kept). */
export function sanitizeFilename(raw: string) {
  const base = raw.split(/[\\/]/).pop() ?? "";
  let name = Array.from(base)
    .filter((ch) => !isUnsafeChar(ch.codePointAt(0) ?? 0))
    .join("")
    .replace(/[<>:"|?*]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "");
  if (!name) name = "file";
  const chars = Array.from(name);
  if (chars.length > MAX_FILENAME) {
    const dot = name.lastIndexOf(".");
    const ext = dot > 0 ? name.slice(dot) : "";
    const extChars = Array.from(ext);
    if (extChars.length > 0 && extChars.length < 20) {
      name = chars.slice(0, MAX_FILENAME - extChars.length).join("").trimEnd() + ext;
    } else {
      name = chars.slice(0, MAX_FILENAME).join("");
    }
  }
  return name;
}

export function extensionOf(filename: string) {
  const dot = filename.lastIndexOf(".");
  return dot > 0 ? filename.slice(dot + 1).toLowerCase() : "";
}

/** Kind from the (sanitised) filename's extension, or null if not on the allow-list. */
export function kindFromFilename(filename: string): FileKind | null {
  const ext = extensionOf(filename);
  for (const [kind, rule] of Object.entries(FILE_KINDS) as [FileKind, KindRule][]) {
    if (rule.extensions.includes(ext)) return kind;
  }
  return null;
}

const startsWith = (bytes: Uint8Array, sig: number[]) => bytes.length >= sig.length && sig.every((b, i) => bytes[i] === b);

/** Verify that the content matches the kind (magic bytes for binaries; strict UTF-8 without NUL for text). */
export function contentMatchesKind(kind: FileKind, bytes: Uint8Array): boolean {
  switch (FILE_KINDS[kind].signature) {
    case "pdf":
      return startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
    case "png":
      return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "jpeg":
      return startsWith(bytes, [0xff, 0xd8, 0xff]);
    case "zip":
      return startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]); // PK\x03\x04 (OOXML container)
    case "text": {
      if (bytes.includes(0)) return false;
      try {
        new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        return true;
      } catch {
        return false;
      }
    }
  }
}

/** Images may be served with their own type; everything else downloads as an opaque attachment. */
export const isInlineSafeImage = (mime: string) => mime === "image/png" || mime === "image/jpeg";

/** RFC 6266 / RFC 5987 Content-Disposition with an ASCII fallback. */
export function contentDisposition(filename: string) {
  const ascii = Array.from(filename)
    .map((ch) => {
      const c = ch.codePointAt(0) ?? 0;
      return c >= 0x20 && c < 0x7f && ch !== '"' && ch !== "\\" && ch !== "%" ? ch : "_";
    })
    .join("");
  const encoded = encodeURIComponent(filename).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

/** Client-side pre-check (the server re-validates everything). Returns an error message or null. */
export function precheckFile(file: { name: string; size: number }, maxMb: number): string | null {
  if (file.size === 0) return "The file is empty.";
  if (file.size > maxMb * 1024 * 1024) return `Files must be ${maxMb} MB or smaller.`;
  if (!kindFromFilename(sanitizeFilename(file.name))) return `Unsupported file type. Allowed: ${ALLOWED_SUMMARY}.`;
  return null;
}
