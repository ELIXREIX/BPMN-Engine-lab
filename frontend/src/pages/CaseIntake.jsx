import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, TRAN_STATUS, ACTION_TYPE, CASE_STATUS_LABEL, DRAFT_STATUSES } from '../api';

const THEME = '#0891b2';

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

// Master data จำลอง — id ตรงกับ demo request ของ litigation-service
const CATEGORIES = [
  { id: 101, label: 'คดีแพ่ง' },
  { id: 102, label: 'คดีล้มละลาย' },
];
const TYPES = [
  { id: 201, label: 'ผิดสัญญาเช่าซื้อ' },
  { id: 202, label: 'ผิดสัญญากู้ยืม' },
];
const SUBTYPES = [
  { id: 301, label: 'รถยนต์' },
  { id: 302, label: 'ที่ดิน/สิ่งปลูกสร้าง' },
];
const DETAIL_TYPES = [
  { id: 401, label: 'ผิดนัดชำระหนี้ตามสัญญาเช่าซื้อ' },
  { id: 402, label: 'บอกเลิกสัญญาและเรียกค่าเสียหาย' },
];

function genFileNo() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const running = String(Math.floor(Math.random() * 9000) + 1000);
  return `${pad(d.getDate())}${pad(d.getMonth() + 1)}${d.getFullYear() + 543}พจ${running}`;
}

function StatusBadge({ statusTypeId }) {
  const meta = CASE_STATUS_LABEL[statusTypeId] || { bg: '#e2e8f0', text: '#475569', label: `status ${statusTypeId}` };
  return (
    <span style={{ padding: '1px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: meta.bg, color: meta.text }}>
      {meta.label}
    </span>
  );
}

// ── ฟอร์มยืนยันข้อมูล (onSubmit: saveAggregate + createApproval) ─────────────
function SubmitPanel({ item, onDone }) {
  const [form, setForm] = useState({
    entityName: '', lastName: '', idCardNumber: '',
    contractNo: '', principalOutstanding: '', interestOutstanding: '',
    opinionDetail: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  const submit = async () => {
    setError('');
    if (!form.entityName || !form.contractNo) {
      setError('กรอกชื่อลูกหนี้และเลขที่สัญญาก่อนยืนยัน');
      return;
    }
    setLoading(true);
    const principal = Number(form.principalOutstanding) || 0;
    const interest = Number(form.interestOutstanding) || 0;
    try {
      // request 1: saveAggregate (บันทึก 3 tab + สถานะ WAIT_GLEAD)
      await api.saveCaseIntake(item.tledId, {
        caseInfo: {
          statusTypeId: TRAN_STATUS.WAIT_GLEAD,
          stepId: item.stepId ?? 1,
          departmentId: item.departmentId ?? 10,
          buId: item.buId ?? 10,
          subject: item.subject,
          description: item.description || '',
          receivedDate: item.receivedDate || null,
          categoryId: item.categoryId,
          typeId: item.typeId,
          subTypeId: item.subTypeId,
          detailTypeId: item.detailTypeId,
          priorityId: 2,
          active: true,
        },
        createdBy: 1001,
        debtors: [{
          stakeholderId: null,
          entityName: form.entityName,
          lastName: form.lastName,
          idCardNumber: form.idCardNumber,
          address: '',
          remark: null,
        }],
        contracts: [{
          contractNo: form.contractNo,
          contractTypeId: 501,
          principalOutstanding: principal,
          interestOutstanding: interest,
          feeOutstanding: 0,
        }],
        collaterals: [],
        documentChecks: [],
        factChecks: [],
        claimBasisIds: [],
        legalAnalysis: {
          opinionDetail: form.opinionDetail,
          totalPrincipal: principal,
          totalInterest: interest,
          totalFee: 0,
          totalFiling: principal + interest,
        },
      });
      // request 2: createApproval (ประวัติ "ยืนยันข้อมูล" — ACTION_TYPE code C)
      await api.createCaseIntakeApproval({ tledId: item.tledId, actionTypeId: ACTION_TYPE.CONFIRM, action: 'ยืนยันข้อมูล' });
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ borderTop: '1px solid #f1f5f9', padding: '16px 20px', background: '#fafafa' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: THEME, marginBottom: 12 }}>
        กรอกข้อมูลคดี แล้วยืนยันข้อมูล → ส่งให้ GLEAD พิจารณา
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={labelStyle}>ชื่อลูกหนี้ *</label>
          <input style={inputStyle} value={form.entityName} onChange={set('entityName')} placeholder="นายสมชาย" />
        </div>
        <div>
          <label style={labelStyle}>นามสกุล</label>
          <input style={inputStyle} value={form.lastName} onChange={set('lastName')} placeholder="ใจดี" />
        </div>
        <div>
          <label style={labelStyle}>เลขบัตรประชาชน</label>
          <input style={inputStyle} value={form.idCardNumber} onChange={set('idCardNumber')} placeholder="1234567890123" />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={labelStyle}>เลขที่สัญญา *</label>
          <input style={inputStyle} value={form.contractNo} onChange={set('contractNo')} placeholder="CT-2569-0001" />
        </div>
        <div>
          <label style={labelStyle}>เงินต้นคงค้าง</label>
          <input style={inputStyle} type="number" min="0" value={form.principalOutstanding} onChange={set('principalOutstanding')} placeholder="320000" />
        </div>
        <div>
          <label style={labelStyle}>ดอกเบี้ยคงค้าง</label>
          <input style={inputStyle} type="number" min="0" value={form.interestOutstanding} onChange={set('interestOutstanding')} placeholder="18500" />
        </div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={labelStyle}>ความเห็นทางกฎหมาย</label>
        <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={form.opinionDetail} onChange={set('opinionDetail')} placeholder="มีมูลฟ้องร้อง ควรดำเนินคดี" />
      </div>

      {error && (
        <div style={{ background: '#fee2e2', color: '#991b1b', padding: '8px 12px', borderRadius: 6, fontSize: 13, marginBottom: 12 }}>
          {error}
        </div>
      )}

      <button onClick={submit} disabled={loading} style={{
        width: '100%', padding: '10px', background: loading ? '#67e8f9' : THEME,
        color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 700,
        cursor: loading ? 'not-allowed' : 'pointer',
      }}>
        {loading ? 'กำลังยืนยัน...' : '✓ ยืนยันข้อมูล (ส่ง GLEAD)'}
      </button>
    </div>
  );
}

// ── หน้าหลัก: ตั้งเรื่อง + รายการคดีจาก litigation-service ───────────────────
export default function CaseIntake() {
  const [form, setForm] = useState({
    fileNo: genFileNo(),
    categoryId: 101,
    typeId: 201,
    subTypeId: 301,
    detailTypeId: 401,
    subject: DETAIL_TYPES[0].label,
    receivedDate: '',
    description: '',
  });
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');
  const [success, setSuccess] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const load = () => {
    setLoading(true);
    setListError('');
    api.getCaseIntakesRemote(0, 100)
      .then(res => {
        const items = (res?.content || [])
          .sort((a, b) => new Date(b.createdDate || 0) - new Date(a.createdDate || 0));
        setCases(items);
      })
      .catch(err => setListError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  const setDetailType = (e) => {
    const id = Number(e.target.value);
    const detail = DETAIL_TYPES.find(d => d.id === id);
    setForm(f => ({ ...f, detailTypeId: id, subject: detail?.label || f.subject }));
  };

  const create = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setCreating(true);
    try {
      const payload = {
        fileNo: form.fileNo.trim(),
        statusTypeId: TRAN_STATUS.DRAFT,
        stepId: 1,
        departmentId: 10,
        buId: 10,
        subject: form.subject.trim(),
        categoryId: Number(form.categoryId),
        typeId: Number(form.typeId),
        subTypeId: Number(form.subTypeId),
        detailTypeId: Number(form.detailTypeId),
        receivedDate: form.receivedDate || null,
        description: form.description.trim() || null,
        active: true,
      };
      const result = await api.createCaseIntake(payload);
      const tledId = result?.tledId ?? result?.id ?? null;
      setSuccess(`ตั้งเรื่องสำเร็จบน litigation-service — เลขแฟ้ม ${payload.fileNo}${tledId != null ? ` (tledId: ${tledId})` : ''}`);
      setForm(f => ({ ...f, fileNo: genFileNo(), description: '' }));
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={{ maxWidth: 860 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 6, color: '#0f172a' }}>ตั้งเรื่องคดี (Case Intake)</h1>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 12 }}>
        ตั้งเรื่อง (ฉบับร่าง) → กรอกข้อมูลและยืนยัน (รอ ผอ.กลุ่ม) → GLEAD พิจารณา —{' '}
        <Link to="/workflow" style={{ color: THEME }}>ดู diagram</Link>
        {' | '}
        <Link to="/case-intake/approvals" style={{ color: THEME }}>หน้าพิจารณา GLEAD</Link>
      </p>

      <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', color: '#9a3412', borderRadius: 8, padding: '9px 14px', fontSize: 13, marginBottom: 20 }}>
        🌐 <strong>Remote mode:</strong> ทุกรายการอ่าน/เขียนตรงกับ litigation-service จริง (172.26.59.78 ผ่าน proxy)
      </div>

      {/* ── ฟอร์มตั้งเรื่อง (onSaveNewCase) ── */}
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.07)', borderTop: `4px solid ${THEME}`, marginBottom: 28 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>ตั้งเรื่องใหม่</div>
        <form onSubmit={create}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>เลขแฟ้มคดี (fileNo) *</label>
              <input style={inputStyle} value={form.fileNo} onChange={set('fileNo')} required />
            </div>
            <div>
              <label style={labelStyle}>วันที่รับเรื่อง</label>
              <input style={inputStyle} type="date" value={form.receivedDate} onChange={set('receivedDate')} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>กลุ่มคดี *</label>
              <select style={inputStyle} value={form.categoryId} onChange={set('categoryId')}>
                {CATEGORIES.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>ประเภทคดี *</label>
              <select style={inputStyle} value={form.typeId} onChange={set('typeId')}>
                {TYPES.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>ประเภทย่อย *</label>
              <select style={inputStyle} value={form.subTypeId} onChange={set('subTypeId')}>
                {SUBTYPES.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>รายละเอียดประเภท *</label>
              <select style={inputStyle} value={form.detailTypeId} onChange={setDetailType}>
                {DETAIL_TYPES.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>เรื่องแห่งคดี (subject) *</label>
            <input style={inputStyle} value={form.subject} onChange={set('subject')} required />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>รายละเอียด</label>
            <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={form.description} onChange={set('description')} placeholder="ลูกหนี้ค้างชำระเกิน 90 วัน ส่งเรื่องให้ฝ่ายกฎหมายดำเนินคดี" />
          </div>

          {error && (
            <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 6, fontSize: 13, marginBottom: 14 }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{ background: '#d1fae5', color: '#065f46', padding: '10px 14px', borderRadius: 6, fontSize: 13, marginBottom: 14 }}>
              {success}
            </div>
          )}

          <button type="submit" disabled={creating} style={{
            width: '100%', padding: '11px', background: creating ? '#67e8f9' : THEME,
            color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 700,
            cursor: creating ? 'not-allowed' : 'pointer',
          }}>
            {creating ? 'กำลังตั้งเรื่อง...' : '+ ตั้งเรื่อง (สร้างฉบับร่าง)'}
          </button>
        </form>
      </div>

      {/* ── รายการคดีจาก server ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>รายการคดีบน server ({cases.length})</h2>
        <button onClick={load} style={{
          padding: '7px 14px', background: '#fff', border: '1px solid #e2e8f0',
          borderRadius: 6, fontSize: 13, cursor: 'pointer', color: '#374151',
        }}>
          ↻ Refresh
        </button>
      </div>

      {listError && (
        <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 6, fontSize: 13, marginBottom: 14 }}>
          โหลดรายการจาก server ไม่ได้: {listError}
        </div>
      )}

      {loading ? (
        <p style={{ color: '#64748b' }}>กำลังโหลดจาก litigation-service...</p>
      ) : cases.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 12, padding: 32, textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', color: '#94a3b8', fontSize: 13 }}>
          ยังไม่มีเรื่องคดี — ตั้งเรื่องใหม่ด้านบน
        </div>
      ) : (
        cases.map(item => {
          const isDraft = DRAFT_STATUSES.includes(item.statusTypeId);
          const expanded = expandedId === item.tledId;
          return (
            <div key={item.tledId} style={{ background: '#fff', borderRadius: 12, marginBottom: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.07)', overflow: 'hidden', borderLeft: `4px solid ${isDraft ? THEME : '#cbd5e1'}` }}>
              <div
                style={{ padding: '14px 20px', cursor: isDraft ? 'pointer' : 'default' }}
                onClick={() => isDraft && setExpandedId(expanded ? null : item.tledId)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{item.fileNo}</span>
                  <StatusBadge statusTypeId={item.statusTypeId} />
                  <span style={{ padding: '1px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: '#ffedd5', color: '#9a3412' }}>
                    tledId {item.tledId}
                  </span>
                  <span style={{ fontSize: 13, color: '#64748b' }}>{item.subject}</span>
                  {isDraft && (
                    <span style={{ marginLeft: 'auto', fontSize: 12, color: THEME, fontWeight: 600 }}>
                      {expanded ? '▲ ปิด' : '▼ กรอกข้อมูล + ยืนยัน'}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                  สร้างเมื่อ: {item.createdDate ? new Date(item.createdDate).toLocaleString() : '-'}
                  {item.updatedDate && item.updatedDate !== item.createdDate ? ` | อัปเดต: ${new Date(item.updatedDate).toLocaleString()}` : ''}
                </div>
              </div>
              {isDraft && expanded && (
                <SubmitPanel item={item} onDone={() => { setExpandedId(null); load(); }} />
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
