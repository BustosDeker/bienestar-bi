#!/usr/bin/env python3
"""Generador sintético reproducible para BienestarOLTP (semilla fija).

Uso:  python 02_seed_oltp.py            -> escribe 02_seed_oltp.sql junto a este archivo
Requiere haber ejecutado antes 01_oltp_create.sql (catálogos e ids base).

Calibración (ver prompt, sección 8):
  * ~360 estudiantes (190 F / 170 M), tres rangos de edad, 5 escuelas
  * SWLS ~23 en promedio, leve tendencia creciente entre olas;
    Educación ~26-27, Ing. Civil ~19-21
  * SWLS ~ valoración/horas significativas (r~0.3) y días de actividad (r~0.2)
  * ~10 % "No informa" en ingreso, valores atípicos y datos faltantes
"""
import base64
import hashlib
import math
import os
import random
from datetime import date, timedelta

SEED = 20260817
rng = random.Random(SEED)
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "02_seed_oltp.sql")

REF = date(2026, 8, 17)  # inicio 2026-II
OLAS = {1: (date(2026, 8, 17), date(2026, 8, 30)),
        2: (date(2026, 10, 5), date(2026, 10, 18)),
        3: (date(2026, 12, 1), date(2026, 12, 14))}
N_SEMANAS = 14  # registros semanales: 2026-08-17 .. 2026-11-22
# Las olas 1 y 2 ya ocurrieron; la ola 3 (dic) se siembra completa para el demo.

# id_escuela (orden del catálogo base) -> (media SWLS, peso)
ESCUELAS = {1: (23.0, 1.0), 2: (22.5, 1.0), 3: (20.0, 1.0), 4: (24.0, 1.0), 5: (26.5, 1.0)}
N_EST = 360
N_F = 190


def clip(x, lo, hi):
    return max(lo, min(hi, x))


def poisson(lam):
    L, k, p = math.exp(-lam), 0, 1.0
    while True:
        k += 1
        p *= rng.random()
        if p <= L:
            return k - 1


def q(v):
    if v is None:
        return "NULL"
    if isinstance(v, (date,)):
        return "'%s'" % v.isoformat()
    if isinstance(v, str):
        return "'%s'" % v.replace("'", "''")
    return repr(v) if isinstance(v, float) else str(v)


lines = ["/* 02 - Datos sintéticos (generado por 02_seed_oltp.py, semilla %d). No editar a mano. */" % SEED,
         "USE BienestarOLTP;", "GO", "SET NOCOUNT ON;", "SET DATEFORMAT ymd;", "GO"]


def emit(table, cols, rows, identity=False):
    if not rows:
        return
    if identity:
        lines.append("SET IDENTITY_INSERT %s ON;" % table)
    for i in range(0, len(rows), 900):
        chunk = rows[i:i + 900]
        lines.append("INSERT INTO %s (%s) VALUES" % (table, ",".join(cols)))
        lines.append(",\n".join("(" + ",".join(q(v) for v in r) + ")" for r in chunk) + ";")
    if identity:
        lines.append("SET IDENTITY_INSERT %s OFF;" % table)
    lines.append("GO")


# --- Estudiantes -----------------------------------------------------------
sexos = ["F"] * N_F + ["M"] * (N_EST - N_F)
rng.shuffle(sexos)
escuelas_ids = list(ESCUELAS)
students = []
for i in range(N_EST):
    cod = 202600001 + i
    esc = escuelas_ids[i % len(escuelas_ids)]
    # edad a REF: 18-20 (45 %), 21-23 (38 %), 24+ (17 %)
    r = rng.random()
    edad = rng.randint(18, 20) if r < 0.45 else rng.randint(21, 23) if r < 0.83 else rng.randint(24, 30)
    nac = REF - timedelta(days=int(edad * 365.25 + rng.randint(0, 364)))
    ciclo = clip(int(round((edad - 17) * 1.0 + rng.gauss(0, 1.2))), 1, 10)
    ing = rng.random()
    rango = 4 if ing < 0.10 else (1 if ing < 0.40 else 2 if ing < 0.80 else 3)  # 4 = No informa
    students.append(dict(cod=cod, esc=esc, sexo=sexos[i], nac=nac, ciclo=ciclo, rango=rango,
                         soc=rng.gauss(0, 1), act=rng.gauss(0, 1), edad=edad))

emit("ESTUDIANTE", ["cod_estudiante", "id_escuela", "id_rango", "sexo", "fecha_nacimiento"],
     [(s["cod"], s["esc"], s["rango"], s["sexo"], s["nac"]) for s in students])

# Matrícula: 2026-II (id_periodo = 1) para todos
emit("MATRICULA", ["cod_estudiante", "id_periodo", "ciclo"],
     [(s["cod"], 1, s["ciclo"]) for s in students])

# --- Encuestas SWLS ----------------------------------------------------------
enc_rows, resp_rows = [], []
id_enc = 0
for s in students:
    base = ESCUELAS[s["esc"]][0] + 2.4 * (0.45 * s["soc"] + 0.30 * s["act"])
    s["swls_base"] = base
    for ola in (1, 2, 3):
        if s["cod"] <= 202600012 and ola == 3:   # estudiantes de demo: ola 3 pendiente (la registran desde la app)
            continue
        if rng.random() < 0.07:      # no respondió la ola
            continue
        id_enc += 1
        ini, fin = OLAS[ola]
        f = ini + timedelta(days=rng.randint(0, (fin - ini).days))
        if rng.random() < 0.012:     # calidad: aplicada fuera de ola
            f = fin + timedelta(days=rng.randint(3, 9))
        enc_rows.append((id_enc, s["cod"], ola, f))
        total = clip(base + 0.6 * (ola - 1) + rng.gauss(0, 2.6), 5, 35)
        per_item = total / 5.0
        saltar = rng.randint(1, 5) if rng.random() < 0.02 else None
        for item in range(1, 6):
            if item == saltar:
                continue
            v = int(clip(round(per_item + rng.gauss(0, 0.7)), 1, 7))
            resp_rows.append((id_enc, item, v))

emit("ENCUESTA_BIENESTAR", ["id_encuesta", "cod_estudiante", "id_ola", "fecha_aplicacion"],
     enc_rows, identity=True)
emit("RESPUESTA_SWLS", ["id_encuesta", "id_item", "valor"], resp_rows)

# --- Interacciones sociales ---------------------------------------------------
# TIPO_INTERACCION = CROSS JOIN vinculo x modalidad -> ids 1..8 (vinculo-major)
#   vinculo 1 Familia, 2 Pareja, 3 Amistades, 4 Compañeros; modalidad 1 Presencial, 2 Virtual
VINC_W = [0.26, 0.14, 0.34, 0.26]
inter_rows = []
for s in students:
    lam = 7.0 * math.exp(0.25 * s["soc"])
    for w in range(N_SEMANAS):
        lunes = REF + timedelta(days=7 * w)
        for _ in range(poisson(lam)):
            v = rng.choices([1, 2, 3, 4], VINC_W)[0]
            mod = 1 if rng.random() < 0.62 else 2
            tipo = (v - 1) * 2 + mod
            fecha = lunes + timedelta(days=rng.randint(0, 6))
            dur = round(clip(rng.lognormvariate(0.35, 0.55), 0.25, 6), 2)
            if rng.random() < 0.002:        # valor atípico (jornada muy larga)
                dur = round(rng.uniform(12, 16), 2)
            val = int(clip(round(3.55 + 0.45 * s["soc"] + (0.25 if mod == 1 else -0.1)
                                 + (0.2 if v in (1, 3) else 0) + rng.gauss(0, 0.9)), 1, 5))
            inter_rows.append((s["cod"], tipo, fecha, dur, val))
emit("REGISTRO_INTERACCION",
     ["cod_estudiante", "id_tipo_inter", "fecha", "duracion_horas", "valoracion"], inter_rows)

# --- Actividades --------------------------------------------------------------
# ACTIVIDAD ids: 1 Caminata, 2 Trote, 3 Deporte colectivo, 4 Gimnasio (físicas),
#                5 Yoga/estiramiento, 6 Meditación (autocuidado)
act_rows = []
for s in students:
    p_dia = clip(0.30 + 0.10 * s["act"], 0.02, 0.9)
    for w in range(N_SEMANAS):
        lunes = REF + timedelta(days=7 * w)
        for d in range(7):
            fecha = lunes + timedelta(days=d)
            if rng.random() < p_dia:
                for _ in range(1 if rng.random() < 0.75 else 2):
                    a = rng.choices([1, 2, 3, 4, 5, 6], [0.28, 0.17, 0.14, 0.13, 0.15, 0.13])[0]
                    dur = int(clip(rng.gauss(40, 22), 5, 150))
                    if rng.random() < 0.002:
                        dur = rng.randint(400, 600)   # atípico
                    act_rows.append((s["cod"], a, fecha, dur))
            elif rng.random() < 0.06:                 # registro corto (<10 min) -> la regla lo descarta
                act_rows.append((s["cod"], rng.choice([5, 6]), fecha, rng.randint(3, 9)))
emit("REGISTRO_ACTIVIDAD", ["cod_estudiante", "id_actividad", "fecha", "duracion_min"], act_rows)


# --- Cuentas de acceso (demostración) -----------------------------------------
# Todas las contraseñas son de DEMOSTRACIÓN; se guardan solo como hash scrypt.
PASS_BIENESTAR = "Bienestar2026!"
PASS_ESTUDIANTE = "Estudiante2026!"


def scrypt_hash(password: str) -> str:
    salt = rng.randbytes(16)
    n, r, p = 16384, 8, 1
    h = hashlib.scrypt(password.encode(), salt=salt, n=n, r=r, p=p, dklen=32)
    return "scrypt$%d$%d$%d$%s$%s" % (n, r, p, base64.b64encode(salt).decode(), base64.b64encode(h).decode())


emit("USUARIO", ["username", "password_hash", "rol", "cod_estudiante"],
     [("bienestar", scrypt_hash(PASS_BIENESTAR), "bienestar", None)] +
     [(str(s["cod"]), scrypt_hash(PASS_ESTUDIANTE), "estudiante", s["cod"]) for s in students])

lines.append("PRINT 'Seed OLTP completo: %d estudiantes, %d encuestas, %d interacciones, %d actividades';"
             % (N_EST, len(enc_rows), len(inter_rows), len(act_rows)))
lines.append("GO")
with open(OUT, "w", encoding="utf-8") as f:
    f.write("\n".join(lines) + "\n")
print("OK ->", OUT, "| est=%d enc=%d resp=%d int=%d act=%d" %
      (N_EST, len(enc_rows), len(resp_rows), len(inter_rows), len(act_rows)))
