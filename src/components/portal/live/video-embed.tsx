import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Embeds only privacy-enhanced YouTube / Vimeo players (the CSP frame-src allow-list).
 * Any other https URL is offered as an external link instead of an iframe.
 */
export function VideoEmbed({ embedUrl, url, title, linkLabel }: { embedUrl: string | null; url: string | null; title: string; linkLabel: string }) {
  if (embedUrl) {
    return (
      <div className="grid gap-2">
        <div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-brand-navy">
          <iframe
            src={embedUrl}
            title={title}
            className="absolute inset-0 size-full"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            loading="lazy"
          />
        </div>
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-brand-ink">
            Open on the video platform <ExternalLink className="size-3" aria-hidden />
          </a>
        )}
      </div>
    );
  }
  if (!url) return null;
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed bg-brand-light p-5 text-sm">
      <p className="text-muted-foreground">This video is hosted on an external platform that cannot be embedded in the portal.</p>
      <Button asChild>
        <a href={url} target="_blank" rel="noopener noreferrer">
          {linkLabel} <ExternalLink aria-hidden />
        </a>
      </Button>
    </div>
  );
}
