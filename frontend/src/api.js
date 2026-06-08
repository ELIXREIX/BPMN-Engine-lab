const BASE = '/api';

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
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
};
