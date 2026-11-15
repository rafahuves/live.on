"use client";

import { useEffect, useRef, useState } from "react";

// Dashboard com todas as câmeras, com o mesmo cuidado do app da Intelbras:
// - liga UMA câmera por vez: a próxima só começa 1,5 s depois que a anterior mostrou imagem;
// - se uma câmera falha, para de ligar as outras e não tenta de novo sozinha (só no botão);
// - aba escondida por mais de 30 s desliga tudo; ao voltar, religa uma por vez;
// - o HD (ampliar) é 1 câmera a mais, só enquanto está aberto.
// Por baixo, o servidor (/api/cam) e o escudo (src/lib/dvrShield.ts) garantem os limites de qualquer jeito.
const label = (name: string) => `Câmera ${name.replace(/^.*cam/, "")}`;
const remote = (src: string) => `/api/cam?src=${encodeURIComponent(src)}`;
const GAP_MS = 1500;
const HIDDEN_MS = 30_000;

async function motivo(): Promise<string> {
  try {
    const s = (await (await fetch("/api/cam?status=1", { cache: "no-store" })).json()) as {
      live: number;
      max: number;
      pausedFor: number;
    };
    if (s.pausedFor > 0) return `O gravador não respondeu. Para protegê-lo, o Live.On espera ${s.pausedFor} s antes de tentar de novo.`;
    if (s.live >= s.max) return "Muitos vídeos abertos ao mesmo tempo (outra aba ou celular?). Feche um e tente de novo.";
  } catch {}
  return "Câmera sem imagem agora.";
}

export default function CameraGrid({ cams }: { cams: string[] }) {
  const [playing, setPlaying] = useState<string[]>(() => cams.slice(0, 1));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [asleep, setAsleep] = useState(false);
  const [starting, setStarting] = useState(true); // ligando as câmeras, uma por vez
  const auto = useRef(true);
  const errorsRef = useRef(errors);
  const playingRef = useRef(playing);
  useEffect(() => {
    errorsRef.current = errors;
    playingRef.current = playing;
  }, [errors, playing]);
  const setAuto = (v: boolean) => {
    auto.current = v;
    setStarting(v);
  };

  // Liga a próxima câmera depois de um intervalo. Chamado quando a última mostrou imagem
  // (ou ficou 5 s sem erro: alguns navegadores não avisam "carregou" em MJPEG).
  function next(after: string) {
    if (!auto.current) return;
    setTimeout(() => {
      if (!auto.current) return;
      const p = playingRef.current;
      if (p[p.length - 1] !== after) return;
      const n = cams.find((c) => !p.includes(c) && !errorsRef.current[c]);
      if (!n) return setAuto(false);
      setPlaying([...p, n]);
    }, GAP_MS);
  }

  const last = playing[playing.length - 1];
  const advanced = useRef<string | null>(null);
  function loaded(cam: string) {
    if (cam !== last || advanced.current === cam) return;
    advanced.current = cam;
    next(cam);
  }
  useEffect(() => {
    if (!last || !auto.current) return;
    const t = setTimeout(() => loaded(last), 5000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last]);

  // Aba escondida por muito tempo: desliga tudo (como o app do celular em segundo plano).
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const onVis = () => {
      clearTimeout(t);
      if (document.hidden) {
        t = setTimeout(() => {
          setAuto(false);
          setAsleep(true);
          setPlaying([]);
        }, HIDDEN_MS);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearTimeout(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  function wake() {
    setAsleep(false);
    setErrors({});
    advanced.current = null;
    setAuto(true);
    setPlaying(cams.slice(0, 1));
  }

  async function failed(cam: string) {
    setAuto(false);
    setPlaying((p) => p.filter((c) => c !== cam));
    const msg = await motivo();
    setErrors((e) => ({ ...e, [cam]: msg }));
  }

  function retry(cam: string) {
    setErrors((e) => {
      const rest = { ...e };
      delete rest[cam];
      return rest;
    });
    setPlaying((p) => (p.includes(cam) ? p : [...p, cam]));
  }

  // Continua ligando as que faltam (depois de um erro, por exemplo), uma por vez.
  function resume() {
    setErrors({});
    advanced.current = null;
    setAuto(true);
    setPlaying((p) => {
      const n = cams.find((c) => !p.includes(c));
      return n ? [...p, n] : p;
    });
  }

  const missing = cams.filter((c) => !playing.includes(c) && !errors[c]).length;

  return (
    <>
      {asleep ? (
        <div className="mb-4 rounded-2xl border border-line bg-soft p-4 text-sm">
          As câmeras foram desligadas porque a página ficou em segundo plano (para poupar o gravador).{" "}
          <button onClick={wake} className="font-semibold text-brand hover:underline">
            Ligar de novo
          </button>
        </div>
      ) : (
        missing > 0 &&
        !starting && (
          <div className="mb-4 text-sm">
            <button onClick={resume} className="font-semibold text-brand hover:underline">
              Ligar as câmeras que faltam ({missing})
            </button>
          </div>
        )
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {cams.map((cam) => {
          const live = playing.includes(cam) && open !== cam;
          return (
            <figure key={cam} className="overflow-hidden rounded-2xl border border-line bg-white">
              <button
                onClick={() => setOpen(cam)}
                className="relative flex aspect-video w-full items-center justify-center bg-black"
                aria-label={`Ampliar ${label(cam)}`}
              >
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
                  <span className="px-6 text-center text-sm text-white/80">{errors[cam]}</span>
                ) : (
                  <span className="text-sm text-white/50">{open === cam ? "Aberta em HD" : "Na fila…"}</span>
                )}
              </button>
              <figcaption className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="font-semibold">{label(cam)}</span>
                {errors[cam] ? (
                  <button onClick={() => retry(cam)} className="font-semibold text-brand hover:underline">
                    Tentar de novo
                  </button>
                ) : (
                  <button onClick={() => setOpen(cam)} className="font-semibold text-brand hover:underline">
                    Ampliar (HD)
                  </button>
                )}
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
