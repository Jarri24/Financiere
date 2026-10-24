# Guía: Atajo Share Sheet de iOS para Vouchers de Yape & Plin 📲 (Costo $0.00)

Este atajo te permite **compartir el comprobante de Yape o Plin inmediatamente después de pagar** y registrar el gasto en tu app Financiere con 1 solo toque, utilizando el procesador de tu propio iPhone (Apple VisionKit OCR) **sin pagar ningún centavo ni usar APIs de terceros**.

---

## ⚡ ¿Cómo funciona la experiencia?
1. Realizas tu pago en **Yape** o **Plin**.
2. Aparece la pantalla de confirmación con el ticket verde/morado.
3. Tocas el botón nativo **"Compartir Voucher"** (o tomas una captura de pantalla).
4. En el menú de compartir de iOS, seleccionas **"Registrar en Financiere"**.
5. ¡Listo! Tu iPhone lee el monto y la persona en 0.2 segundos, lo envía a Supabase y te muestra una notificación:
   *🔔 "✅ Yape registrado: S/ 18.50 a Menú Doña Rosa"*.

---

## 🛠️ Creación del Atajo en 3 Minutos

1. Abre la app **Atajos (Shortcuts)** en tu iPhone.
2. Toca el botón **"+"** (arriba a la derecha) para crear un nuevo atajo.
3. Nómbralo: **`Registrar en Financiere`**.
4. Toca el ícono de información **`(i)`** en la barra inferior del atajo y marca:
   - ✅ **Mostrar en la hoja para compartir (Show in Share Sheet)**.
   - En *Tipos de entrada recibidos*, desmarca todo y deja solo: **Imágenes (Images)**.

---

### Paso a Paso de las Acciones del Atajo:

#### 1. Extraer texto con el OCR nativo de Apple
- Toca **Agregar acción**.
- Busca y selecciona: **Extraer texto de la imagen** (*Extract Text from Image*).
- Entrada: **Entrada del atajo** (*Shortcut Input*).

#### 2. Detectar el Monto con Expresión Regular
- Agrega la acción: **Coincidir con texto** (*Match Text*).
  - Patrón: `(?:S\/?|\$)\s*([0-9]+(?:\.[0-9]{2})?)`
  - Texto: Selecciona la variable del paso anterior (*Texto de la imagen*).
- Agrega la acción: **Obtener grupo de la coincidencia** (*Get Group from Matched Text*).
  - Grupo: `1`

#### 3. Detectar el Nombre del Comercio o Contacto
- Agrega la acción: **Coincidir con texto** (*Match Text*).
  - Patrón: `(?:para|a|destinatario|pago a)\s+([A-Za-z\s]{3,30})`
  - Texto: *Texto de la imagen*.
- Si no encuentra un nombre, añade una condición: Si no hay coincidencia, usar el texto `"Consumo Yape/Plin"`.

#### 4. Enviar a tu Base de Datos Supabase
- Agrega la acción: **Obtener contenido de la URL** (*Get Contents of URL*).
- Configura los parámetros:
  - **URL:** `https://iixzsxvlzzzzufvmytps.supabase.co/rest/v1/transacciones`
  - **Método:** `POST`
  - **Encabezados (Headers):**
    - `apikey`: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpeHpzeHZsenp6enVmdm15dHBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyNzAyNzksImV4cCI6MjEwNzg0NjI3OX0.5Du70YVyveWqlDJ1wd5IIVO4Ipj_M3fqmcR1dUb3kh4`
    - `Authorization`: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpeHpzeHZsenp6enVmdm15dHBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyNzAyNzksImV4cCI6MjEwNzg0NjI3OX0.5Du70YVyveWqlDJ1wd5IIVO4Ipj_M3fqmcR1dUb3kh4`
    - `Content-Type`: `application/json`
  - **Cuerpo de la solicitud (Request Body):** `JSON`
    - `monto` (Tipo Número): Variable del Monto extraído.
    - `comercio` (Tipo Texto): Variable del Comercio/Nombre extraído.
    - `tipo` (Tipo Texto): `gasto`
    - `metodo_pago` (Tipo Texto): `yape_plin`
    - `user_id` (Tipo Texto): Tu ID de usuario (disponible en la pestaña *Atajos* de Financiere).

#### 5. Confirmación Visual
- Agrega la acción: **Mostrar notificación** (*Show Notification*).
  - Texto: `✅ Gasto registrado: S/ [Monto] en [Comercio]`.

---

## 🚀 Resultado
A partir de este momento, cada vez que hagas un Yape o Plin, tocas **Compartir ➔ Registrar en Financiere**, y en menos de 1 segundo tu app tiene el gasto registrado sin que tengas que abrirla.
