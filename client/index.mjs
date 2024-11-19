// import { AnsiUp } from 'https://unpkg.com/ansi_up@6.0.2/ansi_up.js';

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

async function main() {
  const terminal = getTerminal();
  const socket = new WebSocket("ws://" + location.hostname + "/socket");
  socket.addEventListener("message", (e) => {
    terminal.write(e.data);
  });

  terminal.onData((data) =>
    socket.send(JSON.stringify({ type: "input", data }))
  );
}

main();
