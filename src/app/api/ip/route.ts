// Devolve o IP de quem está acessando o site.
// Na Vercel o IP real vem no cabeçalho x-forwarded-for (primeiro da lista) ou x-real-ip.
export async function GET(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null;

  const value = ip ?? "127.0.0.1";
  // ::1 e 127.0.0.1 = acesso pelo próprio computador (localhost).
  const local = ["::1", "127.0.0.1", "::ffff:127.0.0.1"].includes(value);

  return Response.json(
    { ip: value, local },
    { headers: { "Cache-Control": "no-store" } },
  );
}
