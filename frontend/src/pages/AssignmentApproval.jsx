import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

const THEME = '#7c3aed';

const assigneeLabel = {
  legal_officer: 'นิติกร (ภายใน)',
  law_firm: 'สำนักกฎหมาย (ภายนอก)',
};

const statusStyle = {
  approved: { bg: '#dcfce7', text: '#166534', label: 'อนุมัติ' },
  rejected: { bg: '#fee2e2', text: '#991b1b', label: 'ไม่อนุมัติ' },
  completed: { bg: '#e2e8f0', text: '#475569', label: 'เสร็จสิ้น' },
};

function Badge({ bg, color, children }) {
  return (
    <span style={{ padding: '1px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700, background: bg, color }}>
      {children}
    </span>
  );
}

function TaskCard({ task, onComplete }) {
  const [comment, setComment] = useState('');
  const [reviewer, setReviewer] = useState('');
  const [loading, setLoading] = useState(null);
  const [expanded, setExpanded] = useState(false);

  const handle = async (approved) => {
    setLoading(approved ? 'approve' : 'reject');
    try {
      await api.completeTask(task.id, { approved, comment, reviewer: reviewer || 'approver' });
      onComplete(task.id);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div style={{ background: '#fff', borderRadius: 12, marginBottom: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.07)', overflow: 'hidden', borderLeft: `4px solid ${THEME}` }}>
      <div style={{ padding: '16px 20px', cursor: 'pointer' }} onClick={() => setExpanded(e => !e)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>{task.debtorName || 'คำขอมอบหมายงาน'}</span>
              <Badge bg="#ede9fe" color={THEME}>{task.assetType || '-'}</Badge>
              <Badge bg="#dbeafe" color="#1d4ed8">{assigneeLabel[task.assigneeType] || task.assigneeType || '-'}</Badge>
            </div>
            <div style={{ fontSize: 13, color: '#64748b' }}>
              เลขที่บัญชี: {task.accountNo || '-'} | ผู้สร้างคำขอ: {task.requester || '-'}
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>
              สร้างเมื่อ: {task.created ? new Date(task.created).toLocaleString() : '-'}
            </div>
          </div>
          <span style={{ color: '#94a3b8', fontSize: 18, lineHeight: 1 }}>{expanded ? '^' : 'v'}</span>
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: '1px solid #f1f5f9', padding: '16px 20px', background: '#fafafa' }}>
          {task.note && (
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px', marginBottom: 14, fontSize: 13, color: '#374151' }}>
              <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>หมายเหตุ</div>
              {task.note}
            </div>
          )}

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
              ชื่อผู้อนุมัติ
            </label>
            <input
              style={{ width: '100%', padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }}
              value={reviewer}
              onChange={e => setReviewer(e.target.value)}
              placeholder="Default: approver"
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
              {loading === 'approve' ? 'กำลังอนุมัติ...' : '✓ อนุมัติ'}
            </button>
            <button onClick={() => handle(false)} disabled={!!loading} style={{
              flex: 1, padding: '9px', background: loading === 'reject' ? '#fca5a5' : '#ef4444',
              color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}>
              {loading === 'reject' ? 'กำลังปฏิเสธ...' : '✕ ไม่อนุมัติ'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AssignmentApproval() {
  const [tasks, setTasks] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([api.getAssignmentTasks(), api.getAssignments()])
      .then(([t, all]) => {
        setTasks(t);
        setHistory(all.filter(a => a.status !== 'pending').slice(0, 10));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const onComplete = (id) => {
    setTasks(t => t.filter(x => x.id !== id));
    load();
  };

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#0f172a' }}>อนุมัติการมอบหมายงาน</h1>
          <p style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>
            {tasks.length} คำขอรอการอนุมัติ —{' '}
            <Link to="/assignment/new" style={{ color: THEME }}>สร้างคำขอใหม่</Link>
          </p>
        </div>
        <button onClick={load} style={{
          padding: '7px 14px', background: '#fff', border: '1px solid #e2e8f0',
          borderRadius: 6, fontSize: 13, cursor: 'pointer', color: '#374151',
        }}>
          ↻ Refresh
        </button>
      </div>

      {loading ? (
        <p style={{ color: '#64748b' }}>กำลังโหลด...</p>
      ) : tasks.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 12, padding: 40, textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
          <div style={{ fontWeight: 700, color: '#374151' }}>ไม่มีคำขอรอการอนุมัติ</div>
          <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>
            <Link to="/assignment/new" style={{ color: THEME }}>สร้างคำขอมอบหมายงานใหม่</Link>
          </div>
        </div>
      ) : (
        tasks.map(task => <TaskCard key={task.id} task={task} onComplete={onComplete} />)
      )}

      {history.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>ประวัติการพิจารณาล่าสุด</h2>
          <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', textAlign: 'left', color: '#64748b' }}>
                  <th style={{ padding: '10px 14px', fontWeight: 600 }}>ลูกหนี้</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600 }}>เลขที่บัญชี</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600 }}>ผู้รับผิดชอบ</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600 }}>ผลการพิจารณา</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600 }}>ผู้อนุมัติ</th>
                  <th style={{ padding: '10px 14px', fontWeight: 600 }}>ความเห็น</th>
                </tr>
              </thead>
              <tbody>
                {history.map(item => {
                  const st = statusStyle[item.status] || statusStyle.completed;
                  return (
                    <tr key={item.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0f172a' }}>{item.debtorName || '-'}</td>
                      <td style={{ padding: '10px 14px', color: '#64748b' }}>{item.accountNo || '-'}</td>
                      <td style={{ padding: '10px 14px', color: '#64748b' }}>{assigneeLabel[item.assigneeType] || item.assigneeType || '-'}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <Badge bg={st.bg} color={st.text}>{st.label}</Badge>
                      </td>
                      <td style={{ padding: '10px 14px', color: '#64748b' }}>{item.reviewer || '-'}</td>
                      <td style={{ padding: '10px 14px', color: '#64748b' }}>{item.comment || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
