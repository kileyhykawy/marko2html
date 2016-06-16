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

/**
 * @typedef PathInfo
 * @type Object
 * @property {string} path - path that the info is about
 * @property {boolean} exists - if the path exists
 * @property {boolean} isFile - if the path is a file
 * @property {boolean} isDir - if the path is a directory
 */
/**
 * Returns an object with information about a given file system path
 *
 * @param {string} pathToCheck - file system path to get info about
 * @return {PathInfo} pathInfo - path information
 */
function getPathInfo(pathToCheck) {
  let returnPathInfo = {
    path: pathToCheck,
    exists: false,
    isFile: false,
    isDir: false
  };

  let pathStats;
  try {
    pathStats = fs.statSync(pathToCheck);
    returnPathInfo.exists = true;
  } catch (e) {
    return returnPathInfo;
  }

  returnPathInfo.isFile = pathStats.isFile();
  returnPathInfo.isDir = pathStats.isDirectory();

  return returnPathInfo;
}

/**
 * Builds the path to data file given a template file name.
 * If data path is a file, just use the data file name. Otherwise, we
 * use the data directory followed by the template file name with
 * .json extension.
 *
 * @param {string} templateFilePath - Path to template file
 * @param {PathInfo} dataPathInfo - path info object for data location
 * @return {string} Path to the data file name.
 */
function buildDataFilename(templateFilePath, dataPathInfo) {
  if (dataPathInfo.isFile) {
    return dataPathInfo.path;
  }

  return path.join(
    dataPathInfo.path,
    path.parse(templateFilePath).name + '.json'
  );
}

/**
 * @typedef OutputInfo
 * @type Object
 * @property {string} outfile - path to an output file
 * @property {string} outdir - path to an output directory
 */
/**
 * Builds an output stream to an output file given a template file name.
 * If output path is a file, just use the output file name. Otherwise, we
 * use the output directory followed by the template file name with
 * .html extension. If no file or directory, go to stdout.
 *
 * @param {string} templateFilePath - Path to template file
 * @param {OutputInfo} outputPath - Output info object for output location
 * @return {WriteStream} Stream to the output location
 */
function buildOutputStream(templateFilePath, outputPath) {
  if (!outputPath.outfile && !outputPath.outdir) {
    return process.stdout;
  }

  let outputFilePath;
  if (outputPath.outfile) {
    outputFilePath = outputPath.outfile;
  } else {
    outputFilePath = path.join(
      outputPath.outdir,
      path.parse(templateFilePath).name + '.html'
    );
  }

  log.debug("buildOutputStream: outputPath='%s'", outputFilePath);
  return fs.createWriteStream(outputFilePath);
}

/**
 * Render the template with data to an output location.
 *
 * @param {string} templateFile - template file
 * @param {string} dataFile - where data should be read from
 * @param {WriteStream} outputStream - where rendered template should be written
 *                                     to
 */
function renderTemplate(templateFile, dataFile, outputStream) {
  // Load marko template
  let template = marko.load(templateFile, {writeToDisk: false});

  // Load data
  let dataPath = path.resolve(dataFile);
  log.debug('dataPath: %s', dataPath);
  let data = require(dataPath);

  template.render(data, outputStream);
}

/**
 * Render a single template file from a given data location (dir/file) to a
 * given output location (file/dir/stdout).
 *
 * @param {string} templateFilePath - path to a single template file
 * @param {PathInfo} dataPathInfo - path info to data location
 * @param {OutputInfo} outputPath - info about path to output location
 */
function processTemplateFile(templateFilePath, dataPathInfo, outputPath) {
  let dataFilePath = buildDataFilename(templateFilePath, dataPathInfo);
  log.debug("processTemplateFile: dataFile='%s'", dataFilePath);
  let outputStream = buildOutputStream(templateFilePath, outputPath);

  renderTemplate(templateFilePath, dataFilePath, outputStream);
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
  .option('-o, --outfile [path_to_file]',
    'specify output file location (default is stdout), ')
  .option('-d, --outdir [path_to_dir]', 'specify output directory')
  .parse(process.argv);

log.debug('argTemplatePath: %s', argTemplatePath);
log.debug('argDataPath: %s', argDataPath);
log.debug('outfile: %j', program.outfile);
log.debug('outdir: %j', program.outdir);

let outputPath = {
  outfile: program.outfile,
  outdir: program.outdir
};

if (outputPath.outfile && outputPath.outdir) {
  console.error("Can only have one of --outfile or --outdir specified");
  process.exit(-1);
}

/*
 * If output directory was specified, it must already exist
 */
if (outputPath.outdir) {
  let outputPathInfo = getPathInfo(outputPath.outdir);
  if (!outputPathInfo.exists || !outputPathInfo.isDir) {
    console.error("Output directory '%s' does not exist", outputPathInfo.path);
    process.exit(-1);
  }
}

// Ensure that template path exists
let templatePathInfo = getPathInfo(argTemplatePath);
if (!templatePathInfo.exists) {
  console.error("Template path '%s' does not exist", templatePathInfo.path);
  process.exit(-1);
}
if (!templatePathInfo.isFile && !templatePathInfo.isDir) {
  console.error("Template path '%s' is not a file or directory",
    templatePathInfo.path);
  process.exit(-1);
}

// Ensure that data path exists
let dataPathInfo = getPathInfo(argDataPath);
if (!dataPathInfo.exists) {
  console.error("Data path '%s' does not exist", dataPathInfo.path);
  process.exit(-1);
}
if (!dataPathInfo.isFile && !dataPathInfo.isDir) {
  console.error("Data path '%s' is not a file or directory",
    dataPathInfo.path);
  process.exit(-1);
}

try {
  if (templatePathInfo.isFile) {
    processTemplateFile(templatePathInfo.path, dataPathInfo, outputPath);
  } else if (templatePathInfo.isDir) {
    console.error("Template path '%s' is a directory", templatePathInfo.path);
    process.exit(-1);
  } else {
    console.error("Template path '%s' is not a file or directory",
      templatePathInfo.path);
    process.exit(-1);
  }
} catch (e) {
  console.error(e.message);
  process.exit(-1);
}

