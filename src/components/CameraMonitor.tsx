"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ObjectDetection } from "@tensorflow-models/coco-ssd";
import {
  ALERT_COOLDOWN_MS,
  DEFAULT_FORBIDDEN,
  DETECTABLE_CLASSES,
  DETECT_INTERVAL_MS,
  MIN_SCORE,
  labelFor,
} from "@/lib/detection-config";

type Status = "idle" | "loading-model" | "starting-camera" | "running" | "error";

type AlertEntry = { id: number; cls: string; score: number; at: Date };

export default function CameraMonitor() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modelRef = useRef<ObjectDetection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const lastAlertRef = useRef<Record<string, number>>({});
  const forbiddenRef = useRef<Set<string>>(new Set(DEFAULT_FORBIDDEN));

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState<Set<string>>(new Set(DEFAULT_FORBIDDEN));
  const [alerts, setAlerts] = useState<AlertEntry[]>([]);
  const [activeAlert, setActiveAlert] = useState<string | null>(null);

  useEffect(() => {
    forbiddenRef.current = forbidden;
  }, [forbidden]);

  const beep = useCallback(() => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      osc.frequency.value = 880;
      osc.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
      osc.onended = () => ctx.close();
    } catch {
      // som é opcional
    }
  }, []);

  const raiseAlert = useCallback(
    (cls: string, score: number) => {
      const now = Date.now();
      if (now - (lastAlertRef.current[cls] ?? 0) < ALERT_COOLDOWN_MS) return;
      lastAlertRef.current[cls] = now;
      setAlerts((prev) => [{ id: now, cls, score, at: new Date(now) }, ...prev].slice(0, 50));
      setActiveAlert(cls);
      beep();
      // TODO: enviar o evento ao backend (Supabase) para notificar quem monitora.
    },
    [beep],
  );

  // A função do loop fica num ref para poder se reagendar sem se referenciar.
  const loopRef = useRef<() => Promise<void>>(async () => {});
  const schedule = useCallback(() => {
    timerRef.current = window.setTimeout(() => loopRef.current(), DETECT_INTERVAL_MS);
  }, []);

  const detectOnce = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const model = modelRef.current;
    if (!video || !canvas || !model || !streamRef.current) return;
    if (video.readyState < 2) return schedule();

    const predictions = await model.detect(video);
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const g = canvas.getContext("2d")!;
    g.clearRect(0, 0, canvas.width, canvas.height);

    let anyForbidden = false;
    for (const p of predictions) {
      if (p.score < MIN_SCORE) continue;
      const isForbidden = forbiddenRef.current.has(p.class);
      const [x, y, w, h] = p.bbox;
      g.lineWidth = 3;
      g.strokeStyle = isForbidden ? "#ef4444" : "#22c55e";
      g.strokeRect(x, y, w, h);
      g.fillStyle = g.strokeStyle;
      g.font = "16px sans-serif";
      g.fillText(`${labelFor(p.class)} ${Math.round(p.score * 100)}%`, x + 4, y > 20 ? y - 6 : y + 18);
      if (isForbidden) {
        anyForbidden = true;
        raiseAlert(p.class, p.score);
      }
    }
    if (!anyForbidden) setActiveAlert(null);

    if (streamRef.current) schedule();
  }, [raiseAlert, schedule]);

  useEffect(() => {
    loopRef.current = detectOnce;
  }, [detectOnce]);

  const stop = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setActiveAlert(null);
    setStatus("idle");
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      if (!modelRef.current) {
        setStatus("loading-model");
        // Import dinâmico: o TensorFlow só carrega no navegador, quando necessário.
        await import("@tensorflow/tfjs");
        const cocoSsd = await import("@tensorflow-models/coco-ssd");
        modelRef.current = await cocoSsd.load({ base: "lite_mobilenet_v2" });
      }
      setStatus("starting-camera");
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      setStatus("running");
      loopRef.current();
    } catch (e) {
      const msg =
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "Permissão da câmera negada. Libere o acesso nas configurações do navegador."
          : e instanceof Error
            ? e.message
            : String(e);
      stop();
      setError(msg);
      setStatus("error");
    }
  }, [stop]);

  useEffect(() => stop, [stop]);

  const toggle = (id: string) =>
    setForbidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const running = status === "running";
  const busy = status === "loading-model" || status === "starting-camera";

  return (
    <div className="flex w-full flex-col gap-6 lg:flex-row">
      <div className="flex flex-1 flex-col gap-3">
        <div
          className={`relative aspect-video w-full overflow-hidden rounded-xl bg-zinc-900 ring-4 transition ${
            activeAlert ? "ring-red-500" : "ring-transparent"
          }`}
        >
          <video ref={videoRef} className="absolute inset-0 h-full w-full object-contain" muted playsInline />
          <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full object-contain" />
          {!running && (
            <div className="absolute inset-0 flex items-center justify-center text-zinc-400">
              {status === "loading-model" && "Carregando modelo de detecção..."}
              {status === "starting-camera" && "Abrindo a câmera..."}
              {(status === "idle" || status === "error") && "Câmera desligada"}
            </div>
          )}
          {activeAlert && (
            <div className="absolute left-3 top-3 rounded-md bg-red-600 px-3 py-1 text-sm font-semibold text-white">
              ALERTA: {labelFor(activeAlert)}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          {!running ? (
            <button
              onClick={start}
              disabled={busy}
              className="rounded-lg bg-black px-5 py-2 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
            >
              {busy ? "Iniciando..." : "Ligar câmera"}
            </button>
          ) : (
            <button onClick={stop} className="rounded-lg border border-zinc-400 px-5 py-2 font-medium">
              Desligar
            </button>
          )}
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <aside className="flex w-full flex-col gap-6 lg:w-72">
        <section>
          <h2 className="mb-2 font-semibold">O que é proibido</h2>
          <ul className="flex flex-col gap-1">
            {DETECTABLE_CLASSES.map((c) => (
              <li key={c.id}>
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={forbidden.has(c.id)} onChange={() => toggle(c.id)} />
                  {c.label}
                </label>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-2 font-semibold">Alertas ({alerts.length})</h2>
          {alerts.length === 0 ? (
            <p className="text-sm text-zinc-500">Nenhum alerta ainda.</p>
          ) : (
            <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto text-sm">
              {alerts.map((a) => (
                <li key={a.id} className="flex justify-between rounded bg-red-50 px-2 py-1 text-red-800 dark:bg-red-950 dark:text-red-200">
                  <span>{labelFor(a.cls)} ({Math.round(a.score * 100)}%)</span>
                  <span>{a.at.toLocaleTimeString("pt-BR")}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>
    </div>
  );
}
