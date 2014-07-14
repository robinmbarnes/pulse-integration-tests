var assert = require('chai').assert;
var _ = require('underscore');
var childProcess = require('child_process');
var async = require("async");
var fs = require("fs");
var spawned = [];

function spawn()
{
    var child = childProcess.spawn.apply(childProcess, Array.prototype.slice.call(arguments));
    spawned.push(child);
    return child;
}

suite('Pulse');

test('pulse-chat-server runs', function(done) {
    var chatServer = spawn('node', ['../pulse-chat-server/main.js']);
    chatServer.stdout.setEncoding('utf8');
    chatServer.stdout.on('data', function(data) {
        assert.match(data, /^pulse-chat-server listening on port \d+/);
        chatServer.kill();
        done();
    });
});

test('pulse-chat-client-adviser can connect to server', function(done) {
    var chatServer = spawn('node', ['../pulse-chat-server/main.js']);
    var adviserClient = spawn('node', ['../pulse-chat-client-adviser/main.js']);
    
    adviserClient.stdout.setEncoding('utf8');
    adviserClient.stdout.on('data', function(data) {
        assert.match(data, /^pulse-chat-client-adviser connected to server/);
        done();
    });
});

test('pulse-chat-client-customer can connect to server', function(done) {
    var chatServer = spawn('node', ['../pulse-chat-server/main.js']);
    var customerClient = spawn('node', ['../pulse-chat-client-customer/main.js']);
    
    customerClient.stdout.setEncoding('utf8');
    customerClient.stdout.on('data', function(data) {
        assert.match(data, /^pulse-chat-client-customer connected to server/);
        done();
    });
});

test('pulse-email-reading-service runs', function(done) {
    var emailReadingService = spawn('node', ['../pulse-email-reading-service/main.js']);
    emailReadingService.stdout.setEncoding('utf8');
    emailReadingService.stdout.on('data', function(data) {
        assert.match(data, /^pulse-email-reading-service is running/);
        done();
    });
});

test('pulse-email-storage-service subscribes to pulse-email-reading-service', function(done) {
    var emailReadingService = spawn('node', ['../pulse-email-reading-service/main.js']);
    var emailStorageService = spawn('node', ['../pulse-email-storage-service/main.js']);
    emailReadingService.stdout.setEncoding('utf8');
    var outputCount = 0;
    emailReadingService.stdout.on('data', function(data) {
        outputCount++;
        if(outputCount == 2) {
            assert.match(data, /^pulse-email-reading-service subscriber is connected/);
            done();
        }
    });
});

test('pulse-email-reading-service receives emails from pulse-email-storage-service', function(done) {
    
    var expectedOutput = [null];
    var emailStorageService = spawn('node', ['../pulse-email-storage-service/main.js']);
    var emailReadingService = spawn('node', ['../pulse-email-reading-service/main.js']);
    
    var readEmail = function(emailFile, callback) {
        fs.readFile('./email-storage/'+emailFile, { encoding: 'utf8' }, function(err, emailContents) {
            expectedOutput.push(emailContents);
            callback(err, emailFile, emailContents);
        });
    };
    
    var copyEmail = function(fileName, emailContents, callback) {
        fs.writeFile('./emails/'+fileName, emailContents, function(err) {
            callback(err)
        });
    };
    
    var wait = function(callback) {
        setTimeout(callback, 500);
    };
    
    this.timeout(5000);
    
    var expectedOutputCount = 3;
    var currentOutputCount = 0;
    emailStorageService.stdout.on('data', function(data) {
        if(expectedOutput[currentOutputCount] !== null) {
            assert.equal(data.toString().trim(), expectedOutput[currentOutputCount]);
        }
        currentOutputCount++;
        if(currentOutputCount == expectedOutputCount) {
            done();
        }
     });
    
    async.waterfall([
        wait,
        _.partial(readEmail, 'email1'),
        copyEmail,
        wait,
        _.partial(readEmail, 'email2'),
        copyEmail,
    ], function() {});
});

afterEach(function() {
    var processItem = null;
    while(processItem = spawned.pop()) {
        processItem.kill();
    }
});
