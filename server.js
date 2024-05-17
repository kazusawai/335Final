const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const https = require('https');
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

const id = process.env.SPOTIFY_CLIENT_ID;
const secret = process.env.SPOTIFY_CLIENT_SECRET;

async function getAccessToken() {
    const params = new URLSearchParams();
    params.append("grant_type", "client_credentials");

    const result = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
            "Authorization": "Basic " + btoa(id + ":" + secret)
        },
        body: params
    });
    
    return (await result.json()).access_token;
}

async function getTopTracks(genre, token) {
  const result = await fetch(`https://api.spotify.com/v1/search?q=genre:${genre}&type=track`, {
      method: 'GET',
      headers: {
          'Authorization': 'Bearer ' + token,
      }
  });
  return (await result.json()).tracks.items;
}

async function lookUpMany(client, databaseAndCollection, genreName) {
  try {
    let filter = {genre : {$eq: genreName}}; 
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

app.use(express.static(__dirname));

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

    const users = await lookUpMany(client, databaseAndCollection, genreName);
    html += `<h2>Other Users Interested In The Genre You Selected</h2><table style="border:1px solid black;"><tr><th style="border:1px solid black;">Name</th></tr>`;
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