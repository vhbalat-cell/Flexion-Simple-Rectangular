// Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js')
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
    
    let ka;
    if (mn < 0 || (1 - 2 * mn) < 0) {
        ka = 1.1;
    } else {
       ka = 1 - Math.sqrt(1 - 2 * mn);
    }
     
    const ka_max = 0.375 * beta1;

    // --- LÓGICA DE DIMENSIONAMIENTO Y PRESENTACIÓN MEJORADA ---
    if (ka <= ka_max) {
        const As_calc = (f_star_c * (bw * 100) * (ka * d * 100)) / fy;
        const a_calc = (As_calc * 100 * fy) / (f_star_c * (bw * 1000)); // 'a' en metros
        const c_calc = a_calc / beta1;
        const epsilon_s_calc = c_calc > 0 ? 0.003 * (d - c_calc) / c_calc : Infinity;
        
        let results = {
            "Armadura de Cálculo (As)": `${As_calc.toFixed(2)} cm²`,
            "Armadura Compresión (A's)": "0.00 cm²",
            "--- Detalles Físicos (s/cálculo) ---": "",
            "Eje Neutro (c)": `${c_calc.toFixed(3)} m`,
            "Deformación Traccionada (εs)": epsilon_s_calc.toFixed(5),
        };

        const As_min = (fc <= 31.36) ? (1.4 * bw * 100 * d * 100) / fy : (Math.sqrt(fc) * bw * 100 * d * 100) / (4 * fy);
        if (As_calc < As_min) {
            const As_4_3 = (4/3) * As_calc;
            const As_final = Math.min(As_min, As_4_3);
            results["--- Prescripción Reglamentaria ---"] = "";
            results["As Mínima (s/norma)"] = `${As_min.toFixed(2)} cm²`;
            results["As (4/3 del cálculo)"] = `${As_4_3.toFixed(2)} cm²`;
            results["ARMADURA ADOPTADA (menor)"] = `${As_final.toFixed(2)} cm²`;
        }
        
        return results;

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
        
        const Cc_N = f_star_c * (bw * 1000) * a * 1000;
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
    
    const Es = 200000.0;
    const beta1 = fc <= 30 ? 0.85 : Math.max(0.65, 0.85 - 0.05 * (fc - 30) / 7);
    const f_star_c = 0.85 * fc;
    const epsilon_y = fy / Es;

    let As_to_use_cm2 = as_cm2;
    let comentario_minima = "";
    
    const As_min = (fc <= 31.36) ? (1.4 * bw * 100 * d * 100) / fy : (Math.sqrt(fc) * bw * 100 * d * 100) / (4 * fy);
    if (as_cm2 < As_min) {
        As_to_use_cm2 = 0.75 * as_cm2;
        comentario_minima = `ADVERTENCIA: As < As,min (${As_min.toFixed(2)} cm²). Capacidad calculada con 3/4 As.`;
    }

    const As = As_to_use_cm