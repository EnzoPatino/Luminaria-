FROM node:20-alpine

WORKDIR /app

# Instalar dependencias de produccion
COPY package*.json ./
RUN npm ci --only=production

# Copiar codigo fuente
COPY . .

# Puerto expuesto
EXPOSE 3000

# Variable de entorno por defecto
ENV NODE_ENV=production

# Script de arranque: aplica esquema, crea el administrador configurado y levanta la API.
CMD ["sh", "-c", "npm run db:migrate && npm run db:seed && npm run bootstrap:admin && npm start"]
