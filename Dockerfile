# Stage 1: Dependencies
FROM node:18-alpine AS deps
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci
# Generate Prisma Client
RUN npx prisma generate

# Stage 2: Builder
FROM node:18-alpine AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma

# Copy source code
COPY . .

# Build application
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

# Stage 3: Runner
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Install SQLite and necessary tools
RUN apk add --no-cache sqlite shadow

# Create user with shell access
RUN addgroup -g 1001 nodejs && \
    adduser -D -u 1001 -G nodejs -s /bin/sh nextjs && \
    chown -R nextjs:nodejs /app

# Set environment variables
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DATABASE_URL=file:/app/data/prod.db

# Copy necessary files from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Create data directory
RUN mkdir -p /app/data && \
    chown nextjs:nodejs /app/data && \
    chmod 777 /app/data

# Create a startup script that handles database initialization
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'set -e' >> /app/start.sh && \
    echo 'cd /app' >> /app/start.sh && \
    echo 'if [ ! -f /app/data/prod.db ]; then' >> /app/start.sh && \
    echo '  echo "Database file not found. Initializing..."' >> /app/start.sh && \
    echo '  touch /app/data/prod.db' >> /app/start.sh && \
    echo '  chown nextjs:nodejs /app/data/prod.db' >> /app/start.sh && \
    echo '  chmod 666 /app/data/prod.db' >> /app/start.sh && \
    echo '  echo "Running initial migration..."' >> /app/start.sh && \
    echo '  su -c "npx prisma migrate deploy" nextjs' >> /app/start.sh && \
    echo 'else' >> /app/start.sh && \
    echo '  echo "Database exists. Checking permissions..."' >> /app/start.sh && \
    echo '  chown nextjs:nodejs /app/data/prod.db' >> /app/start.sh && \
    echo '  chmod 666 /app/data/prod.db' >> /app/start.sh && \
    echo '  echo "Running any pending migrations..."' >> /app/start.sh && \
    echo '  su -c "npx prisma migrate deploy" nextjs' >> /app/start.sh && \
    echo 'fi' >> /app/start.sh && \
    echo 'echo "Starting application..."' >> /app/start.sh && \
    echo 'exec su -c "node server.js" nextjs' >> /app/start.sh && \
    chmod +x /app/start.sh && \
    chown nextjs:nodejs /app/start.sh

# Add labels for version tracking
LABEL org.opencontainers.image.title="UniFi Client Manager"
LABEL org.opencontainers.image.description="A web UI for managing UniFi network clients"
LABEL org.opencontainers.image.source="https://github.com/yourusername/unifi-client-manager"
ARG VERSION
LABEL org.opencontainers.image.version=${VERSION:-unknown}

# Create a volume for persistent data
VOLUME /app/data

# Expose port
EXPOSE 3000

# Start the application using the startup script
CMD ["/bin/sh", "/app/start.sh"] 