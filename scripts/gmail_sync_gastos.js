/**
 * ========================================================
 * FINANCIERE - SINCRONIZACIÓN AUTOMÁTICA GMAIL (COSTO $0.00)
 * ========================================================
 * Este script se ejecuta en Google Apps Script (script.google.com)
 * de forma 100% gratuita y sin servidores.
 * 
 * Lee en tiempo real las alertas de compras con tarjeta de:
 * - BCP (notificaciones@bcp.com.pe)
 * - BBVA (alertas@bbva.pe)
 * - Interbank (alertas@interbank.pe)
 * - Scotiabank (notificaciones@scotiabank.com.pe)
 * 
 * Extrae monto, comercio y fecha, e inserta el gasto en tu
 * base de datos Supabase al instante.
 */

// 1. CONFIGURACIÓN DEL USUARIO (Rellenar con tus datos)
const CONFIG = {
  SUPABASE_URL: "https://iixzsxvlzzzzufvmytps.supabase.co",
  SUPABASE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpeHpzeHZsenp6enVmdm15dHBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyNzAyNzksImV4cCI6MjEwNzg0NjI3OX0.5Du70YVyveWqlDJ1wd5IIVO4Ipj_M3fqmcR1dUb3kh4",
  USER_ID: "PEGA_AQUI_TU_USER_ID", // Obténlo en la pestaña 'Atajos' de tu app Financiere
  LABEL_PROCESADO: "Financiere/Procesado"
};

/**
 * Función principal: ejecuta cada 5 o 10 minutos con activador (Trigger)
 */
function procesarCorreosBancarios() {
  const query = 'is:unread (from:notificaciones@bcp.com.pe OR from:alertas@bbva.pe OR from:alertas@interbank.pe OR from:scotiabank.com.pe)';
  const threads = GmailApp.search(query, 0, 10);
  
  if (threads.length === 0) return;

  const label = obtenerOCrearEtiqueta(CONFIG.LABEL_PROCESADO);

  threads.forEach(thread => {
    const messages = thread.getMessages();
    messages.forEach(msg => {
      if (msg.isUnread()) {
        const body = msg.getPlainBody();
        const subject = msg.getSubject();
        const sender = msg.getFrom();
        
        const tx = parsearCorreo(sender, subject, body);
        if (tx && tx.monto > 0) {
          const ok = guardarEnSupabase(tx);
          if (ok) {
            msg.markRead();
            thread.addLabel(label);
            Logger.log(`✅ Gasto registrado: S/ ${tx.monto} en ${tx.comercio}`);
          }
        }
      }
    });
  });
}

/**
 * Parseador inteligente con Regex para bancos peruanos (Costo $0.00)
 */
function parsearCorreo(sender, subject, body) {
  let monto = 0;
  let comercio = "Consumo Bancario";
  let tipo = "gasto";
  let moneda = "PEN";

  const texto = `${subject} ${body}`.replace(/\s+/g, ' ');

  // 1. Detectar BCP
  if (sender.includes('bcp') || texto.includes('BCP')) {
    // Patrón: "por S/ 45.90 en Tottus" o "Monto: S/ 45.90 Establecimiento: Tottus"
    const regexBCP = /(?:por|monto:?)\s*(S\/|\$|USD)?\s*([0-9]+(?:\.[0-9]{2})?)\s*(?:en|establecimiento:?)\s*([A-Za-z0-9\s\.\*\-\_]{3,35})/i;
    const match = texto.match(regexBCP);
    if (match) {
      if (match[1] && (match[1].includes('$') || match[1].includes('USD'))) moneda = 'USD';
      monto = parseFloat(match[2]);
      comercio = limpiarComercio(match[3]);
    }
  }

  // 2. Detectar BBVA
  else if (sender.includes('bbva') || texto.includes('BBVA')) {
    // Patrón: "compra por S/ 82.00 en RESTAURANTE"
    const regexBBVA = /compra\s+por\s+(S\/|\$)?\s*([0-9]+(?:\.[0-9]{2})?)\s+en\s+([A-Za-z0-9\s\.\*\-\_]{3,35})/i;
    const match = texto.match(regexBBVA);
    if (match) {
      if (match[1] && match[1].includes('$')) moneda = 'USD';
      monto = parseFloat(match[2]);
      comercio = limpiarComercio(match[3]);
    }
  }

  // 3. Detectar Interbank
  else if (sender.includes('interbank') || texto.includes('Interbank')) {
    // Patrón: "aprobada por S/ 25.50 en FARMA"
    const regexIBK = /(?:por|de)\s*(S\/|\$)?\s*([0-9]+(?:\.[0-9]{2})?)\s*en\s*([A-Za-z0-9\s\.\*\-\_]{3,35})/i;
    const match = texto.match(regexIBK);
    if (match) {
      if (match[1] && match[1].includes('$')) moneda = 'USD';
      monto = parseFloat(match[2]);
      comercio = limpiarComercio(match[3]);
    }
  }

  // Filtro genérico de respaldo si el banco cambió el formato
  if (monto === 0) {
    const generic = /(?:S\/|\$)\s*([0-9]+(?:\.[0-9]{2})?)/;
    const matchGen = texto.match(generic);
    if (matchGen) {
      monto = parseFloat(matchGen[1]);
      comercio = subject.slice(0, 30);
    }
  }

  return {
    monto: monto,
    comercio: comercio,
    moneda: moneda,
    tipo: tipo,
    metodo_pago: 'correo_bancario',
    fecha: new Date().toISOString().split('T')[0],
    user_id: CONFIG.USER_ID
  };
}

function limpiarComercio(str) {
  if (!str) return "Consumo Tarjeta";
  return str.replace(/(?:con\s+tarjeta|el\s+dia|fecha|hora|\*|\.).*/i, '').trim();
}

/**
 * Inserta la transacción directo en Supabase mediante REST API
 */
function guardarEnSupabase(tx) {
  const url = `${CONFIG.SUPABASE_URL}/rest/v1/transacciones`;
  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'apikey': CONFIG.SUPABASE_KEY,
      'Authorization': `Bearer ${CONFIG.SUPABASE_KEY}`,
      'Prefer': 'return=minimal'
    },
    payload: JSON.stringify(tx),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const code = response.getResponseCode();
    return code === 201 || code === 200;
  } catch (err) {
    Logger.log('Error Supabase: ' + err.toString());
    return false;
  }
}

function obtenerOCrearEtiqueta(nombre) {
  let label = GmailApp.getUserLabelByName(nombre);
  if (!label) {
    label = GmailApp.createLabel(nombre);
  }
  return label;
}
