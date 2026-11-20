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
# O que o YOLO reconhece (ids do COCO) e o nome usado nas análises ("alvo").
CLASSES = {0: "pessoa", 1: "bicicleta", 2: "carro", 3: "moto", 5: "caminhao", 7: "caminhao", 15: "gato", 16: "cachorro"}
CERTEZA_OBJETO = 0.30      # certeza mínima para bicho/veículo
SUMIU_ALVO_SEG = 5         # alvo some por 5 s = a passagem terminou (cachorro some atrás de poste etc.)

# Precisão de cada análise: (aparições mínimas nas últimas 5 imagens, certeza mínima do modelo rápido,
# certeza mínima do modelo preciso para confirmar — None = não precisa confirmar).
PRECISAO = {
    "sensivel": (2, 0.30, None),
    "equilibrada": (3, 0.35, 0.45),
    "rigorosa": (4, 0.40, 0.55),
    "maxima": (2, 0.30, None),  # gatilho bem sensível (2 de 5 imagens); quem confirma é a IA de visão
}
CONFIANCA_VISAO = 0.7       # certeza mínima da IA de visão para contar/avisar
ESPERA_VISAO = 30           # no máximo 1 verificação a cada 30 s por análise e câmera (fora passagens novas)
SO_ANALISES = os.environ.get("DETECTOR_SO_ANALISES") == "1"  # 1 = olha só as câmeras que têm análise


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
    uids = {f.stem for f in (RAIZ / "data" / "dvr").glob("*.json")} | {f.stem for f in (RAIZ / "data" / "analises").glob("*.json")}
    for uid in sorted(uids):
        if not re.fullmatch(r"[0-9a-f-]{36}", uid):
            continue
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


import queue
fila_visao = queue.Queue(maxsize=30)
contagem_verificada = {}  # (id da análise, cam, período) -> passagens confirmadas pela IA de visão


def foto_hd(stream):
    """1 foto em HD (1 conexão rápida, pelo escudo). Se falhar, None."""
    try:
        with urllib.request.urlopen(f"{GO2RTC}/api/frame.jpeg?src={stream}_hd", timeout=10) as r:
            jpg = r.read()
            return jpg if len(jpg) > 5000 else None
    except Exception:
        return None


def verificar(objetivo, jpg):
    corpo = json.dumps({"objetivo": objetivo, "foto": base64.b64encode(jpg).decode()}).encode()
    req = urllib.request.Request(f"{SITE}/api/interno/verificar", data=corpo, method="POST",
                                 headers={"Content-Type": "application/json", "x-liveon-key": CHAVE})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.load(r)
    except Exception as e:
        log("IA de visão não respondeu:", e)
        return None


def trabalhador_visao():
    """Confere na IA de visão cada caso das análises de precisão Máxima (em paralelo à vigilância)."""
    while True:
        item = fila_visao.get()
        try:
            uid, a, cam, stream, jpg_baixa, tipo_caso, nome_cam = item
            objetivo = a.get("objetivo") or a.get("mensagem_alerta") or a.get("nome")
            jpg = foto_hd(stream) or jpg_baixa
            v = verificar(objetivo, jpg)
            agora = datetime.now(FUSO)
            if v is None:
                # Plano B: a IA de visão está fora do ar (internet, limite do plano grátis). Não perde o evento:
                # vale a confirmação do próprio detector (o alvo ficou estável em várias imagens).
                v = {"atende": True, "confianca": 0.75, "quantidade": 1, "descricao": "confirmado pelo detector (IA de visão indisponível agora)", "plano_b": True}
            if not v.get("atende") or float(v.get("confianca", 0)) < CONFIANCA_VISAO:
                motivo = (v or {}).get("motivo", "IA indisponível")
                evento(uid, {"cam": cam, "tipo": "descartado_ia", "analise": a.get("nome"), "motivo": motivo})
                log(f"IA de visão NÃO confirmou: {a.get('nome')} · {nome_cam} · {motivo}")
                continue
            desc = v.get("descricao", "")
            if tipo_caso == "contagem":
                periodo = agora.strftime("%Y-%m-%d") if a.get("periodo") != "hora" else agora.strftime("%Y-%m-%d %H")
                k = (a["id"], cam, periodo)
                contagem_verificada[k] = contagem_verificada.get(k, 0) + 1
                evento(uid, {"cam": cam, "tipo": "contagem", "analise_id": a["id"], "analise": a.get("nome"), "descricao": desc, "qtd": int(v.get("quantidade", 1) or 1)})
                log(f"contado (IA de visão confirmou): {a.get('nome')} · {nome_cam} · {desc}")
                limite = a.get("limite")
                if not (limite and contagem_verificada[k] == limite + 1):
                    continue
            texto = f"🔔 {a['mensagem_alerta']}\n📷 {nome_cam}\n🕒 {agora.strftime('%d/%m %H:%M')}\n👁️ {desc}"
            if a.get("objetivo"):
                texto += f"\n🎯 {a['objetivo']}"
            texto += "\n✅ Confirmado pelo detector" if v.get("plano_b") else f"\n✅ Confirmado pela IA de visão ({round(float(v.get('confianca', 0)) * 100)}%)"
            ok = alertar(uid, texto, jpg)
            evento(uid, {"cam": cam, "tipo": "alerta", "analise": a.get("nome"), "enviado": ok, "descricao": desc})
            log(f"alerta {'enviado' if ok else 'NÃO enviado'} (IA de visão): {a.get('nome')} · {nome_cam}")
        except Exception as e:
            log("erro na verificação:", e)


def pausado(uid):
    """Alertas pausados pelo cliente (pelo robô)? data/pausa/<id>.json = {"ate": timestamp}. Continua contando."""
    try:
        return time.time() < json.loads((RAIZ / "data" / "pausa" / f"{uid}.json").read_text()).get("ate", 0)
    except Exception:
        return False


def alertar(uid, texto, jpg):
    if pausado(uid):
        log("alerta não enviado: alertas pausados pelo cliente")
        return False
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


def contar_alvo(alvo, pessoas, obj):
    """Quantos 'alvos' há na imagem. Pessoa com cachorro = cachorro perto de alguma pessoa
    (centro do cachorro a menos de ~1,6 altura de pessoa do centro dela)."""
    if alvo == "pessoa":
        return len(pessoas)
    if alvo == "pessoa_com_cachorro":
        caes = [b for b, _ in obj.get("cachorro", [])]
        n = 0
        for c in caes:
            ccx, ccy = (c[0] + c[2]) / 2, (c[1] + c[3]) / 2
            for p in pessoas:
                h = p[3] - p[1]
                pcx, pcy = (p[0] + p[2]) / 2, (p[1] + p[3]) / 2
                if ((ccx - pcx) ** 2 + (ccy - pcy) ** 2) ** 0.5 < 1.6 * h:
                    n += 1
                    break
        return n
    return len(obj.get(alvo, []))


def _iou(a, b):
    x1, y1, x2, y2 = max(a[0], b[0]), max(a[1], b[1]), min(a[2], b[2]), min(a[3], b[3])
    inter = max(0, x2 - x1) * max(0, y2 - y1)
    uni = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
    return inter / uni if uni > 0 else 0


def rastrear(e, caixas, certezas, t):
    """Dá um número fixo para cada pessoa: liga cada caixa nova à da imagem anterior que mais se sobrepõe
    (ou à mais perto). Pessoa que some por mais de 3 s perde o número. Os números recomeçam todo dia."""
    trilhas = e.setdefault("trilhas", [])
    dia = datetime.now(FUSO).strftime("%Y%m%d")
    if e.get("dia") != dia:
        e["dia"], e["proximo"] = dia, 1
    livres = [tr for tr in trilhas if t - tr["visto"] <= SUMIU_SEG]
    usadas = set()
    for k, b in enumerate(caixas):
        melhor, nota = None, 0.15
        cx, cy, lado = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2, max(b[2] - b[0], b[3] - b[1])
        for j, tr in enumerate(livres):
            if j in usadas:
                continue
            o = tr["b"]
            iou = _iou(b, o)
            perto = 1 - min(1, (((o[0] + o[2]) / 2 - cx) ** 2 + ((o[1] + o[3]) / 2 - cy) ** 2) ** 0.5 / (lado * 1.2 + 1))
            n = max(iou, perto * 0.6)
            if n > nota:
                melhor, nota = j, n
        c = certezas[k] if k < len(certezas) else 0.0
        if melhor is None:
            livres.append({"id": e["proximo"], "b": b, "c": c, "visto": t, "desde": t})
            usadas.add(len(livres) - 1)
            e["proximo"] += 1
        else:
            tr = livres[melhor]
            tr.update(b=b, c=c, visto=t)
            usadas.add(melhor)
    e["trilhas"] = livres
    return [tr for tr in livres if tr["visto"] == t]


def publicar_ao_vivo(ao_vivo):
    """data/ao-vivo/<conta>.json: o que a IA vê agora em cada câmera (lido pelo dashboard do site)."""
    pasta = RAIZ / "data" / "ao-vivo"
    pasta.mkdir(parents=True, exist_ok=True)
    for uid, cams in ao_vivo.items():
        tmp = pasta / f"{uid}.json.tmp"
        tmp.write_text(json.dumps({"ts": int(time.time()), "cams": cams}))
        tmp.replace(pasta / f"{uid}.json")  # troca de uma vez (o site nunca lê arquivo pela metade)


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
    threading.Thread(target=trabalhador_visao, daemon=True).start()
    ultima_visao = {}

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
                if not SO_ANALISES:
                    precisa.update(cams.values())  # o dashboard mostra as etiquetas da IA em todas as câmeras
                    continue
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
        certezas = {}
        objetos = {}
        if validas:
            saida = modelo.predict([imagens[i] for i in validas], classes=list(CLASSES), conf=0.25, device=aparelho, verbose=False)
            for i, r in zip(validas, saida):
                caixas_r, conf_r, cls_r = r.boxes.xyxy.tolist(), r.boxes.conf.tolist(), r.boxes.cls.tolist()
                pessoas_i = [(tuple(map(float, b)), float(c)) for b, c, k in zip(caixas_r, conf_r, cls_r) if int(k) == 0 and c >= CONFIANCA]
                resultados[i] = [b for b, _ in pessoas_i]
                certezas[i] = [c for _, c in pessoas_i]
                obj = {}
                for b, c, k in zip(caixas_r, conf_r, cls_r):
                    nome = CLASSES.get(int(k))
                    if nome and nome != "pessoa" and c >= CERTEZA_OBJETO:
                        obj.setdefault(nome, []).append((tuple(map(float, b)), float(c)))
                objetos[i] = obj

        agora = datetime.now(FUSO)
        t = time.time()
        ao_vivo = {}
        for i, (uid, cam, jpg) in enumerate(lote):
            if imagens[i] is None:
                continue
            caixas = resultados.get(i, [])
            e = estado.setdefault((uid, cam), {"pessoas": False, "desde": t, "visto": 0.0, "liso_desde": None, "hist": []})

            # Número fixo para cada pessoa enquanto ela está na imagem + estado ao vivo para o dashboard.
            larg, alt = imagens[i].size
            pessoas = rastrear(e, caixas, certezas.get(i, []), t)
            ao_vivo.setdefault(uid, {})[cam] = {
                "n": len(pessoas),
                "pessoas": [{"id": p["id"], "b": [round(p["b"][0] / larg, 4), round(p["b"][1] / alt, 4), round(p["b"][2] / larg, 4), round(p["b"][3] / alt, 4)], "c": round(p["c"], 2), "desde": int(p["desde"])} for p in pessoas],
                "objetos": [{"tipo": nomeo, "b": [round(b[0] / larg, 4), round(b[1] / alt, 4), round(b[2] / larg, 4), round(b[3] / alt, 4)], "c": round(c, 2)}
                            for nomeo, lista in objetos.get(i, {}).items() for b, c in lista],
                "w": larg, "h": alt, "ts": int(t),
            }

            # Contra alarme falso: só conta "tem pessoa" se ela aparece em pelo menos 3 das últimas 5 imagens
            # (uns 3 s). Uma sombra, a manta no sofá ou o reflexo do infravermelho por 1 imagem não contam.
            e["hist"] = (e["hist"] + [bool(caixas)])[-JANELA:]
            e["hist_c"] = (e.get("hist_c", []) + [max(certezas.get(i, []) or [0.0])])[-JANELA:]
            presente = sum(e["hist"]) >= MINIMO_NA_JANELA

            def presente_com(prec):
                minimo, certeza, _ = PRECISAO.get(prec, PRECISAO["equilibrada"])
                return sum(c >= certeza for c in e["hist_c"]) >= minimo

            confs_agora = certezas.get(i, [])
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

            # Passagens de outros alvos (cachorro, pessoa com cachorro, veículos), só os que alguma análise usa.
            obj_i = objetos.get(i, {})
            novas_alvo = {}
            precisa_alvos = {a.get("alvo") for a in analises(uid) if a.get("alvo") not in (None, "pessoa") and (not a.get("cameras") or cam in a["cameras"])}
            for alvo in precisa_alvos:
                qtd = contar_alvo(alvo, resultados.get(i, []), obj_i)
                ea = e.setdefault("alvos", {}).setdefault(alvo, {"hist": [], "presente": False, "visto": 0.0, "desde": t, "qtd": 0})
                ea["hist"] = (ea["hist"] + [qtd > 0])[-JANELA:]
                estavel = sum(ea["hist"]) >= MINIMO_NA_JANELA
                novas_alvo[alvo] = False
                if estavel:
                    if not ea["presente"]:
                        ea["presente"], ea["desde"], novas_alvo[alvo] = True, t, True
                        evento(uid, {"cam": cam, "tipo": "passagem", "alvo": alvo, "qtd": qtd})
                    ea["visto"], ea["qtd"] = t, max(qtd, 1)
                elif ea["presente"] and t - ea["visto"] > SUMIU_ALVO_SEG:
                    ea["presente"] = False

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
                # Sem níveis: toda análise usa o modo completo (gatilho sensível + IA de visão confere cada caso).
                prec = "maxima" if tipo != "camera_sem_sinal_ou_tampada" else "equilibrada"
                alvo = a.get("alvo") or "pessoa"
                disparar = False
                if alvo != "pessoa" and tipo != "camera_sem_sinal_ou_tampada":
                    ea = e.get("alvos", {}).get(alvo)
                    if not ea:
                        continue
                    if tipo == "passagens_por_area":
                        if novas_alvo.get(alvo):
                            periodo = agora.strftime("%Y-%m-%d") if a.get("periodo") != "hora" else agora.strftime("%Y-%m-%d %H")
                            k = (a["id"], cam, periodo)
                            contagem[k] = contagem.get(k, 0) + 1
                            disparar = bool(limite) and contagem[k] == limite + 1
                    elif tipo == "contagem_de_pessoas":
                        disparar = ea["presente"] and ea["qtd"] > (limite or 5)
                    elif tipo == "permanencia_em_area":
                        disparar = ea["presente"] and t - ea["desde"] >= (limite * 60 if limite else PERMANENCIA_SEG)
                    else:  # fora do horário / invasão
                        disparar = novas_alvo.get(alvo, False) or (ea["presente"] and t - ea["desde"] < 10)
                elif tipo in ("pessoa_fora_do_horario", "invasao_de_area"):
                    disparar = presente_com(prec)
                elif tipo == "contagem_de_pessoas":
                    certeza = PRECISAO.get(prec, PRECISAO["equilibrada"])[1]
                    disparar = presente_com(prec) and sum(c >= certeza for c in confs_agora) > (limite or 5)
                elif tipo == "permanencia_em_area":
                    disparar = e["pessoas"] and t - e["desde"] >= (limite * 60 if limite else PERMANENCIA_SEG)
                elif tipo == "passagens_por_area" and nova_passagem:
                    periodo = agora.strftime("%Y-%m-%d") if a.get("periodo") != "hora" else agora.strftime("%Y-%m-%d %H")
                    k = (a["id"], cam, periodo)
                    contagem[k] = contagem.get(k, 0) + 1
                    disparar = bool(limite) and contagem[k] == limite + 1  # avisa quando passa do limite
                elif tipo == "camera_sem_sinal_ou_tampada":
                    disparar = e["liso_desde"] is not None and t - e["liso_desde"] >= TAMPADA_SEG
                # Precisão Máxima: não avisa direto; manda o caso para a IA de visão conferir com o objetivo.
                if prec == "maxima":
                    nova = novas_alvo.get(alvo, False) if alvo != "pessoa" else nova_passagem
                    caso = None
                    if tipo == "passagens_por_area" and nova:
                        caso = "contagem"
                    elif tipo != "passagens_por_area" and disparar and t - ultimo_alerta.get((a["id"], cam), 0) >= ESPERA_ALERTA \
                            and t - ultima_visao.get((a["id"], cam), 0) >= ESPERA_VISAO:
                        caso = "alerta"
                        ultimo_alerta[(a["id"], cam)] = t
                    if caso:
                        ultima_visao[(a["id"], cam)] = t
                        try:
                            fila_visao.put_nowait((uid, a, cam, contas[uid][cam], jpg, caso, nomes_das_cameras(uid).get(cam, cam)))
                        except queue.Full:
                            log("fila da IA de visão cheia; caso ignorado")
                    continue
                if tipo == "passagens_por_area" and (novas_alvo.get(alvo) if alvo != "pessoa" else nova_passagem):
                    evento(uid, {"cam": cam, "tipo": "contagem", "analise_id": a["id"], "analise": a.get("nome")})
                if disparar and t - ultimo_alerta.get((a["id"], cam), 0) >= ESPERA_ALERTA:
                    disparadas.append(a)
            if not disparadas:
                continue

            # Alerta de pessoa: conforme a precisão da análise, o modelo PRECISO confirma na imagem de agora.
            def exige(a):
                if a["tipo"] == "camera_sem_sinal_ou_tampada" or (a.get("alvo") or "pessoa") != "pessoa":
                    return None
                return PRECISAO.get(a.get("precisao") or "equilibrada", PRECISAO["equilibrada"])[2]
            confirmar = [a for a in disparadas if exige(a) is not None]
            if confirmar and preciso:
                if t - e.get("recusado", 0) < 60:
                    disparadas = [a for a in disparadas if a not in confirmar]
                else:
                    rx = preciso.predict(imagens[i], classes=[0], conf=min(exige(a) for a in confirmar), device=aparelho, verbose=False)[0]
                    melhor = max(rx.boxes.conf.tolist() or [0.0])
                    recusadas = [a for a in confirmar if melhor < exige(a)]
                    if len(rx.boxes):
                        caixas = [tuple(map(float, b)) for b in rx.boxes.xyxy.tolist()]
                        n = len(caixas)
                    if recusadas:
                        if len(recusadas) == len(confirmar):
                            e["recusado"] = t
                        log(f"descartado (o modelo preciso não confirmou com a certeza pedida): {cam} · {melhor:.0%}")
                        guardar(uid, cam, imagens[i], resultados.get(i, []), "descartado")
                        disparadas = [a for a in disparadas if a not in recusadas]
            if not disparadas:
                continue
            for a in disparadas:
                ultimo_alerta[(a["id"], cam)] = t

            # UMA mensagem por câmera, mesmo que várias análises disparem juntas. Print com as pessoas marcadas.
            foto = imagens[i].copy()
            d = ImageDraw.Draw(foto)
            for x1, y1, x2, y2 in caixas:
                d.rectangle([x1, y1, x2, y2], outline=(124, 58, 237), width=4)
            for lista in objetos.get(i, {}).values():
                for (x1, y1, x2, y2), _ in lista:
                    d.rectangle([x1, y1, x2, y2], outline=(52, 211, 153), width=4)
            buf = io.BytesIO()
            foto.save(buf, "JPEG", quality=85)
            nome = nomes_das_cameras(uid).get(cam, cam)
            motivos = list(dict.fromkeys(a["mensagem_alerta"] for a in disparadas))
            objetivos = list(dict.fromkeys(a["objetivo"] for a in disparadas if a.get("objetivo")))
            texto = "🔔 " + "\n🔔 ".join(motivos) + f"\n📷 {nome}\n🕒 {agora.strftime('%d/%m %H:%M')}"
            for o in objetivos:
                texto += f"\n🎯 {o}"
            if n:
                texto += f"\n👤 {n} pessoa{'s' if n > 1 else ''} na imagem"
            ok = alertar(uid, texto, buf.getvalue())
            guardar(uid, cam, foto, [], "alerta")
            for a in disparadas:
                evento(uid, {"cam": cam, "tipo": "alerta", "analise": a.get("nome"), "enviado": ok})
            log(f"alerta {'enviado' if ok else 'NÃO enviado'}: {', '.join(a.get('nome', '') for a in disparadas)} · {nome}")

        publicar_ao_vivo(ao_vivo)

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
