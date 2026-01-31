FROM node:18-alpine

# Install p7zip for 7z support
RUN apk add --no-cache p7zip

WORKDIR /app

COPY package*.json ./

RUN npm install --production

COPY . .

# Create uploads directory
RUN mkdir -p /app/uploads

EXPOSE 3001

CMD ["node", "server.js"]
