'use strict';

const fs = require('fs');
const j2x = require('jgexml/json2xml.js');
const fetch = require('node-fetch');
const codes = require('./netflixCodes.js');

let categories = {};
let programmes = {};

function randomProperty(obj) {
  const keys = Object.keys(obj)
  return keys[ keys.length * Math.random() << 0];
}

function buildIndex(searchTerm,cat) {
  let cats = {};
  return new Promise(function(res,rej){
    let index = {};
    let arr = [];
    for (let c in codes) {
      if ((c === cat) || (codes[c].toLowerCase().split('-').join('').indexOf(searchTerm)>=0)) {
        cats[c] = { title: codes[c] };
      }
    }

    let c = (cat && cats[cat]) ? cat : randomProperty(cats);

    let title = encodeURIComponent(codes[c].split('&amp;').join('&'))
    title = title.split('%20').join('+');
    arr.push(fetch('https://flixtape.netflix.com/api/autocomplete?q='+title)
    .then(function(res){
      return res.text();
    })
    .then(function(data){
      let j = JSON.parse(data);
      index[c] = j;
    })
    .catch(function(ex){
      console.log(ex.message,title);
    }));
    Promise.all(arr)
    .then(function(data){
      res(index);
    });
  });
}

function buildXml(searchTerm,catNo) {
  var feed = {};
  var rss = {};
  rss['@version'] = '2.0';
  rss["@xmlns:atom"] = 'http://www.w3.org/2005/Atom';
  rss.channel = {};
  rss.channel.title = 'Netflix RSS programmes feed - '+(catNo||searchTerm);
  rss.channel.link = 'http://bbc-rss.herokuapp.com/rss/netflix/search/'+(catNo||searchTerm)+'.rss';
  rss.channel["atom:link"] = {};
  rss.channel["atom:link"]["@rel"] = 'self';
  rss.channel["atom:link"]["@href"] = rss.channel.link;
  rss.channel["atom:link"]["@type"] = 'application/rss+xml';
  rss.channel.description = 'Unofficial Netflix RSS feeds';
  rss.channel.webMaster = 'mike.ralphson@gmail.com (Mike Ralphson)';
  rss.channel.pubDate = new Date().toUTCString();
  rss.channel.generator = 'nfsearch by Mermade Software http://github.com/mermade/bbc-rss';
  rss.channel.item = [];

  for (let t in programmes) {
    let p = programmes[t];
    var d = new Date();
    var title = p.title;
    if (p.duration && p.release_year) {
      title += ' ('+p.release_year+' '+Math.round(p.duration/60.0)+'m) ';
    }
    else title += ' - ';
    title += 'on @netflix ';
    title += p.description;
    if (title.length >= 260) {
      title = title.substr(0,260)+'...';
    }
    var id = p.id;

    var i = {};
    i.title = title;
    i.link = p.url.split('?')[0];
    i.description = p.description;
    i.category = 'audio_video';
    i.guid = {};
    i.guid["@isPermaLink"] = 'false';
    i.guid[""] = 'NFLX:' + p.id;
    i.pubDate = d.toUTCString();

    var imageUrl = p.storyart_image || p.boxshot_image;
    if (!imageUrl.startsWith('http')) imageUrl = 'https:'+imageUrl;

    i.enclosure = {};
    i.enclosure["@url"] = imageUrl;
    i.enclosure["@length"] = 15026;
    i.enclosure["@type"] = 'image/jpeg';

    rss.channel.item.push(i);
  }

  feed.rss = rss;
  let xml = j2x.getXml(feed,'@','',2);
  return xml;
}

function main(searchTerm,catNo,max,cb) {
  buildIndex(searchTerm,catNo)
  .then(function(data){
    for (let i in data) {
      let collection = data[i];
      for (let entry of collection) {
        if (entry.popular_tracks && entry.popular_tracks.length) {
          let cat = { title: entry.title };
          categories[entry.id] = cat;
          for (let track of entry.popular_tracks) {
            if (track.url) programmes[track.id] = track;
          }
        }
      }
    }

    if ((max > 0) && (Object.keys(programmes).length > max)) {
      let newprogs = {};
      for (let i=0;i<max;i++) {
        let id = randomProperty(programmes);
        newprogs[id] = programmes[id];
        delete programmes[id]; // so we don't pick the same one more than once
      }
      programmes = newprogs;
    }

    cb(buildXml(searchTerm,catNo));

  });
}

module.exports = {
  main: main
};

