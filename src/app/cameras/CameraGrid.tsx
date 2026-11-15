"use client";

import { useEffect, useRef, useState } from "react";

// Cuidado com o gravador do cliente: a tela NUNCA abre todas as câmeras de uma vez.
// - No máximo `max` câmeras ao vivo (o servidor também trava isso em /api/cam).
// - Ao abrir a página, liga uma câmera por vez: a próxima só começa quando a anterior mostrou imagem.
// - Se uma câmera falha, a tela para de ligar as outras e não tenta de novo sozinha.
// - No "Ampliar (HD)", a grade pausa: fica só 1 conexão no gravador.
const label = (name: string) => `Câmera ${name.replace(/^.*cam/, "")}`;
const remote = (src: string) => `/api/cam?src=${encodeURIComponent(src)}`;

async function motivo(): Promise<string> {
  try {
    const s = (await (await fetch("/api/cam?status=1", { cache: "no-store" })).json()) as {
      live: number;
      max: number;
      pausedFor: number;
    };
    if (s.pausedFor > 0) return `O gravador não respondeu. Para protegê-lo, o Live.On espera ${s.pausedFor} s antes de tentar de novo.`;
    if (s.live >= s.max) return `Limite de ${s.max} câmeras ao vivo ao mesmo tempo. Pare outra câmera (ou feche outra aba).`;
  } catch {}
  return "Câmera sem imagem agora.";
}

export default function CameraGrid({ cams, max }: { cams: string[]; max: number }) {
  const [playing, setPlaying] = useState<string[]>(() => cams.slice(0, 1)); // começa só pela primeira
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<string | null>(null);
  const auto = useRef(true); // ligando as primeiras câmeras, uma por vez

  // Algumas versões do navegador não avisam "carregou" em vídeo MJPEG. Se a última câmera ligada ficar
  // 5 s sem erro, conta como carregada e liga a próxima (o servidor só responde depois da 1ª imagem).
  const last = playing[playing.length - 1];
  useEffect(() => {
    if (!last || !auto.current) return;
    const t = setTimeout(() => loaded(last), 5000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last]);

  function loaded(cam: string) {
    if (!auto.current) return;
    setPlaying((p) => {
      if (p.length >= max || p[p.length - 1] !== cam) return p;
      const next = cams.find((c) => !p.includes(c) && !errors[c]);
      if (!next || cams.indexOf(next) >= max) {
        auto.current = false;
        return p;
      }
      return [...p, next];
    });
  }

  async function failed(cam: string) {
    auto.current = false;
    setPlaying((p) => p.filter((c) => c !== cam));
    const msg = await motivo();
    setErrors((e) => ({ ...e, [cam]: msg }));
  }

  function play(cam: string) {
    auto.current = false;
    setErrors((e) => {
      const rest = { ...e };
      delete rest[cam];
      return rest;
    });
    setPlaying((p) => [...p.filter((c) => c !== cam), cam].slice(-max)); // passa do limite → para a mais antiga
  }

  const stop = (cam: string) => setPlaying((p) => p.filter((c) => c !== cam));

  return (
    <>
      <p className="mb-3 text-xs text-muted">
        Para proteger o seu gravador, até {max} câmeras ficam ao vivo ao mesmo tempo. Toque em outra para trocar.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cams.map((cam) => {
          const live = !open && playing.includes(cam);
          return (
            <figure key={cam} className="overflow-hidden rounded-2xl border border-line bg-white">
              <div className="relative flex aspect-video items-center justify-center bg-black">
                {live ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    alt={label(cam)}
                    src={remote(cam)}
                    className="h-full w-full object-contain"
                    onLoad={() => loaded(cam)}
                    onError={() => failed(cam)}
                  />
                ) : errors[cam] ? (
                  <div className="px-6 text-center text-sm text-white/80">
                    <p>{errors[cam]}</p>
                    <button onClick={() => play(cam)} className="mt-3 rounded-full border border-white/40 px-4 py-1.5 font-semibold text-white">
                      Tentar de novo
                    </button>
                  </div>
                ) : (
                  <button onClick={() => play(cam)} className="rounded-full bg-white/10 px-5 py-2 text-sm font-semibold text-white hover:bg-white/20">
                    ▶ Ver ao vivo
                  </button>
                )}
              </div>
              <figcaption className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="font-semibold">{label(cam)}</span>
                <span className="flex gap-4">
                  {live && (
                    <button onClick={() => stop(cam)} className="font-semibold text-muted hover:underline">
                      Parar
                    </button>
                  )}
                  <button onClick={() => setOpen(cam)} className="font-semibold text-brand hover:underline">
                    Ampliar (HD)
                  </button>
                </span>
              </figcaption>
            </figure>
          );
        })}
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
          <div className="flex min-h-0 flex-1 items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <HdVideo key={open} cam={open} />
          </div>
        </div>
      )}
    </>
  );
}

function HdVideo({ cam }: { cam: string }) {
  const [erro, setErro] = useState<string | null>(null);
  if (erro) return <p className="max-w-md text-center text-white/80">{erro}</p>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={`${label(cam)} em HD`}
      src={remote(`${cam}_hd`)}
      className="h-full w-full rounded-xl bg-black object-contain"
      onError={async () => setErro(await motivo())}
    />
  );
}
