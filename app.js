let logs = JSON.parse(localStorage.getItem('glass_health_logs')) || [];
let activeSymptoms = [];

const liveClock = document.getElementById('liveClock');
const peeCountEl = document.getElementById('peeCount');
const waterCountEl = document.getElementById('waterCount');
const logHistoryEl = document.getElementById('logHistory');

const customTopicInput = document.getElementById('customTopicInput');
const eventNoteEl = document.getElementById('eventNote');

const customTimeToggle = document.getElementById('customTimeToggle');
const customTimeBox = document.getElementById('customTimeBox');
const customDateTimeInput = document.getElementById('customDateTime');

// นาฬิกา Real-time แสดงเวลาปัจจุบันพร้อมวินาที
function updateClock() {
    const now = new Date();
    liveClock.textContent = now.toLocaleString('th-TH', { 
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit' 
    }) + ' น.';
}
setInterval(updateClock, 1000);
updateClock();

// เปิด/ปิด ช่องใส่วันและเวลาย้อนหลัง
customTimeToggle.addEventListener('change', (e) => {
    if (e.target.checked) {
        customTimeBox.classList.remove('hidden');
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        customDateTimeInput.value = now.toISOString().slice(0, 16);
    } else {
        customTimeBox.classList.add('hidden');
    }
});

// กดปุ่มเลือกอาการ (Toggle Badges - แคปซูล)
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

// ฟังก์ชันบันทึกข้อมูล (รองรับทั้งเวลาปกติและเวลาย้อนหลัง)
function addLog(type, details = '', customTopic = '') {
    let targetTime = new Date();
    
    if (customTimeToggle.checked && customDateTimeInput.value) {
        targetTime = new Date(customDateTimeInput.value);
    }

    const dateStr = targetTime.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
    const timeStr = targetTime.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' น.';
    
    const newEntry = {
        id: Date.now(),
        timestamp: targetTime.toISOString(),
        dateOnly: dateStr,
        timeOnly: timeStr,
        type: type,
        symptoms: [...activeSymptoms],
        topic: customTopic,
        note: details
    };

    logs.push(newEntry);
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    resetForm();
    saveAndRender();
}

function resetForm() {
    activeSymptoms = [];
    document.querySelectorAll('.badge-btn').forEach(b => b.classList.remove('active'));
    customTopicInput.value = '';
    eventNoteEl.value = '';
    customTimeToggle.checked = false;
    customTimeBox.classList.add('hidden');
}

// ลบรายการล่าสุดพร้อมป๊อปอัปยืนยัน
function subtractLog(type) {
    const lastIndex = logs.findIndex(log => log.type === type);
    if (lastIndex !== -1) {
        const item = logs[lastIndex];
        const typeName = type === 'pee' ? 'ปัสสาวะ' : 'ดื่มน้ำ';
        if (confirm(`คุณต้องการลบบันทึก ${typeName} ของเวลา [${item.dateOnly} ${item.timeOnly}] ใช่หรือไม่?`)) {
            logs.splice(lastIndex, 1);
            saveAndRender();
        }
    } else {
        alert('ไม่มีรายการให้ลบครับ');
    }
}

// ลบรายการเจาะจง
function deleteLog(id) {
    const target = logs.find(l => l.id === id);
    if (target && confirm(`ยืนยันลบรายการเวลา [${target.dateOnly} ${target.timeOnly}] นี้ใช่หรือไม่?`)) {
        logs = logs.filter(l => l.id !== id);
        saveAndRender();
    }
}

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
        
        let title = log.type === 'pee' ? '🚽 บันทึกปัสสาวะ' : (log.type === 'water' ? '💧 บันทึกดื่มน้ำ' : '📝 บันทึกอาการ');
        
        let detailsArr = [];
        if (log.topic) detailsArr.push(`📌 หัวข้อ: ${log.topic}`);
        if (log.symptoms.length > 0) detailsArr.push(`อาการ: ${log.symptoms.join(', ')}`);
        if (log.note) detailsArr.push(`เหตุการณ์: ${log.note}`);
        
        let extraStr = detailsArr.join(' | ');

        item.innerHTML = `
            <div class="history-info">
                <strong>${title}</strong>
                <small>⏱️ ${log.dateOnly} - ${log.timeOnly} ${extraStr ? `<br>${extraStr}` : ''}</small>
            </div>
            <button class="delete-btn" onclick="deleteLog(${log.id})">🗑️</button>
        `;
        logHistoryEl.appendChild(item);
    });
}

document.getElementById('addPeeBtn').addEventListener('click', () => addLog('pee'));
document.getElementById('addWaterBtn').addEventListener('click', () => addLog('water'));
document.getElementById('subPeeBtn').addEventListener('click', () => subtractLog('pee'));
document.getElementById('subWaterBtn').addEventListener('click', () => subtractLog('water'));

document.getElementById('saveNoteBtn').addEventListener('click', () => {
    const topicText = customTopicInput.value.trim();
    const noteText = eventNoteEl.value.trim();
    
    if (activeSymptoms.length === 0 && !topicText && !noteText) {
        alert('กรุณาเลือกอาการ พิมพ์หัวข้อย่อย หรือพิมพ์เหตุการณ์ก่อนกดบันทึกครับ');
        return;
    }
    addLog('note', noteText, topicText);
});

// ส่งออก CSV (แยกวันที่ เวลา หัวข้อ/อาการ และเหตุการณ์ ชัดเจน)
document.getElementById('exportCsvBtn').addEventListener('click', () => {
    let csv = "data:text/csv;charset=utf-8,\uFEFFวันที่,เวลา,รายการ,หัวข้อย่อย/อาการ,เหตุการณ์เพิ่มเติม\n";
    logs.forEach(l => {
        let typeStr = l.type === 'pee' ? 'ปัสสาวะ' : (l.type === 'water' ? 'ดื่มน้ำ' : 'บันทึกอาการ');
        
        let symStr = [];
        if (l.topic) symStr.push(`[${l.topic}]`);
        if (l.symptoms.length > 0) symStr.push(l.symptoms.join(' '));
        
        csv += `"${l.dateOnly}","${l.timeOnly}","${typeStr}","${symStr.join(' ')}","${l.note || ''}"\n`;
    });
    const link = document.createElement('a');
    link.href = encodeURI(csv);
    link.download = `Health_Log_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
});

// ส่งออก PDF (แยกคอลัมน์ระดับนาที/วินาที ชัดเจน)
document.getElementById('exportPdfBtn').addEventListener('click', () => {
    const template = document.getElementById('pdfTemplate');
    const tbody = document.getElementById('pdfTableBody');
    
    document.getElementById('pdfDateRange').textContent = `ข้อมูล ณ วันที่: ${new Date().toLocaleDateString('th-TH')}`;
    tbody.innerHTML = '';
    
    logs.forEach(l => {
        let typeStr = l.type === 'pee' ? 'ปัสสาวะ' : (l.type === 'water' ? 'ดื่มน้ำ' : 'บันทึกอาการ');
        
        let symStr = [];
        if (l.topic) symStr.push(`📌 ${l.topic}`);
        if (l.symptoms.length > 0) symStr.push(l.symptoms.join(', '));

        tbody.innerHTML += `
            <tr>
                <td>${l.dateOnly}</td>
                <td>${l.timeOnly}</td>
                <td>${typeStr}</td>
                <td>${symStr.join('<br>') || '-'}</td>
                <td>${l.note || '-'}</td>
            </tr>`;
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
