const selectCaso = document.getElementById('caseSelect');
const alertContainer = document.getElementById('alertContainer');
let myChart = null;

// URL base de la API
const API_BASE_URL = 'https://apidemo.geoeducacion.com.ar/api/testing/control/';

// Evento al cambiar de opción en el selector
selectCaso.addEventListener('change', (e) => {
    fetchDataAndRender(e.target.value);
});

// Cargar por defecto el caso inicial seleccionado
document.addEventListener('DOMContentLoaded', () => {
    fetchDataAndRender(selectCaso.value);
});

async function fetchDataAndRender(casoId) {
    try {
        const response = await fetch(`${API_BASE_URL}${casoId}`);
        const result = await response.json();

        if (result.success && result.data && result.data.length > 0) {
            const dataObj = result.data[0];
            processAndRenderChart(dataObj, parseInt(casoId));
        } else {
            showError("No se pudieron obtener los datos de la API.");
        }
    } catch (error) {
        console.error("Error en la petición:", error);
        showError("Error de conexión al intentar consumir la API.");
    }
}

function processAndRenderChart(dataObj, casoId) {
    const { media, lsc, lic, valores } = dataObj;
    
    const labels = valores.map(v => `T: ${v.x}`);
    const valuesY = valores.map(v => v.y);

    // Cálculo de límites Sigma para las reglas de análisis
    // Desviación estándar aproximada dividiendo el rango (LSC - Media) entre 3
    const sigma = (lsc - media) / 3;
    const lsc2sigma = media + (2 * sigma);
    const lic2sigma = media - (2 * sigma);
    const lsc1sigma = media + (1 * sigma);
    const lic1sigma = media - (1 * sigma);

    // Análisis de anomalías y alertas según el requerimiento del caso
    let alertMessage = "";
    let isAnomaly = false;

    switch (casoId) {
        case 1:
            // Caso 1: Fuera de control (Puntos fuera de LSC o LIC)
            const fueraControl = valuesY.some(y => y > lsc || y < lic);
            if (fueraControl) {
                isAnomaly = true;
                alertMessage = "¡Alerta! Se detectaron puntos fuera de los Límites de Control (LSC / LIC). Situación fuera de control.";
            }
            break;
        case 2:
            // Caso 2: Normal
            isAnomaly = false;
            alertMessage = "El proceso se encuentra dentro de parámetros normales.";
            break;
        case 3:
            // Caso 3: 2 de 3 puntos consecutivos fuera de 2-sigma (del mismo lado)
            isAnomaly = checkRule2Of3(valuesY, lsc2sigma, lic2sigma, media);
            if (isAnomaly) {
                alertMessage = "¡Alerta preventiva! Se detectaron 2 de 3 puntos consecutivos más allá de 2-sigma.";
            } else {
                alertMessage = "Proceso estable bajo los parámetros del Caso 3.";
            }
            break;
        case 4:
            // Caso 4: 4 de 5 puntos consecutivos más allá de 1-sigma
            isAnomaly = checkRule4Of5(valuesY, lsc1sigma, lic1sigma, media);
            if (isAnomaly) {
                alertMessage = "¡Alerta preventiva! Se detectaron 4 de 5 puntos consecutivos más allá de 1-sigma.";
            } else {
                alertMessage = "Proceso estable bajo los parámetros del Caso 4.";
            }
            break;
        case 5:
            // Caso 5: 8 puntos consecutivos del mismo lado de la línea central
            isAnomaly = checkRule8Consecutive(valuesY, media);
            if (isAnomaly) {
                alertMessage = "¡Alerta preventiva! Se detectaron 8 puntos consecutivos del mismo lado de la línea central (Media).";
            } else {
                alertMessage = "Proceso estable bajo los parámetros del Caso 5.";
            }
            break;
        default:
            alertMessage = "";
    }

    // Actualizar Alerta en pantalla
    updateAlertUI(alertMessage, isAnomaly);

    // Preparar líneas de referencia constantes para la gráfica
    const mediaArray = new Array(valores.length).fill(media);
    const lscArray = new Array(valores.length).fill(lsc);
    const licArray = new Array(valores.length).fill(lic);

    // Renderizar o actualizar gráfico con Chart.js
    renderChart(labels, valuesY, mediaArray, lscArray, licArray);
}

// Funciones de validación de reglas estadísticas
function checkRule2Of3(values, lsc2, lic2, media) {
    if (values.length < 3) return false;
    for (let i = 0; i <= values.length - 3; i++) {
        const sub = values.slice(i, i + 3);
        const aboveCount = sub.filter(y => y > lsc2).length;
        const belowCount = sub.filter(y => y < lic2).length;
        if (aboveCount >= 2 || belowCount >= 2) return true;
    }
    return false;
}

function checkRule4Of5(values, lsc1, lic1, media) {
    if (values.length < 5) return false;
    for (let i = 0; i <= values.length - 5; i++) {
        const sub = values.slice(i, i + 5);
        const aboveCount = sub.filter(y => y > lsc1).length;
        const belowCount = sub.filter(y => y < lic1).length;
        if (aboveCount >= 4 || belowCount >= 4) return true;
    }
    return false;
}

function checkRule8Consecutive(values, media) {
    if (values.length < 8) return false;
    let countAbove = 0;
    let countBelow = 0;
    for (let y of values) {
        if (y > media) {
            countAbove++;
            countBelow = 0;
        } else if (y < media) {
            countBelow++;
            countAbove = 0;
        } else {
            countAbove = 0;
            countBelow = 0;
        }
        if (countAbove >= 8 || countBelow >= 8) return true;
    }
    return false;
}

function updateAlertUI(message, isDanger) {
    alertContainer.textContent = message;
    alertContainer.classList.remove('hidden', 'danger', 'success');
    if (isDanger && message.includes("Alerta")) {
        alertContainer.classList.add('danger');
    } else {
        alertContainer.classList.add('success');
    }
}

function renderChart(labels, dataY, media, lsc, lic) {
    const ctx = document.getElementById('controlChart').getContext('2d');

    if (myChart) {
        myChart.destroy(); // Destruye el gráfico anterior para evitar superposiciones
    }

    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Valores de la Variable (Y)',
                    data: dataY,
                    borderColor: '#2563eb',
                    backgroundColor: '#2563eb',
                    borderWidth: 2,
                    pointRadius: 4,
                    tension: 0.1
                },
                {
                    label: 'LSC (Límite Superior)',
                    data: lsc,
                    borderColor: '#ef4444',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    fill: false
                },
                {
                    label: 'Media (Línea Central)',
                    data: media,
                    borderColor: '#10b981',
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: false
                },
                {
                    label: 'LIC (Límite Inferior)',
                    data: lic,
                    borderColor: '#ef4444',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: false
                }
            }
        }
    });
}

function showError(msg) {
    alertContainer.textContent = msg;
    alertContainer.classList.remove('hidden', 'success');
    alertContainer.classList.add('danger');
}