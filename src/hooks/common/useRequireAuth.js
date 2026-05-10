import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

const useRequireAuth = () => {
  const user = useSelector((store) => store.user.user);
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate("/login");
    } else {
      setIsChecking(false);
    }
  }, [user, navigate]);

  if (!user) {
    return null; // Return null if redirecting
  }

  if (isChecking) {
    return null; // Return null while checking
  }

  return user; // Return user object if authenticated
};

export default useRequireAuth;