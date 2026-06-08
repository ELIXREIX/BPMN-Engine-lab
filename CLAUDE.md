# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **ภาษา:** ตอบกลับเป็นภาษาไทยเสมอ

---

## คำสั่งที่ใช้บ่อย

### เริ่มทุก service พร้อมกัน (Windows)
```powershell
.\start.ps1
```

### เริ่มแยกทีละ service (manual)
```powershell
# Terminal 1 — Flowable engine
docker-compose up -d

# Terminal 2 — Backend (รอ Flowable อัตโนมัติ)
cd backend
npm run dev        # nodemon auto-reload
# หรือ: node server.js

# Terminal 3 — Frontend
cd frontend
npm run dev
```

### รัน tests (backend)
```powershell
cd backend
npm test
# รัน: creditPolicy.test.js, flowableVars.test.js, bpmnPolicy.test.js
```

### URLs
| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:3001/api |
| Flowable REST | http://localhost:9000/flowable-ui/process-api |
| Mock Credit API | http://localhost:3001/api/external/credit-check/:nationalId |

### ทดสอบ API ตรง
```bash
# health check
curl http://localhost:3001/api/health

# ส่ง request ใหม่ (BPMN path)
curl -X POST http://localhost:3001/api/requests \
  -H "Content-Type: application/json" \
  -d '{"applicantName":"Alice","nationalId":"1234567890","processKey":"creditCardSimple"}'

# ดู tasks ที่รออนุมัติ
curl http://localhost:3001/api/tasks
```

### Kill backend ที่ค้างอยู่ (port 3001)
```powershell
$procId = (Get-NetTCPConnection -LocalPort 3001).OwningProcess
Stop-Process -Id $procId -Force
```

---

## สถาปัตยกรรม

```
Browser (5173)
  └─ React + Vite
       └─ /api/* proxy → Express backend (3001)
            ├─ Fixed Flow: in-memory store, if-else logic (no Flowable)
            └─ HTTP Basic auth (admin/test) → Flowable UI Docker (9000→8080)
                  └─ H2 file-based DB (persists ระหว่าง restart แต่หายถ้าลบ container)
```

**ไม่มี** auth บน frontend หรือ backend — POC เท่านั้น

---

## Flowable REST — สิ่งสำคัญที่ต้องรู้

- **Base URL จริง:** `http://localhost:9000/flowable-ui/process-api`
  (ไม่ใช่ `/flowable-rest/service/`)
- **Credentials:** `admin` / `test` (Basic auth)
- **Flowable Modeler/Admin UI ใช้ไม่ได้** — redirect ไป port 8080 ซึ่ง AgentService.exe ยึดอยู่ → ใช้ Workflow Viewer page แทน

---

## Backend — Pattern หลัก (`backend/server.js`)

### PROCESS_CATALOG
Array ที่ควบคุมทุก BPMN workflow ใน POC นี้:

```js
const PROCESS_CATALOG = [
  {
    key: 'creditCardSimple',           // processDefinitionKey ใน Flowable
    name: 'Credit Card — Simple (BPMN)',
    description: '...',
    file: 'credit-card-simple.bpmn20.xml', // ไฟล์ใน backend/bpmn/
    bpmnViewer: 'bpmn1',               // tab ID ใน WorkflowViewer ('fixed'|'bpmn1'|'bpmn2')
  },
  {
    key: 'creditCardAdvanced',
    name: 'Credit Card — Advanced (BPMN)',
    file: 'credit-card-advanced.bpmn20.xml',
    bpmnViewer: 'bpmn2',
  },
];
```

**เพิ่ม workflow ใหม่:** เพิ่ม entry ใน `PROCESS_CATALOG` + วาง BPMN XML ใน `backend/bpmn/` → restart backend (จะ deploy อัตโนมัติ)

### Startup flow
`waitForFlowable()` → `deployAll()` (skip ถ้า deploy แล้ว) → `app.listen()`

### Process variables มาตรฐาน
ทุก BPMN workflow ใช้ตัวแปรเหมือนกัน:
- **set on start:** `applicantName`, `nationalId`, `monthlyIncome`, `employmentType`, `employer`, `cardType`, `creditLimitRequest`, `processKey`
- **set by HTTP Task:** `creditCheck` (JSON string จาก mock API), แล้ว flatten เป็น `creditScore`, `riskLevel`, `existingCards`, `monthlyDebt`, `recommendation`
- **set on complete:** `approved` (boolean), `comment`, `reviewer`
- **gateway condition:** `${approved == true}`

### Helper modules
- **`backend/creditPolicy.js`** — `getCreditData(nationalId)` (deterministic hash → creditScore 300–850), `getCreditDecision(score, threshold)`, `flattenCreditVars(vars)`
- **`backend/flowableVars.js`** — `flowableVarsToObject(list)` แปลง Flowable variable array เป็น object

### Credit score routing (ใช้ทั้ง fixed flow และ BPMN gateways)
| Score | Action |
|---|---|
| ≥ 700 (Simple) / ≥ 750 (Advanced) | Auto-approve |
| 400–699 (Simple) / 450–749 (Advanced) | Manager review task |
| < 400 / < 450 | Auto-reject |

---

## Workflows

### Fixed Flow (Hardcoded — ไม่ใช้ BPMN engine)
- key: `fixedFlow` — logic อยู่ใน `backend/server.js` ทั้งหมด (in-memory store + if-else)
- ไม่เข้า Flowable — submit สร้าง task ใน memory, complete อัปเดต status โดยตรง
- ใช้เป็น baseline เปรียบเทียบกับ BPMN workflows

### BPMN Workflows (deploy ลง Flowable engine)
| Key | ชื่อ | Credit threshold | Approvers |
|---|---|---|---|
| `creditCardSimple` | Credit Card — Simple | ≥700 auto, <400 reject, 400–699 manual | Manager only |
| `creditCardAdvanced` | Credit Card — Advanced | ≥750 auto, <450 reject, 450–749 manual | Manager → Director |

BPMN files: `backend/bpmn/` (deploy ขึ้น Flowable), `frontend/public/bpmn/` (static สำหรับ viewer — ต้องอัปเดตทั้งสองที่)

---

## Frontend — โครงสร้าง

```
src/
  api.js          — fetch wrapper ทุก endpoint (proxy ผ่าน Vite → :3001)
  App.jsx         — route definitions
  components/
    Layout.jsx    — sidebar nav + Outlet
    StatusBadge.jsx
  pages/
    Dashboard.jsx      — stats cards + recent requests
    NewRequest.jsx     — radio picker (ดึงจาก GET /api/processes) + form
    TaskInbox.jsx      — expand card → Approve/Reject
    AllRequests.jsx    — table พร้อม filter tabs
    WorkflowViewer.jsx — bpmn-js NavigatedViewer, 3 tabs (fixed/bpmn1/bpmn2)
    UserManual.jsx     — static guide
```

- `NewRequest.jsx` ดึง `/api/processes` มาสร้าง radio buttons — workflow ที่ `deployed: false` ถูก filter ออก
- `processBadgeColor` map ใน `NewRequest.jsx` ต้องอัปเดตถ้าเพิ่ม process key ใหม่
- `WorkflowViewer.jsx` — `FLOWS` array hardcode tab IDs (`fixed`, `bpmn1`, `bpmn2`) ให้ตรงกับ `bpmnViewer` field ใน `PROCESS_CATALOG`
- Static BPMN viewer files อยู่ที่ `frontend/public/bpmn/` (`.bpmn` ไม่มี `.xml`)
