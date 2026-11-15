import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const supabaseConfigured = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

// Cliente Supabase para Server Components, Server Actions e Route Handlers.
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Chamado de um Server Component: quem renova os cookies é o proxy.
        }
      },
    },
  });
}

export type CurrentUser = { id: string; email: string | null; company: string | null; name: string | null };

// Usuário logado (validado pelo Supabase) ou null.
export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (!supabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  const meta = (claims.user_metadata ?? {}) as { company?: unknown; name?: unknown; full_name?: unknown };
  const nome = [meta.name, meta.full_name].find((v): v is string => typeof v === "string" && !!v.trim());
  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
    company: typeof meta.company === "string" && meta.company.trim() ? meta.company.trim() : null,
    name: nome?.trim() ?? null,
  };
}
