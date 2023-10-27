# Eyeballs Replicate AI API MQTT

This project is a Node.js application that listens for MQTT messages containing either a base64 encoded image or an image URL. It then processes the image using the Replicate API and publishes the result back to another MQTT topic.

Meant to be used with the LLava 1.5 model


## Features

- Listen for incoming MQTT messages with images or image URLs.
- Process images using Replicate API.
- Publish processed data to another MQTT topic.
- Logging with Winston.
- Containerized with Docker.

## Requirements

- Node.js 14.x
- Docker
- MQTT broker (e.g., Mosquitto)

## Environment Variables

Copy the `.env.example` to `.env` and fill in the following variables:

```env
REPLICATE_API_TOKEN=your_replicate_api_token
TOPIC=input_topic
BROKER_ADDRESS=mqtt://broker_address
MODEL=model_identifier
OUTPUT_TOPIC=output_topic
```

## Setup and Run

### Using Node.js

1. Install dependencies:

   ```bash
   npm install
   ```

2. Run the app:

   ```bash
   node your-app-file.js
   ```

### Using Docker

1. Build the Docker image:

   ```bash
   docker-compose up --build
   ```

## Testing

Publish a message to the topic specified in `TOPIC` with the following JSON payload:

```json
{
  "imageData": "base64_or_image_url",
  "prompt": "describe this image"
}
```

Check the published message in `OUTPUT_TOPIC` and the Winston logs for results and timing info.
