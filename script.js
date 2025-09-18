// Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(reg => console.log('Service worker registered.'))
            .catch(err => console.log('Service worker registration failed: ', err));
    });
}

// DOM Elements
const modeRadios = document.querySelectorAll('input[name="mode"]');
const solicitacionGroup = document.getElementById('solicitacion-group');
const armadurasGroup = document.getElementById('armaduras-group');
const calculateBtn = document.getElementById('calculate-btn');
const resultsOutput = document.getElementById('results-output');

// Mode Selector Logic
modeRadios.forEach(radio => {
    radio.addEventListener('change', (event) => {
        if (event.target.value === 'dimensionamiento') {
            solicitacionGroup.classList.remove('hidden');
            armadurasGroup.classList.add('hidden');
        } else {
            solicitacionGroup.classList.add('hidden');
            armadurasGroup.classList.remove('hidden');
        }
    });
});

// Calculation Logic
calculateBtn.addEventListener('click', () => {
    const mode = document.querySelector('input[name="mode"]:checked').value;
    
    // Get shared inputs
    const fc = parseFloat(document.getElementById('fc').value);
    const fy = parseFloat(document.getElementById('fy').value);
    const bw = parseFloat(document.getElementById('bw').value);
    const h = parseFloat(document.getElementById('h').value);
    const rec_t = parseFloat(document.getElementById('rec_t').value);
    const rec_c = parseFloat(document.getElementById('rec_c').value);

    let results;
    if (mode === 'dimensionamiento') {
        const mu = parseFloat(document.getElementById('mu').value);
        results = dimensionar(fc, fy, bw, h, rec_t, rec_c, mu);
    } else {
        const as = parseFloat(document.getElementById('as').value);
        const as_prime = parseFloat(document.getElementById('as_prime').value);
        results = verificar(fc, fy, bw, h, as, as_prime, rec_t, rec_c);
    }
    
    displayResults(results);
});


function dimensionar(fc, fy, bw, h, rec_t, d_prime, mu) {
    const d = h - rec_t;
    if (d <= d_prime) return { error: "Altura útil 'd' debe ser mayor que rec. compresión 'd_prime'." };
    
    const phi = 0.90;
    const Es = 200000.0;
    const beta1 = fc <= 30 ? 0.85 : Math.max(0.65, 0.85 - 0.05 * (fc - 30) / 7);
    const f_star_c = 0.85 * fc;

    const mn_req = mu / phi;
    const f_star_c_kpa = f_star_c * 1000;
    
    const mn = mn_req / (f_star_c_kpa * bw * d ** 2);
    
    if ((1 - 2 * mn) < 0) { // Will require compression steel
        const ka = 1.1; // Force condition for double reinforcement
    } else {
       const ka = 1 - Math.sqrt(1 - 2 * mn);
    }
     
    const ka_max = 0.375 * beta1;

    if (ka <= ka_max) {
        const As = (f_star_c * (bw * 100) * (ka * d * 100)) / fy;
        const a = ka * d;
        const c = a / beta1;
        const epsilon_s = c > 0 ? 0.003 * (d - c) / c : Infinity;
        return {
            "Armadura Tracción (As)": `${As.toFixed(2)} cm²`,
            "Armadura Compresión (A's)": "0.00 cm²",
            "--- Detalles ---": "",
            "Eje Neutro (c)": `${c.toFixed(3)} m`,
            "Deformación Traccionada (εs)": epsilon_s.toFixed(5),
            "Comentario": "Sección con armadura simple."
        };
    } else {
        const c = 0.375 * d;
        const a = beta1 * c;
        const epsilon_s = 0.005;
        const Mc = (f_star_c_kpa * bw * a) * (d - a / 2);
        const delta_Mn = mn_req - Mc;

        if (delta_Mn < 0) return { error: "Error: Momento excedente negativo." };

        const epsilon_prime_s = c > 0 ? 0.003 * (c - d_prime) / c : 0;
        const f_prime_s = Math.min(fy, epsilon_prime_s * Es);
        
        if (f_prime_s <= 0) return { error: "Armadura de compresión no trabaja." };
        
        const A_prime_s_m2 = delta_Mn / (f_prime_s * 1000 * (d - d_prime));
        const A_prime_s = A_prime_s_m2 * 10000;
        
        const Cc_N = f_star_c * (bw * 1000) * a;
        const C_prime_s_N = A_prime_s_m2 * f_prime_s * 1e6;
        const As_m2 = (Cc_N + C_prime_s_N) / (fy * 1e6);
        const As = As_m2 * 10000;

        return {
            "Armadura Tracción (As)": `${As.toFixed(2)} cm²`,
            "Armadura Compresión (A's)": `${A_prime_s.toFixed(2)} cm²`,
            "--- Detalles ---": "",
            "Eje Neutro (c)": `${c.toFixed(3)} m`,
            "Deformación Traccionada (εs)": epsilon_s.toFixed(5),
            "Deformación Comprimida (ε's)": epsilon_prime_s.toFixed(5),
            "Tensión Comprimida (f's)": `${f_prime_s.toFixed(1)} MPa`,
            "Comentario": "Requiere armadura de compresión."
        };
    }
}

function verificar(fc, fy, bw, h, as_cm2, as_prime_cm2, rec_t, d_prime) {
    const d = h - rec_t;
    if (d <= d_prime) return { error: "Altura útil 'd' debe ser mayor que rec. compresión 'd_prime'." };
    
    const As = as_cm2 / 10000;
    const A_prime_s = as_prime_cm2 / 10000;
    const Es = 200000.0;
    const beta1 = fc <= 30 ? 0.85 : Math.max(0.65, 0.85 - 0.05 * (fc - 30) / 7);
    const f_star_c = 0.85 * fc;
    const epsilon_y = fy / Es;

    let c, f_prime_s;

    const c_hip1 = ((As - A_prime_s) * fy) / (f_star_c * bw * beta1);
    const eps_prime_s_hip1 = c_hip1 > 0 ? 0.003 * (c_hip1 - d_prime) / c_hip1 : -Infinity;

    if (eps_prime_s_hip1 >= epsilon_y) {
        c = c_hip1;
        f_prime_s = fy;
    } else {
        const A_coeff = f_star_c * bw * beta1;
        const B_coeff = A_prime_s * Es * 0.003 - As * fy;
        const C_coeff = -A_prime_s * Es * 0.003 * d_prime;
        const discriminant = B_coeff ** 2 - 4 * A_coeff * C_coeff;
        if (discriminant < 0) return { error: "Error: Discriminante negativo." };
        c = (-B_coeff + Math.sqrt(discriminant)) / (2 * A_coeff);
        const eps_prime_s = c > 0 ? 0.003 * (c - d_prime) / c : 0;
        f_prime_s = eps_prime_s * Es;
    }

    const a = beta1 * c;
    const epsilon_s = c > 0 ? 0.003 * (d - c) / c : Infinity;
    
    let phi;
    if (epsilon_s >= 0.005) {
        phi = 0.90;
    } else if (epsilon_s > epsilon_y) {
        phi = 0.65 + 0.25 * (epsilon_s - epsilon_y) / (0.005 - epsilon_y);
    } else {
        phi = 0.65;
    }
    
    const Cc_kN = (f_star_c * 1000 * bw * a);
    const C_prime_s_kN = (A_prime_s * f_prime_s * 1000);
    
    const Mn_c = Cc_kN * (d - a / 2);
    const Mn_s = C_prime_s_kN * (d - d_prime);
    const Mn = Mn_c + Mn_s;
    const phi_Mn = phi * Mn;

    return {
        "Capacidad de Diseño (ΦMn)": `${phi_Mn.toFixed(2)} kNm`,
        "--- Detalles ---": "",
        "Momento Nominal (Mn)": `${Mn.toFixed(2)} kNm`,
        "Factor de Reducción (Φ)": phi.toFixed(2),
        "Eje Neutro (c)": `${c.toFixed(3)} m`,
        "Deformación Traccionada (εs)": epsilon_s.toFixed(5),
        "Deformación Comprimida (ε's)": (f_prime_s / Es).toFixed(5),
        "Tensión Comprimida (f's)": `${f_prime_s.toFixed(1)} MPa`
    };
}

function displayResults(results) {
    let output = "";
    for (const key in results) {
        output += `${key.padEnd(30, ' ')} ${results[key]}\n`;
    }
    resultsOutput.textContent = output;
}

// Initial setup to match radio button
document.querySelector('input[name="mode"]:checked').dispatchEvent(new Event('change'));