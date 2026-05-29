/* ═══════════════════════════════════════════════
   SISTEMA DE RESERVAS — app.js
   Landing + Admin + Cliente
═══════════════════════════════════════════════ */

// ── SUPABASE ──────────────────────────────────
const SUPABASE_URL = 'https://xyixjhmvqbawcbrlrykt.supabase.co';
const SUPABASE_KEY = 'sb_publishable_DsdqmSdR3sLG8PoQUScchA_-Tuo3WWo';
const { createClient } = window.supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── ESTADO ────────────────────────────────────
let state = { user: null, role: null, section: 'dashboard' };
window._mesaSel = null;

// ── HISTORIAL DEL NAVEGADOR ───────────────────
let _navFromPop = false;
let _firstNav   = true;

function _push(pg) {
  if (_navFromPop) return;
  if (_firstNav) {
    history.replaceState({ pg }, '', '#' + pg.replace(':', '/'));
    _firstNav = false;
  } else {
    history.pushState({ pg }, '', '#' + pg.replace(':', '/'));
  }
}

window.addEventListener('popstate', e => {
  _navFromPop = true;
  const pg = e.state?.pg || 'landing';
  if      (pg === 'landing')               showLanding();
  else if (pg === 'login')                 showLogin();
  else if (pg === 'register')              showRegister();
  else if (pg.startsWith('admin:'))        { if (state.user && state.role === 'admin')   showAdmin(pg.slice(6));   else showLogin(); }
  else if (pg.startsWith('cliente:'))      { if (state.user && state.role === 'cliente') showCliente(pg.slice(8)); else showLogin(); }
  else                                     showLanding();
  _navFromPop = false;
});

// ── EMAILJS ───────────────────────────────────
const EMAILJS_PK       = 'f3dAF_Rr6MtkZ7bj_';
const EMAILJS_SERVICE  = 'service_qrq17ia';
const EMAILJS_TEMPLATE = 'template_kmkmzfy';

function initEmailJS() {
  if (window.emailjs) emailjs.init({ publicKey: EMAILJS_PK });
}

async function enviarEmailReserva(correo, nombre, { id = '', fecha, hora, mesa, personas, estado }) {
  if (!window.emailjs || EMAILJS_PK === 'TU_PUBLIC_KEY') return; // aún no configurado
  try {
    await emailjs.send(EMAILJS_SERVICE, EMAILJS_TEMPLATE, {
      to_email:         correo,
      to_name:          nombre,
      reserva_id:       id,
      reserva_fecha:    fecha,
      reserva_hora:     String(hora).substring(0, 5),
      reserva_mesa:     mesa,
      reserva_personas: personas,
      reserva_estado:   estado,
    });
  } catch (err) {
    console.warn('EmailJS:', err);
  }
}

// ── UTILIDADES ────────────────────────────────
async function hashPassword(pwd) {
  const data = new TextEncoder().encode(pwd);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function showToast(msg, type = 'success') {
  const icons = { success: 'fa-check-circle', error: 'fa-times-circle', info: 'fa-info-circle' };
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<i class="fas ${icons[type]}"></i><span>${msg}</span>`;
  document.getElementById('toast-container').appendChild(t);
  setTimeout(() => { t.classList.add('fade-out'); setTimeout(() => t.remove(), 300); }, 3000);
}

function getInitial(name) { return name ? name[0].toUpperCase() : '?'; }

function avatarGradient(id) {
  const gradients = [
    'linear-gradient(135deg,#C9A96E,#A07840)',
    'linear-gradient(135deg,#A07840,#7A5830)',
    'linear-gradient(135deg,#D4AF37,#B8860B)',
    'linear-gradient(135deg,#CD853F,#8B6914)',
  ];
  return gradients[id % gradients.length];
}

function openModal(html) {
  const o = document.createElement('div');
  o.className = 'modal-overlay';
  o.id = 'modal-overlay';
  o.innerHTML = `<div class="modal">${html}</div>`;
  o.addEventListener('click', e => { if (e.target === o) closeModal(); });
  document.body.appendChild(o);
  document.querySelectorAll('#modal-overlay .inp').forEach(applyInputStyle);
}

function closeModal() { document.getElementById('modal-overlay')?.remove(); }

function applyInputStyle(el) {
  el.style.cssText = `
    width:100%;padding:11px 14px;
    background:var(--bg-card2);border:1px solid var(--border);
    border-radius:8px;font-size:13px;color:var(--text);
    font-family:'Inter',sans-serif;outline:none;transition:border-color 0.2s;
  `;
  el.onfocus = () => el.style.borderColor = 'var(--gold)';
  el.onblur  = () => el.style.borderColor = 'var(--border)';
}

function showLoading(id) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = `<div class="loading"><div class="spinner"></div> Cargando...</div>`;
}

// ── SINCRONIZACIÓN AUTOMÁTICA DE MESAS ────────
async function sincronizarMesas() {
  const ahora    = new Date();
  const fecha    = ahora.toISOString().split('T')[0];
  const horaActual = `${String(ahora.getHours()).padStart(2,'0')}:00`;

  // Mesas con reserva confirmada exactamente en este momento
  const { data: activas } = await db
    .from('reservas')
    .select('id_mesa')
    .eq('fecha', fecha)
    .eq('hora', horaActual)
    .eq('estado_reserva', 'confirmada');

  const idsOcupadas = (activas || []).map(r => r.id_mesa);

  // Marcar como ocupadas
  if (idsOcupadas.length > 0) {
    await db.from('mesas').update({ estado: 'ocupada' }).in('id_mesa', idsOcupadas);
  }

  // Marcar como disponibles todas las que NO tienen reserva ahora
  const { data: todas } = await db.from('mesas').select('id_mesa');
  const idsDisponibles = (todas || []).map(m => m.id_mesa).filter(id => !idsOcupadas.includes(id));

  if (idsDisponibles.length > 0) {
    await db.from('mesas').update({ estado: 'disponible' }).in('id_mesa', idsDisponibles);
  }
}

// Correr la sincronización cada 5 minutos mientras el admin está en la app
setInterval(sincronizarMesas, 5 * 60 * 1000);

function initFlatpickr(id, extra = {}) {
  const el = document.getElementById(id);
  if (!el || !window.flatpickr) return;
  flatpickr(el, {
    locale: 'es',
    dateFormat: 'Y-m-d',
    minDate: extra.minDate !== undefined ? extra.minDate : 'today',
    maxDate: extra.maxDate !== undefined ? extra.maxDate : new Date(new Date().setMonth(new Date().getMonth() + 3)),
    disableMobile: false,
    allowInput: false,
    ...extra
  });
}

// ═══════════════════════════════════════════════
// LANDING PAGE
// ═══════════════════════════════════════════════
function showLanding() {
  _push('landing');
  document.getElementById('app').innerHTML = `

    <!-- NAVBAR -->
    <nav class="land-nav" id="land-nav">
      <div class="nav-logo">
        <i class="fas fa-utensils"></i>
        Restaurante
      </div>
      <ul class="nav-links">
        <li><a href="#hero">Inicio</a></li>
        <li><a href="#menu">Menú</a></li>
        <li><a href="#features">Características</a></li>
        <li><a href="#about">Nosotros</a></li>
        <li><a href="#contact">Contacto</a></li>
      </ul>
      <div class="nav-btns">
        <button class="btn btn-outline-gold" onclick="showLogin()">Iniciar Sesión</button>
        <button class="btn btn-gold" onclick="showRegister()">Registrarse</button>
      </div>
    </nav>

    <!-- HERO -->
    <section class="hero" id="hero">
      <div class="hero-bg"></div>
      <div class="hero-overlay"></div>
      <div class="hero-content">
        <div class="hero-tag">
          <i class="fas fa-star"></i>
          Experiencia Gastronómica Única
        </div>
        <h1 class="hero-title">
          El Arte de la<br/><span>Buena Mesa</span>
        </h1>
        <p class="hero-desc">
          Descubre los sabores más exclusivos en un ambiente elegante y acogedor.
          Reserva tu mesa en segundos y disfruta de una experiencia inolvidable.
        </p>
        <div class="hero-btns">
          <button class="btn btn-gold btn-lg" onclick="showRegister()">
            <i class="fas fa-calendar-check"></i>
            Reservar Ahora
          </button>
          <a href="#menu" class="btn btn-outline-gold btn-lg">
            <i class="fas fa-book-open"></i>
            Ver Menú
          </a>
        </div>
      </div>
    </section>

    <!-- STATS BAR -->
    <div class="stats-bar">
      <div class="stat-item">
        <span class="num">500+</span>
        <span class="lbl">Clientes Felices</span>
      </div>
      <div class="stat-item">
        <span class="num">15+</span>
        <span class="lbl">Años de Experiencia</span>
      </div>
      <div class="stat-item">
        <span class="num">4.9</span>
        <span class="lbl">Calificación</span>
      </div>
      <div class="stat-item">
        <span class="num">30+</span>
        <span class="lbl">Platos Exclusivos</span>
      </div>
    </div>

    <!-- MENU -->
    <section class="menu-section section-full" id="menu">
      <div class="section" style="padding:80px 60px">
        <div style="text-align:center;margin-bottom:16px">
          <div class="section-tag" style="justify-content:center">
            <span>Nuestro Menú</span>
          </div>
          <h2 class="section-title">Especialidades de la Casa</h2>
          <p class="section-sub" style="margin:0 auto">
            Los mejores platillos preparados con ingredientes frescos y pasión por la gastronomía
          </p>
        </div>
        <div class="menu-grid">
          <div class="menu-card animate">
            <div class="menu-card-img">
              <img class="menu-img" src="https://images.unsplash.com/photo-1559847844-5315695dadae?w=500&q=80" alt="Ceviche"/>
              <span class="menu-badge">⭐ Más Pedido</span>
            </div>
            <div class="menu-body">
              <h3>Ceviche de Pescado</h3>
              <p>Pescado fresco marinado en limón, con cebolla morada, cilantro, ají y cancha serrana.</p>
              <div class="menu-footer">
                <span class="menu-price">$45.000</span>
                <button class="btn btn-outline-gold btn-sm" onclick="showRegister()">Ordenar</button>
              </div>
            </div>
          </div>
          <div class="menu-card animate" style="animation-delay:0.1s">
            <div class="menu-card-img">
              <img class="menu-img" src="https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=500&q=80" alt="Arroz"/>
              <span class="menu-badge">🔥 Popular</span>
            </div>
            <div class="menu-body">
              <h3>Arroz con Mariscos</h3>
              <p>Arroz premium con camarones, calamares, mejillones y pulpo, con salsa especial de la casa.</p>
              <div class="menu-footer">
                <span class="menu-price">$38.000</span>
                <button class="btn btn-outline-gold btn-sm" onclick="showRegister()">Ordenar</button>
              </div>
            </div>
          </div>
          <div class="menu-card animate" style="animation-delay:0.2s">
            <div class="menu-card-img">
              <img class="menu-img" src="https://images.unsplash.com/photo-1565299507177-b0ac66763828?w=500&q=80" alt="Parrilla"/>
              <span class="menu-badge">🌟 Especial</span>
            </div>
            <div class="menu-body">
              <h3>Parrillada Especial</h3>
              <p>Selección de cortes premium a la parrilla con guarniciones de temporada y salsas artesanales.</p>
              <div class="menu-footer">
                <span class="menu-price">$65.000</span>
                <button class="btn btn-outline-gold btn-sm" onclick="showRegister()">Ordenar</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- FEATURES -->
    <section id="features">
      <div class="section" style="text-align:center">
        <div class="section-tag" style="justify-content:center"><span>Características</span></div>
        <h2 class="section-title">¿Por qué elegirnos?</h2>
        <p class="section-sub" style="margin:0 auto 0">Ofrecemos la mejor experiencia en reservas de restaurantes</p>
        <div class="features-grid">
          <div class="feature-card animate">
            <div class="feature-icon"><i class="fas fa-bolt"></i></div>
            <h3>Reservas Rápidas</h3>
            <p>Realiza tus reservas en menos de 30 segundos desde cualquier dispositivo.</p>
          </div>
          <div class="feature-card animate" style="animation-delay:0.1s">
            <div class="feature-icon"><i class="fas fa-bell"></i></div>
            <h3>Notificaciones</h3>
            <p>Recibe confirmaciones y recordatorios automáticos de tus reservas.</p>
          </div>
          <div class="feature-card animate" style="animation-delay:0.2s">
            <div class="feature-icon"><i class="fas fa-chart-bar"></i></div>
            <h3>Panel Completo</h3>
            <p>Gestión administrativa completa de mesas, clientes y reservas.</p>
          </div>
          <div class="feature-card animate" style="animation-delay:0.3s">
            <div class="feature-icon"><i class="fas fa-clock"></i></div>
            <h3>Disponibilidad 24/7</h3>
            <p>Consulta disponibilidad en tiempo real las 24 horas del día.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- ABOUT -->
    <section id="about" style="background:var(--bg-alt);padding:100px 0">
      <div class="section" style="padding:0 60px">
        <div class="about-grid">
          <div class="about-text">
            <div class="section-tag" style="justify-content:flex-start">
              <span>Nosotros</span>
            </div>
            <h2 class="section-title" style="margin-bottom:16px">
              Más que un restaurante,<br/>una experiencia única
            </h2>
            <p style="font-size:15px;color:var(--text-soft);line-height:1.8;margin-bottom:24px">
              Con más de 15 años en la industria gastronómica, nos especializamos en
              ofrecer los mejores platillos con un toque de innovación y tradición.
              Cada plato es una obra de arte preparada con los mejores ingredientes.
            </p>
            <ul class="about-list">
              <li><i class="fas fa-award"></i> Chefs con reconocimiento internacional</li>
              <li><i class="fas fa-leaf"></i> Ingredientes frescos y locales</li>
              <li><i class="fas fa-glass-cheers"></i> Ambiente elegante y acogedor</li>
              <li><i class="fas fa-star"></i> Calificación 4.9/5 por nuestros clientes</li>
            </ul>
            <div style="margin-top:32px">
              <button class="btn btn-gold btn-lg" onclick="showRegister()">
                <i class="fas fa-calendar-plus"></i>
                Haz tu reserva
              </button>
            </div>
          </div>
          <div class="about-img-wrap">
            <img src="https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=700&q=80" alt="Restaurante"/>
            <div class="about-badge">
              <div class="num">15+</div>
              <div class="lbl">Años de experiencia</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- CONTACT -->
    <section id="contact" class="contact-section section-full" style="padding:100px 0">
      <div class="section" style="padding:0 60px">
        <div style="text-align:center;margin-bottom:16px">
          <div class="section-tag" style="justify-content:center"><span>Contacto</span></div>
          <h2 class="section-title">¿Tienes alguna pregunta?</h2>
          <p class="section-sub" style="margin:0 auto">Contáctanos y te atenderemos a la brevedad posible</p>
        </div>
        <div class="contact-grid">
          <div class="contact-info">
            <h3>Información de contacto</h3>
            <div class="contact-item">
              <div class="contact-item-icon"><i class="fas fa-map-marker-alt"></i></div>
              <div class="contact-item-text">
                <p>Cra. 45 #123-45, Barranquilla</p>
                <span>Colombia</span>
              </div>
            </div>
            <div class="contact-item">
              <div class="contact-item-icon"><i class="fas fa-phone"></i></div>
              <div class="contact-item-text">
                <p>+57 300 123 4567</p>
                <span>Lunes a Domingo: 9am - 10pm</span>
              </div>
            </div>
            <div class="contact-item">
              <div class="contact-item-icon"><i class="fas fa-envelope"></i></div>
              <div class="contact-item-text">
                <p>info@restaurante.com</p>
                <span>Respondemos en menos de 24 horas</span>
              </div>
            </div>
          </div>
          <form class="contact-form" onsubmit="event.preventDefault();showToast('Mensaje enviado. Te contactaremos pronto.','success')">
            <div class="form-group" style="margin-bottom:0">
              <label>Nombre</label>
              <input type="text" class="inp" placeholder="Tu nombre" required />
            </div>
            <div class="form-group" style="margin-bottom:0">
              <label>Correo</label>
              <input type="email" class="inp" placeholder="correo@ejemplo.com" required />
            </div>
            <div class="form-group" style="margin-bottom:0">
              <label>Mensaje</label>
              <textarea class="inp" rows="4" placeholder="Escribe tu mensaje..." required style="resize:vertical;"></textarea>
            </div>
            <button type="submit" class="btn btn-gold btn-full">
              <i class="fas fa-paper-plane"></i> Enviar mensaje
            </button>
          </form>
        </div>
      </div>
    </section>

    <!-- FOOTER -->
    <footer class="footer">
      <div class="footer-grid">
        <div class="footer-brand">
          <div class="logo"><i class="fas fa-utensils" style="margin-right:8px"></i>Restaurante</div>
          <p>La mejor experiencia gastronómica en Barranquilla. Reserva tu mesa y disfruta de momentos únicos.</p>
        </div>
        <div class="footer-col">
          <h4>Navegación</h4>
          <ul>
            <li onclick="scrollToSection('hero')">Inicio</li>
            <li onclick="scrollToSection('menu')">Menú</li>
            <li onclick="scrollToSection('features')">Características</li>
            <li onclick="scrollToSection('about')">Nosotros</li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>Horario</h4>
          <ul>
            <li>Lunes a Viernes</li>
            <li>9:00am - 10:00pm</li>
            <li>Sábado y Domingo</li>
            <li>11:00am - 11:00pm</li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>Cuenta</h4>
          <ul>
            <li onclick="showLogin()">Iniciar sesión</li>
            <li onclick="showRegister()">Registrarse</li>
            <li onclick="scrollToSection('contact')">Contacto</li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <span>© 2026 Restaurante. Todos los derechos reservados.</span>
        <span>Hecho con <i class="fas fa-heart" style="color:var(--gold)"></i> en Barranquilla</span>
      </div>
    </footer>
  `;

  // Navbar scroll effect
  window.addEventListener('scroll', () => {
    const nav = document.getElementById('land-nav');
    if (nav) nav.classList.toggle('scrolled', window.scrollY > 60);
  });
}

function scrollToSection(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
}

// ═══════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════
function showLogin() {
  _push('login');
  document.getElementById('app').innerHTML = `
    <div class="auth-page">
      <div class="auth-left">
        <div class="auth-left-bg"></div>
        <div class="auth-left-overlay"></div>
        <div class="auth-left-content">
          <h2>Bienvenido de vuelta</h2>
          <p>Accede a tu cuenta para gestionar o consultar tus reservas.</p>
        </div>
      </div>
      <div class="auth-right">
        <div class="auth-card">
          <div class="auth-logo">
            <i class="fas fa-utensils"></i>
            Restaurante
          </div>
          <h1 class="auth-title">Iniciar Sesión</h1>
          <p class="auth-sub">Ingresa tus credenciales para continuar</p>

          <div class="form-group">
            <label>Correo electrónico</label>
            <input type="email" id="login-correo" class="inp" placeholder="correo@ejemplo.com"/>
          </div>
          <div class="form-group">
            <label>Contraseña</label>
            <input type="password" id="login-pwd" class="inp" placeholder="••••••••"/>
          </div>

          <div id="login-err" style="color:var(--error);font-size:13px;margin-bottom:12px;display:none;padding:10px 14px;background:rgba(239,83,80,0.08);border-radius:8px;border:1px solid rgba(239,83,80,0.2)"></div>

          <button class="btn btn-gold btn-full btn-lg" onclick="handleLogin()">
            <i class="fas fa-sign-in-alt"></i> Ingresar
          </button>

          <div class="auth-divider">o</div>

          <button onclick="handleGithubLogin()" style="display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:13px;background:#24292e;color:#fff;border:1px solid #444;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;transition:background 0.2s;font-family:'Inter',sans-serif;margin-bottom:16px" onmouseover="this.style.background='#1a1e22'" onmouseout="this.style.background='#24292e'">
            <i class="fab fa-github" style="font-size:18px"></i> Continuar con GitHub
          </button>

          <p style="text-align:center;font-size:13px;color:var(--text-soft)">
            ¿No tienes cuenta?
            <a href="#" onclick="showRegister()" style="color:var(--gold);font-weight:600"> Regístrate aquí</a>
          </p>
          <p style="text-align:center;font-size:13px;color:var(--text-soft);margin-top:8px">
            <a href="#" onclick="showLanding()" style="color:var(--text-soft)">
              <i class="fas fa-arrow-left" style="margin-right:4px"></i>Volver al inicio
            </a>
          </p>
        </div>
      </div>
    </div>
  `;
  document.querySelectorAll('.inp').forEach(applyInputStyle);
  document.getElementById('login-pwd').addEventListener('keydown', e => { if(e.key==='Enter') handleLogin(); });
}

function showRegister() {
  _push('register');
  document.getElementById('app').innerHTML = `
    <div class="auth-page">
      <div class="auth-left">
        <div class="auth-left-bg"></div>
        <div class="auth-left-overlay"></div>
        <div class="auth-left-content">
          <h2>Únete a nosotros</h2>
          <p>Crea tu cuenta y empieza a disfrutar de la mejor experiencia gastronómica.</p>
        </div>
      </div>
      <div class="auth-right">
        <div class="auth-card">
          <div class="auth-logo">
            <i class="fas fa-utensils"></i>
            Restaurante
          </div>
          <h1 class="auth-title">Crear Cuenta</h1>
          <p class="auth-sub">Regístrate para hacer reservas en línea</p>

          <div class="form-group">
            <label>Nombre completo</label>
            <input type="text" id="reg-nombre" class="inp" placeholder="Tu nombre completo"/>
          </div>
          <div class="form-group">
            <label>Correo electrónico</label>
            <input type="email" id="reg-correo" class="inp" placeholder="correo@ejemplo.com"/>
          </div>
          <div class="form-group">
            <label>Teléfono (opcional)</label>
            <input type="tel" id="reg-tel" class="inp" placeholder="3001234567" maxlength="10"/>
          </div>
          <div class="form-group">
            <label>Contraseña</label>
            <input type="password" id="reg-pwd" class="inp" placeholder="Mínimo 6 caracteres"/>
          </div>

          <div id="reg-err" style="color:var(--error);font-size:13px;margin-bottom:12px;display:none;padding:10px 14px;background:rgba(239,83,80,0.08);border-radius:8px;border:1px solid rgba(239,83,80,0.2)"></div>

          <button class="btn btn-gold btn-full btn-lg" onclick="handleRegister()">
            <i class="fas fa-user-plus"></i> Crear cuenta
          </button>

          <div class="auth-divider">o</div>

          <button onclick="handleGithubLogin()" style="display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:13px;background:#24292e;color:#fff;border:1px solid #444;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;transition:background 0.2s;font-family:'Inter',sans-serif;margin-bottom:16px" onmouseover="this.style.background='#1a1e22'" onmouseout="this.style.background='#24292e'">
            <i class="fab fa-github" style="font-size:18px"></i> Continuar con GitHub
          </button>

          <p style="text-align:center;font-size:13px;color:var(--text-soft)">
            ¿Ya tienes cuenta?
            <a href="#" onclick="showLogin()" style="color:var(--gold);font-weight:600"> Inicia sesión</a>
          </p>
          <p style="text-align:center;font-size:13px;color:var(--text-soft);margin-top:8px">
            <a href="#" onclick="showLanding()" style="color:var(--text-soft)">
              <i class="fas fa-arrow-left" style="margin-right:4px"></i>Volver al inicio
            </a>
          </p>
        </div>
      </div>
    </div>
  `;
  document.querySelectorAll('.inp').forEach(applyInputStyle);
}

async function handleLogin() {
  const correo = document.getElementById('login-correo').value.trim();
  const pwd    = document.getElementById('login-pwd').value;
  const errEl  = document.getElementById('login-err');

  if (!correo || !pwd) { errEl.textContent = 'Completa todos los campos.'; errEl.style.display='block'; return; }
  errEl.style.display = 'none';

  const hash = await hashPassword(pwd);

  const { data: admins } = await db.from('administradores').select('*').eq('correo', correo).eq('contrasena', hash);
  if (admins?.length > 0) { state.user = admins[0]; state.role = 'admin'; showAdmin(); return; }

  const { data: clientes } = await db.from('clientes').select('*').eq('correo', correo).eq('contrasena', hash);
  if (clientes?.length > 0) { state.user = clientes[0]; state.role = 'cliente'; showCliente(); return; }

  errEl.textContent = 'Correo o contraseña incorrectos.'; errEl.style.display='block';
}

async function handleRegister() {
  const nombre = document.getElementById('reg-nombre').value.trim();
  const correo = document.getElementById('reg-correo').value.trim();
  const tel    = document.getElementById('reg-tel').value.trim();
  const pwd    = document.getElementById('reg-pwd').value;
  const errEl  = document.getElementById('reg-err');

  if (!nombre || !correo || !pwd) { errEl.textContent = 'Nombre, correo y contraseña son obligatorios.'; errEl.style.display='block'; return; }
  if (!correo.includes('@')) { errEl.textContent = 'Correo inválido.'; errEl.style.display='block'; return; }
  if (pwd.length < 6) { errEl.textContent = 'Mínimo 6 caracteres en la contraseña.'; errEl.style.display='block'; return; }
  if (tel && !/^\d{10}$/.test(tel)) { errEl.textContent = 'El teléfono debe tener 10 dígitos.'; errEl.style.display='block'; return; }
  errEl.style.display='none';

  const { data: existe } = await db.from('clientes').select('id_cliente').eq('correo', correo);
  if (existe?.length > 0) { errEl.textContent = 'Este correo ya está registrado.'; errEl.style.display='block'; return; }

  const hash = await hashPassword(pwd);
  const { error } = await db.from('clientes').insert({ nombre_cliente: nombre, correo, telefono: tel||null, contrasena: hash });
  if (error) { errEl.textContent = 'Error al registrarse.'; errEl.style.display='block'; return; }

  showToast('¡Cuenta creada! Ya puedes iniciar sesión.', 'success');
  showLogin();
}

function logout() { state.user = null; state.role = null; showLanding(); }

// ── GITHUB OAuth ──────────────────────────────
async function handleGithubLogin() {
  const { error } = await db.auth.signInWithOAuth({
    provider: 'github',
    options: { redirectTo: window.location.origin }
  });
  if (error) showToast('Error al conectar con GitHub', 'error');
}

async function checkOAuthSession() {
  const { data: { session } } = await db.auth.getSession();
  if (!session?.user) return false;

  const email = session.user.email;
  if (!email) {
    await db.auth.signOut();
    showToast('Tu GitHub no tiene email público. Usa el login normal.', 'error');
    return false;
  }

  const nombre = session.user.user_metadata?.name ||
                 session.user.user_metadata?.user_name ||
                 email.split('@')[0];

  // Buscar en clientes
  const { data: found } = await db.from('clientes').select('*').eq('correo', email);

  let usuario;
  if (found?.length > 0) {
    usuario = found[0];
  } else {
    // Crear automáticamente
    const { data: nuevo } = await db.from('clientes')
      .insert({ nombre_cliente: nombre, correo: email, contrasena: await hashPassword(crypto.randomUUID()) })
      .select();
    usuario = nuevo?.[0];
    if (usuario) showToast('¡Cuenta creada con GitHub! 🎉', 'success');
  }

  await db.auth.signOut(); // limpiar sesión de Supabase Auth
  if (usuario) { state.user = usuario; state.role = 'cliente'; showCliente(); return true; }
  return false;
}

// ═══════════════════════════════════════════════
// ADMIN
// ═══════════════════════════════════════════════
function showAdmin(section = 'dashboard') {
  _push('admin:' + section);
  state.section = section;
  const u = state.user;
  const nombre = u.nombre_admin || u.nombre_cliente || 'Admin';

  document.getElementById('app').innerHTML = `
    <div class="admin-layout">
      <aside class="sidebar">
        <div class="sidebar-header">
          <div class="sidebar-brand">
            <i class="fas fa-utensils"></i>
            <div>
              Restaurante
              <span>Panel Administrativo</span>
            </div>
          </div>
        </div>
        <div class="sidebar-user">
          <div class="s-avatar">${getInitial(nombre)}</div>
          <div class="s-user-info">
            <p>${nombre}</p>
            <span>Administrador</span>
          </div>
        </div>
        <nav class="sidebar-nav">
          <div class="nav-section-label">Principal</div>
          <button class="nav-item ${section==='dashboard'?'active':''}" onclick="showAdmin('dashboard')">
            <i class="fas fa-chart-pie"></i> Dashboard
          </button>
          <button class="nav-item ${section==='clientes'?'active':''}" onclick="showAdmin('clientes')">
            <i class="fas fa-users"></i> Clientes
          </button>
          <button class="nav-item ${section==='mesas'?'active':''}" onclick="showAdmin('mesas')">
            <i class="fas fa-chair"></i> Mesas
          </button>
          <button class="nav-item ${section==='reservas'?'active':''}" onclick="showAdmin('reservas')">
            <i class="fas fa-calendar-check"></i> Reservas
          </button>
          <div class="nav-section-label">Reportes</div>
          <button class="nav-item ${section==='historial'?'active':''}" onclick="showAdmin('historial')">
            <i class="fas fa-history"></i> Historial
          </button>
          <button class="nav-item ${section==='notifs'?'active':''}" onclick="showAdmin('notifs')">
            <i class="fas fa-bell"></i> Notificaciones
          </button>
          <div class="nav-section-label">Cuenta</div>
          <button class="nav-item danger" onclick="logout()">
            <i class="fas fa-sign-out-alt"></i> Cerrar sesión
          </button>
        </nav>
      </aside>
      <div class="sidebar-backdrop" id="sidebar-backdrop" onclick="toggleSidebar()"></div>
      <main class="admin-main">
        <div class="admin-topbar">
          <div style="display:flex;align-items:center;flex:1;min-width:0">
            <button class="sidebar-toggle" onclick="toggleSidebar()" title="Menú"><i class="fas fa-bars"></i></button>
            <div class="topbar-title">
              <h1 id="s-title">Cargando...</h1>
              <p id="s-sub"></p>
            </div>
          </div>
          <div id="topbar-actions"></div>
        </div>
        <div class="admin-content" id="admin-content">
          <div class="loading"><div class="spinner"></div></div>
        </div>
      </main>
    </div>
  `;

  loadAdminSection(section);
}

function toggleSidebar() {
  document.querySelector('.sidebar')?.classList.toggle('open');
  document.getElementById('sidebar-backdrop')?.classList.toggle('show');
}

function loadAdminSection(s) {
  const map = {
    dashboard: ['Dashboard', 'Resumen general del sistema'],
    clientes:  ['Clientes', 'Gestiona los clientes del restaurante'],
    mesas:     ['Mesas', 'Administra las mesas del restaurante'],
    reservas:  ['Reservas', 'Gestiona todas las reservas'],
    historial: ['Historial', 'Historial completo de reservas'],
    notifs:    ['Notificaciones', 'Registro de notificaciones automáticas'],
  };
  const [t, s2] = map[s] || ['',''];
  document.getElementById('s-title').textContent = t;
  document.getElementById('s-sub').textContent = s2;
  ({ dashboard: loadDashboard, clientes: loadClientes, mesas: loadMesas, reservas: loadReservas, historial: loadHistorial, notifs: loadNotifs })[s]?.();
}

// ── DASHBOARD ─────────────────────────────────
async function loadDashboard() {
  const c = document.getElementById('admin-content');
  await sincronizarMesas();
  const [{ data: cl }, { data: ms }, { data: rs }] = await Promise.all([
    db.from('clientes').select('id_cliente'),
    db.from('mesas').select('*'),
    db.from('reservas').select('*'),
  ]);
  const disp = (ms||[]).filter(m=>m.estado==='disponible').length;
  const conf = (rs||[]).filter(r=>r.estado_reserva==='confirmada').length;
  const hoy  = new Date().toISOString().split('T')[0];
  const hoyC = (rs||[]).filter(r=>r.fecha===hoy).length;

  c.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-icon gold"><i class="fas fa-users"></i></div><div><div class="stat-num">${(cl||[]).length}</div><div class="stat-lbl">Clientes</div></div></div>
      <div class="stat-card"><div class="stat-icon blue"><i class="fas fa-chair"></i></div><div><div class="stat-num">${(ms||[]).length}</div><div class="stat-lbl">Mesas</div></div></div>
      <div class="stat-card"><div class="stat-icon green"><i class="fas fa-check"></i></div><div><div class="stat-num">${disp}</div><div class="stat-lbl">Disponibles</div></div></div>
      <div class="stat-card"><div class="stat-icon purple"><i class="fas fa-calendar-check"></i></div><div><div class="stat-num">${(rs||[]).length}</div><div class="stat-lbl">Reservas</div></div></div>
      <div class="stat-card"><div class="stat-icon orange"><i class="fas fa-calendar-day"></i></div><div><div class="stat-num">${hoyC}</div><div class="stat-lbl">Hoy</div></div></div>
      <div class="stat-card"><div class="stat-icon red"><i class="fas fa-times-circle"></i></div><div><div class="stat-num">${(rs||[]).length - conf}</div><div class="stat-lbl">Canceladas</div></div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
      <div class="card">
        <div class="card-header"><h3><i class="fas fa-calendar-alt"></i> Últimas reservas</h3><button class="btn btn-outline-gold btn-sm" onclick="showAdmin('reservas')">Ver todas</button></div>
        <div id="dash-reservas"><div class="loading"><div class="spinner"></div></div></div>
      </div>
      <div class="card">
        <div class="card-header"><h3><i class="fas fa-chair"></i> Estado de mesas</h3></div>
        <div id="dash-mesas"></div>
      </div>
    </div>
  `;

  const { data: ul } = await db.from('reservas').select('*, clientes(nombre_cliente)').order('fecha',{ascending:false}).limit(6);
  document.getElementById('dash-reservas').innerHTML = (ul||[]).length === 0
    ? '<div class="empty-state"><i class="fas fa-calendar"></i><p>Sin reservas</p></div>'
    : (ul||[]).map(r => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border)">
        <div>
          <p style="font-size:13px;font-weight:600;color:var(--text)">${r.clientes?.nombre_cliente||'—'}</p>
          <p style="font-size:11px;color:var(--text-soft)">${r.fecha} · ${r.hora?.substring(0,5)} · Mesa ${r.id_mesa}</p>
        </div>
        <span class="badge ${r.estado_reserva==='confirmada'?'badge-success':'badge-error'}">${r.estado_reserva}</span>
      </div>`).join('');

  document.getElementById('dash-mesas').innerHTML = (ms||[]).map(m => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
      <span style="font-size:13px;color:var(--text)"><i class="fas fa-chair" style="color:${m.estado==='disponible'?'var(--success)':'var(--error)'};margin-right:8px"></i>Mesa ${m.id_mesa} — ${m.ubicacion||'—'}</span>
      <span class="badge ${m.estado==='disponible'?'badge-success':'badge-error'}">${m.estado}</span>
    </div>`).join('');
}

// ── CLIENTES ──────────────────────────────────
async function loadClientes() {
  document.getElementById('topbar-actions').innerHTML = `<button class="btn btn-gold" onclick="modalNuevoCliente()"><i class="fas fa-user-plus"></i> Nuevo cliente</button>`;
  showLoading('admin-content');
  const { data } = await db.from('clientes').select('*');
  document.getElementById('admin-content').innerHTML = `
    <div class="filters-bar">
      <div class="search-box"><i class="fas fa-search"></i><input id="sc" type="text" placeholder="Buscar por nombre, correo o ID..." oninput="filtrarC()"/></div>
    </div>
    <div id="cg" class="client-cards-grid"></div>
  `;
  window._cl = data || [];
  renderCl(window._cl);
}

function filtrarC() { const q = document.getElementById('sc').value.toLowerCase(); renderCl(window._cl.filter(c => c.nombre_cliente.toLowerCase().includes(q) || c.correo.toLowerCase().includes(q) || String(c.id_cliente).includes(q))); }

function renderCl(list) {
  const g = document.getElementById('cg'); if(!g) return;
  if (!list.length) { g.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><i class="fas fa-users"></i><h3>Sin clientes</h3></div>`; return; }
  g.innerHTML = list.map(c => `
    <div class="client-card">
      <div class="c-avatar" style="background:${avatarGradient(c.id_cliente)}">${getInitial(c.nombre_cliente)}</div>
      <div class="c-info">
        <h4>${c.nombre_cliente}</h4>
        <p><i class="fas fa-envelope" style="margin-right:4px;font-size:10px"></i>${c.correo}</p>
        <p><i class="fas fa-phone" style="margin-right:4px;font-size:10px"></i>${c.telefono||'Sin teléfono'}</p>
      </div>
      <div class="c-actions">
        <button class="btn btn-info btn-icon btn-sm" onclick="modalEditarCliente(${c.id_cliente})" title="Editar"><i class="fas fa-edit"></i></button>
        <button class="btn btn-danger btn-icon btn-sm" onclick="eliminarCliente(${c.id_cliente},'${c.nombre_cliente.replace(/'/g,"\\'")}')" title="Eliminar"><i class="fas fa-trash"></i></button>
      </div>
    </div>`).join('');
}

function modalNuevoCliente() {
  openModal(`
    <h2><i class="fas fa-user-plus"></i> Nuevo Cliente</h2>
    <div class="form-group"><label>Nombre</label><input class="inp" id="m-n" type="text"/></div>
    <div class="form-group"><label>Correo</label><input class="inp" id="m-c" type="email"/></div>
    <div class="form-group"><label>Teléfono</label><input class="inp" id="m-t" type="tel" maxlength="10"/></div>
    <div class="form-group"><label>Contraseña</label><input class="inp" id="m-p" type="password"/></div>
    <div id="m-e" style="color:var(--error);font-size:12px;display:none;margin-bottom:8px"></div>
    <div class="modal-footer">
      <button class="btn btn-dark" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-gold" onclick="guardarCliente()"><i class="fas fa-save"></i> Guardar</button>
    </div>`);
}

async function modalEditarCliente(id) {
  const { data } = await db.from('clientes').select('*').eq('id_cliente', id);
  if (!data?.length) return;
  const c = data[0];
  openModal(`
    <h2><i class="fas fa-user-edit"></i> Editar Cliente</h2>
    <div class="form-group"><label>Nombre</label><input class="inp" id="m-n" type="text" value="${c.nombre_cliente}"/></div>
    <div class="form-group"><label>Correo</label><input class="inp" id="m-c" type="email" value="${c.correo}"/></div>
    <div class="form-group"><label>Teléfono</label><input class="inp" id="m-t" type="tel" value="${c.telefono||''}" maxlength="10"/></div>
    <div class="form-group"><label>Nueva contraseña (vacío = no cambiar)</label><input class="inp" id="m-p" type="password" placeholder="Nueva contraseña..."/></div>
    <div id="m-e" style="color:var(--error);font-size:12px;display:none;margin-bottom:8px"></div>
    <div class="modal-footer">
      <button class="btn btn-dark" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-info" onclick="actualizarCliente(${c.id_cliente})"><i class="fas fa-save"></i> Actualizar</button>
    </div>`);
}

async function guardarCliente() {
  const n = document.getElementById('m-n').value.trim();
  const c = document.getElementById('m-c').value.trim();
  const t = document.getElementById('m-t').value.trim();
  const p = document.getElementById('m-p').value;
  const e = document.getElementById('m-e');
  if (!n || !c || !p) { e.textContent='Nombre, correo y contraseña son obligatorios.'; e.style.display='block'; return; }
  const { error } = await db.from('clientes').insert({ nombre_cliente:n, correo:c, telefono:t||null, contrasena: await hashPassword(p) });
  if (error) { e.textContent = error.message.includes('unique')?'Correo ya registrado.':'Error al guardar.'; e.style.display='block'; return; }
  closeModal(); showToast('Cliente creado.','success'); loadClientes();
}

async function actualizarCliente(id) {
  const n = document.getElementById('m-n').value.trim();
  const c = document.getElementById('m-c').value.trim();
  const t = document.getElementById('m-t').value.trim();
  const p = document.getElementById('m-p').value;
  const datos = { nombre_cliente:n, correo:c, telefono:t||null };
  if (p) datos.contrasena = await hashPassword(p);
  const { error } = await db.from('clientes').update(datos).eq('id_cliente', id);
  if (error) { document.getElementById('m-e').textContent='Error.'; document.getElementById('m-e').style.display='block'; return; }
  closeModal(); showToast('Cliente actualizado.','success'); loadClientes();
}

async function eliminarCliente(id, nombre) {
  if (!confirm(`¿Eliminar a ${nombre}? Sus reservas también se eliminarán.`)) return;
  await db.from('clientes').delete().eq('id_cliente', id);
  showToast('Cliente eliminado.','info'); loadClientes();
}

// ── MESAS ─────────────────────────────────────
async function loadMesas() {
  document.getElementById('topbar-actions').innerHTML = `<button class="btn btn-gold" onclick="modalMesa()"><i class="fas fa-plus"></i> Nueva mesa</button>`;
  showLoading('admin-content');
  await sincronizarMesas();
  const { data } = await db.from('mesas').select('*');
  const disp = (data||[]).filter(m=>m.estado==='disponible').length;

  document.getElementById('admin-content').innerHTML = `
    <div class="stats-grid" style="grid-template-columns:repeat(3,1fr);max-width:540px;margin-bottom:20px">
      <div class="stat-card"><div class="stat-icon gold"><i class="fas fa-chair"></i></div><div><div class="stat-num">${(data||[]).length}</div><div class="stat-lbl">Total</div></div></div>
      <div class="stat-card"><div class="stat-icon green"><i class="fas fa-check"></i></div><div><div class="stat-num">${disp}</div><div class="stat-lbl">Disponibles</div></div></div>
      <div class="stat-card"><div class="stat-icon red"><i class="fas fa-times"></i></div><div><div class="stat-num">${(data||[]).length - disp}</div><div class="stat-lbl">Ocupadas</div></div></div>
    </div>
    <div class="filters-bar">
      <div class="btn-group">
        <button class="btn-toggle active" id="f-all" onclick="filtrarM(this,'todos')">Todas</button>
        <button class="btn-toggle" id="f-di" onclick="filtrarM(this,'disponible')">Disponibles</button>
        <button class="btn-toggle" id="f-oc" onclick="filtrarM(this,'ocupada')">Ocupadas</button>
      </div>
    </div>
    <div class="mesa-cards-grid" id="mg"></div>
  `;
  window._ms = data || [];
  renderMs(window._ms);
}

function filtrarM(btn, est) { document.querySelectorAll('.btn-toggle').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); renderMs(est==='todos'?window._ms:window._ms.filter(m=>m.estado===est)); }

function renderMs(list) {
  const g = document.getElementById('mg'); if(!g) return;
  const ui = { 'Terraza':'fa-sun', 'Salón Privado':'fa-door-closed', 'Salón Principal':'fa-store' };
  const uc = { 'Terraza':'var(--success)', 'Salón Privado':'#AB47BC', 'Salón Principal':'var(--gold)' };
  if (!list.length) { g.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><i class="fas fa-chair"></i><h3>Sin mesas</h3></div>`; return; }
  g.innerHTML = list.map(m => `
    <div class="mesa-card ${m.estado}">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <span class="mesa-num">Mesa ${m.id_mesa}</span>
        <span class="badge ${m.estado==='disponible'?'badge-success':'badge-error'}">${m.estado}</span>
      </div>
      <div class="mesa-detail"><i class="fas fa-users"></i>${m.capacidad} personas</div>
      <div class="mesa-detail"><i class="fas ${ui[m.ubicacion]||'fa-map-marker-alt'}" style="color:${uc[m.ubicacion]||'var(--gold)'}"></i>${m.ubicacion||'—'}</div>
      <div class="mesa-footer">
        <button class="btn btn-info btn-sm" style="flex:1" onclick="modalMesa(${m.id_mesa})"><i class="fas fa-edit"></i> Editar</button>
        <button class="btn btn-danger btn-sm" onclick="eliminarMesa(${m.id_mesa})"><i class="fas fa-trash"></i></button>
      </div>
    </div>`).join('');
}

async function modalMesa(id = null) {
  let m = null;
  if (id) { const { data } = await db.from('mesas').select('*').eq('id_mesa', id); m = data?.[0]; }
  openModal(`
    <h2><i class="fas fa-chair"></i> ${m?'Editar':'Nueva'} Mesa</h2>
    <div class="form-group"><label>Capacidad</label><input class="inp" id="m-cap" type="number" min="1" value="${m?.capacidad||''}"/></div>
    <div class="form-group"><label>Ubicación</label>
      <select class="inp" id="m-ubi">
        <option value="">Selecciona...</option>
        ${['Salón Principal','Terraza','Salón Privado'].map(u=>`<option value="${u}" ${m?.ubicacion===u?'selected':''}>${u}</option>`).join('')}
      </select>
    </div>
    <div class="form-group"><label>Estado</label>
      <select class="inp" id="m-est">
        <option value="disponible" ${!m||m.estado==='disponible'?'selected':''}>Disponible</option>
        <option value="ocupada" ${m?.estado==='ocupada'?'selected':''}>Ocupada</option>
      </select>
    </div>
    <div id="m-e" style="color:var(--error);font-size:12px;display:none;margin-bottom:8px"></div>
    <div class="modal-footer">
      <button class="btn btn-dark" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-gold" onclick="${m?`actualizarMesa(${m.id_mesa})`:'guardarMesa()'}"><i class="fas fa-save"></i> ${m?'Actualizar':'Guardar'}</button>
    </div>`);
}

async function guardarMesa() {
  const cap=document.getElementById('m-cap').value; const ubi=document.getElementById('m-ubi').value; const est=document.getElementById('m-est').value;
  if(!cap||!ubi){document.getElementById('m-e').textContent='Todos los campos son obligatorios.';document.getElementById('m-e').style.display='block';return;}
  await db.from('mesas').insert({capacidad:parseInt(cap),ubicacion:ubi,estado:est});
  closeModal(); showToast('Mesa creada.','success'); loadMesas();
}

async function actualizarMesa(id) {
  const cap=parseInt(document.getElementById('m-cap').value);
  const ubi=document.getElementById('m-ubi').value;
  const est=document.getElementById('m-est').value;

  // Verificar conflictos ANTES de guardar
  const hoy=new Date().toISOString().split('T')[0];
  const {data:conflictos}=await db.from('reservas')
    .select('id_reservas,fecha,hora,numero_personas,clientes(nombre_cliente,correo,telefono)')
    .eq('id_mesa',id).eq('estado_reserva','confirmada')
    .gt('numero_personas',cap).gte('fecha',hoy);

  if(conflictos?.length>0){
    // Guardar datos temporalmente para usarlos en las funciones siguientes
    window._mesaEditTemp={id,cap,ubi,est,ids:conflictos.map(r=>r.id_reservas)};
    closeModal();
    openModal(`
      <h2><i class="fas fa-exclamation-triangle" style="color:var(--warning)"></i> Conflicto de capacidad</h2>
      <p style="font-size:13px;color:var(--text-soft);margin-bottom:16px">
        La nueva capacidad (<strong style="color:var(--gold)">${cap} personas</strong>) es menor que las personas en
        <strong>${conflictos.length}</strong> reserva(s) activa(s):
      </p>
      <div style="background:var(--bg-card2);border-radius:8px;padding:4px 12px;margin-bottom:20px;max-height:180px;overflow-y:auto">
        ${conflictos.map(r=>`
          <div style="padding:10px 0;border-bottom:1px solid var(--border)">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
              <span style="font-size:13px;font-weight:700;color:var(--gold)">#${r.id_reservas} — ${r.clientes?.nombre_cliente||'—'}</span>
              <span style="font-size:12px;color:var(--error);font-weight:700;background:rgba(239,83,80,0.1);padding:2px 8px;border-radius:4px">${r.numero_personas} personas</span>
            </div>
            <div style="font-size:11px;color:var(--text-soft);display:flex;flex-wrap:wrap;gap:10px">
              <span><i class="fas fa-calendar" style="color:var(--gold);margin-right:3px"></i>${r.fecha} ${r.hora?.substring(0,5)}</span>
              <span><i class="fas fa-envelope" style="color:var(--gold);margin-right:3px"></i>${r.clientes?.correo||'—'}</span>
              ${r.clientes?.telefono?`<span><i class="fas fa-phone" style="color:var(--gold);margin-right:3px"></i>${r.clientes.telefono}</span>`:''}
            </div>
          </div>`).join('')}
      </div>
      <p style="font-size:12px;color:var(--text-soft);margin-bottom:16px">¿Qué deseas hacer con esas reservas?</p>
      <div style="display:flex;flex-direction:column;gap:8px">
        <button class="btn btn-danger btn-full" onclick="confirmarMesaConCancelacion()">
          <i class="fas fa-ban"></i> Guardar mesa y cancelar esas reservas
        </button>
        <button class="btn btn-dark btn-full" onclick="confirmarMesaSinCancelacion()">
          <i class="fas fa-save"></i> Guardar mesa y dejar las reservas como están
        </button>
        <button class="btn btn-outline-gold btn-full" onclick="closeModal()">
          <i class="fas fa-arrow-left"></i> Volver y no guardar
        </button>
      </div>`);
    return;
  }

  // Sin conflictos → guardar directamente
  await db.from('mesas').update({capacidad:cap,ubicacion:ubi,estado:est}).eq('id_mesa',id);
  closeModal(); showToast('Mesa actualizada.','success'); loadMesas();
}

async function confirmarMesaConCancelacion() {
  const {id,cap,ubi,est,ids}=window._mesaEditTemp||{};
  if(!id) return;
  await db.from('mesas').update({capacidad:cap,ubicacion:ubi,estado:est}).eq('id_mesa',id);
  if(ids?.length>0) await db.from('reservas').update({estado_reserva:'cancelada'}).in('id_reservas',ids);
  closeModal();
  showToast(`Mesa actualizada. ${ids?.length||0} reserva(s) cancelada(s).`,'info');
  loadMesas();
}

async function confirmarMesaSinCancelacion() {
  const {id,cap,ubi,est}=window._mesaEditTemp||{};
  if(!id) return;
  await db.from('mesas').update({capacidad:cap,ubicacion:ubi,estado:est}).eq('id_mesa',id);
  closeModal();
  showToast('Mesa actualizada. Ve a Reservas → ⚠️ Conflictos para ver las reservas afectadas.','info');
  loadMesas();
}

async function eliminarMesa(id) {
  if(!confirm(`¿Eliminar la Mesa ${id}?`)) return;
  await db.from('mesas').delete().eq('id_mesa',id);
  showToast('Mesa eliminada.','info'); loadMesas();
}

// ── RESERVAS (ADMIN) ──────────────────────────
async function loadReservas() {
  document.getElementById('topbar-actions').innerHTML = `<button class="btn btn-gold" onclick="modalReserva()"><i class="fas fa-plus"></i> Nueva reserva</button>`;
  showLoading('admin-content');
  const { data } = await db.from('reservas').select('*, clientes(nombre_cliente), mesas(ubicacion, capacidad)').order('fecha',{ascending:false});
  document.getElementById('admin-content').innerHTML = `
    <div class="filters-bar">
      <div class="search-box"><i class="fas fa-search"></i><input id="sr" type="text" placeholder="Buscar por nombre o ID de cliente..." oninput="filtrarR()"/></div>
      <div class="btn-group">
        <button class="btn-toggle active" onclick="filtrarRE(this,'todos')">Todas</button>
        <button class="btn-toggle" onclick="filtrarRE(this,'confirmada')">Confirmadas</button>
        <button class="btn-toggle" onclick="filtrarRE(this,'cancelada')">Canceladas</button>
        <button class="btn-toggle" id="btn-conflictos" onclick="filtrarRE(this,'conflictos')" title="Reservas con más personas de lo que permite la capacidad actual de la mesa" style="color:#FFA000">⚠️ Conflictos</button>
      </div>
    </div>
    <div class="card"><div class="table-wrapper"><table>
      <thead><tr><th>ID</th><th>Cliente</th><th>Mesa</th><th>Fecha</th><th>Hora</th><th>Personas</th><th>Observaciones</th><th>Estado</th><th>Acciones</th></tr></thead>
      <tbody id="rt"></tbody>
    </table></div></div>
  `;
  window._rs = data||[]; window._rsE = 'todos';
  filtrarR();
}

function filtrarR() {
  const q=document.getElementById('sr')?.value.toLowerCase()||'';
  let d=window._rs;
  if(window._rsE==='conflictos') {
    d=d.filter(r=>r.estado_reserva==='confirmada' && r.mesas?.capacidad && r.numero_personas > r.mesas.capacidad);
  } else if(window._rsE!=='todos') {
    d=d.filter(r=>r.estado_reserva===window._rsE);
  }
  if(q) d=d.filter(r=>r.clientes?.nombre_cliente?.toLowerCase().includes(q)||String(r.id_cliente).includes(q));
  // Actualizar contador en el botón de conflictos
  const totalConf=(window._rs||[]).filter(r=>r.estado_reserva==='confirmada'&&r.mesas?.capacidad&&r.numero_personas>r.mesas.capacidad).length;
  const btnC=document.getElementById('btn-conflictos');
  if(btnC) btnC.innerHTML=`⚠️ Conflictos${totalConf>0?` <span style="background:#FFA000;color:#0C0B09;border-radius:10px;padding:0 6px;font-size:11px;font-weight:700;margin-left:2px">${totalConf}</span>`:''}`;
  renderR(d);
}
function filtrarRE(btn,e) { document.querySelectorAll('.btn-toggle').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); window._rsE=e; filtrarR(); }

function renderR(list) {
  const t=document.getElementById('rt'); if(!t) return;
  if(!list.length){t.innerHTML=`<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--text-soft)">Sin reservas${window._rsE==='conflictos'?' con capacidad excedida':''}</td></tr>`;return;}
  t.innerHTML = list.map(r=>{
    const conflicto = r.estado_reserva==='confirmada' && r.mesas?.capacidad && r.numero_personas > r.mesas.capacidad;
    return `
    <tr${conflicto?' style="background:rgba(255,160,0,0.07)"':''}>
      <td><strong style="color:var(--gold)">#${r.id_reservas}</strong></td>
      <td>${r.clientes?.nombre_cliente||'—'}</td>
      <td>Mesa ${r.id_mesa}${r.mesas?.ubicacion?' · '+r.mesas.ubicacion:''}</td>
      <td>${r.fecha}</td><td>${r.hora?.substring(0,5)}</td>
      <td>${r.numero_personas}${conflicto?` <span title="Supera capacidad actual de la mesa (${r.mesas.capacidad}p máx.)" style="cursor:help;font-size:13px">⚠️</span>`:''}</td>
      <td style="max-width:140px;font-size:12px;color:var(--text-soft)">${r.observaciones||'—'}</td>
      <td><span class="badge ${r.estado_reserva==='confirmada'?'badge-success':'badge-error'}">${r.estado_reserva}</span></td>
      <td><div style="display:flex;gap:6px">
        <button class="btn btn-info btn-icon btn-sm" onclick="modalReserva(${r.id_reservas})" title="Editar"><i class="fas fa-edit"></i></button>
        ${r.estado_reserva==='confirmada'?`<button class="btn btn-danger btn-icon btn-sm" onclick="cancelarR(${r.id_reservas})" title="Cancelar"><i class="fas fa-ban"></i></button>`:''}
      </div></td>
    </tr>`;
  }).join('');
}

async function modalReserva(id = null) {
  const [{ data: cl }, { data: ms }] = await Promise.all([
    db.from('clientes').select('id_cliente,nombre_cliente'),
    db.from('mesas').select('id_mesa,capacidad,ubicacion')
  ]);
  let r = null;
  if (id) { const { data } = await db.from('reservas').select('*').eq('id_reservas',id); r=data?.[0]; }
  const hoy = new Date().toISOString().split('T')[0];
  openModal(`
    <h2><i class="fas fa-calendar-plus"></i> ${r?'Editar':'Nueva'} Reserva</h2>
    <div class="form-group"><label>Cliente</label>
      <select class="inp" id="m-cl">${(cl||[]).map(c=>`<option value="${c.id_cliente}" ${r?.id_cliente===c.id_cliente?'selected':''}>${c.nombre_cliente}</option>`).join('')}</select>
    </div>
    <div class="form-group"><label>Mesa</label>
      <select class="inp" id="m-me">${(ms||[]).map(m=>`<option value="${m.id_mesa}" ${r?.id_mesa===m.id_mesa?'selected':''}>Mesa ${m.id_mesa} — ${m.ubicacion||'?'} (${m.capacidad}p)</option>`).join('')}</select>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Fecha</label><input class="inp" id="m-fe" type="text" placeholder="Selecciona una fecha..." readonly/></div>
      <div class="form-group"><label>Hora</label>
        <select class="inp" id="m-ho">
          <option value="">Selecciona una hora...</option>
          ${['12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00','22:00']
            .map(h => {
              const n = parseInt(h.split(':')[0]);
              const label = n === 12 ? '12:00 PM — Mediodía' : n === 22 ? '10:00 PM — Último turno' : `${n > 12 ? n - 12 : n}:00 ${n >= 12 ? 'PM' : 'AM'}`;
              return `<option value="${h}" ${r?.hora?.substring(0,5) === h ? 'selected' : ''}>${label}</option>`;
            }).join('')}
        </select>
      </div>
    </div>
    <div class="form-group"><label>Personas</label><input class="inp" id="m-pe" type="number" min="1" value="${r?.numero_personas||''}"/></div>
    ${r
      ? (r.observaciones ? `<div class="form-group"><label>Solicitudes especiales</label><div style="background:var(--bg-card2);border:1px solid var(--border);border-radius:8px;padding:10px 14px;font-size:13px;color:var(--text-soft);font-style:italic"><i class='fas fa-sticky-note' style='margin-right:6px;color:var(--gold)'></i>${r.observaciones}</div></div>` : '')
      : `<div class="form-group"><label>Observaciones</label><textarea class="inp" id="m-ob" rows="2"></textarea></div>`}
    ${r?`<div class="form-group"><label>Estado</label><select class="inp" id="m-es"><option value="confirmada" ${r.estado_reserva==='confirmada'?'selected':''}>Confirmada</option><option value="cancelada" ${r.estado_reserva==='cancelada'?'selected':''}>Cancelada</option></select></div>`:''}
    <div id="m-e" style="color:var(--error);font-size:12px;display:none;margin-bottom:8px"></div>
    <div class="modal-footer">
      <button class="btn btn-dark" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-gold" onclick="${r?`actualizarR(${r.id_reservas})`:'guardarR()'}"><i class="fas fa-save"></i> ${r?'Actualizar':'Guardar'}</button>
    </div>`);
  setTimeout(() => initFlatpickr('m-fe', { defaultDate: r?.fecha || '', minDate: r ? null : 'today' }), 0);
}

async function guardarR() {
  const cl=document.getElementById('m-cl').value, me=document.getElementById('m-me').value;
  const fe=document.getElementById('m-fe').value, ho=document.getElementById('m-ho').value;
  const pe=document.getElementById('m-pe').value, ob=document.getElementById('m-ob').value.trim();
  const e=document.getElementById('m-e');
  if(!cl||!me||!fe||!ho||!pe){e.textContent='Todos los campos son obligatorios.';e.style.display='block';return;}
  const {data:nuevaRes,error}=await db.from('reservas').insert({id_cliente:parseInt(cl),id_mesa:parseInt(me),fecha:fe,hora:ho,numero_personas:parseInt(pe),estado_reserva:'confirmada',observaciones:ob}).select('id_reservas');
  if(error){e.textContent=error.message.includes('unique')?'Mesa ya reservada para esa fecha y hora.':'Error.';e.style.display='block';return;}
  // Email al cliente
  const {data:cliArr}=await db.from('clientes').select('correo,nombre_cliente').eq('id_cliente',parseInt(cl));
  const cli=cliArr?.[0];
  if(cli) enviarEmailReserva(cli.correo, cli.nombre_cliente, {id:nuevaRes?.[0]?.id_reservas,fecha:fe,hora:ho,mesa:me,personas:pe,estado:'confirmada'});
  closeModal();
  showToast('Reserva creada.','success');
  const {data:fresh}=await db.from('reservas').select('*, clientes(nombre_cliente), mesas(ubicacion, capacidad)').order('fecha',{ascending:false});
  window._rs=fresh||[];
  filtrarR();
}

async function actualizarR(id) {
  const feEl=document.getElementById('m-fe');
  const cl=document.getElementById('m-cl').value, me=document.getElementById('m-me').value;
  const fe=feEl._flatpickr ? feEl._flatpickr.input.value : feEl.value;
  const ho=document.getElementById('m-ho').value;
  const pe=document.getElementById('m-pe').value;
  const es=document.getElementById('m-es')?.value||'confirmada';
  const eEl=document.getElementById('m-e');
  if(!cl||!me||!fe||!ho||!pe){eEl.textContent='Todos los campos son obligatorios.';eEl.style.display='block';return;}
  // Validar capacidad de la mesa
  const {data:mesaArr}=await db.from('mesas').select('capacidad').eq('id_mesa',parseInt(me));
  const capMesa=mesaArr?.[0]?.capacidad;
  if(capMesa&&parseInt(pe)>capMesa){eEl.textContent=`La mesa ${me} solo tiene capacidad para ${capMesa} personas.`;eEl.style.display='block';return;}
  const {error}=await db.from('reservas').update({id_cliente:parseInt(cl),id_mesa:parseInt(me),fecha:fe,hora:ho,numero_personas:parseInt(pe),estado_reserva:es}).eq('id_reservas',id);
  if(error){eEl.textContent=error.message.includes('unique')?'Esa mesa ya tiene una reserva en esa fecha y hora.':'Error al actualizar: '+error.message;eEl.style.display='block';return;}
  const {data:cliArr}=await db.from('clientes').select('correo,nombre_cliente').eq('id_cliente',parseInt(cl));
  const cli=cliArr?.[0];
  if(cli) enviarEmailReserva(cli.correo,cli.nombre_cliente,{id,fecha:fe,hora:ho,mesa:me,personas:pe,estado:es==='cancelada'?'cancelada':'modificada'});
  closeModal();
  showToast('Reserva actualizada.','success');
  // Recargar datos sin re-renderizar toda la sección
  const {data:fresh}=await db.from('reservas').select('*, clientes(nombre_cliente), mesas(ubicacion, capacidad)').order('fecha',{ascending:false});
  window._rs=fresh||[];
  filtrarR();
}

async function cancelarR(id) {
  if(!confirm('¿Cancelar esta reserva?')) return;
  const {data:rvArr}=await db.from('reservas').select('fecha,hora,id_mesa,numero_personas,id_cliente,clientes(correo,nombre_cliente)').eq('id_reservas',id);
  await db.from('reservas').update({estado_reserva:'cancelada'}).eq('id_reservas',id);
  const rv=rvArr?.[0];
  if(rv?.clientes) enviarEmailReserva(rv.clientes.correo, rv.clientes.nombre_cliente, {id,fecha:rv.fecha,hora:rv.hora,mesa:rv.id_mesa,personas:rv.numero_personas,estado:'cancelada'});
  showToast('Reserva cancelada.','info');
  const {data:fresh}=await db.from('reservas').select('*, clientes(nombre_cliente), mesas(ubicacion, capacidad)').order('fecha',{ascending:false});
  window._rs=fresh||[];
  filtrarR();
}

// ── HISTORIAL ─────────────────────────────────
async function loadHistorial() {
  document.getElementById('topbar-actions').innerHTML='';
  const hoy = new Date().toISOString().split('T')[0];
  document.getElementById('admin-content').innerHTML = `
    <div class="card" style="margin-bottom:20px">
      <div class="card-header"><h3><i class="fas fa-filter"></i> Filtros</h3></div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end">
        <div style="flex:1;min-width:150px"><label style="font-size:11px;color:var(--text-soft);display:block;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">Cliente (nombre)</label><input class="inp" id="hc" placeholder="Nombre..." style="width:100%"/></div>
        <div style="min-width:110px"><label style="font-size:11px;color:var(--text-soft);display:block;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">ID Cliente</label><input class="inp" id="hid" type="number" min="1" placeholder="Ej: 3" style="width:100%"/></div>
        <div style="min-width:130px"><label style="font-size:11px;color:var(--text-soft);display:block;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">Desde</label><input class="inp" id="hd" type="date"/></div>
        <div style="min-width:130px"><label style="font-size:11px;color:var(--text-soft);display:block;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">Hasta</label><input class="inp" id="hh" type="date" value="${hoy}"/></div>
        <div style="min-width:130px"><label style="font-size:11px;color:var(--text-soft);display:block;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">Estado</label>
          <select class="inp" id="he"><option value="">Todos</option><option value="confirmada">Confirmada</option><option value="cancelada">Cancelada</option></select>
        </div>
        <button class="btn btn-gold" onclick="buscarH()"><i class="fas fa-search"></i> Buscar</button>
        <button class="btn btn-dark" onclick="limpiarH()">Limpiar</button>
      </div>
    </div>
    <div class="card"><div class="table-wrapper"><table>
      <thead><tr><th>ID</th><th>Cliente</th><th>Mesa</th><th>Fecha</th><th>Hora</th><th>Personas</th><th>Estado</th></tr></thead>
      <tbody id="ht"><tr><td colspan="7" style="text-align:center;padding:30px;color:var(--text-soft)">Aplica filtros para ver resultados</td></tr></tbody>
    </table></div></div>
  `;
  document.querySelectorAll('.inp').forEach(applyInputStyle);
}

async function buscarH() {
  let q = db.from('reservas').select('*, clientes(nombre_cliente), mesas(ubicacion)').order('fecha',{ascending:false});
  const e=document.getElementById('he').value, d=document.getElementById('hd').value, h=document.getElementById('hh').value;
  const c=document.getElementById('hc').value.trim(), hid=document.getElementById('hid')?.value.trim();
  if(e) q=q.eq('estado_reserva',e); if(d) q=q.gte('fecha',d); if(h) q=q.lte('fecha',h);
  if(hid) q=q.eq('id_cliente', parseInt(hid));
  const {data} = await q;
  let rs = data||[];
  if(c) rs=rs.filter(r=>r.clientes?.nombre_cliente?.toLowerCase().includes(c.toLowerCase()));
  const t=document.getElementById('ht');
  if(!rs.length){t.innerHTML=`<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--text-soft)">Sin resultados</td></tr>`;return;}
  t.innerHTML=rs.map(r=>`<tr><td>#${r.id_reservas}</td><td>${r.clientes?.nombre_cliente||'—'}</td><td>Mesa ${r.id_mesa}${r.mesas?.ubicacion?' · '+r.mesas.ubicacion:''}</td><td>${r.fecha}</td><td>${r.hora?.substring(0,5)}</td><td>${r.numero_personas}</td><td><span class="badge ${r.estado_reserva==='confirmada'?'badge-success':'badge-error'}">${r.estado_reserva}</span></td></tr>`).join('');
}

function limpiarH() { ['hc','hid','hd','hh','he'].forEach(i=>{ const el=document.getElementById(i); if(el) el.value=''; }); document.getElementById('ht').innerHTML=`<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--text-soft)">Aplica filtros para ver resultados</td></tr>`; }

// ── NOTIFICACIONES ────────────────────────────
async function loadNotifs() {
  document.getElementById('topbar-actions').innerHTML='';
  showLoading('admin-content');
  const {data} = await db.from('notificaciones').select('*, reservas(id_cliente)').order('fecha_envio',{ascending:false});
  const hoy=new Date().toISOString().split('T')[0];
  const hoyC=(data||[]).filter(n=>n.fecha_envio?.startsWith(hoy)).length;
  const c=document.getElementById('admin-content');
  c.innerHTML=`
    <div class="stats-grid" style="grid-template-columns:repeat(2,1fr);max-width:360px;margin-bottom:24px">
      <div class="stat-card"><div class="stat-icon gold"><i class="fas fa-bell"></i></div><div><div class="stat-num">${(data||[]).length}</div><div class="stat-lbl">Total</div></div></div>
      <div class="stat-card"><div class="stat-icon blue"><i class="fas fa-calendar-day"></i></div><div><div class="stat-num">${hoyC}</div><div class="stat-lbl">Hoy</div></div></div>
    </div>
    <div id="nl">
      ${!(data||[]).length?`<div class="empty-state"><i class="fas fa-bell-slash"></i><h3>Sin notificaciones</h3><p>Se generan automáticamente al crear reservas.</p></div>`:
      (data||[]).map(n=>{
        const msg=n.mensaje?.toLowerCase()||'';
        const tipo=msg.includes('confirmada')?'confirmada':msg.includes('cancelada')?'cancelada':'info';
        const fecha=n.fecha_envio?new Date(n.fecha_envio).toLocaleString('es-CO',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'—';
        return `<div class="notif-card ${tipo}">
          <div class="notif-header"><h4><i class="fas fa-bell" style="color:var(--gold);margin-right:6px"></i>Notif #${n.id_notificacion} — Reserva #${n.id_reserva}</h4>
            <span class="badge ${tipo==='confirmada'?'badge-success':tipo==='cancelada'?'badge-error':'badge-info'}">${tipo}</span>
          </div>
          <div class="notif-body">${n.mensaje}</div>
          <div class="notif-footer"><span><i class="fas fa-user" style="margin-right:4px"></i>Cliente #${n.reservas?.id_cliente||'—'}</span><span><i class="fas fa-envelope" style="margin-right:4px"></i>${n.correo_cliente}</span><span><i class="fas fa-clock" style="margin-right:4px"></i>${fecha}</span></div>
        </div>`;
      }).join('')}
    </div>`;
}

// ═══════════════════════════════════════════════
// CLIENTE
// ═══════════════════════════════════════════════
function showCliente(section='home') {
  _push('cliente:' + section);
  const u=state.user, nombre=u.nombre_cliente||'Cliente';
  document.getElementById('app').innerHTML=`
    <div class="client-layout">
      <nav class="client-topbar">
        <div class="logo"><i class="fas fa-utensils"></i> Restaurante</div>
        <div class="client-nav">
          <button class="c-nav-item ${section==='home'?'active':''}" onclick="showCliente('home')"><i class="fas fa-home"></i> Inicio</button>
          <button class="c-nav-item ${section==='nueva'?'active':''}" onclick="showCliente('nueva')"><i class="fas fa-plus-circle"></i> Nueva Reserva</button>
          <button class="c-nav-item ${section==='mis'?'active':''}" onclick="showCliente('mis')"><i class="fas fa-calendar"></i> Mis Reservas</button>
          <button class="c-nav-item ${section==='perfil'?'active':''}" onclick="showCliente('perfil')"><i class="fas fa-user"></i> Perfil</button>
          <button class="c-nav-item danger" onclick="logout()"><i class="fas fa-sign-out-alt"></i></button>
        </div>
      </nav>
      <div class="client-content" id="cc"><div class="loading"><div class="spinner"></div></div></div>
    </div>`;
  ({home:loadCHome, nueva:loadCNueva, mis:loadCMis, perfil:loadCPerfil})[section]?.();
}

async function loadCHome() {
  const u=state.user, hoy=new Date().toISOString().split('T')[0];
  const nombre=u.nombre_cliente?.split(' ')[0]||'Cliente';
  const dias=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const meses=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const d=new Date();
  const ft=`${dias[d.getDay()]}, ${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;

  const [{data:td},{data:cf},{data:px}] = await Promise.all([
    db.from('reservas').select('id_reservas').eq('id_cliente',u.id_cliente),
    db.from('reservas').select('id_reservas').eq('id_cliente',u.id_cliente).eq('estado_reserva','confirmada'),
    db.from('reservas').select('*').eq('id_cliente',u.id_cliente).eq('estado_reserva','confirmada').gte('fecha',hoy).order('fecha').limit(1)
  ]);

  const total=(td||[]).length, activas=(cf||[]).length, prox=px?.[0]||null;

  document.getElementById('cc').innerHTML=`
    <div class="c-hero">
      <h2>¡Hola, ${nombre}! 👋</h2>
      <p style="color:rgba(240,234,224,0.6);font-size:13px;margin-top:4px">${ft}</p>
    </div>
    <div class="c-stats">
      <div class="c-stat"><div class="num">${total}</div><div class="lbl">Reservas totales</div></div>
      <div class="c-stat"><div class="num" style="color:var(--success)">${activas}</div><div class="lbl">Activas</div></div>
      <div class="c-stat"><div class="num" style="color:var(--error)">${total-activas}</div><div class="lbl">Canceladas</div></div>
    </div>
    ${prox?`<div class="proxima" onclick="showCliente('mis')">
      <div class="proxima-icon"><i class="fas fa-clock"></i></div>
      <div class="proxima-info"><h4>Próxima reserva</h4><p>${prox.fecha} · ${prox.hora?.substring(0,5)} · Mesa ${prox.id_mesa}</p></div>
      <i class="fas fa-chevron-right" style="color:var(--gold)"></i>
    </div>`:''}
    <h3 style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:14px">¿Qué deseas hacer?</h3>
    <div class="action-cards">
      <button class="action-card" onclick="showCliente('nueva')">
        <div class="action-icon" style="background:linear-gradient(135deg,var(--gold-dark),var(--gold))"><i class="fas fa-plus-circle" style="color:#0C0B09"></i></div>
        <h3>Nueva Reserva</h3><p>Reserva tu mesa</p>
      </button>
      <button class="action-card" onclick="showCliente('mis')">
        <div class="action-icon" style="background:linear-gradient(135deg,#2C1A0E,#4E342E)"><i class="fas fa-calendar-check" style="color:var(--gold)"></i></div>
        <h3>Mis Reservas</h3><p>Ver y gestionar</p>
      </button>
      <button class="action-card" onclick="showCliente('perfil')">
        <div class="action-icon" style="background:linear-gradient(135deg,#1A1208,#2C1A0E)"><i class="fas fa-user-circle" style="color:var(--gold)"></i></div>
        <h3>Mi Perfil</h3><p>Mis datos</p>
      </button>
    </div>`;
}

async function loadCNueva() {
  const hoy=new Date().toISOString().split('T')[0];
  document.getElementById('cc').innerHTML=`
    <h2 style="font-size:20px;font-weight:700;color:var(--text);margin-bottom:20px"><i class="fas fa-calendar-plus" style="color:var(--gold);margin-right:8px"></i>Nueva Reserva</h2>
    <div class="card" style="max-width:560px">
      <p style="font-size:13px;color:var(--text-soft);margin-bottom:16px"><i class="fas fa-calendar" style="margin-right:6px;color:var(--gold)"></i>¿Cuándo quieres venir?</p>
      <div class="form-row">
        <div class="form-group"><label>Fecha</label><input class="inp" id="nr-f" type="text" placeholder="Selecciona una fecha..." readonly/></div>
        <div class="form-group"><label>Hora</label>
          <select class="inp" id="nr-h">
            <option value="">Selecciona una hora...</option>
            <option value="12:00">12:00 PM — Mediodía</option>
            <option value="13:00">1:00 PM</option>
            <option value="14:00">2:00 PM</option>
            <option value="15:00">3:00 PM</option>
            <option value="16:00">4:00 PM</option>
            <option value="17:00">5:00 PM</option>
            <option value="18:00">6:00 PM</option>
            <option value="19:00">7:00 PM</option>
            <option value="20:00">8:00 PM</option>
            <option value="21:00">9:00 PM</option>
            <option value="22:00">10:00 PM — Último turno</option>
          </select>
        </div>
      </div>
      <div class="form-group"><label>Número de personas</label><input class="inp" id="nr-p" type="number" min="1" placeholder="¿Cuántos serán?"/></div>
      <button class="btn btn-gold btn-full" onclick="buscarMesas()" style="margin-bottom:16px"><i class="fas fa-search"></i> Buscar mesas disponibles</button>
      <div id="mr"></div>
      <div id="nr-obs" style="display:none;margin-top:16px">
        <div class="form-group"><label>📝 Solicitudes especiales (opcional)</label><textarea class="inp" id="nr-o" rows="2" placeholder="Alergias, celebración, preferencias..."></textarea></div>
        <button class="btn btn-gold btn-full btn-lg" onclick="confirmarR()"><i class="fas fa-check-circle"></i> Confirmar Reserva</button>
      </div>
      <div id="nr-e" style="color:var(--error);font-size:13px;margin-top:10px;display:none;padding:10px;background:rgba(239,83,80,0.08);border-radius:8px"></div>
    </div>`;
  document.querySelectorAll('.inp').forEach(applyInputStyle);
  initFlatpickr('nr-f');
}

async function buscarMesas() {
  const f=document.getElementById('nr-f').value, h=document.getElementById('nr-h').value, p=parseInt(document.getElementById('nr-p').value);
  const e=document.getElementById('nr-e'), mr=document.getElementById('mr'), obs=document.getElementById('nr-obs');
  e.style.display='none'; obs.style.display='none'; window._mesaSel=null;
  if(!f||!h||!p){e.textContent='Completa fecha, hora y personas.';e.style.display='block';return;}
  const hoy=new Date().toISOString().split('T')[0];
  if(f<hoy){e.textContent='No puedes reservar en una fecha pasada.';e.style.display='block';return;}
  mr.innerHTML='<div class="loading"><div class="spinner"></div> Buscando mesas...</div>';
  const [{data:todas},{data:ocup}]=await Promise.all([
    db.from('mesas').select('*').gte('capacidad',p),
    db.from('reservas').select('id_mesa').eq('fecha',f).eq('hora',h).eq('estado_reserva','confirmada')
  ]);
  const ids=(ocup||[]).map(r=>r.id_mesa);
  const disp=(todas||[]).filter(m=>!ids.includes(m.id_mesa));
  if(!disp.length){mr.innerHTML=`<div style="color:var(--error);text-align:center;padding:24px;background:rgba(239,83,80,0.06);border-radius:10px;border:1px solid rgba(239,83,80,0.15)"><i class="fas fa-times-circle" style="font-size:28px;display:block;margin-bottom:8px"></i>No hay mesas disponibles para ese horario.</div>`;return;}
  const ui={'Terraza':'fa-sun','Salón Privado':'fa-door-closed','Salón Principal':'fa-store'};
  mr.innerHTML=`<p style="font-size:13px;color:var(--success);font-weight:600;margin-bottom:10px"><i class="fas fa-check-circle"></i> ${disp.length} mesa(s) disponible(s). Selecciona una:</p>
    <div class="mesas-selector">${disp.map(m=>`
      <button class="mesa-option" onclick="selM(${m.id_mesa},this)">
        <h4><i class="fas fa-chair" style="color:var(--gold);margin-right:6px"></i>Mesa ${m.id_mesa}</h4>
        <p><i class="fas ${ui[m.ubicacion]||'fa-map-marker-alt'}" style="margin-right:4px"></i>${m.ubicacion||'—'}</p>
        <p><i class="fas fa-users" style="margin-right:4px"></i>${m.capacidad} personas máx.</p>
      </button>`).join('')}
    </div>`;
}

function selM(id,btn) {
  document.querySelectorAll('.mesa-option').forEach(b=>b.classList.remove('selected'));
  btn.classList.add('selected');
  window._mesaSel=id;
  document.getElementById('nr-obs').style.display='block';
}

async function confirmarR() {
  const f=document.getElementById('nr-f').value, h=document.getElementById('nr-h').value;
  const p=document.getElementById('nr-p').value, o=document.getElementById('nr-o')?.value?.trim()||'';
  const e=document.getElementById('nr-e');
  if(!window._mesaSel){e.textContent='Selecciona una mesa.';e.style.display='block';return;}
  const {data:nuevaRes,error}=await db.from('reservas').insert({id_cliente:state.user.id_cliente,id_mesa:window._mesaSel,fecha:f,hora:h,numero_personas:parseInt(p),estado_reserva:'confirmada',observaciones:o}).select('id_reservas');
  if(error){e.textContent=error.message.includes('unique')?'Esa mesa ya fue reservada.':'Error.';e.style.display='block';return;}
  enviarEmailReserva(state.user.correo, state.user.nombre_cliente, {id:nuevaRes?.[0]?.id_reservas,fecha:f,hora:h,mesa:window._mesaSel,personas:p,estado:'confirmada'});
  showToast('¡Reserva confirmada! 🎉','success'); showCliente('mis');
}

async function loadCMis() {
  window._cmisFiltro = 'todos';
  window._cmisOrden  = 'proximas';
  document.getElementById('cc').innerHTML=`
    <h2 style="font-size:20px;font-weight:700;color:var(--text);margin-bottom:20px"><i class="fas fa-calendar-check" style="color:var(--gold);margin-right:8px"></i>Mis Reservas</h2>
    <div class="filters-bar" style="flex-wrap:wrap;gap:10px">
      <div class="btn-group">
        <button class="btn-toggle cmis-f active" onclick="filtCMis(this,'todos')">Todas</button>
        <button class="btn-toggle cmis-f" onclick="filtCMis(this,'confirmada')">Confirmadas</button>
        <button class="btn-toggle cmis-f" onclick="filtCMis(this,'cancelada')">Canceladas</button>
      </div>
      <div class="btn-group">
        <button class="btn-toggle cmis-s active" onclick="sortCMis(this,'proximas')"><i class="fas fa-arrow-up"></i> Próximas</button>
        <button class="btn-toggle cmis-s" onclick="sortCMis(this,'recientes')"><i class="fas fa-arrow-down"></i> Recientes</button>
      </div>
    </div>
    <div id="ml"><div class="loading"><div class="spinner"></div></div></div>`;
  await cargarCMis();
}

async function cargarCMis() {
  const est=window._cmisFiltro||'todos';
  const orden=window._cmisOrden||'proximas';
  let q=db.from('reservas').select('*, mesas(ubicacion,capacidad)').eq('id_cliente',state.user.id_cliente).order('fecha',{ascending:true});
  if(est!=='todos') q=q.eq('estado_reserva',est);
  const {data}=await q;
  // Ordenar: próximas primero o más recientes primero
  const hoy=new Date().toISOString().split('T')[0];
  let sorted=data||[];
  if(orden==='proximas'){
    const prox=sorted.filter(r=>r.fecha>=hoy).sort((a,b)=>a.fecha.localeCompare(b.fecha));
    const pas=sorted.filter(r=>r.fecha<hoy).sort((a,b)=>b.fecha.localeCompare(a.fecha));
    sorted=[...prox,...pas];
  } else {
    sorted=[...sorted].sort((a,b)=>b.fecha.localeCompare(a.fecha));
  }
  const ml=document.getElementById('ml'); if(!ml) return;
  if(!sorted.length){ml.innerHTML=`<div class="empty-state"><i class="fas fa-calendar-times"></i><h3>Sin reservas</h3><p>¡Haz tu primera reserva!</p><button class="btn btn-gold" style="margin-top:16px" onclick="showCliente('nueva')"><i class="fas fa-plus"></i> Nueva Reserva</button></div>`;return;}
  ml.innerHTML=sorted.map(r=>{
    const can=r.estado_reserva==='cancelada', obs=r.observaciones?.trim();
    return `<div class="reserva-card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div><div class="r-fecha">${r.fecha}</div><div class="r-hora">${r.hora?.substring(0,5)} · ${r.mesas?.ubicacion||'Mesa '+r.id_mesa}</div></div>
        <span class="badge ${can?'badge-error':'badge-success'}">${r.estado_reserva}</span>
      </div>
      <div class="r-details">
        <div class="r-detail"><i class="fas fa-users"></i>${r.numero_personas} personas</div>
        <div class="r-detail"><i class="fas fa-chair"></i>Mesa ${r.id_mesa}</div>
        ${r.mesas?.capacidad?`<div class="r-detail"><i class="fas fa-info-circle"></i>Cap. ${r.mesas.capacidad}</div>`:''}
      </div>
      ${obs?`<div class="r-obs"><i class="fas fa-sticky-note"></i><span>${obs}</span></div>`:''}
      ${!can?`<div class="r-actions">
        <button class="btn btn-info btn-sm" onclick="modalEditarCR(${r.id_reservas})"><i class="fas fa-edit"></i> Editar</button>
        <button class="btn btn-danger btn-sm" onclick="cancelarCR(${r.id_reservas})"><i class="fas fa-ban"></i> Cancelar</button>
      </div>`:''}
    </div>`;
  }).join('');
}

function filtCMis(btn,e){document.querySelectorAll('.cmis-f').forEach(b=>b.classList.remove('active'));btn.classList.add('active');window._cmisFiltro=e;cargarCMis();}
function sortCMis(btn,orden){document.querySelectorAll('.cmis-s').forEach(b=>b.classList.remove('active'));btn.classList.add('active');window._cmisOrden=orden;cargarCMis();}

async function modalEditarCR(id) {
  const {data}=await db.from('reservas').select('*, mesas(capacidad)').eq('id_reservas',id);
  if(!data?.length) return;
  const r=data[0];
  window._editCapacidad = r.mesas?.capacidad || 999;
  window._editMesa = r.id_mesa;
  openModal(`
    <h2><i class="fas fa-edit"></i> Editar Reserva #${r.id_reservas}</h2>
    <div class="form-group"><label>Nueva fecha</label><input class="inp" id="m-fe" type="text" placeholder="Selecciona una fecha..." readonly/></div>
    <div class="form-group"><label>Nueva hora</label>
      <select class="inp" id="m-ho">
        <option value="">Selecciona una hora...</option>
        ${['12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00','22:00']
          .map(h => {
            const [hh] = h.split(':');
            const n = parseInt(hh);
            const label = n === 12 ? '12:00 PM — Mediodía' : n === 22 ? '10:00 PM — Último turno' : `${n > 12 ? n - 12 : n}:00 ${n >= 12 ? 'PM' : 'AM'}`;
            return `<option value="${h}" ${r.hora?.substring(0,5) === h ? 'selected' : ''}>${label}</option>`;
          }).join('')}
      </select>
    </div>
    <div class="form-group"><label>Personas <span style="font-size:11px;color:var(--text-soft)">(máx. ${r.mesas?.capacidad||'?'})</span></label><input class="inp" id="m-pe" type="number" min="1" max="${r.mesas?.capacidad||99}" value="${r.numero_personas}"/></div>
    ${r.observaciones ? `<div class="form-group"><label>Solicitudes especiales</label><div style="background:var(--bg-card2);border:1px solid var(--border);border-radius:8px;padding:10px 14px;font-size:13px;color:var(--text-soft);font-style:italic"><i class='fas fa-sticky-note' style='margin-right:6px;color:var(--gold)'></i>${r.observaciones}</div></div>` : ''}
    <div id="m-e" style="color:var(--error);font-size:12px;display:none;margin-bottom:8px"></div>
    <div class="modal-footer">
      <button class="btn btn-dark" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-gold" onclick="guardarCR(${r.id_reservas})"><i class="fas fa-save"></i> Guardar</button>
    </div>`);
  setTimeout(() => initFlatpickr('m-fe', { defaultDate: r.fecha }), 0);
}

async function guardarCR(id) {
  const feEl=document.getElementById('m-fe'); const fe=feEl._flatpickr ? feEl._flatpickr.input.value : feEl.value;
  const ho=document.getElementById('m-ho').value;
  const pe=document.getElementById('m-pe').value;
  const e=document.getElementById('m-e');
  const hoy=new Date().toISOString().split('T')[0];
  if(fe<hoy){e.textContent='No puedes reservar en una fecha pasada.';e.style.display='block';return;}
  if(parseInt(pe)>(window._editCapacidad||999)){e.textContent=`Esta mesa solo tiene capacidad para ${window._editCapacidad} personas.`;e.style.display='block';return;}
  await db.from('reservas').update({fecha:fe,hora:ho,numero_personas:parseInt(pe)}).eq('id_reservas',id);
  enviarEmailReserva(state.user.correo, state.user.nombre_cliente, {id,fecha:fe,hora:ho,mesa:window._editMesa,personas:pe,estado:'modificada'});
  closeModal(); showToast('Reserva actualizada.','success'); cargarCMis();
}

async function cancelarCR(id) {
  if(!confirm('¿Cancelar esta reserva?')) return;
  const {data:rvArr}=await db.from('reservas').select('fecha,hora,id_mesa,numero_personas').eq('id_reservas',id);
  await db.from('reservas').update({estado_reserva:'cancelada'}).eq('id_reservas',id);
  const rv=rvArr?.[0];
  if(rv) enviarEmailReserva(state.user.correo, state.user.nombre_cliente, {id,fecha:rv.fecha,hora:rv.hora,mesa:rv.id_mesa,personas:rv.numero_personas,estado:'cancelada'});
  showToast('Reserva cancelada.','info'); cargarCMis('todos');
}

async function loadCPerfil() {
  const u=state.user;
  const [{data:td},{data:cf}]=await Promise.all([
    db.from('reservas').select('id_reservas').eq('id_cliente',u.id_cliente),
    db.from('reservas').select('id_reservas').eq('id_cliente',u.id_cliente).eq('estado_reserva','confirmada')
  ]);
  const total=(td||[]).length, act=(cf||[]).length;
  document.getElementById('cc').innerHTML=`
    <h2 style="font-size:20px;font-weight:700;color:var(--text);margin-bottom:20px"><i class="fas fa-user-circle" style="color:var(--gold);margin-right:8px"></i>Mi Perfil</h2>
    <div class="card" style="max-width:460px">
      <div style="text-align:center;margin-bottom:28px">
        <div style="width:80px;height:80px;border-radius:50%;background:${avatarGradient(u.id_cliente)};display:flex;align-items:center;justify-content:center;font-size:30px;font-weight:700;color:#0C0B09;margin:0 auto 14px;font-family:'Playfair Display',serif;box-shadow:0 8px 30px rgba(201,169,110,0.3)">${getInitial(u.nombre_cliente)}</div>
        <h3 style="font-size:20px;font-weight:700;color:var(--text)">${u.nombre_cliente}</h3>
        <span class="badge badge-gold" style="margin-top:6px">Cliente</span>
      </div>
      <div style="background:var(--bg-card2);border-radius:10px;padding:16px;margin-bottom:20px">
        <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
          <i class="fas fa-envelope" style="color:var(--gold);width:16px"></i>
          <span style="font-size:13px;color:var(--text)">${u.correo}</span>
        </div>
        <div style="display:flex;align-items:center;gap:10px;padding:8px 0">
          <i class="fas fa-phone" style="color:var(--gold);width:16px"></i>
          <span style="font-size:13px;color:var(--text)">${u.telefono||'Sin teléfono'}</span>
        </div>
      </div>
      <div class="c-stats" style="margin-bottom:20px">
        <div class="c-stat"><div class="num">${total}</div><div class="lbl">Total</div></div>
        <div class="c-stat"><div class="num" style="color:var(--success)">${act}</div><div class="lbl">Activas</div></div>
        <div class="c-stat"><div class="num" style="color:var(--error)">${total-act}</div><div class="lbl">Canceladas</div></div>
      </div>
      <button class="btn btn-danger btn-full" onclick="logout()"><i class="fas fa-sign-out-alt"></i> Cerrar sesión</button>
    </div>
    <div class="card" style="max-width:460px;margin-top:16px">
      <div class="card-header"><h3><i class="fas fa-user-edit" style="color:var(--gold);margin-right:8px"></i>Editar perfil</h3></div>
      <div class="form-group"><label>Nombre</label><input class="inp" id="p-nom" type="text" value="${u.nombre_cliente}"/></div>
      <div class="form-group"><label>Correo</label><input class="inp" id="p-cor" type="email" value="${u.correo}"/></div>
      <div class="form-group"><label>Teléfono</label><input class="inp" id="p-tel" type="tel" value="${u.telefono||''}" maxlength="10"/></div>
      <div class="form-group"><label>Nueva contraseña <span style="font-size:11px;color:var(--text-soft)">(vacío = no cambiar)</span></label><input class="inp" id="p-pwd" type="password" placeholder="Nueva contraseña..."/></div>
      <div id="p-e" style="color:var(--error);font-size:12px;display:none;margin-bottom:8px;padding:8px;background:rgba(239,83,80,0.08);border-radius:8px"></div>
      <button class="btn btn-gold btn-full" onclick="guardarPerfil()"><i class="fas fa-save"></i> Guardar cambios</button>
    </div>`;
}

async function guardarPerfil() {
  const nom=document.getElementById('p-nom').value.trim();
  const cor=document.getElementById('p-cor').value.trim();
  const tel=document.getElementById('p-tel').value.trim();
  const pwd=document.getElementById('p-pwd').value;
  const e=document.getElementById('p-e');
  if(!nom||!cor){e.textContent='Nombre y correo son obligatorios.';e.style.display='block';return;}
  if(!cor.includes('@')){e.textContent='Correo inválido.';e.style.display='block';return;}
  if(tel&&!/^\d{10}$/.test(tel)){e.textContent='El teléfono debe tener 10 dígitos.';e.style.display='block';return;}
  if(cor!==state.user.correo){
    const {data:ex}=await db.from('clientes').select('id_cliente').eq('correo',cor);
    if(ex?.length>0){e.textContent='Ese correo ya está en uso.';e.style.display='block';return;}
  }
  const datos={nombre_cliente:nom,correo:cor,telefono:tel||null};
  if(pwd) datos.contrasena=await hashPassword(pwd);
  const {error}=await db.from('clientes').update(datos).eq('id_cliente',state.user.id_cliente);
  if(error){e.textContent='Error al guardar.';e.style.display='block';return;}
  state.user={...state.user,...datos};
  showToast('Perfil actualizado. ✅','success');
  loadCPerfil();
}

// ═══════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════
initEmailJS();
checkOAuthSession().then(handled => { if (!handled) showLanding(); });
