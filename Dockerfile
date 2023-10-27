# Use the official Node.js LTS image
FROM node:14

# Set the working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json to the image
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install

# Copy the rest of the code
COPY . .

# Set environment variables from .env file (if you have one)
# ENV REPLICATE_API_TOKEN your-token
# ENV TOPIC your-topic
# ENV BROKER_ADDRESS your-broker-address

# Command to run the app
CMD ["node", "app.js"]
