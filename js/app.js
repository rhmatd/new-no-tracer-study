
/* C-DFS PHP/MySQL API */
async function apiRequest(action, payload = {}) {
    try {
        const r = await fetch(`php/api.php?action=${encodeURIComponent(action)}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            credentials: 'same-origin',
            body: JSON.stringify(payload)
        });
        const data = await r.json();
        if (!r.ok || data.success === false) return {success: false, message: data.message || 'Permintaan gagal.'};
        return data;
    } catch (e) {
        console.warn('PHP API belum tersedia:', e.message);
        return null;
    }
}
async function cdfsLogin(email, password) { return apiRequest('login', {email, password}); }
async function cdfsRegister(user) { return apiRequest('register', user); }
async function cdfsLogout() { return apiRequest('logout'); }
async function cdfsUpdateProdi(jalur, prodi) { return apiRequest('update_prodi', {jalur, prodi}); }

/* Daftar Program Studi per Jalur Pendidikan (Jobseeker) */
const PRODI_BY_JALUR = {
    'Akademis': [
        {kode: 'MAT', nama: 'Matematika'},
        {kode: 'PAUD', nama: 'Pendidikan Anak Usia Dini (PAUD)'}
    ],
    'Vocational': [
        {kode: 'TRSE', nama: 'Teknologi Rekayasa Sistem Elektronika'},
        {kode: 'MP', nama: 'Manajemen Pemasaran'}
    ]
};

/* Profil kompetensi inti tiap prodi — dasar skor kecocokan kandidat (sesuaikan dengan CPL prodi) */
const PRODI_SKILLS = {
    'Matematika': ['Analisis Data', 'Statistika', 'Pemodelan Matematika', 'Pemrograman Python', 'Microsoft Excel', 'Riset Operasi', 'Berpikir Logis'],
    'Pendidikan Anak Usia Dini (PAUD)': ['Perencanaan Pembelajaran', 'Psikologi Perkembangan Anak', 'Asesmen Perkembangan', 'Komunikasi dengan Orang Tua', 'Media Ajar Kreatif', 'Manajemen Kelas'],
    'Teknologi Rekayasa Sistem Elektronika': ['Rangkaian Elektronika', 'Mikrokontroler', 'Internet of Things (IoT)', 'PLC & Otomasi', 'Troubleshooting Perangkat', 'Desain PCB', 'Instrumentasi'],
    'Manajemen Pemasaran': ['Digital Marketing', 'Riset Pasar', 'Penjualan (Sales)', 'Branding', 'Komunikasi Pemasaran', 'Manajemen Media Sosial', 'Negosiasi']
};

document.addEventListener('DOMContentLoaded', function() {
            // Teks grafik hitam agar mudah dibaca
            if (window.Chart) { Chart.defaults.color = '#0b1220'; Chart.defaults.font.family = 'Inter, sans-serif'; }

            // ==============================================================
            // 1. CHART.JS – Grafik di Landing (gapChart)
            // ==============================================================
            // (grafik contoh di landing kini berupa batang HTML statis berlabel sumber WEF)

            // ==============================================================
            // 2. DATE PICKER – Batas 7 hari
            // ==============================================================
            function setupDatePickers() {
                const today = new Date();
                const sevenDaysAgo = new Date(today);
                sevenDaysAgo.setDate(today.getDate() - 7);

                const formatDate = (d) => d.toISOString().split('T')[0];
                const minDate = formatDate(sevenDaysAgo);
                const maxDate = formatDate(today);

                document.querySelectorAll('input[type="date"]').forEach(input => {
                    input.setAttribute('min', minDate);
                    input.setAttribute('max', maxDate);
                    if (input.id.includes('Start') || input.id.includes('start') || input.id === 'industriDate') {
                        input.value = formatDate(sevenDaysAgo);
                    } else if (input.id.includes('End') || input.id.includes('end')) {
                        input.value = formatDate(today);
                    } else {
                        input.value = formatDate(today);
                    }
                });

                document.querySelectorAll('.date-picker').forEach(picker => {
                    const inputs = picker.querySelectorAll('input[type="date"]');
                    if (inputs.length === 2) {
                        const startInput = inputs[0];
                        const endInput = inputs[1];
                        startInput.addEventListener('change', function() {
                            if (this.value > endInput.value) {
                                endInput.value = this.value;
                            }
                        });
                        endInput.addEventListener('change', function() {
                            if (this.value < startInput.value) {
                                startInput.value = this.value;
                            }
                        });
                    }
                });
            }
            setupDatePickers();

            // ==============================================================
            // 3. TOAST NOTIFICATION
            // ==============================================================
            function showToast(message) {
                const toast = document.getElementById('toast');
                document.getElementById('toastMessage').textContent = message;
                toast.classList.add('show');
                clearTimeout(toast._timeout);
                toast._timeout = setTimeout(() => {
                    toast.classList.remove('show');
                }, 3000);
            }

            // ==============================================================
            // 4. DOWNLOAD FUNGSI
            // ==============================================================
            function downloadFile(content, filename, mimeType) {
                const blob = new Blob([content], { type: mimeType + ';charset=utf-8' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(link.href);
            }

            // ==============================================================
            // 5. TOGGLE LANDING / AUTH / DASHBOARD
            // ==============================================================
            const landingContainer = document.getElementById('landingContainer');
            const authContainer = document.getElementById('authContainer');
            const dashboardContainer = document.getElementById('dashboardContainer');

            function showLanding() {
                landingContainer.classList.remove('hidden');
                authContainer.classList.remove('active');
                dashboardContainer.classList.remove('active');
                setMode('register');
                document.getElementById('global-stepper').classList.remove('hidden-stepper');
                document.querySelectorAll('.user-profile').forEach(el => el.classList.remove('show'));
            }

            function showAuth() {
                landingContainer.classList.add('hidden');
                authContainer.classList.add('active');
                dashboardContainer.classList.remove('active');
                setMode('register');
                document.querySelectorAll('.user-profile').forEach(el => el.classList.remove('show'));
            }

            function showDashboard() {
                landingContainer.classList.add('hidden');
                authContainer.classList.remove('active');
                dashboardContainer.classList.add('active');
                applyRoleLayout();
                initDashboardCharts();
                setTimeout(jalankanAnimasiAngka, 200);
                const name = sessionStorage.getItem('c-dfs_user_name') || 'Admin PT';
                document.querySelectorAll('.user-name').forEach(el => el.textContent = name);
                document.querySelectorAll('.user-profile').forEach(el => el.classList.remove('show'));
                setupDatePickers();
                renderJobseekerDashboard();
            }

            document.getElementById('landingLoginBtn').addEventListener('click', showAuth);
            document.getElementById('heroExploreBtn').addEventListener('click', (e) => { e.preventDefault(); showAuth(); });
            document.getElementById('backToLandingBtn').addEventListener('click', showLanding);

            // ==============================================================
            // 6. AUTH STATE & NAVIGATION
            // ==============================================================
            const state = {
                currentStep: 1,
                mode: 'register',
                name: '',
                email: '',
                instansi: '',
                role: 'Jobseeker',
                jalur: '',
                prodi: ''
            };
            const TOTAL_STEPS = 3; // 1 Informasi Diri, 2 Pilih Peran, 3 Selesai (tanpa OTP)

            const btnBack = document.getElementById('btn-back');
            const stepperEl = document.getElementById('global-stepper');

            function goToStep(stepNumber) {
                state.currentStep = stepNumber;
                document.querySelectorAll('.auth-mode-content').forEach(el => el.classList.remove('active'));
                const target = document.getElementById(`view-step-${stepNumber}`);
                if (target) target.classList.add('active');

                for (let i = 1; i <= TOTAL_STEPS; i++) {
                    const indicator = document.getElementById(`step-indicator-${i}`);
                    if (!indicator) continue;
                    const circle = indicator.querySelector('.v-step-circle');
                    if (i < stepNumber || (stepNumber === TOTAL_STEPS && i === TOTAL_STEPS)) {
                        indicator.className = 'v-step completed';
                        circle.innerHTML = '<i class="fa-solid fa-check"></i>';
                    } else if (i === stepNumber) {
                        indicator.className = 'v-step active';
                        circle.innerText = i;
                    } else {
                        indicator.className = 'v-step';
                        circle.innerText = i;
                    }
                }

                if (stepNumber === 1 || stepNumber === TOTAL_STEPS) btnBack.style.visibility = 'hidden';
                else btnBack.style.visibility = 'visible';
            }

            function setMode(mode) {
                state.mode = mode;
                document.querySelectorAll('.auth-mode-content').forEach(el => el.classList.remove('active'));

                if (mode === 'login') {
                    document.getElementById('view-login').classList.add('active');
                    stepperEl.classList.add('hidden-stepper');
                    btnBack.style.visibility = 'hidden';
                } else {
                    stepperEl.classList.remove('hidden-stepper');
                    goToStep(1);
                }
            }

            document.getElementById('switchToLogin').addEventListener('click', (e) => {
                e.preventDefault();
                setMode('login');
            });
            document.getElementById('switchToRegister').addEventListener('click', (e) => {
                e.preventDefault();
                setMode('register');
            });

            btnBack.addEventListener('click', () => {
                if (state.mode === 'register' && state.currentStep > 1 && state.currentStep < TOTAL_STEPS) {
                    goToStep(state.currentStep - 1);
                }
            });

            // ---------- Step 1: Informasi Diri ----------
            document.getElementById('formRegister').addEventListener('submit', function(e) {
                e.preventDefault();
                state.name = document.getElementById('regName').value.trim();
                state.email = document.getElementById('userEmail').value.trim();
                state.instansi = document.getElementById('regInstansi').value.trim();
                if (!state.name || !state.email || !state.instansi) {
                    alert('Harap isi semua field.');
                    return;
                }
                goToStep(2);
            });

            // ---------- Step 2: Pilih Peran -> langsung simpan & selesai (tanpa OTP) ----------
            document.getElementById('formRole').addEventListener('submit', async function(e) {
                e.preventDefault();
                state.role = document.querySelector('input[name="role"]:checked')?.value || 'Jobseeker';
                if (state.role === 'Jobseeker') state.instansi = 'Universitas Negeri Malang';   // C-DFS difokuskan untuk mahasiswa aktif UM
                // Jalur & Program Studi dipilih Jobseeker nanti di Dashboard
                state.jalur = '';
                state.prodi = '';

                const result = await cdfsRegister({
                    name: state.name, email: state.email, instansi: state.instansi,
                    role: state.role, jalur: state.jalur, prodi: state.prodi
                });
                if (result && result.success === false) {
                    alert(result.message || 'Registrasi gagal.');
                    return;
                }

                saveSession({name: state.name, email: state.email, instansi: state.instansi,
                    role: state.role, jalur: state.jalur, prodi: state.prodi});

                let summary = `Peran: <strong>${state.role}</strong>`;
                if (state.role === 'Jobseeker') summary += '<br>Pilih Jalur Pendidikan &amp; Program Studi Anda di Dashboard.';
                if (result && result.success) summary += '<br>Password awal: <strong>CDFS@12345</strong>';
                document.getElementById('regSummary').innerHTML = summary;
                goToStep(3);
            });

            function saveSession(u) {
                sessionStorage.setItem('c-dfs_user_name', u.name || '');
                sessionStorage.setItem('c-dfs_user_email', u.email || '');
                sessionStorage.setItem('c-dfs_user_instansi', u.instansi || '');
                sessionStorage.setItem('c-dfs_user_role', u.role || '');
                sessionStorage.setItem('c-dfs_user_jalur', u.jalur || '');
                sessionStorage.setItem('c-dfs_user_prodi', u.prodi || '');
            }

            // ---------- Antarmuka Jobseeker di Dashboard: pencarian jalur & prodi ----------
            const jobseekerDashCard = document.getElementById('jobseekerDashCard');
            const dashProdiBadge = document.getElementById('dashProdiBadge');
            const escHtml = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

            // Komponen pencarian (combobox) sederhana yang bisa dipakai ulang
            function createSearchPick(rootId, getOptions, onSelect, onClear) {
                const root = document.getElementById(rootId);
                const input = root.querySelector('input');
                const list = root.querySelector('.search-pick-list');
                let items = [], hl = 0, selected = null;
                const mark = (text, q) => {
                    if (!q) return escHtml(text);
                    const i = text.toLowerCase().indexOf(q.toLowerCase());
                    return i < 0 ? escHtml(text) : escHtml(text.slice(0, i)) + '<mark>' + escHtml(text.slice(i, i + q.length)) + '</mark>' + escHtml(text.slice(i + q.length));
                };
                function render() {
                    const q = (selected && input.value === selected.label) ? '' : input.value.trim();
                    items = getOptions().filter(o => !q || (o.label + ' ' + (o.code || '') + ' ' + (o.group || '')).toLowerCase().includes(q.toLowerCase()));
                    hl = Math.min(hl, Math.max(0, items.length - 1));
                    list.innerHTML = items.length ? items.map((o, i) => `
                        <li role="option" data-i="${i}" class="${i === hl ? 'hl' : ''}" aria-selected="${selected && selected.value === o.value}">
                            ${o.code ? `<span class="code">${mark(o.code, q)}</span>` : ''}<span>${mark(o.label, q)}</span>${o.group ? `<span class="grp">${escHtml(o.group)}</span>` : ''}
                        </li>`).join('') : '<li class="empty">Tidak ditemukan</li>';
                }
                const open = () => { render(); root.classList.add('open'); input.setAttribute('aria-expanded', 'true'); };
                const close = () => { root.classList.remove('open'); input.setAttribute('aria-expanded', 'false'); if (selected) input.value = selected.label; else input.value = ''; };
                function choose(o) {
                    selected = o; input.value = o.label; root.classList.add('has-value');
                    root.classList.remove('open'); input.blur(); onSelect(o);
                }
                input.addEventListener('focus', () => { input.select(); open(); });
                input.addEventListener('input', () => { hl = 0; open(); });
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'ArrowDown') { e.preventDefault(); hl = Math.min(hl + 1, items.length - 1); render(); }
                    else if (e.key === 'ArrowUp') { e.preventDefault(); hl = Math.max(hl - 1, 0); render(); }
                    else if (e.key === 'Enter') { e.preventDefault(); if (items[hl]) choose(items[hl]); }
                    else if (e.key === 'Escape') { close(); input.blur(); }
                });
                list.addEventListener('mousedown', (e) => {
                    const li = e.target.closest('li[data-i]');
                    if (li) { e.preventDefault(); choose(items[+li.dataset.i]); }
                });
                input.addEventListener('blur', () => setTimeout(close, 120));
                root.querySelector('.search-pick-clear').addEventListener('click', () => {
                    selected = null; input.value = ''; root.classList.remove('has-value'); onClear && onClear();
                });
                return {
                    set(value) {
                        selected = getOptions().find(o => o.value === value) || null;
                        input.value = selected ? selected.label : '';
                        root.classList.toggle('has-value', !!selected);
                    }
                };
            }

            const jalurOptions = () => Object.keys(PRODI_BY_JALUR).map(j => ({value: j, label: j, group: `${PRODI_BY_JALUR[j].length} prodi`}));
            const prodiOptions = () => {
                const jalur = sessionStorage.getItem('c-dfs_user_jalur') || '';
                return Object.entries(PRODI_BY_JALUR)
                    .filter(([j]) => !jalur || j === jalur)
                    .flatMap(([j, list]) => list.map(p => ({value: p.nama, label: p.nama, code: p.kode, group: j})));
            };
            async function saveProdiChoice() {
                const jalur = sessionStorage.getItem('c-dfs_user_jalur') || '';
                const prodi = sessionStorage.getItem('c-dfs_user_prodi') || '';
                dashProdiBadge.textContent = prodi ? `${jalur} · ${prodi}` : (jalur ? `${jalur} · pilih prodi` : 'Belum dipilih');
                if (jalur && prodi) {
                    await cdfsUpdateProdi(jalur, prodi);
                    showToast(`Program Studi: ${prodi}`);
                }
                if (typeof jmRefreshStats === 'function') jmRefreshStats();
                if (JM.loaded) jsRenderDash();
            }
            const pickJalur = createSearchPick('pickJalur', jalurOptions, (o) => {
                const prev = sessionStorage.getItem('c-dfs_user_jalur');
                sessionStorage.setItem('c-dfs_user_jalur', o.value);
                const prodi = sessionStorage.getItem('c-dfs_user_prodi');
                if (prev !== o.value && prodi && !(PRODI_BY_JALUR[o.value] || []).some(p => p.nama === prodi)) {
                    sessionStorage.setItem('c-dfs_user_prodi', '');
                    pickProdi.set('');
                }
                saveProdiChoice();
                setTimeout(() => document.getElementById('pickProdiInput').focus(), 60);
            }, () => {
                sessionStorage.setItem('c-dfs_user_jalur', '');
                sessionStorage.setItem('c-dfs_user_prodi', '');
                pickProdi.set('');
                saveProdiChoice();
            });
            const pickProdi = createSearchPick('pickProdi', prodiOptions, (o) => {
                sessionStorage.setItem('c-dfs_user_jalur', o.group);   // jalur otomatis mengikuti prodi
                sessionStorage.setItem('c-dfs_user_prodi', o.value);
                pickJalur.set(o.group);
                saveProdiChoice();
            }, () => {
                sessionStorage.setItem('c-dfs_user_prodi', '');
                saveProdiChoice();
            });

            function renderJobseekerDashboard() {
                const role = sessionStorage.getItem('c-dfs_user_role') || '';
                const isJobseeker = role === 'Jobseeker';
                jobseekerDashCard.classList.toggle('is-hidden', !isJobseeker);
                if (!isJobseeker) return;
                const jalur = sessionStorage.getItem('c-dfs_user_jalur') || '';
                const prodi = sessionStorage.getItem('c-dfs_user_prodi') || '';
                pickJalur.set(jalur);
                pickProdi.set(prodi);
                dashProdiBadge.textContent = prodi ? `${jalur} · ${prodi}` : (jalur ? `${jalur} · pilih prodi` : 'Belum dipilih');
                if (JM.loaded) jsRenderDash();
            }

            document.getElementById('formLogin').addEventListener('submit', async function(e) {
                e.preventDefault();
                const email = document.getElementById('loginEmail').value.trim();
                const pass = document.getElementById('loginPassword').value.trim();
                if (!email || !pass) {
                    alert('Harap isi email dan kata sandi.');
                    return;
                }
                const result = await cdfsLogin(email, pass);
                if (result && result.success === false) {
                    alert(result.message || 'Email atau kata sandi salah.');
                    return;
                }
                const u = result?.user || {};
                saveSession({name: u.name || email.split('@')[0], email: u.email || email,
                    instansi: u.instansi || '', role: u.role || 'Jobseeker',
                    jalur: u.jalur || '', prodi: u.prodi || ''});
                showDashboard();
            });

            document.querySelector('.btn-google').addEventListener('click', function() {
                alert('🔵 Login dengan Google (simulasi)');
            });

            // ---------- Coba Demo (tanpa daftar) ----------
            // Dengan XAMPP + database/data_contoh.sql: masuk ke akun contoh. Tanpa itu: mode demo dengan data contoh di browser.
            const DEMO_AKUN = {
                Jobseeker: {email: 'rani.trse@contoh.ac.id', name: 'Rani Kusumawati (Contoh)', instansi: 'Universitas Negeri Malang', jalur: 'Vocational', prodi: 'Teknologi Rekayasa Sistem Elektronika'},
                Jobprovider: {email: 'hr@elektra.contoh.co.id', name: 'HR Elektra (Contoh)', instansi: 'PT Elektra Nusantara (Contoh)', jalur: '', prodi: ''}
            };
            document.querySelectorAll('.ld-demo').forEach(btn => btn.addEventListener('click', async () => {
                const role = btn.dataset.demo, akun = DEMO_AKUN[role];
                btn.disabled = true;
                try {
                    const res = await cdfsLogin(akun.email, 'CDFS@12345');
                    if (res && res.success && res.user) {
                        const u = res.user;
                        saveSession({name: u.name, email: u.email, instansi: u.instansi || '', role: u.role, jalur: u.jalur || '', prodi: u.prodi || ''});
                    } else {
                        // Server/akun contoh tidak tersedia: jalankan mode demo di browser
                        saveSession({...akun, role});
                    }
                    showDashboard();
                    showToast(res && res.success ? `Masuk sebagai akun demo ${role}` : 'Mode demo: memakai data contoh (fiktif)');
                    window.scrollTo(0, 0);
                } finally { btn.disabled = false; }
            }));

            document.getElementById('gotoDashboardBtn').addEventListener('click', function() {
                showDashboard();
            });

            // ==============================================================
            // 7. DROPDOWN LOGOUT
            // ==============================================================
            document.querySelectorAll('.user-profile').forEach(profile => {
                const chevron = profile.querySelector('.fa-chevron-down');
                if (chevron) {
                    chevron.addEventListener('click', function(e) {
                        e.stopPropagation();
                        profile.classList.toggle('show');
                    });
                }
                const avatar = profile.querySelector('.avatar');
                const nameSpan = profile.querySelector('.user-name');
                if (avatar) avatar.addEventListener('click', function(e) { e.stopPropagation();
                    profile.classList.toggle('show'); });
                if (nameSpan) nameSpan.addEventListener('click', function(e) { e.stopPropagation();
                    profile.classList.toggle('show'); });
            });

            document.addEventListener('click', function() {
                document.querySelectorAll('.user-profile').forEach(el => el.classList.remove('show'));
            });

            document.querySelectorAll('.logout-btn, #logoutBtn').forEach(btn => {
                btn.addEventListener('click', function(e) {
                    e.preventDefault();
                    sessionStorage.removeItem('c-dfs_user_name');
                    sessionStorage.removeItem('c-dfs_user_email');
                    sessionStorage.removeItem('c-dfs_user_instansi');
                    sessionStorage.removeItem('c-dfs_user_role');
                    sessionStorage.removeItem('c-dfs_user_jalur');
                    sessionStorage.removeItem('c-dfs_user_prodi');
                    cdfsLogout();
                    JM.loaded = false; JM.lamaran = []; fsMode = null; fsPilihan = false; fsKey = ''; if (fsChart) { fsChart.destroy(); fsChart = null; } PR.loaded = false; PR.prodi = ''; PR.reqProdi = null;
                    delete document.body.dataset.role;
                    showLanding();
                    document.querySelectorAll('.user-profile').forEach(el => el.classList.remove('show'));
                });
            });

            // ==============================================================
            // 8. DASHBOARD CHARTS
            // ==============================================================
            let dashboardChartsInited = false;

            function initDashboardCharts() {
                if (dashboardChartsInited) return;
                dashboardChartsInited = true;

                // (grafik statis lama dihapus; tren skill kini di kartu Dashboard)
            }

            // ==============================================================
            // 9. ANIMASI ANGKA STATISTIK
            // ==============================================================
            function jalankanAnimasiAngka() {
                const statValues = document.querySelectorAll('.view-section.active .num-animate');
                statValues.forEach(stat => {
                    let textNode = stat.childNodes[0];
                    let text = textNode.nodeValue;
                    if (!text) return;

                    let isCurrency = text.includes('Rp');
                    let isPercent = text.includes('%');
                    let isDecimal = text.includes(',');

                    let endValue = parseFloat(text.replace(/[^0-9,]/g, '').replace(',', '.'));

                    if (!isNaN(endValue)) {
                        let startTime = null;
                        const step = (timestamp) => {
                            if (!startTime) startTime = timestamp;
                            const progress = Math.min((timestamp - startTime) / 1000, 1);
                            const easeOutQuad = progress * (2 - progress);
                            let currentVal = easeOutQuad * endValue;

                            let formattedVal = "";
                            if (isDecimal) {
                                formattedVal = currentVal.toFixed(1).replace('.', ',');
                            } else {
                                formattedVal = Math.floor(currentVal).toLocaleString('id-ID');
                            }

                            textNode.nodeValue = (isCurrency ? 'Rp ' : '') + formattedVal + (isPercent ? '%' :
                                '') + " ";

                            if (progress < 1) window.requestAnimationFrame(step);
                            else {
                                textNode.nodeValue = (isCurrency ? 'Rp ' : '') + (isDecimal ? endValue.toFixed(
                                    1).replace('.', ',') : endValue.toLocaleString('id-ID')) + (
                                    isPercent ? '%' : '') + " ";
                            }
                        };
                        window.requestAnimationFrame(step);
                    }
                });
            }

            // ==============================================================
            // 10. NAVIGASI MENU DASHBOARD
            // ==============================================================
            const navItems = document.querySelectorAll('.sidebar-nav .nav-item[data-target]');
            const viewSections = document.querySelectorAll('.view-section');

            navItems.forEach(item => {
                item.addEventListener('click', function(e) {
                    e.preventDefault();
                    document.querySelectorAll('.sidebar-nav .nav-item').forEach(nav => nav.classList.remove(
                    'active'));
                    this.classList.add('active');

                    viewSections.forEach(section => section.classList.remove('active'));

                    const targetId = this.getAttribute('data-target');
                    document.getElementById(targetId).classList.add('active');

                    jalankanAnimasiAngka();
                    document.querySelectorAll('.user-profile').forEach(el => el.classList.remove('show'));
                });
            });

            // ==============================================================
            // 12. ANTARMUKA JOBPROVIDER
            //     Ringkasan · Kelola Kompetensi (Kompetensi & Bahasa, Kelola Lowongan) · Kandidat
            // ==============================================================
            const JP_DEMO_KEY = 'c-dfs_jp_demo_v3';
            const JP = { demo: false, kompetensi: [], lowongan: [], shortlist: [], candidates: [], lamaran: [], kompTab: 'teknis', lowFilter: 'semua',
                form: { komp: [], bahasa: [] } };

            const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
            const allProdi = () => Object.entries(PRODI_BY_JALUR).flatMap(([jalur, list]) => list.map(p => ({...p, jalur})));
            const prodiKode = (nama) => (allProdi().find(p => p.nama === nama) || {}).kode || nama;
            const prodiOptionsHtml = () => allProdi().map(p => `<option value="${esc(p.nama)}">${esc(p.kode)} — ${esc(p.nama)}</option>`).join('');
            const isBahasa = (k) => k.jenis === 'bahasa';
            const langLabel = (b) => `Bahasa ${b.nama} · min. ${b.level}`;

            // Kandidat contoh hanya dipakai saat PHP/MySQL belum aktif (mode demo)
            const JP_DEMO_CANDIDATES = [
                {id: 'd1', name: 'Alya Rahma', instansi: 'Universitas Negeri Malang', jalur: 'Vocational', prodi: 'Teknologi Rekayasa Sistem Elektronika', mk: [], cert: [], bahasa: [{nama: 'Inggris', level: 'Advanced'}]},
                {id: 'd2', name: 'Bima Pratama', instansi: 'Universitas Negeri Malang', jalur: 'Vocational', prodi: 'Teknologi Rekayasa Sistem Elektronika', mk: [], cert: [], bahasa: [{nama: 'Inggris', level: 'Basic'}]},
                {id: 'd3', name: 'Citra Lestari', instansi: 'Universitas Negeri Malang', jalur: 'Vocational', prodi: 'Manajemen Pemasaran', mk: [], cert: [], bahasa: [{nama: 'Inggris', level: 'Intermediate'}]},
                {id: 'd4', name: 'Dimas Saputra', instansi: 'Universitas Negeri Malang', jalur: 'Vocational', prodi: 'Manajemen Pemasaran', mk: [], cert: [], bahasa: []},
                {id: 'd5', name: 'Eka Wulandari', instansi: 'Universitas Negeri Malang', jalur: 'Akademis', prodi: 'Matematika', mk: [], cert: [], bahasa: [{nama: 'Jepang', level: 'Intermediate'}]},
                {id: 'd6', name: 'Fajar Nugroho', instansi: 'Universitas Negeri Malang', jalur: 'Akademis', prodi: 'Matematika', mk: [], cert: [], bahasa: []},
                {id: 'd7', name: 'Gita Anjani', instansi: 'Universitas Negeri Malang', jalur: 'Akademis', prodi: 'Pendidikan Anak Usia Dini (PAUD)', mk: [], cert: [], bahasa: [{nama: 'Inggris', level: 'Intermediate'}]},
                {id: 'd8', name: 'Hana Puspita', instansi: 'Universitas Negeri Malang', jalur: 'Akademis', prodi: 'Pendidikan Anak Usia Dini (PAUD)', mk: [], cert: [], bahasa: []}
            ];

            function jpSaveDemo() {
                try { sessionStorage.setItem(JP_DEMO_KEY, JSON.stringify({kompetensi: JP.kompetensi, lowongan: JP.lowongan, shortlist: JP.shortlist})); } catch (e) {}
            }
            async function jpLoad() {
                const res = await apiRequest('jp_bootstrap');
                if (res && res.success) {
                    JP.demo = false;
                    JP.kompetensi = res.kompetensi || [];
                    JP.lowongan = res.lowongan || [];
                    JP.shortlist = (res.shortlist || []).map(String);
                    JP.candidates = res.candidates || [];
                    JP.lamaran = res.lamaran || [];
                    JP.aiEnabled = !!res.ai_enabled;
                } else {
                    JP.demo = true;
                    let saved = {};
                    try { saved = JSON.parse(sessionStorage.getItem(JP_DEMO_KEY) || '{}'); } catch (e) {}
                    JP.kompetensi = saved.kompetensi || [];
                    JP.lowongan = saved.lowongan || [];
                    JP.shortlist = saved.shortlist || [];
                    JP.candidates = JP_DEMO_CANDIDATES;
                    JP.lamaran = [];
                }
            }

            // ---------- Pemilih bahasa (dipakai di Kompetensi & Lowongan) ----------
            function setupLangPicker(prefix) {
                const st = {lang: 'Inggris', level: 'Intermediate'};
                const other = document.getElementById(prefix + 'LangOther');
                document.querySelectorAll(`#${prefix}LangPick .seg-btn`).forEach(b => b.addEventListener('click', () => {
                    st.lang = b.dataset.lang;
                    document.querySelectorAll(`#${prefix}LangPick .seg-btn`).forEach(x => x.classList.toggle('active', x === b));
                    other.classList.toggle('is-hidden', st.lang !== '__lain');
                    if (st.lang === '__lain') other.focus();
                }));
                document.querySelectorAll(`#${prefix}LangLevel .seg-btn`).forEach(b => b.addEventListener('click', () => {
                    st.level = b.dataset.level;
                    document.querySelectorAll(`#${prefix}LangLevel .seg-btn`).forEach(x => x.classList.toggle('active', x === b));
                }));
                return {
                    value() {
                        let nama = st.lang === '__lain' ? other.value.trim() : st.lang;
                        nama = nama.replace(/^bahasa\s+/i, '').replace(/\s+/g, ' ').slice(0, 40);
                        if (!nama) { other.focus(); showToast('Tulis nama bahasanya terlebih dahulu'); return null; }
                        return {nama: nama.charAt(0).toUpperCase() + nama.slice(1), level: st.level};
                    },
                    reset() { other.value = ''; },
                    onEnter(fn) { other.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); fn(); } }); }
                };
            }
            const sameLang = (a, b) => String(a).toLowerCase().replace(/^bahasa\s+/, '').trim() === String(b).toLowerCase().replace(/^bahasa\s+/, '').trim();

            // ---------- Kebutuhan (requirement) untuk penilaian kandidat ----------
            function reqFromKompetensi() {
                return {
                    kompetensi: JP.kompetensi.filter(k => !isBahasa(k)).map(k => k.nama),
                    bahasa: JP.kompetensi.filter(isBahasa).map(k => ({nama: k.nama, level: k.level})),
                    prodi: [...new Set(JP.kompetensi.map(k => k.prodi))]
                };
            }
            const reqFromLowongan = (l) => ({kompetensi: l.kompetensi || [], bahasa: l.bahasa || [], prodi: [l.prodi]});
            function jpCurrentReq() {
                const sel = document.getElementById('jpFilterLowongan').value;
                const low = JP.lowongan.find(l => String(l.id) === sel);
                return low ? reqFromLowongan(low) : reqFromKompetensi();
            }
            function jpMatch(cand, req) {
                const prof = {prodi: cand.prodi, mk: cand.mk || [], cert: cand.cert || [], bahasa: cand.bahasa || []};
                const detail = evalReq(req, prof, true);
                const total = detail.length;
                const prodiOk = req.prodi.includes(cand.prodi);
                const avg = total ? detail.reduce((a, d) => a + d.v, 0) / total : 0;
                const score = total ? Math.round((prodiOk ? 40 : 0) + 60 * avg) : 0;
                return {score, prodiOk, detail, hit: detail.filter(d => d.v >= 0.5), miss: detail.filter(d => d.v < 0.5)};
            }
            const jpRanked = (req) => JP.candidates.map(c => ({c, m: jpMatch(c, req), sl: JP.shortlist.includes(String(c.id))}))
                .sort((a, b) => b.m.score - a.m.score);

            // ---------- Ringkasan Rekrutmen ----------
            function jpRenderDashboard() {
                document.getElementById('jpCompanyName').textContent = sessionStorage.getItem('c-dfs_user_instansi') || 'Perusahaan Anda';
                const aktif = JP.lowongan.filter(l => l.status === 'Aktif');
                document.getElementById('jpStatLowongan').textContent = aktif.length;
                document.getElementById('jpStatLowonganDesc').textContent = `dari ${JP.lowongan.length} lowongan`;
                const prodiSet = new Set(JP.kompetensi.map(k => k.prodi).concat(JP.lowongan.map(l => l.prodi)));
                document.getElementById('jpStatKompetensi').textContent = JP.kompetensi.length;
                document.getElementById('jpStatProdi').textContent = `${JP.kompetensi.filter(isBahasa).length} bahasa · ${prodiSet.size} prodi`;
                // Kandidat cocok: cocok (>=60) dengan salah satu lowongan aktif, atau dengan daftar kompetensi
                const reqs = aktif.length ? aktif.map(reqFromLowongan) : (JP.kompetensi.length ? [reqFromKompetensi()] : []);
                const best = JP.candidates.map(c => ({c, score: reqs.length ? Math.max(...reqs.map(r => jpMatch(c, r).score)) : 0}))
                    .sort((a, b) => b.score - a.score);
                document.getElementById('jpStatKandidat').textContent = best.filter(x => x.score >= 60).length;
                document.getElementById('jpStatLamaran').textContent = JP.lamaran.length;
                const baru = JP.lamaran.filter(a => a.status === 'Dikirim').length;
                document.getElementById('jpStatShortlist').textContent = `${baru} belum ditinjau · ${JP.shortlist.length} shortlist`;

                const byProdi = allProdi().map(p => ({...p, k: JP.kompetensi.filter(k => k.prodi === p.nama).length, l: JP.lowongan.filter(l => l.prodi === p.nama).length}));
                const maxN = Math.max(1, ...byProdi.map(p => p.k + p.l));
                document.getElementById('jpProdiBars').innerHTML = byProdi.map(p => `
                    <div class="jp-prodi-row">
                        <span class="name">${esc(p.kode)} <span class="jp-muted">· ${esc(p.jalur)}</span></span>
                        <span class="val">${p.k} · ${p.l}</span>
                        <div class="track"><div class="fill" style="width:${((p.k + p.l) / maxN) * 100}%"></div></div>
                    </div>`).join('');

                const top = reqs.length ? best.slice(0, 5) : [];
                document.getElementById('jpTopBody').innerHTML = top.length ? top.map(({c, score}) => `
                    <tr>
                        <td><strong>${esc(c.name)}</strong>${JP.demo ? '<span class="jp-demo-badge">CONTOH</span>' : ''}</td>
                        <td>${esc(prodiKode(c.prodi))} <span class="jp-muted">· ${esc(c.jalur)}</span></td>
                        <td class="text-center"><strong>${score}%</strong></td>
                        <td class="text-center">${JP.shortlist.includes(String(c.id)) ? '<span class="badge badge-orange">Shortlist</span>' : '<span class="jp-muted">-</span>'}</td>
                    </tr>`).join('')
                    : `<tr><td colspan="4" class="text-center jp-muted" style="padding:24px;">Tambahkan kompetensi atau lowongan agar kandidat bisa dinilai.</td></tr>`;
            }

            // ---------- Kelola Kompetensi: Kompetensi Teknis & Kebutuhan Bahasa ----------
            const jpKompProdi = document.getElementById('jpKompProdi');
            jpKompProdi.innerHTML = prodiOptionsHtml();
            document.querySelectorAll('#jpKompTab .seg-btn').forEach(b => b.addEventListener('click', () => {
                JP.kompTab = b.dataset.tab;
                document.querySelectorAll('#jpKompTab .seg-btn').forEach(x => x.classList.toggle('active', x === b));
                document.getElementById('jpKompPaneTeknis').classList.toggle('is-hidden', JP.kompTab !== 'teknis');
                document.getElementById('jpKompPaneBahasa').classList.toggle('is-hidden', JP.kompTab !== 'bahasa');
            }));

            function jpRenderSuggest() {
                const prodi = jpKompProdi.value;
                const ada = JP.kompetensi.filter(k => k.prodi === prodi && !isBahasa(k)).map(k => k.nama.toLowerCase());
                const pool = (PRODI_SKILLS[prodi] || []).filter(s => !ada.includes(s.toLowerCase()));
                const box = document.getElementById('jpKompSuggest');
                box.innerHTML = pool.length ? `<span class="jp-muted" style="width:100%;">Saran untuk ${esc(prodiKode(prodi))} (klik untuk menambah):</span>` : '';
                pool.forEach(s => {
                    const b = document.createElement('button');
                    b.type = 'button'; b.textContent = '+ ' + s;
                    b.addEventListener('click', () => jpAddKompetensi({nama: s, prodi, jenis: 'kompetensi'}));
                    box.appendChild(b);
                });
            }
            jpKompProdi.addEventListener('change', jpRenderSuggest);

            async function jpAddKompetensi(item) {
                item.nama = item.nama.trim();
                if (!item.nama) return;
                const ada = JP.kompetensi.find(k => k.prodi === item.prodi && (k.jenis || 'kompetensi') === item.jenis && k.nama.toLowerCase() === item.nama.toLowerCase());
                if (ada && item.jenis === 'kompetensi') return showToast('Kompetensi sudah ada');
                if (JP.demo) {
                    if (ada) ada.level = item.level; else JP.kompetensi.push({...item, id: 'k' + Date.now()});
                    jpSaveDemo();
                } else {
                    const res = await apiRequest('jp_kompetensi_add', item);
                    if (!res || !res.success) return alert((res && res.message) || 'Gagal menyimpan.');
                    if (ada) ada.level = res.kompetensi.level; else JP.kompetensi.push(res.kompetensi);
                }
                showToast(ada ? `Tingkat bahasa ${item.nama} diperbarui` : (item.jenis === 'bahasa' ? 'Kebutuhan bahasa ditambahkan' : 'Kompetensi ditambahkan'));
                jpRenderAll();
            }
            document.getElementById('formJpKompetensi').addEventListener('submit', (e) => {
                e.preventDefault();
                const input = document.getElementById('jpKompNama');
                jpAddKompetensi({nama: input.value, prodi: jpKompProdi.value, jenis: 'kompetensi'});
                input.value = '';
                input.focus();
            });
            const jpKLang = setupLangPicker('jpK');
            const jpKAddLang = () => {
                const v = jpKLang.value();
                if (!v) return;
                jpAddKompetensi({nama: v.nama, level: v.level, prodi: jpKompProdi.value, jenis: 'bahasa'});
                jpKLang.reset();
            };
            document.getElementById('jpKLangAdd').addEventListener('click', jpKAddLang);
            jpKLang.onEnter(jpKAddLang);

            function jpRenderKompetensi() {
                document.getElementById('jpKompCount').textContent = `${JP.kompetensi.length} item`;
                const rows = [...JP.kompetensi].sort((a, b) => a.prodi.localeCompare(b.prodi) || (isBahasa(a) - isBahasa(b)));
                document.getElementById('jpKompBody').innerHTML = rows.length ? rows.map((k, i) => `
                    <tr>
                        <td class="text-center">${i + 1}</td>
                        <td><strong>${esc(isBahasa(k) ? 'Bahasa ' + k.nama : k.nama)}</strong></td>
                        <td>${isBahasa(k) ? `<span class="badge jp-badge-lang">Bahasa · min. ${esc(k.level)}</span>` : '<span class="badge badge-blue">Teknis</span>'}</td>
                        <td><span class="badge badge-blue">${esc(prodiKode(k.prodi))}</span> <span class="jp-muted">${esc(k.prodi)}</span></td>
                        <td class="text-center"><button class="jp-btn-sm danger" data-hapus="${esc(k.id)}" aria-label="Hapus ${esc(k.nama)}"><i class="fa-regular fa-trash-can"></i> Hapus</button></td>
                    </tr>`).join('')
                    : `<tr><td colspan="5" class="text-center jp-muted" style="padding:24px;">Belum ada data. Tambahkan kompetensi teknis atau kebutuhan bahasa di atas.</td></tr>`;
                jpRenderSuggest();
            }
            document.getElementById('jpKompBody').addEventListener('click', async (e) => {
                const b = e.target.closest('button[data-hapus]');
                if (!b) return;
                const k = JP.kompetensi.find(x => String(x.id) === b.dataset.hapus);
                if (!k) return;
                if (!JP.demo) {
                    const res = await apiRequest('jp_kompetensi_delete', {id: k.id});
                    if (!res || !res.success) return alert((res && res.message) || 'Gagal menghapus.');
                }
                JP.kompetensi = JP.kompetensi.filter(x => x !== k);
                if (JP.demo) jpSaveDemo();
                showToast('Data dihapus');
                jpRenderAll();
            });

            // ---------- Kelola Lowongan ----------
            const jpLowProdi = document.getElementById('jpLowProdi');
            jpLowProdi.innerHTML = prodiOptionsHtml();
            const jpLLang = setupLangPicker('jpL');

            function jpRenderLowForm() {
                const prodi = jpLowProdi.value;
                // Chip kompetensi: dari daftar kompetensi teknis prodi ini + kompetensi tambahan lowongan
                const pool = [...new Set(JP.kompetensi.filter(k => !isBahasa(k) && k.prodi === prodi).map(k => k.nama).concat(JP.form.komp))];
                document.getElementById('jpLowKompChips').innerHTML = pool.length ? pool.map(n => `
                    <button type="button" class="jp-chip ${JP.form.komp.includes(n) ? 'on' : ''}" data-komp="${esc(n)}">
                        <i class="fa-solid ${JP.form.komp.includes(n) ? 'fa-check' : 'fa-plus'}"></i> ${esc(n)}</button>`).join('')
                    : '<span class="jp-muted">Belum ada kompetensi untuk prodi ini. Ketik di bawah; kompetensi baru otomatis tersimpan ke Kebutuhan Kompetensi Umum.</span>';
                // Chip bahasa: persyaratan terpilih + saran dari Kebutuhan Bahasa prodi ini
                const saran = JP.kompetensi.filter(k => isBahasa(k) && k.prodi === prodi && !JP.form.bahasa.some(b => sameLang(b.nama, k.nama)));
                document.getElementById('jpLowLangChips').innerHTML =
                    JP.form.bahasa.map((b, i) => `<span class="jp-chip on lang">${esc(langLabel(b))} <button type="button" data-del-blang="${i}" aria-label="Hapus">&times;</button></span>`).join('') +
                    saran.map(k => `<button type="button" class="jp-chip" data-add-blang="${esc(k.id)}"><i class="fa-solid fa-plus"></i> ${esc(langLabel(k))}</button>`).join('');
            }
            jpLowProdi.addEventListener('change', () => { JP.form.komp = []; jpRenderLowForm(); });
            document.getElementById('jpLowKompChips').addEventListener('click', (e) => {
                const b = e.target.closest('[data-komp]');
                if (!b) return;
                const n = b.dataset.komp;
                JP.form.komp = JP.form.komp.includes(n) ? JP.form.komp.filter(x => x !== n) : [...JP.form.komp, n];
                jpRenderLowForm();
            });
            document.getElementById('jpLowKompInput').addEventListener('keydown', (e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                const v = e.target.value.trim().slice(0, 100);
                if (v && !JP.form.komp.some(x => x.toLowerCase() === v.toLowerCase())) JP.form.komp.push(v);
                e.target.value = '';
                jpRenderLowForm();
            });
            function jpAddLowLang(v) {
                if (!v) return;
                const ada = JP.form.bahasa.find(b => sameLang(b.nama, v.nama));
                if (ada) ada.level = v.level; else JP.form.bahasa.push(v);
                jpLLang.reset();
                jpRenderLowForm();
            }
            document.getElementById('jpLLangAdd').addEventListener('click', () => jpAddLowLang(jpLLang.value()));
            jpLLang.onEnter(() => jpAddLowLang(jpLLang.value()));
            document.getElementById('jpLowLangChips').addEventListener('click', (e) => {
                const d = e.target.closest('[data-del-blang]');
                if (d) { JP.form.bahasa.splice(+d.dataset.delBlang, 1); return jpRenderLowForm(); }
                const a = e.target.closest('[data-add-blang]');
                if (a) { const k = JP.kompetensi.find(x => String(x.id) === a.dataset.addBlang); if (k) jpAddLowLang({nama: k.nama, level: k.level}); }
            });

            // ---------- Isi otomatis dari poster lowongan (AI / OCR) ----------
            // Dengan API key: poster dibaca AI (Claude). Tanpa API key: teks dibaca OCR di browser (Tesseract.js) lalu diurai aturan.
            const OCR_CDN = Object.assign({script: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js'}, window.CDFS_OCR || {});
            let tessPromise = null;
            function loadTesseract() {
                if (window.Tesseract) return Promise.resolve(window.Tesseract);
                if (!tessPromise) tessPromise = new Promise((resolve, reject) => {
                    const sc = document.createElement('script');
                    sc.src = OCR_CDN.script;
                    sc.onload = () => resolve(window.Tesseract);
                    sc.onerror = () => { tessPromise = null; reject(new Error('Pustaka OCR gagal dimuat (periksa koneksi internet).')); };
                    document.head.appendChild(sc);
                });
                return tessPromise;
            }
            async function ocrImage(src, onProgress) {
                const T = await loadTesseract();
                const opt = {logger: (m) => { if (m.status === 'recognizing text' && onProgress) onProgress(Math.round(m.progress * 100)); }};
                ['workerPath', 'corePath', 'langPath'].forEach(k => { if (OCR_CDN[k]) opt[k] = OCR_CDN[k]; });
                const worker = await T.createWorker(['ind', 'eng'], 1, opt);
                try { return (await worker.recognize(src)).data.text || ''; } finally { await worker.terminate(); }
            }
            async function pdfFirstPageImage(file) {
                const pdfjs = await loadPdfJs();
                const doc = await pdfjs.getDocument({data: new Uint8Array(await file.arrayBuffer())}).promise;
                const page = await doc.getPage(1);
                const vp = page.getViewport({scale: 2});
                const cv = document.createElement('canvas'); cv.width = vp.width; cv.height = vp.height;
                await page.render({canvasContext: cv.getContext('2d'), viewport: vp}).promise;
                return cv.toDataURL('image/png');
            }

            // Kosakata kompetensi untuk mengenali isi poster
            const POSTER_VOCAB = [...new Set(Object.values(PRODI_SKILLS).flat().concat([
                'PLC', 'SCADA', 'Arduino', 'Mikrokontroler', 'Internet of Things', 'IoT', 'Embedded System', 'Desain PCB', 'Instrumentasi', 'Sistem Kendali', 'Otomasi Industri', 'Panel Listrik', 'Panel Surya', 'Troubleshooting', 'Soldering', 'AutoCAD', 'Pemeliharaan Mesin', 'K3',
                'Digital Marketing', 'Media Sosial', 'Social Media', 'SEO', 'Google Ads', 'Meta Ads', 'Copywriting', 'Content Creator', 'Branding', 'Riset Pasar', 'Negosiasi', 'Penjualan', 'Customer Service', 'CRM', 'E-commerce',
                'Python', 'SQL', 'Excel', 'Microsoft Office', 'Statistika', 'Analisis Data', 'Data Analytics', 'Machine Learning', 'Power BI', 'Tableau', 'Pemodelan Matematika', 'Aktuaria',
                'Perencanaan Pembelajaran', 'Asesmen Perkembangan', 'Media Pembelajaran', 'Bercerita', 'Literasi Anak', 'Pengasuhan', 'Kurikulum Merdeka', 'Manajemen Kelas'
            ]))];
            const KOTA = ['Malang', 'Batu', 'Surabaya', 'Sidoarjo', 'Pasuruan', 'Gresik', 'Mojokerto', 'Kediri', 'Blitar', 'Jakarta', 'Bekasi', 'Tangerang', 'Bandung', 'Semarang', 'Yogyakarta', 'Bali', 'Remote'];
            const PRODI_KATA = {
                'Teknologi Rekayasa Sistem Elektronika': /elektro|elektronika|listrik|\biot\b|plc|mikrokontroler|embedded|instrumentasi|otomasi|teknisi|scada|pcb/g,
                'Manajemen Pemasaran': /pemasaran|marketing|\bsales\b|penjualan|brand|promosi|media sosial|social media|copywrit|e-commerce/g,
                'Matematika': /matematika|statistik|data analyst|data scien|aktuari|analisis data|python|\bsql\b|machine learning/g,
                'Pendidikan Anak Usia Dini (PAUD)': /\bpaud\b|\btk\b|anak usia dini|kelompok bermain|guru kelas|pengasuh|daycare/g
            };
            const BAHASA_KATA = [[/inggris|english|toefl|toeic|ielts/i, 'Inggris'], [/jepang|japanese|jlpt|nihongo/i, 'Jepang'], [/jerman|german|deutsch/i, 'Jerman'], [/mandarin|chinese|hsk/i, 'Mandarin'], [/korea|korean|topik/i, 'Korea'], [/\barab|arabic/i, 'Arab']];
            const tutupTeks = (t) => t.replace(/[•·●▪■◦►\-–—*]+\s*/g, '').replace(/\s+/g, ' ').replace(/[.;,:]+$/, '').trim();

            function parsePoster(text) {
                const lines = text.split(/\r?\n/).map(l => l.replace(/\s+/g, ' ').trim()).filter(l => l.length > 1);
                const low = text.toLowerCase();
                const hasil = {posisi: '', lokasi: '', deskripsi: '', kompetensi: [], bahasa: [], prodi: ''};
                // Posisi
                const RE_POS = /^(?:lowongan(?:\s+kerja)?|dibutuhkan|dicari|we(?:'|’)?re hiring|we are hiring|hiring|open recruitment|posisi|position|job title)\s*[:\-–]?\s*(.*)$/i;
                for (let i = 0; i < lines.length && !hasil.posisi; i++) {
                    const m = lines[i].match(RE_POS);
                    if (!m) continue;
                    const isi = tutupTeks(m[1] || '');
                    hasil.posisi = isi.length >= 3 ? isi : tutupTeks(lines[i + 1] || '');
                }
                if (!hasil.posisi) hasil.posisi = tutupTeks(lines.find(l => { const w = l.split(' ').length; return w >= 1 && w <= 6 && !/^(pt|cv)\b|lowongan|kualifikasi|persyaratan/i.test(l); }) || '');
                hasil.posisi = hasil.posisi.slice(0, 120);
                // Lokasi
                const lm = text.match(/(?:lokasi|penempatan|location|domisili|area)\s*(?:kerja)?\s*[:\-–]\s*([^\n]+)/i);
                if (lm) hasil.lokasi = tutupTeks(lm[1]).slice(0, 100);
                else { const k = KOTA.find(c => new RegExp('\\b' + c + '\\b', 'i').test(text)); if (k) hasil.lokasi = k; }
                // Bagian kualifikasi
                const RE_HEAD = /^(kualifikasi|persyaratan|requirements?|qualifications?|syarat|kriteria|skills?|keahlian|kemampuan|yang kami cari)\b/i;
                const RE_STOP = /^(benefit|fasilitas|keuntungan|cara melamar|how to apply|kirim|apply|deadline|batas|kontak|contact|deskripsi|tanggung jawab|job desc|tugas)\b/i;
                let iKual = lines.findIndex(l => RE_HEAD.test(l));
                const kual = [];
                if (iKual >= 0) for (let i = iKual + 1; i < lines.length && !RE_STOP.test(lines[i]); i++) kual.push(lines[i]);
                const sumber = kual.length ? kual : lines;
                // (a) kosakata yang dikenal
                const ketemu = new Set();
                POSTER_VOCAB.forEach(v => {
                    const tv = tokens(v);
                    if (!tv.length && v.length > 2) return;
                    const pola = v.length <= 4 ? new RegExp('\\b' + v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i') : null;
                    if (sumber.some(l => pola ? pola.test(l) : (tokens(l).length && tv.every(t => tokens(l).some(y => same(t, y)))))) ketemu.add(v);
                });
                // gabungkan sinonim yang sama
                [['IoT', 'Internet of Things'], ['Social Media', 'Media Sosial']].forEach(([a, b]) => { if (ketemu.has(a) && ketemu.has(b)) ketemu.delete(a); });
                // (b) frasa "Menguasai / Mampu / Paham / Familiar with ..." yang bukan syarat umum
                const UMUM = /pendidikan|lulusan|\bs1\b|\bd3\b|\bd4\b|\bsma\b|\bsmk\b|usia|umur|pria|wanita|\bipk\b|\bsim\b|domisili|berpenampilan|jujur|disiplin|bersedia|sehat|tidak (buta|merokok)|pengalaman minimal|fresh graduate|tim|komunikasi/i;
                sumber.forEach(l => {
                    const m = l.match(/(?:menguasai|mampu|memahami|paham|familiar with|proficient in|mahir|terampil|berpengalaman (?:di|dalam))\s+(.+)/i);
                    if (!m || UMUM.test(l)) return;
                    const frasa = tutupTeks(m[1]).replace(/^(menggunakan|mengoperasikan|membuat)\s+/i, '');
                    if (frasa.length >= 3 && frasa.length <= 60 && ![...ketemu].some(k => related(k, frasa))) ketemu.add(frasa.charAt(0).toUpperCase() + frasa.slice(1));
                });
                hasil.kompetensi = [...ketemu].slice(0, 10);
                // Bahasa
                BAHASA_KATA.forEach(([re, nama]) => {
                    const baris = lines.find(l => re.test(l));
                    if (!baris) return;
                    const b = baris.toLowerCase();
                    let level = 'Intermediate';
                    if (/fasih|fluent|native|advanced|n1\b|n2\b|sangat baik/.test(b)) level = 'Advanced';
                    else if (/pasif|dasar|basic|n4\b|n5\b|sedikit/.test(b)) level = 'Basic';
                    hasil.bahasa.push({nama, level});
                });
                // Prodi
                const skor = Object.entries(PRODI_KATA).map(([p, re]) => [p, (low.match(re) || []).length]).sort((a, b) => b[1] - a[1]);
                if (skor[0][1] > 0 && skor[0][1] > (skor[1] || [0, 0])[1]) hasil.prodi = skor[0][0];
                // Deskripsi
                const iDesk = lines.findIndex(l => /^(deskripsi|tanggung jawab|job desc|tugas|responsibilit)/i.test(l));
                const desk = [];
                if (iDesk >= 0) for (let i = iDesk + 1; i < lines.length && desk.length < 4 && !RE_HEAD.test(lines[i]) && !RE_STOP.test(lines[i]); i++) desk.push(lines[i]);
                hasil.deskripsi = desk.map(tutupTeks).join('; ').slice(0, 600);
                return hasil;
            }

            function applyPoster(d, sumber) {
                if (d.posisi) document.getElementById('jpLowPosisi').value = d.posisi;
                if (d.prodi && [...jpLowProdi.options].some(o => o.value === d.prodi)) jpLowProdi.value = d.prodi;
                if (d.lokasi) document.getElementById('jpLowLokasi').value = d.lokasi;
                const desk = (d.deskripsi || '').trim();
                document.getElementById('jpLowDesk').value = (desk ? desk + '\n' : '') + `(Diisi otomatis dari poster · ${sumber}. Periksa kembali sebelum menyimpan.)`;
                JP.form.komp = [...new Set((d.kompetensi || []).map(k => String(k).trim()).filter(Boolean))].slice(0, 12);
                JP.form.bahasa = (d.bahasa || []).filter(b => b && b.nama && LEVELS.includes(b.level)).map(b => ({nama: b.nama, level: b.level}));
                jpRenderLowForm();
            }

            async function handlePoster(file) {
                if (!file) return;
                const st = document.getElementById('jpPosterStatus'), box = document.getElementById('jpPosterResult');
                const isPdf = /pdf$/i.test(file.type) || /\.pdf$/i.test(file.name);
                if (!isPdf && !/^image\//.test(file.type)) return showToast('Gunakan gambar (JPG/PNG) atau PDF poster lowongan');
                if (file.size > 5 * 1024 * 1024) return showToast('File terlalu besar (maks. 5 MB)');
                const url = isPdf ? '' : URL.createObjectURL(file);
                box.classList.remove('is-hidden');
                box.innerHTML = `${url ? `<img src="${url}" alt="Pratinjau poster" />` : '<div class="jp-poster-pdf"><i class="fa-regular fa-file-pdf"></i></div>'}<div class="jp-poster-info"><strong>${escHtml(file.name)}</strong><span id="jpPosterProg"><i class="fa-solid fa-spinner fa-spin"></i> Membaca poster...</span></div>`;
                const prog = (t) => { const el = document.getElementById('jpPosterProg'); if (el) el.innerHTML = t; };
                let data = null, sumber = '';
                try {
                    if (JP.aiEnabled && !JP.demo) {
                        prog('<i class="fa-solid fa-spinner fa-spin"></i> AI sedang membaca poster...');
                        const res = await apiRequest('jp_ai_lowongan', {media_type: isPdf ? 'application/pdf' : file.type, data: await fileToBase64(file)});
                        if (res && res.success && res.data) { data = res.data; sumber = 'dibaca AI'; }
                    }
                    if (!data) {
                        let text = '';
                        if (isPdf) { try { text = (await pdfLines(file)).join('\n'); } catch (e) { console.warn(e); } }
                        if (text.replace(/\s/g, '').length < 30) {
                            prog('<i class="fa-solid fa-spinner fa-spin"></i> Membaca teks pada gambar (OCR)... 0%');
                            text = await ocrImage(isPdf ? await pdfFirstPageImage(file) : file, (p) => prog(`<i class="fa-solid fa-spinner fa-spin"></i> Membaca teks pada gambar (OCR)... ${p}%`));
                            sumber = 'OCR otomatis';
                        } else sumber = 'teks PDF';
                        data = parsePoster(text);
                    }
                } catch (e) {
                    console.warn(e);
                    prog(`<span class="warn"><i class="fa-solid fa-triangle-exclamation"></i> ${escHtml(e.message || 'Poster gagal dibaca')}</span>`);
                    return;
                }
                if (!data.posisi && !(data.kompetensi || []).length) { prog('<span class="warn"><i class="fa-solid fa-triangle-exclamation"></i> Isi lowongan tidak terdeteksi. Coba gambar yang lebih jelas, atau isi form secara manual.</span>'); return; }
                applyPoster(data, sumber);
                prog(`<span class="ok"><i class="fa-solid fa-circle-check"></i> Terdeteksi (${escHtml(sumber)}): <b>${escHtml(data.posisi || '-')}</b> · ${(data.kompetensi || []).length} kompetensi · ${(data.bahasa || []).length} syarat bahasa${data.prodi ? ' · ' + escHtml(prodiKode(data.prodi)) : ''}</span><small>Periksa form di bawah, lalu klik <b>Simpan Lowongan</b>. Lowongan langsung tampil di Job Matching mahasiswa.</small>`);
                document.getElementById('jpLowPosisi').scrollIntoView({behavior: 'smooth', block: 'center'});
            }
            (() => {
                const drop = document.getElementById('jpPosterDrop'), inp = document.getElementById('jpPosterFile');
                inp.addEventListener('change', () => { if (inp.files[0]) handlePoster(inp.files[0]); inp.value = ''; });
                ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('drag'); }));
                ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('drag'); }));
                drop.addEventListener('drop', (e) => { const f = e.dataTransfer.files[0]; if (f) handlePoster(f); });
            })();

            function jpResetLowForm() {
                const prodiTerakhir = jpLowProdi.value;
                document.getElementById('formJpLowongan').reset();
                if (prodiTerakhir) jpLowProdi.value = prodiTerakhir;   // pertahankan prodi agar mudah menambah lowongan berikutnya
                document.getElementById('jpLowId').value = '';
                document.getElementById('jpLowFormTitle').textContent = 'Tambah Lowongan';
                document.getElementById('jpLowSubmit').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Simpan Lowongan';
                document.getElementById('jpLowCancel').classList.add('is-hidden');
                JP.form = {komp: [], bahasa: []};
                jpRenderLowForm();
            }
            document.getElementById('jpLowCancel').addEventListener('click', jpResetLowForm);
            function jpEditLow(id) {
                const l = JP.lowongan.find(x => String(x.id) === String(id));
                if (!l) return;
                document.getElementById('jpLowId').value = l.id;
                document.getElementById('jpLowPosisi').value = l.posisi;
                jpLowProdi.value = l.prodi;
                document.getElementById('jpLowLokasi').value = l.lokasi || '';
                document.getElementById('jpLowDesk').value = l.deskripsi || '';
                JP.form = {komp: [...(l.kompetensi || [])], bahasa: (l.bahasa || []).map(b => ({...b}))};
                document.getElementById('jpLowFormTitle').textContent = 'Edit Lowongan';
                document.getElementById('jpLowSubmit').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Simpan Perubahan';
                document.getElementById('jpLowCancel').classList.remove('is-hidden');
                jpRenderLowForm();
                document.getElementById('jpLowPosisi').focus();
            }
            document.getElementById('formJpLowongan').addEventListener('submit', async (e) => {
                e.preventDefault();
                const low = {
                    id: document.getElementById('jpLowId').value || null,
                    posisi: document.getElementById('jpLowPosisi').value.trim(),
                    prodi: jpLowProdi.value,
                    lokasi: document.getElementById('jpLowLokasi').value.trim(),
                    deskripsi: document.getElementById('jpLowDesk').value.trim(),
                    kompetensi: [...JP.form.komp],
                    bahasa: JP.form.bahasa.map(b => ({...b}))
                };
                if (!low.posisi) return alert('Isi posisi / jabatan.');
                if (!low.kompetensi.length) return alert('Pilih atau tambahkan minimal satu kompetensi yang dibutuhkan.');
                let baru = 0;
                if (JP.demo) {
                    if (low.id) { const i = JP.lowongan.findIndex(x => String(x.id) === String(low.id)); JP.lowongan[i] = {...JP.lowongan[i], ...low}; }
                    else JP.lowongan.push({...low, id: 'l' + Date.now(), status: 'Aktif', created_at: new Date().toISOString()});
                    // Kompetensi & bahasa baru otomatis masuk ke Kebutuhan Kompetensi Umum (bahasa yang sudah ada tidak diubah)
                    const ada = (nama, jenis) => JP.kompetensi.some(k => k.prodi === low.prodi && (k.jenis || 'kompetensi') === jenis && (jenis === 'bahasa' ? sameLang(k.nama, nama) : k.nama.toLowerCase() === nama.toLowerCase()));
                    low.kompetensi.forEach((n, i) => { if (!ada(n, 'kompetensi')) { JP.kompetensi.push({id: 'k' + Date.now() + i, nama: n, prodi: low.prodi, jenis: 'kompetensi'}); baru++; } });
                    low.bahasa.forEach((b, i) => { if (!ada(b.nama, 'bahasa')) { JP.kompetensi.push({id: 'b' + Date.now() + i, nama: b.nama, level: b.level, prodi: low.prodi, jenis: 'bahasa'}); baru++; } });
                    jpSaveDemo();
                } else {
                    const res = await apiRequest('jp_lowongan_save', low);
                    if (!res || !res.success) return alert((res && res.message) || 'Gagal menyimpan lowongan.');
                    const i = JP.lowongan.findIndex(x => String(x.id) === String(res.lowongan.id));
                    if (i >= 0) JP.lowongan[i] = res.lowongan; else JP.lowongan.unshift(res.lowongan);
                    if (Array.isArray(res.kompetensi)) { baru = res.kompetensi.length - JP.kompetensi.length; JP.kompetensi = res.kompetensi; }
                }
                showToast((low.id ? 'Lowongan diperbarui' : 'Lowongan ditambahkan') + (baru > 0 ? ` · ${baru} kebutuhan baru disimpan ke Kebutuhan Kompetensi Umum` : ''));
                jpResetLowForm();
                jpRenderAll();
            });
            async function jpLowStatus(l) {
                const status = l.status === 'Aktif' ? 'Ditutup' : 'Aktif';
                if (!JP.demo) {
                    const res = await apiRequest('jp_lowongan_status', {id: l.id, status});
                    if (!res || !res.success) return alert((res && res.message) || 'Gagal mengubah status.');
                }
                l.status = status;
                if (JP.demo) jpSaveDemo();
                showToast(status === 'Aktif' ? 'Lowongan dibuka kembali' : 'Lowongan ditutup');
                jpRenderAll();
            }
            async function jpLowDelete(l) {
                if (!confirm(`Hapus lowongan "${l.posisi}"?`)) return;
                if (!JP.demo) {
                    const res = await apiRequest('jp_lowongan_delete', {id: l.id});
                    if (!res || !res.success) return alert((res && res.message) || 'Gagal menghapus.');
                }
                JP.lowongan = JP.lowongan.filter(x => x !== l);
                if (JP.demo) jpSaveDemo();
                showToast('Lowongan dihapus');
                jpRenderAll();
            }
            function jpRenderLowList() {
                const list = JP.lowongan.filter(l => JP.lowFilter === 'semua' || l.status === JP.lowFilter);
                const box = document.getElementById('jpLowList');
                if (!list.length) {
                    box.innerHTML = `<div class="jp-empty-block"><i class="fa-regular fa-folder-open"></i>${JP.lowongan.length ? 'Tidak ada lowongan dengan status ini.' : 'Belum ada lowongan. Isi form di samping untuk menambahkan lowongan pertama.'}</div>`;
                    return;
                }
                box.innerHTML = list.map(l => {
                    const req = reqFromLowongan(l);
                    const cocok = JP.candidates.filter(c => jpMatch(c, req).score >= 60).length;
                    const pel = JP.lamaran.filter(a => String(a.lowongan_id) === String(l.id)).length;
                    return `
                    <div class="jp-job ${l.status === 'Aktif' ? '' : 'closed'}">
                        <div class="jp-job-head">
                            <div>
                                <div class="jp-job-title">${esc(l.posisi)}</div>
                                <div class="jp-job-meta">
                                    <span><i class="fa-solid fa-graduation-cap"></i> ${esc(prodiKode(l.prodi))}</span>
                                    ${l.lokasi ? `<span><i class="fa-solid fa-location-dot"></i> ${esc(l.lokasi)}</span>` : ''}
                                    <span class="${pel ? 'jp-pel' : ''}"><i class="fa-solid fa-paper-plane"></i> ${pel} pelamar</span>
                                </div>
                            </div>
                            <span class="badge ${l.status === 'Aktif' ? 'badge-green' : 'badge-orange'}">${esc(l.status)}</span>
                        </div>
                        <div class="jp-job-tags">
                            ${(l.kompetensi || []).map(k => `<span class="t">${esc(k)}</span>`).join('')}
                            ${(l.bahasa || []).map(b => `<span class="t lang"><i class="fa-solid fa-language"></i> ${esc(b.nama)} · min. ${esc(b.level)}</span>`).join('')}
                        </div>
                        ${l.deskripsi ? `<p class="jp-job-desc">${esc(l.deskripsi)}</p>` : ''}
                        <div class="jp-job-actions">
                            <button class="jp-btn-sm primary" data-act="kandidat" data-id="${esc(l.id)}"><i class="fa-solid fa-user-check"></i> ${cocok} Kandidat Cocok</button>
                            <button class="jp-btn-sm" data-act="edit" data-id="${esc(l.id)}"><i class="fa-solid fa-pen"></i> Edit</button>
                            <button class="jp-btn-sm" data-act="status" data-id="${esc(l.id)}"><i class="fa-solid ${l.status === 'Aktif' ? 'fa-lock' : 'fa-lock-open'}"></i> ${l.status === 'Aktif' ? 'Tutup' : 'Buka'}</button>
                            <button class="jp-btn-sm danger" data-act="hapus" data-id="${esc(l.id)}"><i class="fa-regular fa-trash-can"></i> Hapus</button>
                        </div>
                    </div>`;
                }).join('');
            }
            document.getElementById('jpLowList').addEventListener('click', (e) => {
                const b = e.target.closest('button[data-act]');
                if (!b) return;
                const l = JP.lowongan.find(x => String(x.id) === b.dataset.id);
                if (!l) return;
                if (b.dataset.act === 'edit') jpEditLow(l.id);
                else if (b.dataset.act === 'status') jpLowStatus(l);
                else if (b.dataset.act === 'hapus') jpLowDelete(l);
                else if (b.dataset.act === 'kandidat') {
                    jpGoto('view-jp-kandidat');
                    document.getElementById('jpFilterLowongan').value = String(l.id);
                    document.getElementById('jpHanyaPelamar').checked = JP.lamaran.some(a => String(a.lowongan_id) === String(l.id));
                    jpRenderCandidates();
                }
            });
            document.querySelectorAll('#jpLowFilter .seg-btn').forEach(b => b.addEventListener('click', () => {
                JP.lowFilter = b.dataset.status;
                document.querySelectorAll('#jpLowFilter .seg-btn').forEach(x => x.classList.toggle('active', x === b));
                jpRenderLowList();
            }));

            // ---------- Rekomendasi Kandidat ----------
            const jpFilterProdi = document.getElementById('jpFilterProdi');
            jpFilterProdi.innerHTML = '<option value="">Semua program studi</option>' + prodiOptionsHtml();
            function jpRenderLowSelect() {
                const sel = document.getElementById('jpFilterLowongan');
                const prev = sel.value;
                sel.innerHTML = '<option value="">Semua kebutuhan kompetensi umum</option>' +
                    JP.lowongan.map(l => `<option value="${esc(l.id)}">Lowongan: ${esc(l.posisi)} (${esc(prodiKode(l.prodi))})${l.status === 'Aktif' ? '' : ' — ditutup'}</option>`).join('');
                if ([...sel.options].some(o => o.value === prev)) sel.value = prev;
            }
            function jpRenderCandidates() {
                const grid = document.getElementById('jpCandidateGrid');
                const empty = (icon, msg) => `<div class="jp-empty-block" style="grid-column:1/-1;"><i class="fa-solid ${icon}"></i>${msg}</div>`;
                const req = jpCurrentReq();
                if (!req.kompetensi.length && !req.bahasa.length) {
                    grid.innerHTML = empty('fa-list-check', 'Tambahkan kompetensi atau lowongan di menu <strong>Kelola Lowongan</strong> atau <strong>Kebutuhan Kompetensi Umum</strong> agar kandidat bisa dinilai.');
                    return;
                }
                if (!JP.candidates.length) { grid.innerHTML = empty('fa-user-graduate', 'Belum ada Jobseeker yang memilih program studi.'); return; }
                const minSkor = parseInt(document.getElementById('jpFilterSkor').value, 10);
                const onlyShort = document.getElementById('jpHanyaShortlist').checked;
                const prodi = jpFilterProdi.value;
                const selLow = document.getElementById('jpFilterLowongan').value;
                const onlyPel = document.getElementById('jpHanyaPelamar').checked;
                // Pelamar selalu ditampilkan walau skornya di bawah batas minimal
                const rows = jpRanked(req).map(r => {
                    const lams = jpLamOf(r.c.id);
                    return {...r, lams, lam: selLow ? lams.find(a => String(a.lowongan_id) === selLow) : null};
                }).filter(r => {
                    const pelamar = selLow ? !!r.lam : r.lams.length > 0;
                    return (r.m.score >= minSkor || pelamar) && (!onlyPel || pelamar) && (!onlyShort || r.sl) && (!prodi || r.c.prodi === prodi);
                });
                if (!rows.length) { grid.innerHTML = empty('fa-filter', onlyPel ? 'Belum ada pelamar untuk pilihan ini.' : 'Tidak ada kandidat yang memenuhi filter. Coba turunkan skor minimal.'); return; }
                const total = req.kompetensi.length + req.bahasa.length;
                grid.innerHTML = rows.map(({c, m, sl, lams, lam}) => {
                    const initials = c.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
                    const level = m.score >= 60 ? '' : (m.score >= 40 ? 'mid' : 'low');
                    const nMan = (c.mk || []).filter(m => m.manual).length;
                    const dok = !(c.mk || []).length ? '' : (c.verif && !nMan ? '<span class="jp-dok"><i class="fa-solid fa-shield-halved"></i> transkrip terverifikasi</span>' : `<span class="jp-dok warn"><i class="fa-solid fa-pen"></i> ${c.verif ? nMan + ' MK diisi manual' : 'transkrip diisi manual'}</span>`);
                    return `
                    <div class="jp-cand">
                        <div class="jp-cand-head">
                            <div class="jp-cand-avatar">${esc(initials)}</div>
                            <div>
                                <div class="jp-cand-name">${esc(c.name)}${JP.demo ? '<span class="jp-demo-badge">DATA CONTOH</span>' : ''}${lam ? '<span class="lam-tag">Pelamar</span>' : (lams.length ? `<span class="lam-tag soft">Melamar ${lams.length} lowongan</span>` : '')}</div>
                                <div class="jp-cand-sub">${esc(prodiKode(c.prodi))} · ${esc(c.jalur)} · ${esc(c.instansi || '-')} ${dok}</div>
                            </div>
                            <div class="jp-score"><strong>${m.score}%</strong><span>kecocokan</span></div>
                        </div>
                        <div class="jp-meter ${level}"><div style="width:${m.score}%"></div></div>
                        <div class="jp-cand-sub">${m.prodiOk ? '<i class="fa-solid fa-circle-check" style="color:#16a34a"></i> Prodi sesuai' : '<i class="fa-solid fa-circle-minus"></i> Prodi di luar kebutuhan'} · ${m.hit.length}/${total} kebutuhan terpenuhi</div>
                        <div class="jp-cand-skills">
                            ${m.hit.map(d => `<span class="s hit" title="${esc(d.src)}">${esc(d.nama)}</span>`).join('')}
                            ${m.miss.map(d => `<span class="s miss" title="${esc(d.src)}">${esc(d.nama)}</span>`).join('')}
                        </div>
                        ${lam ? `<div class="jp-lam-row"><label>Status lamaran</label>
                            <select class="jp-input jp-lam-sel ${(LAM_INFO[lam.status] || LAM_INFO.Dikirim)[0]}" data-lam-low="${esc(lam.lowongan_id)}" data-lam-js="${esc(c.id)}" aria-label="Status lamaran ${esc(c.name)}">
                                ${Object.keys(LAM_INFO).map(st => `<option ${st === lam.status ? 'selected' : ''}>${st}</option>`).join('')}
                            </select></div>`
                        : (lams.length ? `<div class="jp-lam-list">${lams.map(a => { const lw = JP.lowongan.find(l => String(l.id) === String(a.lowongan_id)); return `<span>${esc(lw ? lw.posisi : 'Lowongan')}: ${lamBadge(a.status)}</span>`; }).join('')}</div>` : '')}
                        ${(c.mk || []).length ? '<div class="jp-unverified"><i class="fa-solid fa-circle-info"></i> Transkrip dibaca otomatis dari dokumen yang diunggah kandidat; belum dicocokkan dengan SIAKAD. Kemahiran bahasa diisi sendiri oleh kandidat.</div>' : ''}
                        <button class="jp-btn-sm ${sl ? 'primary' : ''}" data-short="${esc(c.id)}">
                            <i class="fa-${sl ? 'solid' : 'regular'} fa-bookmark"></i> ${sl ? 'Di-shortlist' : 'Tambah ke Shortlist'}
                        </button>
                    </div>`;
                }).join('');
            }
            document.getElementById('jpCandidateGrid').addEventListener('click', async (e) => {
                const b = e.target.closest('button[data-short]');
                if (!b) return;
                const id = b.dataset.short;
                const on = !JP.shortlist.includes(id);
                if (!JP.demo) {
                    const res = await apiRequest('jp_shortlist', {jobseeker_id: id, on});
                    if (!res || !res.success) return alert((res && res.message) || 'Gagal memperbarui shortlist.');
                }
                JP.shortlist = on ? [...JP.shortlist, id] : JP.shortlist.filter(x => x !== id);
                if (JP.demo) jpSaveDemo();
                showToast(on ? 'Kandidat ditambahkan ke shortlist' : 'Kandidat dihapus dari shortlist');
                jpRenderCandidates();
                jpRenderDashboard();
            });
            const jpLamOf = (cid) => JP.lamaran.filter(a => String(a.jobseeker_id) === String(cid));
            document.getElementById('jpCandidateGrid').addEventListener('change', async (e) => {
                const sel = e.target.closest('.jp-lam-sel');
                if (!sel) return;
                const a = JP.lamaran.find(x => String(x.lowongan_id) === sel.dataset.lamLow && String(x.jobseeker_id) === sel.dataset.lamJs);
                if (!a) return;
                const status = sel.value;
                if (!JP.demo) {
                    const res = await apiRequest('jp_lamaran_status', {lowongan_id: a.lowongan_id, jobseeker_id: a.jobseeker_id, status});
                    if (!res || !res.success) { sel.value = a.status; return alert((res && res.message) || 'Gagal memperbarui status.'); }
                }
                a.status = status;
                showToast(`Status lamaran: ${status}`);
                jpRenderCandidates();
                jpRenderDashboard();
            });
            ['jpFilterLowongan', 'jpFilterProdi', 'jpFilterSkor', 'jpHanyaShortlist', 'jpHanyaPelamar'].forEach(id =>
                document.getElementById(id).addEventListener('change', jpRenderCandidates));

            // ---------- Navigasi, dropdown sidebar & inisialisasi ----------
            function jpGoto(target) {
                const nav = document.querySelector(`.sidebar-nav .nav-item[data-target="${target}"]`);
                if (nav) nav.click();
            }
            document.querySelectorAll('.jp-goto').forEach(b => b.addEventListener('click', () => jpGoto(b.dataset.goto)));
            document.addEventListener('click', (e) => {
                const b = e.target.closest('.js-goto, .pr-goto, .js-goto-btn');
                if (b && b.dataset.goto) { e.preventDefault(); jpGoto(b.dataset.goto); }
            });
            document.querySelectorAll('.nav-group').forEach(g => {
                const t = g.querySelector('.nav-group-toggle');
                t.addEventListener('click', () => {
                    g.classList.toggle('open');
                    t.setAttribute('aria-expanded', g.classList.contains('open'));
                });
                g.querySelectorAll('.nav-sub-item').forEach(si => si.addEventListener('click', () => g.classList.add('open')));
            });

            function jpRenderAll() {
                jpRenderDashboard();
                jpRenderKompetensi();
                jpRenderLowForm();
                jpRenderLowList();
                jpRenderLowSelect();
                jpRenderCandidates();
            }
            async function initJobprovider() {
                await jpLoad();
                JP.form = {komp: [], bahasa: []};
                jpRenderAll();
            }

            // Tampilkan menu & halaman sesuai peran
            function applyRoleLayout() {
                const role = sessionStorage.getItem('c-dfs_user_role') || 'Jobseeker';
                document.body.dataset.role = role;
                const first = role === 'Jobprovider' ? 'view-jp-dashboard' : 'view-dashboard';
                document.querySelectorAll('.sidebar-nav .nav-item').forEach(n => n.classList.toggle('active', n.dataset.target === first));
                document.querySelectorAll('.view-section').forEach(v => v.classList.toggle('active', v.id === first));
                if (role === 'Jobprovider') initJobprovider(); else initJobMatching();
            }

            // ==============================================================
            // 13. TAB PADA HALAMAN GABUNGAN
            // ==============================================================
            document.querySelectorAll('.page-tabs').forEach(bar => {
                bar.addEventListener('click', (e) => {
                    const btn = e.target.closest('.tab-btn');
                    if (!btn) return;
                    const g = bar.dataset.group;
                    bar.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b === btn));
                    document.querySelectorAll(`.tab-panel[data-group="${g}"]`).forEach(p =>
                        p.classList.toggle('active', p.dataset.panel === btn.dataset.tab));
                    jalankanAnimasiAngka();
                });
            });

            // ==============================================================
            // 14. JOB MATCHING (Jobseeker)
            //     Upload transkrip & sertifikat -> deteksi otomatis -> analisis AI
            // ==============================================================
            const JM_DEMO_KEY = 'c-dfs_jm_demo_v2';
            // Bobot nilai mengikuti pedoman UM (A-=3,7; B+=3,3; dst.). Jika transkrip memuat nilai angka (NA), angka itu yang dipakai.
            const GRADE = {'A': 4, 'A-': 3.7, 'AB': 3.5, 'B+': 3.3, 'B': 3, 'B-': 2.7, 'BC': 2.5, 'C+': 2.3, 'C': 2, 'D': 1, 'E': 0};
            const bobot = (m) => (typeof m.na === 'number' && m.na >= 0 && m.na <= 4) ? m.na : (GRADE[m.nilai] ?? 0);
            const JM = { loaded: false, demo: false, aiEnabled: false, mk: [], mkMeta: {}, cert: [], bahasa: [], lowongan: [], lamaran: [], tampil: false, results: [], roles: [], sort: 'peluang', langPick: 'Inggris', langLevel: 'Intermediate' };
            // Kemahiran bahasa: bobot tiap tingkat
            const LEVEL_VAL = {'Basic': 0.4, 'Intermediate': 0.7, 'Advanced': 1};
            const LEVELS = Object.keys(LEVEL_VAL);

            // Lowongan contoh — hanya tampil saat PHP/MySQL belum aktif
            const JM_DEMO_LOWONGAN = [
                {id: 'd1', tipe: 'lowongan', posisi: 'Teknisi IoT', perusahaan: 'PT Contoh Elektronika', prodi: 'Teknologi Rekayasa Sistem Elektronika', lokasi: 'Malang', kompetensi: ['Rangkaian Elektronika', 'Mikrokontroler', 'Internet of Things (IoT)', 'PLC & Otomasi'], bahasa: [{nama: 'Inggris', level: 'Intermediate'}]},
                {id: 'd2', tipe: 'lowongan', posisi: 'Digital Marketing Staff', perusahaan: 'PT Contoh Niaga', prodi: 'Manajemen Pemasaran', lokasi: 'Surabaya', kompetensi: ['Digital Marketing', 'Riset Pasar', 'Penjualan (Sales)'], bahasa: [{nama: 'Inggris', level: 'Intermediate'}]},
                {id: 'd3', tipe: 'lowongan', posisi: 'Data Analyst', perusahaan: 'CV Contoh Data', prodi: 'Matematika', lokasi: '', kompetensi: ['Analisis Data', 'Statistika', 'Pemrograman Python'], bahasa: []},
                {id: 'd4', tipe: 'lowongan', posisi: 'Guru TK', perusahaan: 'TK Contoh Ceria', prodi: 'Pendidikan Anak Usia Dini (PAUD)', lokasi: '', kompetensi: ['Perencanaan Pembelajaran', 'Asesmen Perkembangan', 'Media Ajar Kreatif'], bahasa: []}
            ];

            // Profil pekerjaan (kompetensi inti) untuk rekomendasi "cocok di pekerjaan apa".
            // Sesuaikan dengan profil lulusan / CPL masing-masing prodi.
            const JOB_ROLES = [
                {nama: 'Teknisi Elektronika', prodi: 'Teknologi Rekayasa Sistem Elektronika', kompetensi: ['Elektronika Analog', 'Elektronika Digital', 'Rangkaian Listrik', 'Pengukuran Elektronika', 'Pemeliharaan dan Perbaikan Perangkat Elektronika']},
                {nama: 'Embedded System Engineer', prodi: 'Teknologi Rekayasa Sistem Elektronika', kompetensi: ['Mikrokontroler', 'Embedded System', 'Algoritma dan Pemrograman', 'Elektronika Digital']},
                {nama: 'IoT Engineer', prodi: 'Teknologi Rekayasa Sistem Elektronika', kompetensi: ['Internet of Things', 'Sensor dan Transduser', 'Komputer dan Jaringan', 'Mikrokontroler']},
                {nama: 'Teknisi Instrumentasi & Kontrol', prodi: 'Teknologi Rekayasa Sistem Elektronika', kompetensi: ['Instrumentasi', 'Sistem Kendali', 'Sensor dan Transduser', 'PLC']},
                {nama: 'Digital Marketing Specialist', prodi: 'Manajemen Pemasaran', kompetensi: ['Digital Marketing', 'Media Sosial', 'Komunikasi Pemasaran', 'Periklanan']},
                {nama: 'Sales Executive', prodi: 'Manajemen Pemasaran', kompetensi: ['Penjualan', 'Negosiasi', 'Perilaku Konsumen', 'Komunikasi Bisnis']},
                {nama: 'Market Research Analyst', prodi: 'Manajemen Pemasaran', kompetensi: ['Riset Pasar', 'Riset Pemasaran', 'Statistika', 'Perilaku Konsumen']},
                {nama: 'Data Analyst', prodi: 'Matematika', kompetensi: ['Analisis Data', 'Statistika', 'Pemrograman', 'Basis Data']},
                {nama: 'Analis Risiko / Aktuaria', prodi: 'Matematika', kompetensi: ['Teori Peluang', 'Statistika Matematika', 'Matematika Keuangan', 'Aktuaria']},
                {nama: 'Programmer / Analis Komputasi', prodi: 'Matematika', kompetensi: ['Algoritma dan Pemrograman', 'Metode Numerik', 'Struktur Data', 'Pemrograman']},
                {nama: 'Guru PAUD / TK', prodi: 'Pendidikan Anak Usia Dini (PAUD)', kompetensi: ['Perencanaan Pembelajaran', 'Kurikulum PAUD', 'Asesmen Perkembangan', 'Manajemen Kelas']},
                {nama: 'Fasilitator Tumbuh Kembang Anak', prodi: 'Pendidikan Anak Usia Dini (PAUD)', kompetensi: ['Psikologi Perkembangan Anak', 'Gizi Anak', 'Deteksi Dini Tumbuh Kembang', 'Bimbingan Anak']},
                {nama: 'Pengembang Media Ajar Anak', prodi: 'Pendidikan Anak Usia Dini (PAUD)', kompetensi: ['Media Pembelajaran', 'Alat Permainan Edukatif', 'Seni Anak', 'Literasi Anak']}
            ];
            const kodeProdi = (nama) => { for (const l of Object.values(PRODI_BY_JALUR)) { const p = l.find(x => x.nama === nama); if (p) return p.kode; } return nama || '-'; };
            const jalurOf = (nama) => Object.keys(PRODI_BY_JALUR).find(j => PRODI_BY_JALUR[j].some(p => p.nama === nama)) || '';

            // ---------- Pencocokan teks kompetensi ----------
            const STOP = new Set(['dan', 'atau', 'the', 'of', 'and', 'untuk', 'dengan', 'dalam', 'pada', 'dasar', 'lanjut', 'lanjutan', 'pengantar', 'praktik', 'praktikum', 'teori', 'sistem', 'teknik', 'manajemen', 'pengembangan', 'aplikasi', 'tenaga', 'mata', 'kuliah']);
            const tokens = (t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter(w => w.length >= 3 && !STOP.has(w));
            // Kata umum: tidak cukup sendirian untuk menyatakan cocok
            const WEAK = new Set(['digital', 'data', 'dasar', 'terapan', 'umum', 'modern', 'bisnis', 'industri', 'komputer', 'profesional', 'fundamentals', 'fundamental', 'kreatif', 'anak', 'matematika']);
            const same = (x, y) => x === y || (x.length >= 5 && y.length >= 5 && (x.includes(y) || y.includes(x)));
            // Skor kemiripan: 0 = tidak terkait; makin besar = makin banyak kata yang sama
            function relScore(a, b) {
                const ta = tokens(a), tb = tokens(b);
                if (!ta.length || !tb.length) return 0;
                const hits = ta.filter(x => tb.some(y => same(x, y)));
                const ok = hits.some(x => !WEAK.has(x)) || hits.length === ta.length;
                return ok ? hits.length / ta.length + hits.length / tb.length : 0;
            }
            const related = (a, b) => relScore(a, b) > 0;

            function jmIpk() {
                const sks = JM.mk.reduce((a, m) => a + Number(m.sks), 0);
                const mutu = JM.mk.reduce((a, m) => a + Number(m.sks) * bobot(m), 0);
                return {ipk: sks ? mutu / sks : 0, sks};
            }
            // Bukti untuk satu kompetensi dari dokumen (mata kuliah & sertifikat)
            // Profil Jobseeker yang sedang login (dipakai Job Matching)
            const profJM = () => ({prodi: sessionStorage.getItem('c-dfs_user_prodi') || '', mk: JM.mk, cert: JM.cert, bahasa: JM.bahasa});
            // Bukti untuk satu kompetensi dari transkrip, sertifikat, dan bahasa milik "prof"
            function evidenceFor(k, withProfil, prof = profJM()) {
                // Pilih bukti dengan nilai tertinggi; jika sama, pilih yang namanya paling mirip
                let best = {v: 0, r: 0, src: 'Belum ada bukti', mk: null};
                const consider = (v, r, src, mk) => { if (r > 0 && (v > best.v || (v === best.v && r > best.r))) best = {v, r, src, mk}; };
                (prof.mk || []).forEach(m => consider(bobot(m) / 4, relScore(k, m.nama), `MK ${m.nama} (${m.nilai})`, m.nama));
                (prof.cert || []).forEach(c => consider(c.jenis === 'BNSP' ? 1 : 0.8, relScore(k, c.nama), `Sertifikat ${c.jenis}: ${c.nama}`, null));
                (prof.bahasa || []).forEach(b => consider(LEVEL_VAL[b.level] || 0, relScore(k, `Bahasa ${b.nama}`), `Bahasa ${b.nama} (${b.level})`, null));
                // Tidak ada nilai otomatis dari profil prodi: kompetensi tanpa bukti di transkrip/sertifikat/bahasa bernilai 0
                return best;
            }
            // Persyaratan bahasa: terpenuhi bila tingkat Jobseeker >= tingkat minimal
            const normLang = (n) => String(n).toLowerCase().replace(/^bahasa\s+/, '').trim();
            function langReqEval(req, prof) {
                const have = (prof.bahasa || []).find(b => normLang(b.nama) === normLang(req.nama));
                if (!have) return {v: 0, src: 'Belum ada'};
                const hv = LEVEL_VAL[have.level] || 0, rv = LEVEL_VAL[req.level] || 1;
                return hv >= rv ? {v: 1, src: `Anda: ${have.level}`} : {v: Math.round(hv / rv * 60) / 100, src: `Anda: ${have.level} (kurang)`};
            }
            // Nilai seluruh kebutuhan (kompetensi + bahasa) terhadap satu profil
            function evalReq(req, prof, withProfil) {
                return (req.kompetensi || []).map(k => ({nama: k, tipe: 'kompetensi', ...evidenceFor(k, withProfil, prof)}))
                    .concat((req.bahasa || []).map(b => ({nama: `Bahasa ${b.nama} (min. ${b.level})`, tipe: 'bahasa', ...langReqEval(b, prof)})));
            }
            function jmAnalyze(low) {
                const prof = profJM();
                const detail = evalReq(low, prof, true);
                const avg = detail.length ? detail.reduce((a, d) => a + d.v, 0) / detail.length : 0;
                const prodiOk = !!prof.prodi && prof.prodi === low.prodi;
                const kecocokan = Math.round((prodiOk ? 30 : 0) + 70 * avg);
                const {ipk} = jmIpk();
                const nB = JM.cert.filter(c => c.jenis === 'BNSP').length, nN = JM.cert.length - nB;
                const certStrength = Math.min(1, (nB + 0.5 * nN) / 2);
                const peluang = Math.round(0.55 * kecocokan + 25 * (ipk / 4) + 10 * certStrength + 10 * jmLangStrength());
                const kategori = peluang >= 75 ? 'Tinggi' : (peluang >= 50 ? 'Sedang' : 'Rendah');
                const status = kecocokan >= 75 ? 'Cocok' : (kecocokan >= 50 ? 'Cukup cocok' : 'Belum cocok');
                const bahasaReq = detail.filter(d => d.tipe === 'bahasa');
                return {low, detail, kecocokan, peluang, kategori, status, prodiOk,
                    bahasaOk: bahasaReq.every(d => d.v >= 1),
                    terpenuhi: detail.filter(d => d.v >= 0.5).map(d => d.nama),
                    kurang: detail.filter(d => d.v < 0.5).map(d => d.nama)};
            }
            // Kekuatan bahasa = tingkat tertinggi yang dimiliki (Basic 0,4 · Intermediate 0,7 · Advanced 1,0)
            function jmLangStrength() {
                return JM.bahasa.reduce((m, b) => Math.max(m, LEVEL_VAL[b.level] || 0), 0);
            }
            function jmRoles() {
                const prodi = sessionStorage.getItem('c-dfs_user_prodi') || '';
                const all = JOB_ROLES.map(r => {
                    const detail = r.kompetensi.map(k => ({nama: k, ...evidenceFor(k, false)}));
                    const skor = Math.round(100 * detail.reduce((a, d) => a + d.v, 0) / detail.length);
                    const dukung = [...new Set(detail.filter(d => d.v > 0).map(d => d.src))];
                    return {...r, skor, dukung, kurang: detail.filter(d => d.v === 0).map(d => d.nama), sendiri: r.prodi === prodi};
                }).sort((a, b) => b.skor - a.skor);
                const own = all.filter(r => r.sendiri);
                const other = all.filter(r => !r.sendiri && r.skor >= 50).slice(0, 1).map(r => ({...r, lintas: true}));
                return (own.length ? own : all.slice(0, 3)).concat(other).filter(r => r.skor > 0).slice(0, 5);
            }

            // ---------- Muat & simpan ----------
            async function jmLoad() {
                const res = await apiRequest('js_profile');
                if (res && res.success) {
                    JM.demo = false;
                    JM.aiEnabled = !!res.ai_enabled;
                    JM.mk = res.transkrip || [];
                    JM.mkMeta = res.transkrip_meta || {};
                    JM.cert = res.sertifikat || [];
                    JM.bahasa = res.bahasa || [];
                    JM.lowongan = res.lowongan || [];
                    JM.lamaran = res.lamaran || [];
                    JM.tampil = !!res.tampil;
                } else {
                    JM.demo = true;
                    JM.aiEnabled = false;
                    let saved = {};
                    try { saved = JSON.parse(sessionStorage.getItem(JM_DEMO_KEY) || '{}'); } catch (e) {}
                    JM.mk = saved.mk || [];
                    JM.mkMeta = saved.mkMeta || {};
                    JM.cert = saved.cert || [];
                    JM.bahasa = saved.bahasa || [];
                    JM.lowongan = JM_DEMO_LOWONGAN;
                    JM.lamaran = saved.lamaran || [];
                    JM.tampil = !!saved.tampil;
                }
                JM.loaded = true;
            }
            async function jmSave() {
                if (JM.demo) {
                    try { sessionStorage.setItem(JM_DEMO_KEY, JSON.stringify({mk: JM.mk, mkMeta: JM.mkMeta, cert: JM.cert, bahasa: JM.bahasa, tampil: JM.tampil, lamaran: JM.lamaran})); } catch (e) {}
                    return true;
                }
                const res = await apiRequest('js_profile_save', {transkrip: JM.mk, transkrip_meta: JM.mkMeta, sertifikat: JM.cert, bahasa: JM.bahasa, tampil: JM.tampil});
                if (!res || !res.success) { alert((res && res.message) || 'Gagal menyimpan data.'); return false; }
                return true;
            }

            // ---------- Membaca PDF di browser (pdf.js) ----------
            let pdfjsPromise = null;
            function loadPdfJs() {
                if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
                if (!pdfjsPromise) pdfjsPromise = new Promise((resolve, reject) => {
                    const sc = document.createElement('script');
                    sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
                    sc.onload = () => {
                        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                        resolve(window.pdfjsLib);
                    };
                    sc.onerror = () => { pdfjsPromise = null; reject(new Error('Pustaka pembaca PDF gagal dimuat (periksa koneksi internet).')); };
                    document.head.appendChild(sc);
                });
                return pdfjsPromise;
            }
            // Susun teks PDF menjadi baris berdasarkan posisi vertikal
            async function pdfLines(file) {
                const pdfjs = await loadPdfJs();
                const doc = await pdfjs.getDocument({data: new Uint8Array(await file.arrayBuffer())}).promise;
                const out = [];
                for (let n = 1; n <= Math.min(doc.numPages, 15); n++) {
                    const page = await doc.getPage(n);
                    const tc = await page.getTextContent();
                    const rows = [];
                    tc.items.forEach(it => {
                        if (!it.str || !it.str.trim()) return;
                        const x = it.transform[4], y = it.transform[5];
                        let row = rows.find(r => Math.abs(r.y - y) < 3);
                        if (!row) { row = {y, items: []}; rows.push(row); }
                        row.items.push({x, s: it.str.trim()});
                    });
                    rows.sort((a, b) => b.y - a.y).forEach(r => out.push(r.items.sort((a, b) => a.x - b.x).map(i => i.s).join(' ').replace(/\s+/g, ' ').trim()));
                }
                return out;
            }
            const fileToBase64 = (file) => new Promise((res, rej) => {
                const fr = new FileReader();
                fr.onload = () => res(String(fr.result).split(',')[1]);
                fr.onerror = rej;
                fr.readAsDataURL(file);
            });
            async function aiExtract(kind, file) {
                if (!JM.aiEnabled) return null;
                if (file.size > 5 * 1024 * 1024) { showToast('File terlalu besar untuk dibaca AI (maks. 5 MB)'); return null; }
                const res = await apiRequest('js_ai_extract', {kind, media_type: file.type || 'application/pdf', data: await fileToBase64(file)});
                return res && res.success && res.data ? res.data : null;
            }

            // ---------- Deteksi transkrip ----------
            const GRADE_RE = '(A-|AB|A|B\\+|B-|BC|B|C\\+|C|D|E)';
            // Mata kuliah umum/wajib universitas (tidak dihitung sebagai "nilai terbaik" bidang)
            const RE_UMUM = /^(UNIV|UKKN|MKU|MKDU|MPK|MKWU)/i;
            const NAMA_UMUM = /(agama|pancasila|kewarganegaraan|bahasa indonesia|kuliah kerja nyata|\bkkn\b|kemampuan kerjasama|etika profesi)/i;
            function parseTranskrip(lines) {
                const rows = [];
                const reKode = new RegExp('^\\d{1,3}\\s+([A-Z]{2,8}\\d{3,8})\\s+(.+?)\\s+(\\d{1,2})\\s+(?:(\\d(?:[.,]\\d{1,2})?)\\s+)?' + GRADE_RE + '(?:\\s|$)');
                const reUmum = new RegExp('^(?:\\d{1,3}\\s+)?(?:([A-Z]{2,8}\\d{3,8})\\s+)?([A-Za-z][^\\d]*?(?:\\s\\d)?)\\s+(\\d{1,2})\\s+(?:(\\d(?:[.,]\\d{1,2})?)\\s+)?' + GRADE_RE + '(?:\\s|$)');
                let prodiText = '', ipkDoc = null;
                lines.forEach(line => {
                    const pm = line.match(/Program\s*Studi\s*:?\s*(.+)/i);
                    if (pm && !prodiText) prodiText = pm[1].trim();
                    const im = line.match(/\bIPK\s*:?\s*([0-4](?:[.,]\d{1,2})?)\b/i);
                    if (im) ipkDoc = parseFloat(im[1].replace(',', '.'));
                    if (/^\s*IP[K]?\s*[\d.,]/i.test(line)) return;
                    const m = line.match(reKode) || line.match(reUmum);
                    if (!m) return;
                    const kode = m[1] || '', nama = m[2].replace(/\s+/g, ' ').trim(), sks = parseInt(m[3], 10);
                    const na = m[4] ? parseFloat(m[4].replace(',', '.')) : null, nilai = m[5].toUpperCase();
                    if (nama.length >= 3 && sks >= 1 && sks <= 8 && nilai in GRADE) {
                        const row = {nama, sks, nilai};
                        if (na !== null && na <= 4) row.na = na;
                        if (RE_UMUM.test(kode) || NAMA_UMUM.test(nama)) row.umum = true;
                        rows.push(row);
                    }
                });
                const prodi = matchProdi(prodiText);
                return {rows, prodiText, prodi, ipkDoc};
            }
            function matchProdi(text) {
                if (!text) return '';
                const t = text.toLowerCase();
                for (const l of Object.values(PRODI_BY_JALUR)) for (const p of l) {
                    const core = p.nama.toLowerCase().replace(/\s*\(.*\)\s*/, '');
                    if (t.includes(core) || new RegExp('\\b' + p.kode.toLowerCase() + '\\b').test(t)) return p.nama;
                }
                return '';
            }
            function applyDetectedProdi(prodi) {
                if (!prodi) return;
                const cur = sessionStorage.getItem('c-dfs_user_prodi') || '';
                if (cur === prodi) return;
                sessionStorage.setItem('c-dfs_user_jalur', jalurOf(prodi));
                sessionStorage.setItem('c-dfs_user_prodi', prodi);
                renderJobseekerDashboard();
                cdfsUpdateProdi(jalurOf(prodi), prodi);
                showToast(`Program Studi diatur otomatis: ${prodi}`);
            }

            async function handleTranskrip(file) {
                if (!file) return;
                const info = document.getElementById('jmTranskripInfo');
                info.classList.remove('is-hidden');
                info.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Membaca dokumen...';
                let hasil = null, sumber = '';
                try {
                    if (/pdf$/i.test(file.type) || /\.pdf$/i.test(file.name)) {
                        hasil = parseTranskrip(await pdfLines(file));
                        sumber = 'Deteksi otomatis';
                    }
                } catch (e) { console.warn(e); }
                if ((!hasil || !hasil.rows.length) && JM.aiEnabled) {
                    info.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Format tidak dikenali, dokumen dibaca oleh AI...';
                    const d = await aiExtract('transkrip', file);
                    if (d && Array.isArray(d.mata_kuliah)) {
                        hasil = {
                            rows: d.mata_kuliah.map(m => ({nama: String(m.nama || '').trim(), sks: parseInt(m.sks, 10) || 0, nilai: String(m.nilai || '').toUpperCase().trim()}))
                                .filter(m => m.nama && m.sks >= 1 && m.sks <= 8 && m.nilai in GRADE).map(m => NAMA_UMUM.test(m.nama) ? {...m, umum: true} : m),
                            prodiText: d.prodi || '', prodi: matchProdi(d.prodi || ''), ipkDoc: d.ipk ? Number(d.ipk) : null
                        };
                        sumber = 'Dibaca AI';
                    }
                }
                if (!hasil || !hasil.rows.length) {
                    info.innerHTML = `<div class="jm-detect-warn"><i class="fa-solid fa-triangle-exclamation"></i> Mata kuliah tidak terdeteksi dari <strong>${escHtml(file.name)}</strong>.
                        ${JM.aiEnabled ? 'Pastikan file adalah transkrip yang jelas.' : 'Pastikan PDF berupa teks (bukan hasil scan), atau isi API key AI di php/config.php agar dokumen scan bisa dibaca.'}
                        Anda juga bisa menambah mata kuliah secara manual di bagian bawah.</div>`;
                    document.getElementById('jmManual').open = true;
                    return;
                }
                JM.mk = hasil.rows;
                JM.mkMeta = {file: file.name, sumber, prodi_dokumen: hasil.prodiText, ipk_dokumen: hasil.ipkDoc};
                applyDetectedProdi(hasil.prodi);
                await jmSave();
                jmRenderMk();
                showToast(`${hasil.rows.length} mata kuliah terdeteksi`);
            }

            // ---------- Deteksi sertifikat ----------
            const RE_BNSP = /\bBNSP\b|Badan\s+Nasional\s+Sertifikasi\s+Profesi|Lembaga\s+Sertifikasi\s+Profesi|\bLSP\b|National\s+Professional\s+Certification\s+Agency/i;
            const cleanName = (n) => n.replace(/\.[a-z0-9]+$/i, '').replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim();
            function parseSertifikat(lines, fileName) {
                const text = lines.join('\n');
                const jenis = RE_BNSP.test(text) ? 'BNSP' : 'Non-BNSP';
                let nama = '', lembaga = '';
                // Urutan prioritas: Skema > Kualifikasi/Okupasi/Klaster > "Bidang/Unit Kompetensi :"
                const POLA = [
                    /(?:Skema(?:\s+Sertifikasi)?|Certification\s+Scheme|Scheme)\s*[:\-]\s*(.*)$/i,
                    /(?:Kualifikasi|Qualification|Okupasi|Occupation|Klaster|Cluster)\s*[:\-]\s*(.*)$/i,
                    /(?:Bidang|Unit)\s+Kompetensi\s*[:\-]\s*(.*)$/i
                ];
                for (const re of POLA) {
                    for (let i = 0; i < lines.length && !nama; i++) {
                        const m = lines[i].match(re);
                        if (m) { const v = (m[1] || '').trim(); nama = v.length >= 3 ? v : (lines[i + 1] || '').trim(); }
                    }
                    if (nama) break;
                }
                for (const l of lines) {
                    const lm = l.match(/(LSP\s+[A-Za-z0-9 .\-]{3,70}|Lembaga\s+Sertifikasi\s+Profesi\s+[A-Za-z0-9 .\-]{3,70})/i);
                    if (lm) { lembaga = lm[1].trim(); break; }
                }
                if (!nama) {
                    // Sertifikat umum: ambil baris setelah "Sertifikat / Certificate of ..." atau "telah menyelesaikan"
                    for (let i = 0; i < lines.length; i++) {
                        if (/(certificate\s+of|sertifikat|piagam|telah\s+(menyelesaikan|mengikuti|lulus)|has\s+(successfully\s+)?completed)/i.test(lines[i])) {
                            const after = lines[i].replace(/.*?(certificate\s+of\s+\w+|sertifikat|piagam|telah\s+(menyelesaikan|mengikuti|lulus)|has\s+(successfully\s+)?completed)\s*:?/i, '').trim();
                            nama = after.length >= 4 ? after : '';
                            if (nama) break;
                        }
                    }
                }
                return {nama: (nama || cleanName(fileName)).slice(0, 150), jenis, lembaga: lembaga.slice(0, 150)};
            }
            async function handleSertifikat(files) {
                for (const file of files) {
                    const item = {nama: cleanName(file.name), jenis: /bnsp|lsp/i.test(file.name) ? 'BNSP' : 'Non-BNSP', lembaga: '', file: file.name, sumber: 'Perlu dicek'};
                    JM.cert.push(item);
                    jmRenderCert(JM.cert.length - 1);
                    try {
                        let ok = false;
                        if (/pdf$/i.test(file.type) || /\.pdf$/i.test(file.name)) {
                            const lines = await pdfLines(file);
                            if (lines.join('').replace(/\s/g, '').length > 30) {
                                Object.assign(item, parseSertifikat(lines, file.name), {sumber: 'Deteksi otomatis'});
                                ok = true;
                            }
                        }
                        if (!ok && JM.aiEnabled) {
                            const d = await aiExtract('sertifikat', file);
                            if (d && d.nama) {
                                Object.assign(item, {nama: String(d.nama).slice(0, 150), jenis: d.jenis === 'BNSP' ? 'BNSP' : 'Non-BNSP', lembaga: String(d.lembaga || '').slice(0, 150), sumber: 'Dibaca AI'});
                                ok = true;
                            }
                        }
                    } catch (e) { console.warn(e); }
                    jmRenderCert();
                }
                await jmSave();
                showToast(`${files.length} sertifikat diproses`);
            }

            // ---------- Drag & drop ----------
            function setupDrop(zoneId, inputId, handler, multiple) {
                const zone = document.getElementById(zoneId), input = document.getElementById(inputId);
                input.addEventListener('change', () => { if (input.files.length) handler(multiple ? [...input.files] : input.files[0]); input.value = ''; });
                ['dragenter', 'dragover'].forEach(ev => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add('drag'); }));
                ['dragleave', 'drop'].forEach(ev => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.remove('drag'); }));
                zone.addEventListener('drop', (e) => { const f = [...e.dataTransfer.files]; if (f.length) handler(multiple ? f : f[0]); });
            }
            setupDrop('jmDropTranskrip', 'jmFileTranskrip', handleTranskrip, false);
            setupDrop('jmDropCert', 'jmFileCert', handleSertifikat, true);

            // ---------- Render ----------
            function jmRefreshStats() {
                const prodi = sessionStorage.getItem('c-dfs_user_prodi') || '';
                const jalur = sessionStorage.getItem('c-dfs_user_jalur') || '';
                document.getElementById('jmStatProdi').textContent = prodi ? kodeProdi(prodi) : '-';
                document.getElementById('jmStatJalur').textContent = prodi ? `${jalur} · ${prodi}` : 'Terdeteksi dari transkrip';
                const {ipk, sks} = jmIpk();
                document.getElementById('jmStatIpk').textContent = ipk.toFixed(2).replace('.', ',');
                document.getElementById('jmStatSks').textContent = `${sks} SKS · ${JM.mk.length} mata kuliah`;
                const nB = JM.cert.filter(c => c.jenis === 'BNSP').length;
                document.getElementById('jmStatCert').textContent = JM.cert.length + JM.bahasa.length;
                document.getElementById('jmStatCertDetail').textContent = `${nB} BNSP · ${JM.cert.length - nB} Non-BNSP · ${JM.bahasa.length} bahasa`;
                document.getElementById('jmStatLowongan').textContent = `dari ${JM.lowongan.length} lowongan${JM.demo ? ' (contoh)' : ''}`;
                if (JM.loaded) jsRenderDash();
            }
            function bestCourses(n) {
                const bidang = JM.mk.filter(m => !m.umum);
                return [...(bidang.length ? bidang : JM.mk)].sort((a, b) => (bobot(b) - bobot(a)) || (b.sks - a.sks)).slice(0, n);
            }
            // Status verifikasi transkrip: terbaca otomatis dari PDF/AI vs diisi manual
            const SUMBER_VERIF = ['Deteksi otomatis', 'Dibaca AI', 'Data contoh'];
            function jmVerifBadge() {
                const man = JM.mk.filter(m => m.manual).length;
                const auto = SUMBER_VERIF.includes((JM.mkMeta || {}).sumber);
                if (auto && !man) return '<span class="ok"><i class="fa-solid fa-shield-halved"></i> Terverifikasi otomatis dari dokumen</span>';
                if (auto) return `<span class="warn"><i class="fa-solid fa-pen"></i> ${man} MK diisi manual: ditandai untuk perusahaan dan tidak dihitung dalam analisis prodi</span>`;
                return '<span class="warn"><i class="fa-solid fa-pen"></i> Diisi manual: belum terverifikasi, tidak dihitung dalam analisis prodi</span>';
            }
            function jmRenderMk() {
                const body = document.getElementById('jmMkBody');
                document.getElementById('jmMkCount').textContent = JM.mk.length;
                body.innerHTML = JM.mk.length ? JM.mk.map((m, i) => {
                    const g = bobot(m);
                    const cls = g >= 3.5 ? 'g-hi' : (g >= 2.5 ? 'g-mid' : 'g-lo');
                    return `<tr><td>${escHtml(m.nama)}${m.umum ? ' <span class="jm-umum">umum</span>' : ''}${m.manual ? ' <span class="jm-man-tag" title="Diisi manual, belum terverifikasi">manual</span>' : ''}</td><td class="text-center">${escHtml(m.sks)}</td>
                        <td class="text-center"><span class="jm-grade ${cls}">${escHtml(m.nilai)}</span></td>
                        <td class="text-center"><button class="jm-icon-btn" data-del-mk="${i}" aria-label="Hapus ${escHtml(m.nama)}"><i class="fa-regular fa-trash-can"></i></button></td></tr>`;
                }).join('') : '<tr><td colspan="4" class="text-center jp-muted" style="padding:20px;">Belum ada data. Upload transkrip PDF di atas.</td></tr>';

                const info = document.getElementById('jmTranskripInfo');
                const dropSt = document.getElementById('jmDropTranskripStatus');
                document.getElementById('jmDropTranskrip').classList.toggle('done', JM.mk.length > 0);
                dropSt.innerHTML = JM.mk.length ? `<i class="fa-solid fa-circle-check"></i> ${JM.mk.length} mata kuliah · ${escHtml(JM.mkMeta.sumber || 'Input manual')} — klik untuk ganti` : 'Klik atau seret file ke sini';
                if (JM.mk.length) {
                    const {ipk, sks} = jmIpk();
                    const meta = JM.mkMeta || {};
                    const ipkDoc = meta.ipk_dokumen;
                    const cocokIpk = ipkDoc ? Math.abs(ipkDoc - ipk) < 0.02 : null;
                    info.classList.remove('is-hidden');
                    info.innerHTML = `
                        <div class="jm-detect-ok">
                            <i class="fa-solid fa-circle-check"></i>
                            <div>
                                <strong>${JM.mk.length} mata kuliah · ${sks} SKS terdeteksi</strong>${meta.file ? ` dari <em>${escHtml(meta.file)}</em>` : ''}
                                <div class="jm-detect-meta">
                                    ${meta.prodi_dokumen ? `<span><i class="fa-solid fa-graduation-cap"></i> ${escHtml(meta.prodi_dokumen)}</span>` : ''}
                                    <span><i class="fa-solid fa-calculator"></i> IPK dihitung ${ipk.toFixed(2).replace('.', ',')}</span>
                                    ${jmVerifBadge()}
                                    ${ipkDoc ? `<span class="${cocokIpk ? 'ok' : 'warn'}"><i class="fa-solid ${cocokIpk ? 'fa-check' : 'fa-triangle-exclamation'}"></i> IPK di dokumen ${String(ipkDoc).replace('.', ',')}${cocokIpk ? ' (sesuai)' : ' (berbeda, cek data)'}</span>` : ''}
                                </div>
                            </div>
                        </div>`;
                    document.getElementById('jmBestBox').classList.remove('is-hidden');
                    document.getElementById('jmBestList').innerHTML = bestCourses(6).map(m => `
                        <div class="jm-best-item"><span class="jm-grade g-hi">${escHtml(m.nilai)}</span><span class="nm">${escHtml(m.nama)}</span><span class="sks">${escHtml(m.sks)} SKS</span></div>`).join('');
                } else {
                    info.classList.add('is-hidden');
                    document.getElementById('jmBestBox').classList.add('is-hidden');
                }
                jmRefreshStats();
            }
            function jmRenderCert() {
                const box = document.getElementById('jmCertListView');
                document.getElementById('jmCertWrap').classList.toggle('is-hidden', !JM.cert.length);
                document.getElementById('jmDropCert').classList.toggle('done', JM.cert.length > 0);
                document.getElementById('jmDropCertStatus').innerHTML = JM.cert.length
                    ? `<i class="fa-solid fa-circle-check"></i> ${JM.cert.length} sertifikat — klik untuk menambah` : 'Klik atau seret file ke sini';
                box.innerHTML = JM.cert.length ? JM.cert.map((c, i) => `
                    <div class="jm-cert">
                        <div class="jm-cert-main">
                            <select class="jm-cert-jenis ${c.jenis === 'BNSP' ? 'bnsp' : 'non'}" data-i="${i}" aria-label="Jenis sertifikat">
                                <option ${c.jenis === 'BNSP' ? 'selected' : ''}>BNSP</option><option ${c.jenis !== 'BNSP' ? 'selected' : ''}>Non-BNSP</option>
                            </select>
                            <input class="jm-cert-nama" data-i="${i}" value="${escHtml(c.nama)}" aria-label="Nama sertifikat" list="jmCertList" />
                            <button class="jm-icon-btn" data-del-cert="${i}" aria-label="Hapus ${escHtml(c.nama)}"><i class="fa-regular fa-trash-can"></i></button>
                        </div>
                        <div class="jm-cert-meta">
                            <span class="src ${c.sumber === 'Perlu dicek' ? 'warn' : ''}">${escHtml(c.sumber || 'Manual')}</span>
                            ${c.lembaga ? `<span>${escHtml(c.lembaga)}</span>` : ''}
                            ${c.file ? `<span class="file"><i class="fa-regular fa-file"></i> ${escHtml(c.file)}</span>` : ''}
                        </div>
                    </div>`).join('') : '<p class="jp-muted" style="text-align:center;padding:10px;">Belum ada sertifikat.</p>';
                jmRefreshStats();
            }
            document.getElementById('jmCertListView').addEventListener('change', async (e) => {
                const i = e.target.dataset.i;
                if (i === undefined) return;
                if (e.target.classList.contains('jm-cert-jenis')) JM.cert[i].jenis = e.target.value;
                if (e.target.classList.contains('jm-cert-nama')) JM.cert[i].nama = e.target.value.trim().slice(0, 150);
                JM.cert[i].sumber = 'Dikoreksi manual';
                jmRenderCert();
                await jmSave();
            });
            document.getElementById('jmCertListView').addEventListener('click', async (e) => {
                const b = e.target.closest('[data-del-cert]');
                if (b) { JM.cert.splice(+b.dataset.delCert, 1); jmRenderCert(); await jmSave(); }
            });
            document.getElementById('formJmMk').addEventListener('submit', async (e) => {
                e.preventDefault();
                const nama = document.getElementById('jmMkNama').value.trim();
                if (!nama) return;
                JM.mk.push({nama, sks: Math.max(1, parseInt(document.getElementById('jmMkSks').value, 10) || 1), nilai: document.getElementById('jmMkNilai').value, manual: true});
                if (!JM.mkMeta.sumber) JM.mkMeta.sumber = 'Input manual';
                document.getElementById('jmMkNama').value = '';
                jmRenderMk();
                await jmSave();
            });
            document.getElementById('jmMkBody').addEventListener('click', async (e) => {
                const b = e.target.closest('[data-del-mk]');
                if (b) { JM.mk.splice(+b.dataset.delMk, 1); jmRenderMk(); await jmSave(); }
            });

            // ---------- Kemahiran bahasa ----------
            const langOther = document.getElementById('jmLangOther');
            document.querySelectorAll('#jmLangPick .seg-btn').forEach(b => b.addEventListener('click', () => {
                JM.langPick = b.dataset.lang;
                document.querySelectorAll('#jmLangPick .seg-btn').forEach(x => x.classList.toggle('active', x === b));
                langOther.classList.toggle('is-hidden', JM.langPick !== '__lain');
                if (JM.langPick === '__lain') langOther.focus();
            }));
            document.querySelectorAll('#jmLangLevel .seg-btn').forEach(b => b.addEventListener('click', () => {
                JM.langLevel = b.dataset.level;
                document.querySelectorAll('#jmLangLevel .seg-btn').forEach(x => x.classList.toggle('active', x === b));
            }));
            async function jmAddLang() {
                let nama = JM.langPick === '__lain' ? langOther.value.trim() : JM.langPick;
                nama = nama.replace(/^bahasa\s+/i, '').replace(/\s+/g, ' ').slice(0, 40);
                if (!nama) { langOther.focus(); return showToast('Tulis nama bahasanya terlebih dahulu'); }
                nama = nama.charAt(0).toUpperCase() + nama.slice(1);
                const ada = JM.bahasa.find(b => b.nama.toLowerCase() === nama.toLowerCase());
                if (ada) ada.level = JM.langLevel; else JM.bahasa.push({nama, level: JM.langLevel});
                langOther.value = '';
                jmRenderLang();
                await jmSave();
                showToast(ada ? `Tingkat bahasa ${nama} diperbarui` : `Bahasa ${nama} ditambahkan`);
            }
            document.getElementById('jmLangAdd').addEventListener('click', jmAddLang);
            langOther.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); jmAddLang(); } });
            function jmRenderLang() {
                const box = document.getElementById('jmLangList');
                box.innerHTML = JM.bahasa.map((b, i) => `
                    <div class="jm-lang-item">
                        <i class="fa-solid fa-language"></i>
                        <strong>${escHtml(b.nama)}</strong>
                        <select class="jm-lang-sel lv-${escHtml(b.level.toLowerCase())}" data-i="${i}" aria-label="Tingkat ${escHtml(b.nama)}">
                            ${LEVELS.map(l => `<option ${l === b.level ? 'selected' : ''}>${l}</option>`).join('')}
                        </select>
                        <button class="jm-icon-btn" data-del-lang="${i}" aria-label="Hapus ${escHtml(b.nama)}"><i class="fa-regular fa-trash-can"></i></button>
                    </div>`).join('');
                jmRefreshStats();
            }
            document.getElementById('jmLangList').addEventListener('change', async (e) => {
                const i = e.target.dataset.i;
                if (i === undefined) return;
                JM.bahasa[i].level = e.target.value;
                jmRenderLang();
                await jmSave();
            });
            document.getElementById('jmLangList').addEventListener('click', async (e) => {
                const b = e.target.closest('[data-del-lang]');
                if (b) { JM.bahasa.splice(+b.dataset.delLang, 1); jmRenderLang(); await jmSave(); }
            });

            // ---------- Hasil analisis ----------
            function jmLocalNarrative() {
                const prodi = sessionStorage.getItem('c-dfs_user_prodi') || '-';
                const {ipk} = jmIpk();
                const top = JM.results[0];
                const tinggi = JM.results.filter(r => r.kategori === 'Tinggi');
                const best = bestCourses(3).map(m => `${m.nama} (${m.nilai})`).join(', ');
                const roles = JM.roles.filter(r => !r.lintas).slice(0, 2).map(r => `**${r.nama}** (${r.skor}%)`).join(' dan ');
                const relevan = JM.results.filter(r => r.prodiOk);
                const kurang = [...new Set((relevan.length ? relevan : JM.results.slice(0, 1)).flatMap(r => r.kurang))].slice(0, 3);
                let t = `Transkrip menunjukkan IPK ${ipk.toFixed(2).replace('.', ',')} dengan nilai terbaik pada ${best || '-'}. `;
                t += `Sertifikat: ${JM.cert.length ? JM.cert.map(c => `${c.nama} (${c.jenis})`).join(', ') : 'belum ada'}. `;
                t += `Kemahiran bahasa: ${JM.bahasa.length ? JM.bahasa.map(b => `${b.nama} (${b.level})`).join(', ') : 'belum diisi'}.`;
                t += '\n\n';
                if (roles) t += `Berdasarkan data Anda, Anda paling cocok bekerja sebagai ${roles}. `;
                const nmTop = top ? (top.low.posisi ? `${top.low.posisi} di ${top.low.perusahaan}` : top.low.perusahaan) : '';
                if (top) t += tinggi.length ? `Ada **${tinggi.length} lowongan dengan skor kesiapan tinggi**; yang paling relevan adalah **${nmTop}** (${top.status.toLowerCase()}, kecocokan ${top.kecocokan}%, skor kesiapan ${top.peluang}%).`
                    : `Lowongan paling relevan saat ini adalah **${nmTop}** (${top.status.toLowerCase()}, kecocokan ${top.kecocokan}%, skor kesiapan ${top.peluang}%).`;
                else t += 'Belum ada lowongan dari Jobprovider untuk dicocokkan.';
                t += '\n\n';
                const langkah = [];
                kurang.forEach(k => langkah.push(`Perkuat kompetensi ${k} melalui mata kuliah pilihan, proyek, atau pelatihan.`));
                if (!JM.cert.some(c => c.jenis === 'BNSP')) langkah.push('Ambil sertifikasi BNSP pada skema yang sesuai bidang Anda untuk menaikkan skor kesiapan.');
                if (!JM.bahasa.some(b => b.level === 'Advanced')) langkah.push(JM.bahasa.length ? 'Tingkatkan kemahiran bahasa asing ke level Advanced (mis. dengan tes TOEFL/IELTS, JLPT, atau Goethe) untuk menaikkan peluang.' : 'Isi kemahiran bahasa asing Anda; kemampuan bahasa ikut menaikkan skor peluang.');
                if (langkah.length) t += 'Langkah berikutnya:\n' + langkah.slice(0, 3).map(l => `- ${l}`).join('\n');
                return t;
            }
            function jmMd(text) {
                const blocks = escHtml(text).split(/\n{2,}/);
                return blocks.map(b => {
                    const lines = b.split('\n');
                    const isLi = (l) => /^\s*[-*•]\s+/.test(l);
                    const li = (l) => `<li>${l.replace(/^\s*[-*•]\s+/, '')}</li>`;
                    if (lines.every(isLi)) return '<ul>' + lines.map(li).join('') + '</ul>';
                    if (lines.length > 1 && lines.slice(1).every(isLi)) return `<p>${lines[0]}</p><ul>` + lines.slice(1).map(li).join('') + '</ul>';
                    return '<p>' + lines.join('<br>') + '</p>';
                }).join('').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
            }
            function jmRenderRoles() {
                const grid = document.getElementById('jmRoleGrid');
                grid.innerHTML = JM.roles.length ? JM.roles.map((r, i) => `
                    <div class="jm-role ${i === 0 ? 'best' : ''}">
                        <div class="jm-role-head">
                            <div><strong>${escHtml(r.nama)}</strong><span>${r.lintas ? 'Alternatif lintas prodi · ' : ''}${escHtml(kodeProdi(r.prodi))}</span></div>
                            <div class="jm-role-score">${r.skor}%</div>
                        </div>
                        <div class="jm-bar"><div style="width:${r.skor}%"></div></div>
                        <div class="jm-role-ev">${r.dukung.slice(0, 4).map(d => `<span>${escHtml(d)}</span>`).join('')}</div>
                        ${r.kurang.length ? `<div class="jm-role-gap">Belum terlihat: ${r.kurang.map(escHtml).join(', ')}</div>` : ''}
                    </div>`).join('')
                    : '<div class="jp-empty-block" style="grid-column:1/-1;"><i class="fa-solid fa-briefcase"></i>Belum ada mata kuliah atau sertifikat yang terkait dengan profil pekerjaan.</div>';
            }
            function jmRenderResults() {
                const grid = document.getElementById('jmJobGrid');
                const rows = [...JM.results].sort((a, b) => b[JM.sort] - a[JM.sort]);
                document.getElementById('jmStatTinggi').textContent = JM.results.filter(r => r.kategori === 'Tinggi').length;
                if (!rows.length) {
                    grid.innerHTML = '<div class="jp-empty-block" style="grid-column:1/-1;"><i class="fa-solid fa-briefcase"></i>Belum ada lowongan dari Jobprovider. Lowongan muncul setelah Jobprovider mengisi menu Kelola Lowongan atau Kebutuhan Kompetensi Umum.</div>';
                    return;
                }
                grid.innerHTML = rows.map((r, i) => {
                    const L = r.low, isLow = L.tipe === 'lowongan';
                    const stCls = r.status === 'Cocok' ? (r.bahasaOk ? 'ok' : 'mid') : (r.status === 'Cukup cocok' ? 'mid' : 'no');   // kuning bila syarat bahasa belum terpenuhi
                    return `
                    <div class="jm-job ${i === 0 ? 'best' : ''}">
                        <div class="jm-job-top">
                            <div>
                                <span class="jm-job-type ${isLow ? 'low' : ''}">${isLow ? 'Lowongan' : 'Kebutuhan kompetensi'}</span>
                                <div class="jm-job-co">${escHtml(isLow ? L.posisi : L.perusahaan)}${JM.demo ? '<span class="jp-demo-badge">DATA CONTOH</span>' : ''}</div>
                                <div class="jm-job-sub">${isLow ? `<i class="fa-solid fa-building"></i> ${escHtml(L.perusahaan)} · ` : ''}${escHtml(kodeProdi(L.prodi))}${L.lokasi ? ` · ${escHtml(L.lokasi)}` : ''}${r.prodiOk ? ' · <span style="color:#16a34a;font-weight:600;">sesuai prodi Anda</span>' : ''}</div>
                            </div>
                            <span class="jm-chance ${r.kategori.toLowerCase()}">Kesiapan ${r.kategori}</span>
                        </div>
                        <div class="jm-verdict ${stCls}"><i class="fa-solid ${stCls === 'ok' ? 'fa-circle-check' : (stCls === 'mid' ? 'fa-circle-half-stroke' : 'fa-circle-xmark')}"></i> ${r.status} dengan ${isLow ? 'lowongan ini' : 'kebutuhan perusahaan ini'}${(L.bahasa || []).length ? ` · syarat bahasa ${r.bahasaOk ? 'terpenuhi' : 'belum terpenuhi'}` : ''}</div>
                        <div class="jm-scores">
                            <div class="jm-score-box"><span>Kecocokan</span><strong>${r.kecocokan}%</strong><div class="jm-bar"><div style="width:${r.kecocokan}%"></div></div></div>
                            <div class="jm-score-box"><span>Skor Kesiapan</span><strong>${r.peluang}%</strong><div class="jm-bar peluang"><div style="width:${r.peluang}%"></div></div></div>
                        </div>
                        <div class="jm-komp-list">
                            ${r.detail.map(d => `<div class="jm-komp ${d.v >= 0.5 ? '' : 'miss'}">
                                <i class="fa-solid ${d.v >= 0.5 ? 'fa-circle-check ok' : 'fa-circle-xmark no'}"></i>
                                <span>${d.tipe === 'bahasa' ? '<i class="fa-solid fa-language jm-lang-ic"></i> ' : ''}${escHtml(d.nama)}</span><span class="src">${escHtml(d.src)}</span></div>`).join('')}
                        </div>
                        ${isLow ? `<div class="jm-job-actions">${lamarBtnHtml(L)}</div>` : ''}
                        ${r.kurang.length ? `<div class="jm-tip"><i class="fa-solid fa-lightbulb"></i> Perkuat <strong>${r.kurang.slice(0, 2).map(escHtml).join('</strong> dan <strong>')}</strong> melalui mata kuliah pilihan, pelatihan, kursus bahasa, atau sertifikasi BNSP pada skema terkait.</div>` : '<div class="jm-tip"><i class="fa-solid fa-star"></i> Semua kebutuhan sudah didukung bukti dari transkrip, sertifikat, atau kemahiran bahasa Anda.</div>'}
                    </div>`;
                }).join('');
            }
            document.querySelectorAll('#jmSort .seg-btn').forEach(b => b.addEventListener('click', () => {
                JM.sort = b.dataset.sort;
                document.querySelectorAll('#jmSort .seg-btn').forEach(x => x.classList.toggle('active', x === b));
                jmRenderResults();
            }));

            document.getElementById('jmRunBtn').addEventListener('click', async () => {
                if (!JM.mk.length) return alert('Upload transkrip nilai (PDF) terlebih dahulu.');
                if (!sessionStorage.getItem('c-dfs_user_prodi')) return alert('Program studi belum terdeteksi. Pilih program studi di halaman Dashboard.');
                const btn = document.getElementById('jmRunBtn');
                btn.disabled = true;
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menganalisis...';
                try {
                    if (!(await jmSave())) return;
                    if (!JM.demo) { const fresh = await apiRequest('js_profile'); if (fresh && fresh.success) JM.lowongan = fresh.lowongan || []; }
                    JM.results = JM.lowongan.map(jmAnalyze).sort((a, b) => b.peluang - a.peluang);
                    JM.roles = jmRoles();
                    jmRefreshStats();
                    document.getElementById('jmResults').classList.remove('is-hidden');
                    jmRenderRoles();
                    jmRenderResults();

                    const aiText = document.getElementById('jmAiText');
                    const src = document.getElementById('jmAiSource');
                    aiText.innerHTML = '<p class="jp-muted"><i class="fa-solid fa-spinner fa-spin"></i> AI sedang menyusun analisis...</p>';
                    let ai = null;
                    if (!JM.demo && JM.aiEnabled) {
                        const {ipk, sks} = jmIpk();
                        ai = await apiRequest('js_ai_analisis', {
                            prodi: sessionStorage.getItem('c-dfs_user_prodi'), ipk: +ipk.toFixed(2), sks,
                            nilai_terbaik: bestCourses(8),
                            sertifikat: JM.cert.map(c => ({nama: c.nama, jenis: c.jenis, lembaga: c.lembaga})),
                            bahasa: JM.bahasa,
                            pekerjaan_cocok: JM.roles.map(r => ({pekerjaan: r.nama, skor: r.skor, bukti: r.dukung.slice(0, 4), belum_terlihat: r.kurang})),
                            lowongan: JM.results.slice(0, 5).map(r => ({jenis: r.low.tipe === 'lowongan' ? 'lowongan' : 'kebutuhan kompetensi',
                                posisi: r.low.posisi || null, perusahaan: r.low.perusahaan, prodi_lowongan: r.low.prodi, lokasi: r.low.lokasi || null,
                                syarat_bahasa: r.low.bahasa || [], status_kecocokan: r.status,
                                kecocokan: r.kecocokan, skor_kesiapan: r.peluang, kategori_kesiapan: r.kategori, terpenuhi: r.terpenuhi, kurang: r.kurang}))
                        });
                    }
                    if (ai && ai.success && ai.ai && ai.text) {
                        aiText.innerHTML = jmMd(ai.text);
                        src.textContent = 'Dibuat oleh AI (Claude)';
                    } else {
                        aiText.innerHTML = jmMd(jmLocalNarrative());
                        src.textContent = JM.aiEnabled ? 'Ringkasan otomatis (AI tidak terhubung)' : 'Ringkasan otomatis';
                    }
                    document.getElementById('jmResults').scrollIntoView({behavior: 'smooth', block: 'start'});
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Analisis dengan AI';
                }
            });


            // ---------- Lamaran & Dashboard Jobseeker ----------
            const LAM_INFO = {
                Dikirim: ['lam-dikirim', 'fa-paper-plane', 'Terkirim, menunggu ditinjau perusahaan'],
                Ditinjau: ['lam-ditinjau', 'fa-magnifying-glass', 'Sedang ditinjau perusahaan'],
                Diundang: ['lam-diundang', 'fa-calendar-check', 'Diundang ke tahap seleksi / wawancara'],
                Diterima: ['lam-diterima', 'fa-circle-check', 'Selamat, Anda diterima'],
                Ditolak: ['lam-ditolak', 'fa-circle-xmark', 'Belum berhasil untuk lowongan ini']
            };
            const lamInfo = (st) => LAM_INFO[st] || LAM_INFO.Dikirim;
            const lamBadge = (st) => `<span class="lam-badge ${lamInfo(st)[0]}"><i class="fa-solid ${lamInfo(st)[1]}"></i> ${escHtml(st)}</span>`;
            const jmLamFor = (id) => JM.lamaran.find(a => String(a.lowongan_id) === String(id));
            const fmtTgl = (v) => { const d = new Date(String(v || '').replace(' ', 'T')); return isNaN(d) ? '' : d.toLocaleDateString('id-ID', {day: 'numeric', month: 'short', year: 'numeric'}); };
            function lamarBtnHtml(L) {
                if (L.tipe !== 'lowongan') return '';
                const a = jmLamFor(L.id);
                return a ? `<span class="jp-muted">Lamaran Anda:</span> ${lamBadge(a.status)}`
                    : `<button type="button" class="jp-btn-sm primary" data-lamar="${escHtml(L.id)}"><i class="fa-solid fa-paper-plane"></i> Lamar</button>`;
            }
            async function jmLamar(id) {
                const L = JM.lowongan.find(l => String(l.id) === String(id));
                if (!L || jmLamFor(id)) return;
                if (!JM.mk.length) { showToast('Upload transkrip nilai di Job Matching sebelum melamar'); jpGoto('view-jobmatch'); return; }
                if (!confirm(`Kirim lamaran untuk "${L.posisi}" di ${L.perusahaan}?\nPerusahaan ini akan dapat melihat profil, transkrip, sertifikat, dan kemahiran bahasa Anda.`)) return;
                let item = {lowongan_id: L.id, status: 'Dikirim', updated_at: new Date().toISOString(), posisi: L.posisi, perusahaan: L.perusahaan};
                if (!JM.demo) {
                    const res = await apiRequest('js_lamar', {lowongan_id: L.id});
                    if (!res || !res.success) return alert((res && res.message) || 'Gagal mengirim lamaran.');
                    item = res.lamaran;
                }
                JM.lamaran.unshift(item);
                if (JM.demo) await jmSave();
                showToast(`Lamaran terkirim ke ${L.perusahaan}`);
                if (JM.results.length) jmRenderResults();
                jsRenderDash();
            }
            document.addEventListener('click', (e) => {
                const b = e.target.closest('[data-lamar]');
                if (b) { e.preventDefault(); jmLamar(b.dataset.lamar); }
            });
            document.getElementById('jmTampil').addEventListener('change', async (e) => {
                JM.tampil = e.target.checked;
                if (await jmSave()) showToast(JM.tampil ? 'Profil Anda kini dapat dilihat perusahaan' : 'Profil hanya terlihat oleh perusahaan yang Anda lamar');
                jsRenderDash();
            });

            function jsRenderDash() {
                if ((sessionStorage.getItem('c-dfs_user_role') || '') !== 'Jobseeker') return;
                const set = (id, v) => { document.getElementById(id).textContent = v; };
                const prodi = sessionStorage.getItem('c-dfs_user_prodi') || '';
                const {ipk, sks} = jmIpk();
                set('jsDashIpk', JM.mk.length ? ipk.toFixed(2).replace('.', ',') : '-');
                set('jsDashIpkDesc', JM.mk.length ? `${sks} SKS · ${JM.mk.length} mata kuliah` : 'Upload transkrip di Job Matching');
                const nB = JM.cert.filter(c => c.jenis === 'BNSP').length;
                set('jsDashCert', JM.cert.length + JM.bahasa.length);
                set('jsDashCertDesc', `${JM.cert.length} sertifikat (${nB} BNSP) · ${JM.bahasa.length} bahasa`);
                const semua = JM.lowongan.filter(l => l.tipe === 'lowongan');
                const lows = semua.filter(l => l.prodi === prodi);
                set('jsDashLow', prodi ? lows.length : '-');
                set('jsDashLowDesc', prodi ? `dari ${semua.length} lowongan aktif${JM.demo ? ' (contoh)' : ''}` : 'pilih program studi dahulu');
                set('jsDashLam', JM.lamaran.length);
                const per = Object.keys(LAM_INFO).map(st => [st, JM.lamaran.filter(a => a.status === st).length]).filter(x => x[1]);
                set('jsDashLamDesc', per.length ? per.map(([st, n]) => `${n} ${st.toLowerCase()}`).join(' · ') : 'belum ada lamaran');

                const steps = [
                    {ok: !!prodi, t: 'Pilih program studi', d: 'Di kartu atas, atau otomatis dari transkrip'},
                    {ok: JM.mk.length > 0, t: 'Upload transkrip nilai', d: 'PDF transkrip dibaca otomatis', go: 'view-jobmatch'},
                    {ok: JM.cert.length + JM.bahasa.length > 0, t: 'Sertifikat & bahasa', d: 'Opsional, menaikkan skor kesiapan', go: 'view-jobmatch'},
                    {ok: JM.lamaran.length > 0, t: 'Cek kecocokan & lamar', d: 'Lihat skor lalu kirim lamaran', go: 'view-jobmatch'}
                ];
                const done = steps.filter(x => x.ok).length;
                document.getElementById('jsNextCard').innerHTML = `
                    <div class="card-header-flex"><h3 class="card-title"><i class="fa-solid fa-list-check text-blue"></i> Langkah Anda</h3><span class="badge ${done === steps.length ? 'badge-green' : 'badge-blue'}">${done}/${steps.length} selesai</span></div>
                    <div class="js-steps">${steps.map((x, i) => `
                        <div class="js-step ${x.ok ? 'done' : ''}">
                            <span class="n">${x.ok ? '<i class="fa-solid fa-check"></i>' : i + 1}</span>
                            <div class="tx"><strong>${x.t}</strong><small>${x.d}</small></div>
                            ${!x.ok && x.go ? `<button type="button" class="jp-btn-sm js-goto-btn" data-goto="${x.go}">Buka</button>` : ''}
                        </div>`).join('')}</div>
                    <div class="js-privacy ${JM.tampil ? 'on' : ''}"><i class="fa-solid ${JM.tampil ? 'fa-eye' : 'fa-eye-slash'}"></i>
                        ${JM.tampil ? 'Profil Anda <strong>dapat dilihat</strong> perusahaan di menu Kandidat.' : 'Profil Anda <strong>hanya terlihat</strong> oleh perusahaan yang Anda lamar.'}
                        <a href="#" class="js-goto" data-goto="view-jobmatch">Ubah di Job Matching</a></div>`;

                const lowBox = document.getElementById('jsLowList');
                if (!prodi) lowBox.innerHTML = '<div class="jp-empty-block"><i class="fa-solid fa-graduation-cap"></i>Pilih program studi di atas untuk melihat lowongan yang sesuai.</div>';
                else if (!lows.length) lowBox.innerHTML = `<div class="jp-empty-block"><i class="fa-regular fa-folder-open"></i>Belum ada lowongan aktif untuk ${escHtml(kodeProdi(prodi))}. Lowongan prodi lain tetap bisa dicek di Job Matching.</div>`;
                else lowBox.innerHTML = lows.slice(0, 6).map(L => {
                    const r = JM.mk.length ? jmAnalyze(L) : null;
                    return `
                    <div class="js-low">
                        <div class="js-low-main">
                            <strong>${escHtml(L.posisi)}</strong>${JM.demo ? '<span class="jp-demo-badge">CONTOH</span>' : ''}
                            <span class="jp-muted"><i class="fa-solid fa-building"></i> ${escHtml(L.perusahaan)}${L.lokasi ? ` · ${escHtml(L.lokasi)}` : ''}</span>
                            <div class="jp-job-tags">${(L.kompetensi || []).slice(0, 4).map(k => `<span class="t">${escHtml(k)}</span>`).join('')}${(L.bahasa || []).map(b => `<span class="t lang">${escHtml(b.nama)} · ${escHtml(b.level)}</span>`).join('')}</div>
                        </div>
                        <div class="js-low-side">
                            ${r ? `<span class="js-low-score"><strong>${r.kecocokan}%</strong> kecocokan</span>` : '<span class="jp-muted" style="font-size:12px;">Upload transkrip untuk melihat skor</span>'}
                            <div>${lamarBtnHtml(L)}</div>
                        </div>
                    </div>`;
                }).join('');

                const lam = [...JM.lamaran].sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
                document.getElementById('jsLamList').innerHTML = lam.length ? lam.map(a => {
                    const L = JM.lowongan.find(l => String(l.id) === String(a.lowongan_id)) || {};
                    return `
                    <div class="js-lam ${lamInfo(a.status)[0]}">
                        <div class="js-lam-head"><strong>${escHtml(a.posisi || L.posisi || 'Lowongan')}</strong>${lamBadge(a.status)}</div>
                        <span class="jp-muted">${escHtml(a.perusahaan || L.perusahaan || '')}${a.lowongan_ditutup ? ' · lowongan sudah ditutup' : ''}</span>
                        <small>${lamInfo(a.status)[2]}${fmtTgl(a.updated_at) ? ' · ' + fmtTgl(a.updated_at) : ''}</small>
                    </div>`;
                }).join('') : '<div class="jp-empty-block"><i class="fa-regular fa-paper-plane"></i>Belum ada lamaran. Cek kecocokan di Job Matching lalu klik <strong>Lamar</strong>.</div>';
                fsRender();
                jsRenderLearnCard();
                prEnsure();
            }

            async function initJobMatching() {
                await jmLoad();
                JM.results = [];
                document.getElementById('jmResults').classList.add('is-hidden');
                document.getElementById('jmStatTinggi').textContent = '-';
                document.getElementById('jmCertList').innerHTML = Object.values(PRODI_SKILLS).flat().map(n => `<option value="${escHtml(n)}"></option>`).join('');
                jmRenderMk();
                jmRenderCert();
                jmRenderLang();
                document.getElementById('jmTampil').checked = JM.tampil;
                jsRenderDash();
            }

            // ==============================================================
            // 15. KOMPETENSI PRODI (menu dropdown Jobseeker)
            //     Gap Kompetensi · Yang Perlu Dipelajari · Tren Skill
            //     Kebutuhan industri = lowongan & kompetensi Jobprovider untuk prodi Jobseeker.
            //     Kesiapan prodi = agregat anonim dari transkrip mahasiswa seprodi (dihitung di server).
            //     "Anda" = dihitung di browser dari transkrip, sertifikat, dan bahasa milik Jobseeker sendiri.
            // ==============================================================
            // Data contoh (fiktif) — hanya dipakai bila PHP/MySQL belum aktif. Sama dengan database/data_contoh.sql
            const PR_DEMO = {"sources":[{"tipe":"lowongan","posisi":"Teknisi IoT","perusahaan":"PT Elektra Nusantara (Contoh)","prodi":"Teknologi Rekayasa Sistem Elektronika","lokasi":"Malang","kompetensi":["Internet of Things (IoT)","Mikrokontroler","Sensor dan Transduser","Komputer dan Jaringan"],"bahasa":[{"nama":"Inggris","level":"Intermediate"}],"bulan_lalu":5},{"tipe":"lowongan","posisi":"Teknisi Otomasi PLC","perusahaan":"PT Elektra Nusantara (Contoh)","prodi":"Teknologi Rekayasa Sistem Elektronika","lokasi":"Pasuruan","kompetensi":["PLC & Otomasi Industri","Sistem Kendali","Instrumentasi"],"bahasa":[{"nama":"Inggris","level":"Basic"}],"bulan_lalu":2},{"tipe":"lowongan","posisi":"Embedded System Engineer","perusahaan":"PT Elektra Nusantara (Contoh)","prodi":"Teknologi Rekayasa Sistem Elektronika","lokasi":"Malang","kompetensi":["Embedded System","Pemrograman C","Mikrokontroler","Elektronika Digital"],"bahasa":[{"nama":"Inggris","level":"Intermediate"}],"bulan_lalu":1},{"tipe":"lowongan","posisi":"Teknisi Panel Surya","perusahaan":"PT Elektra Nusantara (Contoh)","prodi":"Teknologi Rekayasa Sistem Elektronika","lokasi":"Sidoarjo","kompetensi":["Energi Terbarukan (Panel Surya)","Rangkaian Listrik","PLC & Otomasi Industri"],"bahasa":[],"bulan_lalu":0},{"tipe":"lowongan","posisi":"Teknisi Maintenance","perusahaan":"PT Mitra Otomasi Jaya (Contoh)","prodi":"Teknologi Rekayasa Sistem Elektronika","lokasi":"Gresik","kompetensi":["Pemeliharaan Perangkat Elektronika","PLC & Otomasi Industri","Pengukuran Elektronika"],"bahasa":[{"nama":"Jepang","level":"Basic"}],"bulan_lalu":4},{"tipe":"lowongan","posisi":"Teknisi Instrumentasi","perusahaan":"PT Mitra Otomasi Jaya (Contoh)","prodi":"Teknologi Rekayasa Sistem Elektronika","lokasi":"Gresik","kompetensi":["Instrumentasi","Sistem Kendali","PLC & Otomasi Industri","Sensor dan Transduser"],"bahasa":[{"nama":"Jepang","level":"Basic"}],"bulan_lalu":1},{"tipe":"lowongan","posisi":"Digital Marketing Staff","perusahaan":"CV Niaga Digital Kreatif (Contoh)","prodi":"Manajemen Pemasaran","lokasi":"Surabaya","kompetensi":["Digital Marketing","Media Sosial","Komunikasi Pemasaran"],"bahasa":[{"nama":"Inggris","level":"Intermediate"}],"bulan_lalu":5},{"tipe":"lowongan","posisi":"Sales Executive","perusahaan":"CV Niaga Digital Kreatif (Contoh)","prodi":"Manajemen Pemasaran","lokasi":"Malang","kompetensi":["Penjualan","Negosiasi","Perilaku Konsumen"],"bahasa":[],"bulan_lalu":3},{"tipe":"lowongan","posisi":"Content & Social Media Specialist","perusahaan":"CV Niaga Digital Kreatif (Contoh)","prodi":"Manajemen Pemasaran","lokasi":"Surabaya","kompetensi":["Media Sosial","Content Marketing","Analisis Data Marketing"],"bahasa":[{"nama":"Inggris","level":"Intermediate"}],"bulan_lalu":2},{"tipe":"lowongan","posisi":"Marketing Data Analyst","perusahaan":"CV Niaga Digital Kreatif (Contoh)","prodi":"Manajemen Pemasaran","lokasi":"Remote","kompetensi":["Analisis Data Marketing","Riset Pemasaran","Digital Marketing"],"bahasa":[{"nama":"Inggris","level":"Intermediate"}],"bulan_lalu":0},{"tipe":"lowongan","posisi":"Data Analyst","perusahaan":"PT Analitika Data Indonesia (Contoh)","prodi":"Matematika","lokasi":"Jakarta","kompetensi":["Data Analytics","Statistika","Pemrograman Python","SQL / Basis Data"],"bahasa":[],"bulan_lalu":4},{"tipe":"lowongan","posisi":"Analis Risiko","perusahaan":"PT Analitika Data Indonesia (Contoh)","prodi":"Matematika","lokasi":"Jakarta","kompetensi":["Teori Peluang","Statistika","Pemodelan Matematika"],"bahasa":[],"bulan_lalu":3},{"tipe":"lowongan","posisi":"Junior Data Scientist","perusahaan":"PT Analitika Data Indonesia (Contoh)","prodi":"Matematika","lokasi":"Remote","kompetensi":["Machine Learning","Pemrograman Python","Statistika","Aljabar Linear"],"bahasa":[{"nama":"Inggris","level":"Intermediate"}],"bulan_lalu":1},{"tipe":"lowongan","posisi":"Market Research Analyst","perusahaan":"PT Analitika Data Indonesia (Contoh)","prodi":"Manajemen Pemasaran","lokasi":"Jakarta","kompetensi":["Riset Pemasaran","Statistika Bisnis","Analisis Data Marketing"],"bahasa":[],"bulan_lalu":2},{"tipe":"lowongan","posisi":"Guru TK","perusahaan":"Yayasan Pendidikan Ceria (Contoh)","prodi":"Pendidikan Anak Usia Dini (PAUD)","lokasi":"Malang","kompetensi":["Perencanaan Pembelajaran PAUD","Asesmen Perkembangan Anak","Manajemen Kelas"],"bahasa":[],"bulan_lalu":5},{"tipe":"lowongan","posisi":"Guru PAUD Bilingual","perusahaan":"Yayasan Pendidikan Ceria (Contoh)","prodi":"Pendidikan Anak Usia Dini (PAUD)","lokasi":"Batu","kompetensi":["Perencanaan Pembelajaran PAUD","Media Pembelajaran","Literasi Anak"],"bahasa":[{"nama":"Inggris","level":"Intermediate"}],"bulan_lalu":2},{"tipe":"lowongan","posisi":"Fasilitator Tumbuh Kembang","perusahaan":"Yayasan Pendidikan Ceria (Contoh)","prodi":"Pendidikan Anak Usia Dini (PAUD)","lokasi":"Malang","kompetensi":["Deteksi Dini Tumbuh Kembang","Psikologi Perkembangan Anak","Parenting / Kemitraan Orang Tua"],"bahasa":[],"bulan_lalu":0},{"tipe":"kebutuhan","posisi":null,"perusahaan":"PT Mitra Otomasi Jaya (Contoh)","prodi":"Manajemen Pemasaran","lokasi":"","kompetensi":["Penjualan Teknis (Technical Sales)","Komunikasi Bisnis"],"bahasa":[{"nama":"Inggris","level":"Intermediate"}],"bulan_lalu":3}],"students":[{"prodi":"Teknologi Rekayasa Sistem Elektronika","mk":[{"nama":"Elektronika Digital","sks":3,"nilai":"B"},{"nama":"Elektronika Analog","sks":3,"nilai":"B"},{"nama":"Rangkaian Listrik 1","sks":3,"nilai":"B+"},{"nama":"Sistem Mikrokontroler","sks":3,"nilai":"B-"},{"nama":"Embedded System","sks":2,"nilai":"C+"},{"nama":"Internet of Things","sks":3,"nilai":"B-"},{"nama":"Aplikasi Sensor dan Transduser","sks":2,"nilai":"B"},{"nama":"Instrumentasi Elektronika","sks":2,"nilai":"B-"},{"nama":"Sistem Kendali","sks":3,"nilai":"C+"},{"nama":"Komputer dan Jaringan","sks":2,"nilai":"B+"},{"nama":"Pemeliharaan dan Perbaikan Perangkat Elektronika","sks":2,"nilai":"B+"},{"nama":"Algoritma dan Pemrograman","sks":3,"nilai":"B"},{"nama":"Pengukuran Elektronika","sks":2,"nilai":"B"},{"nama":"Pendidikan Pancasila","sks":2,"nilai":"B+","umum":true},{"nama":"Bahasa Indonesia","sks":2,"nilai":"A-","umum":true},{"nama":"Bahasa Inggris","sks":2,"nilai":"B"}],"cert":[{"nama":"Pelatihan Internet of Things Dasar","jenis":"Non-BNSP"}],"bahasa":[{"nama":"Inggris","level":"Basic"}]},{"prodi":"Teknologi Rekayasa Sistem Elektronika","mk":[{"nama":"Elektronika Digital","sks":3,"nilai":"A-"},{"nama":"Elektronika Analog","sks":3,"nilai":"B+"},{"nama":"Rangkaian Listrik 1","sks":3,"nilai":"B+"},{"nama":"Sistem Mikrokontroler","sks":3,"nilai":"B"},{"nama":"Embedded System","sks":2,"nilai":"B-"},{"nama":"Internet of Things","sks":3,"nilai":"B+"},{"nama":"Aplikasi Sensor dan Transduser","sks":2,"nilai":"A-"},{"nama":"Instrumentasi Elektronika","sks":2,"nilai":"B"},{"nama":"Sistem Kendali","sks":3,"nilai":"B"},{"nama":"Komputer dan Jaringan","sks":2,"nilai":"B+"},{"nama":"Pemeliharaan dan Perbaikan Perangkat Elektronika","sks":2,"nilai":"B"},{"nama":"Algoritma dan Pemrograman","sks":3,"nilai":"B-"},{"nama":"Pengukuran Elektronika","sks":2,"nilai":"B+"},{"nama":"Pendidikan Pancasila","sks":2,"nilai":"B+","umum":true},{"nama":"Bahasa Indonesia","sks":2,"nilai":"B+","umum":true},{"nama":"Bahasa Inggris","sks":2,"nilai":"A-"}],"cert":[{"nama":"Pelatihan PLC Dasar","jenis":"Non-BNSP"}],"bahasa":[{"nama":"Inggris","level":"Advanced"},{"nama":"Jepang","level":"Basic"}]},{"prodi":"Teknologi Rekayasa Sistem Elektronika","mk":[{"nama":"Elektronika Digital","sks":3,"nilai":"B+"},{"nama":"Elektronika Analog","sks":3,"nilai":"B"},{"nama":"Rangkaian Listrik 1","sks":3,"nilai":"B"},{"nama":"Sistem Mikrokontroler","sks":3,"nilai":"B"},{"nama":"Embedded System","sks":2,"nilai":"B"},{"nama":"Internet of Things","sks":3,"nilai":"B"},{"nama":"Aplikasi Sensor dan Transduser","sks":2,"nilai":"B+"},{"nama":"Instrumentasi Elektronika","sks":2,"nilai":"B-"},{"nama":"Sistem Kendali","sks":3,"nilai":"B-"},{"nama":"Komputer dan Jaringan","sks":2,"nilai":"B+"},{"nama":"Pemeliharaan dan Perbaikan Perangkat Elektronika","sks":2,"nilai":"A-"},{"nama":"Algoritma dan Pemrograman","sks":3,"nilai":"B-"},{"nama":"Pengukuran Elektronika","sks":2,"nilai":"B+"},{"nama":"Pendidikan Pancasila","sks":2,"nilai":"A-","umum":true},{"nama":"Bahasa Indonesia","sks":2,"nilai":"A-","umum":true},{"nama":"Bahasa Inggris","sks":2,"nilai":"A"}],"cert":[],"bahasa":[{"nama":"Inggris","level":"Advanced"}]},{"prodi":"Teknologi Rekayasa Sistem Elektronika","mk":[{"nama":"Elektronika Digital","sks":3,"nilai":"B"},{"nama":"Elektronika Analog","sks":3,"nilai":"B"},{"nama":"Rangkaian Listrik 1","sks":3,"nilai":"B"},{"nama":"Sistem Mikrokontroler","sks":3,"nilai":"B"},{"nama":"Embedded System","sks":2,"nilai":"B"},{"nama":"Internet of Things","sks":3,"nilai":"B+"},{"nama":"Aplikasi Sensor dan Transduser","sks":2,"nilai":"B"},{"nama":"Instrumentasi Elektronika","sks":2,"nilai":"B"},{"nama":"Sistem Kendali","sks":3,"nilai":"B-"},{"nama":"Komputer dan Jaringan","sks":2,"nilai":"B+"},{"nama":"Pemeliharaan dan Perbaikan Perangkat Elektronika","sks":2,"nilai":"B+"},{"nama":"Algoritma dan Pemrograman","sks":3,"nilai":"B+"},{"nama":"Pengukuran Elektronika","sks":2,"nilai":"B+"},{"nama":"Pendidikan Pancasila","sks":2,"nilai":"B+","umum":true},{"nama":"Bahasa Indonesia","sks":2,"nilai":"B+","umum":true},{"nama":"Bahasa Inggris","sks":2,"nilai":"A-"}],"cert":[],"bahasa":[{"nama":"Inggris","level":"Advanced"},{"nama":"Jepang","level":"Basic"}]},{"prodi":"Teknologi Rekayasa Sistem Elektronika","mk":[{"nama":"Elektronika Digital","sks":3,"nilai":"B"},{"nama":"Elektronika Analog","sks":3,"nilai":"B+"},{"nama":"Rangkaian Listrik 1","sks":3,"nilai":"B"},{"nama":"Sistem Mikrokontroler","sks":3,"nilai":"B+"},{"nama":"Embedded System","sks":2,"nilai":"B"},{"nama":"Internet of Things","sks":3,"nilai":"B"},{"nama":"Aplikasi Sensor dan Transduser","sks":2,"nilai":"B"},{"nama":"Instrumentasi Elektronika","sks":2,"nilai":"C+"},{"nama":"Sistem Kendali","sks":3,"nilai":"B-"},{"nama":"Komputer dan Jaringan","sks":2,"nilai":"B-"},{"nama":"Pemeliharaan dan Perbaikan Perangkat Elektronika","sks":2,"nilai":"B"},{"nama":"Algoritma dan Pemrograman","sks":3,"nilai":"B"},{"nama":"Pengukuran Elektronika","sks":2,"nilai":"B+"},{"nama":"Pendidikan Pancasila","sks":2,"nilai":"A-","umum":true},{"nama":"Bahasa Indonesia","sks":2,"nilai":"A-","umum":true},{"nama":"Bahasa Inggris","sks":2,"nilai":"B+"}],"cert":[],"bahasa":[{"nama":"Inggris","level":"Basic"}]},{"prodi":"Teknologi Rekayasa Sistem Elektronika","mk":[{"nama":"Elektronika Digital","sks":3,"nilai":"B"},{"nama":"Elektronika Analog","sks":3,"nilai":"B"},{"nama":"Rangkaian Listrik 1","sks":3,"nilai":"B+"},{"nama":"Sistem Mikrokontroler","sks":3,"nilai":"B+"},{"nama":"Embedded System","sks":2,"nilai":"B-"},{"nama":"Internet of Things","sks":3,"nilai":"B+"},{"nama":"Aplikasi Sensor dan Transduser","sks":2,"nilai":"B+"},{"nama":"Instrumentasi Elektronika","sks":2,"nilai":"C+"},{"nama":"Sistem Kendali","sks":3,"nilai":"B"},{"nama":"Komputer dan Jaringan","sks":2,"nilai":"B-"},{"nama":"Pemeliharaan dan Perbaikan Perangkat Elektronika","sks":2,"nilai":"B+"},{"nama":"Algoritma dan Pemrograman","sks":3,"nilai":"B"},{"nama":"Pengukuran Elektronika","sks":2,"nilai":"B"},{"nama":"Pendidikan Pancasila","sks":2,"nilai":"B+","umum":true},{"nama":"Bahasa Indonesia","sks":2,"nilai":"A","umum":true},{"nama":"Bahasa Inggris","sks":2,"nilai":"A"}],"cert":[],"bahasa":[]},{"prodi":"Manajemen Pemasaran","mk":[{"nama":"Manajemen Pemasaran","sks":3,"nilai":"A"},{"nama":"Perilaku Konsumen","sks":3,"nilai":"A"},{"nama":"Riset Pemasaran","sks":3,"nilai":"B+"},{"nama":"Komunikasi Pemasaran","sks":3,"nilai":"B+"},{"nama":"Manajemen Penjualan","sks":3,"nilai":"A"},{"nama":"Negosiasi Bisnis","sks":2,"nilai":"B+"},{"nama":"Periklanan","sks":2,"nilai":"A"},{"nama":"Manajemen Merek","sks":2,"nilai":"B+"},{"nama":"Statistika Bisnis","sks":3,"nilai":"B"},{"nama":"Bahasa Inggris Bisnis","sks":2,"nilai":"A-"},{"nama":"Kewirausahaan","sks":2,"nilai":"A"},{"nama":"Pendidikan Pancasila","sks":2,"nilai":"A-","umum":true},{"nama":"Bahasa Indonesia","sks":2,"nilai":"B+","umum":true},{"nama":"Bahasa Inggris","sks":2,"nilai":"B"}],"cert":[{"nama":"Kursus Digital Marketing Dasar","jenis":"Non-BNSP"}],"bahasa":[{"nama":"Inggris","level":"Basic"}]},{"prodi":"Manajemen Pemasaran","mk":[{"nama":"Manajemen Pemasaran","sks":3,"nilai":"A"},{"nama":"Perilaku Konsumen","sks":3,"nilai":"A-"},{"nama":"Riset Pemasaran","sks":3,"nilai":"B+"},{"nama":"Komunikasi Pemasaran","sks":3,"nilai":"B+"},{"nama":"Manajemen Penjualan","sks":3,"nilai":"B+"},{"nama":"Negosiasi Bisnis","sks":2,"nilai":"A-"},{"nama":"Periklanan","sks":2,"nilai":"A-"},{"nama":"Manajemen Merek","sks":2,"nilai":"A-"},{"nama":"Statistika Bisnis","sks":3,"nilai":"B"},{"nama":"Bahasa Inggris Bisnis","sks":2,"nilai":"A-"},{"nama":"Kewirausahaan","sks":2,"nilai":"B+"},{"nama":"Pendidikan Pancasila","sks":2,"nilai":"B+","umum":true},{"nama":"Bahasa Indonesia","sks":2,"nilai":"A-","umum":true},{"nama":"Bahasa Inggris","sks":2,"nilai":"A"}],"cert":[],"bahasa":[{"nama":"Inggris","level":"Advanced"}]},{"prodi":"Manajemen Pemasaran","mk":[{"nama":"Manajemen Pemasaran","sks":3,"nilai":"B"},{"nama":"Perilaku Konsumen","sks":3,"nilai":"B-"},{"nama":"Riset Pemasaran","sks":3,"nilai":"C+"},{"nama":"Komunikasi Pemasaran","sks":3,"nilai":"B+"},{"nama":"Manajemen Penjualan","sks":3,"nilai":"B+"},{"nama":"Negosiasi Bisnis","sks":2,"nilai":"B"},{"nama":"Periklanan","sks":2,"nilai":"B"},{"nama":"Manajemen Merek","sks":2,"nilai":"B-"},{"nama":"Statistika Bisnis","sks":3,"nilai":"B-"},{"nama":"Bahasa Inggris Bisnis","sks":2,"nilai":"B"},{"nama":"Kewirausahaan","sks":2,"nilai":"A-"},{"nama":"Pendidikan Pancasila","sks":2,"nilai":"B+","umum":true},{"nama":"Bahasa Indonesia","sks":2,"nilai":"B","umum":true},{"nama":"Bahasa Inggris","sks":2,"nilai":"A-"}],"cert":[],"bahasa":[{"nama":"Inggris","level":"Intermediate"}]},{"prodi":"Manajemen Pemasaran","mk":[{"nama":"Manajemen Pemasaran","sks":3,"nilai":"A"},{"nama":"Perilaku Konsumen","sks":3,"nilai":"B+"},{"nama":"Riset Pemasaran","sks":3,"nilai":"B+"},{"nama":"Komunikasi Pemasaran","sks":3,"nilai":"A"},{"nama":"Manajemen Penjualan","sks":3,"nilai":"A-"},{"nama":"Negosiasi Bisnis","sks":2,"nilai":"A"},{"nama":"Periklanan","sks":2,"nilai":"A-"},{"nama":"Manajemen Merek","sks":2,"nilai":"A-"},{"nama":"Statistika Bisnis","sks":3,"nilai":"B+"},{"nama":"Bahasa Inggris Bisnis","sks":2,"nilai":"B+"},{"nama":"Kewirausahaan","sks":2,"nilai":"A"},{"nama":"Pendidikan Pancasila","sks":2,"nilai":"B+","umum":true},{"nama":"Bahasa Indonesia","sks":2,"nilai":"A-","umum":true},{"nama":"Bahasa Inggris","sks":2,"nilai":"B+"}],"cert":[],"bahasa":[{"nama":"Inggris","level":"Basic"}]},{"prodi":"Manajemen Pemasaran","mk":[{"nama":"Manajemen Pemasaran","sks":3,"nilai":"B+"},{"nama":"Perilaku Konsumen","sks":3,"nilai":"B+"},{"nama":"Riset Pemasaran","sks":3,"nilai":"B-"},{"nama":"Komunikasi Pemasaran","sks":3,"nilai":"A-"},{"nama":"Manajemen Penjualan","sks":3,"nilai":"B+"},{"nama":"Negosiasi Bisnis","sks":2,"nilai":"B+"},{"nama":"Periklanan","sks":2,"nilai":"A-"},{"nama":"Manajemen Merek","sks":2,"nilai":"B+"},{"nama":"Statistika Bisnis","sks":3,"nilai":"B"},{"nama":"Bahasa Inggris Bisnis","sks":2,"nilai":"B"},{"nama":"Kewirausahaan","sks":2,"nilai":"A-"},{"nama":"Pendidikan Pancasila","sks":2,"nilai":"A-","umum":true},{"nama":"Bahasa Indonesia","sks":2,"nilai":"B","umum":true},{"nama":"Bahasa Inggris","sks":2,"nilai":"B+"}],"cert":[],"bahasa":[{"nama":"Inggris","level":"Advanced"}]},{"prodi":"Manajemen Pemasaran","mk":[{"nama":"Manajemen Pemasaran","sks":3,"nilai":"B+"},{"nama":"Perilaku Konsumen","sks":3,"nilai":"A-"},{"nama":"Riset Pemasaran","sks":3,"nilai":"B"},{"nama":"Komunikasi Pemasaran","sks":3,"nilai":"B+"},{"nama":"Manajemen Penjualan","sks":3,"nilai":"A-"},{"nama":"Negosiasi Bisnis","sks":2,"nilai":"A"},{"nama":"Periklanan","sks":2,"nilai":"B+"},{"nama":"Manajemen Merek","sks":2,"nilai":"B+"},{"nama":"Statistika Bisnis","sks":3,"nilai":"B-"},{"nama":"Bahasa Inggris Bisnis","sks":2,"nilai":"A-"},{"nama":"Kewirausahaan","sks":2,"nilai":"A"},{"nama":"Pendidikan Pancasila","sks":2,"nilai":"A-","umum":true},{"nama":"Bahasa Indonesia","sks":2,"nilai":"B+","umum":true},{"nama":"Bahasa Inggris","sks":2,"nilai":"B+"}],"cert":[],"bahasa":[]},{"prodi":"Matematika","mk":[{"nama":"Kalkulus 1","sks":4,"nilai":"B-"},{"nama":"Aljabar Linear","sks":3,"nilai":"B+"},{"nama":"Statistika Matematika","sks":3,"nilai":"B+"},{"nama":"Teori Peluang","sks":3,"nilai":"B+"},{"nama":"Metode Numerik","sks":3,"nilai":"B+"},{"nama":"Algoritma dan Pemrograman","sks":3,"nilai":"B-"},{"nama":"Struktur Data","sks":3,"nilai":"B+"},{"nama":"Riset Operasi","sks":3,"nilai":"A-"},{"nama":"Analisis Real","sks":4,"nilai":"B-"},{"nama":"Pemodelan Matematika","sks":3,"nilai":"B+"},{"nama":"Pendidikan Pancasila","sks":2,"nilai":"A-","umum":true},{"nama":"Bahasa Indonesia","sks":2,"nilai":"A-","umum":true},{"nama":"Bahasa Inggris","sks":2,"nilai":"A-"}],"cert":[],"bahasa":[{"nama":"Inggris","level":"Basic"}]},{"prodi":"Matematika","mk":[{"nama":"Kalkulus 1","sks":4,"nilai":"B-"},{"nama":"Aljabar Linear","sks":3,"nilai":"B"},{"nama":"Statistika Matematika","sks":3,"nilai":"B"},{"nama":"Teori Peluang","sks":3,"nilai":"B-"},{"nama":"Metode Numerik","sks":3,"nilai":"B-"},{"nama":"Algoritma dan Pemrograman","sks":3,"nilai":"B"},{"nama":"Struktur Data","sks":3,"nilai":"B-"},{"nama":"Riset Operasi","sks":3,"nilai":"B"},{"nama":"Analisis Real","sks":4,"nilai":"C+"},{"nama":"Pemodelan Matematika","sks":3,"nilai":"B"},{"nama":"Pendidikan Pancasila","sks":2,"nilai":"B+","umum":true},{"nama":"Bahasa Indonesia","sks":2,"nilai":"A-","umum":true},{"nama":"Bahasa Inggris","sks":2,"nilai":"B"}],"cert":[{"nama":"Kursus Pemrograman Python untuk Analisis Data","jenis":"Non-BNSP"}],"bahasa":[{"nama":"Inggris","level":"Intermediate"}]},{"prodi":"Matematika","mk":[{"nama":"Kalkulus 1","sks":4,"nilai":"B-"},{"nama":"Aljabar Linear","sks":3,"nilai":"C+"},{"nama":"Statistika Matematika","sks":3,"nilai":"C+"},{"nama":"Teori Peluang","sks":3,"nilai":"C+"},{"nama":"Metode Numerik","sks":3,"nilai":"B"},{"nama":"Algoritma dan Pemrograman","sks":3,"nilai":"B-"},{"nama":"Struktur Data","sks":3,"nilai":"C"},{"nama":"Riset Operasi","sks":3,"nilai":"B-"},{"nama":"Analisis Real","sks":4,"nilai":"C+"},{"nama":"Pemodelan Matematika","sks":3,"nilai":"B-"},{"nama":"Pendidikan Pancasila","sks":2,"nilai":"A-","umum":true},{"nama":"Bahasa Indonesia","sks":2,"nilai":"B","umum":true},{"nama":"Bahasa Inggris","sks":2,"nilai":"B+"}],"cert":[],"bahasa":[{"nama":"Inggris","level":"Basic"}]},{"prodi":"Matematika","mk":[{"nama":"Kalkulus 1","sks":4,"nilai":"B+"},{"nama":"Aljabar Linear","sks":3,"nilai":"B+"},{"nama":"Statistika Matematika","sks":3,"nilai":"B-"},{"nama":"Teori Peluang","sks":3,"nilai":"C+"},{"nama":"Metode Numerik","sks":3,"nilai":"B-"},{"nama":"Algoritma dan Pemrograman","sks":3,"nilai":"C+"},{"nama":"Struktur Data","sks":3,"nilai":"C+"},{"nama":"Riset Operasi","sks":3,"nilai":"B+"},{"nama":"Analisis Real","sks":4,"nilai":"B-"},{"nama":"Pemodelan Matematika","sks":3,"nilai":"A-"},{"nama":"Pendidikan Pancasila","sks":2,"nilai":"B+","umum":true},{"nama":"Bahasa Indonesia","sks":2,"nilai":"A-","umum":true},{"nama":"Bahasa Inggris","sks":2,"nilai":"A-"}],"cert":[],"bahasa":[{"nama":"Inggris","level":"Advanced"}]},{"prodi":"Matematika","mk":[{"nama":"Kalkulus 1","sks":4,"nilai":"C+"},{"nama":"Aljabar Linear","sks":3,"nilai":"B"},{"nama":"Statistika Matematika","sks":3,"nilai":"B-"},{"nama":"Teori Peluang","sks":3,"nilai":"C+"},{"nama":"Metode Numerik","sks":3,"nilai":"B"},{"nama":"Algoritma dan Pemrograman","sks":3,"nilai":"C"},{"nama":"Struktur Data","sks":3,"nilai":"C+"},{"nama":"Riset Operasi","sks":3,"nilai":"B-"},{"nama":"Analisis Real","sks":4,"nilai":"B-"},{"nama":"Pemodelan Matematika","sks":3,"nilai":"B-"},{"nama":"Pendidikan Pancasila","sks":2,"nilai":"B+","umum":true},{"nama":"Bahasa Indonesia","sks":2,"nilai":"A-","umum":true},{"nama":"Bahasa Inggris","sks":2,"nilai":"B"}],"cert":[],"bahasa":[{"nama":"Inggris","level":"Intermediate"}]},{"prodi":"Matematika","mk":[{"nama":"Kalkulus 1","sks":4,"nilai":"B"},{"nama":"Aljabar Linear","sks":3,"nilai":"B+"},{"nama":"Statistika Matematika","sks":3,"nilai":"A-"},{"nama":"Teori Peluang","sks":3,"nilai":"B+"},{"nama":"Metode Numerik","sks":3,"nilai":"A"},{"nama":"Algoritma dan Pemrograman","sks":3,"nilai":"B"},{"nama":"Struktur Data","sks":3,"nilai":"B"},{"nama":"Riset Operasi","sks":3,"nilai":"A-"},{"nama":"Analisis Real","sks":4,"nilai":"B-"},{"nama":"Pemodelan Matematika","sks":3,"nilai":"A"},{"nama":"Pendidikan Pancasila","sks":2,"nilai":"B+","umum":true},{"nama":"Bahasa Indonesia","sks":2,"nilai":"B","umum":true},{"nama":"Bahasa Inggris","sks":2,"nilai":"A"}],"cert":[],"bahasa":[]},{"prodi":"Pendidikan Anak Usia Dini (PAUD)","mk":[{"nama":"Psikologi Perkembangan Anak","sks":3,"nilai":"B+"},{"nama":"Perencanaan Pembelajaran PAUD","sks":3,"nilai":"B"},{"nama":"Asesmen Perkembangan Anak Usia Dini","sks":3,"nilai":"B"},{"nama":"Media Pembelajaran PAUD","sks":3,"nilai":"A-"},{"nama":"Manajemen Kelas","sks":2,"nilai":"A-"},{"nama":"Kurikulum PAUD","sks":3,"nilai":"B"},{"nama":"Bermain dan Permainan Anak","sks":2,"nilai":"A-"},{"nama":"Seni Anak Usia Dini","sks":2,"nilai":"B+"},{"nama":"Pendidikan Pancasila","sks":2,"nilai":"B+","umum":true},{"nama":"Bahasa Indonesia","sks":2,"nilai":"B+","umum":true},{"nama":"Bahasa Inggris","sks":2,"nilai":"B+"}],"cert":[{"nama":"Pelatihan Media Pembelajaran Anak","jenis":"Non-BNSP"}],"bahasa":[{"nama":"Inggris","level":"Basic"}]},{"prodi":"Pendidikan Anak Usia Dini (PAUD)","mk":[{"nama":"Psikologi Perkembangan Anak","sks":3,"nilai":"B+"},{"nama":"Perencanaan Pembelajaran PAUD","sks":3,"nilai":"B"},{"nama":"Asesmen Perkembangan Anak Usia Dini","sks":3,"nilai":"B+"},{"nama":"Media Pembelajaran PAUD","sks":3,"nilai":"A-"},{"nama":"Manajemen Kelas","sks":2,"nilai":"A-"},{"nama":"Kurikulum PAUD","sks":3,"nilai":"A-"},{"nama":"Bermain dan Permainan Anak","sks":2,"nilai":"A"},{"nama":"Seni Anak Usia Dini","sks":2,"nilai":"A-"},{"nama":"Pendidikan Pancasila","sks":2,"nilai":"B","umum":true},{"nama":"Bahasa Indonesia","sks":2,"nilai":"B+","umum":true},{"nama":"Bahasa Inggris","sks":2,"nilai":"B+"}],"cert":[],"bahasa":[{"nama":"Inggris","level":"Intermediate"}]},{"prodi":"Pendidikan Anak Usia Dini (PAUD)","mk":[{"nama":"Psikologi Perkembangan Anak","sks":3,"nilai":"B+"},{"nama":"Perencanaan Pembelajaran PAUD","sks":3,"nilai":"B-"},{"nama":"Asesmen Perkembangan Anak Usia Dini","sks":3,"nilai":"C+"},{"nama":"Media Pembelajaran PAUD","sks":3,"nilai":"B-"},{"nama":"Manajemen Kelas","sks":2,"nilai":"B+"},{"nama":"Kurikulum PAUD","sks":3,"nilai":"B+"},{"nama":"Bermain dan Permainan Anak","sks":2,"nilai":"B+"},{"nama":"Seni Anak Usia Dini","sks":2,"nilai":"B"},{"nama":"Pendidikan Pancasila","sks":2,"nilai":"B+","umum":true},{"nama":"Bahasa Indonesia","sks":2,"nilai":"A-","umum":true},{"nama":"Bahasa Inggris","sks":2,"nilai":"B"}],"cert":[],"bahasa":[{"nama":"Inggris","level":"Basic"}]},{"prodi":"Pendidikan Anak Usia Dini (PAUD)","mk":[{"nama":"Psikologi Perkembangan Anak","sks":3,"nilai":"B+"},{"nama":"Perencanaan Pembelajaran PAUD","sks":3,"nilai":"B"},{"nama":"Asesmen Perkembangan Anak Usia Dini","sks":3,"nilai":"B"},{"nama":"Media Pembelajaran PAUD","sks":3,"nilai":"A-"},{"nama":"Manajemen Kelas","sks":2,"nilai":"B"},{"nama":"Kurikulum PAUD","sks":3,"nilai":"A-"},{"nama":"Bermain dan Permainan Anak","sks":2,"nilai":"A"},{"nama":"Seni Anak Usia Dini","sks":2,"nilai":"A-"},{"nama":"Pendidikan Pancasila","sks":2,"nilai":"B+","umum":true},{"nama":"Bahasa Indonesia","sks":2,"nilai":"A-","umum":true},{"nama":"Bahasa Inggris","sks":2,"nilai":"A-"}],"cert":[],"bahasa":[{"nama":"Inggris","level":"Intermediate"}]},{"prodi":"Pendidikan Anak Usia Dini (PAUD)","mk":[{"nama":"Psikologi Perkembangan Anak","sks":3,"nilai":"B"},{"nama":"Perencanaan Pembelajaran PAUD","sks":3,"nilai":"B"},{"nama":"Asesmen Perkembangan Anak Usia Dini","sks":3,"nilai":"B"},{"nama":"Media Pembelajaran PAUD","sks":3,"nilai":"B+"},{"nama":"Manajemen Kelas","sks":2,"nilai":"B"},{"nama":"Kurikulum PAUD","sks":3,"nilai":"B+"},{"nama":"Bermain dan Permainan Anak","sks":2,"nilai":"B+"},{"nama":"Seni Anak Usia Dini","sks":2,"nilai":"B"},{"nama":"Pendidikan Pancasila","sks":2,"nilai":"A-","umum":true},{"nama":"Bahasa Indonesia","sks":2,"nilai":"B","umum":true},{"nama":"Bahasa Inggris","sks":2,"nilai":"A-"}],"cert":[],"bahasa":[{"nama":"Inggris","level":"Intermediate"}]},{"prodi":"Pendidikan Anak Usia Dini (PAUD)","mk":[{"nama":"Psikologi Perkembangan Anak","sks":3,"nilai":"A"},{"nama":"Perencanaan Pembelajaran PAUD","sks":3,"nilai":"A-"},{"nama":"Asesmen Perkembangan Anak Usia Dini","sks":3,"nilai":"A-"},{"nama":"Media Pembelajaran PAUD","sks":3,"nilai":"A-"},{"nama":"Manajemen Kelas","sks":2,"nilai":"B+"},{"nama":"Kurikulum PAUD","sks":3,"nilai":"B+"},{"nama":"Bermain dan Permainan Anak","sks":2,"nilai":"A"},{"nama":"Seni Anak Usia Dini","sks":2,"nilai":"B+"},{"nama":"Pendidikan Pancasila","sks":2,"nilai":"A-","umum":true},{"nama":"Bahasa Indonesia","sks":2,"nilai":"A","umum":true},{"nama":"Bahasa Inggris","sks":2,"nilai":"B"}],"cert":[],"bahasa":[]}],"jumlah_jobseeker":{"Teknologi Rekayasa Sistem Elektronika":6,"Manajemen Pemasaran":6,"Matematika":6,"Pendidikan Anak Usia Dini (PAUD)":6},"lamaran":{"Teknologi Rekayasa Sistem Elektronika":{"Diundang":1,"Ditinjau":1,"Dikirim":1,"Ditolak":1},"Manajemen Pemasaran":{"Ditinjau":1,"Diterima":1,"Dikirim":1},"Matematika":{"Diundang":1,"Dikirim":1},"Pendidikan Anak Usia Dini (PAUD)":{"Diterima":1,"Ditinjau":1}}};
            const PR = {loaded: false, loading: false, demo: false, reqProdi: null, prodi: '', sources: [], agg: null, jml: 0, charts: {}};
            const READY = 0.75;    // bukti kuat: MK terkait bernilai >= B (3/4), atau sertifikat terkait
            const MIN_MHS = 3;
            const MIN_SUMBER = 2;  // kompetensi baru dianggap prioritas bila diminta minimal 2 lowongan/perusahaan     // kesiapan prodi baru ditampilkan bila ada >= 3 mahasiswa (menjaga anonimitas)
            const PRIO = (g) => g >= 40 ? 'Tinggi' : (g >= 20 ? 'Sedang' : 'Rendah');
            const PRIO_ORD = {Tinggi: 0, Sedang: 1, Rendah: 2};
            const PRIO_BADGE = {Tinggi: 'badge-red', Sedang: 'badge-orange', Rendah: 'badge-green'};
            const pc = (v) => v === null || v === undefined ? '-' : Math.round(v) + '%';
            const dec = (v) => Number(v).toFixed(2).replace('.', ',');
            const parseTgl = (s) => new Date(String(s || '').replace(' ', 'T'));
            const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const curProdi = () => sessionStorage.getItem('c-dfs_user_prodi') || '';

            // Agregat kesiapan prodi — logika yang sama dengan analisisProdi() di php/api.php (dipakai di mode demo)
            function prAgg(sources, studs) {
                const n = sources.length, ns = studs.length, cukup = ns >= MIN_MHS;
                const km = new Map();
                sources.forEach(s => new Set((s.kompetensi || []).map(k => String(k).trim()).filter(Boolean)).forEach(k => {
                    const key = k.toLowerCase();
                    if (!km.has(key)) km.set(key, {nama: k, n: 0});
                    km.get(key).n++;
                }));
                const komp = [...km.values()].map(k => {
                    let ready = null, certN = 0, mk = [];
                    if (cukup) {
                        const rel = new Map();
                        studs.forEach(st => (st.mk || []).forEach(m => { if (!m.umum && !rel.has(m.nama)) rel.set(m.nama, relScore(k.nama, m.nama)); }));
                        const maxRel = Math.max(0, ...rel.values());
                        const agg = new Map();
                        let ok = 0;
                        studs.forEach(st => {
                            let best = 0;
                            (st.mk || []).forEach(m => {
                                if (m.umum || maxRel <= 0 || (rel.get(m.nama) || 0) < 0.8 * maxRel) return;
                                best = Math.max(best, bobot(m) / 4);
                                const e = agg.get(m.nama) || {sum: 0, n: 0}; e.sum += bobot(m); e.n++; agg.set(m.nama, e);
                            });
                            const cert = (st.cert || []).some(c => related(k.nama, c.nama));
                            if (cert) certN++;
                            if (best >= READY || cert) ok++;
                        });
                        ready = 100 * ok / ns;
                        mk = [...agg.entries()].map(([nama, e]) => ({nama, avg: Math.round(e.sum / e.n * 100) / 100, n: e.n, r: rel.get(nama)}))
                            .sort((a, b) => b.r - a.r || b.n - a.n);
                    }
                    return {nama: k.nama, n: k.n, demand: n ? 100 * k.n / n : 0, ready, mk, certN};
                });
                const lm = new Map();
                sources.forEach(s => (s.bahasa || []).forEach(b => {
                    const key = normLang(b.nama);
                    if (!key) return;
                    const e = lm.get(key) || {nama: b.nama, level: b.level, n: 0};
                    e.n++;
                    if ((LEVEL_VAL[b.level] || 0) > (LEVEL_VAL[e.level] || 0)) e.level = b.level;
                    lm.set(key, e);
                }));
                const langs = [...lm.values()].map(b => ({...b, demand: 100 * b.n / n,
                    ready: cukup ? 100 * studs.filter(st => langReqEval(b, st).v >= 1).length / ns : null}));
                return {komp, langs, mahasiswa: ns, cukup};
            }

            async function prLoad() {
                const prodi = curProdi();
                PR.reqProdi = prodi;
                const res = await apiRequest('js_prodi', {prodi});
                if (res && res.success) {
                    PR.demo = false;
                    PR.prodi = res.prodi || '';
                    PR.sources = res.sources || [];
                    PR.agg = res.analisis || null;
                    PR.jml = res.jumlah_jobseeker || 0;
                } else {
                    PR.demo = true;
                    PR.prodi = prodi;
                    // Tanggal dibuat relatif terhadap hari ini agar grafik tren selalu terisi
                    PR.sources = PR_DEMO.sources.map((s, i) => {
                        const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - s.bulan_lalu); d.setDate(5 + (i * 3) % 20);
                        return {...s, id: 'D' + i, created_at: d.toISOString()};
                    }).filter(s => s.prodi === prodi);
                    PR.agg = prodi ? prAgg(PR.sources, PR_DEMO.students.filter(s => s.prodi === prodi)) : null;
                    PR.jml = PR_DEMO.jumlah_jobseeker[prodi] || 0;
                }
                PR.loaded = true;
            }
            // Muat ulang bila prodi Jobseeker berubah
            function prEnsure() {
                if (PR.loading || (PR.loaded && PR.reqProdi === curProdi())) return;
                PR.loading = true;
                prLoad().finally(() => { PR.loading = false; jsRenderDash(); prRenderAll(); });
            }

            // Bukti milik Jobseeker sendiri: hanya mata kuliah yang namanya paling mirip, atau sertifikat terkait
            function myEvidence(nama) {
                const mks = JM.mk.filter(m => !m.umum).map(m => ({m, r: relScore(nama, m.nama)}));
                const maxR = Math.max(0, ...mks.map(x => x.r));
                const dekat = maxR > 0 ? mks.filter(x => x.r >= 0.8 * maxR).sort((a, b) => bobot(b.m) - bobot(a.m)) : [];
                const cert = JM.cert.find(c => related(nama, c.nama));
                const v = Math.max(dekat.length ? bobot(dekat[0].m) / 4 : 0, cert ? (cert.jenis === 'BNSP' ? 1 : 0.8) : 0);
                return {v, mk: dekat.length ? dekat[0].m : null, cert};
            }
            const punyaData = () => JM.mk.length > 0;

            function prTrendRows(komp) {
                const months = [];
                const now = new Date();
                for (let i = 5; i >= 0; i--) {
                    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                    months.push({key: monthKey(d), label: d.toLocaleDateString('id-ID', {month: 'short', year: '2-digit'})});
                }
                const idx = Object.fromEntries(months.map((m, i) => [m.key, i]));
                const rows = komp.map(k => {
                    const c = [0, 0, 0, 0, 0, 0];
                    k.src.forEach(s => { const d = parseTgl(s.created_at); if (!isNaN(d) && idx[monthKey(d)] !== undefined) c[idx[monthKey(d)]]++; });
                    const prev = c[0] + c[1] + c[2], last = c[3] + c[4] + c[5];
                    const arah = !prev && last ? 'Baru' : (last > prev ? 'Naik' : (last < prev ? 'Turun' : 'Stabil'));
                    return {nama: k.nama, anda: k.anda, c, prev, last, total: prev + last, arah};
                });
                return {months, rows};
            }

            function prAnalyze() {
                if (!PR.loaded || !PR.agg || !PR.prodi) return null;
                const S = PR.sources, punya = punyaData();
                const me = {prodi: PR.prodi, mk: JM.mk, cert: JM.cert, bahasa: JM.bahasa};
                const komp = PR.agg.komp.map(k => {
                    const gap = k.ready === null ? null : Math.max(0, k.demand - k.ready);
                    const ev = punya ? myEvidence(k.nama) : null;
                    const src = S.filter(s => (s.kompetensi || []).some(x => String(x).trim().toLowerCase() === k.nama.toLowerCase()));
                    return {...k, gap, prio: gap === null ? null : PRIO(gap), ev, anda: ev ? ev.v >= READY : null, src};
                }).sort((a, b) => (b.gap ?? -1) - (a.gap ?? -1) || b.demand - a.demand || a.nama.localeCompare(b.nama));
                const langs = PR.agg.langs.map(b => {
                    const gap = b.ready === null ? null : Math.max(0, b.demand - b.ready);
                    const have = JM.bahasa.find(x => normLang(x.nama) === normLang(b.nama));
                    return {...b, gap, prio: gap === null ? null : PRIO(gap), have, anda: punya ? langReqEval(b, me).v >= 1 : null};
                }).sort((a, b) => b.demand - a.demand);
                const sumD = komp.reduce((s, k) => s + k.demand, 0);
                const index = PR.agg.cukup && sumD ? komp.reduce((s, k) => s + k.demand * k.ready, 0) / sumD : null;
                const trend = prTrendRows(komp);
                const arahOf = Object.fromEntries(trend.rows.map(r => [r.nama, r.arah]));
                const belum = komp.filter(k => k.anda === false).map(k => ({...k, tipe: 'kompetensi', arah: arahOf[k.nama]}))
                    .concat(langs.filter(b => b.anda === false).map(b => ({...b, tipe: 'bahasa'})))
                    .sort((a, b) => b.demand - a.demand);
                // Prioritas = diminta >= MIN_SUMBER sumber; yang baru diminta 1 perusahaan cukup dipantau
                const learn = belum.filter(k => k.n >= MIN_SUMBER), pantau = belum.filter(k => k.n < MIN_SUMBER);
                const a = {prodi: PR.prodi, S, komp, langs, index, cukup: PR.agg.cukup, ns: PR.agg.mahasiswa, punya, trend, learn, pantau,
                    nLow: S.filter(s => s.tipe === 'lowongan').length, nKeb: S.filter(s => s.tipe !== 'lowongan').length};
                a.recs = prRecs(a);
                return a;
            }

            // Rekomendasi kurikulum tingkat prodi (untuk dosen / koordinator prodi)
            function prRecs(a) {
                if (!a.cukup) return [];
                const recs = [];
                a.komp.filter(k => k.gap >= 20 && k.n >= MIN_SUMBER).forEach(k => {
                    if (k.mk.length) {
                        const avg = k.mk.reduce((s, m) => s + m.avg * m.n, 0) / k.mk.reduce((s, m) => s + m.n, 0);
                        recs.push({jenis: 'Perkuat Mata Kuliah', icon: 'fa-book-open', prio: k.prio,
                            judul: `Perkuat ${k.mk.slice(0, 2).map(m => m.nama).join(' & ')} untuk kompetensi ${k.nama}`,
                            alasan: `${pc(k.demand)} sumber industri meminta ${k.nama}, baru ${pc(k.ready)} mahasiswa memiliki bukti kuat. Rata-rata nilai MK terkait ${dec(avg)}.`,
                            aksi: `Tambahkan praktikum atau proyek berbasis kasus industri tentang ${k.nama}.`});
                    } else {
                        recs.push({jenis: 'Tambah MK / Modul Baru', icon: 'fa-circle-plus', prio: k.prio,
                            judul: `Tambahkan materi ${k.nama} ke kurikulum`,
                            alasan: `${pc(k.demand)} sumber industri meminta ${k.nama}, tetapi tidak ditemukan mata kuliah terkait di transkrip mahasiswa.`,
                            aksi: `Usulkan mata kuliah pilihan atau modul praktikum ${k.nama} (mis. 2–3 SKS).`});
                    }
                });
                const certCand = a.komp.filter(k => k.gap >= 20 && k.n >= MIN_SUMBER && !k.certN).slice(0, 2);
                if (certCand.length) recs.push({jenis: 'Integrasi Sertifikasi', icon: 'fa-certificate', prio: 'Sedang',
                    judul: `Jajaki sertifikasi kompetensi untuk ${certCand.map(k => k.nama).join(' dan ')}`,
                    alasan: 'Belum ada mahasiswa yang memiliki sertifikat terkait, padahal kompetensinya diminta industri.',
                    aksi: 'Kerja sama dengan LSP/BNSP atau mitra industri untuk skema sertifikasi yang relevan.'});
                a.langs.filter(b => b.gap >= 20 && b.n >= MIN_SUMBER).forEach(b => recs.push({jenis: 'Penguatan Bahasa', icon: 'fa-language', prio: b.prio,
                    judul: `Tingkatkan kemahiran Bahasa ${b.nama} hingga minimal ${b.level}`,
                    alasan: `${pc(b.demand)} sumber industri mensyaratkan Bahasa ${b.nama} (min. ${b.level}); baru ${pc(b.ready)} mahasiswa memenuhi.`,
                    aksi: `Sediakan kelas atau klub Bahasa ${b.nama} terapan sesuai bidang.`}));
                return recs.sort((x, y) => PRIO_ORD[x.prio] - PRIO_ORD[y.prio]);
            }

            // ---------- Render ----------
            function prChart(id, cfg) {
                if (PR.charts[id]) PR.charts[id].destroy();
                PR.charts[id] = new Chart(document.getElementById(id).getContext('2d'), cfg);
            }
            function prNoChart(id) { if (PR.charts[id]) { PR.charts[id].destroy(); delete PR.charts[id]; } }
            const prSetText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
            const andaCell = (v) => v === null ? '<span class="pr-anda na" title="Upload transkrip untuk melihat">—</span>'
                : (v ? '<span class="pr-anda ok"><i class="fa-solid fa-circle-check"></i> Sudah</span>' : '<span class="pr-anda no"><i class="fa-solid fa-circle-xmark"></i> Belum</span>');

            function prRenderGap(a) {
                const note = document.getElementById('prDataNote');
                const msg = [];
                if (PR.demo) msg.push('<strong>DATA CONTOH (fiktif).</strong> Server PHP/MySQL belum aktif, jadi halaman ini memakai data contoh.');
                if (!a.cukup) msg.push(`Kesiapan prodi baru ditampilkan bila minimal ${MIN_MHS} mahasiswa prodi Anda sudah mengunggah transkrip (saat ini ${a.ns}).`);
                else if (!PR.demo && (a.S.length < 5 || a.ns < 5)) msg.push(`Data masih sedikit (${a.S.length} sumber industri, ${a.ns} mahasiswa). Hasil bersifat indikatif.`);
                if (!a.punya) msg.push('Upload transkrip di <a href="#" class="js-goto" data-goto="view-jobmatch">Job Matching</a> agar kolom <strong>Anda</strong> terisi.');
                note.innerHTML = msg.length ? '<i class="fa-solid fa-circle-info"></i> <span>' + msg.join(' ') + '</span>' : '';
                note.classList.toggle('is-hidden', !msg.length);

                prSetText('prStatSumber', a.S.length);
                prSetText('prStatSumberDesc', `${a.nLow} lowongan aktif · ${a.nKeb} perusahaan tanpa lowongan`);
                prSetText('prStatIndeks', a.index === null ? '-' : pc(a.index));
                prSetText('prStatMhsDesc', a.cukup ? `dari ${a.ns} mahasiswa prodi (anonim)` : `menunggu ≥ ${MIN_MHS} mahasiswa`);
                const nk = a.komp.length + a.langs.length;
                const have = a.komp.filter(k => k.anda).length + a.langs.filter(b => b.anda).length;
                prSetText('prStatAnda', a.punya ? `${have}/${nk}` : '-');
                prSetText('prStatAndaDesc', a.punya ? 'kompetensi & bahasa yang diminta' : 'upload transkrip dahulu');
                prSetText('prStatBelajar', a.punya ? a.learn.length : '-');

                const top = [...a.komp].sort((x, y) => y.demand - x.demand).slice(0, 8);
                document.getElementById('prGapEmpty').classList.toggle('is-hidden', top.length > 0);
                document.getElementById('prGapChart').style.display = top.length ? '' : 'none';
                const vis = document.getElementById('view-pr-gap').classList.contains('active');
                if (top.length && vis) {
                    const ds = [{label: 'Permintaan industri', data: top.map(k => Math.round(k.demand)), backgroundColor: '#1d4ed8', borderRadius: 4, barPercentage: 0.8, categoryPercentage: 0.7}];
                    if (a.cukup) ds.push({label: 'Kesiapan mahasiswa prodi', data: top.map(k => Math.round(k.ready)), backgroundColor: '#10b981', borderRadius: 4, barPercentage: 0.8, categoryPercentage: 0.7});
                    prChart('prGapChart', {
                        type: 'bar',
                        data: {labels: top.map(k => (k.anda ? '✓ ' : '') + (k.nama.length > 30 ? k.nama.slice(0, 29) + '…' : k.nama)), datasets: ds},
                        options: {indexAxis: 'y', responsive: true, maintainAspectRatio: false,
                            plugins: {legend: {display: false}, tooltip: {callbacks: {label: (c) => `${c.dataset.label}: ${c.raw}%`}}},
                            scales: {x: {min: 0, max: 100, ticks: {callback: (v) => v + '%'}, grid: {color: '#f1f5f9'}}, y: {grid: {display: false}, ticks: {font: {size: 11}}}}}
                    });
                } else if (!top.length) prNoChart('prGapChart');

                prSetText('prGapCount', `${a.komp.length} kompetensi · ${a.S.length} sumber`);
                document.getElementById('prGapBody').innerHTML = a.komp.length ? a.komp.map(k => `
                    <tr>
                        <td><strong>${esc(k.nama)}</strong></td>
                        <td class="text-center">${pc(k.demand)} <span class="jp-muted">(${k.n}/${a.S.length})</span></td>
                        <td class="text-center">${pc(k.ready)}</td>
                        <td class="text-center">${k.gap === null ? '-' : (k.n < MIN_SUMBER ? `<span class="badge pr-badge-1" title="Baru diminta 1 sumber, belum dijadikan prioritas">${Math.round(k.gap)} · 1 sumber</span>` : `<span class="badge ${PRIO_BADGE[k.prio]}">${Math.round(k.gap)}</span>`)}</td>
                        <td>${k.mk.length ? k.mk.slice(0, 2).map(m => `<span class="pr-mk">${esc(m.nama)}${m.n >= MIN_MHS ? ` <em>${dec(m.avg)}</em>` : ''}</span>`).join('') : `<span class="pr-mk none">${a.cukup ? 'Tidak ada MK terkait' : 'Belum ada data'}</span>`}</td>
                        <td class="text-center">${andaCell(k.anda)}</td>
                    </tr>`).join('')
                    : '<tr><td colspan="6" class="text-center jp-muted" style="padding:24px;">Belum ada kebutuhan kompetensi dari Jobprovider untuk prodi Anda.</td></tr>';
                document.getElementById('prLangBody').innerHTML = a.langs.length ? a.langs.map(b => `
                    <tr>
                        <td><strong>Bahasa ${esc(b.nama)}</strong></td>
                        <td class="text-center">${esc(b.level)}</td>
                        <td class="text-center">${pc(b.demand)} <span class="jp-muted">(${b.n}/${a.S.length})</span></td>
                        <td class="text-center">${pc(b.ready)}</td>
                        <td class="text-center">${andaCell(b.anda)}${b.have ? `<div class="jp-muted">${esc(b.have.level)}</div>` : ''}</td>
                    </tr>`).join('')
                    : '<tr><td colspan="5" class="text-center jp-muted" style="padding:20px;">Tidak ada persyaratan bahasa dari industri untuk prodi Anda.</td></tr>';
            }

            function prSaranBelajar(k, a) {
                if (k.tipe === 'bahasa') return `Tingkatkan Bahasa ${k.nama} hingga minimal <strong>${esc(k.level)}</strong> (Anda: ${k.have ? esc(k.have.level) : 'belum diisi'}). Ikuti kursus atau tes kemahiran, lalu perbarui di Job Matching.`;
                if (k.ev && k.ev.mk) return `Anda sudah menempuh <strong>${esc(k.ev.mk.nama)}</strong> (nilai ${esc(k.ev.mk.nilai)}). Perdalam lewat proyek atau praktik, atau ambil sertifikasi terkait agar buktinya lebih kuat.`;
                if (k.mk.length) return `Mahasiswa prodi Anda menempuh <strong>${k.mk.slice(0, 2).map(m => esc(m.nama)).join('</strong> / <strong>')}</strong>. Ambil bila masih tersedia, atau pelajari materinya lewat kursus.`;
                return 'Belum ada mata kuliah terkait di prodi Anda. Pelajari lewat kursus/pelatihan, proyek mandiri, atau sertifikasi kompetensi (BNSP/LSP bila tersedia).';
            }
            function prNarrative(a) {
                if (!a.S.length) return `Belum ada lowongan atau kompetensi dari Jobprovider untuk ${a.prodi}. Daftar ini akan terisi setelah perusahaan mengisi Kelola Lowongan.`;
                const top = [...a.komp].sort((x, y) => y.demand - x.demand).slice(0, 3);
                let t = `Untuk **${a.prodi}**, industri paling banyak meminta ${top.map(k => `**${k.nama}** (${pc(k.demand)})`).join(', ')}.`;
                if (!a.punya) return t + '\n\nUpload transkrip nilai di Job Matching agar C-DFS bisa menunjukkan kompetensi mana yang sudah dan belum Anda miliki.';
                const nk = a.komp.length + a.langs.length;
                t += ` Dari ${nk} kompetensi dan bahasa yang diminta, Anda sudah memiliki bukti untuk **${nk - a.learn.length - a.pantau.length}**.`;
                if (a.learn.length) t += '\n\nFokus belajar berikutnya:\n' + a.learn.slice(0, 3).map(k => `- ${k.tipe === 'bahasa' ? `Bahasa ${k.nama} (min. ${k.level})` : k.nama} — diminta ${pc(k.demand)} sumber industri${k.arah === 'Naik' || k.arah === 'Baru' ? `, tren ${k.arah.toLowerCase()}` : ''}`).join('\n');
                else t += a.pantau.length ? `\n\nBelum ada kompetensi yang diminta oleh 2 sumber atau lebih yang belum Anda miliki. ${a.pantau.length} kompetensi lain baru diminta satu perusahaan; cukup dipantau.` : '\n\nSemua kompetensi yang diminta sudah didukung bukti dari data Anda. Pertahankan, dan pantau tren skill di Dashboard.';
                if (PR.demo) t += '\n\nCatatan: dihitung dari DATA CONTOH.';
                return t;
            }
            function prRenderRek(a) {
                document.getElementById('prAiText').innerHTML = jmMd(prNarrative(a));
                prSetText('prAiSource', PR.demo ? 'Ringkasan otomatis · data contoh' : 'Ringkasan otomatis');
                const kartu = (k, i) => {
                    const per = [...new Set((k.src || []).map(s => s.perusahaan))].slice(0, 3);
                    return `
                    <div class="pr-learn ${k.n < MIN_SUMBER ? 'pantau' : ''}">
                        <div class="pr-learn-no">${i + 1}</div>
                        <div class="pr-learn-body">
                            <div class="pr-learn-head">
                                <strong>${k.tipe === 'bahasa' ? `<i class="fa-solid fa-language"></i> Bahasa ${esc(k.nama)} (min. ${esc(k.level)})` : esc(k.nama)}</strong>
                                <span class="pr-learn-tags">${k.arah === 'Naik' || k.arah === 'Baru' ? `<span class="badge badge-green"><i class="fa-solid fa-arrow-trend-up"></i> Tren ${k.arah.toLowerCase()}</span>` : ''}<span class="badge badge-blue">Diminta ${k.n} dari ${a.S.length} sumber (${pc(k.demand)})</span></span>
                            </div>
                            <div class="jm-bar"><div style="width:${Math.round(k.demand)}%"></div></div>
                            <p>${a.punya ? prSaranBelajar(k, a) : (k.mk && k.mk.length ? `Mata kuliah terkait: ${k.mk.slice(0, 2).map(m => esc(m.nama)).join(', ')}.` : 'Belum ada mata kuliah terkait di prodi Anda.')}</p>
                            ${per.length ? `<span class="jp-muted"><i class="fa-solid fa-building"></i> Diminta oleh: ${per.map(esc).join(', ')}</span>` : ''}
                        </div>
                    </div>`;
                };
                const semua = [...a.komp].sort((x, y) => y.demand - x.demand).map(k => ({...k, tipe: 'kompetensi'}));
                const utama = a.punya ? a.learn : semua.filter(k => k.n >= MIN_SUMBER);
                const pantau = a.punya ? a.pantau : semua.filter(k => k.n < MIN_SUMBER);
                document.getElementById('prLearnList').innerHTML =
                    `<h3 class="pr-sec-title">${a.punya ? `Prioritas belajar: diminta ${MIN_SUMBER}+ sumber, belum terlihat di data Anda (${utama.length})` : `Kompetensi yang diminta ${MIN_SUMBER}+ sumber untuk prodi Anda`}</h3>` +
                    (utama.length ? utama.map(kartu).join('') : `<div class="jp-empty-block"><i class="fa-solid fa-circle-check"></i>${a.S.length ? (a.punya ? `Tidak ada kompetensi yang diminta ${MIN_SUMBER} sumber atau lebih yang belum Anda miliki.` : `Belum ada kompetensi yang diminta ${MIN_SUMBER} sumber atau lebih.`) : 'Belum ada lowongan untuk prodi Anda.'}</div>`) +
                    (pantau.length ? `<details class="pr-pantau"><summary><i class="fa-solid fa-eye"></i> Pantau dulu: baru diminta 1 perusahaan (${pantau.length})</summary>
                        <p class="pr-pantau-note">Belum dijadikan prioritas karena baru satu sumber yang memintanya. Akan naik ke prioritas bila diminta perusahaan lain.</p>${pantau.map(kartu).join('')}</details>` : '');
                document.getElementById('prRekList').innerHTML = a.recs.length ? a.recs.map((r, i) => `
                    <div class="pr-rek">
                        <div class="pr-rek-icon"><i class="fa-solid ${r.icon}"></i></div>
                        <div class="pr-rek-body">
                            <div class="pr-rek-head"><span class="pr-rek-type">${i + 1}. ${esc(r.jenis)}</span><span class="badge ${PRIO_BADGE[r.prio]}">Prioritas ${r.prio}</span></div>
                            <h4>${esc(r.judul)}</h4>
                            <p>${esc(r.alasan)}</p>
                            <p class="pr-rek-aksi"><i class="fa-solid fa-arrow-right"></i> ${esc(r.aksi)}</p>
                        </div>
                    </div>`).join('')
                    : `<p class="jp-muted" style="padding:12px 4px;">${a.cukup ? 'Tidak ada gap prodi ≥ 20 poin.' : `Rekomendasi kurikulum muncul bila minimal ${MIN_MHS} mahasiswa prodi sudah mengunggah transkrip.`}</p>`;
            }

            function prRenderAll() {
                const prodi = curProdi();
                document.querySelectorAll('.pr-prodi-chip').forEach(c => { c.textContent = prodi ? `${kodeProdi(prodi)} · ${prodi}` : 'Prodi belum dipilih'; });
                document.querySelectorAll('.pr-noprodi').forEach(e => e.classList.toggle('is-hidden', !!prodi));
                document.querySelectorAll('.pr-body').forEach(e => e.classList.toggle('is-hidden', !prodi));
                if (!prodi) return;
                prEnsure();
                const a = prAnalyze();
                if (!a || PR.reqProdi !== prodi) return;
                prRenderGap(a);
                prRenderRek(a);
            }
            // Gambar ulang saat halaman dibuka (grafik hanya digambar pada halaman yang terlihat)
            document.querySelectorAll('.nav-item[data-target^="view-pr-"]').forEach(n => n.addEventListener('click', () => setTimeout(prRenderAll, 0)));


            // ---------- Tren Pekerjaan & Skill (kartu pertama Dashboard Jobseeker) ----------
            // Angka: WEF Future of Jobs Report 2025, perkiraan perubahan jumlah pekerjaan 2025–2030 (dikutip Euronews, 1 Feb 2025).
            // "prodi" = pemetaan relevansi oleh tim C-DFS (silakan disesuaikan dosen prodi).
            const TRSE = 'Teknologi Rekayasa Sistem Elektronika', MP = 'Manajemen Pemasaran', MAT = 'Matematika', PAUD = 'Pendidikan Anak Usia Dini (PAUD)';
            const FS_JOBS = [
                {nama: 'Spesialis Big Data', v: 113, prodi: [MAT, MP]},
                {nama: 'Insinyur FinTech', v: 93, prodi: [MAT]},
                {nama: 'Spesialis AI & Machine Learning', v: 82, prodi: [MAT, TRSE]},
                {nama: 'Pengembang Software & Aplikasi', v: 57, prodi: [MAT, TRSE]},
                {nama: 'Spesialis Manajemen Keamanan', v: 53, prodi: [TRSE]},
                {nama: 'Spesialis Data Warehouse', v: 49, prodi: [MAT]},
                {nama: 'Spesialis Kendaraan Otonom & Listrik', v: 48, prodi: [TRSE]},
                {nama: 'Desainer UI/UX', v: 48, prodi: [MP]},
                {nama: 'Spesialis Internet of Things', v: 42, prodi: [TRSE]},
                {nama: 'Analis & Ilmuwan Data', v: 41, prodi: [MAT, MP]},
                {nama: 'Petugas Klerikal Pos', v: -34, prodi: []},
                {nama: 'Teller Bank', v: -31, prodi: [MAT]},
                {nama: 'Petugas Entri Data', v: -26, prodi: [MAT, MP, TRSE]},
                {nama: 'Kasir & Petugas Tiket', v: -20, prodi: [MP]},
                {nama: 'Asisten Administrasi & Sekretaris', v: -20, prodi: [MP, PAUD]},
                {nama: 'Pekerja Percetakan', v: -20, prodi: [MP]},
                {nama: 'Klerk Akuntansi & Penggajian', v: -18, prodi: [MAT]},
                {nama: 'Klerk Pencatatan Stok', v: -16, prodi: [TRSE]},
                {nama: 'Sales Door-to-door & Pedagang Keliling', v: -14, prodi: [MP]}
            ];
            let fsMode = null, fsPilihan = false, fsChart = null, fsKey = '';   // fsPilihan = mode dipilih sendiri oleh pengguna
            document.querySelectorAll('#fsSeg .seg-btn').forEach(b => b.addEventListener('click', () => { if (b.disabled) return; fsMode = b.dataset.mode; fsPilihan = true; fsRender(); }));
            // Label persentase di ujung batang
            const fsLabelPlugin = {
                id: 'fsLabel',
                afterDatasetsDraw(chart) {
                    const {ctx} = chart;
                    const ds = chart.data.datasets[0];
                    ctx.save();
                    ctx.font = '600 11px Inter, sans-serif';
                    ctx.textBaseline = 'middle';
                    chart.getDatasetMeta(0).data.forEach((bar, i) => {
                        const v = ds.data[i];
                        ctx.fillStyle = v >= 0 ? '#15803d' : '#b91c1c';
                        // Layar sempit: label penurunan ditulis di kanan garis 0 agar tidak menabrak nama pekerjaan
                        const kanan = v >= 0 || chart.width < 420;
                        ctx.textAlign = kanan ? 'left' : 'right';
                        const x0 = chart.scales.x.getPixelForValue(0);
                        ctx.fillText((v > 0 ? '+' : '') + v + '%', v >= 0 ? bar.x + 6 : (kanan ? x0 + 6 : bar.x - 6), bar.y);
                    });
                    ctx.restore();
                }
            };
            function fsRender() {
                const prodi = curProdi();
                const relevan = FS_JOBS.filter(j => j.prodi.includes(prodi));
                const bisaProdi = relevan.some(j => j.v > 0) && relevan.some(j => j.v < 0);
                if (!fsPilihan || (fsMode === 'prodi' && !bisaProdi)) fsMode = bisaProdi ? 'prodi' : 'global';
                document.querySelectorAll('#fsSeg .seg-btn').forEach(b => {
                    b.classList.toggle('active', b.dataset.mode === fsMode);
                    b.disabled = b.dataset.mode === 'prodi' && !bisaProdi;
                    if (b.dataset.mode === 'prodi') b.textContent = prodi ? `Prodi Saya · ${kodeProdi(prodi)}` : 'Prodi Saya';
                    b.title = b.disabled ? (prodi ? 'WEF belum merinci persentase pekerjaan untuk prodi ini' : 'Pilih program studi dahulu') : '';
                });
                const key = fsMode + '|' + prodi;
                if (key === fsKey && fsChart) return;
                fsKey = key;
                const naik = (fsMode === 'prodi' ? relevan : FS_JOBS).filter(j => j.v > 0).sort((a, b) => b.v - a.v).slice(0, 6);
                const turun = (fsMode === 'prodi' ? relevan : FS_JOBS).filter(j => j.v < 0).sort((a, b) => a.v - b.v).slice(0, 6);
                const rows = naik.concat(turun.reverse());   // tumbuh di atas, penurunan terdalam paling bawah
                document.getElementById('fsSub').textContent = fsMode === 'prodi'
                    ? `Pekerjaan terkait ${prodi}: perkiraan perubahan jumlah 2025–2030`
                    : 'Pekerjaan yang paling cepat tumbuh dan menurun di dunia: perkiraan perubahan jumlah 2025–2030';
                const box = document.getElementById('fsChartBox');
                const sempit = box.clientWidth < 560;
                // Di layar sempit nama pekerjaan dipecah menjadi beberapa baris agar tidak terpotong
                const bungkus = (t) => { if (!sempit) return t; const out = []; let cur = ''; t.split(' ').forEach(w => { if ((cur + ' ' + w).trim().length > 16) { if (cur) out.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }); if (cur) out.push(cur); return out; };
                box.style.height = (rows.length * (sempit ? 40 : 30) + 40) + 'px';
                if (fsChart) fsChart.destroy();
                const maxPos = Math.max(0, ...rows.map(r => r.v)), maxNeg = Math.max(0, ...rows.map(r => -r.v));
                fsChart = new Chart(document.getElementById('fsChart').getContext('2d'), {
                    type: 'bar',
                    data: {labels: rows.map(r => bungkus(r.nama)), datasets: [{data: rows.map(r => r.v), backgroundColor: rows.map(r => r.v >= 0 ? '#16a34a' : '#dc2626'), borderRadius: 4, barPercentage: 0.7, categoryPercentage: 0.9}]},
                    plugins: [fsLabelPlugin],
                    options: {indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: {duration: 500},
                        layout: {padding: {left: 0, right: 8}},
                        plugins: {legend: {display: false}, tooltip: {callbacks: {label: (c) => `${c.raw > 0 ? '+' : ''}${c.raw}% jumlah pekerjaan (2025–2030)`}}},
                        scales: {
                            x: {min: -Math.ceil((maxNeg + (sempit ? 4 : 18)) / 10) * 10, max: Math.ceil((maxPos + (sempit ? 40 : 22)) / 10) * 10, ticks: {stepSize: 10, autoSkip: false, maxRotation: 0, callback: (v) => v % (sempit ? 100 : 50) === 0 ? (v > 0 ? '+' : '') + v + '%' : '', font: {size: 10}}, grid: {color: (c) => c.tick.value === 0 ? '#94a3b8' : (c.tick.value % 50 === 0 ? '#f1f5f9' : 'transparent')}},
                            y: {grid: {display: false}, ticks: {font: {size: sempit ? 10.5 : 11.5}, color: '#334155', autoSkip: false}}
                        }}
                });
                document.getElementById('fsSkills').innerHTML = '<strong>Skill:</strong>' +
                    '<span class="fs-chip up">AI &amp; Big Data +87%</span><span class="fs-chip up">Jaringan &amp; Keamanan Siber +70%</span><span class="fs-chip up">Literasi Teknologi +68%</span>' +
                    '<span class="fs-chip down">Ketangkasan Manual &amp; Presisi: 24% pemberi kerja memperkirakan menurun</span>';
                document.getElementById('fsSrc').innerHTML = 'Sumber: WEF <em>Future of Jobs Report 2025</em>. Persentase pekerjaan = perkiraan perubahan jumlah pekerjaan 2025–2030; persentase skill = selisih pemberi kerja yang memperkirakan naik dikurangi yang memperkirakan turun. ' +
                    'WEF memproyeksikan sampai 2030; arah sesudahnya hingga 10 tahun ke depan diperkirakan berlanjut, bukan angka pasti.' +
                    (fsMode === 'prodi' ? ' Pemetaan ke prodi disusun tim C-DFS.' : (prodi === PAUD ? ' WEF belum merinci persentase untuk guru PAUD; guru termasuk pekerjaan yang jumlahnya bertambah paling banyak.' : '')) +
                    (prodi ? ' <a href="#" class="js-goto" data-goto="view-pr-rekomendasi">Lihat kompetensi yang perlu Anda pelajari &rarr;</a>' : '');
            }

            // Kartu ringkas di Dashboard
            function jsRenderLearnCard() {
                const box = document.getElementById('jsLearnCard');
                if (!box) return;
                const a = curProdi() && PR.reqProdi === curProdi() ? prAnalyze() : null;
                if (!a || !a.S.length) { box.classList.add('is-hidden'); return; }
                box.classList.remove('is-hidden');
                const list = a.punya ? a.learn.slice(0, 3) : [...a.komp].filter(k => k.n >= MIN_SUMBER).sort((x, y) => y.demand - x.demand).slice(0, 3);
                box.innerHTML = `
                    <div class="card-header-flex"><h3 class="card-title"><i class="fa-solid fa-book-open-reader text-blue"></i> ${a.punya ? 'Kompetensi yang Perlu Anda Pelajari' : 'Kompetensi Paling Diminta untuk Prodi Anda'}</h3>
                        <button class="btn-outline-blue js-goto" data-goto="view-pr-rekomendasi" style="margin:0;">Lihat Semua <i class="fa-solid fa-arrow-right"></i></button></div>
                    ${list.length ? `<div class="js-learn">${list.map(k => `
                        <div class="js-learn-item"><strong>${k.tipe === 'bahasa' ? `Bahasa ${esc(k.nama)} (min. ${esc(k.level)})` : esc(k.nama)}</strong>
                            <span class="jp-muted">diminta ${pc(k.demand)} lowongan/perusahaan${k.arah === 'Naik' || k.arah === 'Baru' ? ` · tren ${k.arah.toLowerCase()}` : ''}</span>
                            <div class="jm-bar"><div style="width:${Math.round(k.demand)}%"></div></div></div>`).join('')}</div>`
                    : `<p class="jp-muted"><i class="fa-solid fa-circle-check" style="color:#16a34a"></i> Tidak ada kompetensi prioritas (diminta ${MIN_SUMBER}+ sumber) yang belum Anda miliki.${a.pantau && a.pantau.length ? ` ${a.pantau.length} kompetensi lain baru diminta 1 perusahaan.` : ''}</p>`}`;
            }

            // ==============================================================
            // 11. INISIALISASI
            // ==============================================================
            showLanding();

            if (window.location.search.includes('dashboard')) {
                showDashboard();
            }

            if (window.location.search.includes('login')) {
                showAuth();
                setMode('login');
            }

        });
