import React from "react";

export default function Login() {
  const [email, setEmail] = React.useState("");
  const [message, setMessage] = React.useState("");

  async function submit(event) {
    event.preventDefault();
    const res = await fetch(((typeof window !== "undefined" && window.FRAY_API) || "") + "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(data.error || "Sign-in failed");
      return;
    }
    sessionStorage.setItem("fray-token", data.token);
    sessionStorage.setItem("fray-email", data.email);
    window.location.hash = "/dashboard";
  }

  return (
    <main className="page narrow">
      <p className="kicker">Local demo</p>
      <h1>Sign in</h1>
      <p className="lede">Email only. No password is collected or stored. The session flag stays in this browser.</p>
      <form className="stack" onSubmit={submit}>
        <label>
          Email
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@studio.dev" required />
        </label>
        <button className="btn" type="submit">Continue</button>
      </form>
      {message && <p className="warn">{message}</p>}
    </main>
  );
}
