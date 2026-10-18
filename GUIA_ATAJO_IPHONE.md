# Guía Paso a Paso: Automatización de Apple Pay en tu iPhone

Esta automatización permite que **cada vez que pagues con tu iPhone o Apple Watch (tarjeta BCP o BBVA)**, el consumo se guarde automáticamente en tu base de datos Supabase en segundo plano, sin tocar nada.

---

## Requisitos
- iPhone con iOS 17 o superior.
- Tarjeta BCP o BBVA agregada en Apple Wallet.
- App nativa **Atajos (Shortcuts)** de Apple.

---

## Paso a Paso para la Automatización de Apple Wallet

1. Abre la app **Atajos** en tu iPhone.
2. En la barra inferior, selecciona la pestaña central: **Automatización**.
3. Toca el botón **"+"** (arriba a la derecha) o **"Nueva automatización"**.
4. En el buscador o en la lista de eventos, busca y selecciona: **Transacción**.
5. Configura los parámetros:
   - **Tarjeta:** Selecciona tu tarjeta del BCP o BBVA (o *Cualquier tarjeta*).
   - **Categoría:** Déjalo en *Cualquier categoría*.
   - **Cuando:** Déjalo en *Cualquier momento*.
   - **IMPORTANTE:** En la parte inferior, marca **Ejecutar inmediatamente** (Run Immediately) y desmarca *Preguntar antes de ejecutar*.
6. Toca **Siguiente** (arriba a la derecha).
7. Selecciona **Nueva automatización en blanco**.
8. Toca **Agregar acción** y busca: **Obtener contenido de la URL** (*Get Contents of URL*).
9. Configura la acción HTTP de la siguiente forma:
   - **URL:** `https://iixzsxvlzzzzufvmytps.supabase.co/rest/v1/transacciones`
   - Toca la flecha hacia abajo para expandir los detalles:
   - **Método:** `POST`
   - **Encabezados (Headers):**
     - Añadir nuevo campo:
       - Clave: `apikey`
       - Texto: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpeHpzeHZsenp6enVmdm15dHBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyNzAyNzksImV4cCI6MjEwNzg0NjI3OX0.5Du70YVyveWqlDJ1wd5IIVO4Ipj_M3fqmcR1dUb3kh4`
     - Añadir nuevo campo:
       - Clave: `Authorization`
       - Texto: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpeHpzeHZsenp6enVmdm15dHBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyNzAyNzksImV4cCI6MjEwNzg0NjI3OX0.5Du70YVyveWqlDJ1wd5IIVO4Ipj_M3fqmcR1dUb3kh4`
     - Añadir nuevo campo:
       - Clave: `Content-Type`
       - Texto: `application/json`
   - **Cuerpo de la solicitud (Request Body):** Cambiar a `JSON`.
     - Añadir campo: `monto` (Tipo: *Número*) ➔ Toca la variable del atajo: **Monto de la transacción**.
     - Añadir campo: `comercio` (Tipo: *Texto*) ➔ Toca la variable del atajo: **Comercio**.
     - Añadir campo: `tipo` (Tipo: *Texto*) ➔ Escribe: `gasto`.
     - Añadir campo: `metodo_pago` (Tipo: *Texto*) ➔ Escribe: `apple_pay`.
     - Añadir campo: `descripcion` (Tipo: *Texto*) ➔ Escribe: `Consumo Apple Pay`.
10. Toca **Listo** arriba a la derecha.

---

## ¿Qué pasará a partir de ahora?
La próxima vez que acerques tu iPhone o Apple Watch al POS de un supermercado, restaurante o grifo, iOS disparará la petición POST y tu gasto aparecerá inmediatamente registrado en tu aplicación.
