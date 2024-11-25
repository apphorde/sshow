# SSH over WebSocket

This is a very, veeery basic, SSH over WebSockets implementation, just used for local debugging on tiny machines.

## Usage

### With systemd

```bash
bash sshow install
```

Next, you can use `systemctl` to manage it.


### With a shell

Add the current folder to your path or link to system path:

```bash
ln -s $PWD/sshow /usr/local/bin/sshow
```

Available commands: `start`, `stop`, `restart`, `daemon-start`, `install`, `status`

```bash
sshow start
# or
sshow daemon-start

sshow status
sshow restart
```

### With Docker

```bash
docker run --rm -p 8000:8000 -v /:/rootfs:ro ghcr.io/apphorde/sshow:latest
```
