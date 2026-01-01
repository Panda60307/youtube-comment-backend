# 使用官方輕量級 Node.js 映像檔
FROM node:18-slim

# 設定工作目錄
WORKDIR /app

# 複製 package.json 和 package-lock.json
COPY package*.json ./

# 安裝依賴 (僅安裝生產環境套件)
RUN npm ci --only=production

# 複製所有原始碼
COPY . .

# Cloud Run 會自動注入 PORT 環境變數，預設為 8080
ENV PORT=8080

# 啟動應用程式
CMD [ "npm", "start" ]
