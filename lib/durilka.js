var url = require('url'),
    http = require('http'),
    fs = require('fs'),
    getopts = require('./getopts.js').getopts,
    opts = getopts(process.argv.slice(2, process.argv.length),
                   ['--version', '-v',
                    '--help', '-h'],
                    ['--max-size', '-m',
                    '--input', '-i',
                    '--base-url', '-b',
                    '--output', '-o']).known,
    srcFile, outFile, baseUrl, src, maxSize;

exports.main = function() {
    if (opts['--version'] || opts['-v']) {
        printFile('VERSION');
    } else if (opts['--help'] || opts['-h']) {
        printFile('USAGE');
    } else {
        if (maxSize = (opts['--max-size'] || opts['-m'])) {
            maxSize = parseInt(maxSize[0], 10);
        }
        maxSize = maxSize || 32;

        if (baseUrl = (opts['--base-url'] || opts['-b'])) {
            baseUrl = baseUrl[0];
        }

        if (srcFile = (opts['--input'] || opts['-i'])) {
            srcFile = fs.realpathSync(srcFile[0]);
            src = fs.readFileSync(srcFile).toString();

            encodeImages(src, function(encodedSrc) {
                outFile = (opts['--output'] || opts['-o']);
                fs.writeFileSync(outFile ? outFile[0] : srcFile, encodedSrc);
            });
        } else {
            printFile('USAGE');
        }
    }
}

function encodeImages(src, callback) {
    var reUrl = /url\(["']?([^()]+?)["']?\)/gi,
        len = src.match(reUrl).length, url;

    while (url = reUrl.exec(src)) {
        (function(url) {
            encodeImage(url, function(data) {
                if (data) {
                    src = src.replace(url, data);
                }
                if (!--len && callback) {
                    callback(src);
                }
            });
        })(url[1]);
    }
}

function normalizeUri(uri, baseUrl) {
    var normUri = '';

    if (uri.length && uri.substr(0, 5) != 'data:') {
        if (uri.substr(0, 2) == '//') {
            normUri = 'http:' + uri;
        } else if (/^https?/.test(uri)) {
            normUri = uri;
        } else {
            normUri = baseUrl ? baseUrl + uri : uri;
        }
    }
    return normUri;
}

function encodeImage(uri, callback) {
    uri = normalizeUri(uri, baseUrl);
    if (!uri) {
        callback && callback();
        return;
    }

    var urlObj = url.parse(uri),
        opts = {
            host: urlObj.hostname,
            port: urlObj.port || 80,
            path: urlObj.pathname
        },
        request = http.get(opts);

    request.on('response', function(response) {
        var type = response.headers['content-type'],
            prefix = 'data:' + type + ';base64,';

        response.body = [];
        response.setEncoding('binary');
        response.on('data', function(chunk) {
            if (response.statusCode == 200) {
                response.body.push(chunk);
            } else {
                console.error('Image was not loaded. Status: %s [%s]', response.statusCode, uri);
            }
        });

        response.on('end', function() {
            var b = new Buffer(response.body.join(''), 'binary'), data;

            if (Buffer.byteLength(b.toString('binary')) > maxSize * 1024) {
                console.warn('Image size greater than %d kilobytes [%s]', maxSize, uri);
            } else {
                data = prefix + b.toString('base64');
            }
            callback && callback(data);
            delete response.body;
        });
    });
}

function printFile(filename) {
    console.log(fs.readFileSync(__dirname.slice(0, __dirname.lastIndexOf('/')) + '/' + filename).toString());
}
