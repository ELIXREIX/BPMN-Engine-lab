import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import NewRequest from './pages/NewRequest';
import TaskInbox from './pages/TaskInbox';
import AllRequests from './pages/AllRequests';
import WorkflowViewer from './pages/WorkflowViewer';
import UserManual from './pages/UserManual';
import NewAssignment from './pages/NewAssignment';
import AssignmentApproval from './pages/AssignmentApproval';
import CaseIntake from './pages/CaseIntake';
import CaseIntakeApproval from './pages/CaseIntakeApproval';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="new" element={<NewRequest />} />
        <Route path="tasks" element={<TaskInbox />} />
        <Route path="requests" element={<AllRequests />} />
        <Route path="assignment/new" element={<NewAssignment />} />
        <Route path="assignment/approvals" element={<AssignmentApproval />} />
        <Route path="case-intake" element={<CaseIntake />} />
        <Route path="case-intake/approvals" element={<CaseIntakeApproval />} />
        <Route path="workflow" element={<WorkflowViewer />} />
        <Route path="manual" element={<UserManual />} />
      </Route>
    </Routes>
  );
}
