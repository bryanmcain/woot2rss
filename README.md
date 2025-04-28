# Woot2RSS

A Docker service that converts Woot API data to RSS, Atom, and JSON feeds.

## Features

- Automatically fetches product data from the Woot API
- Generates RSS, Atom, and JSON feeds
- Updates feeds on a configurable schedule
- Simple web interface to access feeds
- Dockerized for easy deployment

## Setup

### Prerequisites

- Docker and Docker Compose
- Woot API key (sign up at [developer.woot.com](https://developer.woot.com))

### Configuration

1. Copy the example environment file:

```bash
cp .env.example .env
```

2. Edit the `.env` file with your Woot API credentials:

```
WOOT_API_KEY=your_api_key_here
WOOT_API_BASE_URL=https://api.woot.com
PORT=3000
UPDATE_INTERVAL=*/30 * * * *
```

The `UPDATE_INTERVAL` uses cron syntax to define how frequently the feeds should update (default is every 30 minutes).

## Usage

### Starting the Service

```bash
docker-compose up -d
```

### Accessing the Feeds

- Web interface: http://localhost:3000
- RSS feed: http://localhost:3000/rss
- Atom feed: http://localhost:3000/atom
- JSON feed: http://localhost:3000/json

### Viewing Logs

```bash
docker-compose logs -f
```

## Development

### Running Locally

```bash
# Install dependencies
npm install

# Start the server
node src/index.js
```

### Building the Docker Image

```bash
docker build -t woot2rss .
```

## License

See the [LICENSE](LICENSE) file for details.

## Notes

- The specific Woot API endpoints used in this application may need to be adjusted based on the actual API documentation.
- You will need to register for an API key at the Woot developer portal.