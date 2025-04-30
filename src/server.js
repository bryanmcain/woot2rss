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
    
    if (result.offersCount > 0) {
      console.log(`Found new items: ${result.offersCount} offers`);
    } else {
      console.log('No new items found');
    }
  } catch (error) {
    console.error('Error checking for new items:', error);
  }
});

// Routes
app.get('/', (req, res) => {
  const categories = rssGenerator.getCategories();
  const totalItemCount = rssGenerator.getItemCount();
  
  // Create section for each active category's stats
  let categoryStats = '';
  categories.forEach(category => {
    const catLastUpdated = rssGenerator.getLastUpdated(category);
    const catItemCount = rssGenerator.getItemCount(category);
    
    // Only show categories that have items
    if (catItemCount > 0) {
      const categorySlug = rssGenerator.getCategorySlug(category);
      categoryStats += `
        <div class="category-stats">
          <h3>${category}</h3>
          <p>Last Updated: ${catLastUpdated ? catLastUpdated.toLocaleString() : 'Not yet updated'}</p>
          <p>Items: ${catItemCount}</p>
          <div class="category-feeds">
            <a href="/rss/${categorySlug}" class="feed-link">RSS</a>
            <a href="/atom/${categorySlug}" class="feed-link">Atom</a>
            <a href="/json/${categorySlug}" class="feed-link">JSON</a>
            <a href="/refresh/${categorySlug}" class="refresh-link">Refresh</a>
          </div>
        </div>
      `;
    }
  });
  
  res.send(`
    <html>
      <head>
        <title>Woot2RSS</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 1000px; margin: 0 auto; padding: 20px; }
          h1 { color: #e47911; }
          h2 { margin-top: 30px; }
          h3 { margin-bottom: 5px; }
          .feeds { margin: 20px 0; }
          .feed-link { display: inline-block; margin: 0 10px 5px 0; padding: 3px 8px; background: #f8f8f8; border-radius: 3px; text-decoration: none; color: #e47911; }
          .feed-link:hover { background: #e47911; color: white; }
          .refresh-link { display: inline-block; margin: 0 10px 5px 0; padding: 3px 8px; background: #f0f0f0; border-radius: 3px; text-decoration: none; color: #0066cc; }
          .refresh-link:hover { background: #0066cc; color: white; }
          .stats { margin: 20px 0; font-size: 0.9em; color: #555; }
          .category-stats { margin: 15px 0; padding: 10px; border: 1px solid #eee; }
          .categories-container { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 15px; }
        </style>
      </head>
      <body>
        <h1>Woot2RSS</h1>
        <p>Convert Woot deals to RSS feeds</p>
        
        <div class="status">
          <h2>Status</h2>
          <p>Total Items in Database: ${totalItemCount}</p>
          <p><a href="/refresh" class="refresh-link">Refresh All Categories</a></p>
        </div>
        
        <h2>Category Feeds</h2>
        <div class="categories-container">
          ${categoryStats}
        </div>
        
        <div class="stats">
          <p>Updates every: ${config.updateInterval} (cron format)</p>
          <p>Feeds generated from database, refreshed from API automatically</p>
        </div>
      </body>
    </html>
  `);
});

// Redirect root feed requests to a category selector page
app.get('/rss', (req, res) => {
  res.redirect('/');
});

app.get('/atom', (req, res) => {
  res.redirect('/');
});

app.get('/json', (req, res) => {
  res.redirect('/');
});

// Handle category-specific feeds
app.get('/rss/:category', async (req, res) => {
  try {
    const categorySlug = req.params.category;
    // Find matching category by comparing slugs
    const matchingCategory = rssGenerator.getCategories().find(c => 
      rssGenerator.getCategorySlug(c) === categorySlug
    );
    
    if (!matchingCategory) {
      return res.status(404).send('Category not found');
    }
    
    const feed = await rssGenerator.getRssFeed(matchingCategory);
    res.type('application/rss+xml');
    res.send(feed);
  } catch (error) {
    console.error('Error serving category RSS feed:', error);
    res.status(500).send('Error generating RSS feed');
  }
});

app.get('/atom/:category', async (req, res) => {
  try {
    const categorySlug = req.params.category;
    // Find matching category by comparing slugs
    const matchingCategory = rssGenerator.getCategories().find(c => 
      rssGenerator.getCategorySlug(c) === categorySlug
    );
    
    if (!matchingCategory) {
      return res.status(404).send('Category not found');
    }
    
    const feed = await rssGenerator.getAtomFeed(matchingCategory);
    res.type('application/atom+xml');
    res.send(feed);
  } catch (error) {
    console.error('Error serving category Atom feed:', error);
    res.status(500).send('Error generating Atom feed');
  }
});

app.get('/json/:category', async (req, res) => {
  try {
    const categorySlug = req.params.category;
    // Find matching category by comparing slugs
    const matchingCategory = rssGenerator.getCategories().find(c => 
      rssGenerator.getCategorySlug(c) === categorySlug
    );
    
    if (!matchingCategory) {
      return res.status(404).send('Category not found');
    }
    
    const feed = await rssGenerator.getJsonFeed(matchingCategory);
    res.type('application/json');
    res.send(feed);
  } catch (error) {
    console.error('Error serving category JSON feed:', error);
    res.status(500).send('Error generating JSON feed');
  }
});

// Add a manual refresh endpoint for all feeds
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

// Add endpoint to refresh a specific category feed
app.get('/refresh/:category', async (req, res) => {
  try {
    const categorySlug = req.params.category;
    // Find matching category by comparing slugs
    const matchingCategory = rssGenerator.getCategories().find(c => 
      rssGenerator.getCategorySlug(c) === categorySlug
    );
    
    if (!matchingCategory) {
      console.log(`Manual refresh requested for unknown category slug: ${categorySlug}`);
      return res.status(404).json({
        status: 'error',
        message: 'Category not found',
        category: categorySlug
      });
    }
    
    console.log(`Manual refresh requested for category: ${matchingCategory}`);
    const result = await rssGenerator.updateSpecificFeed(matchingCategory);
    
    if (result.error) {
      return res.status(400).json({
        status: 'error',
        message: result.error,
        category: matchingCategory
      });
    }
    
    res.status(200).json({
      status: 'success',
      category: result.category,
      updated: new Date(),
      offersAdded: result.offersCount
    });
  } catch (error) {
    console.error(`Error in manual refresh for category ${req.params.category}:`, error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      category: req.params.category
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  const dbStatus = db ? 'connected' : 'disconnected';
  const categories = rssGenerator.getCategories();
  const firstCategory = categories.length > 0 ? categories[0] : null;
  
  res.status(200).json({ 
    status: 'ok',
    database: dbStatus,
    items: rssGenerator.getItemCount(),
    lastUpdated: firstCategory ? rssGenerator.getLastUpdated(firstCategory) : null,
    categories: categories
  });
});

// Start the server
app.listen(config.port, () => {
  console.log(`Woot2RSS server running on port ${config.port}`);
  
  // Run database migration if needed
  console.log('Checking for legacy data to migrate...');
  db.migrateFromLegacyTable();
  
  // Initial feed update for all categories
  console.log('Starting initial feed update for all categories...');
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