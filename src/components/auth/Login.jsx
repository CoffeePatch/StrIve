import {useRef, useState } from "react";
import Header from "../layout/Header";
import { checkvaliddata } from "../../util/core/validate";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { auth } from "../../util/firebase/firebase";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { login } from "../../util/store/userSlice";

const Login = () => {
  const [IsSignin, setIsSignin] = useState(true);
  const [ErrorMsg, setErrorMsg] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const toogleSignup = () => {
    setIsSignin(!IsSignin);
    setErrorMsg(null);
  };

  const Navigate = useNavigate();
  const dispatch = useDispatch();
  const name = useRef(null);
  const email = useRef(null);
  const password = useRef(null);

  const handleButtonclick = () => {
    const emailVal = email.current.value;
    const passwordVal = password.current.value;
    const error = checkvaliddata(emailVal, passwordVal);
    setErrorMsg(error);
    if (error) {
      return;
    }
    
    setIsLoading(true);
    
    if (IsSignin) {
      signInWithEmailAndPassword(
        auth,
        email.current.value,
        password.current.value
      )
        .then((userCredential) => {
          const user = userCredential.user;
          dispatch(login({ uid: user.uid, email: user.email, name: user.displayName }));
          Navigate("/");
        })
        .catch((error) => {
          const errorCode = error.code;
          const errorMessage = error.message;
          setErrorMsg(errorCode + " " + errorMessage);
        })
        .finally(() => setIsLoading(false));
    } else {
      createUserWithEmailAndPassword(auth, emailVal, passwordVal)
        .then((userCredential) => {
          const user = userCredential.user;
          updateProfile(user, {
            displayName: name.current.value,
            photoURL: "https://example.com/jane-q-user/profile.jpg",
          })
            .then(() => {
              const { uid, email, displayName } = auth.currentUser;
              dispatch(login({ uid: uid, email: email, name: displayName }));
              Navigate("/");
            })
            .catch((error) => {
              setErrorMsg(error.message);
            });
        })
        .catch((error) => {
          const errorCode = error.code;
          const errorMessage = error.message;
          setErrorMsg(errorCode + " " + errorMessage);
        })
        .finally(() => setIsLoading(false));
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      <Header />
      
      <div className="absolute inset-0 z-0">
        <img
          src="https://assets.nflxext.com/ffe/siteui/vlv3/202ac35e-1fca-44f0-98d9-ea7e8211a07c/web/IN-en-20250512-TRIFECTA-perspective_688b8c03-78cb-46a6-ac1c-1035536f871a_large.jpg"
          alt="Background"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/60 to-black/80"></div>
      </div>

      <div className="relative z-10 flex items-center justify-center min-h-screen px-4 pt-20">
        <form
          className="w-full max-w-md glass-effect p-8 md:p-12 rounded-3xl shadow-2xl animate-fade-in"
          onSubmit={(e) => e.preventDefault()}
        >
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <span className="material-symbols-outlined text-6xl gradient-accent">
                account_circle
              </span>
            </div>
            <h1 className="font-display text-4xl font-bold text-white mb-2">
              {IsSignin ? "Welcome Back" : "Join Strive"}
            </h1>
            <p className="text-white/60 font-secondary text-sm">
              {IsSignin ? "Sign in to continue your journey" : "Create your account to get started"}
            </p>
          </div>

          {!IsSignin && (
            <div className="mb-5">
              <label className="block text-white/80 text-sm font-semibold mb-2 font-secondary">
                Full Name
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-white/40">
                  person
                </span>
                <input
                  ref={name}
                  className="w-full pl-12 pr-4 py-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-red-600 focus:bg-white/10 transition-all font-secondary"
                  type="text"
                  placeholder="Enter your full name"
                />
              </div>
            </div>
          )}

          <div className="mb-5">
            <label className="block text-white/80 text-sm font-semibold mb-2 font-secondary">
              Email Address
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-white/40">
                mail
              </span>
              <input
                ref={email}
                className="w-full pl-12 pr-4 py-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-red-600 focus:bg-white/10 transition-all font-secondary"
                type="email"
                placeholder="Enter your email"
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-white/80 text-sm font-semibold mb-2 font-secondary">
              Password
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-white/40">
                lock
              </span>
              <input
                ref={password}
                className="w-full pl-12 pr-4 py-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-red-600 focus:bg-white/10 transition-all font-secondary"
                type="password"
                placeholder="Enter your password"
              />
            </div>
          </div>

          {ErrorMsg && (
            <div className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-3">
              <span className="material-symbols-outlined text-red-400">
                error
              </span>
              <p className="text-sm text-red-400 font-secondary">{ErrorMsg}</p>
            </div>
          )}

          <button
            onClick={handleButtonclick}
            className="w-full btn-primary py-4 text-base flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="material-symbols-outlined animate-spin">
                  progress_activity
                </span>
                <span>Processing...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined">
                  {IsSignin ? 'login' : 'person_add'}
                </span>
                <span>{IsSignin ? "Sign In" : "Create Account"}</span>
              </>
            )}
          </button>

          <div className="mt-6 text-center">
            <button
              onClick={toogleSignup}
              className="text-white/80 hover:text-white text-sm font-secondary transition-colors"
            >
              {IsSignin
                ? "Don't have an account? "
                : "Already have an account? "}
              <span className="text-red-400 font-semibold">
                {IsSignin ? "Sign up now" : "Sign in"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
