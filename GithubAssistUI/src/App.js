import React from "react";
import { Routes, Route, NavLink, useNavigate } from "react-router-dom";
import { FiSettings, FiRefreshCw } from "react-icons/fi";
import { AiFillHome } from "react-icons/ai";
import Home from "./pages/Home";
import Configure from "./pages/Configure";

function Sidebar() {
  const navigate = useNavigate();

  // const onRefresh = () => {
  //   navigate("/",{reset:true,skipWelcome:true, resetToken:Date.now()});
  // };
  
const onRefresh = () => {
  navigate("/", {
    replace: true,               // optional: don’t add a new entry in history
    state: {
      skipWelcome: true,         // your flag for Home to skip splash
      resetToken: Date.now(),    // ensures state changes every click
    },
  });
};

  
// const onRefresh = () => {
//   const rt = Date.now();
//   navigate({
//     pathname: "/",
//     search: `?skipWelcome=1&rt=${rt}`, // ensures location changes every time
//   }, { replace: true });
// };


  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <div className="brand-avatar">M</div>
      </div>

      <nav className="sidebar-nav">
        <NavLink
          to="/"
          end
          className={({ isActive }) => `nav-icon ${isActive ? "active" : ""}`}
          title="Home"
          aria-label="Home"
        >
          <AiFillHome size={20} />
        </NavLink>

        <NavLink
          to="/configure"
          className={({ isActive }) => `nav-icon ${isActive ? "active" : ""}`}
          title="Configure"
          aria-label="Configure"
        >
          <FiSettings size={20} />
        </NavLink>
      </nav>

      {/* Bottom actions */}
      <div className="sidebar-bottom">
        <button
          type="button"
          className="nav-icon refresh"
          onClick={onRefresh}
          title="Reset"
          aria-label="Reset"
        >
          <FiRefreshCw size={18} />
        </button>
      </div>
      
    </aside>
  );
}

export default function App() {
  return (
    <div className="app-shell">
      <Sidebar />

      <div className="main">
        <header className="topbar">
          <div className="brand">Mphasis</div>
        </header>

        <main className="content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/configure" element={<Configure />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}