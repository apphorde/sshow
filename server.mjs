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
const _ = JSON.stringify;
const mime = {
  mjs: "text/javascript",
  css: "text/css",
  html: "text/html",
};

const server = createServer();
const wss = new WebSocketServer({
  noServer: true,
  path: "/socket",
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
    response.end(
      _({
        clients: [...wss.clients],
      })
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
  console.log("Connecting " + request.url);

  const shell = pty.spawn("bash", [], {
    name: "xterm-color",
    cols: 80,
    rows: 30,
    cwd: process.env.HOME || process.cwd(),
    env: process.env,
  });

  ws.shell = shell;

  ws.on("error", console.error);
  ws.on("message", function message(data) {
    const json = data.toString("utf8");
    const event = JSON.parse(json);

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

  shell.onData((data) => ws.send(_({ type: "stdout", data })));
  shell.onExit(() => ws.send(_({ type: "close" })));
  ws.on("close", () => onClose(ws));
}

function onClose(ws) {
  if (ws.readyState !== ws.CLOSED) {
    ws.close();
  }

  ws.shell.kill();
}

server.on("request", onHttpRequest);
server.on("upgrade", onUpgrade);
wss.on("connection", onConnection);

server.listen(port, "0.0.0.0", () => {
  console.log("Server started at http://localhost:" + port);
});
