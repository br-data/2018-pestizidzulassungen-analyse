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
const dice = require('./lib/dice-coefficient');

// Configuration defaults
let manifestPath = './data/manifest.json';
let inputFolder = './data/3-tokens';
let outputFolder = './data/4-results';
let minSimilarity = 0.75;
let minLength = 50;

// Global result storage
let hashTable = [];
let results = [];

// Statistics
let tokenCount = 0;
let timeCount = new Date();

let callback = () => { return; };

// Execute script if not used as a module
if (!module.parent) {

  init(process.argv[2], process.argv[3], process.argv[4],
    process.argv[5], process.argv[6], process.argv[7]);
}

function init(_manifestPath, _inputFolder, _outputFolder, _minSimilarity, _minLength, _callback) {

  let manifest;

  // Overwrite default configuration with arguments
  // from module or command line interface
  manifestPath = _manifestPath || manifestPath;
  inputFolder = _inputFolder || inputFolder;
  outputFolder = _outputFolder || outputFolder;
  minSimilarity = _minSimilarity || minSimilarity;
  minLength = _minLength || minLength;
  callback = _callback || callback;

  // Create result folder
  if (!fs.existsSync(outputFolder)){

    fs.mkdirSync(outputFolder);
  }

  // Create empty JSON file
  fs.writeFileSync(path.resolve(outputFolder, 'results-nested.json'), JSON.stringify(results), 'utf8');

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

    for (var i = 0; i < workerCount; i++) {

      cluster.fork().on('error', handleError);
    }
  } else if (cluster.isWorker) {

    console.log(`Worker ${cluster.worker.id} started with ${manifestChunks[cluster.worker.id - 1].length} tasks`.green);

    processManifest(manifestChunks[cluster.worker.id - 1]);
  }
}

function processManifest(manifestChunk) {

  async.each(manifestChunk, (substance, _callback) => {

    processSubstance(substance, _callback);
  }, handleComplete);
}

function processSubstance(substance, callback) {

  console.log(`Processing substance: ${substance.substance}`);

  let sub = {
    key: substance.substance,
    values: []
  };

  results.push(sub);

  async.each(substance.reports, (report, _callback) => {

    processReport(sub, substance, report, _callback);
  }, callback);
}

function processReport(sub, substance, report, callback) {

  const filePath = path.resolve(inputFolder, report.filename + '.json');

  fs.readFile(filePath, 'utf8', (error, body) => {

    if (error) {

      console.error(`File error: ${error}`.red);

      callback();
    } else {

      report.pages = JSON.parse(body);

      let rep = {
        key: report.title,
        pages: report.pages.length,
        values: []
      };

      sub.values.push(rep);

      async.each(substance.applications, (application, _callback) => {

        processApplication(rep, substance, report, application, _callback);
      }, callback);
    }
  });
}

function processApplication(rep, substance, report, application, callback) {

  const filePath = path.resolve(inputFolder, application.filename + '.json');

  fs.readFile(filePath, 'utf8', (error, body) => {

    if (error) {

      console.error(`File error: ${error}`.red);

      callback();
    } else {

      console.log(`Processing application: ${application.title}`);

      application.pages = JSON.parse(body);

      let app = {
        key: application.title,
        pages: application.pages.length,
        values: []
      };

      rep.values.push(app);

      comparePages(app, substance, report, application, callback);
    }
  });
}

function comparePages(app, substance, report, application, callback) {

  async.eachOf(report.pages, (reportPage, reportPageIndex, _callback) => {

    report.page = reportPage;
    report.pageIndex = reportPageIndex;

    async.eachOf(application.pages, (applicationPage, applicationPageIndex, __callback) => {

      application.page = applicationPage;
      application.pageIndex = applicationPageIndex;

      compareTokens(app, substance, report, application, __callback);
    }, _callback);
  }, callback);
}

function compareTokens(app,substance, report, application, callback) {

  async.eachOf(report.page, (reportToken, reportTokenIndex, _callback) => {

    async.eachOf(application.page, (applicationToken, applicationTokenIndex, __callback) => {

      // Check if sentence is long enough
      if (reportToken.length > minLength && applicationToken.length > minLength) {

        const applicationHash = hash(applicationToken).toString(16);
        const wasIndexed = hashTable.indexOf(applicationHash) > -1;

        // Save result if the result was not saved yet and ...
        if (!wasIndexed) {

          // Calculate similarity using Sørensen–Dice coefficient
          const similarity = dice(reportToken, applicationToken);

          // ... if the similarity is high enough
          if (similarity > minSimilarity) {

            const reportHash = hash(reportToken).toString(16);

            app.values.push({
              reportPageIndex: report.pageIndex,
              reportTokenIndex,
              reportToken,
              reportHash,

              applicationPageIndex: application.pageIndex,
              applicationTokenIndex,
              applicationToken,
              applicationHash,

              similarity
            });

            // Add hash to index
            hashTable.push(applicationHash);
          }
        }
      }

      tokenCount++;

      __callback();
    }, _callback);
  }, callback);
}

// Async callback when loop is done
function handleComplete(error) {

  if (error) {

    console.error(`${error}`.red);

    cluster.worker.kill();
    process.exit(1);
  } else {

    const outputPath = path.resolve(outputFolder, 'results-nested.json');

    // Load previous results and merge with new results
    const currentJson = fs.readFileSync(outputPath, 'utf8');
    const newJson = JSON.parse(currentJson).concat(results);

    fs.writeFileSync(outputPath, JSON.stringify(newJson), 'utf8');

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

module.exports = { init };
