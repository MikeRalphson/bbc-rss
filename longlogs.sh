#!/bin/sh
heroku logs --app bbc-rss -n 20000 |less
