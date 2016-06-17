# marko2html
Generate a HTML file from a Marko template

## Installation
```sh
$ npm install -g marko2html
```

## Usage
```
  Usage: marko2html [options] <template> <datafile>

  Options:

    -o, --outfile [path_to_file]  specify output file location (default is stdout),
    -d, --outdir [path_to_dir]    specify output directory
    -i, --ignore [glob]           glob spec of templates to ignore
```

Data files can either be JSON (.json) for static data or Javascript (.js) for dynamic data. Example of .js file:
```js
module.exports = {
  data1: "value1",
  data2: {
    data3: "value3",
    data4: "value4"
  }
};
```

### Render a single template file
You can use marko2html with a single template file and single data file output to either
an output file or stdout.

```sh
$ marko2html [-o <output_file>] <template_file> <data_file>
```

Render the template `template.marko` with data from `template.json` and
**output to stdout**
```sh
$ marko2html template.marko template.json
# output...
```

If you would like to **output to a file** you may use `--outfile` or `-o`.
```sh
$ marko2html --outfile template.html template.marko template.json
```

### Templates from a folder
You can also pass marko2html a directory of templates where it recursively processes all
.marko files in that location. It reads data from the given data directory that shadows
the directory structure and file naming of the template directory. The rendered HTML files are written to
the specified output directory and matches the structure of the template directory.

Example:
Template directory `mytemplates/`
```
mytemplates
|-- template1.marko
|-- subdir/
    |-- template2.marko
```

Data directory `templatedata/`
```
templatedata
|-- template1.[json|js]
|-- subdir/
    |-- template2.[json|js]
```

Output directory `generated/`
```
generated
|-- template1.html
|-- subdir/
    |-- template2.html
```

Render the templates in directory `marko` with data from `data` and output to `html`
```sh
$ marko2html marko/ data/ -d html/
```

You can also ignore files/directories found in the template folder by passing in globs
```sh
$ marko2html marko/ data/ -d html/ -i "**/_*.marko" -i "**/default_layout.marko"
```

## License
[MIT](LICENSE)