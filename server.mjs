import { spawn } from "child_process";
import { createReadStream, existsSync } from "fs";
import { createServer } from "http";
import { join } from "path";
import { WebSocketServer } from "ws";

const cwd = process.cwd();
const port = Number(process.env.PORT || 8000);

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
const _s = JSON.stringify;

wss.on("connection", function connection(ws) {
  const shell = spawn(process.env.SHELL || "/bin/sh");
  ws.shell = shell;

  ws.on("error", console.error);
  ws.on("message", function message(data) {
    const event = JSON.parse(data);
    switch (event.type) {
      case "input":
        shell.stdin.write(data);
        break;

      case "close":
        onClose(ws);
    }
  });

  shell.stdout.on("data", (data) => ws.send(_s({ type: "stdout", data })));
  shell.stderr.on("data", (data) => ws.send(_s({ type: "stderr", data })));

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
  console.log("Server started at :" + port);
});
