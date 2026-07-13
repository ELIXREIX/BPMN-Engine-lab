const BASE = '/api';
// Flow 5 ยิงตรงไป litigation-service จริงผ่าน Vite proxy (ดู vite.config.js)
const LITIGATION_BASE = '/litigation-api/api/v1';

// ค่าจริงจาก GET /lookup/type/TRAN_STATUS ของ litigation-service
export const TRAN_STATUS = {
  DRAFT: 53,        // ฉบับร่าง
  WAIT_DG: 54,      // รอการพิจารณาโดย ผบ.สม.
  WAIT_DIR: 55,     // รอการพิจารณาอนุมัติโดย ผสม.
  WAIT_GLEAD: 56,   // รอการพิจารณาโดย ผอ.กลุ่ม
  WAIT_LAW_ACK: 57, // รอการรับทราบโดยนิติกร
  LAW_INPROG: 58,   // อยู่ระหว่างนิติกรดำเนินการ
  DONE: 59,         // ดำเนินการเสร็จสิ้น
  REJECT: 147,      // ไม่ผ่านการพิจารณาของ ผบ.สม.
  EDIT: 148,        // ไม่อนุมัติโดย ผสม.
  NOT_AGREE: 180,   // ไม่ผ่านการพิจารณาของ ผอ.กลุ่ม
};

// ป้ายสถานะ (รวมค่า demo เก่า 1/2 ที่เคยบันทึกก่อนใช้ค่าจริง)
export const CASE_STATUS_LABEL = {
  [53]: { bg: '#f1f5f9', text: '#475569', label: 'ฉบับร่าง' },
  [54]: { bg: '#fef3c7', text: '#92400e', label: 'รอ ผบ.สม.' },
  [55]: { bg: '#fef3c7', text: '#92400e', label: 'รอ ผสม.' },
  [56]: { bg: '#fef3c7', text: '#92400e', label: 'รอ ผอ.กลุ่ม' },
  [57]: { bg: '#dcfce7', text: '#166534', label: 'ผ่าน — รอนิติกรรับทราบ' },
  [58]: { bg: '#dbeafe', text: '#1d4ed8', label: 'นิติกรดำเนินการ' },
  [59]: { bg: '#dcfce7', text: '#166534', label: 'เสร็จสิ้น' },
  [147]: { bg: '#fee2e2', text: '#991b1b', label: 'ไม่ผ่าน ผบ.สม.' },
  [148]: { bg: '#fee2e2', text: '#991b1b', label: 'ไม่อนุมัติ ผสม.' },
  [180]: { bg: '#fee2e2', text: '#991b1b', label: 'ไม่ผ่าน ผอ.กลุ่ม' },
  [1]: { bg: '#f1f5f9', text: '#475569', label: 'ฉบับร่าง (ค่าเก่า)' },
  [2]: { bg: '#fef3c7', text: '#92400e', label: 'รอ ผอ.กลุ่ม (ค่าเก่า)' },
};

// สถานะกลุ่ม (รวมค่าเก่า)
export const DRAFT_STATUSES = [53, 1];
export const WAIT_GLEAD_STATUSES = [56, 2];

// ค่าจริงจาก GET /lookup/type/ACTION_TYPE
export const ACTION_TYPE = {
  PROPOSE: 110,     // P เสนอเพื่อพิจารณา
  CONFIRM: 111,     // C ยืนยันข้อมูล
  REJECT: 162,      // R ปฏิเสธ
  ACK: 163,         // A รับทราบ
  APPROVE: 172,     // O อนุมัติ
  AGREE: 179,       // G เห็นชอบ
  NOT_PASS: 422,    // RJ ไม่ผ่านการพิจารณา
  NOT_APPROVE: 423, // NO ไม่อนุมัติ
};

async function raw(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
  return data;
}

function req(method, path, body) {
  return raw(method, `${BASE}${path}`, body);
}

export const api = {
  health: () => req('GET', '/health'),
  getProcesses: () => req('GET', '/processes'),
  getRequests: () => req('GET', '/requests'),
  createRequest: (body) => req('POST', '/requests', body),
  getTasks: () => req('GET', '/tasks'),
  completeTask: (id, body) => req('POST', `/tasks/${id}/complete`, body),
  getMonitorInstances: (processKey) => req('GET', `/monitor/instances${processKey ? `?processKey=${encodeURIComponent(processKey)}` : ''}`),
  getBpmn: (key) => req('GET', `/bpmn/${key}`),
  deployBpmn: (key, xml) => req('POST', `/bpmn/${key}/deploy`, { xml }),
  createAssignment: (body) => req('POST', '/assignments', body),
  getAssignments: () => req('GET', '/assignments'),
  getAssignmentTasks: () => req('GET', '/assignments/tasks'),
  // writes ผ่าน backend (dual: ยิง litigation-service จริง + sync Flowable engine)
  createCaseIntake: (body) => req('POST', '/case-intakes/create', body),
  saveCaseIntake: (id, body) => req('POST', `/case-intakes/${id}/save`, body),
  createCaseIntakeApproval: (body) => req('POST', '/case-intake-approvals/create', body),
  decideCaseIntake: (tledId, body) => req('POST', `/case-intakes/${tledId}/decision`, body),
  // reads ตรงจาก litigation-service (ผ่าน Vite proxy)
  getCaseIntakesRemote: (page = 0, size = 100) => raw('GET', `${LITIGATION_BASE}/case-intakes?page=${page}&size=${size}`),
  // POST getById ตาม spec ใหม่ — ถ้า server ยังไม่มี (405/404) fallback เป็น GET /{id}
  getCaseIntakeById: async (tledId) => {
    try {
      return await raw('POST', `${LITIGATION_BASE}/case-intakes/getById`, { tledId });
    } catch {
      return raw('GET', `${LITIGATION_BASE}/case-intakes/${tledId}`);
    }
  },
  getCaseIntakeAggregate: (id) => raw('GET', `${LITIGATION_BASE}/case-intakes/${id}/aggregate`),
  getCaseIntakeApprovalHistory: (tledId) => raw('GET', `${LITIGATION_BASE}/case-intake-approvals/${tledId}`),
  updateCaseIntake: (id, body) => raw('POST', `${LITIGATION_BASE}/case-intakes/update/${id}`, body),
  // local POC engine (list/คิว GLEAD ยังอ่านจาก Flowable ในเครื่อง)
  getCaseIntakes: () => req('GET', '/case-intakes'),
  getCaseIntakeTasks: () => req('GET', '/case-intakes/tasks'),
};
