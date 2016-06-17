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
const glob = require('glob');
const mkdirp = require('mkdirp');

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
 * Determine if the given path is a file that exists
 *
 * @param {string} pathToCheck - path to check
 * @return {boolean} true if path is a file that exists
 */
function fileExists(pathToCheck) {
  let pathInfo = getPathInfo(pathToCheck);
  return (pathInfo.exists && pathInfo.isFile);
}

/**
 * Builds the path to data file to be passed into require
 * given a template file name.
 * If data path is a file, just use the data file name. Otherwise, we
 * use the data directory followed by the template file name with
 * .json extension.
 *
 * @param {string} templateBasePath - Base path to template folder or null
 * @param {string} templateFilePath - Path to template file
 * @param {PathInfo} dataPathInfo - path info object for data location
 * @return {string} Path to the data file name.
 */
function buildDataFilename(templateBasePath, templateFilePath, dataPathInfo) {
  if (dataPathInfo.isFile) {
    return dataPathInfo.path;
  }

  let relativeFromBase = "";
  if (templateBasePath) {
    relativeFromBase = path.relative(
      templateBasePath,
      path.dirname(templateFilePath)
    );
  }

  /*
   * We don't put an extension on here as require will figure out to
   * load a JSON or .js file. This allows us to use both static and
   * dynamic configuration files
   */
  return path.join(
    dataPathInfo.path,
    relativeFromBase,
    path.parse(templateFilePath).name
  );
}

/**
 * Builds an output path given a template file name and output directory.
 * We use the output directory followed by the template file name with
 * .html extension.
 *
 * @param {string} templateBasePath - Base path to template folder or null
 * @param {string} templateFilePath - Path to template file
 * @param {string} outputDir - Output directory
 * @return {string} Output file path
 */
function buildOutputPath(templateBasePath, templateFilePath, outputDir) {
  let relativeFromBase = "";
  if (templateBasePath) {
    relativeFromBase = path.relative(
      templateBasePath,
      path.dirname(templateFilePath)
    );
  }

  let outputFilePath = path.join(
    outputDir,
    relativeFromBase,
    path.parse(templateFilePath).name + '.html'
  );

  return outputFilePath;
}

/**
 * Builds an output stream given an output file path or stdout if
 * no path given.
 *
 * @param {string} outputFilePath - path to create a stream for
 * @return {WriteStream} - output stream
 */
function buildOutputStream(outputFilePath) {
  if (!outputFilePath) {
    return process.stdout;
  }

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
  let data = require(dataPath);

  template.render(data, outputStream);
}

/**
 * Render a single template file from a given data location (dir/file) to a
 * given output file or stdout.
 *
 * @param {string} templateFilePath - path to a single template file
 * @param {PathInfo} dataPathInfo - path info to data location
 * @param {string} outputFile - path to output file, stdout if null or undefined
 */
function processTemplateFile(templateFilePath, dataPathInfo, outputFile) {
  let dataFilePath = buildDataFilename(null, templateFilePath, dataPathInfo);
  let outputStream = buildOutputStream(outputFile);

  log.debug("processTemplateFile: template='%s', data='%s', output='%s'",
    templateFilePath, dataFilePath, outputFile);
  renderTemplate(templateFilePath, dataFilePath, outputStream);
}

/**
 * Render a directory of template files from a given data location (dir/file) to a
 * given output directoyr.
 *
 * @param {string} templateDirPath - path to a folder of template files
 * @param {PathInfo} dataPathInfo - path info to data location
 * @param {string} outputDir - path to output directory
 * @param {Array} ignoreList - Array of templates paths to ignore (glob)
 */
function processTemplateDirectory(templateDirPath, dataPathInfo, outputDir,
    ignoreList) {
  let templateDirAbsPath = path.resolve(templateDirPath);
  let globPath = path.join(templateDirAbsPath, '**/*.marko');
  let globOptions = {
    ignore: ignoreList
  };
  let templates = glob.sync(globPath, globOptions);
  log.debug("Templates: %s", templates.toString());

  templates.forEach(function(template, index, array) {
    let relativeTemplatePath = path.relative('', template);
    let statusMessage = relativeTemplatePath + ": ";

    let dataFilePath = buildDataFilename(templateDirAbsPath,
       template,
       dataPathInfo);
/*
    if (!fileExists(dataFilePath)) {
      statusMessage += "Data file '" + dataFilePath + "' does not exist";
      console.error(statusMessage);
      return;
    }
*/
    let outputFilePath = buildOutputPath(templateDirAbsPath,
      template,
      outputDir);
    if (outputFilePath) {
      mkdirp.sync(path.dirname(outputFilePath));
    }
    let outputStream = buildOutputStream(outputFilePath);

    try {
      log.debug("processTemplateDir: template='%s', data='%s', output='%s'",
        relativeTemplatePath, dataFilePath, outputFilePath);
      renderTemplate(template, dataFilePath, outputStream);
      statusMessage += 'Done';
    } catch (e) {
      statusMessage += e.message;
    }

    console.error(statusMessage);
  });
}

// MAIN PROGRAM
const pkg = require('../package.json');
const version = pkg.version;

let argTemplatePath;
let argDataPath;

program
  .version(version)
  .arguments('<template> <datafile>')
  .action(function(template, datafile) {
    argTemplatePath = template;
    argDataPath = datafile;
  })
  .option('-o, --outfile [path_to_file]',
    'specify output file location (default is stdout), ')
  .option('-d, --outdir [path_to_dir]', 'specify output directory')
  .option('-i, --ignore [glob]', 'glob spec of templates to ignore',
    function(val, memo) {
      memo.push(val);
      return memo;
    },
    [])
  .parse(process.argv);

log.debug('argTemplatePath: %s', argTemplatePath);
log.debug('argDataPath: %s', argDataPath);
log.debug('outfile: %j', program.outfile);
log.debug('outdir: %j', program.outdir);
log.debug('ignore: %s', program.ignore.toString());

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

// If using a template directory, must specify output directory
if (templatePathInfo.isDir && !outputPath.outdir) {
  console.error("Need to use --outdir when using template folder");
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
    processTemplateFile(templatePathInfo.path,
      dataPathInfo,
      outputPath.outfile);
  } else if (templatePathInfo.isDir) {
    processTemplateDirectory(templatePathInfo.path,
      dataPathInfo,
      outputPath.outdir,
      program.ignore);
  } else {
    console.error("Template path '%s' is not a file or directory",
      templatePathInfo.path);
    process.exit(-1);
  }
} catch (e) {
  console.error(e.message);
  process.exit(-1);
}

