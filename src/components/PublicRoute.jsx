// src/components/PublicRoute.jsx
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import LoadingSpinner from "./LoadingSpinner";
import { useLoading } from "../context/LoadingContext";

const PublicRoute = () => {
	const { loading } = useLoading();
  const { user } = useAuth();

  if (loading) return <LoadingSpinner/>;

  return !user ? <Outlet /> : <Navigate to="/admin/dashboard" replace />;
};

export default PublicRoute;