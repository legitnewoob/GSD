FROM node:lts-alpine

# Prisma engine needs openssl/libc compatibility on Alpine
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app/server

# Copy package files and prisma schema first for layer caching
COPY server/package*.json ./
COPY server/prisma ./prisma

# Install all deps (prisma CLI is needed to generate the client)
RUN npm install

# Copy server source and shared constants
COPY server/ .
COPY shared/ ../shared

# Provide a placeholder DATABASE_URL for client generation if one is not supplied
ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL:-postgresql://placeholder:placeholder@localhost:5432/placeholder}

# Generate Prisma client
RUN npx prisma generate

EXPOSE 4000

CMD ["node", "src/index.js"]
