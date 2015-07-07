'use strict';

Object.defineProperty(exports, '__esModule', {
    value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var OPTIONAL_LOCALES = ['en_US', 'zh_CN'];

exports['default'] = function (_ref) {
    var Plugin = _ref.Plugin;
    var t = _ref.types;

    function trim(s) {
        return s.replace(/^"|"$/gm, '');
    }

    function genHash(str) {
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
            return loc.start.line + ' [' + loc.start.column + ':' + loc.end.column + ']';
        } else {
            return loc.start.line + '[' + loc.start.column + '] - ' + loc.end.line + '[' + loc.end.column + ']';
        }
    }

    function exportAsMarkdown(mdFile, sourceFileName, calls) {
        var text = sourceFileName + '\n\n';
        text += '| code loc | hash | locale | text |\n';
        text += '| --- |\n';
        calls.forEach(function (call) {
            text += '|' + printLoc(call.loc);
            text += '|' + call.hash;
            if (call.locale) text += '|' + call.locale;else text += '|default';
            text += '|' + call.text.replace(/\|/gm, '\\|') + '|\n';
        });

        text += '\n';
        _fs2['default'].appendFile(mdFile, text);
    }

    function wrapAsCsv(item) {
        item = item.replace(/\"/gm, '""');
        if (/[\s,]/g.test(item)) item = '"' + item + '"';
        return item;
    }

    function exportAsCsv(csvFile, sourceFileName, calls) {
        calls.forEach(function (call) {
            var line = wrapAsCsv(sourceFileName) + ',';
            line += call.hash + ',';
            line += wrapAsCsv(printLoc(call.loc)) + ',';
            if (call.locale) line += wrapAsCsv(call.locale) + ',';else line += 'default,';
            line += wrapAsCsv(call.text) + ',';
            line += '\n';
            _fs2['default'].appendFile(csvFile, line);
        });
    }

    function findLangPackLocalVar(filename, metadata) {
        var imports = metadata.modules.imports;
        for (var i in imports) {
            var p = _path2['default'].resolve(filename, imports[i].source);
            // check filename with opts
            if (_path2['default'].basename(p, '.js') == (extraOptions.langpackImport || 'langutils')) {
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

    var langPackCalls = [];
    var extraOptions = null;

    return new Plugin('langpack', {
        pre: function pre(file) {
            langPackCalls = [];
            extraOptions = {};
            if (file.opts.extra.length > 0) {
                file.opts.extra.forEach(function (item) {
                    var ss = item.split('=', 2);
                    extraOptions[ss[0]] = ss[1];
                });
            }
        },
        visitor: {
            CallExpression: function CallExpression(node, parent, scope, file) {
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
                            if (OPTIONAL_LOCALES.indexOf(arg.value) > 0) {
                                locale = arg.value;
                            }
                        });
                        text = args.join('');
                    } else {
                        text = trim(node.arguments[0].raw);
                    }

                    var hash = genHash(filename + printLoc(node.loc));
                    if (hash < 0) hash *= -1;

                    langPackCalls.push({
                        loc: node.loc,
                        hash: hash,
                        text: text,
                        locale: locale
                    });

                    text = '"' + text + '"';
                    if (locale) {
                        this.replaceWithSourceString(this.context.state.langPackFn + '(' + text + ',' + hash + ',' + locale + ')');
                    } else {
                        this.replaceWithSourceString(this.context.state.langPackFn + '(' + text + ',' + hash + ')');
                    }
                }
            }
        },

        post: function post(file) {
            if (langPackCalls.length > 0) {

                var topPath = file.opts.sourceRoot || extraOptions.sourceRoot || '/';
                var sourceFileName = _path2['default'].relative(topPath, file.opts.sourceFileName);

                if (extraOptions.langpackExport) {
                    var exportPath = extraOptions.langpackExport;
                    if (!_path2['default'].isAbsolute(exportPath)) exportPath = _path2['default'].resolve(topPath, exportPath);

                    if (!_fs2['default'].existsSync(_path2['default'].dirname(exportPath))) return;
                    if (!_fs2['default'].existsSync(exportPath)) {
                        // touch export file
                        _fs2['default'].closeSync(_fs2['default'].openSync(exportPath, 'w'));
                    }

                    var ext = _path2['default'].extname(exportPath);
                    if (ext == '.md') {
                        exportAsMarkdown(exportPath, sourceFileName, langPackCalls);
                    } else if (ext == '.csv') {
                        exportAsCsv(exportPath, sourceFileName, langPackCalls);
                    } else if (ext == '.json') {}
                }
            }
        }
    });
};

module.exports = exports['default'];

//exportAsJson(exportPath, sourceFileName, langPackCalls);