function getTerminal() {
  const terminal = new Terminal({ convertEol: true });
  terminal.open(document.getElementById("terminal"));

  const fitAddon = new FitAddon.FitAddon();
  terminal.loadAddon(fitAddon);
  window.addEventListener("resize", () => fitAddon.fit());

  return { terminal, fitAddon };
}

function debounce(fn, time = 50) {
  let timer;

  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), time);
  };
}

function sendInput() {
  const data = clientBuffer.join("");
  onSend({ type: "input", data });
  clientBuffer.length = 0;
}

let currentSocket;
let reconnect = true;
const sendDelayed = debounce(sendInput);
const clientBuffer = [];
const { terminal, fitAddon } = getTerminal();

function onClientWrite(c) {
  clientBuffer.push(c);

  if (c === "\r" || clientBuffer.length > 5) {
    return sendInput();
  }

  sendDelayed();
}

function onSend(data) {
  if (currentSocket && currentSocket.OPEN === currentSocket.readyState) {
    currentSocket.send(JSON.stringify(data));
  }
}

terminal.onData(onClientWrite);
terminal.onResize(({ cols, rows }) =>
  onSend({ type: "resize", data: { cols, rows } })
);

function onStatusChange(online) {
  const c = document.getElementById("status").classList;
  c.toggle("bg-green-400", online);
  c.toggle("bg-red-400", !online);

  if (!online && reconnect) {
    setTimeout(connect, 500);
  }
}

function onClose() {
  reconnect = false;

  if (currentSocket) {
    onSend({ type: "close" });
    currentSocket.close();
  }

  currentSocket = null;
  terminal.write("\nConnection closed.");
}

function onMessage(message) {
  const event = JSON.parse(message);

  switch (event.type) {
    case "close":
      onClose();
      break;

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
  setTimeout(() => fitAddon.fit(), 1000);
}

connect();
document.getElementById("status").onclick = () => {
  reconnect = true;
  terminal.clear();
  connect();
};
