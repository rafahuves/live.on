import { getCurrentUser } from "@/lib/supabase/server";
import { PRECISOES, listAnalises, removeAnalise, updateAnalise, type Precisao } from "@/lib/analises";
import { loadPerfil } from "@/lib/perfil";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Faça login de novo." }, { status: 401 });
  // Nomes das câmeras dados na configuração ("Calçada"), para a lista agrupar por câmera.
  const perfil = await loadPerfil(user.id);
  const cameras = Object.fromEntries(
    (perfil?.cameras ?? []).filter((c) => c.nome && c.nome !== `Câmera ${c.ch}`).map((c) => [`cam${c.ch}`, c.nome]),
  );
  return Response.json({ analises: await listAnalises(user.id), cameras }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Faça login de novo." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!(await removeAnalise(user.id, id))) return Response.json({ error: "Não encontrada." }, { status: 404 });
  return Response.json({ analises: await listAnalises(user.id) });
}

// Muda a precisão, o objetivo ou liga/desliga uma análise (botões da lista "Análises salvas").
export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Faça login de novo." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { id?: string; precisao?: string; objetivo?: string; ativa?: boolean };
  const patch: { precisao?: Precisao; objetivo?: string | null; ativa?: boolean } = {};
  if (body.precisao !== undefined) {
    if (!PRECISOES.includes(body.precisao as Precisao)) return Response.json({ error: "Precisão inválida." }, { status: 400 });
    patch.precisao = body.precisao as Precisao;
  }
  if (body.objetivo !== undefined) patch.objetivo = String(body.objetivo).slice(0, 300).trim() || null;
  if (typeof body.ativa === "boolean") patch.ativa = body.ativa;
  const r = await updateAnalise(user.id, String(body.id ?? ""), patch);
  if (typeof r === "string") return Response.json({ error: `Não salvei: ${r}.` }, { status: 400 });
  return Response.json({ analises: await listAnalises(user.id) });
}
