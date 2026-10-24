// FINANCIERE APP - JAVASCRIPT CORE V2 (Multi-Tenant & Supabase Auth)
const SUPABASE_URL = "https://iixzsxvlzzzzufvmytps.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlpeHpzeHZsenp6enVmdm15dHBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIyNzAyNzksImV4cCI6MjEwNzg0NjI3OX0.5Du70YVyveWqlDJ1wd5IIVO4Ipj_M3fqmcR1dUb3kh4";

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let state = {
  user: null,
  cuentas: [],
  categorias: [],
  prestamos: [],
  transacciones: [],
  metas: [],
  recurrentes: [],
  presupuestos: [],
  config: {
    nombre: 'Jarinson',
    email_reportes: '',
    telefono: '',
    telegram_id: '',
    tipo_cambio: 3.75,
    recibir_reporte_email: false,
    recibir_reporte_telegram: false,
    hora_reporte: '07:30'
  },
  tipoTx: 'gasto',
  tc: 3.75,
  privacyMode: localStorage.getItem('financiere_privacy') === 'true'
};

const formatPEN = (num, force = false) => {
  if (state.privacyMode && !force) return 'S/ ••••••';
  return 'S/ ' + Number(num || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatUSD = (num, force = false) => {
  if (state.privacyMode && !force) return '$ ••••••';
  return '$ ' + Number(num || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Initialize App & Auth
document.addEventListener('DOMContentLoaded', async () => {
  if (window.lucide) lucide.createIcons();
  setupAuthEvents();
  setupNavigation();
  setupModals();
  setupInlineCategory();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(console.warn);
  }

  // Check active session
  const { data: { session } } = await db.auth.getSession();
  if (session) {
    setAuthenticatedUser(session.user);
  } else {
    showLoginView();
  }

  // Auth State Listener
  db.auth.onAuthStateChange((event, session) => {
    if (session) {
      setAuthenticatedUser(session.user);
    } else {
      showLoginView();
    }
  });
});

function showLoginView() {
  state.user = null;
  document.getElementById('view-login').classList.remove('hidden');
  document.getElementById('app-content').classList.add('hidden');
  document.getElementById('header-auth-actions').classList.add('hidden');
  const btnSettings = document.getElementById('btn-open-settings');
  if (btnSettings) btnSettings.classList.add('hidden');
  document.getElementById('user-display-email').innerText = 'MI BILLETERA PRIVADA';
  document.getElementById('badge-auth-status').className = 'w-2 h-2 rounded-full bg-slate-500';
  if (window.lucide) lucide.createIcons();
}

async function setAuthenticatedUser(user) {
  state.user = user;
  document.getElementById('view-login').classList.add('hidden');
  document.getElementById('app-content').classList.remove('hidden');
  document.getElementById('header-auth-actions').classList.remove('hidden');
  document.getElementById('btn-refresh').classList.remove('hidden');
  const btnSettings = document.getElementById('btn-open-settings');
  if (btnSettings) btnSettings.classList.remove('hidden');
  document.getElementById('btn-logout').classList.remove('hidden');
  document.getElementById('user-display-email').innerText = user.email.toUpperCase();
  document.getElementById('badge-auth-status').className = 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse';

  // Obtener nombre preferido de localStorage o preguntar al nuevo usuario
  let savedName = localStorage.getItem('financiere_name_' + user.id);
  if (!savedName) {
    if (user.email && user.email.toLowerCase().includes('jarinson')) {
      savedName = 'Jarinson';
      localStorage.setItem('financiere_name_' + user.id, 'Jarinson');
    } else {
      // Si es un usuario nuevo (ej. novia), preguntar cómo le gustaría que la llamemos
      setTimeout(() => {
        const modalName = document.getElementById('modal-name');
        if (modalName) modalName.classList.remove('hidden');
      }, 600);
      savedName = 'Usuario';
    }
  }

  const elGreeting = document.getElementById('user-greeting-name');
  if (elGreeting) {
    elGreeting.innerText = `¡Hola, ${savedName}!`;
    elGreeting.onclick = () => {
      document.getElementById('input-preferred-name').value = savedName === 'Usuario' ? '' : savedName;
      document.getElementById('modal-name').classList.remove('hidden');
      document.getElementById('input-preferred-name').focus();
    };
  }

  const elDate = document.getElementById('today-date-badge');
  if (elDate) {
    const d = new Date();
    const meses = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SET', 'OCT', 'NOV', 'DIC'];
    elDate.innerText = `${d.getDate()} ${meses[d.getMonth()]} ${d.getFullYear()}`;
  }

  const dispUserId = document.getElementById('display-user-id');
  if (dispUserId) dispUserId.innerText = user.id;

  await loadUserData();
}

// Setup Auth Events
function setupAuthEvents() {
  const formLogin = document.getElementById('form-login');
  const errorMsg = document.getElementById('login-error-msg');
  const btnSubmit = document.getElementById('btn-submit-login');
  const btnLogout = document.getElementById('btn-logout');

  if (formLogin) {
    formLogin.onsubmit = async (e) => {
      e.preventDefault();
      errorMsg.classList.add('hidden');
      btnSubmit.disabled = true;
      btnSubmit.innerText = 'Verificando...';

      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;

      const { data, error } = await db.auth.signInWithPassword({ email, password });

      btnSubmit.disabled = false;
      btnSubmit.innerText = 'Ingresar a mi Billetera';

      if (error) {
        errorMsg.innerText = 'Error: ' + (error.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos' : error.message);
        errorMsg.classList.remove('hidden');
      } else if (data?.user) {
        setAuthenticatedUser(data.user);
      }
    };
  }

  if (btnLogout) {
    btnLogout.onclick = async () => {
      if (confirm('¿Deseas cerrar tu sesión?')) {
        await db.auth.signOut();
        showLoginView();
      }
    };
  }
}

// Load User Data (isolated by RLS)
async function loadUserData() {
  if (!state.user) return;

  const [ctasRes, catsRes, loansRes, txRes, metasRes, configRes, recRes, presRes] = await Promise.all([
    db.from('cuentas').select('*').order('saldo_actual', { ascending: false }),
    db.from('categorias').select('*').order('nombre'),
    db.from('prestamos').select('*').order('created_at', { ascending: false }),
    db.from('transacciones').select('*, cuenta_origen:cuentas!transacciones_cuenta_origen_id_fkey(nombre), cuenta_destino:cuentas!transacciones_cuenta_destino_id_fkey(nombre), categorias(nombre)').order('fecha', { ascending: false }).limit(50),
    db.from('metas_ahorro').select('*').order('created_at', { ascending: false }),
    db.from('configuracion_usuario').select('*').limit(1),
    db.from('gastos_recurrentes').select('*, cuentas(nombre), categorias(nombre)').order('dia_pago', { ascending: true }),
    db.from('presupuestos_mensuales').select('*, categorias(nombre, color, icono)')
  ]);

  if (ctasRes.data) state.cuentas = ctasRes.data;
  if (catsRes.data) state.categorias = catsRes.data;
  if (loansRes.data) state.prestamos = loansRes.data;
  if (txRes.data) state.transacciones = txRes.data;
  if (metasRes.data) state.metas = metasRes.data;

  if (recRes.data) {
    state.recurrentes = recRes.data;
    localStorage.setItem('financiere_recurrentes_' + state.user.id, JSON.stringify(recRes.data));
  } else {
    try {
      state.recurrentes = JSON.parse(localStorage.getItem('financiere_recurrentes_' + state.user.id) || '[]');
    } catch(e) { state.recurrentes = []; }
  }

  if (presRes.data) {
    state.presupuestos = presRes.data;
    localStorage.setItem('financiere_presupuestos_' + state.user.id, JSON.stringify(presRes.data));
  } else {
    try {
      state.presupuestos = JSON.parse(localStorage.getItem('financiere_presupuestos_' + state.user.id) || '[]');
    } catch(e) { state.presupuestos = []; }
  }

  if (configRes.data && configRes.data.length > 0) {
    state.config = { ...state.config, ...configRes.data[0] };
    if (state.config.tipo_cambio) state.tc = parseFloat(state.config.tipo_cambio);
    if (state.config.nombre) {
      localStorage.setItem('financiere_name_' + state.user.id, state.config.nombre);
      const elGreeting = document.getElementById('user-greeting-name');
      if (elGreeting) elGreeting.innerText = `¡Hola, ${state.config.nombre}!`;
    }
  } else {
    const localTc = localStorage.getItem('financiere_tc_' + state.user.id);
    if (localTc) state.tc = parseFloat(localTc);
    const localName = localStorage.getItem('financiere_name_' + state.user.id);
    if (localName) {
      state.config.nombre = localName;
      const elGreeting = document.getElementById('user-greeting-name');
      if (elGreeting) elGreeting.innerText = `¡Hola, ${localName}!`;
    }
  }

  const badgeTc = document.getElementById('badge-tc-display');
  if (badgeTc) badgeTc.innerText = `1 USD = S/ ${state.tc.toFixed(4)}`;

  renderDashboard();
  renderCuentas();
  renderMetas();
  renderRecurrentes();
  renderPrestamos();
  renderPresupuestos();
  renderTransacciones();
  populateDropdowns();
  if (window.lucide) lucide.createIcons();
}

function renderDashboard() {
  let ahorrosPEN = 0;
  let invPEN = 0;
  let loansPEN = 0;

  state.cuentas.forEach(c => {
    const val = Number(c.saldo_actual || 0);
    const converted = c.moneda === 'USD' ? val * state.tc : val;

    if (c.tipo === 'inversion' || c.tipo === 'dpf') {
      invPEN += converted;
    } else {
      ahorrosPEN += converted;
    }
  });

  state.prestamos.forEach(p => {
    if (p.estado === 'Pendiente') {
      loansPEN += Number(p.monto_prestado || 0);
    }
  });

  // La suma de los 3 componentes da el Patrimonio Total
  const grandTotal = ahorrosPEN + invPEN + loansPEN;
  const grandUSD = grandTotal / state.tc;

  document.getElementById('kpi-patrimonio').innerText = formatPEN(grandTotal);
  document.getElementById('kpi-patrimonio-usd').innerText = state.privacyMode ? '($ •••••• USD)' : `(${formatUSD(grandUSD, true)} USD)`;
  
  const elAhorros = document.getElementById('kpi-ahorros');
  if (elAhorros) elAhorros.innerText = formatPEN(ahorrosPEN);

  const elInv = document.getElementById('kpi-inversiones');
  if (elInv) elInv.innerText = formatPEN(invPEN);

  const elLoans = document.getElementById('kpi-prestamos-total');
  if (elLoans) elLoans.innerText = formatPEN(loansPEN);

  const iconPriv = document.getElementById('icon-privacy');
  if (iconPriv) {
    iconPriv.setAttribute('data-lucide', state.privacyMode ? 'eye-off' : 'eye');
  }
}

// Render Cuentas
function renderCuentas() {
  const container = document.getElementById('list-cuentas');
  document.getElementById('count-cuentas').innerText = `${state.cuentas.length} cuentas`;
  if (!container) return;

  if (state.cuentas.length === 0) {
    container.innerHTML = `
      <div class="text-center py-6 px-4 rounded-2xl bg-[#F2F5F8] border border-dashed border-[#C9D6E5] space-y-2">
        <p class="text-xs text-[#2F5D8C]">Aún no has registrado ninguna cuenta bancaria o tarjeta.</p>
        <button onclick="document.getElementById('modal-cuenta').classList.remove('hidden')" class="px-3.5 py-1.5 rounded-xl bg-white text-[#123A63] border border-[#C9D6E5] font-bold text-xs font-bold hover:bg-emerald-500/20">
          + Agregar mi primera cuenta
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = state.cuentas.map(c => {
    const isNegative = Number(c.saldo_actual) < 0;
    const isUSD = c.moneda === 'USD';
    const formatted = isUSD ? formatUSD(c.saldo_actual) : formatPEN(c.saldo_actual);

    return `
      <div class="flex items-center justify-between p-3.5 rounded-2xl bg-[#F2F5F8] border border-[#C9D6E5] hover:border-[#2F5D8C] transition-all">
        <div class="flex items-center space-x-3">
          <div class="w-10 h-10 rounded-xl bg-[#0B1F3B] flex items-center justify-center text-[#C9D6E5] font-black text-xs border border-[#2F5D8C]/30 shadow-sm">
            ${c.institucion.slice(0, 3).toUpperCase()}
          </div>
          <div>
            <h4 class="text-xs font-bold text-[#0B1F3B]">${c.nombre}</h4>
            <span class="text-[10px] px-2 py-0.5 rounded-md bg-[#E2E8F0] text-[#1E293B] uppercase tracking-wider font-semibold">${c.tipo.replace('_', ' ')}</span>
          </div>
        </div>
        <div class="flex items-center space-x-2">
          <div class="text-right">
            <span class="text-xs font-black ${isNegative ? 'text-rose-600' : 'text-[#0B1F3B]'}">${formatted}</span>
            ${isUSD ? `<span class="block text-[10px] text-[#475569]">~ ${formatPEN(Number(c.saldo_actual) * state.tc)}</span>` : ''}
          </div>
          <div class="flex items-center pl-2 border-l border-[#C9D6E5] space-x-1">
            <button onclick="window.editCuenta('${c.id}')" class="p-1.5 rounded-lg text-[#2F5D8C] hover:text-[#0B1F3B] hover:bg-[#C9D6E5]/40 transition-all active:scale-95" title="Editar cuenta">
              <i data-lucide="edit-3" class="w-4 h-4"></i>
            </button>
            <button onclick="window.deleteCuenta('${c.id}')" class="p-1.5 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-100 transition-all active:scale-95" title="Eliminar cuenta">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) {
    lucide.createIcons();
  }
}

// Render Metas de Ahorro
function renderMetas() {
  const container = document.getElementById('list-metas');
  const countEl = document.getElementById('count-metas');
  if (countEl) countEl.innerText = `${state.metas.length} ${state.metas.length === 1 ? 'meta' : 'metas'}`;
  if (!container) return;

  if (state.metas.length === 0) {
    container.innerHTML = `
      <div class="text-center py-6 px-4 rounded-2xl bg-[#F2F5F8] border border-dashed border-[#C9D6E5] space-y-2">
        <p class="text-xs text-[#2F5D8C]">Aún no has definido proyectos o metas de ahorro (ej: Fondo de Emergencia, Vacaciones, etc.).</p>
        <button onclick="document.getElementById('modal-meta').classList.remove('hidden')" class="px-3.5 py-1.5 rounded-xl bg-white text-[#123A63] border border-[#C9D6E5] font-bold text-xs font-bold hover:bg-indigo-500/20">
          + Crear mi primera meta
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = state.metas.map(m => {
    const obj = Number(m.monto_objetivo || 1);
    const act = Number(m.monto_actual || 0);
    const pct = Math.min(100, Math.round((act / obj) * 100));
    const restante = Math.max(0, obj - act);

    let consejoFecha = '';
    if (m.fecha_limite) {
      const hoy = new Date();
      const limite = new Date(m.fecha_limite + 'T23:59:59');
      const diffMeses = Math.max(1, (limite.getFullYear() - hoy.getFullYear()) * 12 + (limite.getMonth() - hoy.getMonth()));
      if (restante > 0) {
        const ahorroMensual = (restante / diffMeses);
        consejoFecha = `💡 Ahorra <strong>${formatPEN(ahorroMensual)}/mes</strong> durante ${diffMeses} ${diffMeses === 1 ? 'mes' : 'meses'}`;
      } else {
        consejoFecha = `🎉 ¡Meta cumplida con éxito!`;
      }
    }

    return `
      <div class="p-4 rounded-2xl bg-[#F2F5F8] border border-[#C9D6E5] hover:border-[#2F5D8C] space-y-3">
        <div class="flex justify-between items-start">
          <div class="flex items-center space-x-2.5">
            <div class="w-8 h-8 rounded-xl bg-indigo-500/10 text-[#123A63] flex items-center justify-center font-bold text-sm">
              🎯
            </div>
            <div>
              <h4 class="text-xs font-bold text-[#0B1F3B]">${m.nombre}</h4>
              <p class="text-[10px] text-[#2F5D8C]">${m.notas || 'Sin notas'}</p>
            </div>
          </div>
          <span class="text-xs font-extrabold px-2 py-0.5 rounded-lg bg-white text-[#123A63] border border-[#C9D6E5] font-bold">
            ${pct}%
          </span>
        </div>

        <div class="space-y-1">
          <div class="w-full bg-[#C9D6E5]/40 rounded-full h-2.5 overflow-hidden p-0.5 border border-[#C9D6E5]">
            <div class="bg-gradient-to-r from-[#123A63] to-[#2F5D8C] h-1.5 rounded-full transition-all duration-500" style="width: ${pct}%"></div>
          </div>
          <div class="flex justify-between text-[11px] font-bold">
            <span class="text-[#123A63]">${formatPEN(act)}</span>
            <span class="text-[#2F5D8C]">Meta: ${formatPEN(obj)}</span>
          </div>
        </div>

        ${consejoFecha ? `<p class="text-[10px] text-[#2F5D8C] bg-indigo-500/5 p-2 rounded-xl border border-indigo-500/10">${consejoFecha}</p>` : ''}

        <div class="flex items-center justify-between pt-1 border-t border-slate-800/60">
          <span class="text-[10px] text-[#2F5D8C]">Faltan: <strong class="text-white">${formatPEN(restante)}</strong></span>
          <div class="flex items-center gap-1.5">
            <button onclick="openModalAporte('${m.id}', '${m.nombre}')" class="px-3 py-1 rounded-xl bg-white text-[#123A63] border border-[#C9D6E5] font-bold hover:bg-emerald-500/20 text-[11px] font-bold active:scale-95 transition-all">
              + Aportar
            </button>
            <button onclick="deleteMeta('${m.id}')" class="p-1 rounded-xl text-[#475569] hover:text-rose-400 active:scale-95 transition-all" title="Eliminar meta">
              ✕
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Render Gastos Recurrentes / Suscripciones
function renderRecurrentes() {
  const container = document.getElementById('list-recurrentes');
  const countComprometido = document.getElementById('total-comprometido-recurrentes');
  if (!container) return;

  const totalPEN = state.recurrentes.reduce((acc, r) => {
    const m = Number(r.monto || 0);
    return acc + (r.moneda === 'USD' ? m * state.tc : m);
  }, 0);

  if (countComprometido) {
    countComprometido.innerText = `Comprometido: ${formatPEN(totalPEN)}/mes`;
  }

  if (state.recurrentes.length === 0) {
    container.innerHTML = `
      <div class="text-center py-6 px-4 rounded-2xl bg-[#F2F5F8] border border-dashed border-[#C9D6E5] space-y-2">
        <p class="text-xs text-[#2F5D8C]">No tienes suscripciones o gastos fijos registrados (Netflix, Spotify, Luz, etc.).</p>
        <button onclick="document.getElementById('modal-recurrente').classList.remove('hidden')" class="px-3.5 py-1.5 rounded-xl bg-white text-[#123A63] border border-[#C9D6E5] font-bold text-xs hover:bg-[#123A63]/10">
          + Agregar primera suscripción
        </button>
      </div>
    `;
    return;
  }

  const currentMonthStr = new Date().toISOString().slice(0, 7);

  container.innerHTML = state.recurrentes.map(r => {
    const isUSD = r.moneda === 'USD';
    const formatted = isUSD ? formatUSD(r.monto) : formatPEN(r.monto);
    const ctaNombre = r.cuentas ? r.cuentas.nombre : 'Sin cuenta asignada';
    const yaPagado = r.ultimo_pago_fecha && r.ultimo_pago_fecha.startsWith(currentMonthStr);

    return `
      <div class="flex items-center justify-between p-3 rounded-2xl bg-[#F2F5F8] border border-[#C9D6E5] hover:border-[#2F5D8C] transition-all">
        <div class="flex items-center space-x-3">
          <div class="w-10 h-10 rounded-xl bg-[#0B1F3B] flex items-center justify-center text-[#C9D6E5] font-bold text-xs border border-[#2F5D8C]/30 shadow-sm">
            <i data-lucide="calendar" class="w-4 h-4"></i>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h4 class="text-xs font-bold text-[#0B1F3B]">${r.nombre}</h4>
              ${yaPagado ? `
                <span class="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-bold border border-emerald-500/20">
                  ✓ Pagado este mes
                </span>
              ` : `
                <span class="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 font-bold border border-amber-500/20">
                  Día ${r.dia_pago || 1}
                </span>
              `}
            </div>
            <div class="flex items-center gap-1.5 text-[10px] text-[#2F5D8C] mt-0.5">
              <span>${ctaNombre}</span>
              <span>•</span>
              <span class="capitalize">${r.frecuencia || 'mensual'}</span>
            </div>
          </div>
        </div>

        <div class="flex items-center space-x-2">
          <div class="text-right">
            <span class="text-xs font-black text-rose-600">-${formatted}</span>
            ${isUSD ? `<span class="block text-[9px] text-[#475569]">~ ${formatPEN(Number(r.monto) * state.tc)}</span>` : ''}
          </div>
          <div class="flex items-center pl-1.5 border-l border-[#C9D6E5] space-x-1">
            ${!yaPagado ? `
              <button onclick="window.pagarRecurrente('${r.id}')" class="px-2 py-1 rounded-lg bg-[#0B1F3B] hover:bg-[#123A63] text-white text-[10px] font-bold active:scale-95 transition-all shadow-sm" title="Registrar pago este mes">
                Pagar
              </button>
            ` : ''}
            <button onclick="window.editRecurrente('${r.id}')" class="p-1 rounded-lg text-[#2F5D8C] hover:text-[#0B1F3B] hover:bg-[#C9D6E5]/40 transition-all active:scale-95" title="Editar">
              <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
            </button>
            <button onclick="window.deleteRecurrente('${r.id}')" class="p-1 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-100 transition-all active:scale-95" title="Eliminar">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

// Render Prestamos
function renderPrestamos() {
  const container = document.getElementById('list-prestamos');
  document.getElementById('count-prestamos').innerText = `${state.prestamos.length} deudores`;
  if (!container) return;

  if (state.prestamos.length === 0) {
    container.innerHTML = `
      <div class="text-center py-6 px-4 rounded-2xl bg-[#F2F5F8] border border-dashed border-[#C9D6E5] space-y-2">
        <p class="text-xs text-[#2F5D8C]">No tienes préstamos registrados en tu cartera.</p>
        <button onclick="document.getElementById('modal-prestamo').classList.remove('hidden')" class="px-3.5 py-1.5 rounded-xl bg-white text-[#123A63] border border-[#C9D6E5] font-bold text-xs font-bold hover:bg-indigo-500/20">
          + Registrar Préstamo
        </button>
      </div>
    `;
    return;
  }

  let totalCapital = 0;
  let totalInteres = 0;

  container.innerHTML = state.prestamos.map(p => {
    const capital = Number(p.monto_prestado || 0);
    const tasa = Number(p.tasa_mensual || 0);
    const interesMensual = capital * tasa;
    const isPendiente = p.estado === 'Pendiente';

    if (isPendiente) {
      totalCapital += capital;
      totalInteres += interesMensual;
    }

    return `
      <div class="p-4 rounded-2xl bg-[#F2F5F8] border border-[#C9D6E5] hover:border-[#2F5D8C] space-y-2.5">
        <div class="flex justify-between items-start">
          <div>
            <h4 class="text-sm font-bold text-white flex items-center gap-2">
              ${p.deudor}
              <span class="text-[10px] px-2 py-0.5 rounded-full ${isPendiente ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-emerald-500/10 text-[#123A63]'} font-semibold">
                ${p.estado}
              </span>
            </h4>
            <p class="text-[11px] text-[#2F5D8C]">${p.notas || 'Sin notas'}</p>
          </div>
          <div class="text-right">
            <span class="text-sm font-black text-white">${formatPEN(capital)}</span>
            <span class="block text-[10px] text-[#123A63] font-semibold">${(tasa * 100).toFixed(1)}% mensual</span>
          </div>
        </div>
        <div class="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
          <span class="text-[#2F5D8C]">Rinde: <strong class="text-[#123A63] font-bold">${formatPEN(interesMensual)}/mes</strong></span>
        </div>
      </div>
    `;
  }).join('');

  document.getElementById('loans-total-capital').innerText = formatPEN(totalCapital);
  document.getElementById('loans-monthly-interest').innerText = `${formatPEN(totalInteres)}/mes`;
}

// Render Presupuestos Mensuales (Semáforo de Gastos)
function renderPresupuestos() {
  const container = document.getElementById('list-presupuestos');
  const countEl = document.getElementById('resumen-presupuestos');
  if (!container) return;

  if (state.presupuestos.length === 0) {
    container.innerHTML = `
      <div class="text-center py-6 px-4 rounded-2xl bg-[#F2F5F8] border border-dashed border-[#C9D6E5] space-y-2">
        <p class="text-xs text-[#2F5D8C]">Aún no has fijado topes de gasto por categoría este mes.</p>
        <button onclick="document.getElementById('modal-presupuesto').classList.remove('hidden')" class="px-3.5 py-1.5 rounded-xl bg-white text-[#123A63] border border-[#C9D6E5] font-bold text-xs hover:bg-[#123A63]/10">
          + Asignar primer presupuesto
        </button>
      </div>
    `;
    return;
  }

  // Calcular gastos del mes actual por categoría
  const currentMonth = new Date().toISOString().slice(0, 7);
  const gastoPorCat = {};
  state.transacciones.forEach(t => {
    if (t.tipo === 'gasto' && t.fecha && t.fecha.startsWith(currentMonth) && t.categoria_id) {
      gastoPorCat[t.categoria_id] = (gastoPorCat[t.categoria_id] || 0) + Number(t.monto || 0);
    }
  });

  let totalPresupuestado = 0;
  let totalGastado = 0;

  container.innerHTML = state.presupuestos.map(p => {
    const cat = state.categorias.find(c => c.id === p.categoria_id) || p.categorias || { nombre: 'Categoría' };
    const limite = Number(p.monto_limite || 1);
    const gastado = gastoPorCat[p.categoria_id] || 0;
    const pct = Math.min(100, Math.round((gastado / limite) * 100));
    const restante = Math.max(0, limite - gastado);

    totalPresupuestado += limite;
    totalGastado += gastado;

    let barColor = 'bg-emerald-500';
    let textColor = 'text-emerald-600';
    let badgeLabel = 'En meta';
    let badgeClass = 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';

    if (pct > 90) {
      barColor = 'bg-rose-500';
      textColor = 'text-rose-600';
      badgeLabel = gastado > limite ? 'Excedido' : 'Límite Crítico';
      badgeClass = 'bg-rose-500/10 text-rose-600 border-rose-500/20';
    } else if (pct >= 70) {
      barColor = 'bg-amber-500';
      textColor = 'text-amber-700';
      badgeLabel = 'Cuidado (Al 70%+)';
      badgeClass = 'bg-amber-500/10 text-amber-700 border-amber-500/20';
    }

    return `
      <div class="p-3.5 rounded-2xl bg-[#F2F5F8] border border-[#C9D6E5] hover:border-[#2F5D8C] space-y-2.5">
        <div class="flex justify-between items-start">
          <div class="flex items-center space-x-2.5">
            <div class="w-8 h-8 rounded-xl bg-white border border-[#C9D6E5] text-[#123A63] flex items-center justify-center font-bold text-xs shadow-sm">
              <i data-lucide="pie-chart" class="w-4 h-4"></i>
            </div>
            <div>
              <h4 class="text-xs font-bold text-[#0B1F3B]">${cat.nombre}</h4>
              <p class="text-[10px] text-[#2F5D8C]">Disponible: <strong class="${textColor}">${formatPEN(restante)}</strong></p>
            </div>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="text-[9px] px-2 py-0.5 rounded-full font-bold border ${badgeClass}">
              ${badgeLabel} (${pct}%)
            </span>
            <button onclick="window.editPresupuesto('${p.id}')" class="p-1 rounded-lg text-[#2F5D8C] hover:text-[#0B1F3B]" title="Editar">
              <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
            </button>
            <button onclick="window.deletePresupuesto('${p.id}')" class="p-1 rounded-lg text-rose-400 hover:text-rose-600" title="Eliminar">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>

        <div class="space-y-1">
          <div class="w-full bg-[#C9D6E5]/40 rounded-full h-2 overflow-hidden p-0.5 border border-[#C9D6E5]">
            <div class="${barColor} h-1 rounded-full transition-all duration-500" style="width: ${pct}%"></div>
          </div>
          <div class="flex justify-between text-[10px] font-bold">
            <span class="${textColor}">${formatPEN(gastado)} gastados</span>
            <span class="text-[#2F5D8C]">Tope: ${formatPEN(limite)}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  if (countEl) {
    countEl.innerText = `${formatPEN(totalGastado)} gastados de ${formatPEN(totalPresupuestado)} asignados`;
  }

  if (window.lucide) lucide.createIcons();
}

// Render Transacciones
function renderTransacciones() {
  const container = document.getElementById('list-transacciones');
  const countTx = document.getElementById('count-tx');
  if (countTx) countTx.innerText = `${state.transacciones.length} registros`;
  if (!container) return;

  if (state.transacciones.length === 0) {
    container.innerHTML = `<div class="text-center py-8 text-xs text-[#475569]">No hay movimientos registrados todavía.</div>`;
    return;
  }

  container.innerHTML = state.transacciones.map(t => {
    const isGasto = t.tipo === 'gasto';
    const isTransfer = t.tipo === 'transferencia';
    const ctaName = t.cuenta_origen ? t.cuenta_origen.nombre : (t.cuenta_destino ? `➔ ${t.cuenta_destino.nombre}` : 'Cuenta');
    const catNombre = isTransfer ? 'Transferencia / Inversión' : (t.categorias ? t.categorias.nombre : 'General');
    const isApplePay = t.metodo_pago === 'apple_pay';

    let iconHtml = '<i data-lucide="arrow-down-right" class="w-4 h-4"></i>';
    let iconClass = 'bg-rose-500/10 text-rose-600';
    let sign = '-';
    let amountClass = 'text-rose-600';

    if (isTransfer) {
      iconHtml = '<i data-lucide="repeat" class="w-4 h-4"></i>';
      iconClass = 'bg-[#123A63]/10 text-[#123A63]';
      sign = '⇄ ';
      amountClass = 'text-[#123A63]';
    } else if (!isGasto) {
      iconHtml = '<i data-lucide="arrow-up-right" class="w-4 h-4"></i>';
      iconClass = 'bg-emerald-500/10 text-emerald-600';
      sign = '+';
      amountClass = 'text-emerald-600';
    }

    if (isApplePay) {
      iconHtml = '<i data-lucide="smartphone" class="w-4 h-4"></i>';
    }

    return `
      <div class="flex items-center justify-between p-3.5 rounded-2xl bg-[#F2F5F8] border border-[#C9D6E5] hover:border-[#2F5D8C] transition-all">
        <div class="flex items-center space-x-3">
          <div class="w-10 h-10 rounded-xl ${iconClass} flex items-center justify-center font-bold text-xs">
            ${iconHtml}
          </div>
          <div>
            <h4 class="text-xs font-bold text-[#0B1F3B]">${t.comercio || t.descripcion || catNombre}</h4>
            <div class="flex items-center gap-1.5 text-[10px] text-[#2F5D8C]">
              <span>${catNombre}</span>
              <span>•</span>
              <span class="text-[#475569]">${t.fecha || ''}</span>
            </div>
          </div>
        </div>
        <div class="flex items-center space-x-2">
          <div class="text-right">
            <span class="text-xs font-black ${amountClass}">
              ${sign}${formatPEN(t.monto)}
            </span>
            <span class="block text-[10px] text-[#475569]">${ctaName}</span>
          </div>
          <div class="flex items-center pl-1.5 border-l border-[#C9D6E5]">
            <button onclick="window.editTransaccion('${t.id}')" class="p-1 rounded-lg text-[#2F5D8C] hover:text-[#0B1F3B] hover:bg-[#C9D6E5]/40 transition-all active:scale-95" title="Editar movimiento">
              <i data-lucide="edit-2" class="w-3.5 h-3.5"></i>
            </button>
            <button onclick="window.deleteTransaccion('${t.id}')" class="p-1 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-100 transition-all active:scale-95" title="Eliminar movimiento">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) {
    lucide.createIcons();
  }
}

function populateDropdowns() {
  const selCta = document.getElementById('select-cuenta');
  const selCtaDest = document.getElementById('select-cuenta-destino');
  const selCat = document.getElementById('select-categoria');

  const optionsHtml = state.cuentas.length === 0
    ? '<option value="">+ Ninguna cuenta creada</option>'
    : state.cuentas.map(c => `<option value="${c.id}">${c.nombre} (${c.moneda} - Saldo: ${formatPEN(c.saldo_actual)})</option>`).join('');

  if (selCta) selCta.innerHTML = optionsHtml;
  if (selCtaDest) selCtaDest.innerHTML = optionsHtml;

  if (selCat) {
    const filteredCats = state.categorias.filter(c => c.tipo === state.tipoTx);
    selCat.innerHTML = filteredCats.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
  }

  const selRecCta = document.getElementById('rec-cuenta');
  const selRecCat = document.getElementById('rec-categoria');
  const selPresCat = document.getElementById('pres-categoria');

  if (selRecCta) selRecCta.innerHTML = '<option value="">(Sin cuenta asignada)</option>' + optionsHtml;

  const gastoCats = state.categorias.filter(c => c.tipo === 'gasto');
  const gastoCatsHtml = gastoCats.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
  if (selRecCat) selRecCat.innerHTML = gastoCatsHtml;
  if (selPresCat) selPresCat.innerHTML = gastoCatsHtml;
}

function setupNavigation() {
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const targetView = tab.dataset.view;
      document.querySelectorAll('.tab-view').forEach(view => view.classList.add('hidden'));
      const activeSec = document.getElementById(`view-${targetView}`);
      if (activeSec) activeSec.classList.remove('hidden');

      document.querySelectorAll('.nav-tab').forEach(t => {
        t.classList.remove('text-[#123A63]');
        t.classList.add('text-[#2F5D8C]');
      });
      tab.classList.remove('text-[#2F5D8C]');
      tab.classList.add('text-[#123A63]');

      if (window.lucide) lucide.createIcons();
    });
  });

  const btnRefresh = document.getElementById('btn-refresh');
  if (btnRefresh) {
    btnRefresh.onclick = async () => {
      btnRefresh.classList.add('animate-spin');
      await loadUserData();
      setTimeout(() => btnRefresh.classList.remove('animate-spin'), 600);
    };
  }

  const btnPrivacy = document.getElementById('btn-toggle-privacy');
  if (btnPrivacy) {
    btnPrivacy.onclick = () => {
      state.privacyMode = !state.privacyMode;
      localStorage.setItem('financiere_privacy', state.privacyMode ? 'true' : 'false');
      renderDashboard();
      renderCuentas();
      renderMetas();
      renderPrestamos();
      renderTransacciones();
      if (window.lucide) lucide.createIcons();
    };
  }
}

function setupInlineCategory() {
  const btnAddCat = document.getElementById('btn-quick-add-cat');
  const box = document.getElementById('inline-new-cat-box');
  const btnCancel = document.getElementById('btn-cancel-inline-cat');
  const btnSave = document.getElementById('btn-save-inline-cat');
  const inputName = document.getElementById('input-new-cat-name');

  if (btnAddCat) btnAddCat.onclick = () => { box.classList.remove('hidden'); inputName.focus(); };
  if (btnCancel) btnCancel.onclick = () => { box.classList.add('hidden'); inputName.value = ''; };

  if (btnSave) {
    btnSave.onclick = async () => {
      const nombre = inputName.value.trim();
      if (!nombre) return;
      btnSave.disabled = true;

      const newCat = {
        nombre: nombre,
        tipo: state.tipoTx,
        grupo: 'Personalizado',
        user_id: state.user.id
      };

      const { data, error } = await db.from('categorias').insert([newCat]).select();
      btnSave.disabled = false;

      if (!error && data?.length) {
        state.categorias.push(data[0]);
        box.classList.add('hidden');
        inputName.value = '';
        populateDropdowns();
        document.getElementById('select-categoria').value = data[0].id;
      } else {
        alert('Error al crear categoría: ' + (error?.message || 'Error'));
      }
    };
  }
}

function setupModals() {
  const modalTx = document.getElementById('modal-tx');
  const modalCta = document.getElementById('modal-cuenta');
  const modalLoan = document.getElementById('modal-prestamo');

  const btnFloating = document.getElementById('btn-floating-add');
  const btnQuickExp = document.getElementById('btn-quick-expense');
  const btnQuickInc = document.getElementById('btn-quick-income');
  const btnOpenCta = document.getElementById('btn-open-modal-cuenta');
  const btnQuickAddCta = document.getElementById('btn-quick-add-cta');
  const btnOpenLoan = document.getElementById('btn-open-modal-prestamo');

  const tabGasto = document.getElementById('tab-tipo-gasto');
  const tabIngreso = document.getElementById('tab-tipo-ingreso');
  const tabTransfer = document.getElementById('tab-tipo-transfer');
  const boxCuentaDest = document.getElementById('box-cuenta-destino');
  const boxCat = document.getElementById('box-categoria');
  const labelComercio = document.getElementById('label-comercio');
  const labelCtaOrigen = document.getElementById('label-cuenta-origen');
  const btnSubmitTx = document.getElementById('btn-submit-tx');

  const openTx = (tipo = 'gasto', isEdit = false) => {
    state.tipoTx = tipo;
    
    [tabGasto, tabIngreso, tabTransfer].forEach(t => {
      if (t) t.className = 'py-2 text-[11px] font-bold rounded-xl text-[#2F5D8C] hover:text-[#0B1F3B] transition-all';
    });

    if (!isEdit) {
      const txIdEl = document.getElementById('tx-id');
      if (txIdEl) txIdEl.value = '';
      const txTitle = document.getElementById('modal-tx-title');
      if (txTitle) txTitle.innerText = 'Nuevo Movimiento';
      const fTx = document.getElementById('form-tx');
      if (fTx) fTx.reset();
    }

    const inputComercio = document.getElementById('input-comercio');

    if (tipo === 'gasto') {
      tabGasto.className = 'py-2 text-[11px] font-bold rounded-xl bg-rose-600 text-white font-bold transition-all';
      if (boxCuentaDest) boxCuentaDest.classList.add('hidden');
      if (boxCat) boxCat.classList.remove('hidden');
      if (labelComercio) labelComercio.innerText = 'Comercio / Detalle';
      if (inputComercio) inputComercio.placeholder = 'Ej: Supermercado, Restaurante, Farmacia, Transporte';
      if (labelCtaOrigen) labelCtaOrigen.innerText = 'Cuenta / Tarjeta (De donde sale)';
      if (btnSubmitTx) btnSubmitTx.innerText = isEdit ? 'Guardar Cambios' : 'Guardar Gasto';
    } else if (tipo === 'ingreso') {
      tabIngreso.className = 'py-2 text-[11px] font-bold rounded-xl bg-[#123A63] text-white font-bold transition-all';
      if (boxCuentaDest) boxCuentaDest.classList.add('hidden');
      if (boxCat) boxCat.classList.remove('hidden');
      if (labelComercio) labelComercio.innerText = 'Origen / Concepto';
      if (inputComercio) inputComercio.placeholder = 'Ej: Sueldo mensual, Bono, Venta, Honorarios';
      if (labelCtaOrigen) labelCtaOrigen.innerText = 'Cuenta Destino (A donde ingresa)';
      if (btnSubmitTx) btnSubmitTx.innerText = isEdit ? 'Guardar Cambios' : 'Guardar Ingreso';
    } else if (tipo === 'transferencia') {
      tabTransfer.className = 'py-2 text-[11px] font-bold rounded-xl bg-[#123A63] text-white font-bold transition-all';
      if (boxCuentaDest) boxCuentaDest.classList.remove('hidden');
      if (boxCat) boxCat.classList.add('hidden');
      if (labelComercio) labelComercio.innerText = 'Detalle de la Inversión / Movimiento';
      if (inputComercio) inputComercio.placeholder = 'Ej: Depósito a Plazo, Aporte a Fondo Mutuo, Compra Acciones';
      if (labelCtaOrigen) labelCtaOrigen.innerText = 'Cuenta Origen (De donde sale)';
      if (btnSubmitTx) btnSubmitTx.innerText = isEdit ? 'Guardar Cambios' : 'Confirmar Transferencia / Inversión';
    }

    populateDropdowns();
    modalTx.classList.remove('hidden');
    if (!isEdit) document.getElementById('input-monto').focus();
  };
  window.openTx = openTx;

  const btnQuickInvest = document.getElementById('btn-quick-invest');
  if (btnFloating) btnFloating.onclick = () => openTx('gasto');
  if (btnQuickExp) btnQuickExp.onclick = () => openTx('gasto');
  if (btnQuickInc) btnQuickInc.onclick = () => openTx('ingreso');
  if (btnQuickInvest) btnQuickInvest.onclick = () => openTx('transferencia');

  if (tabGasto) tabGasto.onclick = () => openTx('gasto');
  if (tabIngreso) tabIngreso.onclick = () => openTx('ingreso');
  if (tabTransfer) tabTransfer.onclick = () => openTx('transferencia');

  const resetCtaModal = () => {
    document.getElementById('cta-id').value = '';
    document.getElementById('modal-cuenta-title').innerText = 'Nueva Cuenta o Tarjeta';
    document.getElementById('btn-submit-cuenta').innerText = 'Guardar Cuenta';
    const fCta = document.getElementById('form-cuenta');
    if (fCta) fCta.reset();
    const bCustom = document.getElementById('box-custom-institucion');
    if (bCustom) bCustom.classList.add('hidden');
    modalCta.classList.remove('hidden');
  };

  if (btnOpenCta) btnOpenCta.onclick = resetCtaModal;
  if (btnQuickAddCta) btnQuickAddCta.onclick = resetCtaModal;
  if (btnOpenLoan) btnOpenLoan.onclick = () => modalLoan.classList.remove('hidden');

  document.getElementById('btn-close-modal-tx').onclick = () => modalTx.classList.add('hidden');
  document.getElementById('btn-close-modal-cuenta').onclick = () => modalCta.classList.add('hidden');
  document.getElementById('btn-close-modal-prestamo').onclick = () => modalLoan.classList.add('hidden');

  const formTx = document.getElementById('form-tx');
  if (formTx) {
    formTx.onsubmit = async (e) => {
      e.preventDefault();
      const txId = document.getElementById('tx-id').value;
      const monto = parseFloat(document.getElementById('input-monto').value);
      const comercio = document.getElementById('input-comercio').value;
      const cuentaId = document.getElementById('select-cuenta').value || null;
      const catId = document.getElementById('select-categoria').value || null;
      const btn = document.getElementById('btn-submit-tx');

      btn.disabled = true;
      btn.innerText = 'Guardando...';

      if (txId) {
        const oldTx = state.transacciones.find(t => t.id === txId);
        if (oldTx && oldTx.cuenta_origen_id) {
          const oldCta = state.cuentas.find(c => c.id === oldTx.cuenta_origen_id);
          if (oldCta) {
            const revDelta = oldTx.tipo === 'gasto' ? Number(oldTx.monto) : -Number(oldTx.monto);
            await db.from('cuentas').update({ saldo_actual: Number(oldCta.saldo_actual) + revDelta }).eq('id', oldTx.cuenta_origen_id);
          }
        }

        const updateData = {
          tipo: state.tipoTx,
          monto: monto,
          cuenta_origen_id: cuentaId,
          categoria_id: catId,
          comercio: comercio
        };
        const { error } = await db.from('transacciones').update(updateData).eq('id', txId);

        if (!error && cuentaId) {
          const cta = state.cuentas.find(c => c.id === cuentaId);
          if (cta) {
            const newDelta = state.tipoTx === 'ingreso' ? monto : -monto;
            await db.from('cuentas').update({ saldo_actual: Number(cta.saldo_actual) + newDelta }).eq('id', cuentaId);
          }
        }
        if (error) alert('Error al editar movimiento: ' + error.message);
      } else if (state.tipoTx === 'transferencia') {
        const cuentaDestinoId = document.getElementById('select-cuenta-destino').value;
        if (!cuentaId || !cuentaDestinoId || cuentaId === cuentaDestinoId) {
          alert('Por favor selecciona dos cuentas distintas para mover o invertir tu dinero.');
          btn.disabled = false;
          btn.innerText = 'Confirmar Transferencia / Inversión';
          return;
        }

        const ctaOrigen = state.cuentas.find(c => c.id === cuentaId);
        const ctaDestino = state.cuentas.find(c => c.id === cuentaDestinoId);
        if (ctaOrigen && ctaDestino) {
          await db.from('cuentas').update({ saldo_actual: Number(ctaOrigen.saldo_actual) - monto }).eq('id', cuentaId);
          await db.from('cuentas').update({ saldo_actual: Number(ctaDestino.saldo_actual) + monto }).eq('id', cuentaDestinoId);
        }

        const newTx = {
          fecha: new Date().toISOString().split('T')[0],
          tipo: 'transferencia',
          monto: monto,
          moneda: 'PEN',
          cuenta_origen_id: cuentaId,
          cuenta_destino_id: cuentaDestinoId,
          comercio: comercio || `Transferencia a ${ctaDestino?.nombre || 'Inversión'}`,
          user_id: state.user.id
        };
        const { error } = await db.from('transacciones').insert([newTx]);
        if (error) alert('Error: ' + error.message);
      } else {
        const newTx = {
          fecha: new Date().toISOString().split('T')[0],
          tipo: state.tipoTx,
          monto: monto,
          moneda: 'PEN',
          cuenta_origen_id: cuentaId,
          categoria_id: catId,
          comercio: comercio,
          user_id: state.user.id
        };
        const { error } = await db.from('transacciones').insert([newTx]);

        if (!error && cuentaId) {
          const cta = state.cuentas.find(c => c.id === cuentaId);
          if (cta) {
            const delta = state.tipoTx === 'ingreso' ? monto : -monto;
            await db.from('cuentas').update({ saldo_actual: Number(cta.saldo_actual) + delta }).eq('id', cuentaId);
          }
        }
        if (error) alert('Error: ' + error.message);
      }

      btn.disabled = false;
      btn.innerText = 'Guardar';
      modalTx.classList.add('hidden');
      formTx.reset();
      await loadUserData();
    };
  }

  const selInstitucion = document.getElementById('cta-institucion');
  const boxCustomInst = document.getElementById('box-custom-institucion');
  const inputCustomInst = document.getElementById('cta-institucion-custom');

  if (selInstitucion && boxCustomInst) {
    selInstitucion.onchange = () => {
      if (selInstitucion.value === 'OTRO') {
        boxCustomInst.classList.remove('hidden');
        inputCustomInst.focus();
      } else {
        boxCustomInst.classList.add('hidden');
      }
    };
  }

  const formCta = document.getElementById('form-cuenta');
  if (formCta) {
    formCta.onsubmit = async (e) => {
      e.preventDefault();
      const nombre = document.getElementById('cta-nombre').value.trim();
      let institucion = document.getElementById('cta-institucion').value;
      if (institucion === 'OTRO') {
        institucion = document.getElementById('cta-institucion-custom').value.trim() || 'Otro';
      }
      const tipo = document.getElementById('cta-tipo').value;
      const moneda = document.getElementById('cta-moneda').value;
      const saldo = parseFloat(document.getElementById('cta-saldo').value || 0);
      const btn = document.getElementById('btn-submit-cuenta');

      btn.disabled = true;

      const ctaId = document.getElementById('cta-id').value;
      if (ctaId) {
        const { error } = await db.from('cuentas').update({
          nombre, institucion, tipo, moneda, saldo_actual: saldo
        }).eq('id', ctaId);
        btn.disabled = false;

        if (error) {
          alert('Error al actualizar cuenta: ' + error.message);
        } else {
          modalCta.classList.add('hidden');
          formCta.reset();
          if (boxCustomInst) boxCustomInst.classList.add('hidden');
          await loadUserData();
        }
      } else {
        const newCta = {
          nombre, institucion, tipo, moneda, saldo_actual: saldo, user_id: state.user.id
        };

        const { error } = await db.from('cuentas').insert([newCta]);
        btn.disabled = false;

        if (error) {
          alert('Error al crear cuenta: ' + error.message);
        } else {
          modalCta.classList.add('hidden');
          formCta.reset();
          if (boxCustomInst) boxCustomInst.classList.add('hidden');
          await loadUserData();
        }
      }
    };
  }

  const formLoan = document.getElementById('form-prestamo');
  if (formLoan) {
    formLoan.onsubmit = async (e) => {
      e.preventDefault();
      const deudor = document.getElementById('loan-deudor').value.trim();
      const monto = parseFloat(document.getElementById('loan-monto').value);
      const tasaPct = parseFloat(document.getElementById('loan-tasa').value || 0);
      const notas = document.getElementById('loan-notas').value.trim();
      const btn = document.getElementById('btn-submit-prestamo');

      btn.disabled = true;
      const newLoan = {
        deudor,
        monto_prestado: monto,
        tasa_mensual: tasaPct / 100,
        notas,
        user_id: state.user.id
      };

      const { error } = await db.from('prestamos').insert([newLoan]);
      btn.disabled = false;

      if (error) {
        alert('Error: ' + error.message);
      } else {
        modalLoan.classList.add('hidden');
        formLoan.reset();
        await loadUserData();
      }
    };
  }
  // Metas Modals Setup
  const modalMeta = document.getElementById('modal-meta');
  const modalAporte = document.getElementById('modal-aporte-meta');
  const btnOpenMeta = document.getElementById('btn-open-modal-meta');

  if (btnOpenMeta) btnOpenMeta.onclick = () => modalMeta.classList.remove('hidden');
  document.getElementById('btn-close-modal-meta').onclick = () => modalMeta.classList.add('hidden');
  document.getElementById('btn-close-modal-aporte').onclick = () => modalAporte.classList.add('hidden');

  const formMeta = document.getElementById('form-meta');
  if (formMeta) {
    formMeta.onsubmit = async (e) => {
      e.preventDefault();
      const nombre = document.getElementById('meta-nombre').value.trim();
      const objetivo = parseFloat(document.getElementById('meta-monto-objetivo').value);
      const actual = parseFloat(document.getElementById('meta-monto-actual').value || 0);
      const fecha = document.getElementById('meta-fecha-limite').value || null;
      const notas = document.getElementById('meta-notas').value.trim();
      const btn = document.getElementById('btn-submit-meta');

      btn.disabled = true;
      const newMeta = {
        nombre,
        monto_objetivo: objetivo,
        monto_actual: actual,
        fecha_limite: fecha,
        notas,
        user_id: state.user.id
      };

      const { error } = await db.from('metas_ahorro').insert([newMeta]);
      btn.disabled = false;

      if (error) {
        alert('Error: ' + error.message);
      } else {
        modalMeta.classList.add('hidden');
        formMeta.reset();
        await loadUserData();
      }
    };
  }

  const formAporte = document.getElementById('form-aporte-meta');
  if (formAporte) {
    formAporte.onsubmit = async (e) => {
      e.preventDefault();
      const metaId = document.getElementById('aporte-meta-id').value;
      const montoAporte = parseFloat(document.getElementById('aporte-monto').value);
      const cuentaId = document.getElementById('aporte-cuenta-origen').value;
      const btn = document.getElementById('btn-submit-aporte');

      btn.disabled = true;
      const metaActual = state.metas.find(m => m.id === metaId);
      if (!metaActual) return;

      const nuevoMonto = Number(metaActual.monto_actual || 0) + montoAporte;

      const { error: errMeta } = await db
        .from('metas_ahorro')
        .update({ monto_actual: nuevoMonto, updated_at: new Date().toISOString() })
        .eq('id', metaId);

      if (!errMeta && cuentaId) {
        const cta = state.cuentas.find(c => c.id === cuentaId);
        if (cta) {
          const nuevoSaldo = Number(cta.saldo_actual) - montoAporte;
          await db.from('cuentas').update({ saldo_actual: nuevoSaldo }).eq('id', cuentaId);
          await db.from('transacciones').insert([{
            fecha: new Date().toISOString().split('T')[0],
            tipo: 'gasto',
            monto: montoAporte,
            moneda: cta.moneda,
            cuenta_origen_id: cuentaId,
            comercio: `Aporte a meta: ${metaActual.nombre}`,
            user_id: state.user.id
          }]);
        }
      }

      btn.disabled = false;

      if (errMeta) {
        alert('Error: ' + errMeta.message);
      } else {
        modalAporte.classList.add('hidden');
        formAporte.reset();
        await loadUserData();
      }
    };
  }


  const btnCopy = document.getElementById('btn-copy-shortcut-json');
  if (btnCopy) {
    btnCopy.onclick = () => {
      const config = {
        url: "https://iixzsxvlzzzzufvmytps.supabase.co/rest/v1/transacciones",
        method: "POST",
        headers: {
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json"
        },
        body: {
          "monto": 25.0,
          "comercio": "Supermercado",
          "tipo": "gasto",
          "metodo_pago": "apple_pay",
          "user_id": state.user?.id || ""
        }
      };
      navigator.clipboard.writeText(JSON.stringify(config, null, 2));
      btnCopy.innerText = '¡Copiado con tu User ID!';
      setTimeout(() => btnCopy.innerHTML = '<i data-lucide="copy" class="w-4 h-4"></i> Copiar Configuración del Atajo', 2000);
    };
  }

  // Handlers para Nombre de Usuario
  const modalName = document.getElementById('modal-name');
  const btnCloseName = document.getElementById('btn-close-modal-name');
  const formName = document.getElementById('form-user-name');

  if (btnCloseName) btnCloseName.onclick = () => modalName.classList.add('hidden');
  if (formName) {
    formName.onsubmit = (e) => {
      e.preventDefault();
      const newName = document.getElementById('input-preferred-name').value.trim();
      if (newName && state.user) {
        localStorage.setItem('financiere_name_' + state.user.id, newName);
        const elGreeting = document.getElementById('user-greeting-name');
        if (elGreeting) elGreeting.innerText = `¡Hola, ${newName}!`;
        modalName.classList.add('hidden');
      }
    };
  }

  // Handlers para Actualizar Inversiones (editable)
  const modalInv = document.getElementById('modal-update-investment');
  const btnCloseInv = document.getElementById('btn-close-modal-inv');
  const btnQuickEditInv = document.getElementById('btn-quick-edit-inv');
  const formUpdateInv = document.getElementById('form-update-investment');
  const selInvAccount = document.getElementById('select-inv-account');
  const inputInvNewBalance = document.getElementById('input-inv-new-balance');
  const invBalanceHint = document.getElementById('inv-current-balance-hint');

  if (btnCloseInv) btnCloseInv.onclick = () => modalInv.classList.add('hidden');

  if (btnQuickEditInv) {
    btnQuickEditInv.onclick = () => {
      const invAccounts = state.cuentas.filter(c => c.tipo === 'inversion' || c.tipo === 'dpf');
      if (invAccounts.length === 0) {
        alert("Primero crea una cuenta de tipo 'Inversiones' o 'Plazo Fijo (DPF)' en 'Mis Cuentas' para poder registrar y actualizar su valor de mercado.");
        document.getElementById('modal-cuenta').classList.remove('hidden');
        return;
      }

      selInvAccount.innerHTML = invAccounts.map(c => `<option value="${c.id}">${c.nombre} (${c.moneda} - Saldo: ${formatPEN(c.saldo_actual)})</option>`).join('');
      
      const firstAcc = invAccounts[0];
      inputInvNewBalance.value = firstAcc.saldo_actual;
      invBalanceHint.innerText = `Valor actual registrado: ${formatPEN(firstAcc.saldo_actual)}`;
      modalInv.classList.remove('hidden');
      inputInvNewBalance.focus();
    };
  }

  if (selInvAccount) {
    selInvAccount.onchange = () => {
      const acc = state.cuentas.find(c => c.id === selInvAccount.value);
      if (acc) {
        inputInvNewBalance.value = acc.saldo_actual;
        invBalanceHint.innerText = `Valor actual registrado: ${formatPEN(acc.saldo_actual)}`;
      }
    };
  }

  if (formUpdateInv) {
    formUpdateInv.onsubmit = async (e) => {
      e.preventDefault();
      const accId = selInvAccount.value;
      const newBal = parseFloat(inputInvNewBalance.value);
      const acc = state.cuentas.find(c => c.id === accId);
      if (!acc) return;

      const diff = newBal - Number(acc.saldo_actual || 0);
      const { error } = await db.from('cuentas').update({ saldo_actual: newBal, updated_at: new Date().toISOString() }).eq('id', accId);

      if (!error && diff !== 0) {
        await db.from('transacciones').insert([{
          fecha: new Date().toISOString().split('T')[0],
          tipo: diff > 0 ? 'ingreso' : 'gasto',
          monto: Math.abs(diff),
          moneda: acc.moneda,
          cuenta_origen_id: accId,
          comercio: diff > 0 ? `Rendimiento / Ganancia en ${acc.nombre}` : `Ajuste de mercado en ${acc.nombre}`,
          user_id: state.user.id
        }]);
      }

      if (error) {
        alert('Error: ' + error.message);
      } else {
        modalInv.classList.add('hidden');
        await loadUserData();
      }
    };
  }

  // Handlers para Panel de Configuraciones
  const btnOpenSettings = document.getElementById('btn-open-settings');
  const modalSettings = document.getElementById('modal-settings');
  const btnCloseSettings = document.getElementById('btn-close-modal-settings');
  const formSettings = document.getElementById('form-settings');

  if (btnOpenSettings) {
    btnOpenSettings.onclick = () => {
      document.getElementById('config-nombre').value = state.config.nombre || localStorage.getItem('financiere_name_' + state.user.id) || 'Jarinson';
      document.getElementById('config-tc').value = state.tc.toFixed(4);
      document.getElementById('config-email-reportes').value = state.config.email_reportes || state.user.email || '';
      document.getElementById('config-check-email').checked = !!state.config.recibir_reporte_email;
      document.getElementById('config-telefono').value = state.config.telefono || '';
      document.getElementById('config-telegram').value = state.config.telegram_id || '';
      document.getElementById('config-check-telegram').checked = !!state.config.recibir_reporte_telegram;
      document.getElementById('config-hora-reporte').value = state.config.hora_reporte ? state.config.hora_reporte.slice(0, 5) : '07:30';
      const badge = document.getElementById('badge-tc-display');
      if (badge) badge.innerText = `1 USD = S/ ${state.tc.toFixed(4)}`;
      modalSettings.classList.remove('hidden');
    };
  }

  if (btnCloseSettings) {
    btnCloseSettings.onclick = () => modalSettings.classList.add('hidden');
  }

  if (formSettings) {
    formSettings.onsubmit = async (e) => {
      e.preventDefault();
      const nombre = document.getElementById('config-nombre').value.trim();
      const tc = parseFloat(document.getElementById('config-tc').value || 3.75);
      const emailReportes = document.getElementById('config-email-reportes').value.trim();
      const checkEmail = document.getElementById('config-check-email').checked;
      const telefono = document.getElementById('config-telefono').value.trim();
      const telegram = document.getElementById('config-telegram').value.trim();
      const checkTelegram = document.getElementById('config-check-telegram').checked;
      const horaReporte = document.getElementById('config-hora-reporte').value || '07:30:00';
      const btnSave = document.getElementById('btn-save-settings');

      btnSave.disabled = true;
      btnSave.innerText = 'Guardando...';

      state.tc = tc;
      localStorage.setItem('financiere_tc_' + state.user.id, tc.toString());
      localStorage.setItem('financiere_name_' + state.user.id, nombre);

      state.config = {
        user_id: state.user.id,
        nombre,
        tipo_cambio: tc,
        email_reportes: emailReportes,
        recibir_reporte_email: checkEmail,
        telefono,
        telegram_id: telegram,
        recibir_reporte_telegram: checkTelegram,
        hora_reporte: horaReporte
      };

      try {
        await db.from('configuracion_usuario').upsert(state.config, { onConflict: 'user_id' });
      } catch (err) {
        console.warn('Config upsert warning:', err);
      }

      btnSave.disabled = false;
      btnSave.innerText = 'Guardar Configuración';
      modalSettings.classList.add('hidden');

      const elGreeting = document.getElementById('user-greeting-name');
      if (elGreeting) elGreeting.innerText = `¡Hola, ${nombre}!`;

      const badge = document.getElementById('badge-tc-display');
      if (badge) badge.innerText = `1 USD = S/ ${state.tc.toFixed(4)}`;

      renderDashboard();
      renderCuentas();
    };
  }

  // Handlers para Cambiar Contraseña
  const btnUpdatePass = document.getElementById('btn-update-password');
  if (btnUpdatePass) {
    btnUpdatePass.onclick = async () => {
      const p1 = document.getElementById('config-new-password').value.trim();
      const p2 = document.getElementById('config-confirm-password').value.trim();
      const msg = document.getElementById('msg-password-status');
      if (!p1 || p1.length < 6) {
        msg.textContent = 'La contraseña debe tener al menos 6 caracteres';
        msg.className = 'text-[10px] text-rose-600 block text-center font-bold mt-1';
        return;
      }
      if (p1 !== p2) {
        msg.textContent = 'Las contraseñas no coinciden';
        msg.className = 'text-[10px] text-rose-600 block text-center font-bold mt-1';
        return;
      }

      btnUpdatePass.disabled = true;
      btnUpdatePass.innerText = 'Actualizando contraseña...';

      const { data, error } = await db.auth.updateUser({ password: p1 });

      btnUpdatePass.disabled = false;
      btnUpdatePass.innerText = 'Actualizar Mi Contraseña';

      if (error) {
        msg.textContent = 'Error: ' + error.message;
        msg.className = 'text-[10px] text-rose-600 block text-center font-bold mt-1';
      } else {
        msg.textContent = '¡Contraseña actualizada con éxito!';
        msg.className = 'text-[10px] text-emerald-600 block text-center font-bold mt-1';
        document.getElementById('config-new-password').value = '';
        document.getElementById('config-confirm-password').value = '';
        setTimeout(() => { msg.className = 'hidden'; }, 3500);
      }
    };
  }

  // Handlers para Gastos Recurrentes / Suscripciones
  const modalRec = document.getElementById('modal-recurrente');
  const btnOpenRec = document.getElementById('btn-open-modal-recurrente');
  const btnCloseRec = document.getElementById('btn-close-modal-recurrente');
  const formRec = document.getElementById('form-recurrente');

  if (btnOpenRec) {
    btnOpenRec.onclick = () => {
      document.getElementById('rec-id').value = '';
      document.getElementById('modal-recurrente-title').innerText = 'Nueva Suscripción / Gasto Fijo';
      document.getElementById('btn-submit-recurrente').innerText = 'Guardar Suscripción';
      if (formRec) formRec.reset();
      populateDropdowns();
      modalRec.classList.remove('hidden');
    };
  }
  if (btnCloseRec) btnCloseRec.onclick = () => modalRec.classList.add('hidden');

  if (formRec) {
    formRec.onsubmit = async (e) => {
      e.preventDefault();
      const recId = document.getElementById('rec-id').value;
      const nombre = document.getElementById('rec-nombre').value.trim();
      const monto = parseFloat(document.getElementById('rec-monto').value);
      const moneda = document.getElementById('rec-moneda').value;
      const dia = parseInt(document.getElementById('rec-dia').value);
      const frecuencia = document.getElementById('rec-frecuencia').value;
      const cuentaId = document.getElementById('rec-cuenta').value || null;
      const catId = document.getElementById('rec-categoria').value || null;
      const btn = document.getElementById('btn-submit-recurrente');

      btn.disabled = true;

      const recData = {
        nombre, monto, moneda, dia_pago: dia, frecuencia,
        cuenta_id: cuentaId, categoria_id: catId, user_id: state.user.id
      };

      try {
        if (recId) {
          await db.from('gastos_recurrentes').update(recData).eq('id', recId);
        } else {
          await db.from('gastos_recurrentes').insert([recData]);
        }
      } catch(err) {
        console.warn('Recurrente fallback:', err);
      }

      btn.disabled = false;
      modalRec.classList.add('hidden');
      formRec.reset();
      await loadUserData();
    };
  }

  // Handlers para Presupuestos Mensuales
  const modalPres = document.getElementById('modal-presupuesto');
  const btnOpenPres = document.getElementById('btn-open-modal-presupuesto');
  const btnClosePres = document.getElementById('btn-close-modal-presupuesto');
  const formPres = document.getElementById('form-presupuesto');

  if (btnOpenPres) {
    btnOpenPres.onclick = () => {
      document.getElementById('pres-id').value = '';
      document.getElementById('modal-presupuesto-title').innerText = 'Asignar Presupuesto Mensual';
      document.getElementById('btn-submit-presupuesto').innerText = 'Guardar Presupuesto';
      if (formPres) formPres.reset();
      populateDropdowns();
      modalPres.classList.remove('hidden');
    };
  }
  if (btnClosePres) btnClosePres.onclick = () => modalPres.classList.add('hidden');

  if (formPres) {
    formPres.onsubmit = async (e) => {
      e.preventDefault();
      const presId = document.getElementById('pres-id').value;
      const catId = document.getElementById('pres-categoria').value;
      const limite = parseFloat(document.getElementById('pres-limite').value);
      const btn = document.getElementById('btn-submit-presupuesto');

      btn.disabled = true;

      const presData = {
        categoria_id: catId, monto_limite: limite, user_id: state.user.id
      };

      try {
        if (presId) {
          await db.from('presupuestos_mensuales').update(presData).eq('id', presId);
        } else {
          await db.from('presupuestos_mensuales').upsert(presData, { onConflict: 'user_id,categoria_id' });
        }
      } catch(err) {
        console.warn('Presupuesto fallback:', err);
      }

      btn.disabled = false;
      modalPres.classList.add('hidden');
      formPres.reset();
      await loadUserData();
    };
  }
}


window.openModalAporte = (metaId, metaNombre) => {
  const modal = document.getElementById('modal-aporte-meta');
  document.getElementById('aporte-meta-id').value = metaId;
  document.getElementById('aporte-meta-nombre-display').innerText = metaNombre;
  document.getElementById('aporte-monto').value = '';

  const selCta = document.getElementById('aporte-cuenta-origen');
  if (selCta) {
    selCta.innerHTML = '<option value="">(No descontar de ninguna cuenta)</option>' +
      state.cuentas.map(c => `<option value="${c.id}">${c.nombre} (${c.moneda} - Saldo: ${c.saldo_actual})</option>`).join('');
  }

  modal.classList.remove('hidden');
  document.getElementById('aporte-monto').focus();
};

window.deleteMeta = async (metaId) => {
  if (confirm('¿Estás seguro de eliminar esta meta o proyecto?')) {
    const { error } = await db.from('metas_ahorro').delete().eq('id', metaId);
    if (error) alert('Error: ' + error.message);
    else await loadUserData();
  }
};

window.editCuenta = (id) => {
  const c = state.cuentas.find(x => x.id === id);
  if (!c) return;
  document.getElementById('cta-id').value = c.id;
  document.getElementById('modal-cuenta-title').innerText = 'Editar Cuenta o Tarjeta';
  document.getElementById('btn-submit-cuenta').innerText = 'Guardar Cambios';
  document.getElementById('cta-nombre').value = c.nombre;
  document.getElementById('cta-tipo').value = c.tipo;
  document.getElementById('cta-moneda').value = c.moneda;
  document.getElementById('cta-saldo').value = c.saldo_actual;

  const selInst = document.getElementById('cta-institucion');
  const customBox = document.getElementById('box-custom-institucion');
  const customInput = document.getElementById('cta-institucion-custom');

  let match = false;
  for (let opt of selInst.options) {
    if (opt.value === c.institucion) {
      selInst.value = c.institucion;
      match = true;
      break;
    }
  }
  if (!match) {
    selInst.value = 'OTRO';
    customBox.classList.remove('hidden');
    customInput.value = c.institucion;
  } else {
    customBox.classList.add('hidden');
  }

  document.getElementById('modal-cuenta').classList.remove('hidden');
};

window.deleteCuenta = async (id) => {
  const c = state.cuentas.find(x => x.id === id);
  if (!c) return;
  if (!confirm(`¿Estás seguro de eliminar la cuenta "${c.nombre}"?`)) return;

  const { data: linkedTx } = await db.from('transacciones')
    .select('id')
    .or(`cuenta_origen_id.eq.${id},cuenta_destino_id.eq.${id}`)
    .limit(1);

  if (linkedTx && linkedTx.length > 0) {
    const eliminarConTx = confirm(`Esta cuenta tiene movimientos registrados.\n¿Deseas eliminar la cuenta y todas sus transacciones vinculadas?`);
    if (!eliminarConTx) return;
    await db.from('transacciones').delete().or(`cuenta_origen_id.eq.${id},cuenta_destino_id.eq.${id}`);
  }

  const { error } = await db.from('cuentas').delete().eq('id', id);
  if (error) {
    alert('Error al eliminar cuenta: ' + error.message);
  } else {
    await loadUserData();
  }
};

window.editTransaccion = (id) => {
  const t = state.transacciones.find(x => x.id === id);
  if (!t) return;
  document.getElementById('tx-id').value = t.id;
  document.getElementById('modal-tx-title').innerText = 'Editar Movimiento';
  document.getElementById('btn-submit-tx').innerText = 'Guardar Cambios';

  window.openTx(t.tipo, true);

  document.getElementById('input-monto').value = t.monto;
  document.getElementById('input-comercio').value = t.comercio || t.descripcion || '';
  if (t.cuenta_origen_id) document.getElementById('select-cuenta').value = t.cuenta_origen_id;
  if (t.categoria_id) document.getElementById('select-categoria').value = t.categoria_id;
  if (t.cuenta_destino_id) document.getElementById('select-cuenta-destino').value = t.cuenta_destino_id;
};

window.deleteTransaccion = async (id) => {
  const t = state.transacciones.find(x => x.id === id);
  if (!t) return;
  if (!confirm('¿Estás seguro de eliminar este movimiento?')) return;

  if (t.cuenta_origen_id) {
    const cta = state.cuentas.find(c => c.id === t.cuenta_origen_id);
    if (cta) {
      const delta = t.tipo === 'gasto' ? Number(t.monto) : -Number(t.monto);
      await db.from('cuentas').update({ saldo_actual: Number(cta.saldo_actual) + delta }).eq('id', t.cuenta_origen_id);
    }
  }

  const { error } = await db.from('transacciones').delete().eq('id', id);
  if (error) {
    alert('Error al eliminar movimiento: ' + error.message);
  } else {
    await loadUserData();
  }
};

window.pagarRecurrente = async (id) => {
  const r = state.recurrentes.find(x => x.id === id);
  if (!r) return;
  if (!confirm(`¿Confirmas el pago de "${r.nombre}" por ${formatPEN(r.monto, true)}?`)) return;

  const hoy = new Date().toISOString().split('T')[0];

  const newTx = {
    fecha: hoy,
    tipo: 'gasto',
    monto: r.monto,
    moneda: r.moneda || 'PEN',
    cuenta_origen_id: r.cuenta_id || null,
    categoria_id: r.categoria_id || null,
    comercio: `Pago suscripción: ${r.nombre}`,
    user_id: state.user.id
  };

  const { error } = await db.from('transacciones').insert([newTx]);

  if (!error && r.cuenta_id) {
    const cta = state.cuentas.find(c => c.id === r.cuenta_id);
    if (cta) {
      await db.from('cuentas').update({ saldo_actual: Number(cta.saldo_actual) - Number(r.monto) }).eq('id', r.cuenta_id);
    }
  }

  try {
    await db.from('gastos_recurrentes').update({ ultimo_pago_fecha: hoy }).eq('id', id);
  } catch(e) {}

  r.ultimo_pago_fecha = hoy;
  localStorage.setItem('financiere_recurrentes_' + state.user.id, JSON.stringify(state.recurrentes));

  await loadUserData();
};

window.editRecurrente = (id) => {
  const r = state.recurrentes.find(x => x.id === id);
  if (!r) return;
  document.getElementById('rec-id').value = r.id;
  document.getElementById('modal-recurrente-title').innerText = 'Editar Suscripción';
  document.getElementById('btn-submit-recurrente').innerText = 'Guardar Cambios';
  document.getElementById('rec-nombre').value = r.nombre;
  document.getElementById('rec-monto').value = r.monto;
  document.getElementById('rec-moneda').value = r.moneda || 'PEN';
  document.getElementById('rec-dia').value = r.dia_pago || 1;
  document.getElementById('rec-frecuencia').value = r.frecuencia || 'mensual';
  populateDropdowns();
  if (r.cuenta_id) document.getElementById('rec-cuenta').value = r.cuenta_id;
  if (r.categoria_id) document.getElementById('rec-categoria').value = r.categoria_id;
  document.getElementById('modal-recurrente').classList.remove('hidden');
};

window.deleteRecurrente = async (id) => {
  const r = state.recurrentes.find(x => x.id === id);
  if (!r) return;
  if (!confirm(`¿Eliminar la suscripción "${r.nombre}"?`)) return;

  try {
    await db.from('gastos_recurrentes').delete().eq('id', id);
  } catch(e) {}

  state.recurrentes = state.recurrentes.filter(x => x.id !== id);
  localStorage.setItem('financiere_recurrentes_' + state.user.id, JSON.stringify(state.recurrentes));
  await loadUserData();
};

window.editPresupuesto = (id) => {
  const p = state.presupuestos.find(x => x.id === id);
  if (!p) return;
  document.getElementById('pres-id').value = p.id;
  document.getElementById('modal-presupuesto-title').innerText = 'Editar Presupuesto';
  document.getElementById('btn-submit-presupuesto').innerText = 'Guardar Cambios';
  populateDropdowns();
  document.getElementById('pres-categoria').value = p.categoria_id;
  document.getElementById('pres-limite').value = p.monto_limite;
  document.getElementById('modal-presupuesto').classList.remove('hidden');
};

window.deletePresupuesto = async (id) => {
  if (!confirm('¿Eliminar este presupuesto mensual?')) return;
  try {
    await db.from('presupuestos_mensuales').delete().eq('id', id);
  } catch(e) {}

  state.presupuestos = state.presupuestos.filter(x => x.id !== id);
  localStorage.setItem('financiere_presupuestos_' + state.user.id, JSON.stringify(state.presupuestos));
  await loadUserData();
};

