// src/components/LoadingOutlet.jsx

import { Outlet } from "react-router-dom";
import { useLoading } from "../context/LoadingContext";
import LoadingSpinner from "./LoadingSpinner";
import { ToastContainer } from "react-toastify";

const OutletLayout = () => {
  const { loading } = useLoading();

  return (
    <>
      <Outlet />
      {loading && <LoadingSpinner />}

      <ToastContainer
        position="top-right"
        autoClose={2000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick={false}
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />

			
    </>
  );
};

export default OutletLayout;
