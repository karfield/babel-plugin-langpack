# langPack generator plugin for Babel

This plugin is used to traverse the code and replace 'L' callback as append a hash value, it alse generates a langpack export file, which you can translate your localizton file in csv or markdown file.

# Usage

install:

```
$ npm install karfield/babel-plugin-langpack  --save-dev
```

Use

```
$ babel --plugins langpack some-code.js --extra langpackImport=langutils --extra langpackExportDir=/path/to/export/ --extra langpackFormant=csv
```

or:

```
require("babel").transform("code", { plugins: ["langpack"],
  extra: ["langpackImport=langutils", "langpackExportDir=/path/to/export/", "langpackFormat=csv"] });
```

with webpack loader parameters:

```
var babel="babel?optional[]=es7.objectRestSpread&optional[]=runtime&plugins[]=langpack&extra[]=langpackImport=langutils&extra[]=langpackExportDir=/path/to/export/&extra[]=langpackFormat=csv"
```

the parameter: "langpackImport", "langpackExportDir", "langpackFormat"  are essential for langpack, so don't miss it.

# License

The MIT License (MIT)

Copyright (c) 2015 Jed Watson

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
