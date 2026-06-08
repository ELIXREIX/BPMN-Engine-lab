# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

> **เธ เธฒเธฉเธฒ:** เธ•เธญเธเธเธนเนเนเธเนเน€เธเนเธเธ เธฒเธฉเธฒเนเธ—เธขเน€เธชเธกเธญ

---

## เธเธณเธชเธฑเนเธเธ—เธตเนเนเธเนเธเนเธญเธข

### เน€เธฃเธดเนเธกเธ—เธธเธ service เธเธฃเนเธญเธกเธเธฑเธ (Windows)
```powershell
.\start.ps1
```

### เน€เธฃเธดเนเธกเนเธขเธเธ—เธตเธฅเธฐ service (manual)
```powershell
# Terminal 1 โ€” Flowable engine
docker-compose up -d

# Terminal 2 โ€” Backend (เธฃเธญ Flowable เธญเธฑเธ•เนเธเธกเธฑเธ•เธด)
cd backend
node server.js
# เธซเธฃเธทเธญ dev mode เธเธฃเนเธญเธก auto-reload
npm run dev

# Terminal 3 โ€” Frontend
cd frontend
npm run dev
```

### URLs
| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:3001/api |
| Flowable REST | http://localhost:9000/flowable-ui/process-api |

### เธ—เธ”เธชเธญเธ API เนเธ”เธขเธ•เธฃเธ
```bash
# health check
curl http://localhost:3001/api/health

# เธชเนเธ request เนเธซเธกเน
curl -X POST http://localhost:3001/api/requests \
  -H "Content-Type: application/json" \
  -d '{"requester":"Alice","description":"Budget Q3","processKey":"approvalProcess"}'

# เธ”เธน tasks เธ—เธตเนเธฃเธญเธญเธเธธเธกเธฑเธ•เธด
curl http://localhost:3001/api/tasks
```

### Kill backend เธ—เธตเนเธเนเธฒเธเธญเธขเธนเน (port 3001)
```powershell
$procId = (Get-NetTCPConnection -LocalPort 3001).OwningProcess
Stop-Process -Id $procId -Force
```

---

## เธชเธ–เธฒเธเธฑเธ•เธขเธเธฃเธฃเธก

```
Browser (5173)
  โ””โ”€ React + Vite
       โ””โ”€ /api/* proxy โ’ Express backend (3001)
            โ””โ”€ HTTP Basic auth (admin/test) โ’ Flowable UI Docker (9000โ’8080)
                  โ””โ”€ H2 file-based DB (persists เธฃเธฐเธซเธงเนเธฒเธ restart เนเธ•เนเธซเธฒเธขเธ–เนเธฒเธฅเธ container)
```

**เนเธกเนเธกเธต** auth เธเธ frontend เธซเธฃเธทเธญ backend โ€” POC เน€เธ—เนเธฒเธเธฑเนเธ

---

## Flowable REST โ€” เธชเธดเนเธเธชเธณเธเธฑเธเธ—เธตเนเธ•เนเธญเธเธฃเธนเน

- **Base URL เธเธฃเธดเธ:** `http://localhost:9000/flowable-ui/process-api`  
  (เนเธกเนเนเธเน `/flowable-rest/service/` โ€” WAR เธเธฑเนเธเนเธกเนเธกเธตเนเธ `flowable/flowable-ui`)
- **Credentials:** `admin` / `test` (Basic auth)
- **Flowable Modeler/Admin UI เนเธเนเนเธกเนเนเธ”เน** โ€” redirect เนเธ port 8080 เธเธถเนเธ AgentService.exe เธขเธถเธ”เธญเธขเธนเน เนเธเน Workflow Viewer page เนเธ—เธ

---

## Backend โ€” Pattern เธซเธฅเธฑเธ (`backend/server.js`)

### PROCESS_CATALOG
Array เธ—เธตเนเธเธงเธเธเธธเธกเธ—เธธเธ workflow เนเธ POC เธเธตเน:

```js
const PROCESS_CATALOG = [
  {
    key: 'approvalProcess',          // processDefinitionKey เนเธ Flowable
    name: 'Standard Approval',       // เธเธทเนเธญเนเธชเธ”เธเนเธ UI
    description: '...',
    file: 'approval-flow.bpmn20.xml', // เนเธเธฅเนเนเธ backend/bpmn/
    bpmnViewer: 'bpmn1',             // tab เนเธ WorkflowViewer ('fixed'|'bpmn1'|'bpmn2')
  },
  // ...
];
```

**เน€เธเธดเนเธก workflow เนเธซเธกเน:** เน€เธเธดเนเธก entry เนเธ `PROCESS_CATALOG` + เธงเธฒเธ BPMN XML เนเธ `backend/bpmn/` โ’ restart backend (เธเธฐ deploy เธญเธฑเธ•เนเธเธกเธฑเธ•เธด)

### Startup flow
`waitForFlowable()` โ’ `deployAll()` (skip เธ–เนเธฒ deploy เนเธฅเนเธง) โ’ `app.listen()`

### Process variables เธกเธฒเธ•เธฃเธเธฒเธ
เธ—เธธเธ workflow เนเธเนเธ•เธฑเธงเนเธเธฃเน€เธซเธกเธทเธญเธเธเธฑเธ:
- **set on start:** `requester`, `description`, `amount`, `priority`, `processKey`
- **set on complete:** `approved` (boolean), `comment`, `reviewer`
- **gateway condition:** `${approved == true}`

---

## Frontend โ€” เนเธเธฃเธเธชเธฃเนเธฒเธ

```
src/
  api.js          โ€” fetch wrapper เธ—เธธเธ endpoint (proxy เธเนเธฒเธ Vite โ’ :3001)
  App.jsx         โ€” route definitions
  components/
    Layout.jsx    โ€” sidebar nav + Outlet
    StatusBadge.jsx
  pages/
    Dashboard.jsx      โ€” stats cards + recent requests
    NewRequest.jsx     โ€” radio picker (เธ”เธถเธเธเธฒเธ GET /api/processes) + form
    TaskInbox.jsx      โ€” expand card โ’ Approve/Reject
    AllRequests.jsx    โ€” table เธเธฃเนเธญเธก filter tabs
    WorkflowViewer.jsx โ€” bpmn-js NavigatedViewer, 3 tabs
    UserManual.jsx     โ€” static guide
```

- `NewRequest.jsx` เธ”เธถเธ `/api/processes` เธกเธฒเธชเธฃเนเธฒเธ radio buttons โ€” workflow เธ—เธตเน `deployed: false` เธ–เธนเธ filter เธญเธญเธ
- `processBadgeColor` map เนเธ `NewRequest.jsx` เธ•เนเธญเธเธญเธฑเธเน€เธ”เธ•เธ–เนเธฒเน€เธเธดเนเธก process key เนเธซเธกเน
- BPMN static files เธชเธณเธซเธฃเธฑเธ viewer เธญเธขเธนเนเธ—เธตเน `frontend/public/bpmn/`

---

## Workflows

### Fixed Flow (Hardcoded โ€” เนเธกเนเนเธเน BPMN engine)
- Logic เธญเธขเธนเนเนเธ `backend/server.js` เธ—เธฑเนเธเธซเธกเธ” (in-memory store + if-else)
- เนเธกเนเธเนเธฒเธ Flowable โ€” submit เธชเธฃเนเธฒเธ task เนเธ memory, complete เธญเธฑเธเน€เธ”เธ• status เนเธ”เธขเธ•เธฃเธ
- เนเธเนเน€เธเนเธ baseline เน€เธเธฃเธตเธขเธเน€เธ—เธตเธขเธเธเธฑเธ BPMN workflows

### BPMN Workflows (deploy เธฅเธ Flowable engine)

| Key | เธเธทเนเธญ | Flow |
|---|---|---|
| `approvalProcess` | Standard Approval | Start โ’ Manager Approval โ’ Gateway โ’ End |
| `twoLevelApprovalProcess` | Two-Level Approval | Manager โ’ Gateway โ’ Director (directors) โ’ Gateway โ’ End |

BPMN workflows เนเธเนเธ•เธฑเธงเนเธเธฃ `approved` เน€เธ”เธตเธขเธงเธเธฑเธ โ€” gateway เธญเนเธฒเธ `${approved == true}`

@RTK.md
