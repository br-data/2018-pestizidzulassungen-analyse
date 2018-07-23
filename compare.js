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
const hash = require('./lib/hash');
const dice = require('./lib/dice');

// Configuration defaults
let inputFolder = './input/';
let outputFolder = './output/';
let minSimilarity = 0.8;
let minLength = 80;

let inputPath = '';
let outputPath = '';

// Global result storage
let hashTable = [];
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

  inputPath = path.resolve(inputFolder, 'manifest-test.json');
  outputPath = path.resolve(outputFolder, 'results.json');

  // Create result folder
  if (!fs.existsSync(outputFolder)){

    fs.mkdirSync(outputFolder);
  }

  // Create empty JSON file
  fs.writeFileSync(outputPath, JSON.stringify(results), 'utf8');

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

    // Send the worker of to work
    async.each(manifestChunks[cluster.worker.id - 1], (substance, _callback) => {

      processSubstance(substance, _callback);
    }, handleComplete);
  }
}

function processSubstance(substance, callback) {

  console.log('Processing substance:', substance.substance);

  async.each(substance.reports, (report, _callback) => {

    processReport(substance, report, _callback);
  }, callback);
}

function processReport(substance, report, callback) {

  const filePath = path.resolve(inputFolder, 'tokens', report.filename + '.json');

  fs.readFile(filePath, 'utf8', (error, body) => {

    if (error) {

      console.error(`File error: ${error}`.red);

      callback();
    } else {

      console.log('Processing report:', report.title);

      report.pages = JSON.parse(body);

      async.each(substance.applications, (application, _callback) => {

        processApplication(substance, report, application, _callback);
      }, callback);
    }
  });
}

function processApplication(substance, report, application, callback) {

  const filePath = path.resolve(inputFolder, 'tokens', `${application.filename}.json`);

  fs.readFile(filePath, 'utf8', (error, body) => {

    if (error) {

      console.error(`File error: ${error}`.red);

      callback();
    } else {

      application.pages = JSON.parse(body);

      comparePages(substance, report, application, callback);
    }
  });
}

function comparePages(substance, report, application, callback) {

  async.eachOf(report.pages, (reportPage, reportPageIndex, _callback) => {

    report.page = reportPage;
    report.pageIndex = reportPageIndex;

    async.eachOf(application.pages, (applicationPage, applicationPageIndex, __callback) => {

      application.page = applicationPage;
      application.pageIndex = applicationPageIndex;

      compareTokens(substance, report, application, __callback);
    }, _callback);
  }, callback);
}

function compareTokens(substance, report, application, callback) {

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

            results.push({
              substance: substance.substance,

              reportName: report.title,
              reportFile: report.filename,
              reportPageIndex: report.pageIndex,
              reportTokenIndex,
              reportToken,
              reportHash,

              applicationName: application.title,
              applicationFile: application.filename,
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

    // Load previous results and merge with new results
    const currentJson = fs.readFileSync(outputPath, 'utf8');
    const newJson = JSON.parse(currentJson).concat(results);

    fs.writeFileSync(outputPath, JSON.stringify(newJson, null, 2), 'utf8');

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
