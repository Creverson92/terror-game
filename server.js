const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const root = __dirname;
const port = Number(process.env.PORT || 4173);
const players = new Map();
let ranking = [];

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function sendJson(res, data) {
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 10000) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        resolve({});
      }
    });
  });
}

function cleanPlayers() {
  const now = Date.now();
  for (const [id, player] of players) {
    if (now - player.seenAt > 15000) players.delete(id);
  }
}

function state() {
  cleanPlayers();
  return {
    online: [...players.values()]
      .sort((a, b) => b.score - a.score || b.level - a.level)
      .map(({ id, name, level, score }) => ({ id, name, level, score })),
    ranking: ranking.slice(0, 10),
  };
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type" });
    res.end();
    return;
  }

  if (req.url === "/api/state" && req.method === "GET") {
    sendJson(res, state());
    return;
  }

  if (req.url === "/api/join" && req.method === "POST") {
    const body = await readBody(req);
    const id = String(body.id || Math.random().toString(36).slice(2));
    const name = String(body.name || "Jogador").slice(0, 18);
    players.set(id, { id, name, level: 1, score: 0, seenAt: Date.now() });
    sendJson(res, { id, ...state() });
    return;
  }

  if (req.url === "/api/heartbeat" && req.method === "POST") {
    const body = await readBody(req);
    const id = String(body.id || "");
    if (players.has(id)) {
      const player = players.get(id);
      player.name = String(body.name || player.name).slice(0, 18);
      player.level = Math.max(1, Math.min(10, Number(body.level || player.level)));
      player.score = Math.max(0, Number(body.score || player.score));
      player.seenAt = Date.now();
    }
    sendJson(res, state());
    return;
  }

  if (req.url === "/api/score" && req.method === "POST") {
    const body = await readBody(req);
    const entry = {
      name: String(body.name || "Jogador").slice(0, 18),
      score: Math.max(0, Number(body.score || 0)),
      level: Math.max(1, Math.min(10, Number(body.level || 1))),
      result: body.win ? "Zerou" : "Caiu",
      date: new Date().toLocaleString("pt-BR"),
    };
    ranking.push(entry);
    ranking.sort((a, b) => b.score - a.score || b.level - a.level);
    ranking = ranking.slice(0, 20);
    sendJson(res, state());
    return;
  }

  const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  const filePath = path.join(root, urlPath === "/" ? "index.html" : urlPath);
  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end("Bloqueado");
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Nao encontrado");
      return;
    }
    res.writeHead(200, { "Content-Type": mime[path.extname(filePath)] || "application/octet-stream" });
    res.end(data);
  });
});

server.listen(port, "0.0.0.0", () => {
  const nets = os.networkInterfaces();
  const addresses = [];
  Object.values(nets).flat().forEach((net) => {
    if (net && net.family === "IPv4" && !net.internal) addresses.push(`http://${net.address}:${port}`);
  });
  console.log(`Euzebios-Terror online em http://127.0.0.1:${port}`);
  addresses.forEach((address) => console.log(`Rede local: ${address}`));
});
