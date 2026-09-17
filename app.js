let logs = JSON.parse(localStorage.getItem('health_logs')) || [];

const peeBtn = document.getElementById('peeBtn');
const waterBtn = document.getElementById('waterBtn');
const waterAmountInput = document.getElementById('waterAmount');
const noteInput = document.getElementById('noteInput');
const todayPeeCount = document.getElementById('todayPeeCount');
const todayWaterAmount = document.getElementById('todayWaterAmount');
const logList = document.getElementById('logList');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const exportPdfBtn = document.getElementById('exportPdfBtn');

function getSelectedSymptoms() {
    const checkboxes = document.querySelectorAll('.symptom-check:checked');
    const symptoms = Array.from(checkboxes).map(cb => cb.value);
    checkboxes.forEach(cb => cb.checked = false);
    return symptoms;
}

function addLog(type, amount = null) {
    const symptoms = getSelectedSymptoms();
    const note = noteInput.value.trim();
    const newLog = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        type: type,
        amount: amount,
        symptoms: symptoms,
        note: note
    };
    logs.unshift(newLog);
    saveAndRender();
    noteInput.value = '';
}

function deleteLog(id) {
    logs = logs.filter(log => log.id !== id);
    saveAndRender();
}

function saveAndRender() {
    localStorage.setItem('health_logs', JSON.stringify(logs));
    updateSummary();
    renderLogs();
}

function updateSummary() {
    const today = new Date().toDateString();
    const todayLogs = logs.filter(log => new Date(log.timestamp).toDateString() === today);
    const peeCount = todayLogs.filter(log => log.type === 'pee').length;
    const waterTotal = todayLogs.filter(log => log.type === 'water').reduce((sum, log) => sum + (log.amount || 0), 0);
    todayPeeCount.textContent = peeCount;
    todayWaterAmount.textContent = waterTotal;
}

function renderLogs() {
    logList.innerHTML = '';
    logs.slice(0, 30).forEach(log => {
        const date = new Date(log.timestamp);
        const timeStr = date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
        const dateStr = date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
        const li = document.createElement('li');
        li.className = 'log-item';
        let details = log.type === 'pee' ? '🚽 ปัสสาวะ' : `💧 ดื่มน้ำ ${log.amount} ml`;
        let extraInfo = [...log.symptoms, log.note].filter(Boolean).join(', ');
        li.innerHTML = `
            <div>
                <strong>${details}</strong> ${extraInfo ? `<small>(${extraInfo})</small>` : ''}
                <div class="time">${dateStr} - ${timeStr} น.</div>
            </div>
            <button class="delete-btn" onclick="deleteLog(${log.id})">🗑️</button>
        `;
        logList.appendChild(li);
    });
}

function exportCSV() {
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += "วัน-เวลา,ประเภท,ปริมาณ(ml),อาการเสริม,บันทึกเพิ่มเติม\n";
    logs.forEach(log => {
        const date = new Date(log.timestamp).toLocaleString('th-TH');
        const type = log.type === 'pee' ? 'ปัสสาวะ' : 'ดื่มน้ำ';
        const amount = log.amount || '';
        const symptoms = `"${log.symptoms.join(', ')}"`;
        const note = `"${log.note || ''}"`;
        csvContent += `${date},${type},${amount},${symptoms},${note}\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `health_log_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function exportPDF() {
    const pdfTemplate = document.getElementById('pdfTemplate');
    const pdfTableBody = document.getElementById('pdfTableBody');
    const pdfSummary = document.getElementById('pdfSummary');
    const pdfDateRange = document.getElementById('pdfDateRange');
    pdfTableBody.innerHTML = '';
    pdfDateRange.textContent = `ข้อมูล ณ วันที่: ${new Date().toLocaleDateString('th-TH')}`;
    const totalPee = logs.filter(l => l.type === 'pee').length;
    const totalWater = logs.filter(l => l.type === 'water').reduce((a, b) => a + (b.amount || 0), 0);
    pdfSummary.innerHTML = `<p><strong>สรุปรวมทั้งหมด:</strong> ปัสสาวะ ${totalPee} ครั้ง | ดื่มน้ำรวม ${totalWater} ml</p><br>`;
    logs.forEach(log => {
        const date = new Date(log.timestamp).toLocaleString('th-TH');
        const type = log.type === 'pee' ? 'ปัสสาวะ' : 'ดื่มน้ำ';
        const amount = log.amount ? `${log.amount} ml` : '-';
        const extra = [...log.symptoms, log.note].filter(Boolean).join(' | ');
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${date}</td>
            <td>${type}</td>
            <td>${amount}</td>
            <td>${extra || '-'}</td>
        `;
        pdfTableBody.appendChild(tr);
    });
    pdfTemplate.style.display = 'block';
    const opt = {
        margin: 10,
        filename: `รายงานสุขภาพ_${new Date().toISOString().slice(0,10)}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(pdfTemplate).save().then(() => {
        pdfTemplate.style.display = 'none';
    });
}

peeBtn.addEventListener('click', () => addLog('pee'));
waterBtn.addEventListener('click', () => {
    const amount = parseInt(waterAmountInput.value) || 250;
    addLog('water', amount);
});
exportCsvBtn.addEventListener('click', exportCSV);
exportPdfBtn.addEventListener('click', exportPDF);

saveAndRender();

