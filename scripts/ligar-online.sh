#!/bin/bash
# Liga o Live.On neste Mac e cria um link público (https) para abrir de qualquer lugar.
# - go2rtc (conversor de vídeo) na porta 1984, só local
# - site (Next.js, versão de produção) na porta 3001
# - túnel Cloudflare: gera o link https://….trycloudflare.com
# - caffeinate: o Mac não dorme enquanto esta janela estiver aberta
# Para desligar tudo: feche esta janela ou aperte Ctrl+C.

cd "$(dirname "$0")/.." || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
LOG="data/logs"
mkdir -p "$LOG"
PIDS=()

parar() {
  echo
  echo "Desligando o Live.On..."
  for p in "${PIDS[@]}"; do kill "$p" 2>/dev/null; done
  exit 0
}
trap parar INT TERM HUP

echo "=== Live.On: ligando tudo ==="

# 1) Mac acordado (tela pode apagar, o Mac não dorme)
caffeinate -imsu -w $$ &
PIDS+=($!)

# 2) Conversor de vídeo (reaproveita se já estiver ligado)
if curl -s -o /dev/null -m 2 http://127.0.0.1:1984/api/streams; then
  echo "[ok] Conversor de vídeo já estava ligado."
else
  ( while true; do node scripts/cameras.mjs >>"$LOG/go2rtc.log" 2>&1; sleep 3; done ) &
  PIDS+=($!)
  echo "[..] Ligando o conversor de vídeo..."
fi

# 3) Site (produção). Monta a versão final se ainda não existir.
if [ ! -f .next/BUILD_ID ]; then
  echo "[..] Montando o site (só na primeira vez, ~1 min)..."
  npm run build >>"$LOG/build.log" 2>&1 || { echo "[ERRO] O site não montou. Veja $LOG/build.log"; exit 1; }
fi
( while true; do npx next start -p 3001 >>"$LOG/site.log" 2>&1; sleep 3; done ) &
PIDS+=($!)
for i in $(seq 1 60); do
  curl -s -o /dev/null -m 2 http://localhost:3001/entrar && break
  sleep 1
done
echo "[ok] Site ligado em http://localhost:3001"

# 4) Túnel público
: >"$LOG/tunel.log"
cloudflared tunnel --no-autoupdate --url http://localhost:3001 >>"$LOG/tunel.log" 2>&1 &
PIDS+=($!)
URL=""
for i in $(seq 1 60); do
  URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$LOG/tunel.log" | head -1)
  [ -n "$URL" ] && break
  sleep 1
done

if [ -z "$URL" ]; then
  echo "[ERRO] O link público não foi criado. Veja $LOG/tunel.log"
else
  echo "$URL/cameras" >"$LOG/LINK.txt"
  echo
  echo "=============================================================="
  echo "  LINK PARA ABRIR NO CELULAR:"
  echo
  echo "     $URL/cameras"
  echo
  echo "  (também salvo em data/logs/LINK.txt)"
  echo "=============================================================="
  echo
  echo "Deixe esta janela ABERTA e o Mac na TOMADA, com a tampa ABERTA."
fi

wait
