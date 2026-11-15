// Roda uma vez quando o servidor do site inicia: liga o robô do Telegram (sempre ouvindo).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { iniciarRobo } = await import("./lib/telegramBot");
  iniciarRobo();
}
