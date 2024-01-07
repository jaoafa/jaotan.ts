#!/bin/sh

find docs -name '*.png' -exec pngquant --ext .png -v --skip-if-larger -f {} \;
