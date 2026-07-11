FROM node:20-alpine

# Install system dependencies for pdfkit & sharp
RUN apk add --no-cache \
    fontconfig \
    freetype \
    cairo \
    pango \
    libjpeg-turbo \
    giflib \
    librsvg \
    && rm -rf /var/cache/apk/*

# Create app directory
WORKDIR /app

# Install dependencies first (Docker layer cache optimization)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source code
COPY . .

# Create directories for uploads and generated files
RUN mkdir -p public/uploads public/receipts

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

# Run as non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /app
USER appuser

CMD ["node", "src/app.js"]
