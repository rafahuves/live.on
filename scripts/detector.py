#!/usr/bin/env python3
"""
Detector do Live.On: olha as câmeras, acha pessoas (YOLO) e aplica as análises de cada conta.

Cuidado com o gravador (regra do projeto: NUNCA sobrecarregar o DVR):
- lê as imagens do go2rtc (127.0.0.1:1984), nunca direto do gravador; o go2rtc passa pelo escudo
  (src/lib/dvrShield.ts), que limita conexões e ritmo;
- 1 conexão contínua por câmera (o mesmo vídeo "_mjpeg" que o painel usa, então quem assiste não abre outra);
- abre as câmeras uma de cada vez (1,5 s entre elas) e, se uma falhar, espera cada vez mais (30 s → 5 min).

Alertas: manda para o site (rota interna /api/interno/alerta), que entrega no Telegram com a foto.
Eventos: data/eventos/<id da conta>.jsonl (passagens etc.), usados nos relatórios do chat.

Rodar: .venv-detector/bin/python scripts/detector.py   (scripts/ligar-online.sh já liga sozinho)
"""
import base64
import io
import json
import os
import re
import sys
import threading
import time
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

RAIZ = Path(__file__).resolve().parent.parent
GO2RTC = "http://127.0.0.1:1984"
SITE = "http://127.0.0.1:3001"
FUSO = ZoneInfo("America/Sao_Paulo")
DIAS = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"]

INTERVALO = 1.0            # analisa cada câmera ~1x por segundo
CONFIANCA = 0.35           # certeza mínima para dizer "é uma pessoa"
ESPERA_ALERTA = 5 * 60     # no máximo 1 alerta a cada 5 min por análise e câmera
TAMPADA_SEG = 30           # imagem "lisa" por 30 s = câmera tampada
SEM_SINAL_SEG = 120        # 2 min sem imagem = câmera sem sinal
PERMANENCIA_SEG = 60       # pessoa parada 1 min (se a análise não disser outro limite)
SUMIU_SEG = 3              # pessoa some por 3 s = a passagem terminou
JANELA, MINIMO_NA_JANELA = 5, 3  # pessoa precisa aparecer em 3 das últimas 5 imagens (~3 s)
CONFIRMA = 0.45            # certeza mínima do modelo preciso para confirmar um alerta


def log(*a):
    print(datetime.now(FUSO).strftime("%H:%M:%S"), *a, flush=True)


def chave_local():
    for linha in (RAIZ / ".env.local").read_text().splitlines():
        if linha.startswith("LIVEON_LOCAL_KEY="):
            return linha.split("=", 1)[1].strip().strip('"')
    return ""


# ---------------------------------------------------------------- câmeras (go2rtc)
class Camera:
    """Mantém 1 conexão MJPEG com o go2rtc e guarda sempre a imagem mais recente."""

    def __init__(self, stream):
        self.stream = stream
        self.jpg = None
        self.quando = 0.0
        self.parar = False
        self.falhas = 0
        threading.Thread(target=self._rodar, daemon=True).start()

    def _rodar(self):
        while not self.parar:
            try:
                # Mesmo vídeo que o painel usa ("_mjpeg", 480 px): quem assiste não abre outra conexão.
                q = urllib.parse.urlencode({"name": f"{self.stream}_mjpeg", "src": f"ffmpeg:{self.stream}#video=mjpeg#width=480"})
                urllib.request.urlopen(urllib.request.Request(f"{GO2RTC}/api/streams?{q}", method="PUT"), timeout=3).close()
            except Exception:
                pass  # o go2rtc responde 400 ("config disabled") mesmo adicionando
            try:
                with urllib.request.urlopen(f"{GO2RTC}/api/stream.mjpeg?src={self.stream}_mjpeg", timeout=15) as r:
                    self.falhas = 0
                    self._ler(r)
            except Exception:
                pass
            if self.parar:
                break
            self.falhas += 1
            time.sleep(min(30 * 2 ** (self.falhas - 1), 300))  # 30 s, 60 s, 2 min, 4 min, 5 min...

    def _ler(self, r):
        buf = b""
        while not self.parar:
            chunk = r.read(65536)
            if not chunk:
                return
            buf += chunk
            # Pega a última imagem JPEG completa do pedaço lido.
            fim = buf.rfind(b"\xff\xd9")
            if fim < 0:
                continue
            ini = buf.rfind(b"\xff\xd8", 0, fim)
            if ini >= 0:
                self.jpg = buf[ini:fim + 2]
                self.quando = time.time()
            buf = buf[fim + 2:]


# ---------------------------------------------------------------- contas e análises
def contas_e_cameras():
    """{user_id: {"cam7": "u..._cam7", ...}} das câmeras que existem no go2rtc."""
    try:
        streams = json.load(urllib.request.urlopen(f"{GO2RTC}/api/streams", timeout=3))
    except Exception:
        return {}
    contas = {}
    for f in (RAIZ / "data" / "analises").glob("*.json"):
        uid = f.stem
        prefixo = "u" + uid.replace("-", "")[:12] + "_"
        cams = {}
        for nome in streams:
            m = re.fullmatch(re.escape(prefixo) + r"(cam\d+)", nome)
            if m:
                cams[m.group(1)] = nome
        if cams:
            contas[uid] = cams
    return contas


def analises(uid):
    try:
        return [a for a in json.loads((RAIZ / "data" / "analises" / f"{uid}.json").read_text()) if a.get("ativa", True)]
    except Exception:
        return []


def nomes_das_cameras(uid):
    try:
        perfil = json.loads((RAIZ / "data" / "perfil" / f"{uid}.json").read_text())
        return {f"cam{c['ch']}": c.get("nome") or f"Câmera {c['ch']}" for c in perfil.get("cameras", [])}
    except Exception:
        return {}


def vale_agora(a, agora):
    """A análise está valendo neste dia e horário?"""
    if a.get("dias") and DIAS[agora.weekday()] not in a["dias"]:
        return False
    ini, fim = a.get("horario_inicio"), a.get("horario_fim")
    if not ini or not fim:
        return True
    h = agora.strftime("%H:%M")
    return ini <= h < fim if ini <= fim else (h >= ini or h < fim)  # janela que vira a noite (22:00–06:00)


# ---------------------------------------------------------------- envio e eventos
CHAVE = chave_local()


ENSAIO = os.environ.get("DETECTOR_ENSAIO") == "1"  # ensaio: mostra o que faria, sem mandar no Telegram


def alertar(uid, texto, jpg):
    if ENSAIO:
        log("[ensaio] mandaria:", texto.replace("\n", " | "))
        return False
    corpo = json.dumps({"userId": uid, "texto": texto, "foto": base64.b64encode(jpg).decode() if jpg else None}).encode()
    req = urllib.request.Request(
        f"{SITE}/api/interno/alerta", data=corpo, method="POST",
        headers={"Content-Type": "application/json", "x-liveon-key": CHAVE},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.load(r).get("enviado", False)
    except Exception as e:
        log("alerta não enviado:", e)
        return False


def evento(uid, dados):
    pasta = RAIZ / "data" / "eventos"
    pasta.mkdir(parents=True, exist_ok=True)
    with open(pasta / f"{uid}.jsonl", "a") as f:
        f.write(json.dumps({"ts": datetime.now(FUSO).isoformat(timespec="seconds"), **dados}, ensure_ascii=False) + "\n")


def guardar(uid, cam, imagem, caixas, tipo):
    """Guarda a foto de cada alerta (e dos descartados) em data/alertas/, para conferir depois. Fica 7 dias."""
    from PIL import ImageDraw
    pasta = RAIZ / "data" / "alertas" / uid
    pasta.mkdir(parents=True, exist_ok=True)
    foto = imagem.copy()
    d = ImageDraw.Draw(foto)
    for x1, y1, x2, y2 in caixas:
        d.rectangle([x1, y1, x2, y2], outline=(234, 179, 8), width=3)
    foto.save(pasta / f"{datetime.now(FUSO).strftime('%Y%m%d-%H%M%S')}-{cam}-{tipo}.jpg", quality=80)
    limite = time.time() - 7 * 86400
    for f in pasta.glob("*.jpg"):
        if f.stat().st_mtime < limite:
            f.unlink(missing_ok=True)


# ---------------------------------------------------------------- principal
def main():
    from PIL import Image, ImageDraw, ImageStat
    from ultralytics import YOLO
    import torch

    pasta_modelo = RAIZ / "models"
    pasta_modelo.mkdir(exist_ok=True)
    os.chdir(pasta_modelo)  # o YOLO baixa o modelo (≈6 MB) aqui na primeira vez
    modelo = YOLO("yolo11n.pt")  # rápido: olha todas as câmeras o tempo todo
    # Preciso (lento, ~4 s na CPU): só confirma a imagem antes de um alerta de pessoa (barra alarme falso).
    preciso = YOLO("yolo11x.pt") if (pasta_modelo / "yolo11x.pt").exists() else None
    # CPU por padrão: a placa de vídeo do Mac (MPS) trava com este PyTorch no macOS 14. O modelo pequeno
    # (yolo11n) leva menos de 0,1 s por imagem na CPU. Para testar a placa: DETECTOR_APARELHO=mps.
    aparelho = os.environ.get("DETECTOR_APARELHO", "cpu")
    torch.set_num_threads(4)  # deixa núcleos livres para o site e o conversor
    log(f"detector ligado (YOLO em {aparelho}).")

    cameras = {}        # stream -> Camera
    estado = {}         # (uid, cam) -> {"pessoas": bool, "desde": t, "visto": t, "liso_desde": t}
    ultimo_alerta = {}  # (id da análise, cam) -> t
    contagem = {}       # (id da análise, cam, período) -> passagens
    ultima_config = 0.0
    contas = {}

    while True:
        inicio = time.time()

        # Recarrega contas, câmeras e análises a cada 30 s. Só abre câmera que alguma análise usa.
        if inicio - ultima_config > 30:
            ultima_config = inicio
            contas = contas_e_cameras()
            precisa = set()
            for uid, cams in contas.items():
                for a in analises(uid):
                    alvo = a.get("cameras") or list(cams)
                    precisa.update(cams[c] for c in alvo if c in cams)
            for s in list(cameras):
                if s not in precisa:
                    cameras.pop(s).parar = True
            for s in sorted(precisa - set(cameras)):
                cameras[s] = Camera(s)
                time.sleep(1.5)  # abre uma câmera de cada vez
            if precisa and len(cameras) != getattr(main, "ultimo_total", -1):
                main.ultimo_total = len(cameras)
                log(f"{len(cameras)} câmeras sendo analisadas.")

        # Uma rodada: pega a imagem mais recente de cada câmera e roda o YOLO em todas de uma vez.
        lote = []
        for uid, cams in contas.items():
            for cam, stream in cams.items():
                c = cameras.get(stream)
                if c and c.jpg and time.time() - c.quando < 5:
                    lote.append((uid, cam, c.jpg))
        imagens = []
        for _, _, jpg in lote:
            try:
                imagens.append(Image.open(io.BytesIO(jpg)).convert("RGB"))
            except Exception:
                imagens.append(None)
        validas = [i for i, im in enumerate(imagens) if im is not None]
        resultados = {}
        if validas:
            saida = modelo.predict([imagens[i] for i in validas], classes=[0], conf=CONFIANCA, device=aparelho, verbose=False)
            for i, r in zip(validas, saida):
                resultados[i] = [tuple(map(float, b)) for b in r.boxes.xyxy.tolist()]

        agora = datetime.now(FUSO)
        t = time.time()
        for i, (uid, cam, jpg) in enumerate(lote):
            if imagens[i] is None:
                continue
            caixas = resultados.get(i, [])
            e = estado.setdefault((uid, cam), {"pessoas": False, "desde": t, "visto": 0.0, "liso_desde": None, "hist": []})

            # Contra alarme falso: só conta "tem pessoa" se ela aparece em pelo menos 3 das últimas 5 imagens
            # (uns 3 s). Uma sombra, a manta no sofá ou o reflexo do infravermelho por 1 imagem não contam.
            e["hist"] = (e["hist"] + [bool(caixas)])[-JANELA:]
            presente = sum(e["hist"]) >= MINIMO_NA_JANELA
            if presente and caixas:
                e["caixas"] = caixas
            caixas = e.get("caixas", []) if presente else []
            n = len(caixas)

            # Passagem = alguém aparece (de verdade) depois de a imagem ficar vazia por alguns segundos.
            nova_passagem = False
            if presente:
                if not e["pessoas"]:
                    e["pessoas"], e["desde"], nova_passagem = True, t, True
                    evento(uid, {"cam": cam, "tipo": "passagem", "pessoas": n})
                e["visto"] = t
            elif e["pessoas"] and t - e["visto"] > SUMIU_SEG:
                e["pessoas"] = False

            # Imagem "lisa" (quase uma cor só) = câmera tampada.
            desvio = sum(ImageStat.Stat(imagens[i].convert("L")).stddev)
            e["liso_desde"] = (e["liso_desde"] or t) if desvio < 6 else None

            # Quais análises desta câmera disparam agora.
            disparadas = []
            for a in analises(uid):
                if a.get("cameras") and cam not in a["cameras"]:
                    continue
                if not vale_agora(a, agora):
                    continue
                tipo, limite = a["tipo"], a.get("limite")
                disparar = False
                if tipo in ("pessoa_fora_do_horario", "invasao_de_area"):
                    disparar = presente
                elif tipo == "contagem_de_pessoas":
                    disparar = presente and n > (limite or 5)
                elif tipo == "permanencia_em_area":
                    disparar = e["pessoas"] and t - e["desde"] >= (limite * 60 if limite else PERMANENCIA_SEG)
                elif tipo == "passagens_por_area" and nova_passagem:
                    periodo = agora.strftime("%Y-%m-%d") if a.get("periodo") != "hora" else agora.strftime("%Y-%m-%d %H")
                    k = (a["id"], cam, periodo)
                    contagem[k] = contagem.get(k, 0) + 1
                    disparar = bool(limite) and contagem[k] == limite + 1  # avisa quando passa do limite
                elif tipo == "camera_sem_sinal_ou_tampada":
                    disparar = e["liso_desde"] is not None and t - e["liso_desde"] >= TAMPADA_SEG
                if disparar and t - ultimo_alerta.get((a["id"], cam), 0) >= ESPERA_ALERTA:
                    disparadas.append(a)
            if not disparadas:
                continue

            # Alerta de pessoa: o modelo PRECISO tem que confirmar na imagem de agora (barra alarme falso).
            de_pessoa = [a for a in disparadas if a["tipo"] != "camera_sem_sinal_ou_tampada"]
            if de_pessoa and preciso:
                if t - e.get("recusado", 0) < 60:
                    disparadas = [a for a in disparadas if a not in de_pessoa]
                else:
                    rx = preciso.predict(imagens[i], classes=[0], conf=CONFIRMA, device=aparelho, verbose=False)[0]
                    if len(rx.boxes):
                        caixas = [tuple(map(float, b)) for b in rx.boxes.xyxy.tolist()]
                        n = len(caixas)
                    else:
                        e["recusado"] = t
                        log(f"descartado (o modelo preciso não viu pessoa): {cam}")
                        guardar(uid, cam, imagens[i], resultados.get(i, []), "descartado")
                        disparadas = [a for a in disparadas if a not in de_pessoa]
            if not disparadas:
                continue
            for a in disparadas:
                ultimo_alerta[(a["id"], cam)] = t

            # UMA mensagem por câmera, mesmo que várias análises disparem juntas. Print com as pessoas marcadas.
            foto = imagens[i].copy()
            d = ImageDraw.Draw(foto)
            for x1, y1, x2, y2 in caixas:
                d.rectangle([x1, y1, x2, y2], outline=(124, 58, 237), width=4)
            buf = io.BytesIO()
            foto.save(buf, "JPEG", quality=85)
            nome = nomes_das_cameras(uid).get(cam, cam)
            motivos = list(dict.fromkeys(a["mensagem_alerta"] for a in disparadas))
            texto = "🔔 " + "\n🔔 ".join(motivos) + f"\n📷 {nome}\n🕒 {agora.strftime('%d/%m %H:%M')}"
            if n:
                texto += f"\n👤 {n} pessoa{'s' if n > 1 else ''} na imagem"
            ok = alertar(uid, texto, buf.getvalue())
            guardar(uid, cam, foto, [], "alerta")
            for a in disparadas:
                evento(uid, {"cam": cam, "tipo": "alerta", "analise": a.get("nome"), "enviado": ok})
            log(f"alerta {'enviado' if ok else 'NÃO enviado'}: {', '.join(a.get('nome', '') for a in disparadas)} · {nome}")

        # Câmera sem imagem há muito tempo = sem sinal (avisa as análises de câmera tampada/sem sinal).
        for uid, cams in contas.items():
            for cam, stream in cams.items():
                c = cameras.get(stream)
                if not c or t - (c.quando or t) < SEM_SINAL_SEG or not c.quando:
                    continue
                for a in analises(uid):
                    if a["tipo"] != "camera_sem_sinal_ou_tampada" or (a.get("cameras") and cam not in a["cameras"]):
                        continue
                    k = (a["id"], cam, "sinal")
                    if t - ultimo_alerta.get(k, 0) < ESPERA_ALERTA * 6:
                        continue
                    ultimo_alerta[k] = t
                    nome = nomes_das_cameras(uid).get(cam, cam)
                    alertar(uid, f"⚠️ Câmera sem sinal\n📷 {nome}\n🕒 {agora.strftime('%d/%m %H:%M')}", None)
                    log(f"alerta: sem sinal · {nome}")

        time.sleep(max(0.1, INTERVALO - (time.time() - inicio)))


if __name__ == "__main__":
    # Só um detector por vez (senão as câmeras seriam abertas em dobro).
    import fcntl
    trava = open(RAIZ / "data" / "logs" / "detector.lock", "w")
    try:
        fcntl.flock(trava, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        log("outro detector já está rodando; saindo.")
        sys.exit(0)
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
