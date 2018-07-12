// Extract text from PDF files, using OCR if necessary

const fs = require('fs');
const os = require('os');
const path = require('path');
const cluster = require('cluster');

const colors = require('colors');
const async = require('async');
const dir = require('node-dir');
const extract = require('pdf-text-extract');

// Configuration
let inputFolder = './pdf/';
let outputFolder = './text/';

// Options for extracting text from PDFs
const options = {
  splitPages: true,
  layout: 'raw'
};

let callback = () => { return; };

// Execute script if not used as a module
if (!module.parent) {

  init(
    process.argv[2],
    process.argv[3],
    process.argv[4]
  );
}

function init(_inputFolder, _outputFolder, _callback) {

  // Overwrite default configuration with arguments
  // from module or command line interface
  inputFolder = _inputFolder || inputFolder;
  outputFolder = _outputFolder || outputFolder;
  callback = _callback || callback;

  // Create output folder if missing
  if (!fs.existsSync(outputFolder)) {

    fs.mkdirSync(outputFolder);
  }

  readFiles(prepareCluster);
}

function readFiles(callback) {

  // Get a list of all files
  dir.files(inputFolder, (error, fileList) => {

    if (error) { throw error; }

    // Include PDF files only
    fileList = fileList.filter(file => file.search(/\.pdf$/) > -1);

    callback(fileList);
  });
}

function prepareCluster(fileList) {

  const cpuCoreCount = os.cpus().length;
  const fileListBatches = chunkArray(fileList, cpuCoreCount);
  const workerCount = Math.min(cpuCoreCount, fileListBatches.length);

  if (cluster.isMaster) {

    console.log(`Starting ${workerCount} workers...`.yellow);

    for (var i = 0; i < workerCount; i++) {

      cluster.fork().on('error', handleError);
    }
  } else if (cluster.isWorker) {

    console.log(`Worker ${cluster.worker.id} started with ${fileListBatches[cluster.worker.id - 1].length} tasks`.green);

    async.each(fileListBatches[cluster.worker.id - 1], (file, callback) => {

      extractText(file, callback);
    }, handleComplete);
  }
}

function extractText(filePath, callback) {

  console.log(`Processing file ${filePath}`);

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

function chunkArray(arr, length) {

  const chunks = [];

  while (arr.length) {

    const chunkSize = Math.ceil(arr.length / length--);
    const chunk = arr.slice(0, chunkSize);

    chunks.push(chunk);
    arr = arr.slice(chunkSize);
  }

  return chunks;
}

function saveFile(relativePath, string) {

  // Normalize file path
  relativePath = path.normalize(relativePath);

  try {

    console.log('Saved file', relativePath);

    // Save file
    return fs.writeFileSync(relativePath, string, 'utf8');
  } catch (error) {

    console.error(error);
  }
}

module.exports = { init };

