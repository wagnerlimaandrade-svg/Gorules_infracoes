FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --omit=dev

COPY server.js ./
COPY rules ./rules

ENV NODE_ENV=production
ENV PORT=3000
ENV RULE_FILE=/app/rules/classificacao-infracao.json

EXPOSE 3000

USER node

CMD ["npm", "start"]