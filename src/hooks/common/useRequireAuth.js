import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

const useRequireAuth = () => {
  const user = useSelector((store) => store.user.user);
  const initialized = useSelector((store) => store.user.initialized);
  const navigate = useNavigate();

  useEffect(() => {
    if (!initialized) {
      return;
    }

    if (!user) {
      navigate("/login", { replace: true });
    }
  }, [initialized, user, navigate]);

  if (!initialized || !user) {
    return null;
  }

  return user; // Return user object if authenticated
};

export default useRequireAuth;