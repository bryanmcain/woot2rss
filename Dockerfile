FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Create data and logs directories
RUN mkdir -p /app/data /app/logs && chmod 777 /app/data /app/logs

# Copy app source
COPY . .

# Expose port
EXPOSE 3000

# Run the application
CMD ["node", "src/index.js"]