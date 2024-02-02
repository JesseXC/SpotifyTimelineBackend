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
console.log(typeof(client_id))
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

app.get('/login', function(req, res) {

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

const mysql = require('mysql2');

// Database connection configuration
const db = mysql.createConnection({
  host: 'roundhouse.proxy.rlwy.net',
  user: 'root',
  password: 'hCACAa-2hEdfEfFB426HcHHa2-Ce2hbC',
  database: 'railway'
});



app.get('/callback', function(req, res) {

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

    request.post(authOptions, function(error, response, body) {
      if (!error && response.statusCode === 200) {

        var access_token = body.access_token,
            refresh_token = body.refresh_token;

        var options = {
          url: 'https://api.spotify.com/v1/me',
          headers: { 'Authorization': 'Bearer ' + access_token },
          json: true
        };

        // use the access token to access the Spotify Web API
        request.get(options, function(error, response, body) {
          console.log(body);

        const spotifyUsername = body.id;
        
        db.query('SELECT * FROM users WHERE spotify_username = ?', [spotifyUsername], (err, result) => {
          if (err) {
            console.error("Error accessing database: ", err)
          } else if (result.length === 0) {
            // User does not exist, insert new user
            db.query('INSERT INTO users (spotify_username, song_ids) VALUES (?, ?)', [spotifyUsername, ""], (insertErr) => {
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

app.get('/refresh_token', function(req, res) {

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

  request.post(authOptions, function(error, response, body) {
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
