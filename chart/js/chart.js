document.addEventListener('DOMContentLoaded', init, false);

// Configuration
var resultFile = '../data/4-results/results-75-50.json';
var mapFile = '../data/5-map/map.json';

var cachedResults, cachedMap, cachedMerge;

var results;
var width, offsetX;

var tooltip = {
  el: undefined,
  styleEl: undefined,
  width: 200,
  overlap: 15
};

var timeout;

function init() {

  results = d3.select('#results');

  tooltip.styleEl = d3.select('.tooltip-style');

  tooltip.el = results.append('div')
    .attr('class', 'tooltip');

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

  var mergedData = cachedMap.map(function (substanceMap) {
    var substanceResults = cachedResults.filter(function (result) {
      return result.key === substanceMap.key;
    })[0];

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
          values: pageResults.filter(Boolean)
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
  });

  cachedMerge = mergedData;

  callback(mergedData) ;
}

function render(data) {

  var law = results.selectAll('.law')
      .data(data, key)
      .enter()
    .append('div')
      .attr('class', 'law');

  law.append('div')
      .attr('class', 'title')
    .append('h2')
      .text(key);

  law.selectAll('.statement')
      .data(values, key)
      .enter()
    .append('div')
      .attr('class', 'statement')
      .each(draw);
}

function draw(data) {

  var element = d3.select(this);

  var report = element.append('div')
    .append('h3')
      .text(key);

  width = report.node().getBoundingClientRect().width;
  offsetX = report.node().getBoundingClientRect().x;

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

function handleMouseenter(d, self) {

  var target = this || self;

  var x = parseInt(d3.select(target).attr('x'));

  var tooltipY = target.getBoundingClientRect().y - 80;

  var tooltipScale = d3.scaleLinear()
    .domain([0, width])
    .range([offsetX - tooltip.overlap, offsetX + width - tooltip.width + tooltip.overlap]);

  var tooltipArrowScale = d3.scaleLinear()
    .domain([-tooltip.overlap, width + tooltip.overlap])
    .range([5, 95]);

  // Add style element for tooltip arrow offset
  tooltip.styleEl.html(function () {
    return '.tooltip:before {' +
      'left: ' + tooltipArrowScale(x) + '%;' +
    '} ' +
    '.tooltip:after {' +
      'left: ' + tooltipArrowScale(x) + '%;' +
    '}';
  });

  // Add offset for tooltip container
  tooltip.el
    .style('display', 'block')
    .style('left', tooltipScale(x) + 'px')
    .style('top', tooltipY + 'px');

  // Update tooltip content
  tooltip.el.html(function () {
    return '<p>' + d.value + ' Übernahmen bei ' + d.length + ' Sätzen</p>';
  });
}

function handleMouseleave() {

  tooltip.el.style('display', 'none');
}

function update() {

  clearTimeout(timeout);

  timeout = setTimeout(function () {

    results.html('');
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

function clone(obj) {

  return JSON.parse(JSON.stringify(obj));
}

function hash(str) {

  var hash = 5381;
  var len = str.length;

  while (len) {
    hash = (hash * 33) ^ str.charCodeAt(--len);
  }

  return hash >>> 0;
}
