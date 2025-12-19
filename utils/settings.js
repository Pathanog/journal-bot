const fs = require("fs");
const path = "./data/guilds.json";

function load() {
  if (!fs.existsSync(path)) fs.writeFileSync(path, "{}");
  return JSON.parse(fs.readFileSync(path));
}

function save(data) {
  fs.writeFileSync(path, JSON.stringify(data, null, 2));
}

function getGuild(guildId) {
  return load()[guildId] || {};
}

function setGuild(guildId, key, value) {
  const data = load();
  if (!data[guildId]) data[guildId] = {};
  data[guildId][key] = value;
  save(data);
}

module.exports = { getGuild, setGuild };
