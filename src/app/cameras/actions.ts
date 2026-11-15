"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/supabase/server";
import { deleteDvr, detectActive, discoverDvrs, go2rtcOnline, loadDvr, saveDvr, testDvr, type Dvr } from "@/lib/dvr";

export type ConnectState = { error?: string } | null;

export async function connectDvr(_prev: ConnectState, form: FormData): Promise<ConnectState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Faça login de novo." };
  if (!(await go2rtcOnline())) return { error: "O conversor de vídeo está desligado. Rode npm run cameras no Terminal." };

  const dvr: Dvr = {
    host: String(form.get("host") ?? "").trim(),
    port: Number(form.get("port") || 554),
    user: String(form.get("user") ?? "").trim(),
    pass: String(form.get("pass") ?? ""),
    channels: Number(form.get("channels") || 4),
  };
  if (!/^[a-z0-9.-]+$/i.test(dvr.host)) return { error: "Endereço do gravador inválido (ex.: 192.168.1.108)." };
  if (!Number.isInteger(dvr.port) || dvr.port < 1 || dvr.port > 65535) return { error: "Porta inválida." };
  if (!Number.isInteger(dvr.channels) || dvr.channels < 1 || dvr.channels > 64) return { error: "Número de câmeras inválido." };
  if (!dvr.user || !dvr.pass) return { error: "Preencha o usuário e a senha do gravador." };

  if (!(await testDvr(dvr))) {
    return { error: "Não consegui ver a câmera 1. Confira o endereço, o usuário e a senha do gravador." };
  }
  const active = await detectActive(dvr);
  await saveDvr(user.id, active ? { ...dvr, active } : dvr);
  revalidatePath("/cameras");
  return null;
}

// "Procurar câmeras de novo": refaz a lista de canais com câmera (um canal por vez).
export async function rescanChannels() {
  const user = await getCurrentUser();
  if (!user) return;
  const dvr = await loadDvr(user.id);
  if (!dvr) return;
  const active = await detectActive(dvr);
  if (active) await saveDvr(user.id, { ...dvr, active });
  revalidatePath("/cameras");
}

export async function disconnectDvr() {
  const user = await getCurrentUser();
  if (!user) return;
  await deleteDvr(user.id);
  revalidatePath("/cameras");
}

export async function findDvrs(): Promise<string[]> {
  if (!(await getCurrentUser())) return [];
  return discoverDvrs();
}
