FROM node:20-alpine

# Create app user (don't run as root)
RUN addgroup -S landlord && adduser -S landlord -G landlord

WORKDIR /app

# Install dependencies first (layer cache)
COPY package.json ./
RUN npm install --omit=dev

# Copy source
COPY server/ ./server/
COPY client/ ./client/

# Switch to non-root user
USER landlord

EXPOSE 3000

CMD ["node", "server/index.js"]
