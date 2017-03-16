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
    if (message.command !== "/incaseofjoshrant") {
        bot.replyAcknowledge();
        return;
    }
    
    var user = message.user_name;
    var params = message.text.match(/\w+|"[^"]+"/g); //split our (possibly quoted) params

    bot.replyPublicDelayed(message, {
        "response_type": "in_channel",
        "attachments": [{
            "title": '@' + user + ' activated emergency alert procedure',
            "image_url": "http://i.imgur.com/wtYhyuN.png"
        }]
    }, function() {
        return bot.res.send(200, '');
    });
});

// receive an interactive message, and reply with a message that will replace the original
controller.on('interactive_message_callback', function(bot, message) {
    if (message.token !== VERIFY_TOKEN) {
        return bot.res.send(401, 'Unauthorized');
    }
    
    return bot.res.send(200, ''); //do nothing
});
