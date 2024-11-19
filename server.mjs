import { createReadStream, existsSync } from "fs";
import { createServer } from "http";
import { join } from "path";
import { WebSocketServer } from "ws";
import * as pty from "node-pty";

const cwd = process.cwd();
const port = Number(process.env.PORT || 8000);
const mime = {
  mjs: "text/javascript",
  css: "text/css",
  html: "text/html",
};

const server = createServer(function (request, response) {
  const url = new URL(request.url, "http://localhost");
  const { pathname } = url;

  if (pathname === "/") {
    response.setHeader("Location", "/ui/index.html");
    response.writeHead(302);
    response.end();
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
      notFound(response);
    }

    return;
  }
});

function notFound(response) {
  response.writeHead(404).end("Not found");
}

const wss = new WebSocketServer({ server, path: "/socket" });
const _ = JSON.stringify;

wss.on("connection", function connection(ws) {
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
    }
  });

  shell.onData((data) => ws.send(_({ type: "stdout", data })));

  ws.on("close", () => onClose(ws));
});

function onClose(ws) {
  if (!ws.shell.killed) {
    ws.shell.kill();
  }

  if (ws.readyState !== ws.CLOSED) {
    ws.close();
  }
}

server.listen(port, "0.0.0.0", () => {
  console.log("Server started at http://localhost:" + port);
});
