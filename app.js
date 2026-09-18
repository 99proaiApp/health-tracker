// ===== ตั้งค่า Firebase =====
const firebaseConfig = {
  apiKey: "AIzaSyA0DBx6-AfhIhzTHUs85PnbKisut5nqrM8",
  authDomain: "health-tracker-964bd.firebaseapp.com",
  projectId: "health-tracker-964bd",
  storageBucket: "health-tracker-964bd.firebasestorage.app",
  messagingSenderId: "381325774882",
  appId: "1:381325774882:web:06c30bb528c75456a3ba7b"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// เก็บข้อมูลแบบออฟไลน์ไว้ในเครื่องด้วย พอเน็ตกลับมาจะ sync ให้อัตโนมัติ
db.enablePersistence().catch(() => { /* หลายแท็บเปิดพร้อมกัน หรือเบราว์เซอร์ไม่รองรับ - ข้ามได้ */ });

const logsCollection = db.collection('healthLogs');

let logs = [];
let activeSymptoms = [];
let unsubscribeSnapshot = null;

const syncStatusEl = document.getElementById('syncStatus');
function setSyncStatus(text, cls) {
    syncStatusEl.textContent = text;
    syncStatusEl.className = 'sync-badge' + (cls ? ' ' + cls : '');
}

// ล็อกอินแบบไม่ระบุตัวตน (Anonymous) แล้วเริ่มฟังข้อมูลจาก Firestore แบบเรียลไทม์
auth.onAuthStateChanged(user => {
    if (user) {
        setSyncStatus('🟢 ออนไลน์', 'online');
        if (unsubscribeSnapshot) unsubscribeSnapshot();
        unsubscribeSnapshot = logsCollection.orderBy('timestamp', 'desc').onSnapshot(
            snapshot => {
                logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                updateCounters();
                renderHistory();
            },
            err => {
                console.error('Firestore sync error:', err);
                setSyncStatus('🔴 เชื่อมต่อไม่ได้', 'error');
            }
        );
    } else {
        auth.signInAnonymously().catch(err => {
            console.error('Anonymous sign-in failed:', err);
            setSyncStatus('🔴 ล็อกอินไม่สำเร็จ', 'error');
        });
    }
});

const liveClock = document.getElementById('liveClock');
const peeCountEl = document.getElementById('peeCount');
const waterCountEl = document.getElementById('waterCount');
const logHistoryEl = document.getElementById('logHistory');

const customTopicInput = document.getElementById('customTopicInput');
const eventNoteEl = document.getElementById('eventNote');

const toggleCustomTimeBtn = document.getElementById('toggleCustomTime');
const customTimeBox = document.getElementById('customTimeBox');
const customDateTimeInput = document.getElementById('customDateTime');
let customTimeActive = false;

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

// เปิด/ปิด ช่องใส่วันและเวลาย้อนหลัง (กดปุ่มแทนการติ๊ก checkbox)
toggleCustomTimeBtn.addEventListener('click', () => {
    customTimeActive = !customTimeActive;
    toggleCustomTimeBtn.classList.toggle('active', customTimeActive);
    if (customTimeActive) {
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

// ฟังก์ชันบันทึกข้อมูล (รองรับทั้งเวลาปกติและเวลาย้อนหลัง) - เขียนขึ้น Firestore โดยตรง
function addLog(type, details = '', customTopic = '') {
    let targetTime = new Date();
    
    if (customTimeActive && customDateTimeInput.value) {
        targetTime = new Date(customDateTimeInput.value);
    }

    const dateStr = targetTime.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
    const timeStr = targetTime.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' น.';
    
    const newEntry = {
        timestamp: targetTime.toISOString(),
        dateKey: targetTime.toISOString().slice(0, 10),
        dateOnly: dateStr,
        timeOnly: timeStr,
        type: type,
        symptoms: [...activeSymptoms],
        topic: customTopic,
        note: details,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    resetForm();
    logsCollection.add(newEntry).catch(err => {
        console.error('บันทึกไม่สำเร็จ:', err);
        alert('บันทึกไม่สำเร็จ ตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วลองอีกครั้ง');
    });
}

function resetForm() {
    activeSymptoms = [];
    document.querySelectorAll('.badge-btn').forEach(b => b.classList.remove('active'));
    customTopicInput.value = '';
    eventNoteEl.value = '';
    customTimeActive = false;
    toggleCustomTimeBtn.classList.remove('active');
    customTimeBox.classList.add('hidden');
}

// เติมข้อมูลวัน-เวลาที่ขาดหาย (กันปัญหา "undefined" จากบันทึกเก่าที่มาจากรุ่นก่อนหน้า)
function getSafeDateTime(log) {
    if (log.dateOnly && log.timeOnly && log.dateKey) {
        return { dateOnly: log.dateOnly, timeOnly: log.timeOnly, dateKey: log.dateKey };
    }
    const raw = log.timestamp || (typeof log.id === 'number' ? log.id : null);
    if (raw) {
        const d = new Date(raw);
        if (!isNaN(d.getTime())) {
            return {
                dateOnly: log.dateOnly || d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }),
                timeOnly: log.timeOnly || (d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' น.'),
                dateKey: log.dateKey || d.toISOString().slice(0, 10)
            };
        }
    }
    return { dateOnly: 'ไม่ทราบวันที่', timeOnly: '-', dateKey: '0000-00-00' };
}

// ลบรายการล่าสุดพร้อมป๊อปอัปยืนยัน
function subtractLog(type) {
    const lastIndex = logs.findIndex(log => log.type === type);
    if (lastIndex !== -1) {
        const item = logs[lastIndex];
        const { dateOnly, timeOnly } = getSafeDateTime(item);
        const typeName = type === 'pee' ? 'ปัสสาวะ' : 'ดื่มน้ำ';
        if (confirm(`คุณต้องการลบบันทึก ${typeName} ของเวลา [${dateOnly} ${timeOnly}] ใช่หรือไม่?`)) {
            logsCollection.doc(item.id).delete().catch(err => {
                console.error('ลบไม่สำเร็จ:', err);
                alert('ลบไม่สำเร็จ ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต');
            });
        }
    } else {
        alert('ไม่มีรายการให้ลบครับ');
    }
}

// ลบรายการเจาะจง
function deleteLog(id) {
    const target = logs.find(l => l.id === id);
    if (!target) return;
    const { dateOnly, timeOnly } = getSafeDateTime(target);
    if (confirm(`ยืนยันลบรายการเวลา [${dateOnly} ${timeOnly}] นี้ใช่หรือไม่?`)) {
        logsCollection.doc(id).delete().catch(err => {
            console.error('ลบไม่สำเร็จ:', err);
            alert('ลบไม่สำเร็จ ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต');
        });
    }
}

function updateCounters() {
    const todayKey = new Date().toISOString().slice(0, 10);
    const todayLogs = logs.filter(l => getSafeDateTime(l).dateKey === todayKey);
    
    peeCountEl.textContent = todayLogs.filter(l => l.type === 'pee').length;
    waterCountEl.textContent = todayLogs.filter(l => l.type === 'water').length;
}

function renderHistory() {
    logHistoryEl.innerHTML = '';
    logs.forEach(log => {
        const item = document.createElement('div');
        item.className = `history-item ${log.type}`;
        
        let title = log.type === 'pee' ? '🚽 บันทึกปัสสาวะ' : (log.type === 'water' ? '💧 บันทึกดื่มน้ำ' : '📝 บันทึกอาการ');
        
        const { dateOnly, timeOnly } = getSafeDateTime(log);
        const symptoms = log.symptoms || [];

        let detailsArr = [];
        if (log.topic) detailsArr.push(`📌 หัวข้อ: ${log.topic}`);
        if (symptoms.length > 0) detailsArr.push(`อาการ: ${symptoms.join(', ')}`);
        if (log.note) detailsArr.push(`เหตุการณ์: ${log.note}`);
        
        let extraStr = detailsArr.join(' | ');

        item.innerHTML = `
            <div class="history-info">
                <strong>${title}</strong>
                <small>⏱️ ${dateOnly} - ${timeOnly} ${extraStr ? `<br>${extraStr}` : ''}</small>
            </div>
            <button class="delete-btn" onclick="deleteLog('${log.id}')">🗑️</button>
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
    let csv = "data:text/csv;charset=utf-8,\uFEFFวันที่,เวลา,ประเภทรายการ,อาการ/หัวข้อย่อย,รายละเอียดเพิ่มเติม\n";
    const sorted = [...logs].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    sorted.forEach(l => {
        let typeStr = l.type === 'pee' ? 'ปัสสาวะ' : (l.type === 'water' ? 'ดื่มน้ำ' : 'บันทึกอาการ');
        const { dateOnly, timeOnly } = getSafeDateTime(l);
        const symptoms = l.symptoms || [];

        let symStr = [];
        if (l.topic) symStr.push(`[${l.topic}]`);
        if (symptoms.length > 0) symStr.push(symptoms.join(' '));
        
        csv += `"${dateOnly}","${timeOnly}","${typeStr}","${symStr.join(' ')}","${l.note || ''}"\n`;
    });
    const link = document.createElement('a');
    link.href = encodeURI(csv);
    link.download = `Health_Log_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
});

// สร้างข้อมูลสรุปรายวัน (จำนวนครั้ง, ตื่นฉี่กลางคืน, อาการที่พบ) สำหรับตารางสรุปในรายงาน
function buildDailySummary(sortedLogs) {
    const map = new Map(); // dateKey -> { dateOnly, pee, water, nightPee, symptoms:Set }
    sortedLogs.forEach(l => {
        const { dateOnly, dateKey } = getSafeDateTime(l);
        if (!map.has(dateKey)) {
            map.set(dateKey, { dateOnly, pee: 0, water: 0, nightPee: 0, symptoms: new Set() });
        }
        const entry = map.get(dateKey);
        if (l.type === 'pee') entry.pee++;
        if (l.type === 'water') entry.water++;
        (l.symptoms || []).forEach(s => {
            entry.symptoms.add(s);
            if (s.includes('ตื่นฉี่กลางคืน')) entry.nightPee++;
        });
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v);
}

// ส่งออก PDF: สรุปรายวัน + รายละเอียดทุกรายการ ให้ครบถ้วนสำหรับแจ้งแพทย์
document.getElementById('exportPdfBtn').addEventListener('click', async () => {
    const template = document.getElementById('pdfTemplate');
    const summaryBody = document.getElementById('pdfSummaryBody');
    const tbody = document.getElementById('pdfTableBody');

    const sorted = [...logs].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    document.getElementById('pdfDateRange').textContent = `จัดทำรายงานเมื่อ: ${new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}`;

    // ตารางสรุปรายวัน
    const dailySummary = buildDailySummary(sorted);
    summaryBody.innerHTML = dailySummary.map(d => `
        <tr>
            <td>${d.dateOnly}</td>
            <td style="text-align:center;">${d.pee}</td>
            <td style="text-align:center;">${d.water}</td>
            <td style="text-align:center;">${d.nightPee || '-'}</td>
            <td>${[...d.symptoms].join(', ') || '-'}</td>
        </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;">ยังไม่มีข้อมูล</td></tr>';

    // ตารางรายละเอียดทุกรายการ
    tbody.innerHTML = sorted.map(l => {
        let typeStr = l.type === 'pee' ? 'ปัสสาวะ' : (l.type === 'water' ? 'ดื่มน้ำ' : 'บันทึกอาการ');
        const { dateOnly, timeOnly } = getSafeDateTime(l);
        const symptoms = l.symptoms || [];

        let symStr = [];
        if (l.topic) symStr.push(`📌 ${l.topic}`);
        if (symptoms.length > 0) symStr.push(symptoms.join(', '));

        return `
            <tr>
                <td>${dateOnly}</td>
                <td>${timeOnly}</td>
                <td>${typeStr}</td>
                <td>${symStr.join('<br>') || '-'}</td>
                <td>${l.note || '-'}</td>
            </tr>`;
    }).join('') || '<tr><td colspan="5" style="text-align:center;">ยังไม่มีข้อมูล</td></tr>';

    // รอให้ฟอนต์ไทยโหลดเสร็จและเลย์เอาต์นิ่งก่อนถ่ายภาพ (การ์ดนี้อยู่นอกจอตลอดเวลาอยู่แล้ว ไม่ต้องสลับ display)
    if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
    }
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    html2pdf().set({
        margin: 10,
        filename: `รายงานสุขภาพ_${new Date().toISOString().slice(0,10)}.pdf`,
        html2canvas: { scale: 2, useCORS: true, windowWidth: 760 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }).from(template).save();
});

