// src/App.js
import React, { useState } from "react";
import Login from "./Login";
import Dashboard from "./Dashboard";
import "./App.css";

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
  };

  // If no token, show Login Page
  if (!token) {
    return <Login setToken={setToken} />;
  }

  // If token exists, show Dashboard (and pass the token to it)
  return (
    <div>
       {/* Small Logout Button at top right */}
       <button 
         onClick={logout} 
         style={{
           position: 'fixed', 
           top: '10px', 
           right: '10px', 
           zIndex: 9999,
           background: '#ef4444',
           color: 'white',
           border: 'none',
           padding: '8px 16px',
           borderRadius: '4px',
           cursor: 'pointer'
         }}
       >
         Logout
       </button>
       
       <Dashboard token={token} />
    </div>
  );
}

export default App;