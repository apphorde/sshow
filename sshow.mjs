import { createReadStream, existsSync } from "fs";
import { createServer } from "http";
import { join } from "path";
import { WebSocketServer } from "ws";
import * as pty from "node-pty";
import { spawn } from "child_process";

if (process.argv.includes("--daemon")) {
  spawn("node", [process.argv[1]], {
    detached: true,
    stdio: "inherit",
  }).unref();
  process.exit(0);
}

const cwd = process.cwd();
const port = Number(process.env.PORT || 8000);
const killTimeout = Number(process.env.KILL_TIMEOUT || 10_000);
const _ = JSON.stringify;
const sessions = new Map();
const mime = {
  mjs: "text/javascript",
  css: "text/css",
  html: "text/html",
};

const server = createServer();
const wss = new WebSocketServer({
  noServer: true,
  clientTracking: true,
});

function onHttpRequest(request, response) {
  const url = new URL(request.url, "http://localhost");
  const { pathname } = url;

  if (pathname === "/") {
    response.setHeader("Location", "/ui/index.html");
    response.writeHead(302);
    response.end();
    return;
  }

  if (pathname === "/stats") {
    const clients = [...wss.clients];
    response.end(
      JSON.stringify(
        {
          server: {
            connections: server._connections,
            clients: clients.length,
            sessions: sessions.size,
          },
          clients: clients.map((c) => ({
            name: c.name,
            state: c._readyState,
            open: c.readyState === c.OPEN,
            shell: {
              pid: c.shell.pid,
              cols: c.shell.cols,
              rows: c.shell.rows,
              pty: c.shell._pty,
              entrypoint: c.shell._file,
            },
          })),
        },
        null,
        2
      )
    );
    return;
  }

  if (pathname.startsWith("/ui/")) {
    const file = join(cwd, pathname.replace("/ui/", "client/"));

    if (existsSync(file)) {
      const ext = file.split(".").pop();
      if (ext in mime) {
        response.setHeader("content-type", mime[ext]);
      }

      createReadStream(file).pipe(response);
    } else {
      response.writeHead(404).end("Not found");
    }

    return;
  }
}

async function onUpgrade(request, socket, head) {
  try {
    // todo auth
  } catch (e) {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, onConnection);
}

/** @param {import('ws').WebSocket} ws */
function onConnection(ws, request) {
  const url = new URL(request.url, "http://local");
  const name = /^[a-zA-Z]{8,32}$/.test(url.searchParams.get("name"))
    ? url.searchParams.get("name")
    : "default";

  const shell =
    sessions.get(name) ??
    pty.spawn("login", [], {
      name: "xterm-color",
      cols: 80,
      rows: 30,
      cwd: process.env.HOME || process.cwd(),
      env: process.env,
    });

  ws.shell = shell;
  clearTimeout(ws.shell.killTimer);

  if (name) {
    shell.sessionName = name;
    console.log("Connecting to session " + name);
    sessions.set(name, shell);
  }

  ws.on("error", console.error);
  ws.on("message", function message(data) {
    const json = data.toString("utf8");
    const event = JSON.parse(json);

    if (shell.closed) {
      onClose(ws);
      return;
    }

    switch (event.type) {
      case "input":
        shell.write(event.data);
        break;

      case "resize": {
        const { cols, rows } = event.data;
        shell.resize(cols, rows);
        break;
      }

      case "close":
        onClose(ws);
        break;
    }
  });

  shell.onData(
    (data) =>
      ws.readyState !== ws.CLOSED && ws.send(_({ type: "stdout", data }))
  );
  shell.onExit(() => {
    ws.readyState !== ws.CLOSED && ws.send(_({ type: "close" }));
    killShell(shell);
  });
  ws.on("close", () => onClose(ws));
}

function onClose(ws) {
  if (ws.readyState !== ws.CLOSED) {
    ws.close();
  }

  ws.shell.killTimer = setTimeout(() => killShell(ws.shell), killTimeout);
}

function killShell(shell) {
  sessions.delete(shell._name);
  shell.kill();
  shell.closed = true;
}

server.on("request", onHttpRequest);
server.on("upgrade", onUpgrade);
wss.on("connection", onConnection);

server.listen(port, "0.0.0.0", () => {
  console.log("Server started at http://localhost:" + port);
});
