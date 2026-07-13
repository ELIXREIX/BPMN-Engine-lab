import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';

const THEME = '#7c3aed';

const inputStyle = {
  width: '100%',
  padding: '9px 12px',
  border: '1px solid #e2e8f0',
  borderRadius: 6,
  fontSize: 14,
  background: '#fff',
  color: '#1e293b',
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: '#374151',
  marginBottom: 6,
};

const ASSIGNEE_TYPES = [
  { value: 'legal_officer', label: 'นิติกร (ภายในหน่วยงาน)' },
  { value: 'law_firm', label: 'สำนักกฎหมาย (ภายนอกหน่วยงาน)' },
];

const initialForm = {
  debtorName: '',
  accountNo: '',
  assetType: 'NPL',
  assigneeType: 'legal_officer',
  requester: '',
  note: '',
};

export default function NewAssignment() {
  const nav = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const set = (key) => (event) => setForm(f => ({ ...f, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const result = await api.createAssignment({
        debtorName: form.debtorName.trim(),
        accountNo: form.accountNo.trim(),
        assetType: form.assetType,
        assigneeType: form.assigneeType,
        requester: form.requester.trim(),
        note: form.note.trim(),
      });
      setSuccess(`สร้างคำขอมอบหมายงานสำเร็จ (${result.businessKey}) — รอผู้อนุมัติพิจารณา`);
      setForm(initialForm);
      setTimeout(() => nav('/assignment/approvals'), 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 760 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 6, color: '#0f172a' }}>สร้างคำขอมอบหมายงาน</h1>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 28 }}>
        ส่งคำขอมอบหมายงานลูกหนี้ (NPL/NPA) ให้ผู้อนุมัติ 1 คนพิจารณา —{' '}
        <Link to="/workflow" style={{ color: THEME }}>ดู diagram</Link>
        {' | '}
        <Link to="/assignment/approvals" style={{ color: THEME }}>ไปหน้าอนุมัติ</Link>
      </p>

      <div style={{ background: '#fff', borderRadius: 12, padding: 28, boxShadow: '0 1px 3px rgba(0,0,0,0.07)', borderTop: `4px solid ${THEME}` }}>
        <form onSubmit={submit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 18 }}>
            <div>
              <label style={labelStyle}>ชื่อลูกหนี้ *</label>
              <input style={inputStyle} value={form.debtorName} onChange={set('debtorName')} placeholder="บริษัท ตัวอย่าง จำกัด" required />
            </div>
            <div>
              <label style={labelStyle}>เลขที่บัญชี *</label>
              <input style={inputStyle} value={form.accountNo} onChange={set('accountNo')} placeholder="123-4-56789-0" required />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 18 }}>
            <div>
              <label style={labelStyle}>ประเภทสินทรัพย์ *</label>
              <select style={inputStyle} value={form.assetType} onChange={set('assetType')} required>
                <option value="NPL">NPL — หนี้ด้อยคุณภาพ</option>
                <option value="NPA">NPA — ทรัพย์สินรอการขาย</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>ผู้รับผิดชอบที่เสนอ *</label>
              <select style={inputStyle} value={form.assigneeType} onChange={set('assigneeType')} required>
                {ASSIGNEE_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>ผู้สร้างคำขอ</label>
            <input style={inputStyle} value={form.requester} onChange={set('requester')} placeholder="ชื่อผู้ดูแลหน่วยงาน" />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={labelStyle}>รายละเอียด / หมายเหตุ</label>
            <textarea
              style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }}
              value={form.note}
              onChange={set('note')}
              placeholder="รายละเอียดงานที่มอบหมาย"
            />
          </div>

          {error && (
            <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 6, fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{ background: '#d1fae5', color: '#065f46', padding: '10px 14px', borderRadius: 6, fontSize: 13, marginBottom: 16 }}>
              {success}
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            width: '100%',
            padding: '11px',
            background: loading ? '#c4b5fd' : THEME,
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}>
            {loading ? 'กำลังส่ง...' : 'ส่งคำขอมอบหมายงาน'}
          </button>
        </form>
      </div>
    </div>
  );
}
