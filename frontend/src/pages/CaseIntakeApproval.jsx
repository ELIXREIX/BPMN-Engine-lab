import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, TRAN_STATUS, CASE_STATUS_LABEL, WAIT_GLEAD_STATUSES } from '../api';

const THEME = '#0891b2';

// สถานะที่ถือว่า "รอ GLEAD พิจารณา" — รวมค่า demo เก่า (2)
const PENDING_STATUSES = WAIT_GLEAD_STATUSES;
// สถานะที่ถือว่าพิจารณาแล้ว (แสดงในประวัติ)
const DECIDED_STATUSES = [
  TRAN_STATUS.WAIT_LAW_ACK, TRAN_STATUS.LAW_INPROG, TRAN_STATUS.DONE,
  TRAN_STATUS.NOT_AGREE, TRAN_STATUS.REJECT, TRAN_STATUS.EDIT,
];

function money(value) {
  const n = Number(value);
  return Number.isFinite(n) && n !== 0 ? n.toLocaleString() : '-';
}

function Badge({ bg, color, children }) {
  return (
    <span style={{ padding: '1px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: bg, color }}>
      {children}
    </span>
  );
}

function StatusBadge({ statusTypeId }) {
  const meta = CASE_STATUS_LABEL[statusTypeId] || { bg: '#e2e8f0', text: '#475569', label: `status ${statusTypeId}` };
  return <Badge bg={meta.bg} color={meta.text}>{meta.label}</Badge>;
}

function Info({ label, value }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px' }}>
      <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: 14, color: '#0f172a', fontWeight: 700, marginTop: 3 }}>{value}</div>
    </div>
  );
}

function CaseCard({ item, onComplete }) {
  const [comment, setComment] = useState('');
  const [reviewer, setReviewer] = useState('');
  const [loading, setLoading] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailError, setDetailError] = useState('');

  // เปิดการ์ด → ดึง getById + aggregate + ประวัติจาก server จริง
  useEffect(() => {
    if (!expanded || detail) return;
    let cancelled = false;
    Promise.all([
      api.getCaseIntakeById(item.tledId).catch(() => null),
      api.getCaseIntakeAggregate(item.tledId).catch(() => null),
      api.getCaseIntakeApprovalHistory(item.tledId).catch(() => []),
    ]).then(([byId, aggregate, history]) => {
      if (!cancelled) setDetail({ byId, aggregate, history: Array.isArray(history) ? history : [] });
    }).catch(err => {
      if (!cancelled) setDetailError(err.message);
    });
    return () => { cancelled = true; };
  }, [expanded, detail, item.tledId]);

  const handle = async (approved) => {
    setLoading(approved ? 'approve' : 'reject');
    try {
      // backend จัดการทั้ง litigation-service (ประวัติ + เปลี่ยนสถานะ) และ Flowable (complete gleadReview)
      await api.decideCaseIntake(item.tledId, { approved, comment, reviewer });
      onComplete(item.tledId);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(null);
    }
  };

  const legal = detail?.aggregate?.legalAnalysis || {};
  const debtors = detail?.aggregate?.debtors || [];
  const contracts = detail?.aggregate?.contracts || [];
  const debtorName = debtors[0] ? `${debtors[0].entityName || ''} ${debtors[0].lastName || ''}`.trim() : '-';

  return (
    <div style={{ background: '#fff', borderRadius: 12, marginBottom: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.07)', overflow: 'hidden', borderLeft: '4px solid #ea580c' }}>
      <div style={{ padding: '16px 20px', cursor: 'pointer' }} onClick={() => setExpanded(e => !e)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>{item.fileNo}</span>
              <StatusBadge statusTypeId={item.statusTypeId} />
              <Badge bg="#ffedd5" color="#9a3412">🌐 tledId {item.tledId}</Badge>
            </div>
            <div style={{ fontSize: 13, color: '#64748b' }}>{item.subject}</div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>
              สร้างเมื่อ: {item.createdDate ? new Date(item.createdDate).toLocaleString() : '-'}
            </div>
          </div>
          <span style={{ color: '#94a3b8', fontSize: 18, lineHeight: 1 }}>{expanded ? '^' : 'v'}</span>
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: '1px solid #f1f5f9', padding: '16px 20px', background: '#fafafa' }}>
          {detailError && (
            <div style={{ background: '#fee2e2', color: '#991b1b', padding: '8px 12px', borderRadius: 6, fontSize: 13, marginBottom: 12 }}>
              โหลดรายละเอียดล้มเหลว: {detailError}
            </div>
          )}
          {!detail && !detailError && (
            <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 12 }}>กำลังโหลดรายละเอียดจาก server...</div>
          )}

          {detail && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 14 }}>
                <Info label="ลูกหนี้" value={debtorName} />
                <Info label="เลขที่สัญญา" value={contracts[0]?.contractNo || '-'} />
                <Info label="เงินต้นคงค้าง" value={money(legal.totalPrincipal)} />
                <Info label="ยอดฟ้องรวม" value={money(legal.totalFiling)} />
              </div>

              {legal.opinionDetail && (
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px', marginBottom: 14, fontSize: 13, color: '#374151' }}>
                  <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>ความเห็นทางกฎหมาย</div>
                  {legal.opinionDetail}
                </div>
              )}

              {detail.history.length > 0 && (
                <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px', marginBottom: 14, fontSize: 12, color: '#64748b' }}>
                  <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5 }}>ประวัติการดำเนินการ (จาก server)</div>
                  {detail.history.map((h, i) => (
                    <div key={h.approvalId || i} style={{ marginBottom: 2 }}>
                      • #{h.seq ?? i + 1} {h.action || `actionTypeId ${h.actionTypeId}`}
                      {h.comment ? ` — ${h.comment}` : ''}
                      {h.actionDate ? ` (${h.actionDate})` : ''}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
              ชื่อผู้พิจารณา
            </label>
            <input
              style={{ width: '100%', padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }}
              value={reviewer}
              onChange={e => setReviewer(e.target.value)}
              placeholder="ผอ.กลุ่ม"
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
              ความเห็น
            </label>
            <textarea
              style={{ width: '100%', padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, minHeight: 60, resize: 'vertical', boxSizing: 'border-box' }}
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="เหตุผลประกอบการพิจารณา"
            />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => handle(true)} disabled={!!loading} style={{
              flex: 1, padding: '9px', background: loading === 'approve' ? '#6ee7b7' : '#10b981',
              color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}>
              {loading === 'approve' ? 'กำลังบันทึก...' : '✓ เห็นชอบ (ส่งนิติกร)'}
            </button>
            <button onClick={() => handle(false)} disabled={!!loading} style={{
              flex: 1, padding: '9px', background: loading === 'reject' ? '#fca5a5' : '#ef4444',
              color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}>
              {loading === 'reject' ? 'กำลังบันทึก...' : '✕ ไม่ผ่านการพิจารณา'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CaseIntakeApproval() {
  const [pending, setPending] = useState([]);
  const [decided, setDecided] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    api.getCaseIntakesRemote(0, 100)
      .then(res => {
        const items = res?.content || [];
        setPending(items.filter(c => PENDING_STATUSES.includes(c.statusTypeId)));
        setDecided(
          items
            .filter(c => DECIDED_STATUSES.includes(c.statusTypeId))
            .sort((a, b) => new Date(b.updatedDate || 0) - new Date(a.updatedDate || 0))
            .slice(0, 10)
        );
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const onComplete = () => load();

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a' }}>พิจารณาเรื่องคดี (GLEAD)</h1>
          <p style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>
            {pending.length} เรื่องรอพิจารณา —{' '}
            <Link to="/case-intake" style={{ color: THEME }}>ไปหน้าตั้งเรื่อง</Link>
          </p>
        </div>
        <button onClick={load} style={{
          padding: '7px 14px', background: '#fff', border: '1px solid #e2e8f0',
          borderRadius: 6, fontSize: 13, cursor: 'pointer', color: '#374151',
        }}>
          ↻ Refresh
        </button>
      </div>

      <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', color: '#9a3412', borderRadius: 8, padding: '9px 14px', fontSize: 13, marginBottom: 16 }}>
        🌐 <strong>Remote mode:</strong> อ่านรายการจาก litigation-service จริง (GET /case-intakes) —
        เห็นชอบ = บันทึกประวัติ + เปลี่ยนสถานะเป็น "รอนิติกรรับทราบ" / ไม่ผ่าน = "ไม่ผ่าน ผอ.กลุ่ม"
      </div>

      {error && (
        <div style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 6, fontSize: 13, marginBottom: 16 }}>
          โหลดรายการจาก server ไม่ได้: {error}
        </div>
      )}

      {loading ? (
        <p style={{ color: '#64748b' }}>กำลังโหลดจาก litigation-service...</p>
      ) : pending.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 12, padding: 40, textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
          <div style={{ fontWeight: 700, color: '#374151' }}>ไม่มีเรื่องรอพิจารณา</div>
          <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>
            เรื่องจะเข้าคิวเมื่อเจ้าหน้าที่กด "ยืนยันข้อมูล" ใน<Link to="/case-intake" style={{ color: THEME }}>หน้าตั้งเรื่อง</Link>
          </div>
        </div>
      ) : (
        pending.map(item => <CaseCard key={item.tledId} item={item} onComplete={onComplete} />)
      )}

      {decided.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>ประวัติการพิจารณาล่าสุด</h2>
          <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', textAlign: 'left', color: '#64748b' }}>
                  <th style={{ padding: '10px 14px', fontWeight: 600 }}>tledId</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600 }}>เลขแฟ้ม</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600 }}>เรื่องแห่งคดี</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600 }}>สถานะ</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600 }}>อัปเดตล่าสุด</th>
                </tr>
              </thead>
              <tbody>
                {decided.map(item => (
                  <tr key={item.tledId} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 14px', color: '#64748b' }}>{item.tledId}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0f172a' }}>{item.fileNo}</td>
                    <td style={{ padding: '10px 14px', color: '#64748b' }}>{item.subject || '-'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <StatusBadge statusTypeId={item.statusTypeId} />
                    </td>
                    <td style={{ padding: '10px 14px', color: '#64748b' }}>
                      {item.updatedDate ? new Date(item.updatedDate).toLocaleString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
