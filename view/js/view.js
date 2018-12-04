document.addEventListener('DOMContentLoaded', init, false);

// Configuration
var resultFile = '../data/4-results/results.json';
var pdfPath = '../data/1-pdfs/';
var textPath = '../data/2-pages/';

var cachedData;
var results;

var userInput = {};

function init() {

  var help = d3.select('#help');
  var helpButton = d3.select('#help-button');

  results = d3.select('#results');

  modal.init();

  helpButton.on('click', function () {
    modal.open(help.node());
  });

  userInput.thresholdDisplay = d3.select('#threshold-display');

  userInput.threshold = d3.select('#threshold')
    .on('change', function () {
      filter(render);
    });

  userInput.sorting = d3.selectAll('#sorting > input[type="radio"]')
    .on('click', function () {
      filter(render);
    });

  userInput.selection = d3.select('#selection > select')
    .on('change', function () {
      scrollTo(d3.select(this).select('option:checked').attr('data-id'));
    });

  userInput.scrollTop = d3.select('#scroll-top')
    .on('click', function () {
      scrollTo(d3.select(this).attr('data-id'));
    });

  d3.json(resultFile, function (data) {
    cachedData = data;
    filter(render);
  });
}

function filter(callback) {

  var threshold = userInput.threshold.property('value') || 0.75;
  var sorting = d3.select('#sorting > input[type="radio"]:checked').property('value') || 'sequence';

  var filteredData = cachedData.filter(function (d) {
    return d.similarity >= threshold;
  });

  var nestedData = filteredData = d3.nest()
    .key(function(d) { return d.substance; })
    .key(function(d) { return d.applicationName; })
    .sortValues(function(a, b) {
      if (sorting === 'sequence') { return a.reportTokenIndex - b.reportTokenIndex; }
    })
    .sortValues(function(a, b) {
      if (sorting === 'sequence') { return a.reportPageIndex - b.reportPageIndex; }
      if (sorting === 'similarity') { return b.similarity - a.similarity; }
    })
    .entries(filteredData);

  userInput.thresholdDisplay.text(threshold * 100);

  callback(nestedData);
  callback(nestedData);
  callback(nestedData);
}

function render(data) {

  var selectOptions = userInput.selection.selectAll('option')
    .data(data, key);

  var selectContent = selectOptions.enter().append('option')
    .attr('data-id', function (d) {
      return 'id-' + dashcase(d.key);
    })
    .text(key);

  selectOptions.merge(selectContent);
  selectOptions.exit().remove();

  var report = results.selectAll('.report')
    .data(data, key);

  var reportHeader = report.enter().append('div')
      .attr('class', 'report')
      .attr('id', function (d) {
        return 'id-' + dashcase(d.key);
      })
    .append('div')
      .attr('class', 'title');

  var reportDownload = reportHeader.append('div')
    .attr('class', 'download');

  reportDownload.append('a')
    .attr('class', 'pdf')
    .attr('target', '_blank')
    .attr('href', function (d) {
      return pdfPath + d.values[0].values[0].reportFile;
    })
    .text('PDF');

  reportDownload.append('a')
    .attr('class', 'text')
    .attr('target', '_blank')
    .attr('href', function (d) {
      return textPath + d.values[0].values[0].reportFile + '.json';
    })
    .text('JSON');

  reportHeader.append('h2')
    .text(function (d) {
      return d.key + ' (' + d.values[0].values[0].reportName + ')';
    });

  report.merge(reportHeader);
  report.exit().remove();

  var application = report.selectAll('.application')
      .data(values, key);

  var applicationHeader = application.enter().append('div')
      .attr('class', 'application')
    .append('div')
      .attr('class', 'organization');

  var applicationDownload = applicationHeader.append('div')
    .attr('class', 'download');

  applicationDownload.append('a')
    .attr('class', 'pdf')
    .attr('target', '_blank')
    .attr('href', function (d) {
      return pdfPath + d.values[0].applicationFile;
    })
    .text('PDF');

  applicationDownload.append('a')
    .attr('class', 'text')
    .attr('target', '_blank')
    .attr('href', function (d) {
      return textPath + d.values[0].applicationFile + '.txt';
    })
    .text('Text');

  applicationHeader.append('h3')
    .text(key);

  application.merge(applicationHeader);
  application.exit().remove();

  var match = application.selectAll('.match')
    .data(values, key);

  var matchContent = match.enter().append('div')
      .attr('class', 'match');

  matchContent.append('p')
    .html(function (d) {
      return '<strong>S. ' + (d.reportPageIndex + 1) + ': </strong>' +
        '<span class="diff">' + diffString(d.applicationToken, d.reportToken) + '</span>';
    });

  matchContent.append('p')
    .attr('class', 'info')
    .html(function (d) {
      return Math.round(d.similarity * 100) + ' % Ähnlichkeit zwischen <span class="line-report">Bericht S. '  + (d.reportPageIndex + 1) +
        ', Satz ' + (d.reportTokenIndex + 1) + ' (' + d.reportHash + ')</span> und <span class="line-application">Antrag S. ' + (d.applicationPageIndex + 1) +
        ', Satz ' + (d.applicationTokenIndex + 1) + ' (' + d.applicationHash + ')</span>';
    });

  matchContent.merge(match);
  match.exit().remove();
}

function scrollTo(id) {

  var element = d3.select('#' + id);
  var offsetY = element.node().getBoundingClientRect().y;

  scroll.to(offsetY - 20, 750);
}

function values(d) {

  return d.values;
}

function key(d) {

  return d.key;
}

function dashcase(str) {

  return str.replace(/\s+/g, '-')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '');
}
