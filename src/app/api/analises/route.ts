import { getCurrentUser } from "@/lib/supabase/server";
import { listAnalises, removeAnalise } from "@/lib/analises";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Faça login de novo." }, { status: 401 });
  return Response.json({ analises: await listAnalises(user.id) }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Faça login de novo." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!(await removeAnalise(user.id, id))) return Response.json({ error: "Não encontrada." }, { status: 404 });
  return Response.json({ analises: await listAnalises(user.id) });
}
