FROM node:20-bookworm-slim

ENV NODE_ENV=production 
ENV PORT=3000 
ENV HOST=0.0.0.0 
ENV TEMP_DIR=/tmp/clipnest

RUN apt-get update 
&& apt-get install -y --no-install-recommends 
ca-certificates 
ffmpeg 
python3 
python3-pip 
python3-venv 
&& python3 -m venv /opt/yt-dlp-venv 
&& /opt/yt-dlp-venv/bin/pip install --no-cache-dir --upgrade yt-dlp 
&& apt-get purge -y --auto-remove python3-pip 
&& rm -rf /var/lib/apt/lists/*

ENV YTDLP_PATH=/opt/yt-dlp-venv/bin/yt-dlp 
FFMPEG_PATH=/usr/bin/ffmpeg

WORKDIR /app

COPY server/package.json ./server/package.json
WORKDIR /app/server

RUN npm install --omit=dev

WORKDIR /app

COPY server/src ./server/src
COPY web ./web

RUN mkdir -p /tmp/clipnest 
&& chown -R node:node /app /tmp/clipnest

USER node

EXPOSE 3000

WORKDIR /app/server

CMD ["node", "src/index.js"]
