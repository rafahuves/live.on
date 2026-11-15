"use client";

import { useState } from "react";

const GO2RTC = "http://127.0.0.1:1984";
const label = (name: string) => `Câmera ${name.replace(/^.*cam/, "")}`;
const player = (src: string) => `${GO2RTC}/stream.html?src=${encodeURIComponent(src)}&mode=webrtc,mse&media=video`;

export default function CameraGrid({ cams }: { cams: string[] }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cams.map((cam) => (
          <figure key={cam} className="overflow-hidden rounded-2xl border border-line bg-white">
            <div className="aspect-video bg-black">
              <iframe title={cam} src={player(cam)} className="h-full w-full" allow="autoplay; fullscreen" />
            </div>
            <figcaption className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="font-semibold">{label(cam)}</span>
              <button onClick={() => setOpen(cam)} className="font-semibold text-brand hover:underline">
                Ampliar (HD)
              </button>
            </figcaption>
          </figure>
        ))}
      </div>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${label(open)} em HD`}
          className="fixed inset-0 z-[60] flex flex-col bg-black/90 p-4"
          onClick={() => setOpen(null)}
        >
          <div className="flex justify-between pb-3 text-white">
            <span className="font-semibold">{label(open)} · HD</span>
            <button onClick={() => setOpen(null)} className="font-semibold">
              Fechar ✕
            </button>
          </div>
          <iframe
            title={`${open} HD`}
            src={player(`${open}_hd`)}
            className="w-full flex-1 rounded-xl bg-black"
            allow="autoplay; fullscreen"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
