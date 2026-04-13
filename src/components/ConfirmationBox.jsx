
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Overlay background */}
      <div className="absolute inset-0 bg-black/10 backdrop-blur-xs"></div>

      <div className="relative w-full max-w-md">
        <div className="bg-white w-full rounded-2xl p-5 sm:p-6 shadow-xl">
          <div className="flex flex-col gap-2">
            <h1 className="text-lg sm:text-xl text-gray-900 font-semibold leading-tight break-words">
              {title}
            </h1>
            <p className="text-sm sm:text-base text-gray-600 leading-relaxed break-words">
              {description}
            </p>
          </div>

          <div className="mt-6 flex flex-col-reverse sm:flex-row items-stretch gap-3">
            <button
              onClick={() => setIsModalOpen(false)}
              className="w-full px-4 py-3 cursor-pointer rounded-xl bg-gray-100 hover:bg-gray-50 transition-all text-sm sm:text-base font-medium"
            >
              Cancel
            </button>
            <button
              onClick={() => handleAction()}
              className="w-full px-4 py-3 cursor-pointer rounded-xl bg-orange-500 hover:bg-orange-400 transition-all text-white text-sm sm:text-base font-semibold"
            >
              {buttonText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationBox;
