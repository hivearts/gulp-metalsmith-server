// Express server for development
var express = require('express'),
    app = express(),
    colors = require('colors'),
    nodemailer = require('nodemailer'),
    bodyParser = require('body-parser'),
    config = require('../../server.json'),
    port = process.env.PORT || 8080;

var MongoClient = require('mongodb').MongoClient, DB;

var metalsmith_task = require('./lib/metalsmith_task.js');
var shopify_task = require('./lib/shopify_task.js');

var debug = require('debug');

debug.enable('*');

colors.setTheme({
  silly: 'rainbow',
  input: 'grey',
  verbose: 'cyan',
  prompt: 'grey',
  info: 'green',
  data: 'grey',
  help: 'cyan',
  warn: 'yellow',
  debug: 'blue',
  error: 'red'
});

//app.get('*', function(req, res, next) {
//  console.log(req.url);
//  next();
//});

app.use(express.static(config.publicDir));
app.use(bodyParser.urlencoded({
  extended: false
}));

var pageCounterInitialValue = 333;

app.get('/pagecounter/:pageId', function(req, res, next) {
  //console.log('pagecounter begin', req.pageId);
  if (!req.pageId || !DB) {
    console.log('pagecounter request failed 1', req.pageId, DB);
    return res.send('0');
  }

  DB.collection('PageCounters', function(err, collection) {
    if (err || !collection) {
      console.log('pagecounter request failed 2', req.pageId, DB, err);
      return res.send('0');
    }

    collection.findOne({_id: req.pageId}, function(err, doc) {
      if (err) {
        console.log('pagecounter request failed 3', req.pageId, DB, err);
        return res.send('0');
      }

      if (!doc) {
        console.log('pagecounter new counter for ', req.pageId);
        collection.insertOne({_id: req.pageId, value: pageCounterInitialValue});
        return res.send(String(pageCounterInitialValue));
      }

      collection.update({_id: req.pageId}, {$inc: {value: 1}});
      res.send(String(doc.value + 1));
    });
  });
});


app.param('pageId', function(req, res, next, id) {
  req.pageId = id;
  next();
});


// Webhook endpoint
app.post(config.webhook, function(req, res) {

  console.log(new Date() + ': ' +
      'Webhook detected, rebuilding website started..'
          .cyan);

  function cb(err, files) {
    console.log(new Date() + ': ' + 'Building website completed.'.green, err, files);

    runShopify();
  }

  // rebuild website
  metalsmith_task.build(config.publicDir, config.metalsmith, cb);

  // Respond with a success code
  res.send('Webhook detected, rebuilding website started..');
  res.status(200).end();

});

// nodemailer
app.post('/sendemail', function(req, res) {
  //Setup Nodemailer transport, I chose gmail. Create an application-specific password to avoid problems.
  var transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
      user: config.email.user,
      pass: config.email.pass
    }
  });

  var nameText = config.email.nameText || (config.email.eng ? 'Name: ' : 'Ime: ');
  var emailTelText = config.email.emailTelText || (config.email.eng ? 'Email/Phone: ' : 'Email/Tel: ');
  var companyText = config.email.companyText || (config.email.eng ? 'Company: ' : 'Kompanija: ');
  var serviceText = config.email.serviceText || (config.email.eng ? 'Type of service: ' : 'Vrsta usluge: ');
  var dontReplyText = config.email.dontReplyText || (config.email.eng ?
          '***Do not reply to this message with "Reply" option, use data from "Email/Phone:" field provided!'
          : '***Na ovu poruku niposto ne odgovarati sa reply, vec na kontakt koji je osoba unela pod Email/Tel polje iznad.');

  // setup e-mail data with unicode symbols
  var mailOptions = {
    from: req.body.name + "\u003C" + req.body.email + "\u003E",
    to: config.email.sendTo, // list of receivers
    subject: 'Website contact form',
    html: nameText + req.body.name + '<br>' + emailTelText + req.body.email + '<br>' + companyText + req.body.company + '<br>' + serviceText + req.body.service + '<br>' + '---' +
    '<br><br>' + req.body.message + '<br><br>' + '---' + '<br>' + dontReplyText,
    generateTextFromHTML: true
  };

  // send mail with defined transport object
  console.log("Name: ".grey + req.body.name);
  console.log("Email: ".grey + req.body.email);
  console.log("Company: ".grey + req.body.company);
  console.log("Service: ".grey + req.body.service);
  console.log("Message: ".grey + req.body.message);
  transporter.sendMail(mailOptions, function(error, info) {
    if (error) {
      console.log(error);
    } else {
      console.log("Message sent: ".green + info.response);
      if(config.email.redirect) {
        res.redirect(config.email.redirect);
      } else {
        res.send('Message sent');
      }
    }
  });
});

// build the website
var server = app.listen(port, function() {

  console.log('Listening on port '.data + server.address().port);
  console.log(new Date() + ': ' + 'Building website to /public..'.cyan);

  function cb(err, files) {
    console.log(new Date() + ': ' + 'Building website completed.'.green, err, files);

    runShopify();
  }

  metalsmith_task.build(config.publicDir, config.metalsmith, cb);

});

// catch 404 and forward to error handler
app.use(function(req, res) {
  res.redirect('/404');
});

if (config.db) {
  MongoClient.connect(config.db, function(err, db) {
    if(!err) {
      DB = db;
    } else {
      console.log('mongodb err:', err);
    }
  });
}

function runShopify() {
  if (!config.shopify) {
    return;
  }

  console.log(new Date() + ': ' + 'Starting Shopify task...'.yellow);
  shopify_task.run(config.publicDir, config.shopify, function() {
    console.log(new Date() + ': ' + 'Shopify task completed.'.green);
  });
}
