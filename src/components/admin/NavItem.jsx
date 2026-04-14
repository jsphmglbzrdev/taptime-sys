/**
 * Navigation Item Component
 */

function NavItem({ icon, label, active, onClick, badge }) {
  return (
    <button
      onClick={onClick}
      className={`
          flex items-center cursor-pointer justify-between w-full px-4 py-3 text-sm font-bold rounded-xl transition-all
          ${
            active
              ? "bg-orange-500 text-white shadow-lg shadow-orange-100"
              : "text-gray-500 hover:bg-orange-50 hover:text-orange-600"
          }
        `}
    >
      <div className="flex items-center">
        <span className="mr-3">{icon}</span>
        {label}
      </div>
      {badge && (
        <span
          className={`px-2 py-0.5 text-[10px] font-black rounded-full ${
            active ? "bg-white text-orange-500" : "bg-orange-500 text-white"
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

export default NavItem;
