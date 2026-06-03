import { Routes, Route, Navigate } from 'react-router-dom';
import { isAuthenticated } from './api/client.js';
import Auth from './pages/Auth.tsx';
import Dashboard from './pages/Dashboard.jsx';
import Results from './pages/Results.jsx';
import GroupsManagement from './pages/GroupsManagement.jsx';
import Home from './pages/Home.jsx';

function RequireAuth({ children }) {
  return isAuthenticated() ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Auth initialMode="login" />} />
      <Route path="/signup" element={<Auth initialMode="signup" />} />
      <Route path="/register" element={<Navigate to="/signup" replace />} />
      <Route path="/home" element={<RequireAuth><Home /></RequireAuth>} />
      <Route path="/groups" element={<RequireAuth><GroupsManagement /></RequireAuth>} />
      <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
      <Route path="/results/:id" element={<RequireAuth><Results /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );
}
