import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./util/firebase/firebase";
import { login, logout } from "./util/store/userSlice";
import Body from "./components/layout/Body";

import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const App = () => {
  const dispatch = useDispatch();

  useEffect(() => {
    // Check authentication state on app load
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // User is authenticated, dispatch login action
        const { uid, email, displayName } = user;
        dispatch(login({ uid: uid, email: email, name: displayName }));
      } else {
        // User is not authenticated, dispatch logout action
        dispatch(logout());
      }
    });

    // Cleanup subscription on component unmount
    return () => unsubscribe();
  }, [dispatch]);

  useEffect(() => {
    const isHorizontallyScrollable = (el) => {
      if (!el || !(el instanceof HTMLElement)) return false;
      if (el.scrollWidth <= el.clientWidth) return false;

      const style = window.getComputedStyle(el);
      const overflowX = style.overflowX;
      return overflowX === "auto" || overflowX === "scroll" || overflowX === "overlay";
    };

    const findScrollableAncestor = (target) => {
      let node = target instanceof HTMLElement ? target : null;
      while (node && node !== document.body) {
        if (
          node.dataset.horizontalScroll === "true" &&
          isHorizontallyScrollable(node)
        ) {
          return node;
        }
        node = node.parentElement;
      }
      return null;
    };

    const handleWheel = (e) => {
      // If another handler already processed this wheel event, do nothing.
      if (e.defaultPrevented) return;
      if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;

      const scrollContainer = findScrollableAncestor(e.target);
      if (!scrollContainer) return;

      e.preventDefault();
      scrollContainer.scrollLeft += e.deltaY;
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, []);

  return (
    <div>
      <Body />
      <ToastContainer position="bottom-right" theme="dark" />
    </div>
  );
};

export default App;
