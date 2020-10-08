'use strict';

const cheerio = require('cheerio');
const j2x = require('jgexml/json2xml.js');
const fetch = require('node-fetch');

function buildXml(links, page) {
  var feed = {};
  var rss = {};
  rss['@version'] = '2.0';
  rss["@xmlns:atom"] = 'http://www.w3.org/2005/Atom';
  rss.channel = {};
  rss.channel.title = 'AudioPlayGround RSS programmes feed - '+page;
  rss.channel.link = 'http://bbc-rss.herokuapp.com/rss/apg/'+page+'.rss';
  rss.channel["atom:link"] = {};
  rss.channel["atom:link"]["@rel"] = 'self';
  rss.channel["atom:link"]["@href"] = rss.channel.link;
  rss.channel["atom:link"]["@type"] = 'application/rss+xml';
  rss.channel.description = 'Unofficial AudioPlayGround RSS feeds';
  rss.channel.webMaster = 'mike.ralphson@gmail.com (Mike Ralphson)';
  rss.channel.pubDate = new Date().toUTCString();
  rss.channel.generator = 'apg by Mermade Software http://github.com/mermade/bbc-rss';
  rss.channel.item = [];

  for (let link of links) {
    var d = new Date();
    var title = link.title + ' by ' + link.author;

    var i = {};
    i.title = title;
    i.link = link.url;
    i.description = title;
    i.category = 'audio_video';
    i.guid = {};
    i.guid["@isPermaLink"] = 'true';
    i.guid[""] = link.url;
    i.pubDate = d.toUTCString();

    i.enclosure = {};
    i.enclosure["@url"] = link.url;
    i.enclosure["@length"] = 150260;
    i.enclosure["@type"] = 'audio/mpeg';

    rss.channel.item.push(i);
  }

  feed.rss = rss;
  let xml = j2x.getXml(feed,'@','',2);
  return xml;
}

function main(page,cb) {
  const links = [];

  fetch('https://www.audioplayground.xyz/'+page)
  .then(function(res){
    return res.text();
  })
  .then(function(body){
    const $ = cheerio.load(body);
    $('.sqs-audio-embed').each(function(){
      const link = { url: $(this).attr('data-url'), title: $(this).attr('data-title'), author: $(this).attr('data-author') };
      links.push(link);
    });
    cb(buildXml(links,page));
  });
}

module.exports = {
  main: main
};

