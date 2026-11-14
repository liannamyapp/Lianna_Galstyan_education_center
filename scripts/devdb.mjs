import EmbeddedPostgres from "embedded-postgres";
const pg = new EmbeddedPostgres({ databaseDir: "/tmp/pgdata", user: "lg", password: "lg", port: 5433, persistent: true });
try { await pg.initialise(); } catch (e) { console.log("init:", e.message); }
await pg.start();
try { await pg.createDatabase("lg"); } catch {}
console.log("PG READY");
setInterval(() => {}, 1 << 30);
