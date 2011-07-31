exports.config = {
    outFile: function(path) { return prefixFile(path, 'base.') },
    aliases: {
        'url': {
            tokens: {
                'value': [/url\(/i]
            },
            outFile: function(path) { return prefixFile(path, 'img.') }
        }
    }
}

function getDirName(path) {
    return path ? path.substr(0, path.lastIndexOf('/')) : '';
}

function getFileName(path) {
    return path ? path.substr(path.lastIndexOf('/') + 1) : '';
}

function prefixFile(path, prefix) {
    return getDirName(path) + '/' + prefix + getFileName(path);
}
