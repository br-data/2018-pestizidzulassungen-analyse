// Find similarities between multiple unstructured json documents

// Internal packages
const fs = require('fs');
const os = require('os');
const path = require('path');
const cluster = require('cluster');

// External packages
const colors = require('colors');
const async = require('async');

// Custom functions
const tokenize = require('./lib/tokenize');

// Configuration defaults
let inputFolder = './input/';
let outputFolder = './input/tokens';
let minSimilarity = 0.8;
let minLength = 80;

let inputPath = '';
let outputPath = '';

// Global result storage
let results = [];

// Statistics
let tokenCount = 0;
let timeCount = new Date();

// Execute script if not used as a module
if (!module.parent) {

  init(process.argv[2], process.argv[3], process.argv[4], process.argv[5]);
}

function init(_inputFolder, _outputFolder, _minSimilarity, _minLength) {

  let manifest;

  // Overwrite default configuration with arguments
  // from module or command line interface
  inputFolder = _inputFolder || inputFolder;
  outputFolder = _outputFolder || outputFolder;
  minSimilarity = _minSimilarity || minSimilarity;
  minLength = _minLength || minLength;

  inputPath = path.resolve(inputFolder, 'manifest-MOD.json');

  // Create result folder
  if (!fs.existsSync(outputFolder)){

    fs.mkdirSync(outputFolder);
  }

  // Read manifest
  manifest = require(inputPath);

  // Filter out entities that don't have a report or any applications
  manifest = filterArray(manifest, ['applications', 'reports']);

  prepareCluster(manifest);
}

function prepareCluster(manifest) {

  // Prepare batches for workers based on number of CPUs or manifest length
  const cpuCoreCount = os.cpus().length;
  const manifestChunks = chunkArray(manifest, 'applications', cpuCoreCount);
  const workerCount = Math.min(cpuCoreCount, manifestChunks.length);

  if (cluster.isMaster) {

    console.log(`Starting ${workerCount} workers...`.yellow);

    // Create new worker for each batch
    for (var i = 0; i < workerCount; i++) {

      cluster.fork().on('error', handleError);
    }
  } else if (cluster.isWorker) {

    console.log(`Worker ${cluster.worker.id} started with ${manifestChunks[cluster.worker.id - 1].length} tasks`.green);

    async.each(manifestChunks[cluster.worker.id - 1], (substance, callback) => {

      async.parallel([
        done => {

          async.each(substance.reports, report => {

            tokenizeFile(report.filename, done);
          });
        },
        done => {

          async.each(substance.applications, application => {

            tokenizeFile(application.filename, done);
          });
        }
      ],
      (error, results) => {

        callback(error, results);
      });

    }, handleComplete);
  }
}

function tokenizeFile(filename, callback) {

  const applicationJsonPath = path.resolve(inputFolder, 'json', `${filename}.json`);

  fs.readFile(applicationJsonPath, 'utf8', (error, body) => {

    if (error) {

      console.error(`File error: ${error}`.red);

      callback();
    } else {

      const pages = JSON.parse(body);
      const tokens = pages.map(pageContent => tokenize(pageContent));

      fs.writeFileSync(path.resolve(outputFolder, `${filename}.json`), JSON.stringify(tokens, null, 2), 'utf8');

      callback();
    }
  });
}

// Async callback when loop is done
function handleComplete(error) {

  if (error) {

    console.error(`${error}`.red);

    cluster.worker.kill();
    process.exit(1);
  } else {

    const timeDiff = Math.round((new Date() - timeCount) / (1000 * 60));

    console.log(`Compared ${tokenCount} tokens in ${timeDiff} minutes`.yellow);
    console.log(`Worker ${cluster.worker.id} is done`.green);

    cluster.worker.kill();
    process.exit(0);
  }
}

function handleError(error) {

  console.error(`Worker error: ${error}`.red);
}

// Remove all objects with missing arrays for a certain key
function filterArray(arr, keys) {

  return arr.filter(obj =>
    keys.every(key =>
      //obj.hasOwnProperty(key)
      obj[key] && obj[key].length > 0
    )
  );
}

// Split array into a specific number of chunks
function chunkArray(arr, key, length) {

  const sortedArr = arr.sort((a, b) =>
    b[key].length - a[key].length
  );

  const chunks = sortedArr.reduce((acc, obj) => {
    const minLength = Math.min.apply(Math, acc.lengths);
    const minIndex = acc.lengths.indexOf(minLength);

    acc.groups[minIndex] = acc.groups[minIndex].concat([obj]);
    acc.lengths[minIndex] += obj[key].length;

    return acc;
  }, {
    lengths: new Array(length).fill(0),
    groups: new Array(length).fill([])
  });

  return chunks.groups.filter(group => group.length);
}

module.exports = { init };
