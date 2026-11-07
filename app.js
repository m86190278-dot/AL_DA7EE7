/* =========================================================
   الدحيح — منصة تنظيم المذاكرة | الوضع التجريبي (localStorage)
   ========================================================= */
'use strict';

/*
  إعداد Supabase:
  ضع رابط المشروع ومفتاح Publishable (أو anon public) هنا.
  لا تضع أبدًا مفتاح Secret أو service_role في ملفات الواجهة.
*/
const SUPABASE_URL = 'https://yqkajdnxylujrtkeshsq.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_6gkAJgmAo6MKt2kn1_Oamg_sAwR-1vW';
const supabaseReady = !!(window.supabase && SUPABASE_PUBLISHABLE_KEY &&
  !SUPABASE_PUBLISHABLE_KEY.includes('PASTE_YOUR'));
const supabaseClient = supabaseReady
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  : null;

const $ = s => document.querySelector(s);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);
const esc = s => String(s??'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/* ---------- تواريخ بالتوقيت المحلي (مش UTC) ---------- */
const isoOf = d => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const todayISO = () => isoOf(new Date());

/* =========================================================
   التخزين: بيانات منفصلة لكل مستخدم
   ========================================================= */
const LEGACY_KEY  = 'eldaheeh_db_v1';        // النسخة القديمة (مشتركة)
const SESSION_KEY = 'eldaheeh_session_v2';   // المستخدم الحالي
const DATA_PREFIX = 'eldaheeh_data_v2_';     // بيانات كل مستخدم
const freshData = () => ({ subjects:[], tasks:[], sessions:[], events:[], settings:{ studyHours:2 } });
let DB = Object.assign({ user:null }, freshData());

const dataKey = u => DATA_PREFIX + (u && u.demo ? 'demo' : (u && u.id) || 'guest');
function readJSON(k){ try{ return JSON.parse(localStorage.getItem(k)); }catch(e){ return null; } }
function saveDB(){
  if(!DB.user) return;
  try{
    localStorage.setItem(SESSION_KEY, JSON.stringify(DB.user));
    const { user, ...data } = DB;
    localStorage.setItem(dataKey(DB.user), JSON.stringify(data));
  }catch(e){}
}
function setUser(u){
  DB = Object.assign({ user:u }, freshData());
  let d = readJSON(dataKey(u));
  if(!d){
    // ترحيل البيانات القديمة مرة واحدة لأول مستخدم يدخل على هذا الجهاز
    const legacy = readJSON(LEGACY_KEY);
    if(legacy){ d = legacy; try{ localStorage.removeItem(LEGACY_KEY); }catch(e){} }
  }
  if(d){
    DB.subjects = d.subjects || []; DB.tasks = d.tasks || [];
    DB.sessions = d.sessions || []; DB.events = d.events || [];
    DB.settings = Object.assign({ studyHours:2 }, d.settings || {});
  }
  saveDB();
}
function clearUser(){
  DB = Object.assign({ user:null }, freshData());
  try{ localStorage.removeItem(SESSION_KEY); }catch(e){}
}
function loadDB(){
  const u = readJSON(SESSION_KEY) || (readJSON(LEGACY_KEY) || {}).user;
  if(u) setUser(u);
}
const sessionUser = u => ({ id:u.id, name:u.user_metadata?.display_name || u.email?.split('@')[0] || 'طالب الدحيح', email:u.email });

const AR_DAYS=['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
const WEEK_ORDER=[6,0,1,2,3,4,5]; // الأسبوع يبدأ من السبت
const AR_MONTHS=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
function fmtDate(iso){ if(!iso) return ''; const d=new Date(iso+'T00:00:00'); return `${AR_DAYS[d.getDay()]} ${d.getDate()} ${AR_MONTHS[d.getMonth()]} ${d.getFullYear()}`; }
function fmtShort(iso){ if(!iso) return ''; const d=new Date(iso+'T00:00:00'); return `${d.getDate()} ${AR_MONTHS[d.getMonth()]}`; }
function isOverdue(t){ return t.status!=='done' && t.due && t.due < todayISO(); }

/* ---------- toast & confirm ---------- */
function toast(msg,type='success'){
  const w=$('.toast-wrap'); const el=document.createElement('div');
  el.className='toast '+type; el.textContent=msg; w.appendChild(el);
  setTimeout(()=>{ el.style.opacity='0'; el.style.transition='.3s'; setTimeout(()=>el.remove(),300); },2800);
}
function confirmDialog(msg, cb){
  openModal('تأكيد', `<p style="line-height:1.9">${esc(msg)}</p>`, ()=>{ cb(); return true; }, {okText:'نعم، متابعة', danger:true});
}

/* ---------- modal ---------- */
function openModal(title, bodyHTML, onSubmit, opts={}){
  const ov=document.createElement('div'); ov.className='modal-overlay';
  ov.innerHTML=`<div class="modal" role="dialog" aria-modal="true"><h3>${esc(title)}</h3><form id="modalForm" novalidate>${bodyHTML}
    <div class="modal-actions">
      <button type="button" class="btn btn-ghost" data-close>إلغاء</button>
      <button type="submit" class="btn ${opts.danger?'btn-danger':'btn-primary'}">${esc(opts.okText||'حفظ')}</button>
    </div></form></div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click',e=>{ if(e.target===ov) ov.remove(); });
  ov.querySelector('[data-close]').onclick=()=>ov.remove();
  ov.querySelector('#modalForm').addEventListener('submit',e=>{
    e.preventDefault();
    const res=onSubmit(ov);
    if(res!==false) ov.remove();
  });
  const first=ov.querySelector('input,select,textarea'); if(first) first.focus();
  return ov;
}

/* ---------- lookup helpers ---------- */
const subjectById = id => DB.subjects.find(s=>s.id===id);
const subjectName = id => { const s=subjectById(id); return s? s.name : 'بدون مادة'; };
const subjectColor = id => { const s=subjectById(id); return s? s.color : '#64748b'; };
const subjectOptions = sel => DB.subjects.map(s=>`<option value="${s.id}" ${s.id===sel?'selected':''}>${esc(s.name)}</option>`).join('');

/* =========================================================
   Router
   ========================================================= */
const PUBLIC_ROUTES=['#/home','#/login','#/register','#/forgot'];
function go(h){ if(location.hash===h) render(); else location.hash=h; }
function render(){
  const h=location.hash||'#/home';
  const app=$('#view');
  if(DB.user && PUBLIC_ROUTES.includes(h)) return go('#/dashboard');
  if(!DB.user && !PUBLIC_ROUTES.includes(h)){ go('#/login'); return; }
  document.body.classList.toggle('in-app', !!DB.user);
  const V={ '#/home':viewHome,'#/login':viewLogin,'#/register':viewRegister,'#/forgot':viewForgot,
    '#/dashboard':viewDashboard,'#/subjects':viewSubjects,'#/schedule':viewSchedule,
    '#/tasks':viewTasks,'#/calendar':viewCalendar,'#/settings':viewSettings };
  (V[h]||viewHome)(app);
  updateHeader();
  updateSidebar(h);
  window.scrollTo(0,0);
}
function updateSidebar(h){
  const sb=$('#sidebar'); if(!sb) return;
  sb.querySelectorAll('.side-link').forEach(a=>a.classList.toggle('active', a.getAttribute('href')===h));
}

/* الانتقال لقسم المميزات بدون ما نكسر الراوتر */
document.addEventListener('click', e=>{
  const a=e.target.closest('[data-features]'); if(!a) return;
  e.preventDefault();
  const scroll=()=>document.getElementById('features')?.scrollIntoView({behavior:'smooth'});
  if((location.hash||'#/home')!=='#/home'){ go('#/home'); setTimeout(scroll,120); } else scroll();
});

const ICO={
 home:'<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>',
 book:'<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4H6.5A2.5 2.5 0 0 0 4 6.5v13z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-2.5"/></svg>',
 cal:'<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>',
 clock:'<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
 check:'<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M9 11l3 3 8-8"/><path d="M21 12v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h11"/></svg>',
 gear:'<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.9 2.9l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.9-2.9l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.9-2.9l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.5h.1a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.9 2.9l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1z"/></svg>',
 logout:'<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>',
 spark:'<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/></svg>'
};
const LOGO = `<svg viewBox="0 0 64 64" width="56" height="56" fill="none" aria-hidden="true">
 <path d="M32 46c-5-4-12-5-18-4V20c6-1 13 0 18 4 5-4 12-5 18-4v22c-6-1-13 0-18 4z" fill="#0d9488" opacity=".15"/>
 <path d="M32 46c-5-4-12-5-18-4V20c6-1 13 0 18 4 5-4 12-5 18-4v22c-6-1-13 0-18 4z" stroke="#0f766e" stroke-width="2.5" stroke-linejoin="round"/>
 <path d="M32 24v22" stroke="#0f766e" stroke-width="2.5"/>
 <path d="M39 8a7 7 0 0 1 7 7c0 2-1 3.4-2.2 4.6L43 22h-8l-.8-2.4A7 7 0 0 1 39 8z" fill="#fbbf24" stroke="#d97706" stroke-width="1.6"/>
 <path d="M39 22v6" stroke="#d97706" stroke-width="2" stroke-linecap="round"/>
 <path d="m36 28 3 3 3-3" stroke="#d97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

function updateHeader(){
  const hd=$('#siteHeader .header-actions'); if(!hd) return;
  hd.innerHTML = DB.user
    ? `<span style="font-weight:700;color:var(--muted);font-size:.9rem">أهلاً، ${esc(DB.user.name)}</span>
       <a class="btn btn-primary btn-sm" href="#/dashboard">لوحة التحكم</a>
       <button class="btn btn-ghost btn-sm" id="hdrLogout">تسجيل الخروج</button>`
    : `<a class="btn btn-ghost btn-sm" href="#/login">تسجيل الدخول</a>
       <a class="btn btn-primary btn-sm" href="#/register">إنشاء حساب</a>`;
  const lo=$('#hdrLogout'); if(lo) lo.onclick=doLogout;
}
function doLogout(){
  confirmDialog('متأكد إنك عايز تسجّل خروجك من الدحيح؟', ()=>{
    const finish=()=>{ clearUser(); toast('تم تسجيل الخروج. إلى اللقاء!'); go('#/home'); };
    if(supabaseClient && !DB.user?.demo) {
      supabaseClient.auth.signOut().then(({error})=>{
        if(error){ toast('تعذر تسجيل الخروج من الحساب: '+error.message,'error'); return; }
        finish();
      });
    } else finish();
  });
}

/* =========================================================
   Views — public pages
   ========================================================= */
function viewHome(app){
  app.innerHTML = `
  <section class="hero">
    <div>
      <h1>ذاكر بذكاء، ونظّم يومك مع الدحيح</h1>
      <p>الدحيح هو مساعدك الدراسي لتنظيم المواد والمواعيد والواجبات وجلسات المذاكرة، عشان تقدر تتابع تقدمك وتذاكر بطريقة أكثر تنظيمًا.</p>
      <div class="hero-btns">
        <a class="btn btn-primary" href="#/register">ابدأ تنظيم مذاكرتك</a>
        <a class="btn btn-ghost" href="#/home" data-features>اكتشف المميزات</a>
      </div>
    </div>
    <div class="hero-art">
      <div class="panel" style="margin:0">
        <h3>لوحة تحكمك في لمحة 👀</h3>
        <div class="list-row"><span>📚</span><span class="grow">محاضرة رياضيات — 10 صباحًا</span><span class="tag tag-doing">قيد التنفيذ</span></div>
        <div class="list-row"><span>✅</span><span class="grow">واجب الفيزياء</span><span class="tag tag-done">مكتملة</span></div>
        <div class="list-row"><span>🧠</span><span class="grow">جلسة مراجعة — 45 دقيقة</span><span class="tag tag-med">اليوم</span></div>
        <div class="progressbar" style="margin-top:14px"><div style="width:70%"></div></div>
        <p style="font-size:.8rem;margin:6px 0 0;color:var(--muted)">نسبة إنجاز الأسبوع: 70%</p>
      </div>
    </div>
  </section>

  <section class="section" id="features">
    <h2>مميزات الدحيح</h2>
    <p class="lead">كل اللي محتاجه الطالب عشان يذاكر بتركيز، في مكان واحد وبسيط.</p>
    <div class="grid3">
      <div class="card"><div class="icon-badge">${ICO.book}</div><h3>إدارة المواد الدراسية</h3><p>أضف موادك، لون كل مادة، بيانات المدرس أو الدكتور، وجدول المحاضرات، كل حاجة في مكان واحد.</p></div>
      <div class="card"><div class="icon-badge">${ICO.clock}</div><h3>جدول مذاكرة أسبوعي</h3><p>خطط لجلسات مذاكرتك باليوم والساعة، وتابع اللي خلصته واللي لسه.</p></div>
      <div class="card"><div class="icon-badge">${ICO.check}</div><h3>مهام وواجبات مرتبة</h3><p>سجل واجباتك بموعد التسليم والأولوية، والدحيح يفكرك بالمتأخر منها.</p></div>
      <div class="card"><div class="icon-badge">${ICO.cal}</div><h3>تقويم دراسي موحّد</h3><p>شوف الواجبات والامتحانات وجلسات المذاكرة كلها على تقويم واحد ملوّن.</p></div>
      <div class="card"><div class="icon-badge">${ICO.spark}</div><h3>متابعة تقدمك</h3><p>نسبة الإنجاز وإحصائياتك تتحسب من بياناتك الحقيقية، مش أرقام جاهزة.</p></div>
      <div class="card"><div class="icon-badge">${ICO.home}</div><h3>يعمل على أي جهاز</h3><p>تصميم متجاوب يشتغل ممتاز على الموبايل والكمبيوتر والتابلت.</p></div>
    </div>
  </section>

  <section class="section">
    <h2>إزاي تستخدم الدحيح؟</h2>
    <p class="lead">ثلاث خطوات بس وتبدأ رحلة تنظيم مذاكرتك.</p>
    <div class="grid3">
      <div class="card" style="text-align:center"><div style="font-size:2.2rem;font-weight:800;color:var(--primary)">١</div><h3>أنشئ حسابك</h3><p>سجّل في ثواني وابدأ استخدم المنصة فورًا.</p></div>
      <div class="card" style="text-align:center"><div style="font-size:2.2rem;font-weight:800;color:var(--primary)">٢</div><h3>أضف موادك ومهامك</h3><p>سجل المواد الدراسية والواجبات ومواعيد الامتحانات وجلسات المذاكرة.</p></div>
      <div class="card" style="text-align:center"><div style="font-size:2.2rem;font-weight:800;color:var(--primary)">٣</div><h3>ذاكر بنظام</h3><p>تابع جدولك اليومي ونسبة تقدمك، وقلل التشتت وذاكر بتركيز.</p></div>
    </div>
  </section>

  <section class="section">
    <h2>الدحيح مصمم لمين؟</h2>
    <p class="lead">لأي طالب عايز ينظم وقته ومذاكرته، بغض النظر عن مستواه التقني.</p>
    <div class="grid4">
      <div class="card"><h3>🎓 طلاب الجامعات</h3><p>تابع مواد السمنستر والمحاضرات والواجبات والكويزات.</p></div>
      <div class="card"><h3>🔧 طلاب المعاهد الفنية</h3><p>نظم موادك العملية والنظرية في جدول واحد.</p></div>
      <div class="card"><h3>📖 طلاب الثانوية العامة</h3><p>خطط لمذاكرة المواد الأساسية وتابع تقدمك يوم بيوم.</p></div>
      <div class="card"><h3>⏰ اللي بيتشتت</h3><p>واجهة بسيطة ورسائل واضحة تخليك تركز على المذاكرة بس.</p></div>
    </div>
  </section>

  <section class="section">
    <h2>الأسئلة الشائعة</h2>
    <div style="max-width:760px;margin:auto">
      ${[['هل استخدام الدحيح مجاني؟','أيوه، النسخة الحالية مجانية بالكامل.'],
         ['هل بياناتي آمنة؟','تسجيل الدخول بيتم عبر Supabase بشكل آمن. أما بيانات المذاكرة (المواد والمهام والجلسات) فحاليًا بتتحفظ في متصفحك على جهازك فقط، ومفصولة لكل حساب. جاري العمل على تخزينها في السحابة.'],
         ['هل الدحيح يشتغل على الموبايل؟','أيوه، الموقع متجاوب بالكامل ويشتغل على الموبايل والكمبيوتر والتابلت.'],
         ['إيه اللي يحصل لو مسحت بيانات المتصفح؟','بيانات المذاكرة هتتحذف لأنها محفوظة محليًا — استخدم زر "تصدير نسخة احتياطية" من الإعدادات لحد ما نفعّل التخزين السحابي. حسابك نفسه هيفضل موجود.'],
         ['هل فيه اشتراكات مدفوعة؟','لأ، النسخة الأولى مجانية بالكامل ومركزة على الوظائف الأساسية للتنظيم الدراسي.']]
        .map((f,i)=>`<div class="faq-item" id="faq${i}"><button class="faq-q" data-faq="${i}"><span>${f[0]}</span><span>＋</span></button><div class="faq-a">${f[1]}</div></div>`).join('')}
    </div>
  </section>`;
  app.querySelectorAll('.faq-q').forEach(b=>b.onclick=()=>{
    const it=b.closest('.faq-item'); const open=it.classList.toggle('open');
    b.querySelector('span:last-child').textContent = open?'−':'＋';
  });
}

/* ---------- auth ---------- */
function fieldHTML(id,label,type,opts){
  if(type && typeof type==='object'){ opts=type; type='text'; }   // حماية من تمرير opts مكان type
  type=type||'text'; opts=opts||{};
  return `<div class="field" id="fw-${id}"><label for="${id}">${label}</label>
    <input id="${id}" type="${type}" ${opts.attrs||''} placeholder="${opts.ph||''}">
    <div class="err">${opts.err||'هذا الحقل مطلوب'}</div></div>`;
}
function selectFieldHTML(id,label,optionsHTML,err){
  return `<div class="field" id="fw-${id}"><label for="${id}">${label}</label>
    <select id="${id}"><option value="">— اختر المادة —</option>${optionsHTML}</select>
    <div class="err">${err||'هذا الحقل مطلوب'}</div></div>`;
}
function setInvalid(id,bad,msg){
  const fw=$('#fw-'+id); if(!fw) return !bad;
  fw.classList.toggle('invalid',bad);
  if(bad&&msg) fw.querySelector('.err').textContent=msg;
  return !bad;
}

function viewLogin(app){
  app.innerHTML = `<div class="auth-wrap"><div class="auth-card">
    <div class="auth-logo">${LOGO}</div>
    <h2>أهلًا بيك في الدحيح!</h2>
    <p class="sub">سجّل دخولك وكمّل تنظيم مذاكرتك</p>
    <div class="demo-note">🔐 تسجيل الدخول الحقيقي متاح من خلال Supabase. بيانات المذاكرة في النسخة الحالية محفوظة محليًا على هذا الجهاز.</div>
    <form id="loginForm" novalidate>
      ${fieldHTML('email','البريد الإلكتروني','email',{ph:'name@example.com',err:'أدخل بريدًا إلكترونيًا صحيحًا'})}
      ${fieldHTML('pass','كلمة المرور','password',{ph:'••••••••',err:'كلمة المرور مطلوبة'})}
      <button class="btn btn-primary btn-block" type="submit" style="margin-top:6px">تسجيل الدخول</button>
    </form>
    <div style="display:flex;justify-content:space-between;margin-top:14px;font-size:.88rem;flex-wrap:wrap;gap:8px">
      <a href="#/forgot">نسيت كلمة المرور؟</a>
      <a href="#/register">مش عندك حساب؟ أنشئ حسابًا</a>
    </div>
    <hr style="border:none;border-top:1px dashed #d7e8e4;margin:18px 0">
    <button class="btn btn-ghost btn-block" id="demoBtn">الدخول التجريبي بدون حساب</button>
  </div></div>`;
  $('#loginForm').onsubmit=async e=>{
    e.preventDefault();
    const em=$('#email').value.trim(), pw=$('#pass').value;
    const okE=setInvalid('email', !EMAIL_RE.test(em));
    const okP=setInvalid('pass', !pw);
    if(!okE||!okP) return;
    if(!supabaseClient){ toast('أضف مفتاح Supabase العام في app.js أولًا','error'); return; }
    const btn=$('#loginForm button[type="submit"]'); btn.disabled=true; btn.textContent='جاري تسجيل الدخول…';
    const {data,error}=await supabaseClient.auth.signInWithPassword({email:em,password:pw});
    btn.disabled=false; btn.textContent='تسجيل الدخول';
    if(error){ setInvalid('pass',true,error.message); toast('تعذر تسجيل الدخول. راجع البريد وكلمة المرور.','error'); return; }
    setUser(sessionUser(data.user));
    toast('أهلًا بيك! تم تسجيل الدخول بنجاح.');
    go('#/dashboard');
  };
  $('#demoBtn').onclick=()=>{
    setUser({name:'طالب الدحيح',email:'demo@eldaheeh.app',demo:true});
    toast('دخلت تجربة محلية — بياناتها على هذا الجهاز فقط'); go('#/dashboard');
  };
}
function viewRegister(app){
  app.innerHTML = `<div class="auth-wrap"><div class="auth-card">
    <div class="auth-logo">${LOGO}</div>
    <h2>أنشئ حسابك في الدحيح</h2>
    <p class="sub">دقيقة واحدة وتبدأ رحلة تنظيم مذاكرتك</p>
    <div class="demo-note">🔐 الحساب يُنشأ عبر Supabase. قد تحتاج لتأكيد بريدك الإلكتروني قبل تسجيل الدخول.</div>
    <form id="regForm" novalidate>
      ${fieldHTML('name','الاسم الظاهر','text',{ph:'اكتب اسمك'})}
      ${fieldHTML('email','البريد الإلكتروني','email',{ph:'name@example.com',err:'أدخل بريدًا إلكترونيًا صحيحًا'})}
      ${fieldHTML('pass','كلمة المرور','password',{ph:'6 أحرف على الأقل',err:'كلمة المرور 6 أحرف على الأقل'})}
      ${fieldHTML('pass2','تأكيد كلمة المرور','password',{ph:'••••••••',err:'كلمتا المرور غير متطابقتين'})}
      <button class="btn btn-primary btn-block" type="submit" style="margin-top:6px">إنشاء الحساب</button>
    </form>
    <p style="text-align:center;margin-top:14px;font-size:.88rem">عندك حساب بالفعل؟ <a href="#/login">سجّل دخولك</a></p>
  </div></div>`;
  $('#regForm').onsubmit=async e=>{
    e.preventDefault();
    const name=$('#name').value.trim(), em=$('#email').value.trim(), pw=$('#pass').value, pw2=$('#pass2').value;
    let ok=true;
    ok = setInvalid('name', !name) && ok;
    ok = setInvalid('email', !EMAIL_RE.test(em)) && ok;
    ok = setInvalid('pass', pw.length<6) && ok;
    ok = setInvalid('pass2', pw!==pw2 || !pw2) && ok;
    if(!ok){ toast('راجع البيانات المطلوبة قبل المتابعة','error'); return; }
    if(!supabaseClient){ toast('أضف مفتاح Supabase العام في app.js أولًا','error'); return; }
    const btn=$('#regForm button[type="submit"]'); btn.disabled=true; btn.textContent='جاري إنشاء الحساب…';
    const {data,error}=await supabaseClient.auth.signUp({
      email:em,password:pw,options:{data:{display_name:name}}
    });
    btn.disabled=false; btn.textContent='إنشاء الحساب';
    if(error){ setInvalid('email',true,error.message); toast('تعذر إنشاء الحساب: '+error.message,'error'); return; }
    if(data.session && data.user){
      setUser({id:data.user.id,name,email:em});
      toast('تم إنشاء الحساب بنجاح!'); go('#/dashboard');
    } else {
      openModal('راجع بريدك الإلكتروني ✉️',
        `<p style="line-height:2">تم إنشاء الحساب. لو تأكيد البريد الإلكتروني مفعّل في Supabase، افتح رسالة التأكيد المرسلة إلى <strong>${esc(em)}</strong> ثم ارجع وسجّل دخولك.</p>`,
        ()=>{go('#/login');return true;},{okText:'الذهاب لتسجيل الدخول'});
    }
  };
}
function viewForgot(app){
  app.innerHTML = `<div class="auth-wrap"><div class="auth-card">
    <div class="auth-logo">${LOGO}</div>
    <h2>استعادة كلمة المرور</h2>
    <p class="sub">أدخل بريدك وهنرسل لك رابط الاستعادة</p>
    <div class="demo-note">لو حسابك موجود، Supabase هيبعت لك رسالة استعادة على بريدك.</div>
    <form id="forgotForm" novalidate>
      ${fieldHTML('email','البريد الإلكتروني','email',{ph:'name@example.com',err:'أدخل بريدًا إلكترونيًا صحيحًا'})}
      <button class="btn btn-primary btn-block" type="submit" style="margin-top:6px">إرسال رابط الاستعادة</button>
    </form>
    <p style="text-align:center;margin-top:14px;font-size:.88rem"><a href="#/login">← رجوع لتسجيل الدخول</a></p>
  </div></div>`;
  $('#forgotForm').onsubmit=async e=>{
    e.preventDefault();
    const em=$('#email').value.trim();
    if(!setInvalid('email', !EMAIL_RE.test(em))) return;
    if(!supabaseClient){ toast('أضف مفتاح Supabase العام في app.js أولًا','error'); return; }
    const {error}=await supabaseClient.auth.resetPasswordForEmail(em,{redirectTo:location.origin+location.pathname});
    if(error){toast('تعذر إرسال الرابط: '+error.message,'error');return;}
    openModal('تم إرسال الطلب ✉️',`<p style="line-height:2">لو البريد مرتبط بحساب، هيوصلك رابط استعادة كلمة المرور على <strong>${esc(em)}</strong>.</p>`,()=>true,{okText:'تمام'});
  };
}

/* =========================================================
   App shell + Dashboard
   ========================================================= */
function appShell(inner){
  return `<div class="demo-banner">☁️ <strong>الحساب:</strong> تسجيل الدخول عبر Supabase. <strong>بيانات المذاكرة:</strong> محفوظة محليًا على هذا الجهاز في هذه المرحلة.</div>
  <div class="app-shell">
    <aside class="sidebar" id="sidebar">
      <div class="brand">${LOGO} الدحيح</div>
      <a class="side-link" href="#/dashboard">${ICO.home} الرئيسية</a>
      <a class="side-link" href="#/subjects">${ICO.book} المواد الدراسية</a>
      <a class="side-link" href="#/schedule">${ICO.clock} جدول المذاكرة</a>
      <a class="side-link" href="#/tasks">${ICO.check} المهام والواجبات</a>
      <a class="side-link" href="#/calendar">${ICO.cal} التقويم الدراسي</a>
      <a class="side-link" href="#/settings">${ICO.gear} الإعدادات</a>
      <div class="spacer"></div>
      <button class="side-link side-btn" id="sideLogout">${ICO.logout} تسجيل الخروج</button>
    </aside>
    <main class="main-area" id="mainArea">${inner}</main>
  </div>`;
}
function mountShell(app, inner){
  app.innerHTML = appShell(inner);
  $('#sideLogout').onclick=doLogout;
}

function weekProgress(){
  const now=new Date(); const day=(now.getDay()+1)%7; // السبت = بداية الأسبوع
  const start=new Date(now.getFullYear(), now.getMonth(), now.getDate()-day); // منتصف الليل
  const end=new Date(start); end.setDate(start.getDate()+7);
  const inWeek = d => { if(!d) return false; const x=new Date(d+'T00:00:00'); return x>=start && x<end; };
  const wk=DB.tasks.filter(t=>inWeek(t.due)||inWeek((t.createdAt||'').slice(0,10)));
  if(!wk.length) return null;
  return Math.round(wk.filter(t=>t.status==='done').length / wk.length * 100);
}

function viewDashboard(app){
  const t=todayISO();
  const todaySessions=DB.sessions.filter(s=>s.date===t).sort((a,b)=>(a.start||'').localeCompare(b.start||''));
  const upcomingTasks=DB.tasks.filter(x=>x.status!=='done').sort((a,b)=>(a.due||'').localeCompare(b.due||'')).slice(0,5);
  const upcomingExams=DB.events.filter(e=>e.type==='exam'&&e.date>=t).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,4);
  const done=DB.tasks.filter(x=>x.status==='done').length;
  const open=DB.tasks.length-done;
  const prog=weekProgress();
  mountShell(app, `
    <div class="welcome">
      <h2>أهلًا بيك يا ${esc(DB.user.name)}! 👋</h2>
      <div>${fmtDate(t)}</div>
      <div style="margin-top:10px;font-size:.92rem;opacity:.92">يلا نبدأ ننظم مذاكرتك — عندك ${open} مهمة مفتوحة النهاردة.</div>
    </div>
    <div class="stat-grid">
      <div class="stat-card"><div class="num">${DB.subjects.length}</div><div class="lbl">📚 مادة دراسية</div></div>
      <div class="stat-card"><div class="num">${open}</div><div class="lbl">⏳ مهمة غير مكتملة</div></div>
      <div class="stat-card"><div class="num">${done}</div><div class="lbl">✅ مهمة مكتملة</div></div>
      <div class="stat-card"><div class="num">${prog===null?'—':prog+'%'}</div><div class="lbl">📈 تقدمك الأسبوعي</div>
        ${prog!==null?`<div class="progressbar" style="margin-top:8px"><div style="width:${prog}%"></div></div>`:''}</div>
    </div>
    <div class="two-col">
      <div class="panel">
        <h3>📅 جدول مذاكرة اليوم</h3>
        ${todaySessions.length ? todaySessions.map(s=>`
          <div class="list-row">
            <span style="color:${subjectColor(s.subjectId)};font-size:1.2rem">●</span>
            <span class="grow">${esc(s.title)} <small style="color:var(--muted)">(${esc(subjectName(s.subjectId))})</small></span>
            <span class="tag ${s.done?'tag-done':'tag-todo'}">${s.done?'مكتملة':esc(s.start)+' - '+esc(s.end)}</span>
          </div>`).join('')
        : `<div class="empty"><div class="big">🗓️</div>مفيش جلسات مذاكرة النهاردة.<br><a href="#/schedule">أضف جلسة من جدول المذاكرة</a></div>`}
      </div>
      <div class="panel">
        <h3>✏️ الواجبات القادمة</h3>
        ${upcomingTasks.length ? upcomingTasks.map(x=>`
          <div class="list-row">
            <input type="checkbox" class="chk" data-quickdone="${x.id}" ${x.status==='done'?'checked':''}>
            <span class="grow">${esc(x.title)} <small style="color:var(--muted)">(${esc(subjectName(x.subjectId))})</small><br>
              <small class="${isOverdue(x)?'overdue':''}" style="color:var(--muted)">${isOverdue(x)?'⚠️ تأخرت! التسليم كان ':''}${fmtShort(x.due)}</small></span>
            <span class="tag tag-${x.priority==='high'?'high':x.priority==='low'?'low':'med'}">${x.priority==='high'?'عالية':x.priority==='low'?'منخفضة':'متوسطة'}</span>
          </div>`).join('')
        : `<div class="empty"><div class="big">🎉</div>مفيش واجبات معلّقة — الوضع ممتاز!</div>`}
      </div>
    </div>
    <div class="two-col">
      <div class="panel">
        <h3>📝 الامتحانات القادمة</h3>
        ${upcomingExams.length ? upcomingExams.map(e=>`
          <div class="list-row"><span style="color:#f43f5e">📝</span>
            <span class="grow">${esc(e.title)} <small style="color:var(--muted)">(${esc(subjectName(e.subjectId))})</small></span>
            <span class="tag tag-exam">${fmtShort(e.date)}</span></div>`).join('')
        : `<div class="empty"><div class="big">😌</div>مفيش امتحانات قادمة مسجّلة.</div>`}
      </div>
      <div class="panel">
        <h3>⚡ وصول سريع</h3>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <a class="btn btn-primary btn-sm" href="#/subjects">+ أضف مادة</a>
          <a class="btn btn-ghost btn-sm" href="#/tasks">+ أضف مهمة</a>
          <a class="btn btn-ghost btn-sm" href="#/schedule">+ أضف جلسة مذاكرة</a>
          <a class="btn btn-ghost btn-sm" href="#/calendar">+ أضف حدث</a>
        </div>
        <p style="color:var(--muted);font-size:.88rem;margin-top:14px;line-height:1.9">لو لسه جديد: ابدأ بإضافة أول مادة دراسية، وبعدها سجّل واجباتك وجلسات مذاكرتك.</p>
      </div>
    </div>`);
  document.querySelectorAll('[data-quickdone]').forEach(c=>c.onchange=()=>{
    const x=DB.tasks.find(t2=>t2.id===c.dataset.quickdone);
    if(x){ x.status=c.checked?'done':'todo'; saveDB(); toast(c.checked?'ممتاز! خلصت المهمة دي 🎉':'رجّعنا المهمة للقائمة'); render(); }
  });
}

/* =========================================================
   Views — Subjects
   ========================================================= */
const SUBJECT_COLORS=['#0d9488','#10b981','#0891b2','#6366f1','#8b5cf6','#d946ef','#f43f5e','#f59e0b','#64748b'];

function subjectModal(s){
  const isEdit=!!s; s=s||{};
  let chosen = s.color || SUBJECT_COLORS[0];
  const ov=openModal(isEdit?'تعديل المادة':'إضافة مادة جديدة', `
    ${fieldHTML('sName','اسم المادة *','text',{ph:'مثال: رياضيات متقدمة',err:'اسم المادة مطلوب'})}
    ${fieldHTML('sTeacher','اسم المدرس / الدكتور','text',{ph:'اختياري'})}
    <div class="field"><label>لون المادة</label>
      <div style="display:flex;gap:8px;flex-wrap:wrap" id="colorPick">
        ${SUBJECT_COLORS.map(c=>`<button type="button" class="color-dot ${c===chosen?'selected':''}" data-c="${c}" style="background:${c}" aria-label="لون"></button>`).join('')}
      </div></div>
    <div class="field"><label for="sNotes">ملاحظات</label><textarea id="sNotes" rows="3" placeholder="اختياري"></textarea></div>
    <div class="field"><label for="sLectures">جدول المحاضرات (اختياري)</label>
      <input id="sLectures" placeholder="مثال: الأحد والثلاثاء 10-12، قاعة 5"></div>
  `,(m)=>{
    const name=m.querySelector('#sName').value.trim();
    if(!setInvalid('sName', !name)) return false;
    const data={name, teacher:m.querySelector('#sTeacher').value.trim(), color:chosen,
      notes:m.querySelector('#sNotes').value.trim(), lectures:m.querySelector('#sLectures').value.trim()};
    if(isEdit) Object.assign(subjectById(s.id), data);
    else DB.subjects.push({id:uid(), createdAt:new Date().toISOString(), ...data});
    saveDB(); toast(isEdit?'تم حفظ التغييرات بنجاح ✅':'تمت إضافة المادة بنجاح 🎉'); render(); return true;
  },{okText:isEdit?'حفظ التعديلات':'إضافة المادة'});
  ov.querySelector('#sName').value=s.name||'';
  ov.querySelector('#sTeacher').value=s.teacher||'';
  ov.querySelector('#sNotes').value=s.notes||'';
  ov.querySelector('#sLectures').value=s.lectures||'';
  ov.querySelectorAll('.color-dot').forEach(b=>b.onclick=()=>{
    chosen=b.dataset.c;
    ov.querySelectorAll('.color-dot').forEach(x=>x.classList.toggle('selected',x===b));
  });
}
function subjectDetailModal(s){
  const ts=DB.tasks.filter(t=>t.subjectId===s.id), ss=DB.sessions.filter(x=>x.subjectId===s.id);
  const done=ts.filter(t=>t.status==='done').length;
  const prog=ts.length?Math.round(done/ts.length*100):0;
  openModal('تفاصيل المادة', `
    <div style="border-inline-start:5px solid ${s.color};padding-inline-start:12px;margin-bottom:16px">
      <h3 style="margin:0">${esc(s.name)}</h3>
      ${s.teacher?`<div style="color:var(--muted);font-size:.9rem">👨‍🏫 ${esc(s.teacher)}</div>`:''}
    </div>
    <p style="line-height:2">
      <strong>الواجبات:</strong> ${ts.length} (${done} مكتملة)<br>
      <strong>جلسات المذاكرة:</strong> ${ss.length} (${ss.filter(x=>x.done).length} مكتملة)<br>
      ${s.lectures?`<strong>المحاضرات:</strong> ${esc(s.lectures)}<br>`:''}
      ${s.notes?`<strong>ملاحظات:</strong> ${esc(s.notes)}`:''}
    </p>
    <div class="progressbar"><div style="width:${prog}%"></div></div>
    <p style="font-size:.82rem;color:var(--muted);margin-top:6px">مؤشر التقدم الدراسي: ${prog}%</p>
  `,()=>true,{okText:'إغلاق'});
}

function viewSubjects(app){
  mountShell(app, `
    <div class="page-head">
      <h2>📚 المواد الدراسية</h2>
      <button class="btn btn-primary" id="addSubject">+ إضافة مادة</button>
    </div>
    <div id="subjectWrap">
    ${DB.subjects.length ? `<div class="subject-grid">${DB.subjects.map(s=>{
        const ts=DB.tasks.filter(t=>t.subjectId===s.id), ss=DB.sessions.filter(x=>x.subjectId===s.id);
        const done=ts.filter(t=>t.status==='done').length;
        const prog=ts.length?Math.round(done/ts.length*100):0;
        return `<div class="subject-card" style="border-top-color:${s.color}">
          <h3>${esc(s.name)}</h3>
          <div class="meta">${s.teacher?esc(s.teacher)+' · ':''}${s.lectures?esc(s.lectures):''}</div>
          <div style="font-size:.85rem;color:var(--muted)">✏️ ${ts.length} واجبات &nbsp;·&nbsp; ⏱️ ${ss.length} جلسة مذاكرة</div>
          <div class="progressbar" style="margin-top:10px"><div style="width:${prog}%"></div></div>
          <div style="font-size:.78rem;color:var(--muted);margin-top:4px">التقدم: ${prog}%</div>
          <div class="row">
            <button class="btn btn-ghost btn-sm" data-view="${s.id}">التفاصيل</button>
            <button class="btn btn-ghost btn-sm" data-edit="${s.id}">تعديل</button>
            <button class="btn btn-danger btn-sm" data-del="${s.id}">حذف</button>
          </div>
        </div>`;}).join('')}</div>`
      : `<div class="card"><div class="empty"><div class="big">📚</div>
          لسه مفيش مواد دراسية. ابدأ بإضافة أول مادة!<br>
          <button class="btn btn-primary" id="emptyAdd" style="margin-top:12px">+ أضف أول مادة دراسية</button></div></div>`}
    </div>`);
  $('#addSubject').onclick=()=>subjectModal(null);
  const ea=$('#emptyAdd'); if(ea) ea.onclick=()=>subjectModal(null);
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>subjectDetailModal(subjectById(b.dataset.view)));
  document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>subjectModal(subjectById(b.dataset.edit)));
  document.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{
    const s=subjectById(b.dataset.del);
    confirmDialog(`حذف مادة «${s.name}»؟ الواجبات وجلسات المذاكرة المرتبطة بيها هتفضل موجودة لكن من غير مادة.`,()=>{
      DB.subjects=DB.subjects.filter(x=>x.id!==s.id); saveDB(); toast('تم حذف المادة'); render();
    });
  });
}

/* =========================================================
   Views — Weekly schedule
   ========================================================= */
let schedOffset=0;
function sessionModal(s, presetDate){
  const isEdit=!!s; s=s||{};
  if(!DB.subjects.length){
    toast('أضف مادة دراسية الأول قبل إضافة جلسة مذاكرة','error');
    openModal('محتاج مادة أولًا',`<p style="line-height:2">عشان تنظم جلسة مذاكرة لازم يكون عندك مادة دراسية. أضف واحدة دلوقتي؟</p>`,()=>{ go('#/subjects'); return true; },{okText:'روح لإضافة مادة'});
    return;
  }
  const ov=openModal(isEdit?'تعديل جلسة المذاكرة':'أضف جلسة مذاكرة', `
    ${selectFieldHTML('ssSub','المادة الدراسية *',subjectOptions(s.subjectId),'اختر المادة الدراسية')}
    ${fieldHTML('ssTitle','عنوان الجلسة *','text',{ph:'مثال: مراجعة الفصل الثالث',err:'عنوان الجلسة مطلوب'})}
    ${fieldHTML('ssDate','التاريخ *','date',{err:'اختر التاريخ'})}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      ${fieldHTML('ssStart','وقت البداية *','time',{err:'مطلوب'})}
      ${fieldHTML('ssEnd','وقت النهاية *','time',{err:'مطلوب'})}
    </div>
    <div class="field"><label for="ssNotes">ملاحظات</label><textarea id="ssNotes" rows="2" placeholder="اختياري"></textarea></div>
  `,(m)=>{
    const sub=m.querySelector('#ssSub').value, title=m.querySelector('#ssTitle').value.trim();
    const date=m.querySelector('#ssDate').value, st=m.querySelector('#ssStart').value, en=m.querySelector('#ssEnd').value;
    let ok=true;
    ok=setInvalid('ssSub',!sub)&&ok; ok=setInvalid('ssTitle',!title)&&ok;
    ok=setInvalid('ssDate',!date)&&ok; ok=setInvalid('ssStart',!st)&&ok; ok=setInvalid('ssEnd',!en)&&ok;
    if(st&&en&&en<=st){ setInvalid('ssEnd',true,'وقت النهاية لازم يكون بعد البداية'); ok=false; }
    if(!ok) return false;
    const data={subjectId:sub,title,date,start:st,end:en,notes:m.querySelector('#ssNotes').value.trim()};
    if(isEdit) Object.assign(DB.sessions.find(x=>x.id===s.id),data);
    else DB.sessions.push({id:uid(),done:false,createdAt:new Date().toISOString(),...data});
    saveDB(); toast(isEdit?'تم حفظ التعديلات ✅':'تمت إضافة الجلسة 🎉'); render(); return true;
  },{okText:isEdit?'حفظ':'إضافة الجلسة'});
  ov.querySelector('#ssTitle').value=s.title||'';
  ov.querySelector('#ssDate').value=s.date||presetDate||todayISO();
  ov.querySelector('#ssStart').value=s.start||'17:00'; ov.querySelector('#ssEnd').value=s.end||'18:00';
  ov.querySelector('#ssNotes').value=s.notes||'';
}

function viewSchedule(app){
  const now=new Date(); now.setDate(now.getDate()+schedOffset); const dow=(now.getDay()+1)%7;
  const start=new Date(now.getFullYear(), now.getMonth(), now.getDate()-dow);
  const days=[...Array(7)].map((_,i)=>new Date(start.getFullYear(), start.getMonth(), start.getDate()+i));
  const isos=days.map(isoOf);
  const weekSessions=DB.sessions.filter(s=>isos.includes(s.date));
  mountShell(app, `
    <div class="page-head">
      <h2>⏱️ جدول المذاكرة الأسبوعي</h2>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" id="prevW">‹ الأسبوع السابق</button>
        <strong style="color:var(--primary-dark)">${fmtShort(isos[0])} — ${fmtShort(isos[6])}</strong>
        <button class="btn btn-ghost btn-sm" id="schedToday">الأسبوع الحالي</button>
        <button class="btn btn-ghost btn-sm" id="nextW">الأسبوع التالي ›</button>
        <button class="btn btn-primary" id="addSession">＋ أضف جلسة مذاكرة</button>
      </div>
    </div>
    ${!DB.subjects.length ? `<div class="card"><div class="empty">📚 أضف مادة دراسية الأول عشان تقدر تنظم جلسات المذاكرة.<br><a href="#/subjects" style="font-weight:700">← روح لإضافة مادة</a></div></div>`:
    !weekSessions.length ? `<div class="card"><div class="empty"><div class="big">🗓️</div>مفيش جلسات مذاكرة الأسبوع ده.<br>ابدأ بإضافة أول جلسة ونظّم وقتك.</div></div>`:
    `<div style="overflow-x:auto"><table class="sched-table"><thead><tr>${days.map(d=>`<th>${AR_DAYS[d.getDay()]}<br><small>${d.getDate()} ${AR_MONTHS[d.getMonth()]}</small></th>`).join('')}</tr></thead>
     <tbody><tr>${isos.map(iso=>{
        const cells=DB.sessions.filter(s=>s.date===iso).sort((a,b)=>(a.start||'').localeCompare(b.start||''));
        return `<td>${cells.map(s=>`<button class="sched-cell ${s.done?'done':''}" style="background:${subjectColor(s.subjectId)}" data-sess="${s.id}" title="اضغط للتعديل أو الحذف">
          ${esc(s.title)}<small>${esc(s.start)}–${esc(s.end)}</small><small>${esc(subjectName(s.subjectId))}</small></button>`).join('')||'<span style="color:#c3d8d3;font-size:.75rem">—</span>'}</td>`;
      }).join('')}</tr></tbody></table></div>
     <p style="color:var(--muted);font-size:.82rem;margin-top:10px">💡 اضغط على أي جلسة عشان تعدّلها أو تمسحها أو تعلّمها كمكتملة.</p>`}
  `);
  $('#addSession').onclick=()=>sessionModal(null, schedOffset===0 ? todayISO() : isos[0]);
  $('#prevW').onclick=()=>{ schedOffset-=7; viewSchedule(app); updateSidebar(location.hash); };
  $('#nextW').onclick=()=>{ schedOffset+=7; viewSchedule(app); updateSidebar(location.hash); };
  $('#schedToday').onclick=()=>{ schedOffset=0; viewSchedule(app); updateSidebar(location.hash); };
  document.querySelectorAll('[data-sess]').forEach(b=>b.onclick=()=>{
    const s=DB.sessions.find(x=>x.id===b.dataset.sess);
    const ov=openModal('جلسة المذاكرة', `
      <p style="line-height:2"><strong>${esc(s.title)}</strong><br>
      📚 ${esc(subjectName(s.subjectId))} · 📅 ${fmtDate(s.date)}<br>🕐 ${esc(s.start)} — ${esc(s.end)}
      ${s.notes?`<br>📝 ${esc(s.notes)}`:''}</p>
      <label style="display:flex;gap:8px;align-items:center;margin:10px 0;font-weight:700">
        <input type="checkbox" id="mDone" ${s.done?'checked':''}> تم إنجاز الجلسة</label>
    `,(m)=>{
      s.done=m.querySelector('#mDone').checked; saveDB();
      toast(s.done?'أحسنت! خلّصت الجلسة ✅':'رجّعنا الجلسة للجدول'); render(); return true;
    },{okText:'حفظ الحالة'});
    const act=document.createElement('div'); act.className='modal-actions'; act.style.justifyContent='flex-start'; act.style.marginTop='4px';
    act.innerHTML=`<button type="button" class="btn btn-ghost btn-sm" id="mEdit">✏️ تعديل</button>
                   <button type="button" class="btn btn-danger btn-sm" id="mDel">🗑️ حذف</button>`;
    ov.querySelector('#modalForm').insertBefore(act, ov.querySelector('.modal-actions'));
    ov.querySelector('#mEdit').onclick=()=>{ ov.remove(); sessionModal(s); };
    ov.querySelector('#mDel').onclick=()=>{ ov.remove();
      confirmDialog('حذف جلسة المذاكرة دي؟',()=>{ DB.sessions=DB.sessions.filter(x=>x.id!==s.id); saveDB(); toast('تم حذف الجلسة'); render(); }); };
  });
}

/* =========================================================
   Views — Tasks
   ========================================================= */
let taskFilter={q:'',subject:'',status:'',sort:'due'};
function taskModal(t){
  const isEdit=!!t; t=t||{};
  if(!DB.subjects.length){ toast('أضف مادة دراسية الأول','error'); go('#/subjects'); return; }
  const ov=openModal(isEdit?'تعديل المهمة':'إضافة مهمة جديدة', `
    ${selectFieldHTML('tSub','المادة الدراسية *',subjectOptions(t.subjectId),'اختر المادة الدراسية')}
    ${fieldHTML('tTitle','عنوان المهمة *','text',{ph:'مثال: حل واجب الفصل الرابع',err:'عنوان المهمة مطلوب'})}
    <div class="field"><label for="tDesc">وصف المهمة</label><textarea id="tDesc" rows="2" placeholder="اختياري"></textarea></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      ${fieldHTML('tDue','موعد التسليم *','date',{err:'اختر موعد التسليم'})}
      <div class="field"><label for="tPri">الأولوية</label>
        <select id="tPri"><option value="low">منخفضة</option><option value="med" selected>متوسطة</option><option value="high">عالية</option></select></div>
    </div>
    ${isEdit?`<div class="field"><label for="tStatus">الحالة</label>
      <select id="tStatus"><option value="todo">لم تبدأ</option><option value="doing">قيد التنفيذ</option><option value="done">مكتملة</option></select></div>`:''}
  `,(m)=>{
    const sub=m.querySelector('#tSub').value, title=m.querySelector('#tTitle').value.trim(), due=m.querySelector('#tDue').value;
    let ok=true;
    ok=setInvalid('tSub',!sub)&&ok; ok=setInvalid('tTitle',!title)&&ok; ok=setInvalid('tDue',!due)&&ok;
    if(!ok) return false;
    const data={subjectId:sub,title,desc:m.querySelector('#tDesc').value.trim(),due,
      priority:m.querySelector('#tPri').value};
    if(isEdit){ const x=DB.tasks.find(z=>z.id===t.id); Object.assign(x,data); x.status=m.querySelector('#tStatus').value; }
    else DB.tasks.push({id:uid(),status:'todo',createdAt:new Date().toISOString(),...data});
    saveDB(); toast(isEdit?'تم حفظ التغييرات بنجاح ✅':'تمت إضافة المهمة 🎉'); render(); return true;
  },{okText:isEdit?'حفظ':'إضافة المهمة'});
  ov.querySelector('#tTitle').value=t.title||''; ov.querySelector('#tDesc').value=t.desc||'';
  ov.querySelector('#tDue').value=t.due||todayISO();
  if(t.priority) ov.querySelector('#tPri').value=t.priority;
  if(isEdit) ov.querySelector('#tStatus').value=t.status||'todo';
}

function viewTasks(app){
  mountShell(app, `
    <div class="page-head">
      <h2>✏️ المهام والواجبات</h2>
      <button class="btn btn-primary" id="addTask">+ إضافة مهمة</button>
    </div>
    <div class="panel">
      <div class="filter-bar">
        <input id="fQ" type="search" placeholder="🔍 ابحث عن مهمة..." value="${esc(taskFilter.q)}">
        <select id="fSub"><option value="">كل المواد</option>${subjectOptions(taskFilter.subject)}</select>
        <select id="fSt"><option value="">كل الحالات</option>
          <option value="todo" ${taskFilter.status==='todo'?'selected':''}>لم تبدأ</option>
          <option value="doing" ${taskFilter.status==='doing'?'selected':''}>قيد التنفيذ</option>
          <option value="done" ${taskFilter.status==='done'?'selected':''}>مكتملة</option></select>
        <select id="fSort"><option value="due" ${taskFilter.sort==='due'?'selected':''}>ترتيب حسب موعد التسليم</option>
          <option value="pri" ${taskFilter.sort==='pri'?'selected':''}>ترتيب حسب الأولوية</option></select>
      </div>
      <div id="taskList"></div>
    </div>`);
  const draw=()=>{
    let list=DB.tasks.filter(t=>{
      if(taskFilter.q && !(t.title+' '+(t.desc||'')).includes(taskFilter.q)) return false;
      if(taskFilter.subject && t.subjectId!==taskFilter.subject) return false;
      if(taskFilter.status && t.status!==taskFilter.status) return false;
      return true;
    });
    const priRank={high:0,med:1,low:2};
    list.sort((a,b)=> taskFilter.sort==='pri'
      ? ((priRank[a.priority]??1)-(priRank[b.priority]??1)) || (a.due||'').localeCompare(b.due||'')
      : (a.due||'').localeCompare(b.due||''));
    $('#taskList').innerHTML = list.length ? list.map(t=>`
      <div class="task-row ${t.status==='done'?'done-task':''}">
        <input type="checkbox" class="chk" data-done="${t.id}" ${t.status==='done'?'checked':''}>
        <div class="grow">
          <div class="title" style="font-weight:700">${esc(t.title)}</div>
          <div style="font-size:.83rem;color:var(--muted)">
            <span style="color:${subjectColor(t.subjectId)}">●</span> ${esc(subjectName(t.subjectId))}
            ${t.desc?` · ${esc(t.desc)}`:''}<br>
            📅 <span class="${isOverdue(t)?'overdue':''}">${isOverdue(t)?'⚠️ متأخرة — كان التسليم ':''}${fmtShort(t.due)}</span>
            &nbsp; <span class="tag tag-${t.status==='done'?'done':t.status==='doing'?'doing':'todo'}">${t.status==='done'?'مكتملة':t.status==='doing'?'قيد التنفيذ':'لم تبدأ'}</span>
            <span class="tag tag-${t.priority==='high'?'high':t.priority==='low'?'low':'med'}">أولوية ${t.priority==='high'?'عالية':t.priority==='low'?'منخفضة':'متوسطة'}</span>
          </div>
        </div>
        <button class="btn btn-ghost btn-sm" data-edit="${t.id}">تعديل</button>
        <button class="btn btn-danger btn-sm" data-del="${t.id}">حذف</button>
      </div>`).join('')
      : `<div class="empty"><div class="big">📋</div>${DB.tasks.length?'لا توجد نتائج مطابقة للفلاتر الحالية.':'لسه مفيش مهام مسجلة — أضف أول واجب ليك!'}</div>`;
    $('#taskList').querySelectorAll('[data-done]').forEach(c=>c.onchange=()=>{
      const x=DB.tasks.find(z=>z.id===c.dataset.done);
      x.status=c.checked?'done':'todo'; saveDB();
      toast(c.checked?'ممتاز! خلصت المهمة دي 🎉':'رجّعنا المهمة للقائمة'); draw();
    });
    $('#taskList').querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>taskModal(DB.tasks.find(z=>z.id===b.dataset.edit)));
    $('#taskList').querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{
      const x=DB.tasks.find(z=>z.id===b.dataset.del);
      confirmDialog(`حذف المهمة «${x.title}» نهائيًا؟`,()=>{ DB.tasks=DB.tasks.filter(z=>z.id!==x.id); saveDB(); toast('تم حذف المهمة'); draw(); });
    });
  };
  $('#addTask').onclick=()=>taskModal(null);
  $('#fQ').oninput=e=>{ taskFilter.q=e.target.value; draw(); };
  $('#fSub').onchange=e=>{ taskFilter.subject=e.target.value; draw(); };
  $('#fSt').onchange=e=>{ taskFilter.status=e.target.value; draw(); };
  $('#fSort').onchange=e=>{ taskFilter.sort=e.target.value; draw(); };
  draw();
}

/* =========================================================
   Views — Calendar
   ========================================================= */
let calCursor=new Date(); calCursor.setDate(1);
function eventModal(ev, presetDate){
  const isEdit=!!ev; ev=ev||{};
  const ov=openModal(isEdit?'تعديل الحدث':'إضافة حدث دراسي جديد', `
    ${fieldHTML('eTitle','عنوان الحدث *','text',{ph:'مثال: امتحان منتصف الفصل',err:'عنوان الحدث مطلوب'})}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div class="field"><label for="eType">نوع الحدث *</label>
        <select id="eType"><option value="exam">امتحان</option><option value="quiz">كويز / اختبار قصير</option>
        <option value="other">حدث آخر</option></select></div>
      ${fieldHTML('eDate','تاريخ الحدث *','date',{err:'اختر التاريخ'})}
    </div>
    <div class="field"><label for="eSub">المادة الدراسية</label>
      <select id="eSub"><option value="">— بدون مادة / عام —</option>${subjectOptions(ev.subjectId)}</select></div>
    <div class="field"><label for="eDesc">وصف الحدث</label><textarea id="eDesc" rows="2" placeholder="اختياري"></textarea></div>
  `,(m)=>{
    const title=m.querySelector('#eTitle').value.trim(), date=m.querySelector('#eDate').value;
    let ok=setInvalid('eTitle',!title); ok=setInvalid('eDate',!date)&&ok;
    if(!ok) return false;
    const data={title,type:m.querySelector('#eType').value,date,subjectId:m.querySelector('#eSub').value||null,
      desc:m.querySelector('#eDesc').value.trim()};
    if(isEdit) Object.assign(DB.events.find(x=>x.id===ev.id),data);
    else DB.events.push({id:uid(),createdAt:new Date().toISOString(),...data});
    saveDB(); toast(isEdit?'تم حفظ التغييرات ✅':'تمت إضافة الحدث 🎉'); render(); return true;
  },{okText:isEdit?'حفظ':'إضافة الحدث'});
  ov.querySelector('#eTitle').value=ev.title||'';
  ov.querySelector('#eDate').value=ev.date||presetDate||todayISO();
  ov.querySelector('#eDesc').value=ev.desc||'';
  if(ev.type) ov.querySelector('#eType').value=ev.type;
}
function dayItems(iso){
  return [
    ...DB.tasks.filter(x=>x.due===iso).map(x=>({kind:'task',title:x.title,ref:x,color:subjectColor(x.subjectId)})),
    ...DB.events.filter(x=>x.date===iso).map(x=>({kind:x.type==='exam'?'exam':x.type==='quiz'?'quiz':'other',title:x.title,ref:x,color:null})),
    ...DB.sessions.filter(x=>x.date===iso).map(x=>({kind:'session',title:x.title,ref:x,color:subjectColor(x.subjectId)}))
  ];
}
function viewCalendar(app){
  const y=calCursor.getFullYear(), m=calCursor.getMonth();
  const first=new Date(y,m,1); const dim=new Date(y,m+1,0).getDate();
  const lead=(first.getDay()+1)%7;   // السبت أول عمود
  const t=todayISO();
  let cells='';
  for(let i=0;i<lead;i++) cells+=`<div class="cal-cell dim"></div>`;
  for(let d=1;d<=dim;d++){
    const iso=`${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const items=dayItems(iso);
    cells+=`<div class="cal-cell ${iso===t?'today':''}" data-day="${iso}" style="cursor:pointer">
      <div class="d">${d}</div>
      ${items.slice(0,3).map(it=>`<span class="cal-chip t-${it.kind}" style="${it.color?`background:${it.color}`:''}" title="${esc(it.title)}">${esc(it.title)}</span>`).join('')}
      ${items.length>3?`<span style="font-size:.65rem;color:var(--muted)">+${items.length-3} أخرى</span>`:''}
    </div>`;
  }
  mountShell(app, `
    <div class="page-head">
      <h2>🗓️ التقويم الدراسي</h2>
      <button class="btn btn-primary" id="addEvent">+ إضافة حدث</button>
    </div>
    <div class="panel">
      <div class="cal-head">
        <button class="btn btn-ghost btn-sm" id="calPrev">‹ السابق</button>
        <h3>${AR_MONTHS[m]} ${y}</h3>
        <button class="btn btn-ghost btn-sm" id="calNext">التالي ›</button>
        <button class="btn btn-ghost btn-sm" id="calToday">اليوم</button>
        <span style="color:var(--muted);font-size:.85rem">(اضغط على يوم لعرض تفاصيله وإضافة حدث فيه)</span>
      </div>
      <div class="legend"><span class="l-task">واجب</span><span class="l-exam">امتحان</span><span class="l-quiz">كويز</span><span class="l-session">جلسة مذاكرة</span><span class="l-other">حدث آخر</span></div>
      <div class="cal-grid">${WEEK_ORDER.map(i=>`<div class="cal-day-h">${AR_DAYS[i]}</div>`).join('')}${cells}</div>
    </div>`);
  const redraw=()=>{ viewCalendar(app); updateSidebar(location.hash); };
  $('#calPrev').onclick=()=>{ calCursor.setMonth(calCursor.getMonth()-1); redraw(); };
  $('#calNext').onclick=()=>{ calCursor.setMonth(calCursor.getMonth()+1); redraw(); };
  $('#calToday').onclick=()=>{ calCursor=new Date(); calCursor.setDate(1); redraw(); };
  $('#addEvent').onclick=()=>{
    const nowD=new Date();
    const sameMonth = nowD.getFullYear()===y && nowD.getMonth()===m;
    eventModal(null, sameMonth ? todayISO() : isoOf(new Date(y,m,1)));
  };
  document.querySelectorAll('[data-day]').forEach(c=>c.onclick=()=>{
    const iso=c.dataset.day; const items=dayItems(iso);
    const typeLabel={exam:'امتحان',quiz:'كويز',other:'حدث آخر',session:'جلسة مذاكرة',task:'واجب'};
    const ov=openModal(`يوم ${fmtDate(iso)}`, `
      ${items.length?items.map(it=>`
        <div class="list-row">
          <span class="tag ${it.kind==='task'?'tag-todo':it.kind==='session'?'tag-session':it.kind==='exam'?'tag-exam':it.kind==='quiz'?'tag-quiz':'tag-other'}">${typeLabel[it.kind]}</span>
          <span class="grow">${esc(it.title)} ${it.kind==='task'&&it.ref.status==='done'?'✅':''} ${it.kind==='session'&&it.ref.done?'✅':''}</span>
          ${(it.kind==='exam'||it.kind==='quiz'||it.kind==='other')?`<button type="button" class="btn btn-danger btn-sm" data-delo="${it.ref.id}">حذف</button>`:''}
        </div>`).join(''):'<div class="empty">مفيش أحداث في اليوم ده.</div>'}
      <div class="modal-actions" style="justify-content:flex-start;margin-top:8px">
        <button type="button" class="btn btn-primary btn-sm" id="dayAddEvent">+ إضافة حدث في هذا اليوم</button>
      </div>
    `,()=>true,{okText:'إغلاق'});
    ov.querySelector('#dayAddEvent').onclick=()=>{ ov.remove(); eventModal(null,iso); };
    ov.querySelectorAll('[data-delo]').forEach(b=>b.onclick=()=>{
      const id=b.dataset.delo; ov.remove();
      confirmDialog('حذف هذا الحدث من التقويم؟',()=>{ DB.events=DB.events.filter(x=>x.id!==id); saveDB(); toast('تم حذف الحدث'); render(); });
    });
  });
}

/* =========================================================
   Views — Settings
   ========================================================= */
function viewSettings(app){
  mountShell(app, `
    <div class="page-head"><h2>⚙️ الإعدادات</h2></div>
    <div class="two-col">
      <div class="panel">
        <h3>الملف الشخصي</h3>
        <div class="field"><label for="setName">الاسم الظاهر</label>
          <input id="setName" value="${esc(DB.user.name)}"></div>
        <div class="field"><label>البريد الإلكتروني</label>
          <input value="${esc(DB.user.email||'غير متاح في الوضع التجريبي')}" disabled style="background:#f1f5f4"></div>
        <button class="btn btn-primary" id="saveProfile">حفظ التغييرات</button>
      </div>
      <div class="panel">
        <h3>تفضيلات المذاكرة</h3>
        <div class="field"><label for="setHours">عدد ساعات المذاكرة المفضلة يوميًا</label>
          <input id="setHours" type="number" min="1" max="12" value="${DB.settings.studyHours}"></div>
        <p style="color:var(--muted);font-size:.85rem;line-height:1.9">هذا الرقم بيظهر كمرجع لك عند تخطيط جلسات المذاكرة.</p>
        <button class="btn btn-primary" id="savePrefs" style="margin-top:8px">حفظ التفضيلات</button>
      </div>
    </div>
    <div class="panel">
      <h3>الحساب والبيانات</h3>
      <p style="color:var(--muted);font-size:.9rem;line-height:2">${DB.user.demo
        ? 'أنت الآن في <strong>الوضع التجريبي</strong> بدون حساب.'
        : 'تسجيل دخولك يتم عبر <strong>Supabase</strong>.'}
        بيانات المذاكرة (المواد والمهام والجلسات والأحداث) محفوظة في متصفحك على هذا الجهاز فقط، وأي حذف لبيانات الموقع من المتصفح سيؤدي لضياعها. التخزين السحابي قيد التطوير — خد نسخة احتياطية بشكل دوري.</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:8px">
        <button class="btn btn-ghost" id="exportBtn">⬇️ تصدير نسخة احتياطية (JSON)</button>
        <button class="btn btn-danger" id="resetBtn">🗑️ مسح جميع بياناتي</button>
        <button class="btn btn-danger" id="logoutBtn2">🚪 تسجيل الخروج</button>
      </div>
    </div>`);
  $('#saveProfile').onclick=async()=>{
    const n=$('#setName').value.trim();
    if(!n){ toast('اكتب اسمًا صحيحًا','error'); return; }
    DB.user.name=n; saveDB();
    if(supabaseClient && !DB.user.demo){
      try{ await supabaseClient.auth.updateUser({data:{display_name:n}}); }catch(e){}
    }
    toast('تم حفظ التغييرات بنجاح ✅'); render();
  };
  $('#savePrefs').onclick=()=>{
    const h=parseInt($('#setHours').value,10);
    if(!h||h<1||h>12){ toast('أدخل عدد ساعات بين 1 و 12','error'); return; }
    DB.settings.studyHours=h; saveDB(); toast('تم حفظ التفضيلات ✅');
  };
  $('#exportBtn').onclick=()=>{
    const { user, ...data } = DB;
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
    a.download='eldaheeh-backup-'+todayISO()+'.json'; a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),1000);
    toast('تم تنزيل النسخة الاحتياطية ✅');
  };
  $('#resetBtn').onclick=()=>confirmDialog('هيتم مسح كل موادك ومهامك وجلساتك وأحداثك نهائيًا. متأكد؟',()=>{
    DB=Object.assign({user:DB.user},freshData());
    saveDB(); toast('تم مسح كل البيانات'); render();
  });
  $('#logoutBtn2').onclick=doLogout;
}

/* =========================================================
   Boot
   ========================================================= */
window.addEventListener('hashchange',render);
loadDB();
async function bootApp(){
  if(supabaseClient){
    try{
      const {data:{session}}=await supabaseClient.auth.getSession();
      if(session?.user){
        const u=sessionUser(session.user);
        if(!DB.user || DB.user.id!==u.id) setUser(u);
        else { DB.user.name=u.name; DB.user.email=u.email; saveDB(); }
      } else if(DB.user && !DB.user.demo){
        clearUser();
      }
      supabaseClient.auth.onAuthStateChange((event)=>{
        if(event==='SIGNED_OUT' && DB.user && !DB.user.demo){
          clearUser(); if(!PUBLIC_ROUTES.includes(location.hash)) go('#/home'); else render();
        }
      });
    }catch(e){ /* لو مفيش نت نكمل بالبيانات المحلية */ }
  }
  if(!location.hash) location.hash = DB.user ? '#/dashboard' : '#/home';
  render();
}
bootApp();