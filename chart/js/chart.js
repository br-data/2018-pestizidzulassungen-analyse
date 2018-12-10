window.addEventListener('load', init, false);

// Configuration
var resultFile = '../data/4-results/results.json';
var mapFile = '../data/5-map/map.json';

var cachedResults, cachedMap, cachedMerge;

var container;

var tooltip = {
  el: undefined,
  styleEl: undefined,
  offsetX: undefined,
  offsetY: 90,
  width: 200,
  overlap: 15,
  scale: undefined,
  arrowScale: undefined
};

var userInput = {};

var timeout;

function init() {

  container = d3.select('#container');

  tooltip.styleEl = d3.select('body').append('style');

  tooltip.el = d3.select('body').append('div')
    .attr('class', 'tooltip');

  userInput.thresholdDisplay = d3.select('#threshold-display');

  userInput.threshold = d3.select('#threshold')
    .on('change', function () {
      filter(render);
    });

  userInput.sorting = d3.selectAll('#sorting > input[type="radio"]')
    .on('click', function () {
      filter(render);
    });

  d3.json(resultFile, function (results) {

    d3.json(mapFile, function (map) {

      cachedResults = d3.nest()
        .key(function(d) { return d.substance; })
        .key(function(d) { return d.reportName; })
        .entries(results);

      cachedMap = map;

      filter(render);
    });
  });

  window.addEventListener('resize', update, false);
}

function filter(callback) {

  // var threshold = userInput.threshold.property('value') || 0.8;
  var sorting = d3.select('#sorting > input[type="radio"]:checked').property('value') || 'substance';

  if (sorting === 'substance') { cachedMap.sort(sortBySubstance); }
  if (sorting === 'country') { cachedMap.sort(sortByCountry); }

  var mergedData = cachedMap.map(function (substanceMap) {
    var substanceResults = cachedResults.filter(function (result) {
      return result.key === substanceMap.key;
    })[0];

    // Only merge maps which have results
    if (substanceResults) {

      var reportData = substanceMap.values.map(function (reportMap) {
        var reportResults = substanceResults.values.filter(function (result) {
          return result.key === reportMap.key;
        })[0];

        var pageData = reportMap.values.map(function (pageMap) {

          var pageResults = pageMap.map(function (tokenMap) {
            return reportResults.values.filter(function (result) {
              return tokenMap == result.reportHash;
            })[0];
          });

          var matchResults = {
            value: pageResults.filter(Boolean).length,
            length: pageResults.length,
            values: pageResults.filter(Boolean).map(function (d) {
              return {
                similarity: Math.round(d.similarity * 100) / 100
              };
            })
          };

          return matchResults;
        });

        return {
          key: reportMap.key,
          values: pageData
        };
      });

      return {
        key: substanceMap.key,
        values: reportData
      };
    }
  });

  // Remove undefined map merges
  mergedData = mergedData.filter(Boolean);
  cachedMerge = mergedData;

  callback(mergedData) ;
}

function render(data) {

  // var result = data.filter(function (d) {
  //   return d.key === 'Sulfosulfuron' || d.key === 'Prosulfuron' || d.key === 'Pyridate';
  // }).map(function (d) {
  //   return {
  //     key: d.key,
  //     values: d.values[0].values
  //   };
  // });
  // console.log(result);

  container.html('');

  var substance = container.selectAll('.substance')
      .data(data, key)
      .enter()
    .append('div')
      .attr('class', 'substance');

  substance.append('div')
      .attr('class', 'title')
    .append('h2')
      .text(key);

  substance.selectAll('.report')
      .data(values, key)
      .enter()
    .append('div')
      .attr('class', 'report')
      .each(draw);
}

function draw(data) {

  var element = d3.select(this);

  var report = element.append('div')
    .append('h3')
      .text(key);

  var width = report.node().getBoundingClientRect().width;

  tooltip.offsetX = report.node().getBoundingClientRect().x;

  tooltip.scale = d3.scaleLinear()
    .domain([0, width])
    .range([tooltip.offsetX - tooltip.overlap, tooltip.offsetX + width - tooltip.width + tooltip.overlap]);

  tooltip.arrowScale = d3.scaleLinear()
    .domain([-tooltip.overlap, width + tooltip.overlap])
    .range([5, 95]);

  var xScale = d3.scaleLinear()
    .domain([0, data.values.length])
    .range([0, width]);

  var colorScale = d3.scaleLinear()
    .domain([0, 100])
    .range(['#f0f0f4', '#a22c2e']);

  var rectWidth = (width / data.values.length) + 1;

  var xAxis = d3.axisBottom(xScale)
    .tickSize(0)
    .tickPadding(5)
    .tickValues(xScale.ticks(5).filter(function (d) {
      return d / xScale.domain()[1] < 0.95;
    }).concat(xScale.domain()[1]))
    .tickFormat(function (d) {
      return pretty(d);
    });

  var svg = element.append('svg')
  .attr('width', width)
  .attr('height', 75);

  svg.append('g')
    .attr('class', 'xAxis')
    .attr('transform', 'translate(0,50)')
    .call(xAxis);

  svg.append('rect')
    .attr('width', width)
    .attr('height', 50)
    .attr('fill', '#f0f0f4');

  svg.append('g')
    .selectAll('rect')
    .data(values)
    .enter()
  .append('rect')
    .attr('width', rectWidth)
    .attr('height', 50)
    .attr('x', function (d, i) {
      return xScale(i);
    })
    .attr('y', '0')
    .attr('fill', function (d) {
      if (d.length) {
        return colorScale(d.value / d.length * 100);
      } else {
        return '#fff';
      }
    })
    .on('mouseenter', handleMouseenter)
    .on('mouseleave', handleMouseleave);
}

function handleMouseenter(d, i) {

  var target = this;
  var x = parseInt(d3.select(target).attr('x'));
  var tooltipY = target.getBoundingClientRect().y - tooltip.offsetY;

  // Add style element for tooltip arrow offset
  tooltip.styleEl.html(function () {
    return '.tooltip:before { left: ' + tooltip.arrowScale(x) + '%; }' +
    '.tooltip:after { left: ' + tooltip.arrowScale(x) + '%; }';
  });

  // Add offset for tooltip container
  tooltip.el
    .style('display', 'block')
    .style('left', tooltip.scale(x) + 'px')
    .style('top', tooltipY + 'px');

  // Update tooltip content
  tooltip.el.html(function () {
    return '<p><strong>Seite ' + i + ':</strong><br> ' +
      d.value + ' Übernahmen in ' + d.length + ' Sätzen ' +
      '(' + Math.round(d.value / d.length * 100) + ' %)</p>';
  });
}

function handleMouseleave() {

  tooltip.el.style('display', 'none');
}

function update() {

  clearTimeout(timeout);

  timeout = setTimeout(function () {

    container.html('');
    render(cachedMerge);
  }, 500);
}

function values(d) {

  return d.values;
}

function key(d) {

  return d.key;
}

function pretty(number) {

  number = number.toString().split('.');
  number = number[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (number[1] ? ',' + number[1] : '');

  return number;
}

function sortBySubstance(a, b) {

  if (a.key < b.key) { return -1; }
  if (a.key > b.key) { return 1; }

  return 0;
}

function sortByCountry(a, b) {

  if (a.values[0].key < b.values[0].key) { return -1; }
  if (a.values[0].key > b.values[0].key) { return 1; }

  return 0;
}
