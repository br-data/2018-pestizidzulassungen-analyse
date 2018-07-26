// Extract text from PDF files, using OCR if necessary

// Internal packages
const fs = require('fs');
const os = require('os');
const path = require('path');
const cluster = require('cluster');

// External packages
const colors = require('colors');
const async = require('async');
const extract = require('pdf-text-extract');

// Configuration
let manifestPath = './data/manifest.json';
let inputFolder = './data/1-pdfs/';
let outputFolder = './data/2-pages/';

// Options for extracting text from PDFs
const options = {
  splitPages: true,
  layout: 'raw'
};

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

    async.each(manifestChunks[cluster.worker.id - 1], (substance, callback) => {

      async.parallel([

        _callback => {

          async.each(substance.reports, (report, __callback) => {

            extractText(report.filename, __callback);
          }, _callback);
        },
        _callback => {

          async.each(substance.applications, (application, __callback) => {

            extractText(application.filename, __callback);
          }, _callback);
        }
      ],
      callback);
    }, handleComplete);
  }
}

function extractText(fileName, callback) {

  const filePath = path.resolve(inputFolder, fileName);

  console.log(`Processing file ${fileName}`);

  extract(filePath, options, (error, result) => {

    // if (error) { callback(error); }

    const fileName = filePath.substr(filePath.lastIndexOf('/') + 1);

    // Save extracted content as text file
    saveFile(path.join(outputFolder, `${fileName}.json`), JSON.stringify(result, 0, 2));
    callback();
  });
}

function handleComplete(error) {

  if (error) {

    console.error(`${error}`.red);

    cluster.worker.kill();
    process.exit(1);
  } else {

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

function saveFile(relativePath, string) {

  // Normalize file path
  relativePath = path.normalize(relativePath);

  try {

    // Save file
    return fs.writeFileSync(relativePath, string, 'utf8');
  } catch (error) {

    console.error(error);
  }
}

module.exports = { init };

