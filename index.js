var Botkit = require('botkit');

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
  debug: false
});

console.log('Starting in Beep Boop multi-team mode')
require('beepboop-botkit').start(controller, { debug: true })
var markov = require('markov')(1);

var COMMAND_MAPPINGS = {
    "/incaseofjoshrant": handle_incaseofjoshrant,
    "/markov": handle_markov
};

controller.setupWebserver(PORT, function(err, webserver) {
    if (err) {
        console.error(err)
        process.exit(1)
    }
    // Setup our slash command webhook endpoints
    controller.createWebhookEndpoints(webserver)
});

controller.hears('.*', ['message_received'], function(bot, message) {    
    console.log("Got message type:" + message.type);
    console.log("bot.rtm:" + bot.rtm);
    console.log("message contents:" + JSON.stringify(message));
    
    if (message.text) {
        markov.seed(message.text);
    }
});

controller.on('slash_command', function(bot, message) {
    if (message.token !== VERIFY_TOKEN) {
        return bot.res.send(401, 'Unauthorized');
    }
    if (!VALID_COMMANDS[message.command]) {
        bot.replyAcknowledge();
        return;
    }
    
    var user = message.user_name;
    var params = message.text.match(/\w+|"[^"]+"/g); //split our (possibly quoted) params

    VALID_COMMANDS[message.command](bot, message, params);    
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
            "title": '@' + user + ' activated emergency alert procedure',
            "image_url": "http://i.imgur.com/wtYhyuN.png"
        }]
    }, function() {
        return bot.res.send(200, '');
    });
}

function handle_markov(bot, message, params) {
    var key = null;
    if (params && params.length > 0) {
        key = params[1];
    } else {
        key = markov.pick();
    }
    
    var text = markov.fill(key, 100);
    bot.replyPublicDelayed(message, {
        "response_type": "in_channel",
        "attachments": [{
            "title": '@' + user + ' wants some markov nonsense.',
            "text": text
        }]
    }, function() {
        return bot.res.send(200, '');
    });
}

