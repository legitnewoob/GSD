FROM node:lts-alpine

WORKDIR /app/server

# Copy package files and prisma schema first for layer caching
COPY server/package*.json ./
COPY server/prisma ./prisma

# Install all deps (prisma CLI is needed to generate the client)
RUN npm install

# Copy server source and shared constants
COPY server/ .
COPY shared/ ../shared

# Generate Prisma client
RUN npx prisma generate

EXPOSE 4000

CMD ["node", "src/index.js"]
