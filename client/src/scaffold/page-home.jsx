import React from "react";

export default function Home() {
  const name = (typeof window !== "undefined" && window.FRAY_NAME) || "Fraymus";
  return (
    <main className="page">
      <p className="kicker">MERN · Mongo Express React Node</p>
      <h1>{name}</h1>
      <p className="lede">
        A live React front end talking to an Express API. Records stay in memory until you set MONGODB_URI, then the Item model takes over.
      </p>
      <div className="row">
        <a className="btn" href="#/dashboard">Open dashboard</a>
        <a className="btn ghost" href="#/settings">Runtime options</a>
      </div>
      <section className="grid">
        <article>
          <h3>Mongo</h3>
          <p>Mongoose Item model. Memory store when no database URI is set.</p>
        </article>
        <article>
          <h3>Express</h3>
          <p>JSON API for items and a local demo sign-in that never stores a password.</p>
        </article>
        <article>
          <h3>React</h3>
          <p>Pages in this project: Home, Dashboard, Login, and Settings.</p>
        </article>
        <article>
          <h3>Node</h3>
          <p>Start it from the studio Node panel, or run node server/index.js.</p>
        </article>
      </section>
    </main>
  );
}
