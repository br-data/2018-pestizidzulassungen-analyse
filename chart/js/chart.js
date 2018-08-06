document.addEventListener('DOMContentLoaded', init, false);

// Configuration
var resultFile = '../data/4-results/results-75-50.json';
var mapFile = '../data/5-map/map.json';

var cachedData, cachedMap, cachedMerge;
var results;
var timeout;

function init() {

  results = d3.select('#results');

  d3.json(resultFile, function (data) {

    d3.json(mapFile, function (map) {

      cachedMap = map;
      cachedData = data;

      filter(render);
    });
  });

  window.addEventListener('resize', update, false);
}

function filter(callback) {

  var nestedData = d3.nest()
    .key(function(d) { return d.reportName; })
    .key(function(d) { return d.applicationName; })
    .sortValues(function(a, b) {
      return d3.ascending(a.lawIndex, b.lawIndex);
    })
    .entries(cachedData);

  var mergedData = clone(nestedData).map(function (law) {

    var currentMap = cachedMap.filter(function (map) {

      return map.reportHash === hash(law.key).toString(16);
    })[0];


    // Because Frankreich
    if (currentMap) {

      law.values.map(function (stat) {
        stat.values = clone(currentMap.pages).map(function (mapValue) {
          mapValue.found = stat.values.filter(function (statValue) {
            return mapValue.tokenHash == statValue.lawHash;
          }).length > 0 ? true : false;
          return mapValue;
        });
        return stat;
      });
      return law;
    } else {

      console.error('Could not map', law.key);
    }
  });

  // Because Frankreich
  mergedData = mergedData.filter(function (obj) {
    return obj !== undefined;
  });

  cachedMerge = mergedData;

  console.log(cachedMerge);

  callback(mergedData);
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

  var org = element.append('div')
    .attr('class', 'organization')
  .append('h3')
    .text(key);

  var width = org.node().getBoundingClientRect().width;

  var scale = d3.scaleLinear()
    .domain([0, data.values.length])
    .range([0, width]);

  var axis = d3.axisBottom(scale)
    .tickSize(0)
    .tickPadding(5)
    .tickValues(scale.ticks(5).filter(function (d) {
      return d / scale.domain()[1] < 0.95;
    }).concat(scale.domain()[1]))
    .tickFormat(function (d) {
      return pretty(d);
    });

  var svg = element.append('svg')
  .attr('width', width)
  .attr('height', 75);

  svg.append('g')
    .attr('class', 'axis')
    .attr('transform', 'translate(0,50)')
    .call(axis);

  svg.append('rect')
    .attr('width', width)
    .attr('height', 50)
    .attr('fill', '#f0f0f4');

  svg.append('g')
    .selectAll('rect')
    .data(values)
    .enter()
  .append('rect')
    .attr('width', 1)
    .attr('height', 50)
    .attr('x', function (d) {
      return scale(d.tokenIndex);
    })
    .attr('y', '0')
    .attr('fill', function (d) {
      return d.found ? '#a22c2e' : '#f0f0f4';
    });
}

function update () {

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
