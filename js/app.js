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
  tipoTx: 'gasto',
  tc: 3.75
};

const formatPEN = (num) => 'S/ ' + Number(num || 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatUSD = (num) => '$ ' + Number(num || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

  const [ctasRes, catsRes, loansRes, txRes, metasRes] = await Promise.all([
    db.from('cuentas').select('*').order('saldo_actual', { ascending: false }),
    db.from('categorias').select('*').order('nombre'),
    db.from('prestamos').select('*').order('created_at', { ascending: false }),
    db.from('transacciones').select('*, cuentas(nombre), categorias(nombre)').order('fecha', { ascending: false }).limit(25),
    db.from('metas_ahorro').select('*').order('created_at', { ascending: false })
  ]);

  if (ctasRes.data) state.cuentas = ctasRes.data;
  if (catsRes.data) state.categorias = catsRes.data;
  if (loansRes.data) state.prestamos = loansRes.data;
  if (txRes.data) state.transacciones = txRes.data;
  if (metasRes.data) state.metas = metasRes.data;

  renderDashboard();
  renderCuentas();
  renderMetas();
  renderPrestamos();
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
  document.getElementById('kpi-patrimonio-usd').innerText = `(${formatUSD(grandUSD)} USD)`;
  
  const elAhorros = document.getElementById('kpi-ahorros');
  if (elAhorros) elAhorros.innerText = formatPEN(ahorrosPEN);

  const elInv = document.getElementById('kpi-inversiones');
  if (elInv) elInv.innerText = formatPEN(invPEN);

  const elLoans = document.getElementById('kpi-prestamos-total');
  if (elLoans) elLoans.innerText = formatPEN(loansPEN);
}

// Render Cuentas
function renderCuentas() {
  const container = document.getElementById('list-cuentas');
  document.getElementById('count-cuentas').innerText = `${state.cuentas.length} cuentas`;
  if (!container) return;

  if (state.cuentas.length === 0) {
    container.innerHTML = `
      <div class="text-center py-6 px-4 rounded-2xl bg-[#071711] border border-dashed border-[#1F6F54]/60 space-y-2">
        <p class="text-xs text-[#D7E7DD]">Aún no has registrado ninguna cuenta bancaria o tarjeta.</p>
        <button onclick="document.getElementById('modal-cuenta').classList.remove('hidden')" class="px-3.5 py-1.5 rounded-xl bg-[#1F6F54]/40 text-[#5FB88A] border border-[#5FB88A]/30 text-xs font-bold hover:bg-emerald-500/20">
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
      <div class="flex items-center justify-between p-3.5 rounded-2xl bg-[#0E3B2E] border border-[#1F6F54]/50 hover:border-slate-700 transition-all">
        <div class="flex items-center space-x-3">
          <div class="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300 font-bold text-xs">
            ${c.institucion.slice(0, 3)}
          </div>
          <div>
            <h4 class="text-xs font-bold text-white">${c.nombre}</h4>
            <span class="text-[10px] px-2 py-0.5 rounded-md bg-[#071711] text-[#D7E7DD] uppercase tracking-wider font-semibold">${c.tipo.replace('_', ' ')}</span>
          </div>
        </div>
        <div class="text-right">
          <span class="text-xs font-black ${isNegative ? 'text-rose-400' : 'text-[#F6FBF7]'}">${formatted}</span>
          ${isUSD ? `<span class="block text-[10px] text-[#A3C4B2]">~ ${formatPEN(Number(c.saldo_actual) * state.tc)}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// Render Metas de Ahorro
function renderMetas() {
  const container = document.getElementById('list-metas');
  const countEl = document.getElementById('count-metas');
  if (countEl) countEl.innerText = `${state.metas.length} ${state.metas.length === 1 ? 'meta' : 'metas'}`;
  if (!container) return;

  if (state.metas.length === 0) {
    container.innerHTML = `
      <div class="text-center py-6 px-4 rounded-2xl bg-[#071711] border border-dashed border-[#1F6F54]/60 space-y-2">
        <p class="text-xs text-[#D7E7DD]">Aún no has definido proyectos o metas de ahorro (ej: Fondo de Emergencia, Vacaciones, etc.).</p>
        <button onclick="document.getElementById('modal-meta').classList.remove('hidden')" class="px-3.5 py-1.5 rounded-xl bg-[#1F6F54]/40 text-[#5FB88A] border border-[#5FB88A]/30 text-xs font-bold hover:bg-indigo-500/20">
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
      <div class="p-4 rounded-2xl bg-[#0E3B2E] border border-[#1F6F54]/50 space-y-3">
        <div class="flex justify-between items-start">
          <div class="flex items-center space-x-2.5">
            <div class="w-8 h-8 rounded-xl bg-indigo-500/10 text-[#5FB88A] flex items-center justify-center font-bold text-sm">
              🎯
            </div>
            <div>
              <h4 class="text-xs font-bold text-white">${m.nombre}</h4>
              <p class="text-[10px] text-[#D7E7DD]">${m.notas || 'Sin notas'}</p>
            </div>
          </div>
          <span class="text-xs font-extrabold px-2 py-0.5 rounded-lg bg-[#1F6F54]/40 text-[#5FB88A] border border-[#5FB88A]/30">
            ${pct}%
          </span>
        </div>

        <div class="space-y-1">
          <div class="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden p-0.5 border border-slate-800">
            <div class="bg-gradient-to-r from-[#1F6F54] to-[#5FB88A] h-1.5 rounded-full transition-all duration-500" style="width: ${pct}%"></div>
          </div>
          <div class="flex justify-between text-[11px] font-bold">
            <span class="text-[#5FB88A]">${formatPEN(act)}</span>
            <span class="text-[#D7E7DD]">Meta: ${formatPEN(obj)}</span>
          </div>
        </div>

        ${consejoFecha ? `<p class="text-[10px] text-[#D7E7DD] bg-indigo-500/5 p-2 rounded-xl border border-indigo-500/10">${consejoFecha}</p>` : ''}

        <div class="flex items-center justify-between pt-1 border-t border-slate-800/60">
          <span class="text-[10px] text-[#D7E7DD]">Faltan: <strong class="text-white">${formatPEN(restante)}</strong></span>
          <div class="flex items-center gap-1.5">
            <button onclick="openModalAporte('${m.id}', '${m.nombre}')" class="px-3 py-1 rounded-xl bg-[#1F6F54]/40 text-[#5FB88A] border border-[#5FB88A]/30 hover:bg-emerald-500/20 text-[11px] font-bold active:scale-95 transition-all">
              + Aportar
            </button>
            <button onclick="deleteMeta('${m.id}')" class="p-1 rounded-xl text-[#A3C4B2] hover:text-rose-400 active:scale-95 transition-all" title="Eliminar meta">
              ✕
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}


// Render Prestamos
function renderPrestamos() {
  const container = document.getElementById('list-prestamos');
  document.getElementById('count-prestamos').innerText = `${state.prestamos.length} deudores`;
  if (!container) return;

  if (state.prestamos.length === 0) {
    container.innerHTML = `
      <div class="text-center py-6 px-4 rounded-2xl bg-[#071711] border border-dashed border-[#1F6F54]/60 space-y-2">
        <p class="text-xs text-[#D7E7DD]">No tienes préstamos registrados en tu cartera.</p>
        <button onclick="document.getElementById('modal-prestamo').classList.remove('hidden')" class="px-3.5 py-1.5 rounded-xl bg-[#1F6F54]/40 text-[#5FB88A] border border-[#5FB88A]/30 text-xs font-bold hover:bg-indigo-500/20">
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
      <div class="p-4 rounded-2xl bg-[#0E3B2E] border border-[#1F6F54]/50 space-y-2.5">
        <div class="flex justify-between items-start">
          <div>
            <h4 class="text-sm font-bold text-white flex items-center gap-2">
              ${p.deudor}
              <span class="text-[10px] px-2 py-0.5 rounded-full ${isPendiente ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-emerald-500/10 text-[#5FB88A]'} font-semibold">
                ${p.estado}
              </span>
            </h4>
            <p class="text-[11px] text-[#D7E7DD]">${p.notas || 'Sin notas'}</p>
          </div>
          <div class="text-right">
            <span class="text-sm font-black text-white">${formatPEN(capital)}</span>
            <span class="block text-[10px] text-[#5FB88A] font-semibold">${(tasa * 100).toFixed(1)}% mensual</span>
          </div>
        </div>
        <div class="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
          <span class="text-[#D7E7DD]">Rinde: <strong class="text-[#5FB88A] font-bold">${formatPEN(interesMensual)}/mes</strong></span>
        </div>
      </div>
    `;
  }).join('');

  document.getElementById('loans-total-capital').innerText = formatPEN(totalCapital);
  document.getElementById('loans-monthly-interest').innerText = `${formatPEN(totalInteres)}/mes`;
}

// Render Transacciones
function renderTransacciones() {
  const container = document.getElementById('list-transacciones');
  document.getElementById('count-tx').innerText = `${state.transacciones.length} registros`;
  if (!container) return;

  if (state.transacciones.length === 0) {
    container.innerHTML = `<div class="text-center py-8 text-xs text-[#A3C4B2]">No hay movimientos registrados todavía.</div>`;
    return;
  }

  container.innerHTML = state.transacciones.map(t => {
    const isGasto = t.tipo === 'gasto';
    const cuentaNombre = t.cuentas ? t.cuentas.nombre : 'Cuenta';
    const catNombre = t.categorias ? t.categorias.nombre : 'General';
    const isApplePay = t.metodo_pago === 'apple_pay';

    return `
      <div class="flex items-center justify-between p-3.5 rounded-2xl bg-[#0E3B2E] border border-[#1F6F54]/50">
        <div class="flex items-center space-x-3">
          <div class="w-10 h-10 rounded-xl ${isGasto ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-[#5FB88A]'} flex items-center justify-center font-bold text-xs">
            ${isApplePay ? '<i data-lucide="smartphone" class="w-4 h-4"></i>' : (isGasto ? '<i data-lucide="arrow-down-right" class="w-4 h-4"></i>' : '<i data-lucide="arrow-up-right" class="w-4 h-4"></i>')}
          </div>
          <div>
            <h4 class="text-xs font-bold text-white">${t.comercio || t.descripcion || catNombre}</h4>
            <div class="flex items-center gap-1.5 text-[10px] text-[#D7E7DD]">
              <span>${catNombre}</span>
              <span>•</span>
              <span class="text-[#A3C4B2]">${t.fecha}</span>
            </div>
          </div>
        </div>
        <div class="text-right">
          <span class="text-xs font-black ${isGasto ? 'text-rose-400' : 'text-[#5FB88A]'}">
            ${isGasto ? '-' : '+'}${formatPEN(t.monto)}
          </span>
          <span class="block text-[10px] text-[#A3C4B2]">${cuentaNombre}</span>
        </div>
      </div>
    `;
  }).join('');
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
}

function setupNavigation() {
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const targetView = tab.dataset.view;
      document.querySelectorAll('.tab-view').forEach(view => view.classList.add('hidden'));
      const activeSec = document.getElementById(`view-${targetView}`);
      if (activeSec) activeSec.classList.remove('hidden');

      document.querySelectorAll('.nav-tab').forEach(t => {
        t.classList.remove('text-[#5FB88A]');
        t.classList.add('text-[#D7E7DD]');
      });
      tab.classList.remove('text-[#D7E7DD]');
      tab.classList.add('text-[#5FB88A]');

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

  const openTx = (tipo = 'gasto') => {
    state.tipoTx = tipo;
    
    [tabGasto, tabIngreso, tabTransfer].forEach(t => {
      if (t) t.className = 'py-2 text-[11px] font-bold rounded-xl text-[#D7E7DD] hover:text-white transition-all';
    });

    const inputComercio = document.getElementById('input-comercio');

    if (tipo === 'gasto') {
      tabGasto.className = 'py-2 text-[11px] font-bold rounded-xl bg-rose-500 text-white transition-all';
      if (boxCuentaDest) boxCuentaDest.classList.add('hidden');
      if (boxCat) boxCat.classList.remove('hidden');
      if (labelComercio) labelComercio.innerText = 'Comercio / Detalle';
      if (inputComercio) inputComercio.placeholder = 'Ej: Supermercado, Restaurante, Farmacia, Transporte';
      if (labelCtaOrigen) labelCtaOrigen.innerText = 'Cuenta / Tarjeta (De donde sale)';
      if (btnSubmitTx) btnSubmitTx.innerText = 'Guardar Gasto';
    } else if (tipo === 'ingreso') {
      tabIngreso.className = 'py-2 text-[11px] font-bold rounded-xl bg-[#5FB88A] text-[#0E3B2E] font-black transition-all';
      if (boxCuentaDest) boxCuentaDest.classList.add('hidden');
      if (boxCat) boxCat.classList.remove('hidden');
      if (labelComercio) labelComercio.innerText = 'Origen / Concepto';
      if (inputComercio) inputComercio.placeholder = 'Ej: Sueldo mensual, Bono, Venta, Honorarios';
      if (labelCtaOrigen) labelCtaOrigen.innerText = 'Cuenta Destino (A donde ingresa)';
      if (btnSubmitTx) btnSubmitTx.innerText = 'Guardar Ingreso';
    } else if (tipo === 'transferencia') {
      tabTransfer.className = 'py-2 text-[11px] font-bold rounded-xl bg-[#1F6F54] text-[#F6FBF7] font-bold border border-[#5FB88A]/40 transition-all';
      if (boxCuentaDest) boxCuentaDest.classList.remove('hidden');
      if (boxCat) boxCat.classList.add('hidden');
      if (labelComercio) labelComercio.innerText = 'Detalle de la Inversión / Movimiento';
      if (inputComercio) inputComercio.placeholder = 'Ej: Depósito a Plazo, Aporte a Fondo Mutuo, Compra Acciones';
      if (labelCtaOrigen) labelCtaOrigen.innerText = 'Cuenta Origen (De donde sale)';
      if (btnSubmitTx) btnSubmitTx.innerText = 'Confirmar Transferencia / Inversión';
    }

    populateDropdowns();
    modalTx.classList.remove('hidden');
    document.getElementById('input-monto').focus();
  };

  const btnQuickInvest = document.getElementById('btn-quick-invest');
  if (btnFloating) btnFloating.onclick = () => openTx('gasto');
  if (btnQuickExp) btnQuickExp.onclick = () => openTx('gasto');
  if (btnQuickInc) btnQuickInc.onclick = () => openTx('ingreso');
  if (btnQuickInvest) btnQuickInvest.onclick = () => openTx('transferencia');

  if (tabGasto) tabGasto.onclick = () => openTx('gasto');
  if (tabIngreso) tabIngreso.onclick = () => openTx('ingreso');
  if (tabTransfer) tabTransfer.onclick = () => openTx('transferencia');

  if (btnOpenCta) btnOpenCta.onclick = () => modalCta.classList.remove('hidden');
  if (btnQuickAddCta) btnQuickAddCta.onclick = () => modalCta.classList.remove('hidden');
  if (btnOpenLoan) btnOpenLoan.onclick = () => modalLoan.classList.remove('hidden');

  document.getElementById('btn-close-modal-tx').onclick = () => modalTx.classList.add('hidden');
  document.getElementById('btn-close-modal-cuenta').onclick = () => modalCta.classList.add('hidden');
  document.getElementById('btn-close-modal-prestamo').onclick = () => modalLoan.classList.add('hidden');

  const formTx = document.getElementById('form-tx');
  if (formTx) {
    formTx.onsubmit = async (e) => {
      e.preventDefault();
      const monto = parseFloat(document.getElementById('input-monto').value);
      const comercio = document.getElementById('input-comercio').value;
      const cuentaId = document.getElementById('select-cuenta').value || null;
      const catId = document.getElementById('select-categoria').value || null;
      const btn = document.getElementById('btn-submit-tx');

      btn.disabled = true;
      btn.innerText = 'Guardando...';

      if (state.tipoTx === 'transferencia') {
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
      const newCta = {
        nombre, institucion, tipo, moneda, saldo_actual: saldo, user_id: state.user.id
      };

      const { error } = await db.from('cuentas').insert([newCta]);
      btn.disabled = false;

      if (error) {
        alert('Error: ' + error.message);
      } else {
        modalCta.classList.add('hidden');
        formCta.reset();
        if (boxCustomInst) boxCustomInst.classList.add('hidden');
        await loadUserData();
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

