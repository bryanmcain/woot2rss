const express = require('express');
const cron = require('node-cron');
const config = require('./config');
const rssGenerator = require('./rss');

// Create Express app
const app = express();

// Schedule feed updates
cron.schedule(config.updateInterval, async () => {
  try {
    await rssGenerator.updateFeed();
  } catch (error) {
    console.error('Error in scheduled update:', error);
  }
});

// Routes
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Woot2RSS</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
          h1 { color: #e47911; }
          .feeds { margin: 20px 0; }
          .feed-link { display: block; margin: 10px 0; }
        </style>
      </head>
      <body>
        <h1>Woot2RSS</h1>
        <p>Convert Woot deals to RSS feeds</p>
        
        <div class="feeds">
          <h2>Available Feeds</h2>
          <a class="feed-link" href="/rss">RSS Feed</a>
          <a class="feed-link" href="/atom">Atom Feed</a>
          <a class="feed-link" href="/json">JSON Feed</a>
        </div>
        
        <div class="status">
          <h2>Status</h2>
          <p>Last Updated: ${rssGenerator.getLastUpdated() || 'Not yet updated'}</p>
        </div>
      </body>
    </html>
  `);
});

app.get('/rss', async (req, res) => {
  try {
    const feed = await rssGenerator.getRssFeed();
    res.type('application/rss+xml');
    res.send(feed);
  } catch (error) {
    res.status(500).send('Error generating RSS feed');
  }
});

app.get('/atom', async (req, res) => {
  try {
    const feed = await rssGenerator.getAtomFeed();
    res.type('application/atom+xml');
    res.send(feed);
  } catch (error) {
    res.status(500).send('Error generating Atom feed');
  }
});

app.get('/json', async (req, res) => {
  try {
    const feed = await rssGenerator.getJsonFeed();
    res.type('application/json');
    res.send(feed);
  } catch (error) {
    res.status(500).send('Error generating JSON feed');
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Start the server
app.listen(config.port, () => {
  console.log(`Woot2RSS server running on port ${config.port}`);
  
  // Initial feed update
  rssGenerator.updateFeed().catch(error => {
    console.error('Error in initial feed update:', error);
  });
});

module.exports = app;