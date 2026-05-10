/**
 * SIMKL OAuth Callback Page
 * Handles the OAuth redirect from SIMKL
 */

import React from "react";
import { useSimklCallback } from "../../hooks/simkl/useSimkl";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import "./SimklCallback.css";

const SimklCallback = () => {
  const navigate = useNavigate();

  // This hook automatically handles the OAuth code exchange
  useSimklCallback();

  useEffect(() => {
    // Redirect to simkl page after 2 seconds
    const timer = setTimeout(() => {
      navigate("/simkl");
    }, 2000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="simkl-callback-page">
      <div className="callback-container">
        <div className="spinner-large"></div>
        <h2>Connecting to SIMKL...</h2>
        <p>Please wait while we complete the authentication</p>
      </div>
    </div>
  );
};

export default SimklCallback;
