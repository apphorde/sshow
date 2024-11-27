FROM node:alpine

RUN apk add --update --no-cache python3 && ln -sf python3 /usr/bin/python && apk add --no-cache py3-pip
WORKDIR /app
COPY . /app
RUN npm i --no-fund --no-audit
ENTRYPOINT ["/app/sshow"]
CMD ["start"]
