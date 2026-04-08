// src/components/LoadingSpinner.jsx
import { PacmanLoader } from "react-spinners";

const LoadingSpinner = () => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay background */}
      <div className="absolute inset-0 bg-black/10 backdrop-blur-xs"></div>

      <div className="relative">
        <PacmanLoader color="#f97316" size={20} />
      </div>
    </div>
  );
};

export default LoadingSpinner;
