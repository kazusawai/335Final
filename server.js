const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const https = require('https');
const querystring = require('querystring');
require('dotenv').config({ path: path.resolve(__dirname, 'credentialsDontPost/.env') });

const app = express();
const portNumber = 5000;

app.use(bodyParser.urlencoded({ extended: false }));
app.set('views', path.resolve(__dirname, 'templates'));
app.set('view engine', 'ejs');

// MongoDB configuration
const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = process.env.MONGO_CONNECTION_STRING;
const databaseAndCollection = { db: 'CMSC335DB', collection: 'inputs' };

async function insertUser(client, databaseAndCollection, user) {
  try {
    const result = await client.db(databaseAndCollection.db).collection(databaseAndCollection.collection).insertOne(user);
    console.log(`New user inserted with the following id: ${result.insertedId}`);
  } catch (error) {
    console.error(`Error inserting user: ${error.message}`);
    throw error;
  }
}

async function getAccessToken() {
  return new Promise((resolve, reject) => {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    const postData = querystring.stringify({
      grant_type: 'client_credentials'
    });

    const options = {
      hostname: 'accounts.spotify.com',
      port: 443,
      path: '/api/token',
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': postData.length
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log(`Spotify token response status: ${res.statusCode}`);
        console.log(`Spotify token response headers: ${JSON.stringify(res.headers)}`);
        console.log(`Spotify token response body: ${data}`);

        if (res.statusCode === 200) {
          resolve(JSON.parse(data).access_token);
        } else {
          console.error(`Error fetching access token: ${res.statusCode} - ${res.statusMessage}`);
          console.error(`Response body: ${data}`);
          reject(JSON.parse(data));
        }
      });
    });

    req.on('error', (e) => {
      console.error(`HTTPS request error: ${e.message}`);
      reject(e);
    });

    req.write(postData);
    req.end();
  });
}

async function getTopTracks(genre, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.spotify.com',
      port: 443,
      path: `/v1/search?q=genre:${encodeURIComponent(genre)}&type=track&limit=5`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log(`Spotify API response status: ${res.statusCode}`);
        console.log(`Spotify API response headers: ${JSON.stringify(res.headers)}`);
        console.log(`Spotify API response body: ${data}`);

        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(data).tracks.items);
          } catch (error) {
            console.error(`Error parsing JSON response: ${error.message}`);
            reject(error);
          }
        } else {
          console.error(`Error fetching top tracks: ${res.statusCode} - ${res.statusMessage}`);
          try {
            reject(JSON.parse(data));
          } catch (error) {
            reject(data);
          }
        }
      });
    });

    req.on('error', (e) => {
      console.error(`HTTPS request error: ${e.message}`);
      reject(e);
    });

    req.end();
  });
}

async function lookUpMany(client, databaseAndCollection) {
  try {
    const filter = {};
    const cursor = client.db(databaseAndCollection.db)
      .collection(databaseAndCollection.collection)
      .find(filter);

    const result = await cursor.toArray();
    return result;
  } catch (error) {
    console.error(`Error looking up users: ${error.message}`);
    throw error;
  }
}
app.get('/', (req, res) => {
  res.render('welcome');
});
app.post('/users', async (req, res) => {
  const { name, age, genreName } = req.body;

  const client = new MongoClient(uri, { serverApi: ServerApiVersion.v1 });

  try {
    await client.connect();
    let user = { name: name, genre: genreName, age: age };
    await insertUser(client, databaseAndCollection, user);

    const token = await getAccessToken();
    const topTracks = await getTopTracks(genreName, token);

    let html = `<h2>Top Tracks for ${genreName}</h2><ul>`;
    topTracks.forEach(track => {
      html += `<li>${track.name} by ${track.artists.map(artist => artist.name).join(', ')}</li>`;
    });
    html += `</ul>`;

    // Perform the lookup and include the results in the HTML
    const users = await lookUpMany(client, databaseAndCollection);
    html += `<h2>Shoutout to all our users!</h2><table style="border:1px solid black;"><tr><th style="border:1px solid black;">Name</th></tr>`;
    users.forEach(user => {
      html += `<tr><td style="border:1px solid black;">${user.name}</td></tr>`;
    });
    html += '</table>';

    res.render('usersShow', { table: html });
  } catch (e) {
    console.error(`Server error: ${e.message}`);
    res.status(500).send('Internal Server Error');
  } finally {
    await client.close();
  }
});

app.listen(portNumber, () => {
  console.log(`Server running at http://localhost:${portNumber}`);
});
