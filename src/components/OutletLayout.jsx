// src/components/LoadingOutlet.jsx

import { Outlet } from "react-router-dom";
import { useLoading } from "../context/LoadingContext";
import LoadingSpinner from "./LoadingSpinner";
import OrangeToastContainer from "./OrangeToastContainer";

const OutletLayout = () => {
  const { loading } = useLoading();

  return (
    <>
      <Outlet />
      {loading && <LoadingSpinner />}

      <OrangeToastContainer />
    </>
  );
};

export default OutletLayout;
