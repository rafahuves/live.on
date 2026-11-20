// Conversas salvas do chat de Análises: listar, abrir uma (?id=) e apagar (DELETE ?id=). Só a dona da conta.
import { getCurrentUser } from "@/lib/supabase/server";
import { deleteConversa, listConversas, loadConversa } from "@/lib/conversas";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Faça login de novo." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (id) {
    const c = await loadConversa(user.id, id).catch(() => null);
    if (!c) return Response.json({ error: "Conversa não encontrada." }, { status: 404 });
    return Response.json(c, { headers: { "Cache-Control": "no-store" } });
  }
  return Response.json({ conversas: await listConversas(user.id) }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Faça login de novo." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id") ?? "";
  await deleteConversa(user.id, id).catch(() => {});
  return Response.json({ conversas: await listConversas(user.id) });
}
