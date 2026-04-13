import { Routes, Route, Navigate } from "react-router-dom";

import LoginPage from "./pages/LoginPage";
import OutletLayout from "./components/OutletLayout";

import AdminDashboard from "./pages/admin/AdminDashboard";
import UserDashboard from "./pages/user/UserDashboard";

const App = () => {
  return (
    // App.jsx
    <Routes>
      <Route element={<OutletLayout />}>
        <Route index element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />

        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/user/dashboard" element={<UserDashboard />} />
        <Route path="*" element={<Navigate to="/login" replace />} />

      </Route>
    </Routes>
  );
};



export default App;
