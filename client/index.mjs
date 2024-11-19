function getTerminal() {
  const term = new Terminal({ convertEol: true });
  term.open(document.getElementById("terminal"));

  const fitAddon = new FitAddon.FitAddon();
  term.loadAddon(fitAddon);
  window.addEventListener("resize", () => fitAddon.fit());

  return term;
}

let currentSocket;
const clientBuffer = [];

function debounce(fn, time = 50) {
  let timer;

  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), time);
  };
}

function send() {
  const data = clientBuffer.join("");
  currentSocket?.send(JSON.stringify({ type: "input", data }));
  clientBuffer.length = 0;
}

const sendDelayed = debounce(send);
const terminal = getTerminal();

terminal.onData((c) => {
  clientBuffer.push(c);

  if (c === "\r" || clientBuffer.length > 5) {
    return send();
  }

  sendDelayed();
});

terminal.onResize(({ cols, rows }) => {
  currentSocket?.send(JSON.stringify({ type: "resize", data: { cols, rows } }));
})

function onStatusChange(online) {
  const c = document.getElementById("status").classList;
  c.toggle("bg-green-400", online);
  c.toggle("bg-red-400", !online);

  if (!online) {
    setTimeout(connect, 500);
  }
}

function onMessage(message) {
  const event = JSON.parse(message);

  switch (event.type) {
    case "stdout":
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
  }
}

async function connect() {
  const socket = new WebSocket(
    location.protocol.replace("http", "ws") + "//" + location.host + "/socket"
  );

  socket.addEventListener("message", (e) => onMessage(e.data));
  socket.addEventListener("close", () => onStatusChange(false));
  socket.addEventListener("open", () => onStatusChange(true));

  currentSocket = socket;
}

connect();
