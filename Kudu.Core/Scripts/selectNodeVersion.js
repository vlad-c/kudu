﻿var path = require('path')
    , fs = require('fs');

var flushAndExit = function (code) {
    var exiting;
    process.on('exit', function () {
        if (exiting)
            return;

        exiting = true;
        process.exit(code);
    });
};

// Determine the installation location of node.js and iisnode

var existsSync = fs.existsSync || path.existsSync;

var nodejsDir = path.resolve(process.env['programfiles(x86)'] || process.env['programfiles'], 'nodejs');
if (!existsSync(nodejsDir))
    throw new Error('Unable to locate node.js installation directory at ' + nodejsDir);

var interceptorJs = path.resolve(process.env['programfiles(x86)'], 'iisnode', 'interceptor.js');
if (!existsSync(interceptorJs)) {
    interceptorJs = path.resolve(process.env['programfiles'], 'iisnode', 'interceptor.js');
    if (!existsSync(interceptorJs))
        throw new Error('Unable to locate iisnode installation directory with interceptor.js file');
}

// Validate input parameters

var repo = process.argv[2];
var wwwroot = process.argv[3];
if (!existsSync(wwwroot) || !existsSync(repo))
    throw new Error('Usage: node.exe selectNodeVersion.js <path_to_repo> <path_to_wwwroot>');

// If the package.json file is not included with the application 
// or if it does not specify node.js version constraints, exit this script. 
// This will cause the default node.js version to be used to run the application, 
// unless an explicit nodeProcessCommandLine setting is present

var packageJson = path.resolve(repo, 'package.json');
if (!existsSync(packageJson)) {
    console.log('The package.json file is not present.');
    console.log('The node.js application will run with the default node.js version '
        + process.versions.node + '.');
    return flushAndExit(0);
}

var json = JSON.parse(fs.readFileSync(packageJson, 'utf8'));
if (typeof json !== 'object' || typeof json.engines !== 'object' || typeof json.engines.node !== 'string') {
    console.log('The package.json file does not specify node.js engine version constraints.');
    console.log('The node.js application will run with the default node.js version '
        + process.versions.node + '.');
    return flushAndExit(0);
}

// If the iisnode.yml included with the application explicitly specifies the
// nodeProcessCommandLine, exit this script. The presence of nodeProcessCommandLine
// deactivates automatic version selection.

var iisnodeYml = path.resolve(repo, 'iisnode.yml');
var yml = '';
if (existsSync(iisnodeYml)) {
    yml = fs.readFileSync(iisnodeYml, 'utf8');
    if (yml.match(/^ *nodeProcessCommandLine *:/m)) {
        console.log('The iisnode.yml file explicitly sets nodeProcessCommandLine. '
            + 'Automatic node.js version selection is turned off.');
        return flushAndExit(0);
    }
}

// Determine the set of node.js versions available on the platform

var versions = [];
fs.readdirSync(nodejsDir).forEach(function (dir) {
    if (dir.match(/^\d+\.\d+\.\d+$/) && existsSync(path.resolve(nodejsDir, dir, 'node.exe')))
        versions.push(dir);
});

console.log('Node.js versions available on the platform are: ' + versions.join(', ') + '.');

// Calculate actual node.js version to use for the application as the maximum available version
// that satisfies the version constraints from package.json.

var version = require('./semver.js').maxSatisfying(versions, json.engines.node);
if (!version) {
    console.log('No available node.js version matches application\'s version constraint of \''
        + json.engines.node + '\'.');
    console.log('Use package.json to choose one of the available versions.');
    return flushAndExit(-1);
}

console.log('Selected node.js version ' + version + '. Use package.json file to choose a different version.');

// Save the version information to iisnode.yml in the wwwroot directory

if (yml !== '')
    yml += '\r\n';

yml += 'nodeProcessCommandLine: "' + path.resolve(nodejsDir, version, 'node.exe') + '" "' + interceptorJs + '"';
fs.writeFileSync(path.resolve(wwwroot, 'iisnode.yml'), yml);


