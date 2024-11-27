FROM node:alpine

RUN apk add --update --no-cache gcc g++ make zlib-dev libffi-dev openssl-dev musl-dev python3 py3-pip && ln -sf python3 /usr/bin/python
WORKDIR /app
COPY . /app
RUN npm i --no-fund --no-audit
ENTRYPOINT ["/app/sshow"]
CMD ["start"]
