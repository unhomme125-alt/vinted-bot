import { Routes, Route, Navigate } from 'react-router-dom';
import { isAuthenticated } from './api/client.js';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import SignUp from './pages/SignUp.tsx';
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
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/home" element={<RequireAuth><Home /></RequireAuth>} />
      <Route path="/groups" element={<RequireAuth><GroupsManagement /></RequireAuth>} />
      <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
      <Route path="/results/:id" element={<RequireAuth><Results /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );
}
