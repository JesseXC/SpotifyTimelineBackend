/**
 * This is an example of a basic node.js script that performs
 * the Authorization Code oAuth2 flow to authenticate against
 * the Spotify Accounts.
 *
 * For more information, read
 * https://developer.spotify.com/documentation/web-api/tutorials/code-flow
 */


// const SpotifyWebApi = require('spotify-web-api-node');
// const spotifyApi = new SpotifyWebApi();

// spotifyApi.set

// const getTopTracks = async () => {
//   try {
//     const response = await spotifyApi.getMyTopTracks();
//     console.log(response); // Log the full response
//     return response.items; // Assuming 'items' contains the list of top tracks
//   } catch (error) {
//     console.error("Error fetching top tracks: ", error);
//     return []; // Return an empty array in case of an error
//   }
// };

// // Function to initialize and set topSongs
// const initializeTopSongs = async () => {
//   const topSongs = await getTopTracks();
//   console.log(topSongs); // Use or log the topSongs here
// };

// // Call the function to initialize topSongs
// initializeTopSongs();

// const firstFourTopSongsIdsString = topSongs.slice(0, 4).map(song => song.id).join(', ');




var express = require('express');
var request = require('request');
var crypto = require('crypto');
var cors = require('cors');
var querystring = require('querystring');
var cookieParser = require('cookie-parser');
const { type } = require('os');

var client_id = process.env.CLIENT_ID; // your clientId
var client_secret = process.env.CLIENT_SECRET; // Your secret
console.log(client_id)
console.log(typeof (client_id))
console.log("Hello")
var redirect_uri = 'https://spotifytimelinebackend-production.up.railway.app/callback';

const generateRandomString = (length) => {
  return crypto
    .randomBytes(60)
    .toString('hex')
    .slice(0, length);
}

var stateKey = 'spotify_auth_state';

var app = express();

app.use(express.static(__dirname + '/public'))
  .use(cors())
  .use(cookieParser());

app.get('/login', function (req, res) {

  var state = generateRandomString(16);
  res.cookie(stateKey, state);



  // your application requests authorization
  var scope = 'user-read-private user-read-email user-read-playback-state user-library-read user-top-read';
  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: client_id,
      scope: scope,
      redirect_uri: redirect_uri,
      state: state
    }));
});

app.use(express.json());

//defining endpoint to send user data to front end
app.get('/api/songs/:username', (req, res) => {
  const username = req.params.username;

  // Logic to retrieve the user's songs from the database
  db.query('SELECT songs FROM userSongs WHERE username = ?', [username], (err, result) => {
    if (err) {
      console.error("Error accessing database: ", err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    if (result.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Assuming 'songs' column contains a JSON string or a comma-separated list of songs
    const userSongs = result[0].songs;
    res.json({ username, songs: userSongs });
  });
});

// const corsOptions = {
//   origin: 'http://localhost:5173',  // Allow only this origin to send requests
//   optionsSuccessStatus: 200  // Some legacy browsers (IE11, various SmartTVs) choke on 204
// };

// app.use(cors(corsOptions));

app.use(cors());

const mysql = require('mysql2');

// Database connection configuration
const db = mysql.createConnection({
  host: process.env.MYSQLHOST,
  user: 'root',
  port: process.env.MYSQLPORT,
  password: process.env.MYSQL_ROOT_PASSWORD,
  database: process.env.MYSQL_DATABASE
});



app.get('/callback', function (req, res) {

  // your application requests refresh and access tokens
  // after checking the state parameter

  var code = req.query.code || null;
  var state = req.query.state || null;
  var storedState = req.cookies ? req.cookies[stateKey] : null;

  if (state === null || state !== storedState) {
    res.redirect('/#' +
      querystring.stringify({
        error: 'state_mismatch'
      }));
  } else {
    res.clearCookie(stateKey);
    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code'
      },
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + (new Buffer.from(client_id + ':' + client_secret).toString('base64'))
      },
      json: true
    };

    request.post(authOptions, function (error, response, body) {
      if (!error && response.statusCode === 200) {

        var access_token = body.access_token,
          refresh_token = body.refresh_token;

        var options = {
          url: 'https://api.spotify.com/v1/me',
          headers: { 'Authorization': 'Bearer ' + access_token },
          json: true
        };

        // use the access token to access the Spotify Web API
        request.get(options, function (error, response, body) {
          console.log(body);

          const spotifyUsername = body.id;

          db.query('SELECT * FROM userSongs WHERE username = ?', [spotifyUsername], (err, result) => {
            if (err) {
              console.error("Error accessing database: ", err)
            } else if (result.length === 0) {
              // User does not exist, insert new user
              db.query('INSERT INTO userSongs (username, songs) VALUES (?, ?)', [spotifyUsername, ""], (insertErr) => {
                if (insertErr) {
                  console.error("Error inserting new user: ", insertErr);
                } else {
                  console.log("New user inserted successfully");
                  // proceed after successfully inserting the user
                }
              });
            } else {
              // User exists, proceed with your logic
            }
          });

        });

        // we can also pass the token to the browser to make requests from there
        res.redirect('http://localhost:5173/#' +
          querystring.stringify({
            access_token: access_token,
            refresh_token: refresh_token
          }));
      } else {
        res.redirect('http://localhost:5173/#' +
          querystring.stringify({
            error: 'invalid_token'
          }));
      }
    });
  }
});

app.get('/refresh_token', function (req, res) {

  var refresh_token = req.query.refresh_token;
  var authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + (new Buffer.from(client_id + ':' + client_secret).toString('base64'))
    },
    form: {
      grant_type: 'refresh_token',
      refresh_token: refresh_token
    },
    json: true
  };

  request.post(authOptions, function (error, response, body) {
    if (!error && response.statusCode === 200) {
      var access_token = body.access_token,
        refresh_token = body.refresh_token;
      res.send({
        'access_token': access_token,
        'refresh_token': refresh_token
      });
    }
  });
});

const PORT = process.env.PORT || 9000;

app.listen(PORT, () => console.log(`Sever is running port ${PORT} ...`));
