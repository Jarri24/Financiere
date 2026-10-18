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

  const [ctasRes, catsRes, loansRes, txRes] = await Promise.all([
    db.from('cuentas').select('*').order('saldo_actual', { ascending: false }),
    db.from('categorias').select('*').order('nombre'),
    db.from('prestamos').select('*').order('created_at', { ascending: false }),
    db.from('transacciones').select('*, cuentas(nombre), categorias(nombre)').order('fecha', { ascending: false }).limit(25)
  ]);

  if (ctasRes.data) state.cuentas = ctasRes.data;
  if (catsRes.data) state.categorias = catsRes.data;
  if (loansRes.data) state.prestamos = loansRes.data;
  if (txRes.data) state.transacciones = txRes.data;

  renderDashboard();
  renderCuentas();
  renderPrestamos();
  renderTransacciones();
  populateDropdowns();
  if (window.lucide) lucide.createIcons();
}

function renderDashboard() {
  let totalPEN = 0;
  let loansPEN = 0;

  state.cuentas.forEach(c => {
    const val = Number(c.saldo_actual || 0);
    const converted = c.moneda === 'USD' ? val * state.tc : val;
    totalPEN += converted;
  });

  state.prestamos.forEach(p => {
    if (p.estado === 'Pendiente') {
      loansPEN += Number(p.monto_prestado || 0);
    }
  });

  const grandTotal = totalPEN + loansPEN;
  const grandUSD = grandTotal / state.tc;

  document.getElementById('kpi-patrimonio').innerText = formatPEN(grandTotal);
  document.getElementById('kpi-patrimonio-usd').innerText = `(${formatUSD(grandUSD)} USD)`;
  document.getElementById('kpi-inversiones').innerText = formatPEN(totalPEN);
  document.getElementById('kpi-prestamos-total').innerText = formatPEN(loansPEN);
}

// Render Cuentas
function renderCuentas() {
  const container = document.getElementById('list-cuentas');
  document.getElementById('count-cuentas').innerText = `${state.cuentas.length} cuentas`;
  if (!container) return;

  if (state.cuentas.length === 0) {
    container.innerHTML = `
      <div class="text-center py-6 px-4 rounded-2xl bg-slate-950/40 border border-dashed border-slate-800 space-y-2">
        <p class="text-xs text-slate-400">Aún no has registrado ninguna cuenta bancaria o tarjeta.</p>
        <button onclick="document.getElementById('modal-cuenta').classList.remove('hidden')" class="px-3.5 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold hover:bg-emerald-500/20">
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
      <div class="flex items-center justify-between p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition-all">
        <div class="flex items-center space-x-3">
          <div class="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300 font-bold text-xs">
            ${c.institucion.slice(0, 3)}
          </div>
          <div>
            <h4 class="text-xs font-bold text-white">${c.nombre}</h4>
            <span class="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 uppercase tracking-wider font-semibold">${c.tipo.replace('_', ' ')}</span>
          </div>
        </div>
        <div class="text-right">
          <span class="text-xs font-black ${isNegative ? 'text-rose-400' : 'text-slate-100'}">${formatted}</span>
          ${isUSD ? `<span class="block text-[10px] text-slate-500">~ ${formatPEN(Number(c.saldo_actual) * state.tc)}</span>` : ''}
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
      <div class="text-center py-6 px-4 rounded-2xl bg-slate-950/40 border border-dashed border-slate-800 space-y-2">
        <p class="text-xs text-slate-400">No tienes préstamos registrados en tu cartera.</p>
        <button onclick="document.getElementById('modal-prestamo').classList.remove('hidden')" class="px-3.5 py-1.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-bold hover:bg-indigo-500/20">
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
      <div class="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5">
        <div class="flex justify-between items-start">
          <div>
            <h4 class="text-sm font-bold text-white flex items-center gap-2">
              ${p.deudor}
              <span class="text-[10px] px-2 py-0.5 rounded-full ${isPendiente ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400'} font-semibold">
                ${p.estado}
              </span>
            </h4>
            <p class="text-[11px] text-slate-400">${p.notas || 'Sin notas'}</p>
          </div>
          <div class="text-right">
            <span class="text-sm font-black text-white">${formatPEN(capital)}</span>
            <span class="block text-[10px] text-indigo-400 font-semibold">${(tasa * 100).toFixed(1)}% mensual</span>
          </div>
        </div>
        <div class="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
          <span class="text-slate-400">Rinde: <strong class="text-emerald-400 font-bold">${formatPEN(interesMensual)}/mes</strong></span>
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
    container.innerHTML = `<div class="text-center py-8 text-xs text-slate-500">No hay movimientos registrados todavía.</div>`;
    return;
  }

  container.innerHTML = state.transacciones.map(t => {
    const isGasto = t.tipo === 'gasto';
    const cuentaNombre = t.cuentas ? t.cuentas.nombre : 'Cuenta';
    const catNombre = t.categorias ? t.categorias.nombre : 'General';
    const isApplePay = t.metodo_pago === 'apple_pay';

    return `
      <div class="flex items-center justify-between p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
        <div class="flex items-center space-x-3">
          <div class="w-10 h-10 rounded-xl ${isGasto ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'} flex items-center justify-center font-bold text-xs">
            ${isApplePay ? '<i data-lucide="smartphone" class="w-4 h-4"></i>' : (isGasto ? '<i data-lucide="arrow-down-right" class="w-4 h-4"></i>' : '<i data-lucide="arrow-up-right" class="w-4 h-4"></i>')}
          </div>
          <div>
            <h4 class="text-xs font-bold text-white">${t.comercio || t.descripcion || catNombre}</h4>
            <div class="flex items-center gap-1.5 text-[10px] text-slate-400">
              <span>${catNombre}</span>
              <span>•</span>
              <span class="text-slate-500">${t.fecha}</span>
            </div>
          </div>
        </div>
        <div class="text-right">
          <span class="text-xs font-black ${isGasto ? 'text-rose-400' : 'text-emerald-400'}">
            ${isGasto ? '-' : '+'}${formatPEN(t.monto)}
          </span>
          <span class="block text-[10px] text-slate-500">${cuentaNombre}</span>
        </div>
      </div>
    `;
  }).join('');
}

function populateDropdowns() {
  const selCta = document.getElementById('select-cuenta');
  const selCat = document.getElementById('select-categoria');
  if (selCta) {
    if (state.cuentas.length === 0) {
      selCta.innerHTML = '<option value="">+ Ninguna cuenta creada</option>';
    } else {
      selCta.innerHTML = state.cuentas.map(c => `<option value="${c.id}">${c.nombre} (${c.moneda})</option>`).join('');
    }
  }
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
        t.classList.remove('text-emerald-400');
        t.classList.add('text-slate-400');
      });
      tab.classList.remove('text-slate-400');
      tab.classList.add('text-emerald-400');

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

  const openTx = (tipo = 'gasto') => {
    state.tipoTx = tipo;
    if (tipo === 'gasto') {
      tabGasto.className = 'py-2 text-xs font-bold rounded-xl bg-rose-500 text-white transition-all';
      tabIngreso.className = 'py-2 text-xs font-bold rounded-xl text-slate-400 hover:text-white transition-all';
    } else {
      tabIngreso.className = 'py-2 text-xs font-bold rounded-xl bg-emerald-500 text-white transition-all';
      tabGasto.className = 'py-2 text-xs font-bold rounded-xl text-slate-400 hover:text-white transition-all';
    }
    populateDropdowns();
    modalTx.classList.remove('hidden');
    document.getElementById('input-monto').focus();
  };

  if (btnFloating) btnFloating.onclick = () => openTx('gasto');
  if (btnQuickExp) btnQuickExp.onclick = () => openTx('gasto');
  if (btnQuickInc) btnQuickInc.onclick = () => openTx('ingreso');

  if (tabGasto) tabGasto.onclick = () => { state.tipoTx = 'gasto'; openTx('gasto'); };
  if (tabIngreso) tabIngreso.onclick = () => { state.tipoTx = 'ingreso'; openTx('ingreso'); };

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
      btn.disabled = false;
      btn.innerText = 'Guardar Movimiento';

      if (error) {
        alert('Error: ' + error.message);
      } else {
        modalTx.classList.add('hidden');
        formTx.reset();
        await loadUserData();
      }
    };
  }

  const formCta = document.getElementById('form-cuenta');
  if (formCta) {
    formCta.onsubmit = async (e) => {
      e.preventDefault();
      const nombre = document.getElementById('cta-nombre').value.trim();
      const institucion = document.getElementById('cta-institucion').value;
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
          "comercio": "Plaza Vea",
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
}
