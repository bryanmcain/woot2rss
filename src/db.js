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
    
    // Define the active categories (ones that actually have data)
    this.categories = [
      'Clearance', 'Computers', 'Electronics', 'Home & Kitchen',
      'Grocery & Household', 'Sports & Outdoors', 'Tools & Garden', 'Shirt'
    ];
    
    this.init();
  }
  
  _getCategoryTableName(category) {
    // Standardize table name format
    // Replace spaces or special characters with underscores
    return `items_${category.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  }
  
  _createCategoryTable(category) {
    const tableName = this._getCategoryTableName(category);
    
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${tableName} (
        offer_id TEXT PRIMARY KEY,
        id TEXT,
        title TEXT NOT NULL,
        url TEXT NOT NULL,
        description TEXT,
        content TEXT,
        image_url TEXT,
        price TEXT,
        original_price TEXT,
        discount TEXT,
        site TEXT,
        created_at TEXT NOT NULL,
        published_at TEXT NOT NULL
      );
    `);
    
    console.log(`Ensured table exists: ${tableName}`);
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
    
    // Create separate tables for each category (and handle any new categories dynamically)
    for (const category of this.categories) {
      this._createCategoryTable(category);
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
              offer_id, id, title, url, description, content, image_url, 
              price, original_price, discount, site, created_at, published_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            item.id || `woot-legacy-${Date.now()}`,  // offer_id (primary key)
            item.id,
            item.title,
            item.url,
            item.description,
            item.content,
            item.image_url,
            item.price,
            item.original_price,
            item.discount,
            category,                                // site
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
  
  // Check if a category exists in our known categories and add it if not
  _ensureCategory(category) {
    if (!category) return false;
    
    // If the category is not in our list, add it and create its table
    if (!this.categories.includes(category)) {
      console.log(`Adding new category to the system: ${category}`);
      this.categories.push(category);
      this._createCategoryTable(category);
      return true;
    }
    
    return false;
  }
  
  saveItem(item, feedType = null, category = null) {
    try {
      // Get the site from the item or fall back to provided feedType/category
      const site = item.Site || category || feedType;
      
      if (!site) {
        console.error(`Cannot save item - no site/category information available`);
        console.error('Item:', JSON.stringify(item).substring(0, 200) + '...');
        return;
      }
      
      // Ensure this category exists in our system
      this._ensureCategory(site);
      
      // Standardize the table name format
      const tableName = this._getCategoryTableName(site);
      
      // Prepare price information
      let price = '';
      let originalPrice = '';
      let discount = '';
      
      // Extract price info from the Woot API format
      if (item.SalePrice && item.SalePrice.Minimum) {
        price = `$${item.SalePrice.Minimum}`;
        
        if (item.ListPrice && item.ListPrice.Minimum) {
          originalPrice = `$${item.ListPrice.Minimum}`;
          
          // Calculate discount percentage if both prices are available
          const salePrice = parseFloat(item.SalePrice.Minimum);
          const listPrice = parseFloat(item.ListPrice.Minimum);
          
          if (!isNaN(salePrice) && !isNaN(listPrice) && listPrice > 0) {
            const discountPct = Math.round((1 - (salePrice / listPrice)) * 100);
            discount = `${discountPct}%`;
          }
        }
      }
      
      // Prepare date information
      const now = new Date().toISOString();
      const startDate = item.StartDate ? new Date(item.StartDate).toISOString() : null;
      const publishedAt = startDate || now;
      
      // Create description from available fields
      const description = item.Subtitle || '';
      
      // Create content with additional details
      let content = '';
      if (item.Categories && item.Categories.length > 0) {
        content += `Categories: ${item.Categories.join(', ')}\n`;
      }
      if (originalPrice) {
        content += `Original Price: ${originalPrice}\n`;
      }
      if (price) {
        content += `Sale Price: ${price}\n`;
      }
      if (discount) {
        content += `Discount: ${discount}\n`;
      }
      if (startDate) {
        content += `Started: ${startDate}\n`;
      }
      if (item.EndDate) {
        content += `Ends: ${item.EndDate}\n`;
      }
      
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO ${tableName} (
          offer_id, id, title, url, description, content, image_url, 
          price, original_price, discount, site, created_at, published_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      // Generate a stable offer_id when none is provided by creating a hash of the URL and title
      let offer_id = item.OfferId;
      if (!offer_id && item.Url && item.Title) {
        // Create a stable ID by combining the URL and title
        offer_id = `woot-${item.Url}-${item.Title}`.replace(/[^a-zA-Z0-9]/g, '_');
      } else if (!offer_id) {
        // Fallback if we don't have URL or title
        offer_id = `woot-${Date.now()}`;
      }
      
      // Log to debug
     // console.log('Debug - Saving item to table', tableName, {
     //   offer_id: offer_id,
     //   id: item.Url || item.id || offer_id,                 // Use URL as the ID field
     //   title: item.Title || 'Untitled',
     //   url: item.Url || 'https://www.woot.com',
     //   site: site,
     //   price: price,
     //   originalPrice: originalPrice,
     //   discount: discount
     // });
      
      stmt.run(
        offer_id,                                            // offer_id (primary key - keep this as OfferId)
        item.Url || offer_id,                                // Always use URL as the ID field, never fallback to item.id
        item.Title || 'Untitled',                            // title
        item.Url || 'https://www.woot.com',                  // url
        description,                                          // description
        content,                                              // content
        item.Photo || '',                                     // image_url
        price,                                                // price
        originalPrice,                                        // original_price
        discount,                                             // discount
        site,                                                 // site
        now,                                                  // created_at
        publishedAt                                           // published_at
      );
      
      return true;
    } catch (error) {
      console.error('Error saving item to database:', error);
      console.error('Item data:', JSON.stringify({
        OfferId: item.OfferId,
        Title: item.Title,
        Url: item.Url,
        Site: item.Site
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
    
    // Standardize the table name format
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
    // Standardize the table name format
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