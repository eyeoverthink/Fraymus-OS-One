import React from "react";

export default function Dashboard() {
  const [items, setItems] = React.useState([]);
  const [title, setTitle] = React.useState("");
  const [error, setError] = React.useState("");
  const api = ((typeof window !== "undefined" && window.FRAY_API) || "") + "/api/items";

  async function load() {
    try {
      const res = await fetch(api);
      if (!res.ok) throw new Error("API " + res.status);
      setItems(await res.json());
      setError("");
    } catch (err) {
      setError("API is not reachable from this preview. Start the live server or the Node app.");
      setItems([]);
    }
  }

  React.useEffect(() => {
    load();
  }, []);

  async function add(event) {
    event.preventDefault();
    if (!title.trim()) return;
    const res = await fetch(api, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, status: "draft" })
    });
    if (!res.ok) {
      setError("Could not save that record.");
      return;
    }
    setTitle("");
    load();
  }

  async function remove(id) {
    await fetch(api + "/" + id, { method: "DELETE" });
    load();
  }

  return (
    <main className="page">
      <p className="kicker">Express API</p>
      <h1>Dashboard</h1>
      <form className="bar" onSubmit={add}>
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="New record title" />
        <button className="btn" type="submit">Add</button>
      </form>
      {error && <p className="warn">{error}</p>}
      <ul className="list">
        {items.map((item) => (
          <li key={item.id}>
            <div>
              <strong>{item.title}</strong>
              <span>{item.status}</span>
            </div>
            <button type="button" onClick={() => remove(item.id)}>Remove</button>
          </li>
        ))}
      </ul>
    </main>
  );
}
