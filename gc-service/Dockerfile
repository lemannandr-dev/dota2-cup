FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY gc-service ./gc-service

USER node
EXPOSE 8080
CMD ["node", "gc-service/index.cjs"]