// Express server for development
var express = require('express'),
  app = express(),
  smith = require('gulp-metalsmith-build'),
  colors = require('colors'),
  nodemailer = require('nodemailer'),
  bodyParser = require('body-parser'),
  config = require('../../config').server,
  port = process.env.PORT || 8080;

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


// app.use(morgan('short'));
app.use(express.static('public'));
app.use(bodyParser.urlencoded({
  extended: false
}));

// Webhook endpoint
app.post(config.webhook, function(req, res) {

  console.log(new Date() + ': ' +
    'Webhook detected, rebuilding website started..'
    .cyan);

  function cb() {
    console.log(new Date() + ': ' + 'Rebuilding website completed.'.green);
  }

  // rebuild website
  smith.build(cb);

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

  // setup e-mail data with unicode symbols
  var mailOptions = {
    from: req.body.name + "\u003C" + req.body.email + "\u003E",
    to: config.email.sendTo, // list of receivers
    subject: 'Website contact form',
    html: 'Ime: ' + req.body.name + '<br>' + 'Email: ' + req.body.email +
      '<br><br>' + req.body.message,
    generateTextFromHTML: true
  };

  // send mail with defined transport object
  transporter.sendMail(mailOptions, function(error, info) {
    if (error) {
      console.log(error);
    } else {
      console.log("Name: ".grey + req.body.name);
      console.log("Email: ".grey + req.body.email);
      console.log("Message: ".grey + req.body.message);
      console.log("Message sent: ".green + info.response);
      res.send('Message sent');
    }
  });
});

// build the website
var server = app.listen(port, function() {

  console.log('Listening on port '.data + server.address().port);
  console.log(new Date() + ': ' + 'Building website to /public..'.cyan);

  function cb() {
    console.log(new Date() + ': ' + 'Building website completed.'.green);
  }

  smith.build(cb);

});

// catch 404 and forward to error handler
app.use(function(req, res) {
  res.redirect('/404');
});