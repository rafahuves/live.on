"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/supabase/server";
import { activeChannels, loadDvr } from "@/lib/dvr";
import { replaceConfigAnalises } from "@/lib/analises";
import { analisesDoPerfil, empresaDaConta, salvarEmpresa, savePerfil, validarPerfil } from "@/lib/perfil";
import { ajustarNomeDoRobo, registrarCodigo, telegramConfigured } from "@/lib/telegram";

export async function salvarConfiguracao(perfil: unknown): Promise<{ error: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Faça login de novo." };
  const dvr = await loadDvr(user.id);
  if (!dvr) return { error: "Conecte o seu gravador primeiro." };
  const ok = validarPerfil(perfil, activeChannels(dvr));
  if (typeof ok === "string") return { error: ok };
  await savePerfil(user.id, ok);
  await replaceConfigAnalises(user.id, analisesDoPerfil(ok));
  if (telegramConfigured()) {
    if (ok.empresa?.trim()) await salvarEmpresa(user.id, ok.empresa);
    const empresa = await empresaDaConta(user.id, user.company);
    await ajustarNomeDoRobo(empresa);
    await registrarCodigo(user.id, empresa, user.name);
  }
  revalidatePath("/analises");
  revalidatePath("/cameras");
  redirect("/analises?configurado=1");
}
