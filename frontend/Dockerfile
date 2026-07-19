FROM node:24-alpine

WORKDIR /app

# Copy package configurations
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Expose Vite dev port
EXPOSE 3000

# Run development server with host binding
CMD ["npm", "run", "dev"]
