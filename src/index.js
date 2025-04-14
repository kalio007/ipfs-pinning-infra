// auto-pinning-service.js
const express = require('express');
const multer = require('multer');
const { createHelia } = require('helia');
const { unixfs } = require('@helia/unixfs');
const { bootstrap } = require('@libp2p/bootstrap');
const { noise } = require('@chainsafe/libp2p-noise');
const { webSockets } = require('@libp2p/websockets');
const { mplex } = require('@libp2p/mplex');
const { Pool } = require('pg');
const redis = require('redis');
const AWS = require('aws-sdk');
const axios = require('axios');
const fs = require('fs-extra');
const { CID } = require('multiformats/cid');
const { toString: uint8ArrayToString } = require('uint8arrays/to-string');
const { fromString: uint8ArrayFromString } = require('uint8arrays/from-string');

// Initialize Express
const app = express();
const port = process.env.PORT || 3000;
const upload = multer({ dest: 'uploads/' });

let heliaNode;
let fs_; // unixfs instance

// Initialize Helia
async function initializeHelia() {
  const heliaNode = await createHelia({
    libp2p: {
      addresses: {
        listen: [
          '/ip4/0.0.0.0/tcp/4002',
          '/ip4/0.0.0.0/tcp/4003/ws'
        ]
      },
      transports: [
        webSockets()
      ],
      connectionEncryption: [
        noise()
      ],
      streamMuxers: [
        mplex()
      ],
      peerDiscovery: [
        bootstrap({
          list: [
            '/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN',
            '/dnsaddr/bootstrap.libp2p.io/p2p/QmQCU2EcMqAqQPR2i9bChDtGNJchTbq5TbXJJ16u19uLTa'
          ]
        })
      ]
    }
  });

  // Initialize UnixFS service
  const fs_ = unixfs(heliaNode);
  
  return { heliaNode, fs_ };
}

// Initialize IPFS Cluster client
const clusterApiUrl = process.env.CLUSTER_API_URL || 'http://ipfs-cluster:9094';

// Initialize PostgreSQL
const pgPool = new Pool({
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  port: process.env.POSTGRES_PORT || 5432,
});

// Initialize Redis
const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://redis:6379'
});

// Initialize AWS S3
const s3 = new AWS.S3({
  region: process.env.AWS_REGION || 'us-east-1'
});

// Connect to Redis
(async () => {
  await redisClient.connect();
})();

// Create tables if they don't exist
async function initializeDatabase() {
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS files (
      id SERIAL PRIMARY KEY,
      cid TEXT NOT NULL,
      filename TEXT NOT NULL,
      filesize BIGINT NOT NULL,
      mimetype TEXT NOT NULL,
      s3_key TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP,
      user_id TEXT NOT NULL
    );
  `);
}

// Initialize everything
async function initialize() {
  try {
    await initializeDatabase();
    const { heliaNode: node, fs_: filesystem } = await initializeHelia();
    heliaNode = node;
    fs_ = filesystem;
    console.log('Helia node and database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize services:', error);
    process.exit(1);
  }
}

// Add file to Helia
async function addFileToHelia(filePath) {
  try {
    // Read file content
    const fileContent = await fs.readFile(filePath);
    
    // Add to Helia
    const cid = await fs_.addBytes(fileContent);
    
    // Pin to IPFS Cluster for redundancy
    await axios.post(`${clusterApiUrl}/pins/${cid.toString()}`, {});
    
    return cid.toString();
  } catch (error) {
    console.error('Error adding file to Helia:', error);
    throw error;
  }
}

// Handle large files by storing in S3
async function storeInS3(filePath, fileName, fileType) {
  const fileContent = await fs.readFile(filePath);
  
  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: fileName,
    Body: fileContent,
    ContentType: fileType
  };
  
  const data = await s3.upload(params).promise();
  return data.Key;
}

// Upload endpoint
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const { file } = req;
    const userId = req.headers['user-id'] || 'anonymous';
    
    // Check file size
    const isLargeFile = file.size > 100 * 1024 * 1024; // 100MB threshold
    
    let s3Key = null;
    if (isLargeFile) {
      // Store large files in S3
      s3Key = await storeInS3(file.path, file.originalname, file.mimetype);
    }
    
    // Add to Helia regardless of size
    const cid = await addFileToHelia(file.path);
    
    // Store metadata in PostgreSQL
    const result = await pgPool.query(
      `INSERT INTO files (cid, filename, filesize, mimetype, s3_key, user_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [cid, file.originalname, file.size, file.mimetype, s3Key, userId]
    );
    
    // Cache the CID in Redis for fast lookup
    await redisClient.set(`file:${result.rows[0].id}`, cid, {
      EX: 86400 // Cache for 24 hours
    });
    
    // Clean up the temporary file
    await fs.remove(file.path);
    
    res.json({
      success: true,
      fileId: result.rows[0].id,
      cid: cid,
      retrievalUrl: `https://ipfs.io/ipfs/${cid}`
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: 'Failed to upload file', details: error.message });
  }
});

// Retrieve file metadata
app.get('/file/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Try to get from cache first
    const cachedCid = await redisClient.get(`file:${id}`);
    
    if (cachedCid) {
      res.json({
        cid: cachedCid,
        retrievalUrl: `https://ipfs.io/ipfs/${cachedCid}`
      });
      return;
    }
    
    // If not in cache, get from database
    const result = await pgPool.query('SELECT * FROM files WHERE id = $1', [id]);
    
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'File not found' });
      return;
    }
    
    const file = result.rows[0];
    
    // Cache for future requests
    await redisClient.set(`file:${id}`, file.cid, {
      EX: 86400 // Cache for 24 hours
    });
    
    res.json({
      id: file.id,
      cid: file.cid,
      filename: file.filename,
      filesize: file.filesize,
      mimetype: file.mimetype,
      created_at: file.created_at,
      expires_at: file.expires_at,
      retrievalUrl: `https://ipfs.io/ipfs/${file.cid}`
    });
  } catch (error) {
    console.error('Error retrieving file:', error);
    res.status(500).json({ error: 'Failed to retrieve file' });
  }
});

// Retrieve file content directly
app.get('/content/:cid', async (req, res) => {
  try {
    const { cid } = req.params;
    
    // Get file metadata from database
    const result = await pgPool.query('SELECT * FROM files WHERE cid = $1', [cid]);
    
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'File not found' });
      return;
    }
    
    const file = result.rows[0];
    
    // Set content type header
    res.setHeader('Content-Type', file.mimetype);
    res.setHeader('Content-Disposition', `inline; filename="${file.filename}"`);
    
    // Get file from Helia
    try {
      const cidObj = CID.parse(cid);
      const chunks = [];
      
      for await (const chunk of fs_.cat(cidObj)) {
        chunks.push(chunk);
      }
      
      const content = Buffer.concat(chunks);
      res.send(content);
    } catch (error) {
      console.error('Error retrieving content from Helia:', error);
      
      // If we have an S3 key as fallback, fetch from there
      if (file.s3_key) {
        const s3Params = {
          Bucket: process.env.S3_BUCKET_NAME,
          Key: file.s3_key
        };
        
        const s3Stream = s3.getObject(s3Params).createReadStream();
        s3Stream.pipe(res);
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Error retrieving file content:', error);
    res.status(500).json({ error: 'Failed to retrieve file content' });
  }
});

// Start the app after initialization
initialize().then(() => {
  app.listen(port, () => {
    console.log(`Auto-pinning service listening at http://localhost:${port}`);
  });
}).catch(console.error);