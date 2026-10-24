"""
========================================================
FINANCIERE - GENERADOR Y ENVÍO DE REPORTE DIARIO MATUTINO
(Módulo 3: Automatización de Reportes & Alertas - Costo $0.00)
========================================================
Este script calcula el resumen ejecutivo financiero matutino
y lo envía al Telegram o Correo configurado por el usuario.
Puede ejecutarse localmente, en un cron diario o en GitHub Actions (gratis).
"""

import os
import json
import urllib.request
import urllib.parse
from datetime import datetime

SUPABASE_URL = "https://iixzsxvlzzzzufvmytps.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpeHpzeHZsenp6enVmdm15dHBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyNzAyNzksImV4cCI6MjEwNzg0NjI3OX0.5Du70YVyveWqlDJ1wd5IIVO4Ipj_M3fqmcR1dUb3kh4"

def query_supabase(table, params=""):
    url = f"{SUPABASE_URL}/rest/v1/{table}?{params}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        print(f"Error querying {table}: {e}")
        return []

def formatear_soles(monto):
    return f"S/ {monto:,.2f}"

def generar_reporte_para_usuario(user_id, config):
    nombre = config.get("nombre", "Jarinson")
    tc = float(config.get("tipo_cambio") or 3.75)
    
    # 1. Cuentas e Inversiones
    cuentas = query_supabase("cuentas", f"user_id=eq.{user_id}")
    ahorros = 0.0
    inversiones = 0.0
    for c in cuentas:
        saldo = float(c.get("saldo_actual") or 0.0)
        saldo_pen = saldo * tc if c.get("moneda") == "USD" else saldo
        if c.get("tipo") in ["inversion", "dpf"]:
            inversiones += saldo_pen
        else:
            ahorros += saldo_pen
            
    # 2. Préstamos Activos
    prestamos = query_supabase("prestamos", f"user_id=eq.{user_id}&estado=eq.Pendiente")
    cartera_prestamos = sum(float(p.get("monto_prestado") or 0.0) for p in prestamos)
    
    patrimonio_total = ahorros + inversiones + cartera_prestamos
    
    # 3. Gastos del Mes Actual
    mes_actual = datetime.now().strftime("%Y-%m")
    transacciones = query_supabase("transacciones", f"user_id=eq.{user_id}&tipo=eq.gasto&fecha=gte.{mes_actual}-01")
    total_gastos_mes = sum(float(t.get("monto") or 0.0) for t in transacciones)
    
    # 4. Suscripciones / Recurrentes del Mes
    recurrentes = query_supabase("gastos_recurrentes", f"user_id=eq.{user_id}&activo=eq.true")
    proximos_pagos = []
    hoy_dia = datetime.now().day
    for r in recurrentes:
        dia_pago = int(r.get("dia_pago") or 1)
        ultimo_pago = str(r.get("ultimo_pago_fecha") or "")
        if not ultimo_pago.startswith(mes_actual):
            dias_faltan = dia_pago - hoy_dia
            monto = float(r.get("monto") or 0.0)
            proximos_pagos.append((dias_faltan, r.get("nombre"), monto))
    
    # Ordenar por proximidad
    proximos_pagos.sort(key=lambda x: x[0])
    
    # Armar Mensaje Markdown Ejecutivo
    fecha_hoy = datetime.now().strftime("%d/%m/%Y")
    lineas = [
        f"☀️ *Financiere · Resumen Matutino*",
        f"📅 _{fecha_hoy}_ · ¡Hola {nombre}!\n",
        f"💼 *Patrimonio Total: {formatear_soles(patrimonio_total)}*",
        f"• Ahorros & Cuentas: {formatear_soles(ahorros)}",
        f"• Inversiones: {formatear_soles(inversiones)}",
        f"• Préstamos por Cobrar: {formatear_soles(cartera_prestamos)}\n",
        f"💳 *Gastos en lo que va del mes: {formatear_soles(total_gastos_mes)}*",
    ]
    
    if proximos_pagos:
        lineas.append("\n⏰ *Próximos Pagos de Suscripciones:*")
        for dias, nom, m in proximos_pagos[:3]:
            if dias < 0:
                lineas.append(f"• ⚠️ {nom}: {formatear_soles(m)} (Venció el día {dia_pago})")
            elif dias == 0:
                lineas.append(f"• 🚨 {nom}: {formatear_soles(m)} (Vence ¡HOY!)")
            else:
                lineas.append(f"• 📌 {nom}: {formatear_soles(m)} (En {dias} días)")
    else:
        lineas.append("\n✅ *¡Todas tus suscripciones del mes están pagadas!*")
        
    lineas.append("\n📱 _Abre Financiere PWA para gestionar tus finanzas hoy._")
    return "\n".join(lineas)

def enviar_telegram(bot_token, chat_id, texto):
    if not bot_token or not chat_id:
        return False
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload = json.dumps({
        "chat_id": chat_id,
        "text": texto,
        "parse_mode": "Markdown"
    }).encode("utf-8")
    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status == 200
    except Exception as e:
        print(f"Error sending Telegram message: {e}")
        return False

def main():
    print("🚀 Iniciando despacho de reportes diarios...")
    configs = query_supabase("configuracion_usuario", "or=(recibir_reporte_telegram.eq.true,recibir_reporte_email.eq.true)")
    
    if not configs:
        print("ℹ️ No hay usuarios con reportes programados activos en Supabase.")
        return
        
    telegram_bot_token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    
    for c in configs:
        user_id = c.get("user_id")
        reporte = generar_reporte_para_usuario(user_id, c)
        print("-----------------------------------------")
        print(reporte)
        print("-----------------------------------------")
        
        # Envío a Telegram si está habilitado
        if c.get("recibir_reporte_telegram") and c.get("telegram_id"):
            enviar_telegram(telegram_bot_token, c.get("telegram_id"), reporte)

if __name__ == "__main__":
    main()
