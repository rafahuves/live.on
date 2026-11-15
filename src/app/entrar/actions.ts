"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";

export type AuthState = { error?: string; info?: string } | null;

function safeNext(v: FormDataEntryValue | null) {
  const s = String(v ?? "");
  return s.startsWith("/") && !s.startsWith("//") ? s : "/cameras";
}

function traduz(msg: string) {
  if (/invalid login credentials/i.test(msg)) return "E-mail ou senha incorretos.";
  if (/email not confirmed/i.test(msg)) return "Confirme o seu e-mail pelo link que enviamos antes de entrar.";
  if (/already registered/i.test(msg)) return "Já existe uma conta com esse e-mail. Use Entrar.";
  if (/password/i.test(msg)) return "A senha precisa ter pelo menos 8 caracteres.";
  return "Não deu certo. Tente de novo.";
}

export async function signIn(_prev: AuthState, form: FormData): Promise<AuthState> {
  if (!supabaseConfigured()) return { error: "As contas ainda não estão ativadas (Supabase)." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(form.get("email") ?? "").trim(),
    password: String(form.get("password") ?? ""),
  });
  if (error) return { error: traduz(error.message) };
  redirect(safeNext(form.get("next")));
}

export async function signUp(_prev: AuthState, form: FormData): Promise<AuthState> {
  if (!supabaseConfigured()) return { error: "As contas ainda não estão ativadas (Supabase)." };
  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? "http://localhost:3000";
  const password = String(form.get("password") ?? "");
  if (password.length < 8) return { error: "A senha precisa ter pelo menos 8 caracteres." };
  const name = String(form.get("name") ?? "").trim();
  const company = String(form.get("company") ?? "").trim();
  if (!name || !company) return { error: "Preencha o seu nome e a empresa que trabalha." };
  const { data, error } = await supabase.auth.signUp({
    email: String(form.get("email") ?? "").trim(),
    password,
    options: {
      data: { name, company },
      emailRedirectTo: `${origin}/auth/callback?next=/cameras`,
    },
  });
  if (error) return { error: traduz(error.message) };
  if (!data.session) return { info: "Conta criada! Enviamos um link para o seu e-mail. Clique nele para ativar a conta." };
  redirect("/cameras");
}

export async function logout() {
  if (!supabaseConfigured()) redirect("/entrar");
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/entrar");
}
