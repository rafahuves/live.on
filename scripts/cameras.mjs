// Liga o go2rtc (conversor de vídeo) neste computador. As câmeras de cada conta são adicionadas pelo site,
// só na memória do go2rtc: a configuração vai pela linha de comando e nada (nem senha) é gravado em disco.
// Uso: npm run cameras   (deixe o Terminal aberto)
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";

if (!existsSync("bin/go2rtc")) {
  console.error("Não achei bin/go2rtc. Baixe em https://github.com/AlexxIT/go2rtc/releases");
  process.exit(1);
}

const config = JSON.stringify({
  api: { listen: "127.0.0.1:1984", origin: "*" },
  rtsp: { listen: "127.0.0.1:8554" },
});

console.log("go2rtc ligado. Abra http://localhost:3000/cameras e conecte o seu gravador.");
const child = spawn("bin/go2rtc", ["-config", config], { stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 0));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
