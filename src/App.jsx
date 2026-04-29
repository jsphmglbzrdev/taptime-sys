import { Routes, Route, Navigate } from "react-router-dom";

import LoginPage from "./pages/LoginPage";
import SignUpPage from "./pages/SignUpPage";
import OutletLayout from "./components/OutletLayout";

import AdminDashboard from "./pages/admin/AdminDashboard";
import UserDashboard from "./pages/user/UserDashboard";
import SystemAdminDashboard from "./pages/system-admin/SystemAdminDashboard";

const App = () => {
  return (
    // App.jsx
    <Routes>
      <Route element={<OutletLayout />}>
        <Route index element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />

        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/user/dashboard" element={<UserDashboard />} />
        <Route path="/system-admin/dashboard" element={<SystemAdminDashboard />} />
        <Route path="*" element={<Navigate to="/login" replace />} />

      </Route>
    </Routes>
  );
};



export default App;
