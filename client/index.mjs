function getTerminal() {
  const term = new Terminal({ convertEol: true });
  term.open(document.getElementById("terminal"));

  if (typeof FitAddon !== "undefined") {
    const fitAddon = new FitAddon.FitAddon();
    term.loadAddon(fitAddon);
    window.addEventListener("resize", () => fitAddon.fit());
  }

  return term;
}

let currentSocket;

const terminal = getTerminal();
terminal.onData((data) => {
  currentSocket?.send(JSON.stringify({ type: "input", data }));
});

function onStatusChange(online) {
  const c = document.getElementById("status").classList;
  c.toggle("bg-green-400", online);
  c.toggle("bg-red-400", !online);

  if (!online) {
    terminal.clear();
    terminal.write("Connection lost, resetting...");
    setTimeout(connect, 500);
  }
}

function onMessage(message) {
  const event = JSON.parse(message);
  switch (event.type) {
    case "ack":
    case "stdout":
    case "stderr":
      const chunk = event.data;

      if (typeof chunk === "string") {
        terminal.write(chunk);
        break;
      }

      if (chunk.type === "Buffer") {
        const buffer = new ArrayBuffer(chunk.data.length);
        const uint8 = new Uint8Array(buffer);
        uint8.set(chunk.data, 0);
        terminal.write(uint8);
      }
      break;

    case "end":
      terminal.write("> ");
      break;
  }
}

async function connect() {
  const socket = new WebSocket("ws://" + location.host + "/socket");

  socket.addEventListener("message", (e) => onMessage(e.data));
  socket.addEventListener("close", () => onStatusChange(false));
  socket.addEventListener("open", () => {
    onStatusChange(true);
    terminal.clear();
    terminal.write("> ");
  });

  currentSocket = socket;
}

connect();
