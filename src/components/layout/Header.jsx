import { useEffect, useRef, useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../../util/firebase/firebase";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";

const Header = () => {
  const navigate = useNavigate();
  const user = useSelector((store) => store.user.user);
  const initialized = useSelector((store) => store.user.initialized);
  const [openMenu, setOpenMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuRef = useRef(null);

  const handleSignOut = () => {
    signOut(auth)
      .then(() => navigate("/"))
      .catch(() => navigate("/error"));
  };

  useEffect(() => {
    let scrollTimeout;
    const handleScroll = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        setScrolled(window.scrollY > 20);
      }, 50); // Debounce scroll handler - runs max every 50ms
    };
    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, []);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenu(false);
      }
    };
    const onEsc = (e) => {
      if (e.key === "Escape") setOpenMenu(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${
        scrolled
          ? "h-14 glass-effect shadow-lg backdrop-blur-md"
          : "h-16 bg-black border-b border-gray-900"
      }`}
    >
      <div className="h-full max-w-full px-10 flex items-center mx-auto">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-3 focus:outline-none group"
          aria-label="Go to Home"
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-4xl text-red-600 group-hover:scale-110 transition-transform">
              local_movies
            </span>
            <span className="font-display text-3xl font-bold gradient-text hidden sm:block">
              STRIVE
            </span>
          </div>
        </button>

        <div className="flex-1" />

        {initialized ? (
          user ? (
          <div className="flex items-center gap-8">
            <nav aria-label="Primary" className="hidden md:block">
              <ul className="flex items-center gap-8 font-secondary">
                <li>
                  <button
                    onClick={() => navigate("/")}
                    className="text-white/90 hover:text-white font-medium text-base transition-colors flex items-center gap-2 group"
                  >
                    <span className="material-symbols-outlined text-xl group-hover:scale-110 transition-transform">
                      home
                    </span>
                    <span>Home</span>
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => navigate("/movies")}
                    className="text-white/90 hover:text-white font-medium text-base transition-colors flex items-center gap-2 group"
                  >
                    <span className="material-symbols-outlined text-xl group-hover:scale-110 transition-transform">
                      movie
                    </span>
                    <span>Movies</span>
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => navigate("/shows")}
                    className="text-white/90 hover:text-white font-medium text-base transition-colors flex items-center gap-2 group"
                  >
                    <span className="material-symbols-outlined text-xl group-hover:scale-110 transition-transform">
                      tv
                    </span>
                    <span>Shows</span>
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => navigate("/library")}
                    className="text-white/90 hover:text-white font-medium text-base transition-colors flex items-center gap-2 group"
                  >
                    <span className="material-symbols-outlined text-xl group-hover:scale-110 transition-transform">
                      playlist_play
                    </span>
                    <span>Library</span>
                  </button>
                </li>
              </ul>
            </nav>

            <button
              onClick={() => navigate("/search")}
              aria-label="Search"
              className="hidden md:block text-white hover:text-red-600 transition-colors duration-300 p-2"
            >
              <span className="material-symbols-outlined text-2xl">search</span>
            </button>

            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setOpenMenu((s) => !s)}
                aria-haspopup="menu"
                aria-expanded={openMenu}
                className="w-10 h-10 rounded-full bg-gradient-to-br from-red-600 to-red-800 text-white font-bold text-sm flex items-center justify-center hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-red-600/50"
              >
                {(user?.name?.[0] || user?.email?.[0] || "U").toUpperCase()}
              </button>

              {openMenu && (
                <div
                  role="menu"
                  className="absolute right-0 mt-4 w-64 rounded-2xl glass-effect shadow-2xl overflow-hidden border border-white/10 animate-fade-in"
                >
                  <div className="p-4 border-b border-white/10">
                    <p className="text-white font-semibold font-secondary">
                      {user?.name || "User"}
                    </p>
                    <p className="text-white/60 text-sm mt-1">{user?.email}</p>
                  </div>
                  <button
                    role="menuitem"
                    onClick={() => navigate("/settings")}
                    className="w-full text-left px-4 py-3 text-sm text-white/90 hover:bg-white/10 transition-colors flex items-center gap-3 font-secondary"
                  >
                    <span className="material-symbols-outlined text-xl">
                      account_circle
                    </span>
                    <span>Account</span>
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => {}}
                    className="w-full text-left px-4 py-3 text-sm text-white/90 hover:bg-white/10 transition-colors flex items-center gap-3 font-secondary"
                  >
                    <span className="material-symbols-outlined text-xl">
                      settings
                    </span>
                    <span>Settings</span>
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => navigate("/simkl")}
                    className="w-full text-left px-4 py-3 text-sm text-white/90 hover:bg-white/10 transition-colors flex items-center gap-3 font-secondary"
                  >
                    <img
                      src="https://simkl.com/favicon.ico"
                      alt=""
                      className="w-5 h-5 opacity-80"
                    />
                    <span>Simkl Sync</span>
                  </button>
                  <div className="h-px bg-white/10" />
                  <button
                    role="menuitem"
                    onClick={handleSignOut}
                    className="w-full text-left px-4 py-3 text-sm font-semibold text-red-400 hover:bg-white/10 transition-colors flex items-center gap-3 font-secondary"
                  >
                    <span className="material-symbols-outlined text-xl">
                      logout
                    </span>
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
          ) : (
          <div className="flex items-center gap-6">
            <nav aria-label="Primary" className="hidden md:block">
              <ul className="flex items-center gap-8 font-secondary">
                <li>
                  <button
                    onClick={() => navigate("/")}
                    className="text-white/90 hover:text-white font-medium text-base transition-colors"
                  >
                    Home
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => navigate("/movies")}
                    className="text-white/90 hover:text-white font-medium text-base transition-colors"
                  >
                    Movies
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => navigate("/shows")}
                    className="text-white/90 hover:text-white font-medium text-base transition-colors"
                  >
                    Shows
                  </button>
                </li>
              </ul>
            </nav>

            <button
              onClick={() => navigate("/search")}
              aria-label="Search"
              className="hidden md:block glass-effect hover:bg-white/20 text-white rounded-full p-3 transition-all duration-300"
            >
              <span className="material-symbols-outlined">search</span>
            </button>

              <button
                onClick={() => navigate("/login")}
                className="btn-primary flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-xl">login</span>
                <span>Sign In</span>
              </button>
          </div>
          )
        ) : (
          <div className="w-44 h-10" />
        )}
      </div>
    </header>
  );
};

export default Header;
