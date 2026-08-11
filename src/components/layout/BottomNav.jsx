import { useNavigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useSelector((store) => store.user.user);
  const initialized = useSelector((store) => store.user.initialized);

  if (!initialized || !user) return null;

  const isActive = (path) => location.pathname === path || (path !== "/" && location.pathname.startsWith(path));

  const navItems = [
    { icon: "home", label: "Home", path: "/" },
    { icon: "movie", label: "Movies", path: "/movies" },
    { icon: "tv", label: "Shows", path: "/shows" },
    { icon: "playlist_play", label: "Library", path: "/library" },
    { icon: "format_list_bulleted", label: "Lists", path: "/lists" },
    { icon: "search", label: "Search", path: "/search" },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 w-full bg-black/90 backdrop-blur-md border-t border-white/10 z-50 pb-[env(safe-area-inset-bottom)]">
      <ul className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => (
          <li key={item.path} className="flex-1">
            <button
              onClick={() => navigate(item.path)}
              className={`w-full flex flex-col items-center justify-center gap-1 h-full ${
                isActive(item.path) ? "text-red-500" : "text-white/60 hover:text-white/90"
              }`}
            >
              <span className="material-symbols-outlined text-2xl">
                {item.icon}
              </span>
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default BottomNav;
