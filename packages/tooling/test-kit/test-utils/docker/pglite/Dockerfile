FROM node:22-bookworm-slim

WORKDIR /app

RUN npm init -y \
  && npm install --omit=dev \
    @electric-sql/pglite@0.4.5 \
    @electric-sql/pglite-socket@0.1.5 \
    pg@8.20.0 \
  && npm cache clean --force

EXPOSE 5432

CMD ["./node_modules/.bin/pglite-server", "--db=memory://", "--host=0.0.0.0", "--port=5432", "--max-connections=8"]
