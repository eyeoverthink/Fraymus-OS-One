import React from "react";

export default function Settings() {
  const [health, setHealth] = React.useState(null);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    const base = (typeof window !== "undefined" && window.FRAY_API) || "";
    fetch(base + "/api/health")
      .then((res) => {
        if (!res.ok) throw new Error("API " + res.status);
        return res.json();
      })
      .then(setHealth)
      .catch(() => setError("Health check needs the live server or the Node app."));
  }, []);

  return (
    <main className="page narrow">
      <p className="kicker">Options</p>
      <h1>Runtime</h1>
      <p className="lede">This page reads the API that is actually serving the preview.</p>
      {error && <p className="warn">{error}</p>}
      {health && (
        <dl className="stats">
          <div><dt>Runtime</dt><dd>{health.runtime}</dd></div>
          <div><dt>Mongo</dt><dd>{health.mongo}</dd></div>
          <div><dt>Port</dt><dd>{health.port || "studio"}</dd></div>
        </dl>
      )}
      <p className="lede">Set MONGODB_URI in the Node panel to switch the Item model from memory to MongoDB.</p>
    </main>
  );
}
