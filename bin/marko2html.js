/*
  The MIT License (MIT)

  Copyright (c) 2016 Kiley Hykawy.

  Permission is hereby granted, free of charge, to any person
  obtaining a copy of this software and associated documentation files
  (the "Software"), to deal in the Software without restriction,
  including without limitation the rights to use, copy, modify, merge,
  publish, distribute, sublicense, and/or sell copies of the Software,
  and to permit persons to whom the Software is furnished to do so,
  subject to the following conditions:

  The above copyright notice and this permission notice shall be
  included in all copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
  EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
  MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
  NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS
  BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
  ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
  CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
  SOFTWARE.
*/
"use strict";

const log = require('debug-logger')('marko2html');

const program = require('commander');
const path = require('path');
const fs = require('fs');
const marko = require('marko');

function renderTemplate(templateFile, dataFile, outputStream) {
  // Load marko template
  let template = marko.load(templateFile, {writeToDisk: false});

  // Load data
  let dataPath = path.resolve(dataFile);
  log.debug('dataPath: %s', dataPath);
  let data = require(dataPath);

  template.render(data, outputStream);
}

// MAIN PROGRAM
const pkg = require('../package.json');
const version = pkg.version;

let argTemplatePath;
let argDataPath;

program
  .version(version)
  .arguments('<template> <dataJson>')
  .action(function(template, dataJson) {
    argTemplatePath = template;
    argDataPath = dataJson;
  })
  .parse(process.argv);

log.debug('argTemplatePath: %s', argTemplatePath);
log.debug('argDataPath: %s', argDataPath);

renderTemplate(argTemplatePath, argDataPath, process.stdout);

