FROM node:20-bookworm-slim

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV TEMP_DIR=/tmp/clipnest

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-venv \
    ffmpeg \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN python3 -m venv /opt/yt-dlp \
    && /opt/yt-dlp/bin/pip install --no-cache-dir yt-dlp

ENV PATH="/opt/yt-dlp/bin:${PATH}"

WORKDIR /app

COPY . .

WORKDIR /app/server

RUN npm install --omit=dev

RUN mkdir -p /tmp/clipnest

EXPOSE 3000

CMD ["npm", "start"]
