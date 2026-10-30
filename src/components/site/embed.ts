/**
 * Video URL helpers. The CSP only allows frames from youtube-nocookie.com, youtube.com and
 * player.vimeo.com, so every stored URL is converted to a privacy-enhanced embed URL here, or
 * rejected. IDs are validated against strict patterns so nothing else reaches the iframe src.
 */

export interface VideoEmbed {
  provider: "youtube" | "vimeo";
  embedUrl: string;
}

const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID = /^\d{6,12}$/;
const VIMEO_HASH = /^[a-f0-9]{6,20}$/i;
const YT_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"]);
const VIMEO_HOSTS = new Set(["vimeo.com", "www.vimeo.com", "player.vimeo.com"]);

function parseHttps(raw: string | null | undefined): URL | null {
  if (!raw) return null;
  try {
    const url = new URL(raw.trim());
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function startSeconds(url: URL): number | null {
  const t = url.searchParams.get("start") ?? url.searchParams.get("t");
  if (!t) return null;
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/.exec(t);
  if (!m) return null;
  const total = Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  return total > 0 && total < 86_400 ? total : null;
}

function youtubeId(url: URL): string | null {
  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split("/").filter(Boolean);
  let id: string | null = null;
  if (host === "youtu.be") id = parts[0] ?? null;
  else if (YT_HOSTS.has(host)) {
    if (parts[0] === "watch") id = url.searchParams.get("v");
    else if (["embed", "shorts", "live", "v"].includes(parts[0] ?? "")) id = parts[1] ?? null;
  }
  return id && YT_ID.test(id) ? id : null;
}

/** Convert a YouTube or Vimeo URL into a safe embed URL, or null if it is not embeddable. */
export function toVideoEmbed(raw: string | null | undefined): VideoEmbed | null {
  const url = parseHttps(raw);
  if (!url) return null;
  const host = url.hostname.toLowerCase();

  const yt = youtubeId(url);
  if (yt) {
    const start = startSeconds(url);
    return {
      provider: "youtube",
      embedUrl: `https://www.youtube-nocookie.com/embed/${yt}${start ? `?start=${start}` : ""}`,
    };
  }

  if (VIMEO_HOSTS.has(host)) {
    const parts = url.pathname.split("/").filter(Boolean);
    // vimeo.com/<id>[/<hash>], vimeo.com/channels/<name>/<id>, player.vimeo.com/video/<id>
    const idIndex = parts.findIndex((p) => VIMEO_ID.test(p));
    if (idIndex === -1) return null;
    const id = parts[idIndex];
    const hash = url.searchParams.get("h") ?? parts[idIndex + 1] ?? null;
    const h = hash && VIMEO_HASH.test(hash) ? `?h=${hash}` : "";
    return { provider: "vimeo", embedUrl: `https://player.vimeo.com/video/${id}${h}` };
  }

  return null;
}

/** An https URL safe to render as an outbound link (never javascript:, data:, http:). */
export function safeExternalUrl(raw: string | null | undefined): string | null {
  return parseHttps(raw)?.toString() ?? null;
}

export function hostLabel(raw: string): string {
  try {
    return new URL(raw).hostname.replace(/^www\./, "");
  } catch {
    return "external site";
  }
}
