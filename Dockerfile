FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Create data directory for the database
RUN mkdir -p /app/data && chmod 777 /app/data

# Copy app source
COPY . .

# Expose port
EXPOSE 3000

# Run the application
CMD ["node", "src/index.js"]