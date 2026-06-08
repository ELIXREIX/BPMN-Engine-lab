# BPMN Live Monitor — Design Spec

## Overview

เพิ่ม live monitor ใน Workflow Viewer: แสดงว่ามี running BPMN instance กี่ตัว แต่ละตัวค้างอยู่ node ไหน แล้ว highlight node บนไดอะแกรม. Read-only — ไม่แก้ definition และไม่แก้ instance.

## Decisions

- รวมใน **Workflow Viewer** (toggle "Live mode") — ไม่แยกหน้าใหม่
- เลือก instance ทีละตัว → highlight current node
- Auto-poll 4 วิ + ปุ่ม refresh manual
- เฉพาะ tab BPMN (creditCardSimple / creditCardAdvanced) — fixed flow ไม่อยู่ใน engine → ซ่อน live mode

## Backend

### Endpoint
```
GET /api/monitor/instances?processKey=creditCardSimple
```

### Logic (helper `getRunningInstances(processKey)`)
1. `GET {FLOWABLE}/runtime/process-instances` → running ทั้งหมด
2. ต่อ instance: `GET {FLOWABLE}/history/historic-activity-instances?processInstanceId=X&finished=false` → current node(s)
3. ต่อ instance: `GET {FLOWABLE}/runtime/process-instances/{id}/variables` → applicantName, creditScore
4. filter ตาม processKey จาก `processDefinitionId.split(':')[0]`

### Response
```json
[
  {
    "id": "51b5ac81-...",
    "businessKey": "req-1780880805721",
    "processKey": "creditCardSimple",
    "applicantName": "Alice",
    "creditScore": 575,
    "startTime": "2026-06-08T01:06:45.858Z",
    "currentActivities": [
      { "id": "managerReview", "name": "Manager Review", "type": "userTask" }
    ]
  }
]
```

- `currentActivities[].id` = BPMN element id → ใช้ highlight ใน bpmn-js
- error/Flowable down → 502 + `{ error }`

## Frontend

### `api.js`
เพิ่ม `getMonitorInstances(processKey)` → `GET /api/monitor/instances?processKey=`

### `WorkflowViewer.jsx`
- ปุ่ม **Live** toggle (เฉพาะ tab BPMN; fixed tab ซ่อน + note "ไม่อยู่ใน engine")
- live on:
  - poll ทุก 4 วิ (`setInterval`, clear ตอน off/unmount/เปลี่ยน tab) + ปุ่ม refresh
  - panel รายการ instance: businessKey, applicant, creditScore, current node name, start time
  - badge นับจำนวน running
  - คลิก instance → set `selectedInstanceId` → derive `highlightIds`
- state: `liveMode`, `instances[]`, `selectedInstanceId`, `monitorError`

### `BpmnCanvas` (ขยาย component เดิม)
- เพิ่ม prop `highlightIds = []`
- useEffect (depend highlightIds + viewer ready): `canvas.removeMarker` ของเก่าทั้งหมด → `canvas.addMarker(id, 'monitor-active')` ของใหม่
- inject CSS `.monitor-active` (stroke เขียว + fill อ่อน + pulse animation) ครั้งเดียว

## Data flow
```
WorkflowViewer (live on, BPMN tab)
  → poll api.getMonitorInstances(key) → instances[]
  → select instance → highlightIds = currentActivities.map(a => a.id)
  → BpmnCanvas addMarker → node เรืองเขียว
```

## Edge cases
- ไม่มี instance → "ไม่มี instance กำลังทำงาน"
- Flowable ล่ม → error banner, คง diagram ไว้
- instance จบระหว่าง poll → หลุดจาก list; ถ้าถูกเลือก → clear highlight
- หลาย current node (parallel) → highlight ทุกตัว
- เปลี่ยน tab ขณะ live → reset instances + selection, poll key ใหม่

## Out of scope
- ไม่มี action (approve/reject) ในหน้า monitor — ใช้ Task Inbox เหมือนเดิม
- ไม่มี historical replay (เฉพาะ running ปัจจุบัน)
- ไม่มี graphical editor
