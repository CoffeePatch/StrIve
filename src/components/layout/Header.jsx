import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { Home, Search, Settings, Bell } from "lucide-react";

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useSelector((store) => store.user.user);
  const initialized = useSelector((store) => store.user.initialized);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let scrollTimeout;
    const handleScroll = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        setScrolled(window.scrollY > 20);
      }, 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, []);

  const NavItem = ({ path, label, icon: Icon, isActive }) => (
    <li>
      <button
        onClick={() => navigate(path)}
        className={`flex items-center gap-2 px-4 py-2 rounded-full font-secondary text-sm font-semibold transition-all interactive-element ${
          isActive 
            ? "bg-white text-[#111]" 
            : "text-white/70 hover:text-white bg-transparent"
        }`}
      >
        {Icon && <Icon className={`w-4 h-4 ${isActive ? 'text-[#111]' : ''}`} />}
        <span>{label}</span>
      </button>
    </li>
  );

  return (
    <header
      className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${
        scrolled
          ? "h-16 bg-[#0f0f0f]/70 backdrop-blur-[20px] border-b border-white/5"
          : "h-20 bg-transparent"
      }`}
    >
      <div className="h-full w-full px-4 sm:px-8 lg:px-12 flex items-center justify-between">
        <button
          onClick={() => navigate("/")}
          className="focus:outline-none group flex items-center"
          aria-label="Go to Home"
        >
          <span className="font-display italic text-3xl font-black text-white group-hover:scale-105 transition-transform">
            S
          </span>
        </button>

        {initialized && user ? (
          <div className="flex items-center gap-8">
            <nav aria-label="Primary" className="hidden md:block">
              <ul className="flex items-center gap-2">
                <NavItem 
                  path="/" 
                  label="Home" 
                  icon={Home} 
                  isActive={location.pathname === "/"} 
                />
                <NavItem 
                  path="/movies" 
                  label="Movies" 
                  isActive={location.pathname === "/movies"} 
                />
                <NavItem 
                  path="/shows" 
                  label="Shows" 
                  isActive={location.pathname === "/shows"} 
                />
                <NavItem 
                  path="/library" 
                  label="Library" 
                  isActive={location.pathname.startsWith("/library")} 
                />
              </ul>
            </nav>

            <div className="flex items-center gap-6">
              <button
                onClick={() => navigate("/search")}
                aria-label="Search"
                className="text-white/70 hover:text-white interactive-element"
              >
                <Search className="w-5 h-5" />
              </button>
              <button
                onClick={() => navigate("/settings")}
                aria-label="Settings"
                className="text-white/70 hover:text-white interactive-element"
              >
                <Settings className="w-5 h-5" />
              </button>
              <button
                aria-label="Notifications"
                className="text-white/70 hover:text-white interactive-element"
              >
                <Bell className="w-5 h-5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-6">
            <button
              onClick={() => navigate("/login")}
              className="px-6 py-2 rounded-full bg-white text-black font-secondary text-sm font-semibold hover:scale-105 transition-all"
            >
              Sign In
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
