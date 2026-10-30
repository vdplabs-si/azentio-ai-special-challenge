"use client";

import { Play } from "lucide-react";
import { useState } from "react";
import type { VideoEmbed } from "@/components/site/embed";

/**
 * Click-to-load video. Nothing is requested from YouTube/Vimeo until the visitor presses play,
 * and only the privacy-enhanced embed URLs produced by toVideoEmbed() are ever used.
 */
export function VideoPlayer({ embed, title }: { embed: VideoEmbed; title: string }) {
  const [playing, setPlaying] = useState(false);
  const provider = embed.provider === "youtube" ? "YouTube" : "Vimeo";

  if (playing) {
    const src = `${embed.embedUrl}${embed.embedUrl.includes("?") ? "&" : "?"}autoplay=1`;
    return (
      <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
        <iframe
          src={src}
          title={title}
          className="size-full"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      className="group relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg bg-brand-navy text-white focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:outline-none"
    >
      <span aria-hidden="true" className="absolute inset-0 bg-[url(/art/dots.svg)] opacity-80" />
      <span className="relative flex flex-col items-center gap-3 px-6 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-brand-green text-brand-ink transition-transform group-hover:scale-105 motion-reduce:transition-none">
          <Play aria-hidden="true" className="ml-0.5 size-6 fill-current" />
        </span>
        <span className="text-sm font-medium">
          Play video<span className="sr-only">: {title}</span>
        </span>
        <span className="text-xs text-slate-300">Loads from {provider} when you press play</span>
      </span>
    </button>
  );
}
