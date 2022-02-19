var express = require('express');
var request = require('request');
var cors = require('cors');
var cookieParser = require('cookie-parser');
const { URLSearchParams } = require('url');

const path = require('path');
const PORT = '8000';

var client_id = '';
var client_secret = '';
var redirect_uri = `http://localhost:${PORT}/callback`;

/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
var generateRandomString = function(length) {
var text = '';
var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
}
return text;
};

var stateKey = 'spotify_auth_state';
var scopes = ['playlist-modify-public', 'playlist-modify-private'];

const app = express();    

app.use(express.static(path.join(__dirname, 'public')))
    .use(cors())
    .use(cookieParser());

app.get('/login', (req, res) => {
    var state = generateRandomString(16);
    res.cookie(stateKey, state);

    const paramsString = `response_type=code&client_id=${client_id}&scope=${scopes}&redirect_uri=${redirect_uri}&state=${state}`;
    let searchParams = new URLSearchParams(paramsString);

    res.redirect('https://accounts.spotify.com/authorize?' + searchParams.toString());
});

app.get('/callback', function(req, res) {
    var code = req.query.code || null;
    var state = req.query.state || null;
    var storedState = req.cookies ? req.cookies[stateKey] : null;

    var paramsString = 'error=state_mismatch';
    let searchParams = new URLSearchParams(paramsString);

    if ( state === null || state !== storedState) {
        res.redirect('/#' + searchParams.toString());
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
                'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))
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
              });

              paramsString = `access_token=${access_token}&refresh_token=${refresh_token}`;
              searchParams = new URLSearchParams(paramsString);
      
              // we can also pass the token to the browser to make requests from there
              res.redirect('/#' + searchParams.toString());
            } else {
                paramsString = 'error=invalid_token';
                searchParams = new URLSearchParams(paramsString);
                
                res.redirect('/#' + paramsString.toString());
            }
        });
    }
});

app.get('/get_playlists', (req, res) => {
    var paramsString = 'error=state_mismatch';
    let searchParams = new URLSearchParams(paramsString);
    
    var authToken = req.query.access_token;
    var options = {
        url: 'https://api.spotify.com/v1/me/playlists',
        headers: { 'Authorization': 'Bearer ' + authToken },
        json: true
    };

    request.get(options, (error, response, body) => {
        
        if (!error && response.statusCode === 200) {
            paramsString = `playlists=true`;
            searchParams = new URLSearchParams(paramsString);
      
            // we can also pass the token to the browser to make requests from there
            res.redirect('/#' + searchParams.toString());

        } else {
            paramsString = 'error=invalid_token';
            searchParams = new URLSearchParams(paramsString);
                
            res.redirect('/#' + paramsString.toString());
        }
    });
});

app.get('/add_to_playlist', (req, res) =>  {
    var authToken = req.query.access_token;
    var playlistId = req.query.playlist_id;

    var options = {
        url: `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
        headers: { 'Authorization': 'Bearer ' + authToken},
        body: {'uris':JSON.parse(req.cookies.songs)},
        json: true
    };

    request.post(options, (error, response, body) => {
        console.log(response.statusCode);
        if (!error && response.statusCode === 200) {
            res.clearCookie('songs')
        }
    });  
});

app.get('/refresh_token', (res, req) => {
    var refresh_token = req.query.refresh_token;
    var authOptions = {
            url: 'https://accounts.spotify.com/api/token',
            headers: { 'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64')) },
            form: {
            grant_type: 'refresh_token',
            refresh_token: refresh_token
        },
        json: true
    };

    request.post(authOptions, (error, response, body) => {
        if (!error && response.statusCode === 200) {
            var access_token = body.access_token;

            res.send({
                'access_token': access_token
            });
        }
    });
});

app.listen(PORT, () => console.log(`Listen to PORT ${PORT}`));
