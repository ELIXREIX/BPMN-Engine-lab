import { useEffect, useState } from 'react';
import { api } from '../api';
import BpmnCanvas from '../components/BpmnCanvas';
import { parseBpmnToModel, applyModelToXml } from '../lib/bpmnForm';

const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 };

function baseInput(active, color) {
  return {
    width: '100%', padding: '8px 10px', borderRadius: 6, fontSize: 13,
    background: '#fff', color: '#1e293b', outline: 'none', boxSizing: 'border-box',
    fontFamily: 'monospace',
    border: `1px solid ${active ? color : '#e2e8f0'}`,
    boxShadow: active ? `0 0 0 3px ${color}33` : 'none',
    transition: 'box-shadow 0.12s, border-color 0.12s',
  };
}

export default function FormEditor({ flowKey, flowFile, flowLabel, color, onDone }) {
  const [xml, setXml] = useState('');
  const [model, setModel] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [activeFieldKey, setActiveFieldKey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getBpmn(flowKey)
      .then(({ xml }) => {
        if (cancelled) return;
        const m = parseBpmnToModel(xml);
        setXml(xml);
        setModel(m);
        setSelectedNodeId(m.nodes[0]?.id || null);
        setError('');
      })
      .catch(err => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [flowKey]);

  const setFieldValue = (fieldKey, value) => {
    setModel(m => ({
      ...m,
      nodes: m.nodes.map(n => n.id !== selectedNodeId ? n : {
        ...n,
        fields: n.fields.map(f => f.key === fieldKey ? { ...f, value } : f),
      }),
    }));
    setDirty(true);
  };

  const pickNode = (id) => {
    if (model?.nodes.some(n => n.id === id)) {
      setSelectedNodeId(id);
      setActiveFieldKey(null);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.deployBpmn(flowKey, applyModelToXml(xml, model));
      onDone(`Deploy "${flowLabel}" สำเร็จ`, 'success');
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  const cancel = () => {
    if (dirty && !window.confirm('มีการแก้ไขที่ยังไม่ได้บันทึก — ยืนยันออก?')) return;
    onDone();
  };

  if (loading) return <Center color="#94a3b8">Loading form...</Center>;
  if (error && !model) return <Center color="#ef4444">Error: {error}</Center>;
  if (!model) return null;

  const node = model.nodes.find(n => n.id === selectedNodeId);
  const activeField = node?.fields.find(f => f.key === activeFieldKey);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 10 }}>
        <strong style={{ fontSize: 14, color: '#0f172a' }}>Form Edit</strong>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>คลิก node บนไดอะแกรม หรือเลือกจากรายการ</span>
        {dirty && <span style={{ fontSize: 11, fontWeight: 700, color: '#92400e', background: '#fef3c7', padding: '2px 9px', borderRadius: 99 }}>● unsaved</span>}
        <div style={{ flex: 1 }} />
        <button onClick={cancel} disabled={saving} style={btn('#fff', '#64748b', '#e2e8f0')}>✕ Cancel</button>
        <button onClick={save} disabled={saving} style={btn(saving ? '#94a3b8' : color, '#fff', 'transparent')}>
          {saving ? '⏳ Deploying...' : '🚀 Save & Deploy'}
        </button>
      </div>

      {error && <div style={{ background: '#fee2e2', color: '#991b1b', padding: '8px 14px', fontSize: 13 }}>{error}</div>}

      {/* Split: diagram | form */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Diagram (click to pick) */}
        <div style={{ flex: 1.25, borderRight: '1px solid #f1f5f9', position: 'relative' }}>
          <BpmnCanvas file={flowFile} color={color} pickId={selectedNodeId} onElementClick={pickNode} />
        </div>

        {/* Form pane */}
        <div style={{ flex: 1, minWidth: 360, display: 'flex', flexDirection: 'column' }}>
          {/* node picker */}
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9' }}>
            <label style={labelStyle}>Node</label>
            <select
              value={selectedNodeId || ''}
              onChange={e => pickNode(e.target.value)}
              style={{ ...baseInput(false, color), fontFamily: 'inherit', cursor: 'pointer' }}
            >
              {model.nodes.map(n => (
                <option key={n.id} value={n.id}>{n.typeLabel} — {n.title}</option>
              ))}
            </select>
          </div>

          {/* breadcrumb */}
          <div style={{ padding: '8px 14px', background: `${color}0c`, borderBottom: `1px solid ${color}22`, fontSize: 12, color: '#475569', position: 'sticky', top: 0 }}>
            กำลังแก้:{' '}
            <strong style={{ color }}>{node?.typeLabel}</strong>
            {' · '}
            <strong style={{ color: '#0f172a' }}>{node?.title}</strong>
            {activeField && <> {' › '} <strong style={{ color }}>{activeField.label}</strong></>}
          </div>

          {/* fields of selected node */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
            {node?.fields.map(f => {
              const active = activeFieldKey === f.key;
              return (
                <div key={f.key} style={{ marginBottom: 14 }}>
                  <label style={{ ...labelStyle, color: active ? color : '#374151' }}>{f.label}</label>
                  {f.kind === 'select' ? (
                    <select
                      style={{ ...baseInput(active, color) }}
                      value={f.value}
                      onFocus={() => setActiveFieldKey(f.key)}
                      onBlur={() => setActiveFieldKey(null)}
                      onChange={e => setFieldValue(f.key, e.target.value)}
                    >
                      {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : f.kind === 'textarea' ? (
                    <textarea
                      style={{ ...baseInput(active, color), minHeight: 60, resize: 'vertical' }}
                      value={f.value}
                      onFocus={() => setActiveFieldKey(f.key)}
                      onBlur={() => setActiveFieldKey(null)}
                      onChange={e => setFieldValue(f.key, e.target.value)}
                    />
                  ) : (
                    <input
                      style={{ ...baseInput(active, color) }}
                      value={f.value}
                      onFocus={() => setActiveFieldKey(f.key)}
                      onBlur={() => setActiveFieldKey(null)}
                      onChange={e => setFieldValue(f.key, e.target.value)}
                    />
                  )}
                  {f.help && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>{f.help}</div>}
                </div>
              );
            })}

            {node?.responseVars?.length > 0 && (
              <div style={{ marginTop: 4, padding: 10, background: '#f8fafc', borderRadius: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 5 }}>ค่าที่ได้จาก API → process variables</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {node.responseVars.map(v => (
                    <span key={v} style={{ fontSize: 11, fontFamily: 'monospace', background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', padding: '2px 8px', borderRadius: 6 }}>{v}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function btn(bg, fg, border) {
  return { padding: '8px 16px', borderRadius: 8, border: `2px solid ${border}`, background: bg, color: fg, fontWeight: 700, fontSize: 13, cursor: 'pointer' };
}

function Center({ color, children }) {
  return <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color, fontSize: 14 }}>{children}</div>;
}
