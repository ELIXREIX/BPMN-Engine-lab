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
];

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
      PROCESS_CATALOG.map(async proc => {
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

    const allValidKeys = ['fixedFlow', ...PROCESS_CATALOG.map(p => p.key)];
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
    const allKeys = PROCESS_CATALOG.map(p => p.key);

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
    const allKeys = PROCESS_CATALOG.map(p => p.key);

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

// ─── Helpers ────────────────────────────────────────────────────────────────

async function getVars(processInstanceId, historic) {
  try {
    const url = historic
      ? `/history/historic-variable-instances?processInstanceId=${processInstanceId}`
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
      applicantName: vars.applicantName || null,
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
