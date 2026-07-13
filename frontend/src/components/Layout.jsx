import { NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Dashboard', icon: 'D' },
  { to: '/new', label: 'New Application', icon: '+' },
  { to: '/tasks', label: 'Review Inbox', icon: 'R' },
  { to: '/requests', label: 'Applications', icon: 'A' },
  { to: '/assignment/new', label: 'สร้างคำขอมอบหมายงาน', icon: '+' },
  { to: '/assignment/approvals', label: 'อนุมัติมอบหมายงาน', icon: '✓' },
  { to: '/case-intake', label: 'ตั้งเรื่องคดี', icon: 'C' },
  { to: '/case-intake/approvals', label: 'พิจารณาเรื่องคดี (GLEAD)', icon: 'G' },
  { to: '/workflow', label: 'Workflow Viewer', icon: 'W' },
  { to: '/manual', label: 'User Manual', icon: '?' },
];

const sidebarStyle = {
  width: 220,
  minHeight: '100vh',
  background: '#1e293b',
  color: '#cbd5e1',
  display: 'flex',
  flexDirection: 'column',
  flexShrink: 0,
};

const logoStyle = {
  padding: '24px 20px 16px',
  borderBottom: '1px solid #334155',
};

const navStyle = {
  padding: '12px 8px',
  flex: 1,
};

export default function Layout() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={sidebarStyle}>
        <div style={logoStyle}>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, letterSpacing: '0.08em', textTransform: 'uppercase' }}>BPMN POC</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>Credit Approval</div>
        </div>
        <nav style={navStyle}>
          {navItems.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 12px',
                borderRadius: 6,
                marginBottom: 2,
                textDecoration: 'none',
                fontSize: 14,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? '#f1f5f9' : '#94a3b8',
                background: isActive ? '#334155' : 'transparent',
              })}
            >
              <span style={{ width: 18, fontSize: 12, fontWeight: 800, textAlign: 'center' }}>{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>
        <div style={{ padding: '12px 20px', borderTop: '1px solid #334155', fontSize: 12, color: '#64748b' }}>
          Flowable + Express
        </div>
      </aside>

      <main style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>
        <Outlet />
      </main>
    </div>
  );
}
