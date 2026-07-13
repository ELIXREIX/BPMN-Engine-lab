const express = require('express');
const cors = require('cors');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { getCreditData, getCreditDecision, flattenCreditVars } = require('./creditPolicy');
const { flowableVarsToObject } = require('./flowableVars');

const app = express();
app.use(cors());
app.use(express.json());

const FLOWABLE_BASE = process.env.FLOWABLE_URL || 'http://localhost:9000/flowable-ui/process-api';
const FLOWABLE_AUTH = {
  username: process.env.FLOWABLE_USER || 'admin',
  password: process.env.FLOWABLE_PASS || 'test',
};

const flowable = axios.create({
  baseURL: FLOWABLE_BASE,
  auth: FLOWABLE_AUTH,
  timeout: 10000,
});

// ─── Mock External API: Credit Check ───────────────────────────────────────
// Deterministic score from nationalId hash — same ID always gets same score

app.get('/api/external/credit-check/:nationalId', (req, res) => {
  const data = getCreditData(req.params.nationalId);
  console.log(`  Credit check: ${data.nationalId} → score ${data.creditScore} (${data.recommendation})`);
  res.json(data);
});

// ─── Fixed Flow: hardcoded credit card approval (NO BPMN engine) ───────────
const FIXED_FLOW_META = {
  key: 'fixedFlow',
  name: 'Fixed Flow (Hardcoded)',
  description: 'Hardcoded credit card approval in Node.js — fetches credit score via mock API, routes with if-else. No BPMN engine.',
  bpmnViewer: 'fixed',
};

const fixedStore = {
  requests: [],
  tasks: [],
  _nextId: 1,
  _id() { return `fixed-${this._nextId++}`; },
};

async function fixedFlowSubmit({ applicantName, nationalId, monthlyIncome, employmentType, employer, cardType, creditLimitRequest }) {
  const id = fixedStore._id();
  const now = new Date().toISOString();
  const businessKey = `req-${Date.now()}`;

  const credit = getCreditData(nationalId);

  const reqData = {
    id, businessKey, startTime: now, endTime: null,
    processKey: 'fixedFlow', processName: FIXED_FLOW_META.name,
    applicantName, nationalId, monthlyIncome: Number(monthlyIncome) || 0,
    employmentType: employmentType || '', employer: employer || '',
    cardType: cardType || 'Classic', creditLimitRequest: Number(creditLimitRequest) || 0,
    creditScore: credit.creditScore, riskLevel: credit.riskLevel,
    existingCards: credit.existingCards, monthlyDebt: credit.monthlyDebt,
    recommendation: credit.recommendation,
  };

  // Hardcoded routing logic
  const decision = getCreditDecision(credit.creditScore, 700);

  if (decision.status === 'approved') {
    reqData.status = decision.status;
    reqData.endTime = now;
    reqData.approved = decision.approved;
    reqData.comment = `Auto-approved: credit score ${credit.creditScore} ≥ 700`;
    reqData.reviewer = 'system';
    fixedStore.requests.push(reqData);
    return { id, businessKey, status: decision.status, processKey: 'fixedFlow', processName: FIXED_FLOW_META.name, autoDecision: decision.autoDecision, creditScore: credit.creditScore };
  }

  if (decision.status === 'rejected') {
    reqData.status = decision.status;
    reqData.endTime = now;
    reqData.approved = decision.approved;
    reqData.comment = `Auto-rejected: credit score ${credit.creditScore} < 400`;
    reqData.reviewer = 'system';
    fixedStore.requests.push(reqData);
    return { id, businessKey, status: decision.status, processKey: 'fixedFlow', processName: FIXED_FLOW_META.name, autoDecision: decision.autoDecision, creditScore: credit.creditScore };
  }

  // Manual review zone (400–699)
  reqData.status = 'pending';
  fixedStore.requests.push(reqData);

  const taskId = fixedStore._id();
  fixedStore.tasks.push({
    id: taskId, name: 'Manager Review',
    processInstanceId: id,
    processKey: 'fixedFlow', processName: FIXED_FLOW_META.name,
    created: now,
    applicantName, nationalId, monthlyIncome: Number(monthlyIncome) || 0,
    employmentType: employmentType || '', employer: employer || '',
    cardType: cardType || 'Classic', creditLimitRequest: Number(creditLimitRequest) || 0,
    creditScore: credit.creditScore, riskLevel: credit.riskLevel,
    existingCards: credit.existingCards, monthlyDebt: credit.monthlyDebt,
  });

  return { id, businessKey, status: decision.status, processKey: 'fixedFlow', processName: FIXED_FLOW_META.name, autoDecision: decision.autoDecision, creditScore: credit.creditScore };
}

function fixedFlowComplete(taskId, { approved, comment, reviewer }) {
  const idx = fixedStore.tasks.findIndex(t => t.id === taskId);
  if (idx === -1) return null;
  const task = fixedStore.tasks[idx];

  const req = fixedStore.requests.find(r => r.id === task.processInstanceId);
  if (req) {
    req.status = approved ? 'approved' : 'rejected';
    req.endTime = new Date().toISOString();
    req.approved = approved;
    req.comment = comment;
    req.reviewer = reviewer;
  }

  fixedStore.tasks.splice(idx, 1);
  return { success: true, approved };
}

// ─── BPMN-managed processes (deployed to Flowable engine) ──────────────────
const PROCESS_CATALOG = [
  {
    key: 'creditCardSimple',
    name: 'Credit Card — Simple (BPMN)',
    description: 'BPMN engine with HTTP Task credit check. Single manager approval for medium scores.',
    file: 'credit-card-simple.bpmn20.xml',
    staticFile: 'credit-card-simple.bpmn',
    bpmnViewer: 'bpmn1',
  },
  {
    key: 'creditCardAdvanced',
    name: 'Credit Card — Advanced (BPMN)',
    description: 'BPMN engine with HTTP Task credit check. Manager + Director for medium scores. Stricter threshold (≥750).',
    file: 'credit-card-advanced.bpmn20.xml',
    staticFile: 'credit-card-advanced.bpmn',
    bpmnViewer: 'bpmn2',
  },
  {
    key: 'assignmentFlow',
    name: 'Assignment — มอบหมายงาน (BPMN)',
    description: 'คำขอมอบหมายงานลูกหนี้ (NPL/NPA) ส่งให้ผู้อนุมัติ 1 คนพิจารณา อนุมัติ/ไม่อนุมัติ',
    file: 'assignment-flow.bpmn20.xml',
    staticFile: 'assignment-flow.bpmn',
    bpmnViewer: 'assignment',
    standalone: true, // มีหน้าจอ + endpoint แยก — ไม่รวมใน credit card requests/tasks
  },
  {
    key: 'caseIntakeFlow',
    name: 'Case Intake — ตั้งเรื่องคดี (BPMN)',
    description: 'ตั้งเรื่องคดี (DRAFT) → เจ้าหน้าที่ยืนยันข้อมูล (WAIT_GLEAD) → หัวหน้ากลุ่มงานกฎหมายพิจารณา รับเรื่อง/ตีกลับ',
    file: 'case-intake-flow.bpmn20.xml',
    staticFile: 'case-intake-flow.bpmn',
    bpmnViewer: 'caseIntake',
    standalone: true,
  },
];

const creditProcesses = () => PROCESS_CATALOG.filter(p => !p.standalone);

const FRONTEND_PUBLIC_BPMN = path.join(__dirname, '..', 'frontend', 'public', 'bpmn');

async function waitForFlowable(maxRetries = 30, delay = 5000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await flowable.get('/repository/deployments');
      console.log('✓ Flowable ready');
      return;
    } catch {
      console.log(`  Waiting for Flowable (${i + 1}/${maxRetries})...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error('Flowable not available after max retries');
}

async function deployAll() {
  for (const proc of PROCESS_CATALOG) {
    const res = await flowable.get('/repository/process-definitions', {
      params: { key: proc.key, latest: true },
    });
    if (res.data.data?.length > 0) {
      console.log(`✓ Already deployed: ${proc.key}`);
      continue;
    }
    const bpmnPath = path.join(__dirname, 'bpmn', proc.file);
    if (!fs.existsSync(bpmnPath)) {
      console.log(`⚠ BPMN file not found: ${proc.file} — skipping`);
      continue;
    }
    const form = new FormData();
    form.append('file', fs.createReadStream(bpmnPath), {
      filename: proc.file,
      contentType: 'application/xml',
    });
    const deployed = await flowable.post('/repository/deployments', form, {
      headers: form.getHeaders(),
    });
    console.log(`✓ Deployed ${proc.key}:`, deployed.data.id);
  }
}

// ─── Routes ────────────────────────────────────────────────────────────────

app.get('/api/health', async (req, res) => {
  try {
    await flowable.get('/repository/deployments');
    res.json({ status: 'ok', flowable: 'connected' });
  } catch {
    res.status(503).json({ status: 'error', flowable: 'unavailable' });
  }
});

app.get('/api/processes', async (req, res) => {
  try {
    const bpmnResults = await Promise.all(
      creditProcesses().map(async proc => {
        const r = await flowable.get('/repository/process-definitions', {
          params: { key: proc.key, latest: true },
        });
        const def = r.data.data?.[0];
        return {
          key: proc.key,
          name: proc.name,
          description: proc.description,
          bpmnViewer: proc.bpmnViewer,
          version: def?.version || 1,
          deployed: !!def,
        };
      })
    );

    const fixedEntry = {
      key: FIXED_FLOW_META.key,
      name: FIXED_FLOW_META.name,
      description: FIXED_FLOW_META.description,
      bpmnViewer: FIXED_FLOW_META.bpmnViewer,
      version: 1,
      deployed: true,
      hardcoded: true,
    };

    res.json([fixedEntry, ...bpmnResults]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/requests', async (req, res) => {
  try {
    const {
      applicantName, nationalId, monthlyIncome = 0,
      employmentType = '', employer = '',
      cardType = 'Classic', creditLimitRequest = 0,
      processKey = 'creditCardSimple',
    } = req.body;

    if (!applicantName || !nationalId) {
      return res.status(400).json({ error: 'applicantName and nationalId are required' });
    }

    const allValidKeys = ['fixedFlow', ...creditProcesses().map(p => p.key)];
    if (!allValidKeys.includes(processKey)) {
      return res.status(400).json({ error: `invalid processKey. Valid: ${allValidKeys.join(', ')}` });
    }

    // ── Hardcoded path ──
    if (processKey === 'fixedFlow') {
      const result = await fixedFlowSubmit({
        applicantName, nationalId, monthlyIncome, employmentType, employer, cardType, creditLimitRequest,
      });
      return res.status(201).json(result);
    }

    // ── BPMN engine path ──
    const result = await flowable.post('/runtime/process-instances', {
      processDefinitionKey: processKey,
      businessKey: `req-${Date.now()}`,
      variables: [
        { name: 'applicantName', value: applicantName, type: 'string' },
        { name: 'nationalId', value: nationalId, type: 'string' },
        { name: 'monthlyIncome', value: Number(monthlyIncome), type: 'integer' },
        { name: 'employmentType', value: employmentType, type: 'string' },
        { name: 'employer', value: employer, type: 'string' },
        { name: 'cardType', value: cardType, type: 'string' },
        { name: 'creditLimitRequest', value: Number(creditLimitRequest), type: 'integer' },
        { name: 'processKey', value: processKey, type: 'string' },
      ],
    });

    const proc = PROCESS_CATALOG.find(p => p.key === processKey);
    res.status(201).json({
      id: result.data.id,
      businessKey: result.data.businessKey,
      status: 'pending',
      processKey,
      processName: proc?.name,
    });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.message || err.message });
  }
});

app.get('/api/requests', async (req, res) => {
  try {
    const allKeys = creditProcesses().map(p => p.key);

    const [activeResults, historyResults] = await Promise.all([
      Promise.all(allKeys.map(key =>
        flowable.get('/runtime/process-instances', { params: { processDefinitionKey: key, size: 100 } })
          .then(r => (r.data.data || []).map(p => ({ ...p, processKey: key })))
          .catch(() => [])
      )),
      Promise.all(allKeys.map(key =>
        flowable.get('/history/historic-process-instances', { params: { processDefinitionKey: key, finished: true, size: 100 } })
          .then(r => (r.data.data || []).map(p => ({ ...p, processKey: key })))
          .catch(() => [])
      )),
    ]);

    const activeAll = activeResults.flat();
    const historyAll = historyResults.flat();
    const activeIds = new Set(activeAll.map(p => p.id));

    const activeWithVars = await Promise.all(
      activeAll.map(async p => {
        const vars = await getVars(p.id, false);
        const proc = PROCESS_CATALOG.find(c => c.key === p.processKey);
        return { id: p.id, businessKey: p.businessKey, status: 'pending', startTime: p.startTime, processKey: p.processKey, processName: proc?.name, ...vars };
      })
    );

    const finishedWithVars = await Promise.all(
      historyAll
        .filter(p => !activeIds.has(p.id))
        .map(async p => {
          const vars = await getHistoricVars(p.id);
          const status = vars.approved === true ? 'approved' : vars.approved === false ? 'rejected' : 'completed';
          const proc = PROCESS_CATALOG.find(c => c.key === p.processKey);
          return { id: p.id, businessKey: p.businessKey, status, startTime: p.startTime, endTime: p.endTime, processKey: p.processKey, processName: proc?.name, ...vars };
        })
    );

    const all = [...fixedStore.requests, ...activeWithVars, ...finishedWithVars]
      .sort((a, b) => new Date(b.startTime) - new Date(a.startTime));

    res.json(all);
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.message || err.message });
  }
});

app.get('/api/tasks', async (req, res) => {
  try {
    const allKeys = creditProcesses().map(p => p.key);

    const taskResults = await Promise.all(
      allKeys.map(key =>
        flowable.get('/runtime/tasks', { params: { processDefinitionKey: key, size: 100 } })
          .then(r => (r.data.data || []).map(t => ({ ...t, processKey: key })))
          .catch(() => [])
      )
    );

    const bpmnTasks = await Promise.all(
      taskResults.flat().map(async task => {
        const vars = await getVars(task.processInstanceId, false);
        const proc = PROCESS_CATALOG.find(c => c.key === task.processKey);
        return {
          id: task.id,
          name: task.name,
          processInstanceId: task.processInstanceId,
          processKey: task.processKey,
          processName: proc?.name,
          created: task.createTime,
          priority: task.priority,
          ...vars,
        };
      })
    );

    res.json([...fixedStore.tasks, ...bpmnTasks]);
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.message || err.message });
  }
});

app.post('/api/tasks/:id/complete', async (req, res) => {
  try {
    const { approved, comment = '', reviewer = 'manager' } = req.body;
    if (typeof approved !== 'boolean') {
      return res.status(400).json({ error: 'approved (boolean) is required' });
    }

    // ── Hardcoded path ──
    if (req.params.id.startsWith('fixed-')) {
      const result = fixedFlowComplete(req.params.id, { approved, comment, reviewer });
      if (!result) return res.status(404).json({ error: 'task not found' });
      return res.json(result);
    }

    // ── BPMN engine path ──
    await flowable.post(`/runtime/tasks/${req.params.id}`, {
      action: 'complete',
      variables: [
        { name: 'approved', value: approved, type: 'boolean' },
        { name: 'comment', value: comment, type: 'string' },
        { name: 'reviewer', value: reviewer, type: 'string' },
      ],
    });

    res.json({ success: true, approved });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.message || err.message });
  }
});

// ─── Assignment workflow (single approver) ─────────────────────────────────
const ASSIGNMENT_KEY = 'assignmentFlow';

app.post('/api/assignments', async (req, res) => {
  try {
    const {
      debtorName, accountNo,
      assetType = 'NPL', assigneeType = 'legal_officer',
      requester = '', note = '',
    } = req.body;

    if (!debtorName || !accountNo) {
      return res.status(400).json({ error: 'debtorName and accountNo are required' });
    }

    const result = await flowable.post('/runtime/process-instances', {
      processDefinitionKey: ASSIGNMENT_KEY,
      businessKey: `asg-${Date.now()}`,
      variables: [
        { name: 'debtorName', value: debtorName, type: 'string' },
        { name: 'accountNo', value: accountNo, type: 'string' },
        { name: 'assetType', value: assetType, type: 'string' },
        { name: 'assigneeType', value: assigneeType, type: 'string' },
        { name: 'requester', value: requester, type: 'string' },
        { name: 'note', value: note, type: 'string' },
        { name: 'processKey', value: ASSIGNMENT_KEY, type: 'string' },
      ],
    });

    res.status(201).json({
      id: result.data.id,
      businessKey: result.data.businessKey,
      status: 'pending',
      processKey: ASSIGNMENT_KEY,
    });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.message || err.message });
  }
});

app.get('/api/assignments', async (req, res) => {
  try {
    const [activeRes, historyRes] = await Promise.all([
      flowable.get('/runtime/process-instances', { params: { processDefinitionKey: ASSIGNMENT_KEY, size: 100 } })
        .then(r => r.data.data || []).catch(() => []),
      flowable.get('/history/historic-process-instances', { params: { processDefinitionKey: ASSIGNMENT_KEY, finished: true, size: 100 } })
        .then(r => r.data.data || []).catch(() => []),
    ]);

    const activeIds = new Set(activeRes.map(p => p.id));

    const active = await Promise.all(activeRes.map(async p => {
      const vars = await getVars(p.id, false);
      return { id: p.id, businessKey: p.businessKey, status: 'pending', startTime: p.startTime, ...vars };
    }));

    const finished = await Promise.all(
      historyRes.filter(p => !activeIds.has(p.id)).map(async p => {
        const vars = await getHistoricVars(p.id);
        const status = vars.approved === true ? 'approved' : vars.approved === false ? 'rejected' : 'completed';
        return { id: p.id, businessKey: p.businessKey, status, startTime: p.startTime, endTime: p.endTime, ...vars };
      })
    );

    res.json([...active, ...finished].sort((a, b) => new Date(b.startTime) - new Date(a.startTime)));
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.message || err.message });
  }
});

app.get('/api/assignments/tasks', async (req, res) => {
  try {
    const r = await flowable.get('/runtime/tasks', { params: { processDefinitionKey: ASSIGNMENT_KEY, size: 100 } });
    const tasks = await Promise.all((r.data.data || []).map(async task => {
      const vars = await getVars(task.processInstanceId, false);
      return {
        id: task.id,
        name: task.name,
        processInstanceId: task.processInstanceId,
        created: task.createTime,
        ...vars,
      };
    }));
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.message || err.message });
  }
});

// ─── Case Intake workflow (flow 5: ตั้งเรื่องคดี → GLEAD อนุมัติ) ──────────
// Dual mode: ทุก action ยิง litigation-service จริง + sync สถานะเข้า Flowable engine
// ผูกกันด้วย businessKey = `tled-{tledId}`
const CASE_INTAKE_KEY = 'caseIntakeFlow';

const LITIGATION_BASE_URL = process.env.LITIGATION_API_URL || 'http://172.26.59.78/api/litigation-service';
const litigation = axios.create({
  baseURL: `${LITIGATION_BASE_URL}/api/v1`,
  timeout: 15000,
});

// ค่าจริงจาก GET /lookup/type/TRAN_STATUS และ ACTION_TYPE ของ litigation-service
const CI_STATUS = { DRAFT: 53, WAIT_GLEAD: 56, WAIT_LAW_ACK: 57, NOT_AGREE: 180 };
const CI_ACTION = { CONFIRM: 111, AGREE: 179, NOT_PASS: 422 };

async function findCaseInstance(tledId) {
  const r = await flowable.get('/runtime/process-instances', {
    params: { businessKey: `tled-${tledId}`, processDefinitionKey: CASE_INTAKE_KEY, size: 1 },
  });
  return r.data.data?.[0] || null;
}

async function startCaseInstance(tledId, extraVars = {}) {
  const variables = [
    { name: 'tledId', value: Number(tledId), type: 'integer' },
    { name: 'processKey', value: CASE_INTAKE_KEY, type: 'string' },
    ...Object.entries(extraVars).map(([name, v]) => (
      typeof v === 'number'
        ? { name, value: v, type: 'integer' }
        : { name, value: String(v ?? ''), type: 'string' }
    )),
  ];
  const r = await flowable.post('/runtime/process-instances', {
    processDefinitionKey: CASE_INTAKE_KEY,
    businessKey: `tled-${tledId}`,
    variables,
  });
  return r.data;
}

async function completeCaseTask(tledId, taskDefinitionKey, variables) {
  const inst = await findCaseInstance(tledId);
  if (!inst) return null;
  const t = await flowable.get('/runtime/tasks', {
    params: { processInstanceId: inst.id, taskDefinitionKey },
  });
  const task = t.data.data?.[0];
  if (!task) return null;
  await flowable.post(`/runtime/tasks/${task.id}`, { action: 'complete', variables });
  return task.id;
}

// onSaveNewCase() — สร้างเคสบน litigation-service + start Flowable instance
app.post('/api/case-intakes/create', async (req, res) => {
  try {
    const remote = await litigation.post('/case-intakes/create', req.body);
    const tledId = remote.data?.tledId ?? remote.data?.id ?? null;

    let flowableInstanceId = null;
    if (tledId != null) {
      try {
        const inst = await startCaseInstance(tledId, {
          fileNo: req.body.fileNo || '',
          subject: req.body.subject || '',
          statusTypeId: Number(req.body.statusTypeId) || CI_STATUS.DRAFT,
        });
        flowableInstanceId = inst.id;
        console.log(`✓ CaseIntake tled-${tledId}: Flowable instance ${inst.id}`);
      } catch (e) {
        console.log(`⚠ Flowable start failed for tled-${tledId}: ${e.message}`);
      }
    }

    res.status(201).json({ ...remote.data, flowableInstanceId });
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: err.response?.data?.message || err.message });
  }
});

// onSubmit() request 1 — saveAggregate ไป remote + complete task officerSubmit บน Flowable
app.post('/api/case-intakes/:id/save', async (req, res) => {
  try {
    const tledId = req.params.id;
    const remote = await litigation.post(`/case-intakes/${tledId}/save`, req.body);

    let flowableSynced = false;
    try {
      // เคสที่สร้างนอก POC (ไม่มี instance) → สร้างให้ก่อน
      if (!(await findCaseInstance(tledId))) {
        await startCaseInstance(tledId, { subject: req.body?.caseInfo?.subject || '' });
      }
      const done = await completeCaseTask(tledId, 'officerSubmit', [
        { name: 'statusTypeId', value: Number(req.body?.caseInfo?.statusTypeId) || CI_STATUS.WAIT_GLEAD, type: 'integer' },
        { name: 'subject', value: req.body?.caseInfo?.subject || '', type: 'string' },
      ]);
      flowableSynced = !!done;
      if (done) console.log(`✓ CaseIntake tled-${tledId}: officerSubmit completed`);
    } catch (e) {
      console.log(`⚠ Flowable sync (save) failed for tled-${tledId}: ${e.message}`);
    }

    res.json({ ...(remote.data || {}), success: true, flowableSynced });
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: err.response?.data?.message || err.message });
  }
});

// onSubmit() request 2 — forward createApproval ไป litigation-service
app.post('/api/case-intake-approvals/create', async (req, res) => {
  try {
    const remote = await litigation.post('/case-intake-approvals/create', req.body);
    res.status(201).json(remote.data ?? { success: true });
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: err.response?.data?.message || err.message });
  }
});

// GLEAD ตัดสิน — ประวัติ + เปลี่ยนสถานะบน remote + complete task gleadReview บน Flowable
app.post('/api/case-intakes/:id/decision', async (req, res) => {
  try {
    const tledId = req.params.id;
    const { approved, comment = '', reviewer = '' } = req.body;
    if (typeof approved !== 'boolean') {
      return res.status(400).json({ error: 'approved (boolean) is required' });
    }
    const note = reviewer ? `${comment}${comment ? ' ' : ''}— โดย ${reviewer}` : comment;

    // 1) ประวัติการพิจารณา (G เห็นชอบ / RJ ไม่ผ่าน)
    await litigation.post('/case-intake-approvals/create', {
      tledId: Number(tledId),
      actionTypeId: approved ? CI_ACTION.AGREE : CI_ACTION.NOT_PASS,
      action: approved ? 'เห็นชอบ' : 'ไม่ผ่านการพิจารณา',
      comment: note || null,
    });

    // 2) เปลี่ยนสถานะเรื่องบน litigation-service
    const cur = (await litigation.get(`/case-intakes/${tledId}`)).data;
    await litigation.post(`/case-intakes/update/${tledId}`, {
      fileNo: cur.fileNo,
      statusTypeId: approved ? CI_STATUS.WAIT_LAW_ACK : CI_STATUS.NOT_AGREE,
      stepId: cur.stepId ?? 1,
      departmentId: cur.departmentId ?? 10,
      buId: cur.buId ?? 10,
      subject: cur.subject,
      categoryId: cur.categoryId,
      typeId: cur.typeId,
      subTypeId: cur.subTypeId,
      detailTypeId: cur.detailTypeId,
      receivedDate: cur.receivedDate ?? null,
      description: cur.description ?? null,
      active: true,
    });

    // 3) sync Flowable: complete gleadReview (เคสเก่าไม่มี instance → สร้าง + fast-forward)
    let flowableSynced = false;
    try {
      if (!(await findCaseInstance(tledId))) {
        await startCaseInstance(tledId, { fileNo: cur.fileNo || '', subject: cur.subject || '' });
        await completeCaseTask(tledId, 'officerSubmit', [
          { name: 'statusTypeId', value: CI_STATUS.WAIT_GLEAD, type: 'integer' },
        ]);
      }
      const done = await completeCaseTask(tledId, 'gleadReview', [
        { name: 'approved', value: approved, type: 'boolean' },
        { name: 'comment', value: comment, type: 'string' },
        { name: 'reviewer', value: reviewer || 'glead', type: 'string' },
      ]);
      flowableSynced = !!done;
      if (done) console.log(`✓ CaseIntake tled-${tledId}: gleadReview completed (approved=${approved})`);
    } catch (e) {
      console.log(`⚠ Flowable sync (decision) failed for tled-${tledId}: ${e.message}`);
    }

    res.json({ success: true, approved, flowableSynced });
  } catch (err) {
    res.status(err.response?.status || 500).json({ error: err.response?.data?.message || err.message });
  }
});

app.get('/api/case-intakes', async (req, res) => {
  try {
    const [activeRes, historyRes] = await Promise.all([
      flowable.get('/runtime/process-instances', { params: { processDefinitionKey: CASE_INTAKE_KEY, size: 100 } })
        .then(r => r.data.data || []).catch(() => []),
      flowable.get('/history/historic-process-instances', { params: { processDefinitionKey: CASE_INTAKE_KEY, finished: true, size: 100 } })
        .then(r => r.data.data || []).catch(() => []),
    ]);

    const activeIds = new Set(activeRes.map(p => p.id));

    const active = await Promise.all(activeRes.map(async p => {
      const vars = await getVars(p.id, false);
      const status = vars.statusTypeId === 2 ? 'wait_glead' : 'draft';
      return { id: p.id, businessKey: p.businessKey, status, startTime: p.startTime, ...vars };
    }));

    const finished = await Promise.all(
      historyRes.filter(p => !activeIds.has(p.id)).map(async p => {
        const vars = await getHistoricVars(p.id);
        const status = vars.approved === true ? 'approved' : vars.approved === false ? 'rejected' : 'completed';
        return { id: p.id, businessKey: p.businessKey, status, startTime: p.startTime, endTime: p.endTime, ...vars };
      })
    );

    res.json([...active, ...finished].sort((a, b) => new Date(b.startTime) - new Date(a.startTime)));
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.message || err.message });
  }
});

app.get('/api/case-intakes/tasks', async (req, res) => {
  try {
    const r = await flowable.get('/runtime/tasks', { params: { processDefinitionKey: CASE_INTAKE_KEY, size: 100 } });
    const tasks = await Promise.all((r.data.data || []).map(async task => {
      const vars = await getVars(task.processInstanceId, false);
      return {
        id: task.id,
        name: task.name,
        taskDefinitionKey: task.taskDefinitionKey,
        processInstanceId: task.processInstanceId,
        created: task.createTime,
        ...vars,
      };
    }));
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.message || err.message });
  }
});

// ─── Helpers ────────────────────────────────────────────────────────────────

async function getVars(processInstanceId, historic) {
  try {
    const url = historic
      ? `/history/historic-variable-instances?processInstanceId=${processInstanceId}&size=200`
      : `/runtime/process-instances/${processInstanceId}/variables`;
    const res = await flowable.get(url);
    const list = res.data.data || res.data || [];
    const vars = flowableVarsToObject(list);
    return flattenCreditVars(vars);
  } catch {
    return {};
  }
}

async function getHistoricVars(processInstanceId) {
  return getVars(processInstanceId, true);
}

// ─── Live Monitor: running instances + current node ────────────────────────
async function getRunningInstances(processKey) {
  const keys = processKey ? [processKey] : PROCESS_CATALOG.map(p => p.key);

  const lists = await Promise.all(keys.map(key =>
    flowable.get('/runtime/process-instances', { params: { processDefinitionKey: key, size: 100 } })
      .then(r => (r.data.data || []).map(p => ({ ...p, processKey: key })))
      .catch(() => [])
  ));
  const instances = lists.flat();

  return Promise.all(instances.map(async p => {
    const [activities, vars] = await Promise.all([
      flowable.get('/history/historic-activity-instances', {
        params: { processInstanceId: p.id, finished: false, size: 50 },
      }).then(r => r.data.data || []).catch(() => []),
      getVars(p.id, false),
    ]);

    const currentActivities = activities.map(a => ({
      id: a.activityId,
      name: a.activityName || a.activityId,
      type: a.activityType,
    }));

    const proc = PROCESS_CATALOG.find(c => c.key === p.processKey);
    return {
      id: p.id,
      businessKey: p.businessKey,
      processKey: p.processKey,
      processName: proc?.name,
      applicantName: vars.applicantName || vars.debtorName || null,
      creditScore: vars.creditScore ?? null,
      startTime: p.startTime,
      currentActivities,
    };
  }));
}

app.get('/api/monitor/instances', async (req, res) => {
  try {
    const instances = await getRunningInstances(req.query.processKey);
    instances.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
    res.json(instances);
  } catch (err) {
    res.status(502).json({ error: err.response?.data?.message || err.message });
  }
});

// ─── BPMN Editor routes ─────────────────────────────────────────────────────

app.get('/api/bpmn/:key', (req, res) => {
  try {
    const proc = PROCESS_CATALOG.find(p => p.key === req.params.key);
    if (!proc) return res.status(404).json({ error: 'unknown process key' });
    const bpmnPath = path.join(__dirname, 'bpmn', proc.file);
    if (!fs.existsSync(bpmnPath)) return res.status(404).json({ error: 'BPMN file not found' });
    const xml = fs.readFileSync(bpmnPath, 'utf8');
    res.json({ xml, key: proc.key, file: proc.file });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/bpmn/:key/deploy', async (req, res) => {
  try {
    const proc = PROCESS_CATALOG.find(p => p.key === req.params.key);
    if (!proc) return res.status(404).json({ error: 'unknown process key' });
    const { xml } = req.body;
    if (!xml) return res.status(400).json({ error: 'xml is required' });

    fs.writeFileSync(path.join(__dirname, 'bpmn', proc.file), xml, 'utf8');

    if (proc.staticFile) {
      const staticPath = path.join(FRONTEND_PUBLIC_BPMN, proc.staticFile);
      if (fs.existsSync(path.dirname(staticPath))) {
        fs.writeFileSync(staticPath, xml, 'utf8');
      }
    }

    const form = new FormData();
    form.append('file', Buffer.from(xml), { filename: proc.file, contentType: 'application/xml' });
    const deployed = await flowable.post('/repository/deployments', form, { headers: form.getHeaders() });

    res.json({ success: true, deploymentId: deployed.data.id });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.message || err.message });
  }
});

// ─── Start ──────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;

(async () => {
  console.log('Starting Credit Card Approval POC backend...');
  await waitForFlowable();
  await deployAll();
  app.listen(PORT, () => {
    console.log(`✓ Backend listening on http://localhost:${PORT}`);
    console.log(`✓ Credit check API: http://localhost:${PORT}/api/external/credit-check/:nationalId`);
  });
})().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
