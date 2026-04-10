import { ToastContainer } from "react-toastify";

const OrangeToastContainer = () => {
  return (
    <div className="orange-toast-wrapper">
      <link
        rel="stylesheet"
        href="https://unpkg.com/react-toastify/dist/ReactToastify.css"
      />
      <style>{`
          /* 1. Theme Colors Override
            Using standard react-toastify CSS variables to safely change colors 
          */
          .orange-toast-wrapper {
            --toastify-color-light: #ffffff;
            --toastify-text-color-light: #1f2937; /* Gray 800 for readability */
            --toastify-color-progress-light: #f97316; /* Tailwind Orange 500 */
            
            /* Change all status icons to shades of orange to fit the theme */
            --toastify-color-info: #f97316;    
            --toastify-color-success: #ea580c; /* Darker orange */
            --toastify-color-warning: #fb923c; /* Lighter orange */
            --toastify-color-error: #c2410c;   /* Rust/Red-orange */
            
            --toastify-font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
          }
  
          /* 2. Container & Toast Styling 
            Adding rounded corners, borders, and a soft orange-tinted shadow
          */
          .orange-toast-wrapper .Toastify__toast {
            border-radius: 12px;
            border: 1px solid #ffedd5; /* Very light orange border */
            box-shadow: 0 10px 15px -3px rgba(249, 115, 22, 0.1), 0 4px 6px -4px rgba(249, 115, 22, 0.1);
            padding: 16px;
          }
  
          /* 3. Responsive Alignment 
            Ensuring it looks great on mobile by overriding default widths and margins
          */
          @media only screen and (max-width: 480px) {
            .orange-toast-wrapper .Toastify__toast-container {
              width: 92vw;
              left: 4vw;
              right: 4vw;
              top: 16px;
              padding: 0;
            }
            .orange-toast-wrapper .Toastify__toast {
              margin-bottom: 12px;
            }
          }
        `}</style>

      {/* Your requested ToastContainer configuration */}
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
    </div>
  );
};

export default OrangeToastContainer;