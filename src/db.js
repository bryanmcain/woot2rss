const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('./config');

class DbService {
  constructor() {
    // Get database path from config
    const dbPath = config.db.path;
    
    // Ensure the directory exists
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    // Open the database
    this.db = new Database(dbPath);
    console.log(`Database initialized at: ${dbPath}`);
    
    // Define the categories
    this.categories = [
      'Clearance', 'Computers', 'Electronics', 'Featured', 
      'Home', 'Gourmet', 'Shirts', 'Sports', 'Tools', 'Wootoff'
    ];
    
    this.init();
  }
  
  _getCategoryTableName(category) {
    // Standardize table name format
    return `items_${category.toLowerCase()}`;
  }
  
  init() {
    // Create feeds table (for tracking last updated timestamps)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS feeds (
        id TEXT PRIMARY KEY,
        feed_type TEXT NOT NULL,
        last_updated TEXT NOT NULL
      );
    `);
    
    // Check if we have a legacy items table
    const hasLegacyTable = this.db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='items'
    `).get();
    
    // Create separate tables for each category
    for (const category of this.categories) {
      const tableName = this._getCategoryTableName(category);
      
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS ${tableName} (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          url TEXT NOT NULL,
          description TEXT,
          content TEXT,
          image_url TEXT,
          price TEXT,
          original_price TEXT,
          discount TEXT,
          created_at TEXT NOT NULL,
          published_at TEXT NOT NULL
        );
      `);
    }
    
    console.log("Database tables initialized");
    
    // If legacy table exists, we'll migrate data during app startup
    if (hasLegacyTable) {
      console.log("Legacy 'items' table found - will migrate data to category-specific tables");
    }
  }
  
  // Migrate data from legacy table to new structure
  migrateFromLegacyTable() {
    try {
      console.log("Starting data migration from legacy 'items' table...");
      
      // Check if legacy table exists
      const hasLegacyTable = this.db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='items'
      `).get();
      
      if (!hasLegacyTable) {
        console.log("No legacy table found - migration not needed");
        return false;
      }
      
      // Get all items from legacy table
      const allItems = this.db.prepare(`
        SELECT * FROM items
      `).all();
      
      console.log(`Found ${allItems.length} items to migrate`);
      
      // Begin transaction for faster inserts
      const transaction = this.db.transaction(() => {
        for (const item of allItems) {
          const category = item.feed_type;
          if (!this.categories.includes(category)) {
            console.log(`Skipping item with unknown category: ${category}`);
            continue;
          }
          
          const tableName = this._getCategoryTableName(category);
          
          // Insert into new table
          this.db.prepare(`
            INSERT OR REPLACE INTO ${tableName} (
              id, title, url, description, content, image_url, 
              price, original_price, discount, created_at, published_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            item.id,
            item.title,
            item.url,
            item.description,
            item.content,
            item.image_url,
            item.price,
            item.original_price,
            item.discount,
            item.created_at,
            item.published_at
          );
        }
      });
      
      // Execute the transaction
      transaction();
      
      console.log(`Migrated ${allItems.length} items to category-specific tables`);
      
      // Optionally drop the legacy table once migration is complete
      // Uncomment this once you've verified migration works correctly
      // this.db.exec(`DROP TABLE IF EXISTS items`);
      
      return true;
    } catch (error) {
      console.error('Error migrating legacy data:', error);
      return false;
    }
  }
  
  saveItem(item, feedType, category = null) {
    try {
      // Use category if provided, otherwise use feedType
      const actualCategory = category || feedType;
      
      // Skip if category is not recognized
      if (!this.categories.includes(actualCategory)) {
        console.error(`Cannot save item - unknown category: ${actualCategory}`);
        return;
      }
      
      const tableName = this._getCategoryTableName(actualCategory);
      
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO ${tableName} (
          id, title, url, description, content, image_url, 
          price, original_price, discount, created_at, published_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const now = new Date().toISOString();
      const publishedAt = item.published_at || item.startDate || item.createdAt || now;
      
      // Log to debug
      console.log('Debug - Saving item to table', tableName, {
        id: item.id || item.url || `woot-${Date.now()}`,
        title: item.title || 'Untitled',
        url: item.url || 'https://www.woot.com',
        description: item.description || '',
        contentLength: item.content ? item.content.length : 0,
        imageUrl: item.imageUrl || '',
        price: item.price || '',
        originalPrice: item.originalPrice || '',
        discount: item.discount || ''
      });
      
      stmt.run(
        item.id || item.url || `woot-${Date.now()}`,
        item.title || 'Untitled',
        item.url || 'https://www.woot.com',
        item.description || '',
        item.content || '',
        item.imageUrl || '',
        item.price || '',
        item.originalPrice || '',
        item.discount || '',
        now,
        publishedAt
      );
    } catch (error) {
      console.error('Error saving item to database:', error);
      console.error('Item data:', JSON.stringify({
        id: item.id,
        title: item.title,
        url: item.url,
        published_at: item.published_at
      }));
      throw error;
    }
  }
  
  updateFeedTimestamp(feedType) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO feeds (id, feed_type, last_updated)
      VALUES (?, ?, ?)
    `);
    
    stmt.run(
      feedType,
      feedType,
      new Date().toISOString()
    );
  }
  
  getFeedLastUpdated(feedType) {
    const stmt = this.db.prepare('SELECT last_updated FROM feeds WHERE id = ?');
    const result = stmt.get(feedType);
    return result ? result.last_updated : null;
  }
  
  getItems(feedType = null, limit = 50) {
    // If no feedType specified, return items from all categories
    if (!feedType) {
      // Get items from each category table, ordered by published_at
      const allItems = [];
      
      for (const category of this.categories) {
        const tableName = this._getCategoryTableName(category);
        
        try {
          const stmt = this.db.prepare(`
            SELECT *, '${category}' as feed_type FROM ${tableName}
            ORDER BY published_at DESC
            LIMIT ?
          `);
          
          const items = stmt.all(Math.ceil(limit / this.categories.length));
          allItems.push(...items);
        } catch (error) {
          console.error(`Error fetching items from ${tableName}:`, error);
        }
      }
      
      // Sort all items by published_at and limit to requested count
      return allItems
        .sort((a, b) => new Date(b.published_at) - new Date(a.published_at))
        .slice(0, limit);
    }
    
    // Return items from specific category table
    if (!this.categories.includes(feedType)) {
      console.error(`Cannot get items - unknown category: ${feedType}`);
      return [];
    }
    
    const tableName = this._getCategoryTableName(feedType);
    
    try {
      const stmt = this.db.prepare(`
        SELECT *, '${feedType}' as feed_type FROM ${tableName}
        ORDER BY published_at DESC
        LIMIT ?
      `);
      
      return stmt.all(limit);
    } catch (error) {
      console.error(`Error fetching items from ${tableName}:`, error);
      return [];
    }
  }
  
  _getCountForCategory(category) {
    const tableName = this._getCategoryTableName(category);
    
    try {
      const stmt = this.db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`);
      const result = stmt.get();
      return result ? result.count : 0;
    } catch (error) {
      console.error(`Error counting items in ${tableName}:`, error);
      return 0;
    }
  }
  
  getItemCount(feedType = null) {
    // If no feedType specified, return sum of items across all categories
    if (!feedType) {
      let totalCount = 0;
      
      for (const category of this.categories) {
        totalCount += this._getCountForCategory(category);
      }
      
      return totalCount;
    }
    
    // Return count for specific category table
    if (!this.categories.includes(feedType)) {
      console.error(`Cannot get item count - unknown category: ${feedType}`);
      return 0;
    }
    
    return this._getCountForCategory(feedType);
  }
  
  cleanupOldItems() {
    try {
      const maxItems = config.db.maxItems;
      const maxCategoryItems = Math.floor(maxItems / this.categories.length); // Divide evenly among categories
      
      // Clean up each category separately
      for (const category of this.categories) {
        const tableName = this._getCategoryTableName(category);
        const categoryItems = this._getCountForCategory(category);
        
        // If we have more than the max for this category, delete the oldest ones
        if (categoryItems > maxCategoryItems) {
          const itemsToDelete = categoryItems - maxCategoryItems;
          console.log(`Cleaning up database - removing ${itemsToDelete} oldest items from ${category}`);
          
          const stmt = this.db.prepare(`
            DELETE FROM ${tableName} 
            WHERE rowid IN (
              SELECT rowid FROM ${tableName}
              ORDER BY published_at ASC 
              LIMIT ?
            )
          `);
          
          const result = stmt.run(itemsToDelete);
          console.log(`Removed ${result.changes} old items from ${category}`);
        }
      }
    } catch (error) {
      console.error('Error cleaning up old items:', error);
    }
  }
  
  close() {
    if (this.db) {
      this.db.close();
    }
  }
}

module.exports = new DbService();