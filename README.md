# SSH over WebSocket

This is a very, veeery basic, SSH over WebSockets implementation, just used for local access.

## Usage


### With Docker

```bash
docker run --rm -p 8000:8000 -v /:/rootfs:ro ghcr.io/apphorde/sshow:latest
```


For other options (below), first clone this repository somewhere:

```bash
git clone https://github.com/apphorde/sshow /opt/sshow
cd /opt/sshow
```

### With systemd

```bash
bash sshow install
```

Next, you can use `systemctl` to manage it.

```bash
systemctl status sshow
systemctl restart sshow
# ...
```

### With a shell

Add the current folder to your path or link to system path:

```bash
ln -s $PWD/sshow /usr/local/bin/sshow
```

Available commands: `start`, `stop`, `restart`, `daemon-start`, `install`, `status`

```bash
sshow start
# or start as a daemon, i.e. detached from current terminal
sshow daemon-start

sshow status
sshow restart
```
