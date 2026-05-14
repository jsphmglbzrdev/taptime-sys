import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import LoginPage from "./pages/LoginPage";
import SignUpPage from "./pages/SignUpPage";
import OutletLayout from "./components/OutletLayout";
import RouteSeo from "./components/RouteSeo";

const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const UserDashboard = lazy(() => import("./pages/user/UserDashboard"));
const SystemAdminDashboard = lazy(() => import("./pages/system-admin/SystemAdminDashboard"));

const App = () => {
  return (
    <>
      <RouteSeo />
      <Suspense fallback={null}>
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
      </Suspense>
    </>
  );
};

export default App;
