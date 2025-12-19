const fs = require("fs");
const path = "./data/guilds.json";

function load() {
  if (!fs.existsSync(path)) fs.writeFileSync(path, "{}");
  return JSON.parse(fs.readFileSync(path));
}

function save(data) {
  fs.writeFileSync(path, JSON.stringify(data, null, 2));
}

function getGuild(id) {
  return load()[id] || {};
}

function setGuild(id, key, value) {
  const data = load();
  if (!data[id]) data[id] = {};
  data[id][key] = value;
  save(data);
}

module.exports = { getGuild, setGuild };
