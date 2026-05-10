import React from "react";

const Footer = () => {
  return (
    <footer className="bg-gradient-to-b from-transparent to-black/50 text-white/60 py-12 border-t border-white/5 w-full">
      <div className="mx-auto max-w-full px-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-3xl text-red-600">
                local_movies
              </span>
              <span className="font-display text-2xl font-bold gradient-text">
                STRIVE
              </span>
            </div>
            <p className="text-sm font-secondary text-white/50">
              Your premium destination for movies and TV shows streaming experience.
            </p>
          </div>

          <div>
            <h3 className="text-white font-semibold font-secondary mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">explore</span>
              Explore
            </h3>
            <ul className="space-y-3 font-secondary text-sm">
              <li>
                <a href="/" className="hover:text-white transition-colors flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">home</span>
                  Home
                </a>
              </li>
              <li>
                <a href="/movies" className="hover:text-white transition-colors flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">movie</span>
                  Movies
                </a>
              </li>
              <li>
                <a href="/shows" className="hover:text-white transition-colors flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">tv</span>
                  TV Shows
                </a>
              </li>
              <li>
                <a href="/library" className="hover:text-white transition-colors flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">playlist_play</span>
                  Library
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-semibold font-secondary mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">info</span>
              Support
            </h3>
            <ul className="space-y-3 font-secondary text-sm">
              <li>
                <a href="#" className="hover:text-white transition-colors flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">help</span>
                  Help Center
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">contact_support</span>
                  Contact Us
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">privacy_tip</span>
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition-colors flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">gavel</span>
                  Terms of Service
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-semibold font-secondary mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">share</span>
              Connect
            </h3>
            <div className="flex gap-4 mb-4">
              <a
                href="https://github.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="glass-effect hover:bg-white/10 p-3 rounded-full transition-all hover:scale-110"
                aria-label="GitHub"
              >
                <span className="material-symbols-outlined">code</span>
              </a>
              <a
                href="https://www.linkedin.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="glass-effect hover:bg-white/10 p-3 rounded-full transition-all hover:scale-110"
                aria-label="LinkedIn"
              >
                <span className="material-symbols-outlined">work</span>
              </a>
              <a
                href="https://twitter.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="glass-effect hover:bg-white/10 p-3 rounded-full transition-all hover:scale-110"
                aria-label="Twitter"
              >
                <span className="material-symbols-outlined">tag</span>
              </a>
            </div>
            <p className="text-xs mt-4">
              Powered by{" "}
              <a
                href="https://www.themoviedb.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 transition-colors font-semibold"
              >
                TMDb API
              </a>
            </p>
          </div>
        </div>

        <div className="pt-8 border-t border-white/5">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm font-secondary text-white/40">
              &copy; {new Date().getFullYear()} Strive. All rights reserved.
            </p>
            <div className="flex items-center gap-2 text-sm font-secondary">
              <span className="material-symbols-outlined text-red-600">
                favorite
              </span>
              <span className="text-white/40">Made with passion for cinema</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
