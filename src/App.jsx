import { Routes, Route, Navigate } from "react-router-dom";

import LoginPage from "./pages/LoginPage";
import OutletLayout from "./components/OutletLayout";
import PublicRoute from "./components/PublicRoute";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminDashboard from "./pages/admin/AdminDashboard";
const App = () => {
  return (
    // App.jsx
    <Routes>
      <Route element={<OutletLayout />}>
        {" "}
        {/* GLOBAL WRAPPER */}
        {/* Public */}
        <Route element={<PublicRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route index element={<Navigate to="/login" replace />} />
        </Route>
        {/* Protected */}
        <Route element={<ProtectedRoute />}>
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
        </Route>
      </Route>
    </Routes>
  );
};

export default App;
