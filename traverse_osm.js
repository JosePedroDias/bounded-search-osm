'use strict';

const fs = require('fs');
const expat = require('node-expat');
const progress = require('progress-stream');



const OSM_FILE = 'lisbon_portugal.osm';



const stat = fs.statSync(OSM_FILE);

const progStr = progress({
  length : stat.size,
  time   : 1000 /* ms */
});

progStr.on('progress', function(p) {
  console.log('%s % (%s s)', p.percentage.toFixed(1), p.eta);
});



const stats = {};
const history = [''];


const parser = new expat.Parser('UTF-8');

parser.on('startElement', function (name, attrs) {
  
  let bag = stats[name];
  if (!bag) {
    bag = { count: 0, parents: {}, attrs: {}, texts: 0 };
    stats[name] = bag;
  }
  
  ++bag.count;
  
  //let pName = history[ history.length - 1 ] || 'ROOT';
  let pName = history.join('/') || '/';
  let bagP = bag.parents[pName];
  if (!bagP) {
    bag.parents[pName] = 1;
  } else {
    bag.parents[pName] = bagP + 1;
  }
  
  for (let k in attrs) {
    let bagA = bag.attrs[k];
    if (!bagA) {
      bag.attrs[k] = 1;
    } else {
      bag.attrs[k] = bagA + 1;
    }
  }
  
  history.push(name);
});

parser.on('endElement', function (name) {
  history.pop();
});

parser.on('text', function (text) {
  text = text.trim();
  if (text === '') { return; } // discard whitespace-only text nodes
  const name = history[ history.length - 1 ];
  const bag = stats[name];
  ++bag.texts;
});

parser.on('error', function (error) {
  console.error(error);
});

parser.on('end', function() { // finish:write, end:read
  console.log('all done');
  console.log(stats);
});




fs.createReadStream(OSM_FILE)
.pipe(progStr).pipe(parser);
