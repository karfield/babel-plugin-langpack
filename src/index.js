import path from 'path';
import fs from 'fs';

const OPTIONAL_LOCALES = ['en_US', 'zh_CN'];

export default function ({Plugin, types: t}) {
    function trim(s) {
        return s.replace(/^"|"$/gm, '');
    }

    function genHash(str){
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
            return loc.start.line + " [" +
                loc.start.column + ":" +
                loc.end.column + "]";
        } else {
            return loc.start.line + "[" +
                loc.start.column + "] - " +
                loc.end.line + "[" +
                loc.end.column + "]";
        }
    }

    function exportAsMarkdown(mdFile, sourceFileName, calls) {
        let text = sourceFileName + "\n\n";
        text += "| code loc | hash | locale | text |\n";
        text += "| --- |\n";
        calls.forEach((call) => {
            text += "|" + printLoc(call.loc);
            text += "|" + call.hash;
            if (call.locale)
                text += "|" + call.locale;
            else
                text += "|default";
            text += "|" + call.text.replace(/\|/gm, "\\|") + "|\n";
        });

        text += "\n";
        fs.appendFile(mdFile, text);
    }

    function wrapAsCsv(item) {
        item = item.replace(/\"/gm, '\"\"');
        if (/[\s,]/g.test(item))
            item = "\"" + item + "\"";
        return item;
    }

    function exportAsCsv(csvFile, sourceFileName, calls) {
        calls.forEach((call) => {
            let line = wrapAsCsv(sourceFileName) + ",";
            line += call.hash + ",";
            line += wrapAsCsv(printLoc(call.loc)) + ",";
            if (call.locale)
                line += wrapAsCsv(call.locale) + ",";
            else
                line += "default,";
            line += wrapAsCsv(call.text) + ",";
            line += "\n";
            fs.appendFile(csvFile, line);
        });
    }

    function findLangPackLocalVar(filename, metadata) {
        let imports = metadata.modules.imports;
        for (var i in imports) {
            let p = path.resolve(filename, imports[i].source);
            // check filename with opts
            if (path.basename(p, '.js') == extraOptions.langpackImport) {
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

    var langPackCalls = [];
    var extraOptions = null;

    return new Plugin("langpack", {
        pre(file) {
            langPackCalls = [];
            extraOptions = {};
            if (file.opts.extra.length > 0) {
                file.opts.extra.forEach((item) => {
                    let ss = item.split("=", 2);
                    extraOptions[ss[0]] = ss[1];
                });
            }
        },
        visitor: {
            CallExpression(node, parent, scope, file) {
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
                            if (OPTIONAL_LOCALES.indexOf(arg.value) > 0) {
                                locale = arg.value;
                            }
                        });
                        text = args.join("");
                    } else {
                        text = trim(node.arguments[0].raw);
                    }

                    let hash = genHash(filename + printLoc(node.loc));
                    if (hash < 0)
                        hash *= -1;

                    langPackCalls.push({
                        loc: node.loc,
                        hash: hash,
                        text: text,
                        locale: locale
                    });

                    text = "\"" + text + "\"";
                    if (locale) {
                        this.replaceWithSourceString(
                            this.context.state.langPackFn + "("
                                + text + "," + hash + ","
                                + locale + ")");
                    } else {
                        this.replaceWithSourceString(
                            this.context.state.langPackFn + "("
                                + text + "," + hash + ")");
                    }

                }
            }
        },

        post(file) {
            if (langPackCalls.length > 0) {

                let topPath = file.opts.sourceRoot || extraOptions.sourceRoot || "/";
                let sourceFileName = path.relative(topPath, file.opts.sourceFileName);

                if (extraOptions.langpackExport) {
                    let exportPath = extraOptions.langpackExport;
                    if (!path.isAbsolute(exportPath))
                        exportPath = path.resolve(topPath, exportPath);

                    if (!fs.existsSync(path.dirname(exportPath)))
                        return;
                    if (!fs.existsSync(exportPath)) {
                        // touch export file
                        fs.closeSync(fs.openSync(exportPath, "w"));
                    }

                    let ext = path.extname(exportPath);
                    if (ext == '.md') {
                        exportAsMarkdown(exportPath, sourceFileName, langPackCalls);
                    } else if (ext == '.csv') {
                        exportAsCsv(exportPath, sourceFileName, langPackCalls);
                    } else if (ext == ".json") {
                        //exportAsJson(exportPath, sourceFileName, langPackCalls);
                    }
                }
            }
        }
    });
}
