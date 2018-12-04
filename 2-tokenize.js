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
const chunkArray = require('./lib/chunk-array');
const filterArray = require('./lib/filter-array');
const tokenize = require('./lib/tokenize-string');

// Configuration defaults
let manifestPath = './data/manifest.json';
let inputFolder = './data/2-pages/';
let outputFolder = './data/3-tokens/';

// Statistics
let docCount = 0;
let timeCount = new Date();

let callback = () => { return; };

// Execute script if not used as a module
if (!module.parent) {

  init(process.argv[2], process.argv[3], process.argv[4], process.argv[5]);
}

function init(_manifestPath, _inputFolder, _outputFolder, _callback) {

  let manifest;

  // Overwrite default configuration with arguments
  // from module or command line interface
  manifestPath = _manifestPath || manifestPath;
  inputFolder = _inputFolder || inputFolder;
  outputFolder = _outputFolder || outputFolder;
  callback = _callback || callback;

  // Create result folder
  if (!fs.existsSync(outputFolder)){

    fs.mkdirSync(outputFolder);
  }

  // Read manifest
  manifest = require(manifestPath);

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

    processManifest(manifestChunks[cluster.worker.id - 1]);
  }
}

function processManifest(manifestChunk) {

  async.each(manifestChunk, (substance, callback) => {

    async.parallel([

      _callback => {

        async.each(substance.reports, (report, __callback) => {

          tokenizeFile(report.filename, __callback);
        }, _callback);
      },
      _callback => {

        async.each(substance.applications, (application, __callback) => {

          tokenizeFile(application.filename, __callback);
        }, _callback);
      }
    ],
    callback);
  }, handleComplete);
}

function tokenizeFile(filename, callback) {

  const applicationJsonPath = path.resolve(inputFolder, `${filename}.json`);

  fs.readFile(applicationJsonPath, 'utf8', (error, body) => {

    if (error) {

      console.error(`File error: ${error}`.red);

      callback();
    } else {

      const pages = JSON.parse(body);
      const tokens = pages.map(pageContent => tokenize(pageContent));

      fs.writeFileSync(path.resolve(outputFolder, `${filename}.json`), JSON.stringify(tokens, null, 2), 'utf8');

      docCount++;

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

    console.log(`Tokenized ${docCount} documents in ${timeDiff} minutes`.yellow);
    console.log(`Worker ${cluster.worker.id} is done`.green);

    cluster.worker.kill();
    process.exit(0);
  }
}

function handleError(error) {

  console.error(`Worker error: ${error}`.red);
}

module.exports = { init };
