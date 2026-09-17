let logs = JSON.parse(localStorage.getItem('glass_health_logs')) || [];
let activeSymptoms = [];

// Elements
const liveClock = document.getElementById('liveClock');
const peeCountEl = document.getElementById('peeCount');
const waterCountEl = document.getElementById('waterCount');
const logHistoryEl = document.getElementById('logHistory');
const eventNoteEl = document.getElementById('eventNote');

// Real-time Clock Update
function updateClock() {
    const now = new Date();
    liveClock.textContent = now.toLocaleString('th-TH', { 
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit' 
    }) + ' น.';
}
setInterval(updateClock, 1000);
updateClock();

// Toggle Symptom Badges
document.querySelectorAll('.badge-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const val = btn.getAttribute('data-symptom');
        if (activeSymptoms.includes(val)) {
            activeSymptoms = activeSymptoms.filter(s => s !== val);
            btn.classList.remove('active');
        } else {
            activeSymptoms.push(val);
            btn.classList.add('active');
        }
    });
});

// Add Logs
function addLog(type, details = '') {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' น.';
    const dateStr = now.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
    
    const newEntry = {
        id: Date.now(),
        timestamp: now.toISOString(),
        formattedTime: `${dateStr} - ${timeStr}`,
        type: type,
        symptoms: [...activeSymptoms],
        note: details
    };

    logs.unshift(newEntry);
    resetForm();
    saveAndRender();
}

function resetForm() {
    activeSymptoms = [];
    document.querySelectorAll('.badge-btn').forEach(b => b.classList.remove('active'));
    eventNoteEl.value = '';
}

// Subtract/Cancel Last Entry with Confirmation
function subtractLog(type) {
    const lastIndex = logs.findIndex(log => log.type === type);
    if (lastIndex !== -1) {
        const item = logs[lastIndex];
        if (confirm(`คุณต้องการยกเลิกบันทึก ${type === 'pee' ? 'ปัสสาวะ' : 'ดื่มน้ำ'} ล่าสุดของเวลา [${item.formattedTime}] ใช่หรือไม่?`)) {
            logs.splice(lastIndex, 1);
            saveAndRender();
        }
    } else {
        alert('ไม่มีรายการให้ยกเลิกครับ');
    }
}

// Delete Specific Log Item with Confirmation
function deleteLog(id) {
    const target = logs.find(l => l.id === id);
    if (target && confirm(`ยืนยันลบรายการเวลา [${target.formattedTime}] นี้ใช่หรือไม่?`)) {
        logs = logs.filter(l => l.id !== id);
        saveAndRender();
    }
}

// Save & Update UI
function saveAndRender() {
    localStorage.setItem('glass_health_logs', JSON.stringify(logs));
    updateCounters();
    renderHistory();
}

function updateCounters() {
    const today = new Date().toDateString();
    const todayLogs = logs.filter(l => new Date(l.timestamp).toDateString() === today);
    
    peeCountEl.textContent = todayLogs.filter(l => l.type === 'pee').length;
    waterCountEl.textContent = todayLogs.filter(l => l.type === 'water').length;
}

function renderHistory() {
    logHistoryEl.innerHTML = '';
    logs.forEach(log => {
        const item = document.createElement('div');
        item.className = `history-item ${log.type}`;
        
        let title = log.type === 'pee' ? '🚽 บันทึกปัสสาวะ' : (log.type === 'water' ? '💧 บันทึกดื่มน้ำ/จิบน้ำ' : '📝 บันทึกอาการ');
        let extra = [...log.symptoms, log.note].filter(Boolean).join(' | ');

        item.innerHTML = `
            <div class="history-info">
                <strong>${title}</strong>
                <small>⏱️ ${log.formattedTime} ${extra ? `<br>💬 ${extra}` : ''}</small>
            </div>
            <button class="delete-item-btn" onclick="deleteLog(${log.id})">🗑️</button>
        `;
        logHistoryEl.appendChild(item);
    });
}

// Event Listeners
document.getElementById('addPeeBtn').addEventListener('click', () => addLog('pee'));
document.getElementById('addWaterBtn').addEventListener('click', () => addLog('water'));
document.getElementById('subPeeBtn').addEventListener('click', () => subtractLog('pee'));
document.getElementById('subWaterBtn').addEventListener('click', () => subtractLog('water'));

document.getElementById('saveNoteBtn').addEventListener('click', () => {
    const noteText = eventNoteEl.value.trim();
    if (activeSymptoms.length === 0 && !noteText) {
        alert('กรุณากดเลือกอาการหรือพิมพ์ข้อความก่อนบันทึกครับ');
        return;
    }
    addLog('note', noteText);
});

// CSV Export
document.getElementById('exportCsvBtn').addEventListener('click', () => {
    let csv = "data:text/csv;charset=utf-8,\uFEFFวัน-เวลา,รายการ,อาการ/เหตุการณ์\n";
    logs.forEach(l => {
        let typeStr = l.type === 'pee' ? 'ปัสสาวะ' : (l.type === 'water' ? 'ดื่มน้ำ' : 'บันทึกอาการ');
        let extra = [...l.symptoms, l.note].filter(Boolean).join(' ');
        csv += `"${l.formattedTime}","${typeStr}","${extra}"\n`;
    });
    const link = document.createElement('a');
    link.href = encodeURI(csv);
    link.download = `Health_Log_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
});

// PDF Export
document.getElementById('exportPdfBtn').addEventListener('click', () => {
    const template = document.getElementById('pdfTemplate');
    const tbody = document.getElementById('pdfTableBody');
    const summary = document.getElementById('pdfSummary');
    
    document.getElementById('pdfDateRange').textContent = `รายงานข้อมูล ณ วันที่: ${new Date().toLocaleDateString('th-TH')}`;
    tbody.innerHTML = '';
    
    logs.forEach(l => {
        let typeStr = l.type === 'pee' ? 'ปัสสาวะ' : (l.type === 'water' ? 'ดื่มน้ำ' : 'บันทึกอาการ');
        let extra = [...l.symptoms, l.note].filter(Boolean).join(' | ');
        tbody.innerHTML += `<tr><td>${l.formattedTime}</td><td>${typeStr}</td><td>${extra || '-'}</td></tr>`;
    });

    template.style.display = 'block';
    html2pdf().set({
        margin: 10,
        filename: `รายงานสุขภาพ_${new Date().toISOString().slice(0,10)}.pdf`,
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }).from(template).save().then(() => {
        template.style.display = 'none';
    });
});

saveAndRender();
