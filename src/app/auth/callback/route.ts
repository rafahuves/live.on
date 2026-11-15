import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Volta do Google/Microsoft/GitHub e do link de confirmação de e-mail.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next") ?? "/cameras";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/cameras";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(new URL("/entrar?erro=callback", url.origin));
}
