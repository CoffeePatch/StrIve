import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../util/firebase/firebase";

const ProtectedRoute = ({ children }) => {
  const { user } = useSelector((store) => store.user);
  const navigate = useNavigate();
  const [authInitialized, setAuthInitialized] = useState(false);

  useEffect(() => {
    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, () => {
      setAuthInitialized(true);
      
      // Auth state has been initialized
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Only redirect if auth is initialized and there's no user
    if (authInitialized && !user) {
      navigate("/login");
    }
  }, [authInitialized, user, navigate]);

  // Show loading state while auth is initializing
  if (!authInitialized) {
    return (
      <div className="bg-black min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-red-600 mx-auto"></div>
          <div className="mt-4 text-white text-lg">Loading...</div>
        </div>
      </div>
    );
  }

  // Show nothing while redirecting
  if (!user) {
    return null;
  }

  return children;
};

export default ProtectedRoute;