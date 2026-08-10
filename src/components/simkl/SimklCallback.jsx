import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import simklAuthService from "../../services/simkl/simklAuthService";
import "./SimklCallback.css";

const SimklCallback = () => {
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = useState(null);
  const processedRef = useRef(false);

  useEffect(() => {
    const processCallback = async () => {
      if (processedRef.current) return;
      processedRef.current = true;

      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get("code");
      const state = urlParams.get("state");
      const error = urlParams.get("error");

      if (error) {
        console.error("SIMKL OAuth error:", error);
        setErrorMsg("Simkl connection was cancelled or denied.");
        setTimeout(() => navigate("/settings"), 3000);
        return;
      }

      if (!code) {
        setErrorMsg("Missing authorization code from Simkl.");
        setTimeout(() => navigate("/settings"), 3000);
        return;
      }

      try {
        const result = await simklAuthService.exchangeCodeForToken(code, state);
        if (result.success || result.connected) {
          navigate("/settings");
        } else {
          setErrorMsg(result.error || "Simkl connection failed.");
          setTimeout(() => navigate("/settings"), 3000);
        }
      } catch (err) {
        console.error("Callback processing error:", err);
        setErrorMsg(err.message || "An unexpected error occurred.");
        setTimeout(() => navigate("/settings"), 3000);
      }
    };

    processCallback();
  }, [navigate]);

  return (
    <div className="simkl-callback-page">
      <div className="callback-container">
        {errorMsg ? (
          <>
            <span className="material-symbols-outlined text-red-400 text-5xl mb-2">error</span>
            <h2>Connection Error</h2>
            <p className="text-secondary mt-1">{errorMsg}</p>
            <p className="text-muted text-xs mt-3">Redirecting back to settings...</p>
          </>
        ) : (
          <>
            <div className="spinner-large"></div>
            <h2>Connecting to SIMKL...</h2>
            <p>Securing authentication with Strive</p>
          </>
        )}
      </div>
    </div>
  );
};

export default SimklCallback;
