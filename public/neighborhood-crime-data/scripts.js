/*
 * Neighborhood Crime Data for Louisville, KY
 *
 * Front-end (mostly) by Marcin Wichary, Code for America fellow in 2013.
 *
 * Note: This code is really gnarly. It’s been done under a lot of time 
 * pressure and there’s a lot of shortcut and tech debt. It might be improved
 * later if there’s time later.
 */

// Enums

var MODE_NORMAL = 1;
var MODE_HEATMAP = 2;
var MODE_HEATMAP_3D = 3;

var TAB_VIEW = 'view';
var TAB_SUBSCRIBE = 'subscribe';

var FILTER_CRIME = 0;
var FILTER_NEIGHBORHOOD = 1;

var FILTERS = [
  {
    name: 'Crime types',
    choices: [
      { title: 'Total crime',
        choices: [
          { title: 'Property crime',
            choices: [
              { title: 'Auto theft' },
              { title: 'Theft' },
              { title: 'Vandalism' },
            ]
          },
          { title: 'Violent crime',
            choices: [
              { title: 'Aggravated assault' },
              { title: 'Burglary' },
              { title: 'Homicide' },
              { title: 'Robbery' },
              { title: 'Simple assault' },
            ]
          },
        ]
      }
    ]
  },
  {
    name: 'Neighborhoods',
    choices: [
      { title: 'All neighborhoods',
        choices: [
          // Neighborhoods will go in here
        ]
      }
    ]
  }
];

var MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June', 'July', 
    'August', 'September', 'October', 'November', 'December'];
    
// Constants

var CHART_WIDTH = 50;

var MAP_VERT_PADDING = 50;

var DATA_TRANSITION_DELAY = 150;

var HEATMAP_3D_BUMP_TEXTURE_SIZE = 256;
var HEATMAP_3D_TEXTURE_SIZE = 512;

// Variables

var mode = MODE_NORMAL;
var tab = TAB_VIEW;

// data without any filters
var unfilteredData = [];
var cachedRawData = [];

var currentData = [];

var filters = [];

var heatmap3dPrepared = false;
var mapReady = false;

function createSidebar() {
  createViewSidebar();
  createSubscribeSidebar();
}

function createViewSidebar() {
  for (var i in filters) {
    var filter = filters[i];

    // TODO put elsewhere
    if (i == 1) {
      var el = document.createElement('ol');

      // Nasty hack
      if ((mode == MODE_HEATMAP) || (mode == MODE_HEATMAP_3D)) {
        el.style.display = 'none';
      }
    } else {
      var el = document.createElement('ul');
    }

    el.classList.add('list');
    el.setAttribute('filterNumber', i);

    for (var j in filter.choices) {
      var liEl = document.createElement('li');
      liEl.innerHTML = 
          '<span class="name">' + filter.choices[j].title + '</span>' +
          '<span class="value"></span>' +
          '<span class="chart"></span>';

      liEl.setAttribute('level', filter.choices[j].level);

      liEl.setAttribute('choiceNumber', filter.choices[j].choiceNumber);

      liEl.addEventListener('click', onFilterClick, false);
      liEl.addEventListener('mousedown', onFilterMouseDown, false);

      el.appendChild(liEl);
    }

    document.querySelector('body > nav.sidebar > section[tab="view"]').appendChild(el);
  }
}

function updateNeighborhoodSubscriptions() {
  var els = document.querySelectorAll('nav.sidebar > [tab="subscribe"] input:checked');

  if (els.length) {
    for (var i = 0, el; el = els[i]; i++) {
      highlightSubscribeNeighborhood(el.getAttribute('name'), true);
    }
  } else {
    // Pre-select a neighborhood for subscription if no subscriptions have been
    // previously selected, and a neighborhood was selected in the view tab.

    if (filters[FILTER_NEIGHBORHOOD].selected > 0) {
      var name = filters[FILTER_NEIGHBORHOOD].choices[filters[FILTER_NEIGHBORHOOD].selected].title;

      highlightSubscribeNeighborhood(name, true);
    }
  }
}

function updateNeighborhoodSubscriptionNav() {
  var subscriptionCount = document.querySelectorAll('#map-checkbox-overlay input:checked').length;

  var readyToGo = true;

  if (subscriptionCount == 0) {
    readyToGo = false;
  } else if (document.querySelectorAll('nav.sidebar > [tab="subscribe"] :invalid').length > 0) {
    readyToGo = false;
  }

  //console.log(readyToGo);

  document.querySelector('nav.sidebar > [tab="subscribe"] .subscribe').disabled = 
      !readyToGo;
}

function onNeighborhoodSubscribeMouseDown(event) {
  event.preventDefault();
}

function highlightSubscribeNeighborhood(name, subscribed) {
  document.querySelector('#map-checkbox-overlay input[name="' + name + '"]').checked = subscribed;

  var sidebarEl = document.querySelector('nav.sidebar > [tab="subscribe"] input[name="' + name + '"]');
  sidebarEl.checked = subscribed;
  if (subscribed) {
    sidebarEl.parentNode.classList.add('selected');
  } else {
    sidebarEl.parentNode.classList.remove('selected');
  }

  var mapEl = document.querySelector('#svg-container .neighborhood[name="' + name + '"]');
  if (subscribed) {
    mapEl.classList.add('subscribed');
    mapEl.classList.remove('unsubscribed');
  } else {
    mapEl.classList.add('unsubscribed');
    mapEl.classList.remove('subscribed');
  }
}

function onNeighborhoodSubscribeClick(event) {
  var el = event.target;

  if (el.tagName == 'LI') {
    el = el.querySelector('input[type="checkbox"]');
    el.checked = !el.checked;
  } else if (el.tagName != 'INPUT') {
    el = el.parentNode.querySelector('input[type="checkbox"]');
    el.checked = !el.checked;
  }

  var subscribed = el.checked;

  var name = el.getAttribute('name');

  highlightSubscribeNeighborhood(name, subscribed);

  updateNeighborhoodSubscriptionNav();
}

function receiveSubscriptionRequest(success, httpRequest) {
  if (success) {
    alert('You are now subscribed to our weekly email.')
    //console.log('OKAY!');
  } else {
    alert('We’re sorry, but something went wrong with your subscription. Please try again!');
    //console.log('Error: ' + httpRequest.status);
  }
}

function sendSubscriptionRequest() {
  var email = document.querySelector('nav.sidebar > [tab="subscribe"] .email').value;

  var els = document.querySelectorAll('#map-checkbox-overlay input:checked');

  var data = {
    neighborhoods: []
  };

  for (var i = 0; el = els[i]; i++) {
    data.neighborhoods.push(el.name);
  }

  makeAjaxRequest(
      'POST', 
      '/api/v1/user/' + email + '/subscriptions', 
      JSON.stringify(data),
      receiveSubscriptionRequest);
}

function createSubscribeSidebar() {
  var el = document.createElement('ul');
  el.classList.add('list');

  var filter = filters[FILTER_NEIGHBORHOOD];

  for (var j in filter.choices) {
    if (j == 0) {
      continue;
    }

    var liEl = document.createElement('li');
    liEl.innerHTML = 
        '<input type="checkbox">' +
        '<span class="name">' + filter.choices[j].title + '</span>';

    liEl.classList.add('active');
    liEl.setAttribute('level', filter.choices[j].level);

    liEl.querySelector('input').setAttribute('name', filter.choices[j].title);

    liEl.addEventListener('click', onNeighborhoodSubscribeClick, false);
    liEl.addEventListener('mousedown', onNeighborhoodSubscribeMouseDown, false);

    //liEl.setAttribute('choiceNumber', filter.choices[j].choiceNumber);

    //liEl.addEventListener('click', onFilterClick, false);
    //liEl.addEventListener('mousedown', onFilterMouseDown, false);

    el.appendChild(liEl);
  }

  document.querySelector('body > nav.sidebar > section[tab="subscribe"] .subscriptions').appendChild(el);
}


function onFilterMouseDown(event) {
  event.preventDefault();
}

function onFilterClick(event) {
  var el = event.target;

  while (el.tagName != 'LI') {
    el = el.parentNode;
  }

  var ulEl = el.parentNode;

  var filterNumber = parseInt(ulEl.getAttribute('filterNumber'));
  var choiceNumber = parseInt(el.getAttribute('choiceNumber'));

  filters[filterNumber].selected = choiceNumber;

  updateData();
}

function formatNumber(number) {
  if (number == 0) {
    return '<span class="zero">0</span>';
  } else {
    return number.toString().replace(/\d(?=(?:\d{3})+(?!\d))/g, '$&,');
  }
}

function cleanUpSidebar() {
  var els = document.querySelectorAll('body > nav.sidebar > [tab="view"] li');
  for (var i = 0, el; el = els[i]; i++) {
    el.classList.remove('selected');
    el.classList.remove('active');
  }
}

function updateSidebar() {
  cleanUpSidebar();

  for (var i in filters) {
    // Gray out things

    var el = document.querySelector(
        'body > nav.sidebar > [tab="view"] .list[filterNumber="' + 
        (parseInt(i)) + '"] > li[choiceNumber="' + 
        (filters[i].selected) + '"]');
    el.classList.add('selected');
    el.classList.add('active');

    var nextEl = el.nextSibling;
    while (nextEl && (nextEl.getAttribute('level') > el.getAttribute('level'))) {
      nextEl.classList.add('active');
      nextEl = nextEl.nextSibling;
    }

    // Show data and determine maximum value

    var max = 0;

    for (var j in filters[i].choices) {
      var el = document.querySelector(
          'body > nav.sidebar > [tab="view"] .list[filterNumber="' + 
          (parseInt(i)) + '"] > li[choiceNumber="' + 
          (filters[i].choices[j].choiceNumber) + '"] > .value');

      if (el.parentNode.classList.contains('active')) {
        var val = currentData[i][j];
      } else {
        var val = unfilteredData[i][i][j];        
      }

      el.parentNode.value = parseFloat(val);
      el.innerHTML = formatNumber(val);

      if ((val > max) && ((parseInt(j) != 0) || (parseInt(i) == 0))) {
        max = val;
      }
    }

    // Display chart

    for (var j in filters[i].choices) {
      var el = document.querySelector(
          'body > nav.sidebar > [tab="view"] .list[filterNumber="' + 
          (parseInt(i)) + '"] > li[choiceNumber="' + 
          (filters[i].choices[j].choiceNumber) + '"] > .chart');

      el.style.width = ((el.parentNode.value / max) * CHART_WIDTH) + 'px';
    }

    // Re-sort neighborhoods based on values
    // TODO: Could this be D3’s responsibility somehow?

    if (i == 1) {
      var els = [];

      for (var j in filters[i].choices) {
        var el = document.querySelector(
            'body > nav.sidebar > [tab="view"] .list[filterNumber="' + 
            (parseInt(i)) + '"] > li[choiceNumber="' + 
            (filters[i].choices[j].choiceNumber) + '"]');

        els.push(el);
      }

      els.sort(function(a, b) { return b.value - a.value });

      for (var j in els) {
        var el = els[j];
        document.querySelector(
            'body > nav.sidebar > [tab="view"] .list[filterNumber="' + 
            (parseInt(i)) + '"]').appendChild(el);
      }
    }
  }
}

function updateData() {
  loadIncidents();
}

function updateCaption() {
  document.querySelector('#caption-crime').innerHTML =
    filters[FILTER_CRIME].choices[filters[FILTER_CRIME].selected].title;

  document.querySelector('#caption-neighborhood').innerHTML =
    filters[FILTER_NEIGHBORHOOD].choices[filters[FILTER_NEIGHBORHOOD].selected].title;
}

function addChoices(origData, flatData, level) {
  for (var j in origData) {
    var newEntry = {
      title: origData[j].title,
      choiceNumber: null,
      filterList: null,
      level: level
    };

    flatData.push(newEntry);

    if (origData[j].choices) {
      addChoices(origData[j].choices, flatData, level + 1);
    }
  }
}

function prepareFilters() {
  filters = [];

  for (var i in FILTERS) {
    filters[i] = {};
    filters[i].selected = 0;
    filters[i].choices = [];
  
    addChoices(FILTERS[i].choices, filters[i].choices, 0);

    var maxLevel = 0;
    for (var j in filters[i].choices) {
      if (filters[i].choices[j].level > maxLevel) {
        maxLevel = filters[i].choices[j].level;
      }
    }

    var realChoiceNumber = 0;
    for (var j in filters[i].choices) {
      if (filters[i].choices[j].level < maxLevel) {
        filters[i].choices[j].choiceNumber = realChoiceNumber;
        filters[i].choices[j].filterList = [];
      } else {
        filters[i].choices[j].choiceNumber = realChoiceNumber;
        filters[i].choices[j].filterList = [realChoiceNumber];

        var k = parseInt(j) - 1;
        var level = filters[i].choices[j].level - 1;
        while (k >= 0) {
          if (filters[i].choices[k].level == level) {
            filters[i].choices[k].filterList.push(parseInt(j));
            level--;
          }
          k--;
        }
      }
      realChoiceNumber++;

    }
  }  
}

function calculateMapSize() {
  minLat = 99999999;
  maxLat = -99999999;
  minLon = 99999999;
  maxLon = -99999999;

  for (var i in mapData.features) {
    for (var j in mapData.features[i].geometry.coordinates[0]) {
      for (var k in mapData.features[i].geometry.coordinates[0][j]) {
        var lon = mapData.features[i].geometry.coordinates[0][j][k][0];
        var lat = mapData.features[i].geometry.coordinates[0][j][k][1];

        if (lat > maxLat) {
          maxLat = lat;
        }
        if (lat < minLat) {
          minLat = lat;
        }
        if (lon > maxLon) {
          maxLon = lon;
        }
        if (lon < minLon) {
          minLon = lon;
        }
      }
    }
  }

  // TODO no global variables
  centerLat = (minLat + maxLat) / 2;
  centerLon = (minLon + maxLon) / 2;

  latSpread = maxLat - minLat;
  lonSpread = maxLon - minLon;

  // TODO get from the map itself
  // At scale 250.000
  var mapWidth = 1507 / 2500000;
  var mapHeight = 1196 / 2500000;


  switch (mode) {
    case MODE_NORMAL:
    case MODE_HEATMAP:
      // TODO better const
      canvasWidth = document.querySelector('#svg-container').offsetWidth;
      canvasHeight = document.querySelector('#svg-container').offsetHeight;
      break;
    case MODE_HEATMAP_3D:
      canvasWidth = HEATMAP_3D_BUMP_TEXTURE_SIZE;
      canvasHeight = HEATMAP_3D_BUMP_TEXTURE_SIZE;
      break;
  }

  desiredWidth = canvasWidth;
  desiredHeight = canvasWidth / mapWidth * mapHeight;

  if (desiredHeight > canvasHeight) {
    desiredHeight = canvasHeight;
    desiredWidth = canvasHeight / mapHeight * mapWidth;
  }


  // TODO const
  var scale = desiredWidth / mapWidth;// * .95;
  // TODO not top-level variable
  globalScale = scale;

  // TODO get lat/long from the map itself
  mapPath = d3.geo.path().projection(
      d3.geo.mercator().center([centerLon, centerLat]).
      scale(globalScale).translate([canvasWidth / 2, canvasHeight / 2]));
}

function prepareMap() {
  calculateMapSize();

  mapSvg = d3.select('#svg-container').append('svg')
      .attr('width', canvasWidth)
      .attr('height', canvasHeight);    
}

function switchToNeighborhood(newName) {
  var neighborhood = 0;

  for (var i = 1; i < filters[FILTER_NEIGHBORHOOD].choices.length; i++) {
    if (filters[FILTER_NEIGHBORHOOD].choices[i].title == newName) {
      neighborhood = i;
      break;
    }
  }

  if (filters[FILTER_NEIGHBORHOOD].selected == neighborhood) {
    filters[FILTER_NEIGHBORHOOD].selected = 0;
  } else {
    filters[FILTER_NEIGHBORHOOD].selected = neighborhood;
  }

  updateData();  
}

function mapIsReady(error, us) {
  mapReady = true;

  if (mode == MODE_HEATMAP_3D) {
    return;
  }

  mapSvg
    .selectAll('path')
    .data(mapData.features)
    .enter()
    .append('path')
    .attr('d', mapPath)
    .attr('class', 'neighborhood')
    .attr('name', function(d) { return d.properties.name; })
    .on('click', function() {
      switchToNeighborhood(this.getAttribute('name'));
    })
    .on('mouseover', function(d) {
      // TODO make a function
      var el = d3.event.target || d3.event.toElement;

      var chartMax = document.querySelector('#legend-max').value;

      //console.log(d);

      var val = parseInt(el.getAttribute('value'));

      document.querySelector('#legend-hover .name').innerHTML = d.properties.name;
      document.querySelector('#legend-hover .value').innerHTML = formatNumber(val);

      var offset = (val / chartMax) * document.querySelector('#legend-graph').offsetWidth;
      document.querySelector('#legend-hover').style.left = offset + 'px';

      document.querySelector('#legend-hover').classList.add('visible');  

    })
    .on('mouseout', function(d) {
      document.querySelector('#legend-hover').classList.remove('visible');  
    });
}

function updateMap() {
  if (!mapReady) {
    return;
  }

  var max = 0;
  var map = {};
  for (var i = 1; i < filters[FILTER_NEIGHBORHOOD].choices.length; i++) {
    if (max < unfilteredData[1][1][i]) {
      max = unfilteredData[1][1][i];
    }

    map[filters[FILTER_NEIGHBORHOOD].choices[i].title] = i;
  }

  document.querySelector('#legend-max').innerHTML = formatNumber(max);
  document.querySelector('#legend-max').value = max;

  var quantize = d3.scale.quantize()
    .domain([0, max])
    .range(d3.range(9).map(function(i) { return 'q' + i; }));

  switch (mode) {
    case MODE_NORMAL:
      switch (tab) {
        case TAB_VIEW:
          mapSvg.selectAll('path')
              .attr('class', function(d) { return 'neighborhood ' + quantize(unfilteredData[1][1][map[d.properties.name]]); })
          break;
        case TAB_SUBSCRIBE:
          mapSvg.selectAll('path').attr('class', 'neighborhood unsubscribed');
          break;
      }
      break;
    case MODE_HEATMAP:
      mapSvg.selectAll('path').attr('class', 'neighborhood hollow');
      break;
    case MODE_HEATMAP_3D:
      return;
      break;
  }

  mapSvg.selectAll('path')
    .attr('value', function(d) { return unfilteredData[1][1][map[d.properties.name]]; })

  for (var i = 1; i < filters[FILTER_NEIGHBORHOOD].choices.length; i++) {
    var el = document.querySelector(
      'body > nav.sidebar .list[filterNumber="' + 
      1 + '"] > li[choiceNumber="' + 
      (filters[FILTER_NEIGHBORHOOD].choices[i].choiceNumber) + '"] > .chart');

    // TODO change to do attr
    for (var j = 0; j < 9; j++) {
      el.classList.remove('q' + j);
    }
    el.classList.add(quantize(el.parentNode.value));
  } 

  // TODO change to a class
  if (filters[FILTER_NEIGHBORHOOD].selected == 0) {
    mapSvg.selectAll('path')
      .transition().duration(DATA_TRANSITION_DELAY)
      .attr('opacity', 1);
  } else {
    mapSvg.selectAll('path')
      .transition().duration(DATA_TRANSITION_DELAY)
      .attr('opacity', function(d) { 
        return (filters[FILTER_NEIGHBORHOOD].choices[filters[FILTER_NEIGHBORHOOD].selected].title == d.properties.name) ? 1 : .4
    });
  }
}

function addNeighborhoodsToFilters(mapData) {
  var neighborhoods = [];

  for (var i in mapData.features) {
    neighborhoods.push(mapData.features[i].properties.name);
  }

  neighborhoods.sort();

  // TODO modifying const
  // TODO hardcoded numbers
  for (var i in neighborhoods) {
    FILTERS[FILTER_NEIGHBORHOOD].choices[0].choices.push({ title: neighborhoods[i] });
  }
}

function formatDateAsString(date) {
  return MONTHS[date.getMonth()] + ' ' + date.getDate();
}

function updateDateRange(dateRange) {
  var dateStart = new Date(dateRange.start * 1000);
  var dateEnd = new Date(dateRange.end * 1000);

  document.querySelector('#caption-daterange').innerHTML = 
      formatDateAsString(dateStart) + '–' + formatDateAsString(dateEnd);
}

function incidentsLoaded(error) {
  console.log('Incidents loaded…');

  for (var i = 1; i < arguments.length; i++) {
    var data = arguments[i];

    var crime = data.query.filters.crime || '';
    var neighborhood = data.query.filters.neighborhood || '';

    // TODO cachedRawData necessary?
    if (!cachedRawData[crime]) {
      cachedRawData[crime] = [];
    }
    cachedRawData[crime][neighborhood] = data;

    processData(crime, neighborhood, data);

    updateDateRange(data.dateRange);
  }

  updateSidebar();

  window.setTimeout(function() {
    updateCaption();
    updateMap();
  }, 0);

  window.setTimeout(function() {
    updateHeatmap();
  }, 0);
}

function processData(crime, neighborhood, loadedData) {
  //console.log('Processing', 'c:' + crime, 'n:' + neighborhood);
  //loadedData = data;

  data = [];

  data[FILTER_CRIME] = [];
  data[FILTER_NEIGHBORHOOD] = [];  

  for (var i in filters[FILTER_CRIME].choices) {
    data[FILTER_CRIME][filters[FILTER_CRIME].choices[parseInt(i)].choiceNumber] = 0;

    var choice = filters[FILTER_CRIME].choices[i];

    for (var ii in choice.filterList) {
      var title = filters[FILTER_CRIME].choices[choice.filterList[ii]].title;
      title = title.toUpperCase();

      data[FILTER_CRIME][filters[FILTER_CRIME].choices[parseInt(i)].choiceNumber] += 
          loadedData.byCrime[title] || 0;
    }
  }

  for (var j in filters[FILTER_NEIGHBORHOOD].choices) {
    data[FILTER_NEIGHBORHOOD][filters[FILTER_NEIGHBORHOOD].choices[parseInt(j)].choiceNumber] = 0;

    var choice = filters[FILTER_NEIGHBORHOOD].choices[j];

    for (var jj in choice.filterList) {
      var title = filters[FILTER_NEIGHBORHOOD].choices[choice.filterList[jj]].title;
      
      data[FILTER_NEIGHBORHOOD][filters[FILTER_NEIGHBORHOOD].choices[parseInt(j)].choiceNumber] += 
          loadedData.byNeighborhood[title] || 0;
    }
  }

  // TODO actually compare crime and neighborhood strings to numbers
  // and allocate properly
  if (crime == '') {
    //console.log('allocated unfiltered data 0 (crime)');
    unfilteredData[FILTER_CRIME] = data;
  }

  if (neighborhood == '') {
    //console.log('allocated unfiltered data 1 (n)');
    unfilteredData[FILTER_NEIGHBORHOOD] = data;
  }

  if ( ((crime != '') || (filters[FILTER_CRIME].selected == 0)) &&
       ((neighborhood != '') || (filters[FILTER_NEIGHBORHOOD].selected == 0)) ) {
    //console.log('allocated proper data');
    currentData = data;
  }
}

function getIncidentDataUrl(crimeId, neighborhoodId) {
  if (crimeId == 0) {
    var crime = '';
  } else {
    var crimeList = [];
    for (var i in filters[FILTER_CRIME].choices[crimeId].filterList) {
      crimeList.push(filters[FILTER_CRIME].choices[filters[FILTER_CRIME].choices[crimeId].filterList[i]].title);
    }
    var crime = crimeList.join(',').toUpperCase();
  }

  if (neighborhoodId == 0) {
    var neighborhood = '';
  } else {
    var neighborhood = filters[FILTER_NEIGHBORHOOD].choices[neighborhoodId].title;
  }

  // TODO remove random when you do caching properly
  var url = '/api/v1/incidents-summary?neighborhood=' + encodeURI(neighborhood) + 
      '&crime=' + encodeURI(crime) + '&rand=' + Math.random();

  return url;
}

function loadIncidents() {
  var urls = [];
  urls.push(getIncidentDataUrl(filters[FILTER_CRIME].selected, filters[FILTER_NEIGHBORHOOD].selected));
  urls.push(getIncidentDataUrl(0, filters[FILTER_NEIGHBORHOOD].selected));
  urls.push(getIncidentDataUrl(filters[FILTER_CRIME].selected, 0));

  var q = queue();
  for (var i in urls) {
    q.defer(d3.json, urls[i]);
    console.log('Loading incidents…', urls[i]);
  }
  q.await(incidentsLoaded);
}

function prepareMapCheckboxes() {
  for (var j in filters[FILTER_NEIGHBORHOOD].choices) {
    if (j == 0) { // Skip all neighborhoods
      continue;
    }

    var name = filters[FILTER_NEIGHBORHOOD].choices[j].title;

    var el = document.createElement('input');
    el.setAttribute('type', 'checkbox');
    el.setAttribute('name', name);
    document.querySelector('#map-checkbox-overlay').appendChild(el);

    el.addEventListener('click', onNeighborhoodSubscribeClick, false);
  }
}

function resizeMapCheckboxes() {
  for (var j in filters[FILTER_NEIGHBORHOOD].choices) {
    if (j == 0) { // Skip all neighborhoods
      continue;
    }

    var name = filters[FILTER_NEIGHBORHOOD].choices[j].title;

    var el = document.querySelector('#map-checkbox-overlay input[name="' + name + '"]');
    //el.style.outline = '1px solid red';

    var svgEl = document.querySelector('#svg-container .neighborhood[name="' + name + '"]');
    //console.log(name);
    //console.log(svgEl);

    var boundingBox = svgEl.getBBox();
    var x = boundingBox.x + boundingBox.width / 2;
    var y = boundingBox.y + boundingBox.height / 2;

    el.style.left = x + 'px';
    el.style.top = y + 'px';
  }
}

function getGoogleMapsUrl(lat, lon, zoom, scale, type) {
  var url = 'http://maps.googleapis.com/maps/api/staticmap' +
      '?center=' + lat + ',' + lon +
      '&zoom=' + zoom + '&size=640x640' +
      '&sensor=false&scale=' + scale + '&maptype=' + type + '&format=jpg';

  return url;
}

var MAP_OVERLAY_TILES_COUNT_X = 2;
var MAP_OVERLAY_TILES_COUNT_Y = 2;
var MAP_OVERLAY_OVERLAP_RATIO = .95;

function prepareMapOverlay() {
  var LAT_STEP = -.1725;
  var LONG_STEP = .2195;

  var lat = centerLat - LAT_STEP / 2;
  var lon = centerLon - LONG_STEP / 2;

  var pixelRatio = window.devicePixelRatio || 1;

  for (var x = 0; x < MAP_OVERLAY_TILES_COUNT_X; x++) {
    for (var y = 0; y < MAP_OVERLAY_TILES_COUNT_Y; y++) {
      var url = getGoogleMapsUrl(
          lat + y * LAT_STEP * MAP_OVERLAY_OVERLAP_RATIO, 
          lon + x * LONG_STEP * MAP_OVERLAY_OVERLAP_RATIO, 
          12, 
          pixelRatio, 
          'satellite');

      var imgEl = document.createElement('img');
      imgEl.src = url;

      document.querySelector('#google-maps-overlay').appendChild(imgEl);
    }
  }
}

function resizeMapOverlay() {
  var size = globalScale * 0.0012238683395795992;
  size = size * 0.995 / 2;

  switch (mode) {
    case MODE_NORMAL:
    case MODE_HEATMAP:
      var canvasWidth = document.querySelector('#map').offsetWidth;
      var canvasHeight = document.querySelector('#map').offsetHeight - MAP_VERT_PADDING * 2;

      var offsetX = canvasWidth / 2 - size;
      var offsetY = canvasHeight / 2 - size + 80;

      break;
    case MODE_HEATMAP_3D:
      var canvasWidth = HEATMAP_3D_BUMP_TEXTURE_SIZE;
      var canvasHeight = HEATMAP_3D_BUMP_TEXTURE_SIZE;
      
      var offsetX = canvasWidth / 2 - size;
      var offsetY = canvasHeight / 2 - size;

      break;
  }

  var els = document.querySelectorAll('#google-maps-overlay img');

  var elCount = 0;
  for (var x = 0; x < MAP_OVERLAY_TILES_COUNT_X; x++) {
    for (var y = 0; y < MAP_OVERLAY_TILES_COUNT_Y; y++) {
      var el = els[elCount];
      elCount++;

      el.style.width = size + 'px';
      el.style.height = size + 'px';

      el.style.left = (offsetX + size * x * MAP_OVERLAY_OVERLAP_RATIO) + 'px';
      el.style.top = (offsetY + size * y * MAP_OVERLAY_OVERLAP_RATIO) + 'px';
    }
  }
}

function copyMapOverlayToHeatmap3D() {
  //var canvasWidth = document.querySelector('#map').offsetWidth;
  //var canvasHeight = document.querySelector('#map').offsetHeight - MAP_VERT_PADDING * 2;

  var canvasWidth = HEATMAP_3D_BUMP_TEXTURE_SIZE;
  var canvasHeight = HEATMAP_3D_BUMP_TEXTURE_SIZE;

  var size = globalScale * 0.0012238683395795992;
  size = size * 0.995 / 2;

  var offsetX = canvasWidth / 2 - size;
  var offsetY = canvasHeight / 2 - size;

  //var moveX = 0;
  //var moveY = 0;
  
  var el = document.createElement('canvas');
  el.width = HEATMAP_3D_TEXTURE_SIZE;
  el.height = HEATMAP_3D_TEXTURE_SIZE;
  var ctx = el.getContext('2d');

  var scale = HEATMAP_3D_TEXTURE_SIZE / HEATMAP_3D_BUMP_TEXTURE_SIZE;

  globalCanvas = el;
  document.querySelector('#temp-texture-container').appendChild(el);

  var elCount = 0;
  var els = document.querySelectorAll('#google-maps-overlay img');
  for (var x = 0; x < MAP_OVERLAY_TILES_COUNT_X; x++) {
    for (var y = 0; y < MAP_OVERLAY_TILES_COUNT_Y; y++) {
      var el = els[elCount];
      elCount++;

      ctx.drawImage(el, 
          (offsetX + size * x * MAP_OVERLAY_OVERLAP_RATIO) * scale, 
          (offsetY + size * y * MAP_OVERLAY_OVERLAP_RATIO) * scale,
          size * scale, 
          size * scale);
    }
  }
}

function onResize() {
  calculateMapSize();
  resizeMapOverlay();

  if (mode == MODE_NORMAL) {
    resizeMapCheckboxes();
  }

  mapSvg.attr('width', canvasWidth);
  mapSvg.attr('height', canvasHeight);

  mapSvg
    .selectAll('path')
    .attr('d', mapPath);

  prepareHeatmap(); // in order to resize pixels etc.
  updateHeatmap();
}

function initialDataLoaded(error, mapDataLoaded) {
  // TODO don’t do global
  mapData = mapDataLoaded;

  addNeighborhoodsToFilters(mapDataLoaded);
  prepareFilters();

  createSidebar();

  updateData();

  // TODO consolidate
  prepareMap();
  mapIsReady();

  if (mode == MODE_NORMAL) {
    prepareMapCheckboxes();
    resizeMapCheckboxes();
    updateNeighborhoodSubscriptionNav();
  }

  prepareMapOverlay();
  resizeMapOverlay();  

  if ((mode == MODE_HEATMAP) || (mode == MODE_HEATMAP_3D)) {
    prepareHeatmap();
  }
}

function prepareHeatmap() {
  var el = document.querySelector('#heatmap-container');

  el.innerHTML = '';

  if (mode == MODE_HEATMAP_3D) {
    el.style.width = HEATMAP_3D_BUMP_TEXTURE_SIZE + 'px';
    el.style.height = HEATMAP_3D_BUMP_TEXTURE_SIZE + 'px';
  }
  
  var config = {
      element: el
  };

  switch (mode) {
    case MODE_HEATMAP:
      config.radius = desiredWidth / 50;
      config.opacity = 80;
      config.gradient = { 
          0.45: "rgb(0, 0, 255)", 
          0.55: "rgb(0, 255, 255)", 
          0.65: "rgb(0, 255, 0)", 
          0.95: "yellow", 
          1.00: "rgb(255, 0, 0)"
      };
      break; 
    case MODE_HEATMAP_3D:
      config.radius = HEATMAP_3D_BUMP_TEXTURE_SIZE / 50;
      config.opacity = 100;
      config.gradient = { 
          0.00: "black", 
          1.00: "white"
      };
      break;
  }
  heatmap = heatmapFactory.create(config);
}

function updateHeatmap() {
  if ((mode != MODE_HEATMAP) && (mode != MODE_HEATMAP_3D)) {
    return;
  }

  var crimeId = filters[FILTER_CRIME].selected;

  if (crimeId == 0) {
    var crime = '';
  } else {
    var crimeList = [];
    for (var i in filters[FILTER_CRIME].choices[crimeId].filterList) {
      crimeList.push(filters[FILTER_CRIME].choices[filters[FILTER_CRIME].choices[crimeId].filterList[i]].title);
    }
    var crime = crimeList.join(',').toUpperCase();
  }

  var url = '/api/v1/incidents?crime=' + encodeURI(crime) + '&rand=' + Math.random();

  var q = queue();
  q.defer(d3.json, url);
  q.await(heatmapDataLoaded);  
}

function heatmapDataLoaded(error, heatmapData) {
  var data = {
    max: 3,
    data: []
  };

  var offsetX = 0;
  var offsetY = 0;

  //if (mode == MODE_HEATMAP) {
    if (desiredHeight == canvasHeight) {
      var offsetX = (canvasWidth - desiredWidth) / 2;
    } else {
      var offsetY = (canvasHeight - desiredHeight) / 2;
    }

    var width = desiredWidth;
    var height = desiredHeight;
  /*} else if (mode == MODE_HEATMAP_3D) {
    if (desiredWidth > desiredHeight) {
      var width = HEATMAP_3D_BUMP_TEXTURE_SIZE - HEATMAP_3D_MARGIN * 2;
      var height = (HEATMAP_3D_BUMP_TEXTURE_SIZE - HEATMAP_3D_MARGIN * 2) / desiredWidth * desiredHeight;

      offsetX = HEATMAP_3D_MARGIN;
      offsetY = HEATMAP_3D_MARGIN + (HEATMAP_3D_BUMP_TEXTURE_SIZE - HEATMAP_3D_MARGIN * 2 - height) / 2;
    } else {
      var height = HEATMAP_3D_BUMP_TEXTURE_SIZE - HEATMAP_3D_MARGIN * 2;
      var width = (HEATMAP_3D_BUMP_TEXTURE_SIZE - HEATMAP_3D_MARGIN * 2) / desiredHeight * desiredWidth; 

      offsetX = HEATMAP_3D_MARGIN + (HEATMAP_3D_BUMP_TEXTURE_SIZE - HEATMAP_3D_MARGIN * 2 - width) / 2;
      offsetY = HEATMAP_3D_MARGIN;
    }

    //console.log(desiredWidth, desiredHeight);

    //var width = HEATMAP_3D_TEXTURE_SIZE;
    //var height = HEATMAP_3D_TEXTURE_SIZE;
  }*/

  //heatmapWidth = width;
  //heatmapHeight = height;

  for (var i in heatmapData.incidents.features) {
    var feature = heatmapData.incidents.features[i];

    var x = offsetX + ((feature.geometry.coordinates[0] - minLon) / lonSpread) * width;
    var y = offsetY + (1 - (feature.geometry.coordinates[1] - minLat) / latSpread) * height;

    data.data.push({ 
        x: x, 
        y: y,
        count: 1 
    });
  }
 
  heatmap.store.setDataSet(data);

  if (mode == MODE_HEATMAP_3D) {
    copyMapOverlayToHeatmap3D();
    prepareHeatmap3d();
  }
}

function prepareHeatmap3d() {
  /*if (!heatmap3dPrepared) */{
    heatmap3dPrepared = true;

    // get data from heatmap

    var el = document.querySelector('#heatmap-container > canvas');
    var ctx = el.getContext('2d');
    var imageData = ctx.getImageData(0, 0, 
        HEATMAP_3D_BUMP_TEXTURE_SIZE, HEATMAP_3D_BUMP_TEXTURE_SIZE);

    //var heightData = [];
    var heightData = new Float32Array(HEATMAP_3D_BUMP_TEXTURE_SIZE * HEATMAP_3D_BUMP_TEXTURE_SIZE);

    for (var x = 0; x < HEATMAP_3D_BUMP_TEXTURE_SIZE; x++) {
      for (var y = 0; y < HEATMAP_3D_BUMP_TEXTURE_SIZE; y++) {
        var pos = ((HEATMAP_3D_BUMP_TEXTURE_SIZE - y - 1) * HEATMAP_3D_BUMP_TEXTURE_SIZE + x) * 4;

        // include opacity
        var val = imageData.data[pos] * imageData.data[pos + 3];

        heightData[y * HEATMAP_3D_BUMP_TEXTURE_SIZE + x] = //Math.random() * 10;//x / 50;
          parseFloat(val) / 1000;
      }
    }

    //console.log(heightData);

    var max = -99999;
    var min = 99999;
    for (var i = 0; i < heightData.length; i++) {
      var data = heightData[i];

      if (data > max) { max = data; }
      if (data < min) { min = data; }
    }
    //console.log(i, min, max);

    heatmap3d.init(document.querySelector('#heatmap-3d-container'), heightData);
  }
}

function loadInitialData() {
  queue()
      .defer(d3.json, '/api/v1/neighborhoods')
      .await(initialDataLoaded);
}

function switchToTab(name) {
  tab = name;
  document.body.setAttribute('tab', tab);

  updateMap();

  switch (tab) {
    case 'subscribe':
      document.querySelector('nav.sidebar > [tab="subscribe"] .email').focus();

      updateNeighborhoodSubscriptions();
      updateNeighborhoodSubscriptionNav();
      break;
  }
}

function onTabClick(event) {
  switchToTab(event.target.getAttribute('name'));
}

function prepareUI() {
  for (var i = 0; i < 9; i++) {
    var el = document.createElement('div');
    el.classList.add('q' + i);
    document.querySelector('#legend-graph').appendChild(el);
  }

  var els = document.querySelectorAll('body > nav.tabs > div');
  for (var i = 0, el; el = els[i]; i++) {
    el.addEventListener('click', onTabClick, false);
  }

  document.querySelector('nav.sidebar > [tab="subscribe"] button.subscribe').
      addEventListener('click', sendSubscriptionRequest, false);

  document.querySelector('nav.sidebar > [tab="subscribe"] .email').
      addEventListener('input', updateNeighborhoodSubscriptionNav, false);
}

function main() {
  switchToTab('view');

  if (location.href.indexOf('heatmap-3d') != -1) {
    mode = MODE_HEATMAP_3D;
    document.body.setAttribute('mode', 'heatmap-3d');
  } else if (location.href.indexOf('heatmap') != -1) {
    mode = MODE_HEATMAP;
    document.body.setAttribute('mode', 'heatmap');
  }

  if (mode == MODE_NORMAL) {
    document.querySelector('#heatmap-container').style.display = 'none';
  }

  prepareUI();

  window.addEventListener('resize', onResize, false);

  loadInitialData();
}
