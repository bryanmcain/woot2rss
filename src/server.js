const express = require('express');
const cron = require('node-cron');
const config = require('./config');
const rssGenerator = require('./rss');
const db = require('./db');

// Create Express app
const app = express();

// Schedule regular database maintenance and full refresh
cron.schedule(config.updateInterval, async () => {
  try {
    console.log('Running full scheduled feed update and database maintenance...');
    await rssGenerator.updateFeeds();
  } catch (error) {
    console.error('Error in scheduled update:', error);
  }
});

// Schedule more frequent checks for new items
cron.schedule(config.checkNewItemsInterval, async () => {
  try {
    console.log('Checking for new items...');
    const result = await rssGenerator.updateFeeds();
    
    if (result.offersCount > 0 || result.eventsCount > 0) {
      console.log(`Found new items: ${result.offersCount} offers, ${result.eventsCount} events`);
    } else {
      console.log('No new items found');
    }
  } catch (error) {
    console.error('Error checking for new items:', error);
  }
});

// Routes
app.get('/', (req, res) => {
  const lastUpdated = rssGenerator.getLastUpdated();
  const itemCount = rssGenerator.getItemCount();
  
  res.send(`
    <html>
      <head>
        <title>Woot2RSS</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
          h1 { color: #e47911; }
          .feeds { margin: 20px 0; }
          .feed-link { display: block; margin: 10px 0; }
          .stats { margin: 20px 0; font-size: 0.9em; color: #555; }
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
          <p>Last Updated: ${lastUpdated ? lastUpdated.toLocaleString() : 'Not yet updated'}</p>
          <p>Items in Database: ${itemCount}</p>
        </div>
        
        <div class="stats">
          <p>Updates every: ${config.updateInterval} (cron format)</p>
          <p>Feed generated from database, refreshed from API automatically</p>
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
    console.error('Error serving RSS feed:', error);
    res.status(500).send('Error generating RSS feed');
  }
});

app.get('/atom', async (req, res) => {
  try {
    const feed = await rssGenerator.getAtomFeed();
    res.type('application/atom+xml');
    res.send(feed);
  } catch (error) {
    console.error('Error serving Atom feed:', error);
    res.status(500).send('Error generating Atom feed');
  }
});

app.get('/json', async (req, res) => {
  try {
    const feed = await rssGenerator.getJsonFeed();
    res.type('application/json');
    res.send(feed);
  } catch (error) {
    console.error('Error serving JSON feed:', error);
    res.status(500).send('Error generating JSON feed');
  }
});

// Add a manual refresh endpoint
app.get('/refresh', async (req, res) => {
  try {
    const result = await rssGenerator.updateFeeds();
    res.status(200).json({
      status: 'success',
      updated: new Date(),
      added: result
    });
  } catch (error) {
    console.error('Error in manual refresh:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  const dbStatus = db ? 'connected' : 'disconnected';
  res.status(200).json({ 
    status: 'ok',
    database: dbStatus,
    items: rssGenerator.getItemCount(),
    lastUpdated: rssGenerator.getLastUpdated()
  });
});

// Start the server
app.listen(config.port, () => {
  console.log(`Woot2RSS server running on port ${config.port}`);
  
  // Initial feed update
  rssGenerator.updateFeeds().catch(error => {
    console.error('Error in initial feed update:', error);
  });
});

// Clean shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  db.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  db.close();
  process.exit(0);
});

module.exports = app;