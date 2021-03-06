var Botkit = require('botkit');
var BeepBoopBotkit = require('beepboop-botkit');
var StringArgv = require('string-argv');
var tmp = require('tmp');
var fs = require('fs');
var request = require('request');
var Ascii = require('ascii');

tmp.setGracefulCleanup();

var PORT = process.env.PORT
if (!PORT) {
    console.error('PORT is required');
    process.exit(1);
}

var VERIFY_TOKEN = process.env.SLACK_VERIFY_TOKEN
if (!VERIFY_TOKEN) {
  console.error('SLACK_VERIFY_TOKEN is required')
  process.exit(1)
}

var controller = Botkit.slackbot({
  // reconnect to Slack RTM when connection goes bad
  retry: Infinity,
  send_via_rtm: true,
  debug: false
});

console.log('Starting in Beep Boop multi-team mode')
var BeepBoop = BeepBoopBotkit.start(controller, { debug: true, scopes: ['channels:history'] })
var MarkovChain = require('markovchain');
var JSMegaHal = require('jsmegahal');


var COMMAND_MAPPINGS = {
    "/incaseofjoshrant": handle_incaseofjoshrant,
    "/markov": handle_markov,
    "/megahal": handle_megahal,
    "/echo": handle_echo,
    "/ascii": handle_ascii
};

controller.setupWebserver(PORT, function(err, webserver) {
    if (err) {
        console.error(err)
        process.exit(1)
    }
    // Setup our slash command webhook endpoints
    controller.createWebhookEndpoints(webserver)
});

controller.on('slash_command', function(bot, message) {
    if (message.token !== VERIFY_TOKEN) {
        return bot.res.send(401, 'Unauthorized');
    }
    if (!COMMAND_MAPPINGS[message.command]) {
        bot.replyAcknowledge();
        return;
    }
    
    var params = StringArgv(message.text);

    COMMAND_MAPPINGS[message.command](bot, message, params);    
});

// receive an interactive message, and reply with a message that will replace the original
controller.on('interactive_message_callback', function(bot, message) {
    if (message.token !== VERIFY_TOKEN) {
        return bot.res.send(401, 'Unauthorized');
    }
    
    return bot.res.send(200, ''); //do nothing
});

// ============ various slash command handlers =============

function handle_incaseofjoshrant(bot, message, params) {
    bot.replyPublicDelayed(message, {
        "response_type": "in_channel",
        "attachments": [{
            "title": '@' + message.user_name + ' activated emergency alert procedure',
            "image_url": "http://i.imgur.com/wtYhyuN.png"
        }]
    }, function() {
        return bot.res.send(200, '');
    });
}

function handle_markov(bot, message, params) {
    //Hack in and get our access token
    var workerKey = Object.keys(BeepBoop.workers)[0];
    var token = BeepBoop.workers[workerKey].resource.SlackAccessToken;
    
    var count = 500;
    if (params && params.length > 0) {
        count = Number(params[0]);
    }
    
    //Get our message history
    bot.api.channels.history({
        channel: message.channel_id,
        token: token,
        count: count
    }, function(err, data) {
        
        var m = new MarkovChain('');
        for (var i = 0; i < data.messages.length; i++) {
            if (data.messages[i].user) {
                m.parse(data.messages[i].text);
            }
        }
        
        var title = "@" + message.user_name + " requested a markov chain based on the last " + count + " messages";
        
        var text = m.process();
        bot.replyPublicDelayed(message, {
            "response_type": "in_channel",
            "attachments": [{
                 "title": title,
                "text": text 
            }]
        }, function() {
            return bot.res.send(200, '');
        });
    });
}

function handle_megahal(bot, message, params) {
    //Hack in and get our access token
    var workerKey = Object.keys(BeepBoop.workers)[0];
    var token = BeepBoop.workers[workerKey].resource.SlackAccessToken;
    
    var count = 1000;
    var order = 2;
    var question = undefined;
    if (params && params.length > 0) {
        question = params.join(' ');
    }
    
    //Get our message history
    bot.api.channels.history({
        channel: message.channel_id,
        token: token,
        count: count
    }, function(err, data) {
        
        var m = new JSMegaHal(order);
        var currentUser = null;
        var currentMessage = null;
        for (var i = 0; i < data.messages.length; i++) {
            var msg = data.messages[i];
            
            if (!msg.user) {
                continue;
            }
            
            if (msg.user !== currentUser) {
                if (currentMessage) {
                    m.add(currentMessage);
                }
                currentUser = msg.user;
                currentMessage = msg.text;
            } else {
                //Same user with multiple messages should be combined
                currentMessage += '. ' + msg.text; 
            }
        }
        
        m.add(currentMessage);
        
        var title = null;
        if (question) {
            title = "@" + message.user_name + " requested a megahal response to: '" + question + "'";
        } else {
            title = "@" + message.user_name + " requested a random megahal response";
        }
        
        var text = m.getReply(question);
        bot.replyPublicDelayed(message, {
            "response_type": "in_channel",
            "attachments": [{
                 "title": title,
                "text": text 
            }]
        }, function() {
            return bot.res.send(200, '');
        });
    });
}

function download_image(uri, callback) {
    request.head(uri, function(err, res, body){
    
    //Anything bigger than 5MB is too much
    if (res.headers['content-length'] > (1024 * 1024 * 5)) {
        callback(false, null);
        return;
    }
    
    var extension = '.jpg';
    var contentType = res.headers['content-length'];
    if (contentType.indexOf('gif') >= 0) {
        extension = '.gif';
    } else if (contentType.indexOf('png') >= 0) {
        extension = '.png';
    }
    
    var tmpobj = tmp.fileSync({
        postfix: extension,
        color: false
    });
    
    request(uri).pipe(fs.createWriteStream(tmpobj.name)).on('close', function(response) {
        callback(true, tmpobj);
    });
  });
}

function handle_ascii(bot, message, params) {
    var uri = params[0];
    
    download_image(uri, function(success, tmpobj) {
        if (!success) {
            if (tmpobj) {
                tmpobj.removeCallback();
            }
            return;
        }
        
        var pic = new Ascii(tmpobj.name);
        pic.convert(function (err, result) {
            var title = "@" + message.user_name + " requested ASCII art for '" + uri + "'";
            var text = err || result;
            bot.replyPublicDelayed(message, {
                "response_type": "in_channel",
                "attachments": [{
                    "title": title,
                    "text":  "```" + text + "```",
                    "mrkdwn_in": ["text"]
                }]
            }, function() {
                return bot.res.send(200, '');
            });
            
            tmpobj.removeCallback();
        });
    });
}

function handle_echo(bot, message, params) {
    var text = 'Whatever...'
    if (params) {
        var obj = null;
        switch (params[0]) {
            case "beepboop":
                obj = BeepBoop;
                break;
            case "beepboopbotkit":
                obj = BeepBoopBotkit;
                break;
            case "controller":
                obj = controller;
                break;
            case "message":
                obj = message;
                break;
            default:
                obj = bot;
                break;
        }
        for (var i = 1; i < params.length; i++) {
            obj = obj[params[i]];
            if (obj === null || obj === undefined) {
                text = "Couldnt find " + params[i] + " in " + obj;
                break;
            }
        }
     
        if (obj == null || obj == undefined) {
            text = 'null/undefined';
        } else if (obj instanceof String) {
            text = obj + ':(String)';
        } else if (obj instanceof Number) {
            text = obj + ':(Number)';
        } else if (obj instanceof Object) {
            text = obj + ':(Object) has keys ' + Object.keys(obj);
        } else {
            text = obj + ':(' + typeof obj + ') has keys ' + Object.keys(obj);
        }
    }
    bot.replyPublicDelayed(message, {
        "response_type": "in_channel",
        "attachments": [{
            "title": '/echo ' + params.join(' '),
            "text": text
        }]
    }, function() {
        return bot.res.send(200, '');
    });
}

