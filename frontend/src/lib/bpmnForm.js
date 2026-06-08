// Pure BPMN <-> form model helpers. Browser-only (uses DOMParser / XMLSerializer).
// Scope: edits PARAMETERS of known node types in this project's credit-card BPMNs.
// Structure (add/remove nodes, draw flows) is out of scope — that stays in the Modeler.

const TYPE_LABEL = {
  process: 'Process',
  startEvent: 'Start',
  endEvent: 'End',
  serviceTask: 'Service Task (HTTP)',
  userTask: 'User Task',
  exclusiveGateway: 'Gateway',
  sequenceFlow: 'Sequence Flow',
};

function parseDoc(xml) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) {
    throw new Error('XML parse error');
  }
  return doc;
}

function flowableField(el, name) {
  const fields = el.getElementsByTagName('flowable:field');
  for (let i = 0; i < fields.length; i += 1) {
    if (fields[i].getAttribute('name') === name) return fields[i];
  }
  return null;
}

function childByTag(el, tag) {
  for (const c of el.children) {
    if (c.tagName === tag) return c;
  }
  return null;
}

// ── Getters (DOM -> value) ──────────────────────────────────────────────────
function getFieldExpression(el, name) {
  const f = flowableField(el, name);
  if (!f) return '';
  const expr = childByTag(f, 'flowable:expression');
  if (expr) return (expr.textContent || '').trim();
  return f.getAttribute('stringValue') || '';
}

function getFieldString(el, name) {
  const f = flowableField(el, name);
  if (!f) return '';
  return f.getAttribute('stringValue') || (childByTag(f, 'flowable:expression')?.textContent || '').trim();
}

function getResponseVars(el) {
  const out = [];
  const listeners = el.getElementsByTagName('flowable:executionListener');
  for (let i = 0; i < listeners.length; i += 1) {
    const expr = listeners[i].getAttribute('expression') || '';
    const m = expr.match(/setVariable\(\s*'([^']+)'/);
    if (m) out.push(m[1]);
  }
  return out;
}

// ── Setters (value -> DOM) ──────────────────────────────────────────────────
function setAttr(el, attr, value) {
  if (value === '' || value == null) el.removeAttribute(attr);
  else el.setAttribute(attr, value);
}

function setChildText(doc, el, tag, value) {
  let child = childByTag(el, tag);
  if (!child) {
    if (value === '' || value == null) return;
    child = doc.createElementNS(el.namespaceURI, tag);
    el.appendChild(child);
  }
  child.textContent = value;
}

function setChildCData(doc, el, tag, value) {
  const child = childByTag(el, tag);
  if (!child) return;
  while (child.firstChild) child.removeChild(child.firstChild);
  child.appendChild(doc.createCDATASection(value));
}

function setFieldExpression(doc, el, name, value) {
  const f = flowableField(el, name);
  if (!f) return;
  const expr = childByTag(f, 'flowable:expression');
  if (expr) {
    while (expr.firstChild) expr.removeChild(expr.firstChild);
    expr.appendChild(doc.createCDATASection(value));
  } else {
    f.setAttribute('stringValue', value);
  }
}

function setFieldString(el, name, value) {
  const f = flowableField(el, name);
  if (f) f.setAttribute('stringValue', value);
}

// fieldKey -> setter applied to its element
const SETTERS = {
  name: (doc, el, v) => setAttr(el, 'name', v),
  documentation: (doc, el, v) => setChildText(doc, el, 'documentation', v),
  conditionExpression: (doc, el, v) => setChildCData(doc, el, 'conditionExpression', v),
  requestUrl: (doc, el, v) => setFieldExpression(doc, el, 'requestUrl', v),
  requestMethod: (doc, el, v) => setFieldString(el, 'requestMethod', v),
  responseVariableName: (doc, el, v) => setFieldString(el, 'responseVariableName', v),
  candidateGroups: (doc, el, v) => setAttr(el, 'flowable:candidateGroups', v),
  assignee: (doc, el, v) => setAttr(el, 'flowable:assignee', v),
  default: (doc, el, v) => setAttr(el, 'default', v),
};

// ── Per-type field extraction ───────────────────────────────────────────────
function extractFields(el, type) {
  const name = el.getAttribute('name') || '';

  if (type === 'serviceTask') {
    return {
      fields: [
        { key: 'name', label: 'Name', kind: 'text', value: name },
        { key: 'requestMethod', label: 'HTTP Method', kind: 'select', value: getFieldString(el, 'requestMethod') || 'GET', options: ['GET', 'POST', 'PUT', 'DELETE'] },
        { key: 'requestUrl', label: 'API endpoint (รับค่าจาก API นี้)', kind: 'text', value: getFieldExpression(el, 'requestUrl'), help: 'ใช้ ${nationalId} แทนค่าจาก process variable' },
        { key: 'responseVariableName', label: 'Response variable', kind: 'text', value: getFieldString(el, 'responseVariableName') },
      ],
      responseVars: getResponseVars(el),
    };
  }

  if (type === 'userTask') {
    return {
      fields: [
        { key: 'name', label: 'Name', kind: 'text', value: name },
        { key: 'candidateGroups', label: 'Approver groups', kind: 'text', value: el.getAttribute('flowable:candidateGroups') || '', help: 'เช่น managers, directors' },
        { key: 'assignee', label: 'Assignee', kind: 'text', value: el.getAttribute('flowable:assignee') || '' },
        { key: 'documentation', label: 'Documentation', kind: 'textarea', value: childByTag(el, 'documentation')?.textContent?.trim() || '' },
      ],
    };
  }

  if (type === 'sequenceFlow') {
    return {
      fields: [
        { key: 'name', label: 'Label', kind: 'text', value: name },
        { key: 'conditionExpression', label: 'Condition', kind: 'text', value: childByTag(el, 'conditionExpression')?.textContent?.trim() || '', help: 'ใช้ตัวแปร creditScore เช่น ${creditScore >= 700}' },
      ],
    };
  }

  if (type === 'exclusiveGateway') {
    return {
      fields: [
        { key: 'name', label: 'Name', kind: 'text', value: name },
        { key: 'default', label: 'Default flow id', kind: 'text', value: el.getAttribute('default') || '' },
      ],
    };
  }

  // startEvent, endEvent
  return { fields: [{ key: 'name', label: 'Name', kind: 'text', value: name }] };
}

const NODE_TYPES = ['startEvent', 'serviceTask', 'userTask', 'exclusiveGateway', 'sequenceFlow', 'endEvent'];

// ── Public API ──────────────────────────────────────────────────────────────
export function parseBpmnToModel(xml) {
  const doc = parseDoc(xml);
  const proc = doc.getElementsByTagName('process')[0];
  if (!proc) throw new Error('no <process> in BPMN');

  const nodes = [];
  for (const el of proc.children) {
    const type = el.tagName;
    if (!NODE_TYPES.includes(type)) continue;
    const id = el.getAttribute('id');
    const { fields, responseVars } = extractFields(el, type);
    const name = el.getAttribute('name');
    nodes.push({
      id,
      type,
      typeLabel: TYPE_LABEL[type] || type,
      title: name || id,
      fields,
      responseVars: responseVars || null,
    });
  }

  return {
    processId: proc.getAttribute('id'),
    processName: proc.getAttribute('name') || '',
    nodes,
  };
}

export function applyModelToXml(xml, model) {
  const doc = parseDoc(xml);

  const proc = doc.getElementsByTagName('process')[0];
  setAttr(proc, 'name', model.processName);

  for (const node of model.nodes) {
    const el = doc.querySelector(`[id="${node.id}"]`);
    if (!el) continue;
    for (const f of node.fields) {
      const setter = SETTERS[f.key];
      if (setter) setter(doc, el, f.value);
    }
  }

  let out = new XMLSerializer().serializeToString(doc);
  if (!out.startsWith('<?xml')) {
    out = '<?xml version="1.0" encoding="UTF-8"?>\n' + out;
  }
  return out;
}
