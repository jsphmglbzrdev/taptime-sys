/**
 * Navigation Item Component
 */

function NavItem({
  icon,
  label,
  active,
  onClick,
  badge,
  collapsed = false,
  disabled = false,
  infoText,
}) {
  return (
    <div className="flex flex-col w-full">
      <button
        type="button"
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
        title={collapsed ? label : undefined}
        className={`
          flex w-full items-center rounded-xl py-3 text-sm font-bold transition-all
          ${
            disabled
              ? "cursor-not-allowed bg-gray-50 text-gray-300"
              : active
                ? "cursor-pointer bg-orange-500 text-white shadow-lg shadow-orange-100"
                : "cursor-pointer text-gray-500 hover:bg-orange-50 hover:text-orange-600"
          }
          ${collapsed ? "justify-center px-3" : "justify-between px-4"}
        `}
      >
        <div className={`flex items-center ${collapsed ? "justify-center" : ""}`}>
          <span className={collapsed ? "" : "mr-3"}>{icon}</span>
          <span
            className={`overflow-hidden whitespace-nowrap transition-all duration-300 ${
              collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
            }`}
          >
            {label}
          </span>
        </div>
        {!collapsed && badge && (
          <span
            className={`px-2 py-0.5 text-[10px] font-black rounded-full ${
              active ? "bg-white text-orange-500" : "bg-orange-500 text-white"
            }`}
          >
            {badge}
          </span>
        )}
      </button>
      {disabled && infoText && !collapsed && (
        <span className="mt-1 px-4 text-[10px] font-medium text-orange-400 italic">
          {infoText}
        </span>
      )}
    </div>
  );
}

export default NavItem;
