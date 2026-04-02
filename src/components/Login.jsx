import { useState } from "react";

export default function Login({ onLogin }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function submit(e) {
    e.preventDefault();
    if (password === import.meta.env.VITE_APP_PASSWORD) {
      localStorage.setItem("auth", "1");
      onLogin();
    } else {
      setError("Fel lösenord");
      setPassword("");
    }
  }

  return (
    <div className="login-screen">
      <h1 className="login-title">Styrkekollen</h1>
      <form className="login-form" onSubmit={submit}>
        <input
          className="login-input"
          type="password"
          placeholder="Lösenord"
          value={password}
          autoFocus
          onChange={(e) => { setPassword(e.target.value); setError(""); }}
        />
        {error && <p className="login-error">{error}</p>}
        <button type="submit" className="login-btn">Logga in</button>
      </form>
    </div>
  );
}
