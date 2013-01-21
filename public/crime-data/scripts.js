var SORT_ORDER_VALUE = 1;
var SORT_ORDER_NAME = 2;

var DATA_SOURCE_2010 = 1;
var DATA_SOURCE_2011 = 2;
var DATA_SOURCE_2010_VS_2011 = 3;

var DATA_TYPE_OFFENSES = 1;
var DATA_TYPE_ARRESTS = 2;
var DATA_TYPE_OFFENSES_VS_ARRESTS = 3;

var DATA_NOT_AVAILABLE = -1;

var LABEL_WIDTH = 200;
var VALUE_WIDTH = 50;
var BAR_HEIGHT = 22;
var BAR_PADDING = 2;
var LABEL_OFFSET = 5;

var DURATION_TIME = 500;

var dataSource = DATA_SOURCE_2011;
var sortOrder = SORT_ORDER_VALUE;
var dataType = DATA_TYPE_ARRESTS;
var chartCount = 2;

var loadedData;
var absoluteMaximum;
var dataLabels;
var simpleDataLabels;

var globalWidth;
var chartWidth;

var chart;
var chartScale;

var currentData;
var currentSecondaryData;
var currentDataOrdering;

function toTitleCase(text) {
  return text.replace(/\w\S*/g, function(text) {
      return text.charAt(0).toUpperCase() + text.substr(1).toLowerCase();
  });
}

function formatValue(val) {
  if (val == DATA_NOT_AVAILABLE) {
    return 'n/a'; 
  } else {
    return val;
  }
}

function calculateDataOrder() { 
  currentDataOrdering = [];
  for (var i = 0; i < currentData.length; i++) {
    currentDataOrdering.push(i);
  }

  switch (sortOrder) {
    case SORT_ORDER_VALUE:
      currentDataOrdering.sort(function(a, b) {
        return currentData[b] - currentData[a];
      });
      break;
    case SORT_ORDER_NAME:
      currentDataOrdering.sort(function(a, b) {
        return (simpleDataLabels[a] > simpleDataLabels[b]) ? 1 : ((simpleDataLabels[b] > simpleDataLabels[a]) ? -1 : 0);
      });
      break;
  }
}

function getData(dataType, dataSource) {
  switch (dataType) {
    case DATA_TYPE_ARRESTS:
      var dataTypeField = 'arrestOffensesByYear';
      break;
    case DATA_TYPE_OFFENSES:
      var dataTypeField = 'offensesByYear';
      break;
  }
  switch (dataSource) {
    case DATA_SOURCE_2010:
      var dataSourceField = '2010';
      break;
    case DATA_SOURCE_2011:
      var dataSourceField = '2011';
      break;
  }

  var data = [];
  for (var i in dataLabels) {
    var label = dataLabels[i];

    data.push(loadedData[dataTypeField][dataSourceField][label.part][label.label]);
  }
  return data;
}

function prepareData() {
  if (dataSource == DATA_SOURCE_2010_VS_2011) {
    currentData = getData(dataType, DATA_SOURCE_2011);
    currentSecondaryData = getData(dataType, DATA_SOURCE_2010);
    chartCount = 2;
  } else if (dataType == DATA_TYPE_OFFENSES_VS_ARRESTS) {
    currentData = getData(DATA_TYPE_ARRESTS, dataSource);
    currentSecondaryData = getData(DATA_TYPE_OFFENSES, dataSource);
    chartCount = 2;
  } else {
    currentData = getData(dataType, dataSource);
    currentSecondaryData = currentData;
    chartCount = 1;
  }
}

function fillInTheBlanks() {
  var dataTypes = ['offensesByYear', 'arrestOffensesByYear'];
  var dataSources = ['2010', '2011'];

  for (var j in dataTypes) {
    for (var k in dataSources) {
      for (var label in dataLabels) {
        if (typeof loadedData[dataTypes[j]][dataSources[k]][dataLabels[label].part][label] == 'undefined') {
          loadedData[dataTypes[j]][dataSources[k]][dataLabels[label].part][label] = DATA_NOT_AVAILABLE;
        }
      }
    }
  }
}

function findAbsoluteMaximum() {
  absoluteMaximum = 0;
  for (var i in loadedData) {
    for (var j in loadedData[i]) {
      for (var k in loadedData[i][j]) {
        for (var l in loadedData[i][j][k]) {
          var val = loadedData[i][j][k][l];

          if (val > absoluteMaximum) {
            absoluteMaximum = val;
          }
        }
      }
    }
  }
}

function analyzeData() {
  putTogetherLabels();
  fillInTheBlanks();
  findAbsoluteMaximum();
}

function calculateChartWidth() {
  globalWidth = document.querySelector('#chart').offsetWidth;

  switch (chartCount) {
    case 1:
      chartWidth = globalWidth - LABEL_WIDTH - VALUE_WIDTH;
      break;
    case 2:
      chartWidth = (globalWidth - LABEL_WIDTH - VALUE_WIDTH * 2) / 2;
      break;
  }

  chartScale = function(d) {
    if (d == DATA_NOT_AVAILABLE) {
      d = 0;
    }
    return d3.scale.linear()
      .domain([0, absoluteMaximum])
      .range([0, chartWidth])(d);
  }
}

function putTogetherLabels() {
  dataLabels = {};

  var dataTypes = ['offensesByYear', 'arrestOffensesByYear'];
  var dataSources = ['2010', '2011'];
  var parts = ['part1', 'part2'];

  for (var j in dataTypes) {
    for (var k in dataSources) {
      for (var l in parts) {
        for (var label in loadedData[dataTypes[j]][dataSources[k]][parts[l]]) {
          dataLabels[label] = { label: label, part: parts[l] };
        }
      }
    }
  }

  simpleDataLabels = [];

  for (var label in dataLabels) {
    simpleDataLabels.push(label);
  }
}

function createChart() {
  calculateChartWidth();

  chart = d3.select('#chart').append('svg')
      .attr('class', 'chart')
      .attr('width', globalWidth)
      .attr('height', (BAR_HEIGHT + BAR_PADDING) * simpleDataLabels.length);

  prepareData();
  calculateDataOrder();

  // Label

  chart.selectAll('text.label')
      .data(simpleDataLabels)
      .enter().append('text')
      .attr('class', 'label')
      .attr('y', function(d, i) { return currentDataOrdering.indexOf(i) * (BAR_HEIGHT + BAR_PADDING) - 5; })
      .attr('dy', BAR_HEIGHT)
      .text(toTitleCase);

  // Chart

  for (chartNo = 1; chartNo <= 2; chartNo++) {
    var data = (chartNo == 2) ? currentData : currentSecondaryData;

    chart.selectAll('rect.rect.chart' + chartNo)
        .data(data)
        .enter().append('rect')
        .attr('class', 'rect chart' + chartNo)
        .attr('height', BAR_HEIGHT);

    chart.selectAll('text.value.chart' + chartNo)
        .data(data)
        .enter().append('text')
        .attr('class', 'value chart' + chartNo)
        .attr('dy', BAR_HEIGHT)
        .text(formatValue); 
  }
}

function changeDataSource(newDataSource) {
  dataSource = newDataSource;

  if ((dataType == DATA_TYPE_OFFENSES_VS_ARRESTS) && 
      (dataSource == DATA_SOURCE_2010_VS_2011)) {
    dataType = DATA_TYPE_OFFENSES;
  }

  updateChart(true);
}

function changeSortOrder(newSortOrder) {
  sortOrder = newSortOrder;
  updateChart(true);
}

function changeDataType(newDataType) {
  dataType = newDataType;

  if ((dataType == DATA_TYPE_OFFENSES_VS_ARRESTS) && 
      (dataSource == DATA_SOURCE_2010_VS_2011)) {
    dataSource = DATA_SOURCE_2011;
  }

  updateChart(true);
}

function updateChart(animate) {
  prepareData();
  calculateChartWidth();
  calculateDataOrder();

  var time = animate ? DURATION_TIME : 0;

  // Label

  switch (chartCount) {
    case 1:
      var x = 0;
      break;
    case 2:
      var x = chartWidth + VALUE_WIDTH;
      break;
  }

  chart.selectAll('text.label')
      .data(currentData)
      .transition()
      .duration(time)
      .attr('x', x)
      .attr('y', function(d, i) { return currentDataOrdering.indexOf(i) * (BAR_HEIGHT + BAR_PADDING) - 5; })
      .attr('dx', function() {
        switch (chartCount) {
          case 1:
            // Right-aligned
            return LABEL_WIDTH - LABEL_OFFSET - this.getBBox().width;
            break;
          case 2:
            // Centered
            return (LABEL_WIDTH - this.getBBox().width) / 2;
            break;
        }
      });      

  // Chart

  for (chartNo = 1; chartNo <= 2; chartNo++) {
    var data = (chartNo == 2) ? currentData : currentSecondaryData;

    switch (chartCount) {
      case 1:
        var x = (chartNo == 1) ? (-chartWidth - LABEL_WIDTH) : LABEL_WIDTH;
        break;
      case 2:
        var x = (chartNo == 1) ? 0 : chartWidth + LABEL_WIDTH + VALUE_WIDTH;
        break;
    }

    chart.selectAll('rect.rect.chart' + chartNo)
        .data(data)
        .transition()
        .duration(time)
        .attr('width', chartScale)
        .attr('x', function(d) { 
          if (chartNo == 1) {
            return x + VALUE_WIDTH + chartWidth - chartScale(d); 
          } else {
            return x;
          }
        })
        .attr('y', function(d, i) { return currentDataOrdering.indexOf(i) * (BAR_HEIGHT + BAR_PADDING); });

    chart.selectAll('text.value.chart' + chartNo)
        .data(data)
        .transition()
        .duration(time)
        .attr('x', function(d) {
          if (chartNo == 1) {
            return x + chartWidth - chartScale(d);
          } else {
            return x + chartScale(d);
          }
        })
        .attr('y', function(d, i) { return currentDataOrdering.indexOf(i) * (BAR_HEIGHT + BAR_PADDING) - 5; })
        .attr('dx', function() {
          switch (chartNo) {
            case 2:
              // Left-aligned
              return LABEL_OFFSET;
              break;
            case 1:
              // Right-aligned
              return VALUE_WIDTH - LABEL_OFFSET - this.getBBox().width;
              break;
          }
        })
        .tween('text', function(d, i, a) {
          // TODO(mwichary): Must be a better way to do this.

          var initValue = parseInt(this.textContent);
          if (isNaN(initValue)) {
            initValue = DATA_NOT_AVAILABLE;
          }
          var i = d3.interpolateNumber(initValue, d);
          return function(t) {
            this.textContent = formatValue(parseInt(i(t)));
          };
        });
  }
}

function onResize() {
  calculateChartWidth();
  updateChart(false);
}

function dataLoaded(error, data) {
  loadedData = data;

  window.addEventListener('resize', onResize, false);

  analyzeData();
  createChart();
  updateChart(false);
}

function loadData() {
  queue()
      .defer(d3.json, 'data.json')
      .await(dataLoaded);  
}

function main() {
  loadData();
}