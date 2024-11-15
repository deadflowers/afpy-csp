import express from 'express';
import fetch from 'node-fetch';
import RSSParser from 'rss-parser';

const app = express();
const PORT = 8080;
const rssParser = new RSSParser();

// CORS setup to allow maximum availability
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); // Allow any origin
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS'); // Allow any HTTP method
  //res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization'); // Allow custom headers if needed
  res.setHeader('Access-Control-Max-Age', '86400'); // Cache preflight requests for 1 day
  next();
});

//app.use(function (req, res, next) {
//res.setHeader( 'Content-Security-Policy', "default-src '*'; script-src '*'; style-src '*'; font-src '*'; img-src '*'; frame-src '*'" );
//next(); });

app.get('/', async (req, res) => {
  const feedUrl = req.query.q;
  const callback = req.query.callback;
  const num = parseInt(req.query.num, 10); 

  if (!feedUrl) {
    return res.status(400).json({ error: 'Missing "q" query parameter with feed URL.' });
  }

  try {
    const feedResponse = await fetch(feedUrl);
    const feedText = await feedResponse.text();
    const parsedFeed = await rssParser.parseString(feedText);

    const entries = parsedFeed.items.map((item) => ({
      title: item.title,
      link: item.link,
      author: item.creator || item.author || (item['dc:creator'] || {}).value, // Atom sometimes uses "dc:creator"
      publishedDate: item.pubDate || item.isoDate || item.updated || item.published, // Common Atom date fields
      content: item.content || item['content:encoded'] || item.summary || item.description, // Atom may use summary
      contentSnippet: item.contentSnippet || item.summary, // Use summary for Atom snippets
    }));

    // Limit the number of results if num is specified and valid
    const limitedEntries = Number.isNaN(num) || num <= 0 ? entries : entries.slice(0, num);

    const responseData = {
      feed: {
        title: parsedFeed.title,
        description: parsedFeed.description,
        link: parsedFeed.link,
      },
      entries: limitedEntries, // Use the limited entries array
    };

    if (callback) {
      // JSONP response
      res.type('application/javascript');
      res.send(`${callback}(${JSON.stringify(responseData)})`);
    } else {
      // Standard JSON response
      res.json(responseData);
    }
  } catch (error) {
    console.error('Error fetching or parsing feed:', error);
    res.status(500).json({ error: 'Failed to fetch or parse RSS feed.' });
  }
});


app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
