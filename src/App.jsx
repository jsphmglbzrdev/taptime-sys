import { Routes, Route, Navigate } from "react-router-dom";

import LoginPage from "./pages/LoginPage";
import OutletLayout from "./components/OutletLayout";

import AdminDashboard from "./pages/admin/AdminDashboard";
import UserDashboard from "./pages/user/UserDashboard";
import { useAuth } from "./context/AuthContext";

const App = () => {
  const { user } = useAuth();

  return (
    // App.jsx
    <Routes>
      <Route element={<OutletLayout />}>
        <Route index path="/login" element={<LoginPage />} />

        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/user/dashboard" element={<UserDashboard />} />

      </Route>
    </Routes>
  );
};
export default App;
