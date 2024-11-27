FROM node:slim

WORKDIR /app
COPY . /app
RUN npm i --no-fund --no-audit
ENTRYPOINT ['/app/sshow']
CMD ['start']
