"use client";

import { useEffect } from "react";

// Efeitos da landing (só na página inicial): câmeras simuladas em <canvas data-cam>, relógio das câmeras,
// leve profundidade dos painéis do topo e o "Como funciona" que se monta conforme a rolagem.
// Tudo respeita "reduzir movimento" do sistema. A página fica completa mesmo sem este script.
type Cena = { hue: number; floor: number; walk: [number, number] | null; speed?: number; label?: string };

const CENAS: Record<string, Cena> = {
  portao: { hue: 260, floor: 0.62, walk: [0.1, 0.8], speed: 0.00006, label: "pessoa 92%" },
  doca: { hue: 250, floor: 0.58, walk: [0.25, 0.7], speed: 0.00004, label: "pessoa 94%" },
  estoque: { hue: 270, floor: 0.66, walk: null },
  patio: { hue: 240, floor: 0.55, walk: [0.6, 0.15], speed: 0.00005, label: "pessoa 88%" },
};

export default function LandingFx() {
  useEffect(() => {
    const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;

    // ---- câmeras simuladas ----
    const cams = [...document.querySelectorAll<HTMLCanvasElement>(".lp canvas[data-cam]")]
      .map((c) => ({ c, ctx: c.getContext("2d")!, s: CENAS[c.dataset.cam ?? ""], seed: Math.random() * 1000 }))
      .filter((k) => k.s && k.ctx);
    const size = () => {
      for (const k of cams) {
        const r = k.c.getBoundingClientRect();
        k.c.width = Math.max(160, (r.width * 1.5) | 0);
        k.c.height = Math.max(100, (r.height * 1.5) | 0);
      }
    };
    size();
    addEventListener("resize", size);

    const draw = (t: number) => {
      for (const k of cams) {
        const { ctx, c, s } = k;
        const w = c.width;
        const h = c.height;
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, `hsl(${s.hue} 30% 9%)`);
        g.addColorStop(s.floor, `hsl(${s.hue} 22% 14%)`);
        g.addColorStop(1, `hsl(${s.hue} 18% 6%)`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "rgba(255,255,255,.05)";
        ctx.lineWidth = 1;
        for (let i = -6; i <= 6; i++) {
          ctx.beginPath();
          ctx.moveTo(w / 2 + i * w * 0.04, h * s.floor);
          ctx.lineTo(w / 2 + i * w * 0.22, h);
          ctx.stroke();
        }
        for (let j = 1; j < 6; j++) {
          const y = h * s.floor + (h - h * s.floor) * (j / 6) ** 1.6;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
        }
        ctx.fillStyle = "rgba(255,255,255,.06)";
        ctx.fillRect(w * 0.08, h * (s.floor - 0.22), w * 0.14, h * 0.22);
        ctx.fillRect(w * 0.74, h * (s.floor - 0.3), w * 0.18, h * 0.3);
        if (s.walk && s.speed) {
          const p = calm ? 0.45 : (Math.sin(t * s.speed * 6.283 + k.seed) + 1) / 2;
          const x = w * (s.walk[0] + (s.walk[1] - s.walk[0]) * p);
          const y = h * (s.floor + 0.12);
          const ph = h * 0.34;
          const pw = ph * 0.38;
          ctx.fillStyle = "rgba(200,190,230,.32)";
          ctx.beginPath();
          ctx.arc(x, y - ph * 0.82, pw * 0.32, 0, 7);
          ctx.fill();
          ctx.fillRect(x - pw * 0.36, y - ph * 0.68, pw * 0.72, ph * 0.55);
          ctx.fillRect(x - pw * 0.3, y - ph * 0.14, pw * 0.22, ph * 0.22);
          ctx.fillRect(x + pw * 0.08, y - ph * 0.14, pw * 0.22, ph * 0.22);
          ctx.strokeStyle = "#a78bfa";
          ctx.lineWidth = Math.max(1.5, w / 260);
          ctx.strokeRect(x - pw * 0.65, y - ph, pw * 1.3, ph * 1.12);
          ctx.fillStyle = "#a78bfa";
          ctx.font = `500 ${Math.max(9, w / 34)}px ui-monospace, Menlo, monospace`;
          ctx.fillText(s.label ?? "", x - pw * 0.65, y - ph - 5);
        }
        const img = ctx.getImageData(0, 0, w, h);
        const d = img.data;
        for (let i = 0; i < d.length; i += 16) {
          const n = (Math.random() - 0.5) * 26;
          d[i] += n;
          d[i + 1] += n;
          d[i + 2] += n;
        }
        ctx.putImageData(img, 0, 0);
      }
    };
    let last = 0;
    const loop = (t: number) => {
      if (t - last > 70) {
        draw(t);
        last = t;
      }
      if (!calm) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    // ---- relógio das câmeras ----
    const recs = document.querySelectorAll(".lp .rec");
    const tick = () => recs.forEach((r) => (r.textContent = new Date().toLocaleTimeString("pt-BR")));
    tick();
    const clock = setInterval(tick, 1000);

    // ---- profundidade no topo + "Como funciona" pela rolagem ----
    const par = [...document.querySelectorAll<HTMLElement>(".lp [data-parallax]")];
    const glows = [...document.querySelectorAll<HTMLElement>(".lp .glow")];
    const track = document.querySelector<HTMLElement>(".lp .how-track");
    const steps = [...document.querySelectorAll(".lp .step")];
    const scenes = [...document.querySelectorAll(".lp .scene")];
    const prog = document.querySelector<HTMLElement>(".lp .progress");
    const state = document.getElementById("devState");
    const labels = ["conectando…", "8 câmeras", "alerta enviado"];
    const wide = matchMedia("(min-width: 981px)");
    const onScroll = () => {
      const y = scrollY;
      if (!calm) {
        if (y < innerHeight * 1.2) par.forEach((el) => (el.style.translate = `0 ${y * parseFloat(el.dataset.parallax ?? "0")}px`));
        if (glows[0]) glows[0].style.translate = `0 ${y * 0.12}px`;
        if (glows[1]) glows[1].style.translate = `0 ${y * -0.06}px`;
      }
      if (!wide.matches || !track || !prog) return;
      const r = track.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, -r.top / (r.height - innerHeight)));
      prog.style.setProperty("--p", p.toFixed(3));
      const i = p < 0.34 ? 0 : p < 0.67 ? 1 : 2;
      steps.forEach((s, k) => s.classList.toggle("on", k === i));
      scenes.forEach((s, k) => s.classList.toggle("on", k === i));
      if (state) state.textContent = labels[i];
    };
    addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(clock);
      removeEventListener("resize", size);
      removeEventListener("scroll", onScroll);
    };
  }, []);
  return null;
}
