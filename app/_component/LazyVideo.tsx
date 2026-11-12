"use client";

import { useEffect, useRef, useState } from "react";

// A muted, looping autoplay video whose sources are only attached once it's near the viewport.
// `autoPlay` alone makes browsers download the whole file on page load, competing with the page's
// own assets; until then the poster shows. Visitors who prefer reduced motion keep the poster.
export function LazyVideo({
  webm,
  mp4,
  poster,
  label,
  className,
}: {
  webm: string;
  mp4: string;
  poster: string;
  label: string;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [load, setLoad] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  // Sources added after mount aren't picked up until the element reloads.
  useEffect(() => {
    if (!load || !ref.current) return;
    ref.current.load();
    ref.current.play().catch(() => {});
  }, [load]);

  return (
    <video
      ref={ref}
      className={className}
      muted
      loop
      playsInline
      preload="none"
      poster={poster}
      aria-label={label}
    >
      {load && (
        <>
          <source src={webm} type="video/webm" />
          <source src={mp4} type="video/mp4" />
        </>
      )}
    </video>
  );
}
