const express = require("express");
const dotenv = require("dotenv");

dotenv.config({ path: ".env.local" });
dotenv.config();

const handler = require("./api/zendesk-request");

const app = express();
const port = Number(process.env.PORT) || 3003;

console.log(12312)

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.options("/api/zendesk-request", (req, res) => handler(req, res));
app.post("/api/zendesk-request", (req, res) => handler(req, res));
app.all("/api/zendesk-request", (req, res) => handler(req, res));

app.get("/", (req, res) => {
  res.json({
    ok: true,
    endpoint: "/api/zendesk-request",
  });
});

app.listen(port, () => {
  console.log(`Local relay listening on http://localhost:${port}`);
});
