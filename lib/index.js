'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _crc = require('crc');

var _crc2 = _interopRequireDefault(_crc);

var OPTIONAL_LOCALES = ['en_US', 'zh_CN'];
var MAX_INDEX_COUNT = 1000;

exports['default'] = function (_ref) {
    var Plugin = _ref.Plugin;
    var t = _ref.types;

    function trim(s) {
        return s.replace(/^"|"$/gm, '');
    }

    function hashText(str) {
        if (Array.prototype.reduce) {
            return str.split('').reduce(function (a, b) {
                a = (a << 5) - a + b.charCodeAt(0);
                return a & a;
            }, 0);
        }
        var hash = 0;
        if (str.length === 0) return hash;
        for (var i = 0; i < str.length; i++) {
            var character = str.charCodeAt(i);
            hash = (hash << 5) - hash + character;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash;
    }

    function printLoc(loc) {
        if (loc.start.line == loc.end.line) {
            return loc.start.line + '[' + loc.start.column + ':' + loc.end.column + ']';
        } else {
            return loc.start.line + '[' + loc.start.column + ']-' + loc.end.line + '[' + loc.end.column + ']';
        }
    }

    function findLangPackLocalVar(filename, metadata) {
        var imports = metadata.modules.imports;
        for (var i in imports) {
            var p = _path2['default'].resolve(filename, imports[i].source);
            // check filename with opts
            if (_path2['default'].basename(p, '.js') == (extraOptions.langpackImportName || 'langpack')) {
                var specifiers = imports[i].specifiers;
                var localVar = null;
                for (var n in specifiers) {
                    var spec = specifiers[n];
                    if (spec.imported == 'default' && spec.kind == 'named') {
                        localVar = spec.local;
                        break;
                    }
                }
                return localVar;
            }
        }

        return null;
    }

    var langPackCalls;
    var extraOptions;
    var exportPath;
    var oldData;
    var callIndex;
    var sourceFileName;
    var hashPrefix;

    return new Plugin('langpack', {
        pre: function pre(file) {

            exportPath = null;
            oldData = null;
            sourceFileName = null;
            callIndex = 0;
            hashPrefix = null;
            langPackCalls = null;
            extraOptions = {};

            if (file.opts.extra.length > 0) {
                file.opts.extra.forEach(function (item) {
                    var ss = item.split('=', 2);
                    extraOptions[ss[0]] = ss[1];
                });
            }

            if (extraOptions.langpackExportDir) {
                (function () {

                    var topPath = file.opts.sourceRoot || extraOptions.sourceRoot || '/';
                    sourceFileName = _path2['default'].relative(topPath, file.opts.sourceFileName);

                    var exportDir = extraOptions.langpackExportDir;
                    if (!_path2['default'].isAbsolute(exportDir)) exportDir = _path2['default'].resolve(topPath, exportDir);

                    _fs2['default'].exists(exportDir, function (exists) {
                        if (!exists) _fs2['default'].mkdir(exportDir);
                    });

                    var filename = sourceFileName.replace(/[\\\/]/gm, '_') + '.json';
                    exportPath = _path2['default'].join(exportDir, filename);
                    _fs2['default'].exists(exportPath, function (exists) {
                        if (exists) {
                            _fs2['default'].readFile(exportPath, function (err, data) {
                                try {
                                    oldData = JSON.parse(data);
                                    callIndex = oldData.callIndex;
                                } catch (e) {}
                            });
                        }
                    });
                })();
            }

            if (!sourceFileName) {
                sourceFileName = file.opts.sourceFileName;
            }
        },

        visitor: {
            CallExpression: function CallExpression(node, parent, scope, file) {
                if (!exportPath) return; // no needs to go futher

                var filename = this.state.opts.filename;
                if (!this.context.state.langPackFn) {
                    var fn = findLangPackLocalVar(filename, file.metadata);
                    if (!fn) return;
                    this.context.state.langPackFn = fn;
                }

                if (node.callee.name == this.context.state.langPackFn) {
                    if (node.arguments.length == 0) {
                        // illegal call, ignore this
                        return;
                    }
                    var text = undefined;
                    var locale = undefined;
                    if (node.arguments.length > 1) {
                        var args = node.arguments.map(function (arg, idx) {
                            if (idx != node.arguments.length - 1) {
                                return trim(arg.raw);
                            }
                        });
                        text = args.join('');
                    } else {
                        text = trim(node.arguments[0].raw);
                    }

                    var hash = hashText(text).toString();
                    var index = undefined;
                    if (oldData && oldData.text[hash]) {
                        index = oldData.text[hash].index;
                    } else {
                        if (index >= MAX_INDEX_COUNT) {
                            callIndex = 0;
                        } else callIndex++;
                        index = callIndex;
                    }

                    if (!langPackCalls) langPackCalls = {};

                    if (langPackCalls[hash]) {
                        langPackCalls[hash].locations.push([node.loc.start.line, node.loc.start.column, node.loc.end.line, node.loc.end.column]);
                    } else {
                        langPackCalls[hash] = {
                            locations: [[node.loc.start.line, node.loc.start.column, node.loc.end.line, node.loc.end.column]],
                            index: index,
                            text: text
                        };
                    }

                    if (!hashPrefix) hashPrefix = _crc2['default'].crc32(sourceFileName) * MAX_INDEX_COUNT;
                    index = hashPrefix + index;

                    if (locale) {
                        this.replaceWithSourceString(this.context.state.langPackFn + '(' + index + ',' + locale + ')');
                    } else {
                        this.replaceWithSourceString(this.context.state.langPackFn + '(' + index + ')');
                    }
                }
            }
        },

        post: function post(file) {
            if (exportPath) {
                if (langPackCalls) {
                    _fs2['default'].closeSync(_fs2['default'].openSync(exportPath, 'w'));
                    _fs2['default'].writeFile(exportPath, JSON.stringify({
                        callIndex: callIndex,
                        source: sourceFileName,
                        hashPrefix: hashPrefix,
                        text: langPackCalls
                    }, null, 2));
                } else {}
            }
        }
    });
};

module.exports = exports['default'];

/*fs.exists(exportPath, (exists) => {
    fs.unlink(exportPath);
});*/