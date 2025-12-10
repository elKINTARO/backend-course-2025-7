FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN mkdir -p /app/cache

EXPOSE 3000

#kоманда для запуску з nodemon
CMD ["npx", "nodemon", "--inspect=0.0.0.0:9229", "main.js", "-H", "0.0.0.0", "-p", "3000", "-c", "./cache"]