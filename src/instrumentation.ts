// Roda uma vez quando o servidor do site inicia: liga o escudo dos gravadores e o robô do Telegram.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { ligarEscudos } = await import("./lib/dvr");
  // O conversor (go2rtc) pode demorar a subir: tenta agora e de novo em 15 s.
  await ligarEscudos().catch(() => {});
  setTimeout(() => void ligarEscudos().catch(() => {}), 15_000);
  const { iniciarRobo } = await import("./lib/telegramBot");
  iniciarRobo();
  const { iniciarRelatorioDiario } = await import("./lib/relatorioDiario");
  iniciarRelatorioDiario();
}
