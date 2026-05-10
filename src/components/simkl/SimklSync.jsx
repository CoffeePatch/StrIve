/**
 * SIMKL Sync Component
 * UI component for SIMKL authentication and synchronization
 */

import React, { useEffect } from 'react';
import { useSimkl, useSimklBackgroundSync } from '../../hooks/simkl/useSimkl';
import { toast } from 'react-toastify';
import './SimklSync.css';

const SimklSync = () => {
  const {
    isAuthenticated,
    syncStatus,
    userProfile,
    userStats,
    login,
    sync,
    logout,
    getStats,
  } = useSimkl();

  // Enable background sync when app gains focus
  useSimklBackgroundSync();

  // Show sync status notifications
  useEffect(() => {
    if (syncStatus === 'succeeded') {
      toast.success('✅ Synced with SIMKL');
    } else if (syncStatus === 'failed') {
      toast.error('❌ Failed to sync with SIMKL');
    }
  }, [syncStatus]);

  const handleSync = async () => {
    try {
      const result = await sync();
      
      if (result.payload && !result.payload.synced) {
        toast.info('Already up to date');
      }
    } catch (error) {
      console.error('Sync error:', error);
    }
  };

  const handleLogin = () => {
    login();
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to disconnect from SIMKL?')) {
      logout();
      toast.info('Disconnected from SIMKL');
    }
  };

  const handleGetStats = async () => {
    await getStats();
  };

  if (!isAuthenticated) {
    return (
      <div className="simkl-sync">
        <div className="simkl-connect">
          <img 
            src="https://i.simkl.com/img_tv/apiary_logo_api.png" 
            alt="SIMKL" 
            className="simkl-logo"
          />
          <h3>Connect with SIMKL</h3>
          <p>Sync your watch history, ratings, and watchlist with SIMKL</p>
          <button 
            className="btn-connect-simkl"
            onClick={handleLogin}
          >
            Connect to SIMKL
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="simkl-sync">
      <div className="simkl-status">
        <div className="simkl-header">
          <img 
            src="https://i.simkl.com/img_tv/apiary_logo_api.png" 
            alt="SIMKL" 
            className="simkl-logo-small"
          />
          <div className="simkl-user-info">
            <h4>Connected to SIMKL</h4>
            {userProfile && (
              <p className="simkl-username">
                {userProfile.user?.name || 'User'}
              </p>
            )}
          </div>
        </div>

        <div className="simkl-actions">
          <button
            className="btn-sync"
            onClick={handleSync}
            disabled={syncStatus === 'loading'}
          >
            {syncStatus === 'loading' ? (
              <>
                <span className="spinner"></span>
                Syncing...
              </>
            ) : (
              <>
                <span className="sync-icon">🔄</span>
                Sync Now
              </>
            )}
          </button>

          <button
            className="btn-stats"
            onClick={handleGetStats}
          >
            📊 View Stats
          </button>

          <button
            className="btn-logout"
            onClick={handleLogout}
          >
            Disconnect
          </button>
        </div>

        {userStats && (
          <div className="simkl-stats">
            <h5>Your Stats</h5>
            <div className="stats-grid">
              {userStats.movies && (
                <div className="stat-item">
                  <span className="stat-label">Movies</span>
                  <span className="stat-value">
                    {userStats.movies.completed?.count || 0}
                  </span>
                </div>
              )}
              {userStats.tv && (
                <div className="stat-item">
                  <span className="stat-label">TV Shows</span>
                  <span className="stat-value">
                    {userStats.tv.completed?.count || 0}
                  </span>
                </div>
              )}
              {userStats.anime && (
                <div className="stat-item">
                  <span className="stat-label">Anime</span>
                  <span className="stat-value">
                    {userStats.anime.completed?.count || 0}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SimklSync;
