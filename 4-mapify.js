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
const hash = require('./lib/djb2-hash');

// Configuration defaults
let manifestPath = './data/manifest.json';
let inputFolder = './data/3-tokens/';
let outputFolder = './data/5-map/';

// Global result storage
let results = [];

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

  // Create empty JSON file
  fs.writeFileSync(path.resolve(outputFolder, 'map.json'), JSON.stringify(results), 'utf8');

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

          let reportMap = {
            substance: substance.substance,
            reportHash: hash(report.title).toString(16),
            reportName: report.title,
            reportFile: report.filename,
            pages: []
          };

          results.push(reportMap);

          docCount++;

          processReport(reportMap, report, __callback);
        }, _callback);
      }
    ],
    callback);
  }, handleComplete);
}

function processReport(reportMap, report, callback) {

  const filePath = path.resolve(inputFolder, report.filename + '.json');

  fs.readFile(filePath, 'utf8', (error, body) => {

    if (error) {

      console.error(`File error: ${error}`.red);

      callback();
    } else {

      let pages = JSON.parse(body);

      async.eachOf(pages, (tokens, index, _callback) => {

        let pageMap = {
          pageIndex: index,
          tokens: []
        };

        reportMap.pages.push(pageMap);

        processPage(reportMap, pageMap, tokens, _callback);
      }, callback);
    }
  });
}

function processPage(reportMap, pageMap, tokens, callback) {

  async.eachOf(tokens, (token, index, _callback) => {

    pageMap.tokens.push({
      tokenIndex: index,
      tokenHash: hash(token).toString(16)
    });

    _callback();
  }, callback);
}

// Async callback when loop is done
function handleComplete(error) {

  if (error) {

    console.error(`${error}`.red);

    cluster.worker.kill();
    process.exit(1);
  } else {

    const outputPath = path.resolve(outputFolder, 'map.json');

    // Load previous results and merge with new results
    const currentJson = fs.readFileSync(outputPath, 'utf8');
    const newJson = JSON.parse(currentJson).concat(results);

    fs.writeFileSync(outputPath, JSON.stringify(newJson), 'utf8');

    const timeDiff = Math.round((new Date() - timeCount) / (1000 * 60));

    console.log(`Mapped ${docCount} reports in ${timeDiff} minutes`.yellow);
    console.log(`Worker ${cluster.worker.id} is done`.green);

    cluster.worker.kill();
    process.exit(0);
  }
}

function handleError(error) {

  console.error(`Worker error: ${error}`.red);
}

module.exports = { init };
