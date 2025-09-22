import { ref, defineProp, onInit, onDestroy } from "@li3/web";
import { templateRef } from "@li3/plugins";

const defaults = {
  maxBuffer: 5,
  debounceTime: 50,
};

const config = {
  ...defaults,
  ...(window.sshow || {}),
};

function debounce(fn, time = config.debouceTime) {
  let timer;

  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), time);
  };
}

const addons = new Set();
window.addEventListener("resize", () => {
  for (const next of addons) {
    next.fit();
  }
});

export default function () {
  const terminalRef = templateRef("terminal");
  const reconnect = ref(true);
  const online = ref(false);
  const name = defineProp("name", {
    default() {
      return "term-" + ~~(Math.random() * 100);
    },
  });

  function sendInput() {
    const data = clientBuffer.join("");
    onSend({ type: "input", data });
    clientBuffer.length = 0;
  }

  let currentSocket;
  let terminal;
  let fitAddon;
  const sendDelayed = debounce(sendInput);
  const clientBuffer = [];

  function createTerminal() {
    terminal = new Terminal({ convertEol: true });
    terminal.open(terminalRef.value);

    fitAddon = new FitAddon.FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.onData(onClientWrite);
    terminal.onResize(({ cols, rows }) =>
      onSend({ type: "resize", data: { cols, rows } })
    );
  }

  function onClientWrite(c) {
    clientBuffer.push(c);

    if (c === "\r" || clientBuffer.length > config.maxBuffer) {
      return sendInput();
    }

    sendDelayed();
  }

  function onSend(data) {
    if (currentSocket && currentSocket.OPEN === currentSocket.readyState) {
      currentSocket.send(JSON.stringify(data));
    }
  }

  function onStatusChange(newStatus) {
    online.value = newStatus;

    if (!newStatus && reconnect.value) {
      setTimeout(connect, 5000);
    }

    if (newStatus) {
      fitAddon.fit();
    }
  }

  function onClose() {
    reconnect.value = false;

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
      location.protocol.replace("http", "ws") +
        "//" +
        location.host +
        "/socket?name=" +
        name.value
    );

    socket.addEventListener("message", (e) => onMessage(e.data));
    socket.addEventListener("close", () => onStatusChange(false));
    socket.addEventListener("open", () => onStatusChange(true));

    currentSocket = socket;
    setTimeout(() => fitAddon.fit(), 1000);
  }

  onInit(() => {
    createTerminal();
    connect();
    addons.add(fitAddon);
  });

  onDestroy(() => {
    addons.delete(fitAddon);
  });

  function onReconnect() {
    reconnect.value = true;
    terminal.clear();
    connect();
  }

  return { onReconnect, online, name };
}
