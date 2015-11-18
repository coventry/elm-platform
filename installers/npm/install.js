var Promise = require("promise");
var path = require("path");
var platform = require(path.join(__dirname, "platform"));
var spawn = require("child_process").spawn;
var path = require("path");
var fs = require("fs");
var https = require("follow-redirects").https;
var tar = require("tar");
var zlib = require("zlib");
var mkdirp = require("mkdirp");
var distDir = platform.distDir;
var shareReactorDir = platform.shareReactorDir;

function checkBinariesPresent() {
  return Promise.all(
    platform.executables.map(function(executable) {
      var executablePath = platform.executablePaths[executable];

      return new Promise(function(resolve, reject) {
        fs.stat(executablePath, function(err, stats) {
          if (err) {
            reject(executable + " was not found.");
          } else if (!stats.isFile()) {
            reject(executable + " was not a file.");
          } else {
            resolve();
          }
        });
      });
    })
  );
}

function downloadBinaries() {
  return new Promise(function(resolve, reject) {
    // 'arm', 'ia32', or 'x64'.
    var arch = process.arch;

    //'darwin', 'freebsd', 'linux', 'sunos' or 'win32'
    var operatingSystem = process.platform;

    var filename = operatingSystem + "-" + arch + ".tar.gz";
    var url = "https://dl.bintray.com/elmlang/elm-platform/"
      + platform.elmVersion + "/" + filename;

    https.get(url, function(response) {
      if (response.statusCode == 404) {
        reject("Unfortunately, there are currently no Elm Platform binaries available for your operating system and architecture.\n\nIf you would like to build Elm from source, there are instructions at https://github.com/elm-lang/elm-platform#build-from-source\n");
      }

      if (!fs.existsSync(distDir)) {
        mkdirp.sync(distDir);
      }

      console.log("Downloading Elm binaries from " + url);

      var untar = tar.Extract({path: distDir, strip: 1})
        .on("error", function(error) {
          reject("Error extracting " + filename + " - " + error);
        })
        .on("end", function() {
          if (!fs.existsSync(distDir)) {
            reject(
              "Error extracting executables: extraction finished, but",
              distDir, "directory was not created.\n" +
              "Current directory contents: " + fs.readdirSync(__dirname)
            );
          }

          if (!fs.statSync(distDir).isDirectory()) {
            reject(
              "Error extracting executables: extraction finished, but" +
              distDir + "ended up being a file, not a directory. " +
              "This can happen when the .tar.gz file contained the " +
              "binaries directly, instead of containing a directory with " +
              "the files inside.");
          }

          checkBinariesPresent().then(function() {
              resolve("Successfully downloaded and processed " + filename);
            }, function(error) {
              console.error("Error extracting executables...");
              console.error("Expected these executables to be in", distDir, " - ", platform.executables);
              console.error("...but got these contents instead:", fs.readdirSync(distDir));

              reject(error);
            }
          );
        });

      var gunzip = zlib.createGunzip()
        .on("error", function(error) {
          reject("Error decompressing " + filename + " " + error);
        });

      response.on("error", function(error) {
        reject("Error receiving " + url);
      }).pipe(gunzip).pipe(untar);
    }).on("error", function(error) {
      reject("Error communicating with URL " + url + " " + error);
    });
  });
}

function downloadReactorAssets() {
  var filename = "elm-reactor-assets.tar.gz";
  var url = "https://dl.bintray.com/elmlang/elm-platform/"
    + platform.elmVersion + "/" + filename;

  return new Promise(function(resolve, reject) {
    https.get(url, function(response) {
      if (response.statusCode != 200 && response.statusCode != 204) {
        console.log("Unable to download elm-reactor assets. elm-reactor may not work properly.");

        reject(response.statusCode);

        return;
      }

      console.log("Downloading Elm Reactor assets from " + url);

      var untar = tar.Extract({path: shareReactorDir, strip: 1})
        .on("error", function(error) {
          reject("Error extracting " + filename + " - " + error);
        })
        .on("end", function() {
          if (!fs.existsSync(shareReactorDir)) {
            reject(
              "Error extracting elm-reactor assets: extraction finished, but",
              distDir, "directory was not created.\n" +
              "Current directory contents: " + fs.readdirSync(__dirname)
            );
          }

          if (!fs.statSync(shareReactorDir).isDirectory()) {
            reject(
              "Error extracting elm-reactor assets: extraction finished, but" +
              distDir + "ended up being a file, not a directory. " +
              "This can happen when the .tar.gz file contained the " +
              "assets directly, instead of containing a directory with " +
              "the files inside.");
          }

          resolve("Successfully downloaded and processed " + filename);
        });

      var gunzip = zlib.createGunzip()
        .on("error", function(error) {
          reject("Error decompressing " + filename + " " + error);
        });

      response.on("error", function(error) {
        reject("Error receiving " + url);
      }).pipe(gunzip).pipe(untar);
    });
  });
}

Promise.all([
  downloadBinaries(),
  downloadReactorAssets()
]).then(function(successMessages) {
  successMessages.forEach(function(message) {
    console.log(message);
  })
}, function(errorMsg) {
  console.error(errorMsg);
  process.exit(1);
});