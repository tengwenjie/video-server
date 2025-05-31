# ローカルデプロイ
1. node --version
2. nvm install
3. nvm install --lts
4. cd video-server
5. npm install
6. apt-get install ffmpeg (Ubuntu)
7. npm run start 

## merged API
curl -F "videos=@a.mp4" -F "videos=@b.mp4" http://localhost:3000/videos/merge --output merged.mp4
localhost or 3.112.34.135


## trim API
curl -X POST http://localhost:3001/videos/trim \
  -F "video=@input.mp4" \
  -F "start=3" \
  -F "end=8" \
  --output trimmed.mp4
