// Check that our configuration file exists, throw error if it doesn't.
var fs = require("fs"),
    cfe = fs.existsSync("config.js");

if (!cfe){
    console.log("config.js does not exist, please create it.");
}

// Load the configuration and check if the database exists, create if it doesn't.
var config = require('./config.js'),
    dbe = fs.existsSync(config.databasePath);


if (!dbe) {
    console.log("Creating SQLite Database.");
    fs.openSync(config.databasePath, "w");
}

// Load the database and webserver modules.
var http = require("http"),
    urlp = require("url"),
    crypto = require('crypto'),
    sqlite3 = require("sqlite3"),
    database = new sqlite3.Database(config.databasePath);

if (!dbe) {
    database.serialize(function() {
        database.run("CREATE TABLE urls (hash TEXT PRIMARY KEY, url TEXT)", function(err) {
            if (err) {
                console.log("There was an error in creating the database.");
                console.log(err);
            } else {
                // Sample row to test databse
                database.run("INSERT INTO urls VALUES ('w4cbe', 'http://w4c.be')");
            }
        });
    });
}

// Handle all requests to the node.js server
var handleRequest = function(request, response) {
    var url = urlp.parse(request.url, true);
    switch(url.pathname.slice(1)) {
        case "create":
            if (null === url.query) {
                redirect(response, "http://google.com");
            } else {
                console.log(url.query);
                createUrl(url.query.hash, url.query.url, function(url, err) {
                    if (err) {
                        respond(response, err)
                    } else {
                        respond(response, config.baseUrl + ":" + config.port + '/' + url);
                    }
                });
            }
            break;
        default:
            getUrl(url.pathname, function(url, err){
                if (err) {
                    respond(response, err);
                } else {
                    redirect(response, url);
                }
            });
            break;
    }
};

// Redirects to the given URL
var redirect = function(response, url) {
    response.writeHead(302, {
        'Location': url
    });
    response.end();
};

// Redirects to the given URL
var respond = function(response, text) {
    response.writeHead(200, {
        "Content-Type": "text/plain"
    });
    response.end(text);
};

// Grab the URL from the SQLite database
var getUrl = function(hash, callback) {
    database.get('SELECT url FROM urls WHERE hash = $hash LIMIT 1', {$hash: hash.slice(1)}, function(err, row){
        if (err) {
            console.log("Error while inserting to database: " + err);
        } else if (row !== undefined) {
            callback(row.url);
        } else {
            callback(null, "Unable to find URL");
        }
    });
};

// Create a URL entry in the SQLite database
var createUrl = function(hash, url, callback, start){
    var generatedHash = hash;
    if (null == generatedHash) {
        if (undefined === start) {
            start = 0;
        }
        // Dirty hashing to try to be unique
        var md5 = crypto.createHash('md5');
        var rUrl = url + md5.update(""+Math.random()).digest('hex');
        md5 = crypto.createHash('md5');
        generatedHash = md5.update(rUrl).digest('hex').slice(start,start+config.hashLength);
    }
    database.run('INSERT INTO urls VALUES ($hash, $url)', {$hash: generatedHash, $url: url}, function(err){
        if (err) {
            if (hash == null) {
                createUrl(null, url, callback, start++);
            } else {
                callback(null, "Hash already exists.");
            }
        } else {
            callback(generatedHash);
        }
    });
};

// Open our server
http.createServer(handleRequest).listen(config.port);