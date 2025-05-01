# Woot2RSS

A Docker service that converts Woot API data to RSS, Atom, and JSON feeds.

## Features

- Automatically fetches product data from the Woot API using a single API call to the `/All` endpoint
- Categorizes items by their `Site` property for efficient organization
- Uses offer ID as the primary key for reliable data management
- Dynamically discovers and adds new categories/sites as they become available
- Stores feed items in a SQLite database for persistence
- Regularly checks for new items from the API
- Generates RSS, Atom, and JSON feeds from the database
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

2. Edit the `.env` file with your Woot API credentials and configuration:

```
WOOT_API_KEY=your_api_key_here
WOOT_API_BASE_URL=https://developer.woot.com
PORT=3000
UPDATE_INTERVAL=*/30 * * * *
CHECK_NEW_ITEMS_INTERVAL=*/10 * * * *
DB_PATH=/path/to/your/database.db
MAX_ITEMS=100000
ENABLE_LOGGING=false
LOG_FILE=logs/woot2rss.log
LOG_LEVEL=info
```

Configuration options:
- `UPDATE_INTERVAL`: Cron syntax to define how frequently full feed updates and maintenance should run (default is every 30 minutes)
- `CHECK_NEW_ITEMS_INTERVAL`: Cron syntax to define how frequently to check for new items (default is every 10 minutes)
- `DB_PATH`: Custom path to store the SQLite database (defaults to `./data/woot.db`)
- `MAX_ITEMS`: Maximum number of items to store in the database (defaults to 100000)
- `ENABLE_LOGGING`: Set to 'true' to enable detailed logging (defaults to false)
- `LOG_FILE`: Path to the log file (defaults to 'logs/woot2rss.log')
- `LOG_LEVEL`: Log level to use: 'debug', 'info', 'warn', or 'error' (defaults to 'info')

## Usage

### Starting the Service

```bash
docker-compose up -d
```

This will create a Docker container named 'woot2rss'.

### Accessing the Feeds

- Web interface: http://localhost:3000
- RSS feed: http://localhost:3000/rss
- Atom feed: http://localhost:3000/atom
- JSON feed: http://localhost:3000/json
- Health check: http://localhost:3000/health
- Manual refresh: http://localhost:3000/refresh

### Viewing Logs

For container logs:
```bash
docker-compose logs -f
# or specifically for the woot2rss container
docker logs -f woot2rss
```

For application logs (when ENABLE_LOGGING=true):
```bash
cat logs/woot2rss.log
# or to follow the log
tail -f logs/woot2rss.log
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

- This application uses the `/feed/All` endpoint from the Woot API to fetch all offers in a single call
- Items are categorized by their `Site` property (e.g., "Clearance", "Electronics", "Shirts")
- Each category automatically gets its own table in the database
- The application automatically discovers and handles new site categories as they appear
- You will need to register for an API key at the Woot developer portal (https://developer.woot.com)
- The OfferId field is used as the primary key for all database tables
- Database data persists between container restarts via Docker named volumes