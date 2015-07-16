import path from 'path';
import fs from 'fs';
import crc from 'crc';

const OPTIONAL_LOCALES = ['en_US', 'zh_CN'];
const MAX_INDEX_COUNT = 1000;

export default function ({Plugin, types: t}) {
    function trim(s) {
        return s.replace(/^"|"$/gm, '');
    }

    function hashText(str){
        if (Array.prototype.reduce){
            return str.split("").reduce(function(a,b){
                a=((a<<5)-a)+b.charCodeAt(0);
                return a&a
            },0);              
        } 
        var hash = 0;
        if (str.length === 0) return hash;
        for (var i = 0; i < str.length; i++) {
            var character  = str.charCodeAt(i);
            hash  = ((hash<<5)-hash)+character;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash;
    }

    function printLoc(loc) {
        if (loc.start.line == loc.end.line) {
            return loc.start.line + "[" +
                loc.start.column + ":" +
                loc.end.column + "]";
        } else {
            return loc.start.line + "[" +
                loc.start.column + "]-" +
                loc.end.line + "[" +
                loc.end.column + "]";
        }
    }

    function findLangPackLocalVar(filename, metadata) {
        let imports = metadata.modules.imports;
        for (var i in imports) {
            let p = path.resolve(filename, imports[i].source);
            // check filename with opts
            if (path.basename(p, '.js') == (extraOptions.langpackImportName || "langpack")) {
                let specifiers = imports[i].specifiers;
                var localVar = null;
                for (var n in specifiers) {
                    let spec = specifiers[n];
                    if (spec.imported == "default" && spec.kind == "named") {
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

    return new Plugin("langpack", {
        pre(file) {

            exportPath = null;
            oldData = null;
            sourceFileName = null;
            callIndex = 0;
            hashPrefix = null;
            langPackCalls = null;
            extraOptions = {};

            if (file.opts.extra.length > 0) {
                file.opts.extra.forEach((item) => {
                    let ss = item.split("=", 2);
                    extraOptions[ss[0]] = ss[1];
                });
            }

            if (extraOptions.langpackExportDir) {

                let topPath = file.opts.sourceRoot || extraOptions.sourceRoot || "/";
                sourceFileName = path.relative(topPath, file.opts.sourceFileName);

                let exportDir = extraOptions.langpackExportDir;
                if (!path.isAbsolute(exportDir))
                    exportDir = path.resolve(topPath, exportDir);

                fs.exists(exportDir, (exists) => {
                    if (!exists)
                        fs.mkdir(exportDir);
                });

                let filename = sourceFileName.replace(/[\\\/]/gm, '_') + ".json";
                exportPath = path.join(exportDir, filename);
                fs.exists(exportPath, (exists) => {
                    if (exists) {
                        fs.readFile(exportPath, (err, data) => {
                            try {
                                oldData = JSON.parse(data);
                                callIndex = oldData.callIndex;
                            } catch(e) {}
                        });
                    }
                });
            }

            if (!sourceFileName) {
                sourceFileName = file.opts.sourceFileName;
            }
        },

        visitor: {
            CallExpression(node, parent, scope, file) {
                if (!exportPath)
                    return; // no needs to go futher

                let filename = this.state.opts.filename;
                if (!this.context.state.langPackFn) {
                    let fn = findLangPackLocalVar(filename, file.metadata);
                    if (!fn) return;
                    this.context.state.langPackFn = fn;
                }

                if (node.callee.name == this.context.state.langPackFn) {
                    if (node.arguments.length == 0) {
                        // illegal call, ignore this
                        return;
                    }
                    let text;
                    let locale;
                    if (node.arguments.length > 1) {
                        let args = node.arguments.map((arg, idx) => {
                            if (idx != node.arguments.length -1) {
                                return trim(arg.raw);
                            }
                        });
                        text = args.join("");
                    } else {
                        text = trim(node.arguments[0].raw);
                    }

                    let hash = hashText(text).toString();
                    let index;
                    if (oldData && oldData.text[hash]) {
                        index = oldData.text[hash].index;
                    } else {
                        if (index >= MAX_INDEX_COUNT) {
                            callIndex = 0;
                        } else
                            callIndex ++;
                        index = callIndex;
                    }

                    if (!langPackCalls)
                        langPackCalls = {};

                    if (langPackCalls[hash]) {
                        langPackCalls[hash].locations.push([
                            node.loc.start.line,
                            node.loc.start.column,
                            node.loc.end.line,
                            node.loc.end.column
                        ]);
                    } else {
                        langPackCalls[hash] = {
                            locations: [[
                                node.loc.start.line,
                                node.loc.start.column,
                                node.loc.end.line,
                                node.loc.end.column
                            ]],
                            index: index,
                            text: text
                        };
                    }

                    if (!hashPrefix)
                        hashPrefix = crc.crc32(sourceFileName) * MAX_INDEX_COUNT;
                    index = hashPrefix + index;

                    if (locale) {
                        this.replaceWithSourceString(
                            this.context.state.langPackFn + "(" + index + "," + locale + ")");
                    } else {
                        this.replaceWithSourceString(
                            this.context.state.langPackFn + "(" + index + ")");
                    }

                }
            }
        },

        post(file) {
            if (exportPath) {
                if (langPackCalls) {
                    fs.closeSync(fs.openSync(exportPath, "w"));
                    fs.writeFile(exportPath, JSON.stringify({
                        callIndex: callIndex,
                        source: sourceFileName,
                        hashPrefix: hashPrefix,
                        text: langPackCalls
                    }, null, 2));
                } else {
                    /*fs.exists(exportPath, (exists) => {
                        fs.unlink(exportPath);
                    });*/
                }
            }
        }
    });
}
