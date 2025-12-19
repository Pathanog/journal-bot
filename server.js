const express = require("express");
const app = express();

app.get("/", (_, res) => {
  res.send("✅ Journal Bot is running");
});

module.exports = () => {
  app.listen(3000, () => console.log("🌐 Uptime server active"));
};
