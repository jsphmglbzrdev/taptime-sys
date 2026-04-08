
const ConfirmationBox = ({
  isModalOpen,
  setIsModalOpen,
  title,
  description,
  buttonText,
	handleAction
}) => {

  if (!isModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay background */}
      <div className="absolute inset-0 bg-black/10 backdrop-blur-xs"></div>

      <div className="relative font-sans">
        <div className="bg-white w-96 p-5 rounded-md font-sans">
          <div className="flex flex-col ">
            <h1 className="text-xl text-gray-900 font-semibold">{title}</h1>
            <p>{description}</p>
          </div>

          <div className="flex items-center justify-center gap-5 mt-5">
            <button onClick={() => setIsModalOpen(false)} className="w-full p-2 cursor-pointer bg-gray-100 hover:bg-gray-50 transition-all">
              Cancel
            </button>
            <button onClick={() => handleAction()} className="w-full p-2 cursor-pointer bg-orange-500 hover:bg-orange-400 transition-all text-white">
              {buttonText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationBox;
