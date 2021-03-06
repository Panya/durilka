var url = require('url'),
    http = require('http'),
    fs = require('fs'),
    util = require('util'),
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
    var reUrl = /url\(\s*["']?([^)]+?)["']?\s*\)/gi,
        urls = src.match(reUrl),
        len = urls && urls.length, url;

    if (!len) {
        callback && callback(src);
        return;
    }

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

function encodeImage(uri, callback) {
    var reHTTP = /^https?/i,
        normUri = '';

    if (uri.length && uri.substr(0, 5) != 'data:') {
        if (uri.substr(0, 2) == '//') {
            getViaHTTP('http:' + uri, callback)
        } else if (reHTTP.test(uri)) {
            getViaHTTP(uri, callback);
        } else {
            normUri = baseUrl ? url.resolve(baseUrl, uri) : uri;
            reHTTP.test(normUri) ? getViaHTTP(normUri, callback) : getViaFS(normUri, callback);
        }
    } else {
        callback && callback();
    }
}

function getViaHTTP(uri, callback) {
    var urlObj = url.parse(uri),
        opts = {
            host: urlObj.hostname,
            port: urlObj.port || 80,
            path: urlObj.pathname
        },
        request = http.get(opts);

    request.on('response', function(response) {
        var type = response.headers['content-type'],
            prefix = 'data:' + type + ';base64,', status;

        response.body = [];
        response.setEncoding('binary');
        response.on('data', function(chunk) {
            status = response.statusCode;
            if (status >= 200 && status < 300 || status == 304) {
                response.body.push(chunk);
            } else {
                response.error = true;
                console.error('Image was not loaded. Status: %s [%s]', status, uri);
            }
        });

        response.on('end', function() {
            var b = new Buffer(response.body.join(''), 'binary'), data;

            if (!response.error) {
                if (Buffer.byteLength(b.toString('binary')) > maxSize * 1024) {
                    console.warn('Image size greater than %d kilobytes [%s]', maxSize, uri);
                } else {
                    data = prefix + b.toString('base64');
                }
            }
            callback && callback(data);
            delete response.body;
        });
    });
}

function getViaFS(uri, callback) {
    try {
        var fd = fs.openSync(uri, 'r');
    } catch (err) {
        console.error('Error while reading file: %s [%s]', err, uri);
        callback && callback();
        return;
    }

    var buf = new Buffer(4), type, data;
    fs.readSync(fd, buf, 0, 4, 0);

    if (0x47 == buf[0] && 0x49 == buf[1] && 0x46 == buf[2]) {
        type = 'gif';
    } else if (0x50 == buf[1] && 0x4E == buf[2] && 0x47 == buf[3]) {
        type = 'png';
    } else if (0xff == buf[0] && 0xd8 == buf[1]) {
        type = 'jpeg';
    } else {
        console.error('Unsupported file type [%s]', uri);
        callback && callback();
        return;
    }

    fd = fs.readFileSync(uri);
    if (Buffer.byteLength(fd.toString('binary')) > maxSize * 1024) {
        console.warn('Image size greater than %d kilobytes [%s]', maxSize, uri);
    } else {
        data = 'data:image/' + type + ';base64,' + fd.toString('base64');
    }
    callback && callback(data);
}

function printFile(filename) {
    util.print(fs.readFileSync(__dirname.slice(0, __dirname.lastIndexOf('/')) + '/' + filename).toString());
}
