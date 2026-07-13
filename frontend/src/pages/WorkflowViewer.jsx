import { useCallback, useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import BpmnModelerLib from 'bpmn-js/lib/Modeler';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';
import { api } from '../api';
import BpmnCanvas from '../components/BpmnCanvas';
import FormEditor from './FormEditor';

const FLOWS = [
  {
    id: 'fixed',
    label: 'Fixed Flow',
    subtitle: 'Hardcoded Node.js decision tree',
    file: '/bpmn/fixed-flow.bpmn',
    color: '#0f766e',
    description: 'No BPMN runtime. Backend routes with if-else: score ≥ 700 auto-approve, 400–699 manager review, < 400 auto-reject.',
    editable: false,
  },
  {
    id: 'bpmn1',
    label: 'BPMN Simple',
    subtitle: 'HTTP Task + manager review',
    file: '/bpmn/credit-card-simple.bpmn',
    color: '#2563eb',
    description: 'Flowable runs the HTTP Task, stores credit check as process variables, then routes: score ≥ 700 auto-approve, 450–699 manager review, < 450 auto-reject.',
    editable: true,
    key: 'creditCardSimple',
  },
  {
    id: 'bpmn2',
    label: 'BPMN Advanced',
    subtitle: 'Manager + director approval',
    file: '/bpmn/credit-card-advanced.bpmn',
    color: '#b45309',
    description: 'Stricter flow. Auto-approve threshold is 750; medium scores require manager then director approval.',
    editable: true,
    key: 'creditCardAdvanced',
  },
  {
    id: 'assignment',
    label: 'Assignment Flow',
    subtitle: 'มอบหมายงาน — ผู้อนุมัติ 1 คน',
    file: '/bpmn/assignment-flow.bpmn',
    color: '#7c3aed',
    description: 'คำขอมอบหมายงานลูกหนี้ (NPL/NPA) ส่งให้ผู้อนุมัติ 1 คนพิจารณา — อนุมัติหรือไม่อนุมัติ รันบน Flowable engine ผ่านหน้าสร้างคำขอและหน้าอนุมัติ',
    editable: true,
    key: 'assignmentFlow',
  },
  {
    id: 'caseIntake',
    label: 'Case Intake',
    subtitle: 'ตั้งเรื่องคดี → GLEAD พิจารณา',
    file: '/bpmn/case-intake-flow.bpmn',
    color: '#0891b2',
    description: 'ตั้งเรื่องคดี (DRAFT) → เจ้าหน้าที่กรอกข้อมูลและยืนยัน (WAIT_GLEAD) → หัวหน้ากลุ่มงานกฎหมายพิจารณา รับเรื่อง/ตีกลับ — จำลอง flow จาก litigation-service (create + saveAggregate + approval)',
    editable: true,
    key: 'caseIntakeFlow',
  },
];

// ── Live monitor panel ───────────────────────────────────────────────────────
function MonitorPanel({ flow, instances, loading, error, selectedId, onSelect, onRefresh }) {
  return (
    <div style={{ width: 320, display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 12, border: `1px solid ${flow.color}30`, boxShadow: '0 1px 3px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>Running</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: flow.color, borderRadius: 99, padding: '1px 9px' }}>
            {instances.length}
          </span>
        </div>
        <button onClick={onRefresh} title="Refresh" style={{ border: '1px solid #e2e8f0', background: '#fff', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: '#475569' }}>
          ↻ refresh
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
        {error && (
          <div style={{ background: '#fee2e2', color: '#991b1b', padding: '8px 10px', borderRadius: 6, fontSize: 12, marginBottom: 8 }}>
            {error}
          </div>
        )}
        {!error && loading && instances.length === 0 && (
          <div style={{ color: '#94a3b8', fontSize: 13, padding: 8 }}>Loading...</div>
        )}
        {!error && !loading && instances.length === 0 && (
          <div style={{ color: '#94a3b8', fontSize: 13, padding: 8, textAlign: 'center' }}>
            ไม่มี instance กำลังทำงาน
          </div>
        )}

        {instances.map(inst => {
          const selected = inst.id === selectedId;
          const node = inst.currentActivities?.[0];
          return (
            <button
              key={inst.id}
              onClick={() => onSelect(inst.id)}
              style={{
                width: '100%', textAlign: 'left', cursor: 'pointer', marginBottom: 8,
                padding: '10px 12px', borderRadius: 8,
                border: selected ? `2px solid ${flow.color}` : '1px solid #e2e8f0',
                background: selected ? `${flow.color}0c` : '#fafafa',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>
                  {inst.applicantName || inst.businessKey}
                </span>
                {inst.creditScore != null && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: flow.color, background: `${flow.color}18`, borderRadius: 99, padding: '1px 8px' }}>
                    {inst.creditScore}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, fontFamily: 'monospace' }}>{inst.businessKey}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: '#16a34a', display: 'inline-block' }} />
                <span style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>
                  {node ? node.name : '—'}
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>
                {inst.startTime ? new Date(inst.startTime).toLocaleString() : ''}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Modeler (drag-drop editor) ───────────────────────────────────────────────
const BpmnEditor = forwardRef(function BpmnEditor({ xml, onDirty }, ref) {
  const containerRef = useRef(null);
  const modelerRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useImperativeHandle(ref, () => ({
    saveXML: () => modelerRef.current?.saveXML({ format: true }),
  }));

  useEffect(() => {
    if (!containerRef.current || !xml) return;
    let cancelled = false;

    const modeler = new BpmnModelerLib({ container: containerRef.current });
    modelerRef.current = modeler;

    modeler.importXML(xml)
      .then(() => {
        if (cancelled) return;
        modeler.get('canvas').zoom('fit-viewport', 'auto');
        setLoading(false);
      })
      .catch(err => {
        if (!cancelled) { setError(err.message); setLoading(false); }
      });

    modeler.on('commandStack.changed', onDirty);

    return () => {
      cancelled = true;
      modeler.destroy();
      modelerRef.current = null;
    };
  }, [xml]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      {loading && <Overlay color="#94a3b8">Loading editor...</Overlay>}
      {error && <Overlay color="#ef4444">Error: {error}</Overlay>}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
});

// ── Shared helpers ────────────────────────────────────────────────────────────
function Overlay({ color, children }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 1,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color, fontSize: 14,
    }}>
      {children}
    </div>
  );
}

function Toast({ type, message, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4500);
    return () => clearTimeout(t);
  }, [onClose]);

  const bg = type === 'success' ? '#16a34a' : '#dc2626';
  const icon = type === 'success' ? '✓' : '✕';

  return (
    <div style={{
      position: 'fixed', bottom: 28, right: 28, zIndex: 9999,
      padding: '12px 20px', borderRadius: 10,
      background: bg, color: '#fff',
      fontSize: 14, fontWeight: 600,
      boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
      display: 'flex', alignItems: 'center', gap: 8,
      animation: 'fadeInUp 0.2s ease',
    }}>
      {icon} {message}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function WorkflowViewer() {
  const [active, setActive] = useState('fixed');
  const [mode, setMode] = useState('view');
  const [editXml, setEditXml] = useState(null);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [toast, setToast] = useState(null);
  const editorRef = useRef(null);

  // Live monitor state
  const [liveMode, setLiveMode] = useState(false);
  const [instances, setInstances] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [monLoading, setMonLoading] = useState(false);
  const [monError, setMonError] = useState('');

  const flow = FLOWS.find(f => f.id === active);
  const liveActive = liveMode && flow.editable && mode === 'view';

  // Reset monitor state when switching tab
  useEffect(() => {
    setInstances([]);
    setSelectedId(null);
    setMonError('');
  }, [active]);

  // Poll running instances while live
  useEffect(() => {
    if (!liveActive) return;
    let cancelled = false;

    async function fetchInstances() {
      setMonLoading(true);
      try {
        const data = await api.getMonitorInstances(flow.key);
        if (cancelled) return;
        setInstances(data);
        setMonError('');
        setSelectedId(prev => (prev && data.some(i => i.id === prev) ? prev : (data[0]?.id || null)));
      } catch (err) {
        if (!cancelled) setMonError(err.message);
      } finally {
        if (!cancelled) setMonLoading(false);
      }
    }

    fetchInstances();
    const timer = setInterval(fetchInstances, 4000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [liveActive, flow.key]);

  const refreshMonitor = () => {
    if (!liveActive) return;
    api.getMonitorInstances(flow.key)
      .then(data => {
        setInstances(data);
        setMonError('');
        setSelectedId(prev => (prev && data.some(i => i.id === prev) ? prev : (data[0]?.id || null)));
      })
      .catch(err => setMonError(err.message));
  };

  const selectedInstance = instances.find(i => i.id === selectedId);
  const highlightIds = liveActive && selectedInstance
    ? (selectedInstance.currentActivities || []).map(a => a.id)
    : [];

  const exitEdit = (id) => {
    setMode('view');
    setEditXml(null);
    setDirty(false);
    if (id) setActive(id);
  };

  const handleTabChange = (id) => {
    if (mode === 'edit') {
      if (dirty && !window.confirm('มีการแก้ไขที่ยังไม่ได้บันทึก — ยืนยันออกจาก Edit mode?')) return;
      exitEdit(id);
    } else if (mode === 'form') {
      setMode('view');
      setActive(id);
    } else {
      setActive(id);
    }
  };

  const handleEdit = async () => {
    setLoadingEdit(true);
    try {
      const { xml } = await api.getBpmn(flow.key);
      setEditXml(xml);
      setMode('edit');
      setDirty(false);
    } catch (err) {
      setToast({ type: 'error', message: `โหลด XML ล้มเหลว: ${err.message}` });
    } finally {
      setLoadingEdit(false);
    }
  };

  const handleCancel = () => {
    if (dirty && !window.confirm('มีการแก้ไขที่ยังไม่ได้บันทึก — ยืนยันยกเลิก?')) return;
    exitEdit();
  };

  const handleSaveDeploy = async () => {
    if (!editorRef.current) return;
    setSaving(true);
    try {
      const { xml } = await editorRef.current.saveXML();
      await api.deployBpmn(flow.key, xml);
      setToast({ type: 'success', message: `Deploy "${flow.label}" สำเร็จ` });
      exitEdit();
    } catch (err) {
      setToast({ type: 'error', message: `Deploy ล้มเหลว: ${err.message}` });
    } finally {
      setSaving(false);
    }
  };

  const markDirty = useCallback(() => setDirty(true), []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)' }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a' }}>Workflow Viewer</h1>
        <p style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>
          Compare the hardcoded credit-card flow against two BPMN engine definitions.
        </p>
      </div>

      {/* Tabs row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {FLOWS.map(f => (
          <button
            key={f.id}
            onClick={() => handleTabChange(f.id)}
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: active === f.id ? `2px solid ${f.color}` : '2px solid #e2e8f0',
              background: active === f.id ? `${f.color}15` : '#fff',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 14, color: active === f.id ? f.color : '#374151' }}>
              {f.label}{active === f.id && mode === 'edit' ? ' ✏️' : ''}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{f.subtitle}</div>
          </button>
        ))}

        <div style={{ flex: 1 }} />

        {mode === 'view' && (
          <button
            onClick={() => setLiveMode(v => !v)}
            disabled={!flow.editable}
            title={flow.editable ? 'Toggle live monitor' : 'Fixed flow ไม่ได้รันบน engine'}
            style={{
              padding: '9px 18px',
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 14,
              cursor: flow.editable ? 'pointer' : 'not-allowed',
              border: liveActive ? '2px solid #16a34a' : '2px solid #e2e8f0',
              background: liveActive ? '#16a34a' : '#fff',
              color: liveActive ? '#fff' : (flow.editable ? '#374151' : '#cbd5e1'),
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{ width: 9, height: 9, borderRadius: 99, background: liveActive ? '#fff' : '#cbd5e1', display: 'inline-block' }} />
            {liveActive ? 'Live ON' : 'Live'}
          </button>
        )}

        {mode === 'view' && flow.editable && (
          <button
            onClick={() => setMode('form')}
            style={{
              padding: '9px 20px',
              borderRadius: 8,
              border: `2px solid ${flow.color}`,
              background: '#fff',
              color: flow.color,
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            📋 Form Edit
          </button>
        )}

        {mode === 'view' && flow.editable && (
          <button
            onClick={handleEdit}
            disabled={loadingEdit}
            style={{
              padding: '9px 20px',
              borderRadius: 8,
              border: `2px solid ${flow.color}`,
              background: '#fff',
              color: flow.color,
              fontWeight: 600,
              fontSize: 14,
              cursor: loadingEdit ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              opacity: loadingEdit ? 0.6 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            {loadingEdit ? '⏳' : '✏️'} {loadingEdit ? 'กำลังโหลด...' : 'Diagram Edit'}
          </button>
        )}

        {mode === 'edit' && (
          <>
            <button
              onClick={handleCancel}
              disabled={saving}
              style={{
                padding: '9px 20px',
                borderRadius: 8,
                border: '2px solid #e2e8f0',
                background: '#fff',
                color: '#64748b',
                fontWeight: 600,
                fontSize: 14,
                cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              ✕ Cancel
            </button>
            <button
              onClick={handleSaveDeploy}
              disabled={saving}
              style={{
                padding: '9px 20px',
                borderRadius: 8,
                border: 'none',
                background: saving ? '#94a3b8' : '#2563eb',
                color: '#fff',
                fontWeight: 700,
                fontSize: 14,
                cursor: saving ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'background 0.15s',
              }}
            >
              {saving ? '⏳ Deploying...' : '🚀 Save & Deploy'}
            </button>
          </>
        )}
      </div>

      {/* Description bar */}
      <div style={{
        padding: '10px 16px',
        background: `${flow.color}10`,
        borderLeft: `4px solid ${flow.color}`,
        borderRadius: '0 6px 6px 0',
        marginBottom: 12,
        fontSize: 13,
        color: '#374151',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
      }}>
        <span>
          <strong style={{ color: flow.color }}>{flow.label}:</strong> {flow.description}
        </span>
        {mode === 'edit' && (
          <span style={{
            marginLeft: 'auto',
            background: dirty ? '#fef3c7' : '#f0fdf4',
            color: dirty ? '#92400e' : '#166534',
            padding: '2px 10px',
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 700,
            whiteSpace: 'nowrap',
          }}>
            {dirty ? '● Unsaved changes' : '✓ No changes'}
          </span>
        )}
      </div>

      {/* Canvas + optional monitor panel */}
      <div style={{ flex: 1, display: 'flex', gap: 12, minHeight: 400 }}>
        <div style={{
          flex: 1,
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
          overflow: 'hidden',
          border: mode === 'edit' ? `2px solid ${flow.color}` : `1px solid ${flow.color}30`,
          transition: 'border 0.2s',
        }}>
          {mode === 'view' && <BpmnCanvas key={flow.file} file={flow.file} color={flow.color} highlightIds={highlightIds} />}
          {mode === 'edit' && <BpmnEditor key={`editor-${flow.id}`} ref={editorRef} xml={editXml} onDirty={markDirty} />}
          {mode === 'form' && (
            <FormEditor
              key={`form-${flow.id}`}
              flowKey={flow.key}
              flowFile={flow.file}
              flowLabel={flow.label}
              color={flow.color}
              onDone={(message, type) => { setMode('view'); if (message) setToast({ type, message }); }}
            />
          )}
        </div>

        {liveActive && (
          <MonitorPanel
            flow={flow}
            instances={instances}
            loading={monLoading}
            error={monError}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onRefresh={refreshMonitor}
          />
        )}
      </div>

      {/* Hints */}
      <div style={{ display: 'flex', gap: 20, marginTop: 10, fontSize: 12, color: '#94a3b8' }}>
        {mode === 'view' && (
          <>
            <span>Scroll to zoom</span>
            <span>Drag to pan</span>
            {liveActive && <span style={{ color: '#16a34a', fontWeight: 600 }}>● node เขียว = instance ค้างที่ขั้นนี้</span>}
          </>
        )}
        {mode === 'edit' && (
          <>
            <span>Drag shapes from palette</span>
            <span>Double-click to edit labels</span>
            <span>Changes deploy as a new Flowable version</span>
          </>
        )}
        {mode === 'form' && (
          <>
            <span>แก้ค่าในช่อง แล้วกด Save &amp; Deploy</span>
            <span>โครงสร้าง (เพิ่ม/ลบ node) ใช้ Diagram Edit</span>
            <span>Changes deploy as a new Flowable version</span>
          </>
        )}
      </div>

      {toast && (
        <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
