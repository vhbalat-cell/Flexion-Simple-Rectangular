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