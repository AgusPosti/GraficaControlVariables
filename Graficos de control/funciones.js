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
        const response = await fetch(`${API_BASE_URL}${casoId}`, {
            cache: 'no-store'
        });
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

    const media = Number(dataObj.media);
    const lsc = Number(dataObj.lsc);
    const lic = Number(dataObj.lic);
    const valores = dataObj.valores;

    const labels = valores.map(v => `T: ${v.x}`);
    const valuesY = valores.map(v => Number(v.y));

    // Distancia de la media a cada límite.
    // Los límites de control representan aproximadamente 3 sigma.
    const sigmaSuperior = (lsc - media) / 3;
    const sigmaInferior = (media - lic) / 3;

    // Límites de 2 sigma
    const lsc2sigma = media + (2 * sigmaSuperior);
    const lic2sigma = media - (2 * sigmaInferior);

    // Límites de 1 sigma
    const lsc1sigma = media + sigmaSuperior;
    const lic1sigma = media - sigmaInferior;

    // ------------------------------------------------
    // COMPROBAR TODAS LAS REGLAS
    // ------------------------------------------------

    // Regla 1:
    // Un punto fuera de los límites de control
    const regla1 = valuesY.some(
        y => y > lsc || y < lic
    );

    // Regla 2:
    // 2 de 3 puntos más allá de 2 sigma
    const regla2 = checkRule2Of3(
        valuesY,
        lsc2sigma,
        lic2sigma
    );

    // Regla 3:
    // 4 de 5 puntos más allá de 1 sigma
    const regla3 = checkRule4Of5(
        valuesY,
        lsc1sigma,
        lic1sigma
    );

    // Regla 4:
    // 8 puntos consecutivos del mismo lado de la media
    const regla4 = checkRule8Consecutive(
        valuesY,
        media
    );

    // mensajes

    let isAnomaly = false;
    let alertMessage = "";

    // Regla 1: realmente hay puntos fuera de los límites
    if (regla1) {

        isAnomaly = true;

        alertMessage =
            "¡Alerta! El proceso se encuentra fuera de los límites de control. " +
            "Se detectaron uno o más puntos por encima del LSC o por debajo del LIC.";

    }

    // Regla 2: patrón de 2 de 3
    else if (regla2) {

        isAnomaly = true;

        alertMessage =
            "¡Alerta preventiva! Se detectaron 2 de 3 puntos consecutivos " +
            "más allá de 2-sigma del mismo lado.";

    }

    // Regla 3: patrón de 4 de 5
    else if (regla3) {

        isAnomaly = true;

    alertMessage =
        "¡Alerta preventiva! Se detectaron 4 de 5 puntos consecutivos " +
        "más allá de 1-sigma del mismo lado.";

    }

    // Regla 4: 8 consecutivos del mismo lado
    else if (regla4) {

        isAnomaly = true;

        alertMessage =
            "¡Alerta preventiva! Se detectaron 8 puntos consecutivos " +
            "del mismo lado de la línea central.";

    }

    // Ninguna regla detectada
    else {

        isAnomaly = false;

        alertMessage =
            `Caso ${casoId}: el proceso se encuentra bajo control.`;
    }

    // Mostrar resultado
    updateAlertUI(alertMessage, isAnomaly);

    // Líneas del gráfico
    const mediaArray =
        new Array(valores.length).fill(media);

    const lscArray =
        new Array(valores.length).fill(lsc);

    const licArray =
        new Array(valores.length).fill(lic);

    renderChart(
        labels,
        valuesY,
        mediaArray,
        lscArray,
        licArray
    );
}

// Funciones de validación de reglas estadísticas
function checkRule2Of3(values, lsc2, lic2) {
    if (values.length < 3) return false;

    for (let i = 0; i <= values.length - 3; i++) {

        const sub = values.slice(i, i + 3);

        const aboveCount = sub.filter(y => y > lsc2).length;
        const belowCount = sub.filter(y => y < lic2).length;

        if (aboveCount >= 2 || belowCount >= 2) {
            return true;
        }
    }

    return false;
}

function checkRule4Of5(values, lsc1, lic1) {
    if (values.length < 5) return false;

    for (let i = 0; i <= values.length - 5; i++) {

        const sub = values.slice(i, i + 5);

        const aboveCount = sub.filter(y => y > lsc1).length;
        const belowCount = sub.filter(y => y < lic1).length;

        if (aboveCount >= 4 || belowCount >= 4) {
            return true;
        }
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

    alertContainer.classList.remove(
        'hidden',
        'danger',
        'success'
    );

    if (isDanger) {
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