import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { logout } from '../../util/store/userSlice';
import { auth } from '../../util/firebase/firebase';
import { signOut } from 'firebase/auth';
import Header from '../layout/Header';

const ProfilePage = () => {
  const { user } = useSelector((store) => store.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleLogout = () => {
    signOut(auth).then(() => {
      dispatch(logout());
      navigate('/login');
    });
  };

  return (
    <div className="min-h-screen premium-page flex flex-col">
      <Header />
      <main className="flex-grow flex flex-col items-center justify-center p-6 text-center">
        <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center mb-6 border border-white/20">
          <span className="material-symbols-outlined text-4xl text-white/50">
            person
          </span>
        </div>
        <h1 className="text-2xl font-semibold text-white mb-2">
          {user?.name || user?.email || 'User Profile'}
        </h1>
        <p className="text-white/60 mb-8">{user?.email}</p>

        <div className="flex flex-col gap-4 w-full max-w-xs">
          <button
            onClick={() => navigate('/settings')}
            className="w-full px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors font-medium border border-white/10"
          >
            Settings
          </button>
          
          <button
            onClick={handleLogout}
            className="w-full px-6 py-3 bg-red-600/20 hover:bg-red-600/30 text-red-500 rounded-xl transition-colors font-medium border border-red-500/20"
          >
            Sign Out
          </button>
        </div>
      </main>
    </div>
  );
};

export default ProfilePage;
